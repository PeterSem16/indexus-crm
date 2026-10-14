import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { automationPhoneArtworkFor } from "./automation-phone-artwork";

/** Only application-owned artwork, never a client-supplied file path. */
export async function automationEmailInlineAttachments(html: string) {
  const references = new Set([...html.matchAll(/cid:([^"'\s<>]+)/gi)].map(match => match[1]));
  const attachments: any[] = [];
  for (const contentId of references) {
    const human = /^indexus-automation-human-(task|call|deadline)$/.exec(contentId);
    if (human) {
      const bytes = await readFile(resolve(process.cwd(), "server/assets/automation-email", `human-${human[1]}.png`));
      attachments.push({ "@odata.type": "#microsoft.graph.fileAttachment",
        name: `human-${human[1]}.png`, contentType: "image/png", isInline: true,
        contentId, contentBytes: bytes.toString("base64") });
      continue;
    }
    const phoneName = contentId.replace(/^indexus-automation-/, "");
    const phoneArtwork = contentId.startsWith("indexus-automation-") && automationPhoneArtworkFor(phoneName);
    if (phoneArtwork) {
      attachments.push({ "@odata.type": "#microsoft.graph.fileAttachment",
        name: `automation-${phoneName}.gif`, contentType: "image/gif", isInline: true,
        contentId, contentBytes: phoneArtwork.toString("base64") });
      continue;
    }
    const match = /^indexus-automation-(task|attention|success|deadline)$/.exec(contentId);
    if (!match) throw new Error("Email references an unavailable inline illustration");
    const bytes = await readFile(resolve(process.cwd(), "server/assets/automation-email", `automation-${match[1]}.gif`));
    attachments.push({ "@odata.type": "#microsoft.graph.fileAttachment",
      name: `automation-${match[1]}.gif`, contentType: "image/gif", isInline: true,
      contentId, contentBytes: bytes.toString("base64") });
  }
  return attachments;
}
