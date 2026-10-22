import { z } from "zod";
import { isStatusListHistoryField, statusListHistoryMatches, type StatusListHistoryFacts } from "./status-list-history";

export const automaticTriggerSchema = z.enum(["agent_confirmation", "card_open", "background_change"]);
export type AutomaticTrigger = z.infer<typeof automaticTriggerSchema>;
export const automaticConfigSchema = z.object({
  trigger: automaticTriggerSchema,
  enabled: z.boolean(),
  expectedRevision: z.string().nullable(),
  acknowledged: z.literal(true),
}).strict();
export type AutomaticStatus = "ready" | "disabled" | "unsupported_action" | "invalid_condition" |
  "missing_answer" | "condition_false" | "already_executed" | "background_baseline" |
  "batch_deferred" | "pending" | "indeterminate" | "succeeded" | "failed" | "superseded" | "waiting_transition";

/** Same strict evaluator for preview, admission and the worker. No unknown-field fallback. */
export function automaticCondition(action: {
  conditionField?: string | null; conditionValue?: string | null; conditionOperator?: string | null; conditionJson?: unknown;
}, facts: StatusListHistoryFacts | null, country: string | null, answer: unknown): { value: boolean | null; issue?: AutomaticStatus } {
  const boolean = (value: unknown) => ["yes", "true", "1"].includes(String(value).toLowerCase()) ? "true" :
    ["no", "false", "0"].includes(String(value).toLowerCase()) ? "false" : String(value ?? "");
  const match = (field: string, op: string, expected: unknown): boolean | null => {
    if (!["eq", "neq", "equals", "not_equals"].includes(op)) return null;
    const negative = op === "neq" || op === "not_equals";
    if (isStatusListHistoryField(field)) {
      if (!["true","false"].includes(String(expected))) return null;
      if (!facts) return null;
      return statusListHistoryMatches(facts, field, negative ? "neq" : "eq", String(expected));
    }
    const actual = field === "contact_country" || field === "country" ? country : field === "answer" ? answer : undefined;
    if (actual == null) return null;
    const equal = boolean(actual) === boolean(expected);
    return negative ? !equal : equal;
  };
  if (action.conditionJson) {
    let group: any;
    try { group = typeof action.conditionJson === "string" ? JSON.parse(action.conditionJson) : action.conditionJson; }
    catch { return { value: null, issue: "invalid_condition" }; }
    if (!group || !["AND","OR"].includes(group.logic) || !Array.isArray(group.rules) || !group.rules.length)
      return { value: null, issue: "invalid_condition" };
    const values = group.rules.map((rule: any) => rule && typeof rule.field === "string" ? match(rule.field, rule.op, rule.value) : null);
    // Unknown fails the entire definition, including OR; never turn invalid into ELSE.
    if (values.includes(null)) return { value: null, issue: "invalid_condition" };
    return { value: group.logic === "AND" ? values.every(Boolean) : values.some(Boolean) };
  }
  if (!action.conditionField || action.conditionField === "always") return { value: true };
  if (action.conditionField === "answer" && answer == null) return { value: null, issue: "missing_answer" };
  const value = match(action.conditionField, action.conditionOperator || "eq", action.conditionValue);
  return value === null ? { value, issue: "invalid_condition" } : { value };
}

/** Card-open effects are once per action/contact, not once per tab mount/config save. */
export function automaticAdmission(input: {
  trigger: AutomaticTrigger; enabled: boolean; supported: boolean; condition: boolean | null;
  issue?: AutomaticStatus; previous?: boolean; priorStatus?: AutomaticStatus; batch: boolean;
}): AutomaticStatus {
  if (!input.enabled || input.trigger === "agent_confirmation") return "disabled";
  if (!input.supported) return "unsupported_action";
  if (input.issue) return input.issue;
  if (input.condition !== true) return "condition_false";
  if (input.priorStatus) return input.priorStatus === "succeeded" ? "already_executed" : input.priorStatus;
  if (input.trigger === "background_change") {
    if (input.previous === undefined) return "background_baseline";
    if (input.previous) return "waiting_transition";
  }
  return input.batch ? "batch_deferred" : "ready";
}
