import { realpath, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { emailAttachmentIssues, EMAIL_ATTACHMENT_MAX_BYTES, EMAIL_ATTACHMENT_MAX_FILES, EMAIL_ATTACHMENT_TOTAL_BYTES } from "../../shared/automation-email-action";

/** Load the template's own files, never a path supplied by the automation draft.
 * Return all bytes or fail: an inaccessible attachment must not become a partial email. */
export async function templateAttachmentSnapshot(template: any, viewer: any, root = path.resolve("uploads/template-attachments")) {
  const countries = Array.isArray(template.countryCodes) ? template.countryCodes : [];
  const privileged = ["admin", "superadmin", "owner"].includes(viewer?.role);
  if (!template.isActive || (!privileged && countries.length &&
      !countries.some((country: string) => viewer?.assignedCountries?.includes(country))))
    throw new Error("Template attachments are not available");
  const files = template.attachments ?? [];
  if (!Array.isArray(files) || files.length > EMAIL_ATTACHMENT_MAX_FILES)
    throw new Error("Email accepts at most five attachments");
  if (!files.length) return [];
  const allowed = await realpath(root);
  const copied: Array<{ fileName: string; mimeType: string; size: number; contentBase64: string }> = [];
  let total = 0;
  for (const file of files) {
    if (typeof file?.filePath !== "string" || !file.filePath ||
        typeof file.fileName !== "string" || !file.fileName.trim())
      throw new Error("Template attachment is unavailable");
    const filename = await realpath(path.resolve(process.cwd(), file.filePath.replace(/^\/+/, "")));
    if (!filename.startsWith(allowed + path.sep)) throw new Error("Template attachment is unavailable");
    const info = await stat(filename);
    total += info.size;
    if (!info.isFile() || !info.size || info.size > EMAIL_ATTACHMENT_MAX_BYTES || total > EMAIL_ATTACHMENT_TOTAL_BYTES)
      throw new Error("Email attachments exceed the permitted size");
    const bytes = await readFile(filename);
    if (bytes.length !== info.size) throw new Error("Template attachment changed while loading");
    copied.push({ fileName: file.fileName, mimeType: file.mimeType || "application/octet-stream",
      size: bytes.length, contentBase64: bytes.toString("base64") });
  }
  const issues = emailAttachmentIssues(copied.map(file => ({
    name: file.fileName, contentType: file.mimeType, contentBase64: file.contentBase64,
  })));
  if (issues.length) throw new Error(issues[0]);
  return copied;
}
