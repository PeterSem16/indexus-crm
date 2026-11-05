import { open, stat } from "node:fs/promises";
import { writeOutlookMsg, type MsgAttachment, type MsgMessage } from "./omni-msg";

export type ExportMessage = { id: string; mailbox: string; subject: string; personal?: boolean };
export type ExportDelivery = { to: string; subject: string; body: string; includeSignature?: boolean; htmlBody?: string };
export const MAX_EMAIL_ZIP_BYTES = 25 * 1024 * 1024;
const MAX_MESSAGE_BYTES = 50 * 1024 * 1024;
const GRAPH = "https://graph.microsoft.com/v1.0";
type ExportGraphStage = "source" | "draft" | "attachment" | "send";

export class OmniExportGraphError extends Error {
  constructor(readonly stage: ExportGraphStage, readonly status?: number) {
    super(status === 401 ? "mailbox_disconnected"
      : status === 403 ? (stage === "source" ? "mailbox_forbidden" : "send_permissions_required")
      : stage === "source" ? "message_unavailable"
      : stage !== "send" ? "send_preparation_failed"
      : status === undefined || status === 408 || status >= 500 ? "send_uncertain" : "send_rejected");
  }
}

async function boundedBytes(response: Response, signal: AbortSignal): Promise<Buffer> {
  if (!response.ok || !response.body) throw new Error("message_unavailable");
  const reader = response.body.getReader(), chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_MESSAGE_BYTES) throw new Error("export_limit");
      chunks.push(Buffer.from(part.value));
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export function createExportGraph(token: string, signal: AbortSignal, request: typeof fetch = fetch) {
  const call = async (path: string, options: RequestInit = {}, stage: ExportGraphStage = "source") => {
    signal.throwIfAborted();
    try { return await request(`${GRAPH}${path}`, { ...options,
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
      signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
    }); } catch { throw new OmniExportGraphError(stage); }
  };
  const json = async (path: string, options?: RequestInit, stage: ExportGraphStage = "source") => {
    const response = await call(path, options, stage);
    if (!response.ok) throw new OmniExportGraphError(stage, response.status);
    try { return JSON.parse((await boundedBytes(response, signal)).toString("utf8")); }
    catch (error) {
      if ((error as Error).message === "export_limit") throw error;
      throw new OmniExportGraphError(stage, response.status);
    }
  };
  const messageBytes = async (path: string) => {
    const response = await call(path);
    if (!response.ok) throw new OmniExportGraphError("source", response.status);
    return boundedBytes(response, signal);
  };
  return {
    async message(message: ExportMessage, format: "eml" | "msg") {
      const base = message.personal ? "/me" : `/users/${encodeURIComponent(message.mailbox)}`;
      const path = `${base}/messages/${encodeURIComponent(message.id)}`;
      if (format === "eml") return messageBytes(`${path}/$value`);
      const data: MsgMessage = await json(`${path}?$select=subject,body,bodyPreview,from,sender,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,internetMessageId,internetMessageHeaders,importance,isRead`);
      const attachments: MsgAttachment[] = [];
      let next: string | undefined = `${path}/attachments?$select=id,name,contentType,size,isInline&$top=100`;
      let total = Buffer.byteLength(JSON.stringify(data));
      let pages = 0;
      while (next) {
        if (++pages > 100) throw new Error("export_limit");
        const page = await json(next);
        for (const attachment of page.value || []) {
          if (attachment["@odata.type"] === "#microsoft.graph.referenceAttachment") throw new Error("unsupported_attachment");
          if (!attachment.id || (total + (attachment.size || 0)) > MAX_MESSAGE_BYTES) throw new Error("export_limit");
          const embedded = attachment["@odata.type"] === "#microsoft.graph.itemAttachment";
          const attachmentPath = `${path}/attachments/${encodeURIComponent(attachment.id)}`;
          let contentId: string | undefined;
          let extension = "";
          let contentType = attachment.contentType;
          if (embedded) {
            const detail = await json(`${attachmentPath}?$expand=microsoft.graph.itemattachment/item`);
            const type = detail.item?.["@odata.type"];
            if (type === "#microsoft.graph.message") { extension = ".eml"; contentType = "message/rfc822"; }
            else if (type === "#microsoft.graph.event") { extension = ".ics"; contentType = "text/calendar"; }
            else if (type === "#microsoft.graph.contact") { extension = ".vcf"; contentType = "text/vcard"; }
            else throw new Error("unsupported_attachment");
          } else if (attachment.isInline) {
            contentId = (await json(`${attachmentPath}?$select=contentId`)).contentId;
          }
          const content = await messageBytes(`${attachmentPath}/$value`);
          total += content.length;
          if (total > MAX_MESSAGE_BYTES) throw new Error("export_limit");
          // Graph returns embedded messages as MIME, not MSG. Preserve them as EML attachments.
          const name = `${attachment.name || "attachment"}${extension && !attachment.name?.toLowerCase().endsWith(extension) ? extension : ""}`;
          attachments.push({ name, contentType, data: content, isInline: attachment.isInline, contentId });
        }
        const link = page["@odata.nextLink"];
        if (link && (typeof link !== "string" || !link.startsWith(`${GRAPH}${path}/attachments?`))) throw new Error("invalid_graph_page");
        next = link ? link.slice(GRAPH.length) : undefined;
      }
      const bytes = writeOutlookMsg(data, attachments);
      if (bytes.length > MAX_MESSAGE_BYTES) throw new Error("export_limit");
      return bytes;
    },
    async send(path: string, filename: string, delivery: ExportDelivery) {
      const size = (await stat(path)).size;
      if (size > MAX_EMAIL_ZIP_BYTES) throw new Error("email_export_limit");
      const message = { subject: delivery.subject, body: delivery.htmlBody !== undefined
        ? { contentType: "HTML", content: delivery.htmlBody }
        : { contentType: "Text", content: delivery.body },
        toRecipients: [{ emailAddress: { address: delivery.to } }] };
      if (size < 3_000_000) {
        // Mail.Send is sufficient; creating a draft unnecessarily requires Mail.ReadWrite.
        // Base64 plus bounded message text stays below Graph's JSON request ceiling.
        const file = await open(path, "r");
        let content: Buffer;
        try { content = await file.readFile(); } finally { await file.close(); }
        const payload = JSON.stringify({ message: { ...message, attachments: [{
            "@odata.type": "#microsoft.graph.fileAttachment", name: filename,
            contentType: "application/zip", contentBytes: content.toString("base64"),
          }] }, saveToSentItems: true });
        if (Buffer.byteLength(payload) < 4_000_000) {
          const response = await call("/me/sendMail", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: payload,
          }, "send");
          if (response.status !== 202) throw new OmniExportGraphError("send", response.status);
          return;
        }
      }
      // Always /me: never impersonate a shared mailbox or accept a client sender.
      // Draft/upload supports ZIPs beyond Graph's 4 MB JSON request ceiling.
      const draft = await json("/me/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(message) }, "draft");
      if (!draft.id) throw new OmniExportGraphError("draft");
      const draftPath = `/me/messages/${encodeURIComponent(draft.id)}`;
      let sendAttempted = false;
      try {
        const file = await open(path, "r");
        try {
          {
            const session = await json(`${draftPath}/attachments/createUploadSession`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ AttachmentItem: { attachmentType: "file", name: filename, size, contentType: "application/zip" } }),
            }, "attachment");
            let url: URL;
            try { url = new URL(session.uploadUrl); }
            catch { throw new OmniExportGraphError("attachment"); }
            if (url.protocol !== "https:" || !["outlook.com", "office.com", "office365.com", "microsoft.com"].some(domain =>
              url.hostname === domain || url.hostname.endsWith(`.${domain}`))) throw new OmniExportGraphError("attachment");
            const chunkSize = 10 * 320 * 1024;
            for (let position = 0; position < size;) {
              signal.throwIfAborted();
              const chunk = Buffer.alloc(Math.min(chunkSize, size - position));
              const { bytesRead } = await file.read(chunk, 0, chunk.length, position);
              if (bytesRead !== chunk.length) throw new OmniExportGraphError("attachment");
              let response: Response;
              try { response = await request(url, { method: "PUT", body: chunk,
                signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
                headers: { "Content-Type": "application/octet-stream", "Content-Length": String(chunk.length),
                  "Content-Range": `bytes ${position}-${position + chunk.length - 1}/${size}` } }); }
              catch { throw new OmniExportGraphError("attachment"); }
              if (response.status !== (position + chunk.length === size ? 201 : 200)) throw new OmniExportGraphError("attachment", response.status);
              await response.arrayBuffer();
              position += chunk.length;
            }
          }
        } finally { await file.close(); }
        signal.throwIfAborted();
        sendAttempted = true;
        const response = await call(`${draftPath}/send`, { method: "POST" }, "send");
        if (response.status !== 202) {
          const error = new OmniExportGraphError("send", response.status);
          sendAttempted = error.message === "send_uncertain";
          throw error;
        }
      } finally {
        // A transport failure after send can mean accepted delivery: never resend
        // or delete in that ambiguous state. Fail explicitly to the caller.
        if (!sendAttempted) await call(draftPath, { method: "DELETE" }, "draft").catch(() => {});
      }
    },
  };
}
