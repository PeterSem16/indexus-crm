import assert from "node:assert/strict";
import {
  compareTransitionModels, parseTransitionCondition, TRANSITION_GATES,
  transitionBoundaryMatrix, transitionConditionPasses, type TransitionScenario,
} from "./status-list-transition";
import { medicalPartnerAudit, MEDICAL_PARTNER_AUDIT_CAMPAIGN } from "./status-list-transition-audit";

const audit = medicalPartnerAudit(MEDICAL_PARTNER_AUDIT_CAMPAIGN)!;
assert.equal(medicalPartnerAudit("another-campaign"), null);
assert.equal(audit.actions.length, 10);
assert.equal(audit.actions.filter(action => !action.excluded).length, 9);
assert.equal(audit.actions.filter(action => action.callback).length, 8);
assert.equal(audit.actions.find(action => action.excluded)?.type, "send_email_group");
assert.equal(audit.actions.find(action => action.stepCode === "MPN-05c" && action.callback)?.excluded, false);
assert.equal(audit.activationAllowed, false);
assert.equal(audit.evidence.productionLiveVerified, false);
assert.equal(TRANSITION_GATES.length, 5);

const first = audit.actions.find(action => action.stepCode === "MPN-01a")!;
const second = audit.actions.find(action => action.stepCode === "MPN-01b")!;
const notify = audit.actions.find(action => action.stepCode === "MPN-02b")!;
const callback = audit.actions.find(action => action.stepCode === "MPN-05b")!;
const scenario: TransitionScenario = { itemId: first.itemId, callCount: 0, now: "2026-10-23T12:00:00Z" };
const run = (action = first, changes: Partial<TransitionScenario> = {}) =>
  compareTransitionModels(audit, { ...scenario, itemId: action.itemId, ...changes }).find(value => value.id === action.id)!;
assert.equal(run().legacy.callbackDate, "2026-10-26T08:00:00.000Z"); // DST weekend, 09:00 Bratislava.
assert.equal(run().proposed.callbackDate, "2026-10-26T08:00:00.000Z");
assert.equal(run().comparison, "model_match");
assert.equal(run().runtimeVerified, false);
assert.equal(run().activationAllowed, false);
assert.equal(run(first, { callCount: 1 }).legacy.status, "condition_false");
assert.equal(run(second, { callCount: 1 }).legacy.status, "condition_false");
assert.equal(run(second, { callCount: 2 }).legacy.status, "callback");
assert.equal(run(notify, { callCount: 2 }).comparison, "not_comparable");
assert.equal(run(callback).legacy.callbackDate, "2026-10-28T08:00:00.000Z");
assert.equal(run(first, { now: "2027-03-26T12:00:00Z" }).legacy.callbackDate, "2027-03-29T07:00:00.000Z");
assert.equal(run(first, { now: "2026-10-24T12:00:00Z" }).legacy.callbackDate, "2026-10-26T08:00:00.000Z");
assert.equal(run(first, { now: "2026-10-25T23:30:00Z" }).legacy.callbackDate, "2026-10-27T08:00:00.000Z");
assert.equal(run(first, { manualDate: "2026-11-02T10:30:00+01:00" }).legacy.callbackDate, "2026-11-02T09:30:00.000Z");
assert.equal(run(first, { existingDate: "2026-10-21T07:00:00Z" }).legacy.keptExisting, false);
assert.equal(run(first, { existingDate: "2026-10-21T07:00:00Z" }).legacy.assignsActingAgent, true);
const other = compareTransitionModels(audit, scenario).find(result => result.id === second.id)!;
assert.equal(other.legacy.status, "not_triggered");
const excluded = compareTransitionModels(audit, { ...scenario, itemId: callback.itemId }).find(result =>
  result.id === audit.actions.find(action => action.excluded)!.id)!;
assert.equal(excluded.comparison, "excluded");

const before = JSON.stringify(audit);
const matrix = transitionBoundaryMatrix(audit);
assert.equal(matrix.length, 10);
assert.deepEqual(matrix.find(row => row.id === first.id)!.cases.map(row => row.result.legacy.status),
  ["callback", "condition_false", "condition_false"]);
