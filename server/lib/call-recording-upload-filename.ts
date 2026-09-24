import { randomUUID } from "node:crypto";

/**
 * Multer writes directly to this path before multipart fields are available.
 * Keep it independent of all submitted metadata and unique for concurrent
 * uploads; the authoritative, human-readable name is assigned after validation.
 */
export function createCallRecordingUploadFilename(
  mimeType: string,
  nextId: () => string = randomUUID,
): string {
  const extension = mimeType === "audio/ogg" ? "ogg" : "webm";
  return `upload_${nextId()}.${extension}`;
}

export function createCallRecordingUploadCleanup(removeFile: (filePath: string) => void) {
  const paths = new Set<string>();
  let persisted = false;

  return {
    track(filePath: string) {
      paths.add(filePath);
    },
    markPersisted() {
      persisted = true;
      paths.clear();
    },
    cleanup() {
      if (persisted) return;
      paths.forEach(filePath => {
        try { removeFile(filePath); } catch {}
      });
      paths.clear();
    },
  };
}