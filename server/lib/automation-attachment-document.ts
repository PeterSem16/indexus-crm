import { createRequire } from "node:module";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { officeWorkerSource } from "./automation-office-worker";

export const attachmentExtensions: Record<string, string> = {
  "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
  "text/plain": ".txt", "text/csv": ".csv",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};
const officeMimes: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export type PreparedAttachment = { bytes: Buffer; mime: string; text?: string };
const requireFromApp = createRequire(join(process.cwd(), "package.json"));

function extractOffice(bytes: Buffer, expected?: string): Promise<{ kind: string; text: string }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(officeWorkerSource, {
      eval: true,
      workerData: { bytes, expected, xlsxPath: requireFromApp.resolve("xlsx"),
        mammothPath: requireFromApp.resolve("mammoth"), zipPath: requireFromApp.resolve("adm-zip") },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (error?: Error, result?: { kind: string; text: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      void worker.terminate();
      if (error) reject(error); else resolve(result!);
    };
    const timeout = setTimeout(() => finish(new Error("analysis_document_timeout")), 15000);
    worker.once("message", result => result.error ? finish(new Error(result.error)) : finish(undefined, result));
    worker.once("error", () => finish(new Error("analysis_document_unreadable")));
    worker.once("exit", () => { if (!settled) finish(new Error("analysis_document_unreadable")); });
  });
}

// MIME aliases and arbitrary extensions never override the actual binary format.
// In particular, .img is only accepted when it really contains PNG/JPEG/WebP.
export async function prepareAnalysisAttachment(
  bytes: Buffer, contentType: string | undefined, name: string,
): Promise<PreparedAttachment> {
  if (!bytes.length || bytes.length > 15 * 1024 * 1024) throw new Error("analysis_attachment_limit");
  let mime = (contentType || "").split(";")[0].trim().toLowerCase();
  if (["image/jpg", "image/pjpeg", "image/jpge"].includes(mime)) mime = "image/jpeg";
  const generic = !mime || ["application/octet-stream", "binary/octet-stream", "application/zip", "image/img"].includes(mime);
  const extension = name.toLowerCase().split(".").pop();
  let imageMime: string | undefined;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) imageMime = "image/jpeg";
  else if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) imageMime = "image/png";
  else if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") imageMime = "image/webp";
  if (imageMime && (generic || mime === imageMime))
    return { bytes, mime: imageMime };
  if (mime.startsWith("image/") || ["jpg", "jpeg", "jpge", "png", "webp", "img"].includes(extension || ""))
    throw new Error("analysis_document_unreadable");
  const officeKind = Object.keys(officeMimes).find(kind => officeMimes[kind] === mime);
  const officeExtension = Object.hasOwn(officeMimes, extension || "") ? extension : undefined;
  if (officeKind || (generic && officeExtension)) {
    const result = await extractOffice(bytes, officeKind || officeExtension);
    return { bytes, mime: officeMimes[result.kind], text: result.text };
  }
  if ((mime === "application/pdf" || (generic && extension === "pdf")) &&
      bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    // PDF encryption dictionaries are ASCII, even for encrypted streams.
    if (/\/Encrypt\b/.test(bytes.toString("latin1"))) throw new Error("analysis_document_encrypted");
    return { bytes, mime: "application/pdf" };
  }
  if (mime === "text/plain" || mime === "text/csv") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.trim() || text.includes("\0")) throw new Error("analysis_document_unreadable");
    if (text.length > 60000) throw new Error("analysis_document_text_limit");
    return { bytes, mime, text };
  }
  throw new Error("analysis_unsupported_attachment");
}
