/**
 * Campaign-contact callback rows accepted by the scheduled queue.
 *
 * `pending` is retained for backwards compatibility with rows written by
 * older clients that saved callbackDate without first setting the canonical
 * callback_scheduled status. Terminal/contacted statuses are intentionally
 * not included: a stale callbackDate must not reopen a finished contact.
 */
export const SCHEDULED_CALLBACK_STATUSES = ["callback_scheduled", "pending"] as const;

export type ScheduledCallbackStatus = typeof SCHEDULED_CALLBACK_STATUSES[number];

function hasCallbackDate(value: unknown): boolean {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value !== "string" && typeof value !== "number") return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time);
}

export function isEligibleScheduledCampaignCallback(
  status: unknown,
  callbackDate: unknown,
): boolean {
  return hasCallbackDate(callbackDate)
    && typeof status === "string"
    && (SCHEDULED_CALLBACK_STATUSES as readonly string[]).includes(status);
}

/**
 * Normalize only a callback-date write from the legacy pending shape.
 * Explicit terminal/contacted statuses are preserved, and a callback-note-only
 * update (no callback date) cannot change status.
 */
export function normalizeLegacyScheduledCallbackStatus(
  status: unknown,
  callbackDate: unknown,
  existingStatus?: unknown,
): unknown {
  if (!hasCallbackDate(callbackDate)) return status;
  // A terminal/contacted row may retain an old callbackDate. Do not reopen it
  // unless the caller explicitly supplies the canonical callback status.
  if (
    existingStatus !== undefined
    && typeof existingStatus === "string"
    && !(SCHEDULED_CALLBACK_STATUSES as readonly string[]).includes(existingStatus)
    && status !== "callback_scheduled"
  ) {
    return status === undefined ? undefined : existingStatus;
  }
  return !status || status === "pending" ? "callback_scheduled" : status;
}

export function buildScheduledCallbackPatch(
  callbackDate: string | null,
  callbackNote: string | null,
): {
  status: "callback_scheduled";
  callbackDate: string | null;
  callbackNote: string | null;
} {
  return {
    status: "callback_scheduled",
    callbackDate,
    callbackNote,
  };
}