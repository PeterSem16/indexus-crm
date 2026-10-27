import { attachmentFailureReason, type AttachmentOutcome } from "../../shared/automation-attachment-outcomes";

/** Each source is attempted once; one failed document must not hide the rest. */
export async function analyzeAttachmentBatch<Source, Result extends { classification: "invoice" | "other" }>(
  sources: Source[], analyze: (source: Source) => Promise<Result>,
) {
  const attachments: Result[] = [];
  const attachmentOutcomes: AttachmentOutcome[] = [];
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    try {
      const result = await analyze(source);
      attachments.push(result);
      attachmentOutcomes.push({ position: index + 1, result: result.classification });
    } catch (error) {
      attachmentOutcomes.push({ position: index + 1, result: "unprocessed", reason: attachmentFailureReason(error) });
    }
  }
  const invoiceCount = attachments.filter(attachment => attachment.classification === "invoice").length;
  const failedAttachmentCount = sources.length - attachments.length;
  return { attachments, attachmentOutcomes, invoiceCount, failedAttachmentCount, attachmentCount: sources.length,
    hasInvoice: invoiceCount ? true : failedAttachmentCount ? null : false };
}
