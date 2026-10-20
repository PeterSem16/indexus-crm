import { statusListCallbackParts } from "../../shared/status-list-callback-calendar";
import { isEligibleScheduledCampaignCallback } from "../../shared/scheduled-callback";
import { transitionConditionPasses, type TransitionAction } from "../../shared/status-list-transition";

/** Persisted, event-time input. Never evaluate a retry against today's contact
 * state, call count, timezone, rule, or acting user. */
export type CallbackEnvelope = {
  action: TransitionAction;
  callCount: number | null;
  now: string;
  manualDate: string | null;
  note: string | null;
  dispositionCode: string | null;
};

export function callbackInstant(action: TransitionAction, now: string): string {
  if (!action.callback) throw new Error("callback_config_unsupported");
  const p = statusListCallbackParts(action.callback.days, action.callback.time, action.callback.weekdaysOnly, new Date(now));
  const wall = Date.UTC(p.year, p.month0, p.day, p.hour, p.minute);
  const offset = (at: number) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bratislava", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(at));
    const n = (key: string) => Number(parts.find(p => p.type === key)?.value);
    return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - at;
  };
  const first = wall - offset(wall);
  return new Date(wall - offset(first)).toISOString();
}

export function callbackDecision(payload: CallbackEnvelope, existing: { status: string; callback_date: string | Date | null }) {
  const { action } = payload;
  if (!action.callback || action.issues.length || action.excluded) throw new Error("callback_config_unsupported");
  const condition = action.condition.kind === "call_count" && payload.callCount === null
    ? false : transitionConditionPasses(action.condition, payload.callCount ?? 0);
  if (condition === null) throw new Error("callback_config_unsupported");
  if (!condition) return { status: "condition_false" as const };
  if (action.callback.existing === "keep_existing" &&
    isEligibleScheduledCampaignCallback(existing.status, existing.callback_date))
    return { status: "kept_existing" as const, callbackDate: new Date(existing.callback_date!).toISOString() };
  const callbackDate = payload.manualDate || callbackInstant(action, payload.now);
  if (!Number.isFinite(new Date(callbackDate).getTime())) throw new Error("invalid_callback_date");
  return { status: "callback" as const, callbackDate };
}
