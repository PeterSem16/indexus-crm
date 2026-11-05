import type { Express, RequestHandler } from "express";
import { mkdtemp, open, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { availableOmniEmails } from "./omni-mailbox-group-routes";
import { EmlZipWriter, safeEmlName } from "./omni-eml-zip";
import { createExportGraph, MAX_EMAIL_ZIP_BYTES, type ExportMessage as Message, type ExportDelivery } from "./omni-export-graph";
import { attachPersonalExportSignature, personalExportSignature } from "./omni-export-signature";
type Dependencies = {
  inventory: (userId: string) => Promise<Set<string>>;
  token: (userId: string) => Promise<{ accessToken: string; personalMailbox?: string }>;
  mime: (token: string, message: Message, signal: AbortSignal) => Promise<Buffer>;
  msg?: (token: string, message: Message, signal: AbortSignal) => Promise<Buffer>;
  send?: (token: string, path: string, filename: string, delivery: ExportDelivery, signal: AbortSignal) => Promise<void>;
  signature?: (userId: string) => Promise<string | undefined>;
};
const MAX_EXPORT_BYTES = 256 * 1024 * 1024;
export function validateExportMessages(body: any, allowed: Set<string>): Message[] {
  if (!["eml", "msg"].includes(body?.format) || !Array.isArray(body.messages) || !body.messages.length || body.messages.length > 10_000) throw new Error("invalid_export");
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
export function validateExportDelivery(value: unknown): ExportDelivery | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== "object") throw new Error("invalid_delivery");
  const { to, subject, body, includeSignature } = value as ExportDelivery;
  if (typeof to !== "string" || to.length > 254 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) ||
    typeof subject !== "string" || !subject.trim() || subject.length > 200 || /[\r\n]/.test(subject) ||
    typeof body !== "string" || body.length > 20_000 ||
    (includeSignature !== undefined && typeof includeSignature !== "boolean")) throw new Error("invalid_delivery");
  return { to, subject: subject.trim(), body, ...(includeSignature === true ? { includeSignature: true } : {}) };
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
      let delivery = validateExportDelivery(req.body.delivery);
      const authorization = await deps.token(userId);
      if (delivery && (!authorization.personalMailbox || !deps.send)) throw new Error("personal_mailbox_required");
      if (delivery?.includeSignature) {
        delivery = attachPersonalExportSignature(delivery, await deps.signature?.(userId));
      }
      const format: "eml" | "msg" = req.body.format;
      const filename = `nexus-omni-${format}.zip`;
      directory = await mkdtemp(join(tmpdir(), "omni-export-"));
      const path = join(directory, "emails.zip");
      const file = await open(path, "wx", 0o600);
      let total = 0;
      try {
        const zip = new EmlZipWriter(file);
        for (let index = 0; index < messages.length; index++) {
          const message = messages[index];
          controller.signal.throwIfAborted();
          const getMessage = format === "msg" ? deps.msg : deps.mime;
          if (!getMessage) throw new Error("export_failed");
          const mime = await getMessage(authorization.accessToken,
            { ...message, personal: authorization.personalMailbox?.toLowerCase() === message.mailbox }, controller.signal);
          total += mime.length;
          if (total > MAX_EXPORT_BYTES) throw new Error("export_limit");
          if (!mime.length) throw new Error("mime_unavailable");
          const entryName = `${String(index + 1).padStart(5, "0")}-${safeEmlName(message.subject)}.${format}`;
          await zip.add(`${safeEmlName(message.mailbox)}/${entryName}`, mime);
        }
        await zip.finish();
      } finally { await file.close(); }
      res.setHeader("Cache-Control", "no-store");
      if (delivery) {
        if ((await stat(path)).size > MAX_EMAIL_ZIP_BYTES) throw new Error("email_export_limit");
        controller.signal.throwIfAborted();
        await deps.send!(authorization.accessToken, path, filename, delivery, controller.signal);
        res.status(202).json({ sent: true, sender: authorization.personalMailbox });
        return;
      }
      await new Promise<void>(resolve => res.download(path, filename, error => {
        if (error && !res.headersSent && !res.destroyed) res.status(502).json({ error: "export_failed" });
        resolve();
      }));
    } catch (error) {
      if (!res.headersSent && !res.destroyed) {
        const code = (error as Error).message;
        const status = ["mailbox_forbidden", "personal_mailbox_required"].includes(code) ? 403 :
          ["invalid_export", "invalid_delivery", "signature_unavailable"].includes(code) ? 400 : ["export_limit", "email_export_limit"].includes(code) ? 413 : 502;
        res.status(status).json({ error: ["mailbox_forbidden", "personal_mailbox_required", "invalid_export", "invalid_delivery", "signature_unavailable", "export_limit", "email_export_limit"].includes(code) ? code : "export_failed" });
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
    mime: (token, message, signal) => createExportGraph(token, signal).message(message, "eml"),
    msg: (token, message, signal) => createExportGraph(token, signal).message(message, "msg"),
    send: (token, path, filename, delivery, signal) => createExportGraph(token, signal).send(path, filename, delivery),
    signature: userId => personalExportSignature(storage, userId),
  };
}
