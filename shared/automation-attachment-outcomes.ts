export const attachmentFailureReasons = ["missing", "unsupported", "encrypted", "unavailable", "unreadable", "limit", "unknown"] as const;
export type AttachmentFailureReason = typeof attachmentFailureReasons[number];
export type AttachmentOutcome =
  | { position: number; result: "invoice" | "other" }
  | { position: number; result: "unprocessed"; reason: AttachmentFailureReason };

/** Only allowlisted codes cross the activity boundary, never exception text or filenames. */
export function attachmentFailureReason(error: unknown): AttachmentFailureReason {
  const code = error instanceof Error ? error.message : "";
  if (code === "analysis_attachment_missing" || (error as any)?.code === "ENOENT") return "missing";
  if (code === "analysis_unsupported_attachment") return "unsupported";
  if (code === "analysis_document_encrypted") return "encrypted";
  if (["analysis_attachment_limit", "analysis_document_text_limit", "analysis_document_cell_limit",
    "analysis_document_expansion_limit"].includes(code)) return "limit";
  if (code === "analysis_document_unreadable") return "unreadable";
  return "unavailable";
}

/** Project persisted results explicitly; older runs only have a failed total. */
export function attachmentOutcomesForActivity(analysis: any): AttachmentOutcome[] {
  if (!analysis || typeof analysis !== "object") return [];
  if (Array.isArray(analysis.attachmentOutcomes)) {
    return analysis.attachmentOutcomes.slice(0, 10).map((entry: any, index: number) => {
      const position = index + 1;
      if (entry?.result === "invoice" || entry?.result === "other") return { position, result: entry.result };
      return { position, result: "unprocessed", reason: attachmentFailureReasons.includes(entry?.reason) ? entry.reason : "unknown" };
    });
  }
  const successes: AttachmentOutcome[] = (Array.isArray(analysis.attachments) ? analysis.attachments : [])
    .slice(0, 10).map((entry: any, index: number) => ({
      position: index + 1, result: entry?.classification === "invoice" ? "invoice" : "other",
    }));
  const failures = Number.isInteger(analysis.failedAttachmentCount) ? Math.max(0, Math.min(10 - successes.length, analysis.failedAttachmentCount)) : 0;
  for (let i = 0; i < failures; i++) successes.push({ position: successes.length + 1, result: "unprocessed", reason: "unknown" });
  return successes;
}
