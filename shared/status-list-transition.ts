import { statusListCallbackParts } from "./status-list-callback-calendar";
import { isEligibleScheduledCampaignCallback } from "./scheduled-callback";

/** Planning data only. These types cannot be submitted to the workflow executor. */
export type TransitionIssue =
  | "condition_unsupported" | "reference_missing" | "calendar_unsupported"
  | "action_unsupported" | "legacy_notification_unhandled"
  | "excluded_by_owner" | "exclusion_changed";
export type TransitionCondition =
  | { kind: "always" }
  | { kind: "call_count"; logic: "AND" | "OR"; rules: { op: "lt" | "gt" | "eq" | "neq" | "gte" | "lte"; value: number }[] }
  | { kind: "unsupported" };
export type TransitionAction = {
  id: string; itemId: string; stepCode: string; type: string; fingerprint: string;
  condition: TransitionCondition;
  dispositionId: string | null;
  callback: { days: number; time: string | null; weekdaysOnly: boolean; existing: "replace" | "keep_existing" } | null;
  issues: TransitionIssue[];
  excluded: boolean;
};
export type TransitionInventory = {
  campaignId: string;
  source: "current_configuration" | "audited_production";
  capturedAt: string;
  fingerprint: string;
  actions: TransitionAction[];
  /** Snapshot evidence, never a live production connection. */
  evidence: {
    productionLiveVerified: false;
    sourceCommit: string | null;
    schemaAvailable: boolean;
    itemCount: number;
    questionCount: number;
  };
  activationAllowed: false;
};
export type TransitionInventories = { current: TransitionInventory; audited: TransitionInventory | null };
export type CallbackServiceStatus = {
  runtimeVersion: string;
  activationAllowed: false;
  group: { enrolled: boolean; owner: "legacy" | "service"; generation: number; fingerprint: string } | null;
  counts: { pending: number; blocked: number; done: number; deferred: number };
  cutovers: { id: string; fromOwner: string; toOwner: string; generation: number; actorId: string; createdAt: string; eventBoundary: string }[];
};
export type TransitionScenario = {
  callCount: number;
  /** This is one hypothetical item-confirmation event, not a campaign-wide firing. */
  itemId: string;
  now: string;
  manualDate?: string;
  existingDate?: string;
  existingStatus?: string;
};
export type TransitionEffect = {
  status: "condition_false" | "not_triggered" | "excluded" | "unverified" | "callback";
  callbackDate?: string;
  policy?: "replace" | "keep_existing";
  dispositionId?: string | null;
  assignsActingAgent?: boolean;
  keptExisting?: boolean;
};
export type TransitionComparison = {
  id: string;
  legacy: TransitionEffect;
  proposed: TransitionEffect;
  comparison: "model_match" | "not_comparable" | "excluded";
  /** A model match is not executable-engine parity. */
  runtimeVerified: false;
  activationAllowed: false;
};
export const TRANSITION_GATES = [
  "executor_unverified", "ownership_unverified", "inflight_unverified",
  "dependencies_unverified", "live_fingerprint_unverified",
] as const;

export function parseTransitionCondition(row: Record<string, unknown>): TransitionCondition {
  if (row.condition_json !== null && row.condition_json !== undefined && row.condition_json !== "") {
    try {
      if (typeof row.condition_json !== "string") return { kind: "unsupported" };
      const value = JSON.parse(row.condition_json);
      if (!value || !["AND", "OR"].includes(value.logic) || !Array.isArray(value.rules) ||
          value.rules.length === 0 || value.rules.length > 20 ||
          Object.keys(value).some(key => !["logic", "rules"].includes(key))) return { kind: "unsupported" };
      const rules = [];
      for (const rule of value.rules) {
        if (!rule || rule.field !== "call_count" ||
            Object.keys(rule).some(key => !["field", "op", "value"].includes(key)) ||
            !["lt", "gt", "eq", "neq", "gte", "lte"].includes(rule.op) ||
            typeof rule.value !== "string" || !/^\d{1,9}$/.test(rule.value)) return { kind: "unsupported" };
        rules.push({ op: rule.op, value: Number(rule.value) });
      }
      return { kind: "call_count", logic: value.logic, rules };
    } catch { return { kind: "unsupported" }; }
  }
  // Never turn an unknown or incomplete condition into "always".
  if (row.condition_field === null || row.condition_field === undefined ||
      row.condition_field === "" || row.condition_field === "always") {
    if (row.condition_operator || row.condition_value) return { kind: "unsupported" };
    return { kind: "always" };
  }
  return { kind: "unsupported" };
}

