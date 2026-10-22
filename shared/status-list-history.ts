/** Mission/contact-scoped facts, not triggers or inferred deliverability. */
export const statusListHistoryFields = [
  "history.outreach_attempted", "history.call_attempted", "history.call_answered",
  "history.call_failed", "history.email_sent", "history.sms_sent",
  "history.email_reply", "history.sms_reply", "history.message_delivered", "history.reached",
] as const;
export type StatusListHistoryField = typeof statusListHistoryFields[number];
export type StatusListHistoryFacts = Record<StatusListHistoryField, boolean>;
export const isStatusListHistoryField = (field: string): field is StatusListHistoryField =>
  (statusListHistoryFields as readonly string[]).includes(field);

/** Unknown context must fail closed even for a negative comparison. */
export function statusListHistoryMatches(facts: StatusListHistoryFacts | null, field: string, op: string, value: unknown) {
  if (!facts || !isStatusListHistoryField(field) || !["eq", "neq", "equals", "not_equals"].includes(op)) return false;
  if (![true, false, "true", "false"].includes(value as any)) return false;
  const matches = facts[field] === (value === true || value === "true");
  return op === "neq" || op === "not_equals" ? !matches : matches;
}
