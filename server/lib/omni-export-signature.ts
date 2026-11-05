import { sanitizeSignatureHtml } from "../../client/src/lib/sanitize-html";
import type { ExportDelivery } from "./omni-export-graph";

/** The same personal-mailbox key used by Omni's existing signature settings. */
export async function personalExportSignature(storage: {
  getEmailSignature: (userId: string, mailbox: string) => Promise<{ isActive: boolean; htmlContent: string } | undefined>;
  getUser: (userId: string) => Promise<{ signature?: string | null } | undefined>;
}, userId: string): Promise<string | undefined> {
  const signature = await storage.getEmailSignature(userId, "personal");
  // An explicitly disabled/empty personal signature must not revive a legacy one.
  if (signature) return signature.isActive ? signature.htmlContent : undefined;
  return (await storage.getUser(userId))?.signature || undefined;
}

export function attachPersonalExportSignature(delivery: ExportDelivery, signature: string | undefined): ExportDelivery {
  if (typeof signature !== "string" || !signature.trim() || signature.length > 1_000_000) {
    throw new Error("signature_unavailable");
  }
  const safeSignature = sanitizeSignatureHtml(signature);
  if (!safeSignature.trim()) throw new Error("signature_unavailable");
  const message = delivery.body.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]!)).replace(/\r\n|\r|\n/g, "<br>");
  return { ...delivery, htmlBody: `<div>${message}</div><br>${safeSignature}` };
}
