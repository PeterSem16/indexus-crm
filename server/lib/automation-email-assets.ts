import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Only application-owned artwork, never a client-supplied file path. */
export async function automationEmailInlineAttachments(html: string) {
  const references = new Set([...html.matchAll(/cid:([^"'\s<>]+)/gi)].map(match => match[1]));
  const attachments: any[] = [];
  for (const contentId of references) {
    const match = /^indexus-automation-(task|attention|success|deadline)$/.exec(contentId);
    if (!match) throw new Error("Email references an unavailable inline illustration");
    const bytes = await readFile(resolve(process.cwd(), "server/assets/automation-email", `automation-${match[1]}.gif`));
    attachments.push({ "@odata.type": "#microsoft.graph.fileAttachment",
      name: `automation-${match[1]}.gif`, contentType: "image/gif", isInline: true,
      contentId, contentBytes: bytes.toString("base64") });
  }
  return attachments;
}
