export const CONTENT_SIGNAL_KEYS = ["mentionsInvoice", "hasComplaint", "needsReply", "isUrgent", "isThankYou", "requestsCallback"] as const;
export function validatedContentSignals(result: Record<string, unknown>) {
  return Object.fromEntries(CONTENT_SIGNAL_KEYS.map(key => [key, typeof result[key] === "boolean" ? result[key] : null]));
}
