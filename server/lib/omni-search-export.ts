import type { Express, RequestHandler } from "express";
import { mkdtemp, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { availableOmniEmails } from "./omni-mailbox-group-routes";
import { EmlZipWriter, safeEmlName } from "./omni-eml-zip";
type Message = { id: string; mailbox: string; subject: string; personal?: boolean };
type Dependencies = {
  inventory: (userId: string) => Promise<Set<string>>;
  token: (userId: string) => Promise<{ accessToken: string; personalMailbox?: string }>;
  mime: (token: string, message: Message, signal: AbortSignal) => Promise<Buffer>;
};
const MAX_EXPORT_BYTES = 256 * 1024 * 1024;
export function validateExportMessages(body: any, allowed: Set<string>): Message[] {
  if (body?.format !== "eml" || !Array.isArray(body.messages) || !body.messages.length || body.messages.length > 10_000) throw new Error("invalid_export");
  const unique = new Map<string, Message>();
  for (const item of body.messages) {
    if (!item || typeof item.id !== "string" || !item.id || item.id.length > 2048 ||
      typeof item.mailbox !== "string" || !allowed.has(item.mailbox.toLowerCase()) ||
      typeof item.subject !== "string" || item.subject.length > 2048) throw new Error("mailbox_forbidden");
    const mailbox = item.mailbox.toLowerCase();
    unique.set(`${mailbox}\0${item.id}`, { id: item.id, mailbox, subject: item.subject });
  }
  return Array.from(unique.values());
}
export function registerOmniSearchExport(app: Express, auth: RequestHandler, deps: Dependencies) {
  const running = new Set<string>();
  app.post("/api/nexus/search-export", auth, async (req, res) => {
    const userId = req.session.user!.id;
    if (running.has(userId)) return res.status(409).json({ error: "export_busy" });
    running.add(userId);
    const controller = new AbortController();
    const abort = () => controller.abort();
    res.once("close", abort);
    let directory: string | undefined;
    try {
      const messages = validateExportMessages(req.body, await deps.inventory(userId));
      const authorization = await deps.token(userId);
      directory = await mkdtemp(join(tmpdir(), "omni-export-"));
      const path = join(directory, "emails.zip");
      const file = await open(path, "wx", 0o600);
      let total = 0;
      try {
        const zip = new EmlZipWriter(file);
        for (let index = 0; index < messages.length; index++) {
          const message = messages[index];
          controller.signal.throwIfAborted();
          const mime = await deps.mime(authorization.accessToken,
            { ...message, personal: authorization.personalMailbox?.toLowerCase() === message.mailbox }, controller.signal);
          total += mime.length;
          if (total > MAX_EXPORT_BYTES) throw new Error("export_limit");
          if (!mime.length) throw new Error("mime_unavailable");
          const filename = `${String(index + 1).padStart(5, "0")}-${safeEmlName(message.subject)}.eml`;
          await zip.add(`${safeEmlName(message.mailbox)}/${filename}`, mime);
        }
        await zip.finish();
      } finally { await file.close(); }
      res.setHeader("Cache-Control", "no-store");
      await new Promise<void>(resolve => res.download(path, "nexus-omni-eml.zip", error => {
        if (error && !res.headersSent && !res.destroyed) res.status(502).json({ error: "export_failed" });
        resolve();
      }));
    } catch (error) {
      if (!res.headersSent && !res.destroyed) {
        const code = (error as Error).message;
        const status = code === "mailbox_forbidden" ? 403 : code === "invalid_export" ? 400 : code === "export_limit" ? 413 : 502;
        res.status(status).json({ error: ["mailbox_forbidden", "invalid_export", "export_limit"].includes(code) ? code : "export_failed" });
      }
    } finally {
      res.off("close", abort); running.delete(userId);
      if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
  });
}
export function createOmniExportDependencies(storage: any): Dependencies {
  return {
    inventory: userId => availableOmniEmails(storage, userId),
    token: async userId => {
      const connection = await storage.getUserMs365Connection(userId);
      if (!connection?.isConnected) throw new Error("mailbox_disconnected");
      const { decryptTokenSafe, encryptTokenWithMarker } = await import("./token-crypto");
      const { getValidAccessToken } = await import("./ms365");
      const result = await getValidAccessToken(decryptTokenSafe(connection.accessToken), connection.tokenExpiresAt,
        connection.refreshToken ? decryptTokenSafe(connection.refreshToken) : null);
      if (!result?.accessToken) throw new Error("mailbox_disconnected");
      if (result.refreshed && result.refreshToken) await storage.updateUserMs365ConnectionTokens(userId, {
        accessToken: encryptTokenWithMarker(result.accessToken), refreshToken: encryptTokenWithMarker(result.refreshToken),
        tokenExpiresAt: result.expiresOn || new Date(Date.now() + 3600_000),
      });
      return { accessToken: result.accessToken, personalMailbox: connection.email };
    },
    mime: async (token, message, signal) => {
      const base = message.personal ? "/me" : `/users/${encodeURIComponent(message.mailbox)}`;
      const response = await fetch(`https://graph.microsoft.com/v1.0${base}/messages/${encodeURIComponent(message.id)}/$value`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
      if (!response.ok || !response.body) throw new Error("mime_unavailable");
      const reader = response.body.getReader(), chunks: Buffer[] = [];
      let size = 0;
      try {
        for (;;) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > 50 * 1024 * 1024) throw new Error("export_limit");
          chunks.push(Buffer.from(part.value));
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      return Buffer.concat(chunks);
    },
  };
}
