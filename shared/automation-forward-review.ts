export type ForwardInvoiceReview = {
  attachmentId: string;
  name: string;
  approvedAt: string | null;
  approvedBy: string | null;
};
export type ForwardReview = {
  version: 1;
  matchSender: boolean;
  matchStatus: "disabled" | "none" | "unique" | "ambiguous";
  candidateIds: string[];
  invoices: ForwardInvoiceReview[];
};

/** Truncated or multiple results are never authoritative links. */
export function forwardSenderDecision(enabled: boolean, ids: string[], truncated = false) {
  const candidates = Array.from(new Set(ids));
  return {
    customerId: enabled && !truncated && candidates.length === 1 ? candidates[0] : null,
    matchStatus: (!enabled ? "disabled" : truncated || candidates.length > 1 ? "ambiguous"
      : candidates.length === 1 ? "unique" : "none") as ForwardReview["matchStatus"],
    candidateIds: enabled ? candidates : [],
  };
}

/** Approval marks a particular forwarded document, not the task or an accounting invoice. */
export function approveForwardInvoice(review: ForwardReview, attachmentId: string, actorId: string, at: string): ForwardReview {
  if (!review.invoices.some(invoice => invoice.attachmentId === attachmentId))
    throw new Error("forward_review_invoice_missing");
  return { ...review, invoices: review.invoices.map(invoice => invoice.attachmentId === attachmentId && !invoice.approvedAt
    ? { ...invoice, approvedAt: at, approvedBy: actorId } : invoice) };
}
