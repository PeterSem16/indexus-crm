import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

export const ANALYSIS_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;

/** Only references on an already-authorized persisted source are accepted. Never fetch URLs. */
export function privateAnalysisAttachmentIds(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 10) throw new Error("analysis_attachment_limit");
  const ids = value.map(item => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" ||
        !item.id.trim() || item.id.length > 200) throw new Error("analysis_attachment_unavailable");
    return item.id as string;
  });
  if (new Set(ids).size !== ids.length) throw new Error("analysis_attachment_unavailable");
  return ids;
}

/** Metadata comes from the private upload registry, never the attachment's URL/name/size claims. */
export async function readPrivateAnalysisAttachment(
  root: string, storageKey: string, expectedSize: number,
): Promise<Buffer> {
  if (!storageKey || basename(storageKey) !== storageKey || storageKey === "." || storageKey === "..")
    throw new Error("analysis_attachment_unavailable");
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 0 || expectedSize > ANALYSIS_ATTACHMENT_MAX_BYTES)
    throw new Error("analysis_attachment_limit");
  const directory = await realpath(root);
  const target = resolve(directory, storageKey);
  if (dirname(target) !== directory || await realpath(target) !== target)
    throw new Error("analysis_attachment_unavailable");
  const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size !== expectedSize || stat.size > ANALYSIS_ATTACHMENT_MAX_BYTES)
      throw new Error("analysis_attachment_unavailable");
    const chunks: Buffer[] = [];
    let size = 0;
    while (size <= ANALYSIS_ATTACHMENT_MAX_BYTES) {
      const buffer = Buffer.alloc(Math.min(64 * 1024, ANALYSIS_ATTACHMENT_MAX_BYTES + 1 - size));
      const { bytesRead } = await file.read(buffer, 0, buffer.length, size);
      if (!bytesRead) break;
      chunks.push(buffer.subarray(0, bytesRead));
      size += bytesRead;
    }
    if (size !== expectedSize || size > ANALYSIS_ATTACHMENT_MAX_BYTES)
      throw new Error("analysis_attachment_limit");
    return Buffer.concat(chunks, size);
  } finally { await file.close(); }
}
