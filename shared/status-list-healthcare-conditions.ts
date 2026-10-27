import { healthcareStates, type HealthcareState } from "./status-list-healthcare";

export const healthcareConditionFields = ["healthcare.state", "healthcare.failed_attempts"] as const;
export type HealthcareConditionField = typeof healthcareConditionFields[number];
export type HealthcareConditionFacts = { state: HealthcareState; failedAttempts: number };
export const isHealthcareConditionField = (field: string): field is HealthcareConditionField =>
  (healthcareConditionFields as readonly string[]).includes(field);
export function validHealthcareCondition(field: string, op: string, value: unknown) {
  const equality = ["eq", "neq", "equals", "not_equals"].includes(op);
  if (field === "healthcare.state") return equality && healthcareStates.includes(value as HealthcareState);
  return field === "healthcare.failed_attempts" && (equality || ["gt", "gte", "lt", "lte"].includes(op)) &&
    typeof value === "string" && /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
}

/** Both rule editors read the same Mission-owned evaluation, never call counts
 * recomputed from a phone number or mutable contact status. Unknown fails closed. */
export function healthcareConditionMatches(facts: HealthcareConditionFacts | null, field: string, op: string, value: unknown) {
  if (!facts || !healthcareStates.includes(facts.state) || !validHealthcareCondition(field, op, value)) return false;
  const equal = op === "eq" || op === "equals", unequal = op === "neq" || op === "not_equals";
  if (field === "healthcare.state") {
    if (!(equal || unequal) || !healthcareStates.includes(value as HealthcareState)) return false;
    return equal ? facts.state === value : facts.state !== value;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) return false;
  const count = Number(value), actual = facts.failedAttempts;
  if (!Number.isSafeInteger(actual) || actual < 0) return false;
  if (equal) return actual === count;
  if (unequal) return actual !== count;
  switch (op) {
    case "gt": return actual > count;
    case "gte": return actual >= count;
    case "lt": return actual < count;
    case "lte": return actual <= count;
    default: return false;
  }
}