export function transitionConditionPasses(condition: TransitionCondition, callCount: number): boolean | null {
  if (condition.kind === "unsupported") return null;
  if (condition.kind === "always") return true;
  const results = condition.rules.map(rule => {
    switch (rule.op) {
      case "lt": return callCount < rule.value;
      case "gt": return callCount > rule.value;
      case "eq": return callCount === rule.value;
      case "neq": return callCount !== rule.value;
      case "gte": return callCount >= rule.value;
      case "lte": return callCount <= rule.value;
    }
  });
  return condition.logic === "AND" ? results.every(Boolean) : results.some(Boolean);
}

function validInstant(value: string): boolean {
  // Require an explicit offset; a browser/server-local datetime is not an instant.
  return /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    Number.isFinite(new Date(value).getTime());
}

type Parts = { year: number; month0: number; day: number; hour: number; minute: number };
function instant(parts: Parts): string {
  const wall = Date.UTC(parts.year, parts.month0, parts.day, parts.hour, parts.minute);
  const offset = (timestamp: number) => {
    const values = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Bratislava", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(timestamp));
    const get = (key: string) => Number(values.find(value => value.type === key)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - timestamp;
  };
  const first = wall - offset(wall);
  return new Date(wall - offset(first)).toISOString();
}

/** Independent reproduction of the inspected production callback calendar.
 * No DB, dispatch, call-log reads, timers or workflow imports.
 */
function legacyDate(action: TransitionAction, now: string): string {
  const callback = action.callback!;
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(now));
  const get = (key: string) => Number(values.find(value => value.type === key)?.value);
  const cursor = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  let added = 0;
  while (added < Math.max(1, callback.days)) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!callback.weekdaysOnly || (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6)) added++;
  }
  let hour = 9, minute = 0;
  if (callback.time && /^\d{1,2}:\d{2}$/.test(callback.time)) {
    const [h, m] = callback.time.split(":").map(Number);
    if (h < 24 && m < 60) { hour = h; minute = m; }
  }
  return instant({ year: cursor.getUTCFullYear(), month0: cursor.getUTCMonth(), day: cursor.getUTCDate(), hour, minute });
}

function validateScenario(scenario: TransitionScenario) {
  if (!Number.isSafeInteger(scenario.callCount) || scenario.callCount < 0 || scenario.callCount > 999999999 ||
      !scenario.itemId || !validInstant(scenario.now) ||
      (scenario.manualDate !== undefined && !validInstant(scenario.manualDate)) ||
      (scenario.existingDate !== undefined && !validInstant(scenario.existingDate)))
    throw new RangeError("Invalid hypothetical scenario");
}

function effect(action: TransitionAction, scenario: TransitionScenario, model: "legacy" | "proposed"): TransitionEffect {
  if (action.excluded) return { status: "excluded" };
  if (action.itemId !== scenario.itemId) return { status: "not_triggered" };
  if (action.issues.length || !action.callback) return { status: "unverified" };
  const passed = transitionConditionPasses(action.condition, scenario.callCount);
  if (passed === null) return { status: "unverified" };
  if (!passed) return { status: "condition_false" };
  const keep = action.callback.existing === "keep_existing" && isEligibleScheduledCampaignCallback(
    scenario.existingStatus ?? "callback_scheduled", scenario.existingDate,
  );
  const date = keep ? scenario.existingDate! : scenario.manualDate ||
    (model === "legacy" ? legacyDate(action, scenario.now) : instant(statusListCallbackParts(
      action.callback.days, action.callback.time, action.callback.weekdaysOnly, new Date(scenario.now),
    )));
  return {
    status: "callback", callbackDate: new Date(date).toISOString(),
    policy: action.callback.existing, dispositionId: action.dispositionId,
    assignsActingAgent: !keep, keptExisting: keep,
  };
}

export function compareTransitionModels(inventory: TransitionInventory, scenario: TransitionScenario): TransitionComparison[] {
  validateScenario(scenario);
  if (!inventory.actions.some(action => action.itemId === scenario.itemId)) throw new RangeError("Unknown hypothetical source");
  return inventory.actions.map(action => {
    const legacy = effect(action, scenario, "legacy");
    const proposed = effect(action, scenario, "proposed");
    return {
      id: action.id, legacy, proposed,
      comparison: action.excluded ? "excluded" :
        legacy.status === "unverified" || proposed.status === "unverified" ||
        JSON.stringify(legacy) !== JSON.stringify(proposed) ? "not_comparable" : "model_match",
      runtimeVerified: false, activationAllowed: false,
    };
  });
}

/** Each row is a separate item-confirmation event. Never a bulk firing. */
export function transitionBoundaryMatrix(inventory: TransitionInventory) {
  return inventory.actions.map(action => ({
    id: action.id,
    cases: [0, 1, 2].map(callCount => ({
      callCount,
      result: compareTransitionModels(inventory, {
        itemId: action.itemId, callCount, now: "2026-10-23T12:00:00Z",
      }).find(result => result.id === action.id)!,
    })),
  }));
}