assert.deepEqual(matrix.find(row => row.id === second.id)!.cases.map(row => row.result.legacy.status),
  ["condition_false", "condition_false", "callback"]);
assert.equal(JSON.stringify(audit), before);
for (const changes of [
  { callCount: -1 }, { callCount: 1.5 }, { callCount: NaN }, { callCount: Infinity },
  { now: "2026-10-20T09:00" }, { now: "nonsense" }, { manualDate: "bad" },
  { existingDate: "bad" }, { itemId: "missing" },
]) assert.throws(() => compareTransitionModels(audit, { ...scenario, ...changes }), RangeError);

for (const condition of [
  "{", "null", "{}", '{"logic":"AND","rules":[]}',
  '{"logic":"AND","rules":[{"field":"contact.email","op":"eq","value":"private@example.test"}]}',
  '{"logic":"AND","rules":[{"field":"call_count","op":"lt","value":"1x"}]}',
  '{"logic":"AND","rules":[{"field":"call_count","op":"lt","value":"1","extra":true}]}',
  '{"logic":"AND","rules":[{"field":"call_count","op":"unknown","value":"1"}]}',
  '{"logic":"AND","rules":[{"field":"call_count","op":"lt","value":"1"}],"extra":true}',
]) assert.equal(parseTransitionCondition({ condition_json: condition }).kind, "unsupported");
assert.equal(parseTransitionCondition({ condition_field: "unknown" }).kind, "unsupported");
assert.equal(parseTransitionCondition({ condition_value: "secret" }).kind, "unsupported");
assert.equal(parseTransitionCondition({ condition_field: "always" }).kind, "always");
assert.equal(transitionConditionPasses({ kind: "unsupported" }, 0), null);
for (const [op, expected] of [["lt", false], ["gt", false], ["eq", true], ["neq", false], ["gte", true], ["lte", true]] as const) {
  const condition = parseTransitionCondition({ condition_json: JSON.stringify({
    logic: "AND", rules: [{ field: "call_count", op, value: "1" }],
  }) });
  assert.equal(transitionConditionPasses(condition, 1), expected);
}

// Compare independent day-by-day legacy reproduction vs the candidate's shared
// calendar for weekends, midnight in Bratislava, both DST changes, and long terms.
let comparisons = 0;
for (const now of [
  "2026-01-01T00:00:00Z", "2026-03-27T23:30:00Z", "2026-03-29T01:30:00Z",
  "2026-10-23T12:00:00Z", "2026-10-24T22:30:00Z", "2026-10-25T01:30:00Z",
  "2026-12-31T23:30:00Z",
]) for (const days of [0, 1, 2, 3, 5, 7, 14, 30]) for (const weekdaysOnly of [true, false]) {
  const custom = structuredClone(audit);
  const action = custom.actions.find(value => value.id === callback.id)!;
  action.callback = { days, weekdaysOnly, existing: "replace", time: "09:00" };
  const result = compareTransitionModels(custom, { ...scenario, itemId: action.itemId, now }).find(value => value.id === action.id)!;
  assert.equal(result.comparison, "model_match", JSON.stringify({ now, days, weekdaysOnly }));
  comparisons++;
}
const keep = structuredClone(audit);
keep.actions.find(action => action.id === callback.id)!.callback!.existing = "keep_existing";
const kept = compareTransitionModels(keep, {
  ...scenario, itemId: callback.itemId, existingDate: "2026-10-01T07:00:00Z",
  manualDate: "2026-11-02T10:30:00+01:00",
}).find(result => result.id === callback.id)!;
assert.equal(kept.legacy.callbackDate, "2026-10-01T07:00:00.000Z");
assert.equal(kept.legacy.keptExisting, true);
assert.equal(kept.legacy.assignsActingAgent, false);
const terminal = compareTransitionModels(keep, {
  ...scenario, itemId: callback.itemId, existingDate: "2026-10-01T07:00:00Z", existingStatus: "completed",
}).find(result => result.id === callback.id)!;
assert.equal(terminal.legacy.keptExisting, false);
assert.equal(terminal.legacy.callbackDate, "2026-10-28T08:00:00.000Z");
console.log(`Transition model checks passed, including ${comparisons} independent calendar comparisons.`);
