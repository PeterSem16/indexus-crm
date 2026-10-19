import assert from "node:assert/strict";
import { dryRunStatusListRule } from "./status-list-dry-run";
import type { SavedStatusListWorkflow } from "../../../shared/status-list-workflow";
import { getStatusListWorkspaceCopy } from "../components/status-list-workspace-copy";
const rule: SavedStatusListWorkflow = {
  id: "r", campaignId: "mission", name: "Hypothetical only", enabled: true,
  source: { kind: "item", id: "source" }, trigger: "agent_confirmation", sourceValue: true,
  logic: "and", conditions: [{ field: "answer", ref: { kind: "question", id: "answer" }, op: "equals", value: "yes" }],
  thenActions: [{ type: "confirm_step", target: { kind: "item", id: "target" } }],
  elseActions: [{ type: "clear_answer", target: { kind: "question", id: "answer" } }],
};
const before = JSON.stringify(rule);
assert.equal(dryRunStatusListRule(rule, true, ["yes"]).branch, "then");
assert.equal(dryRunStatusListRule(rule, true, ["no"]).branch, "else");
assert.equal(dryRunStatusListRule(rule, true, [undefined]).branch, "else");
assert.equal(dryRunStatusListRule(rule, false, ["yes"]).branch, "none");
assert.equal(dryRunStatusListRule(rule, undefined, ["yes"]).actions.length, 0);
assert.equal(dryRunStatusListRule({ ...rule, enabled: false }, true, ["yes"]).branch, "none");
assert.equal(dryRunStatusListRule({ ...rule, conditions: [] }, true, []).branch, "then");
assert.equal(dryRunStatusListRule({ ...rule, logic: "or", conditions: [...rule.conditions, { field: "assigned_to", op: "empty" }] }, true, ["no", undefined]).branch, "then");
assert.equal(JSON.stringify(rule), before, "Dry-run never mutates saved definitions");
console.log("Status List pure dry-run: 9 checks passed");
const keys = Object.keys(getStatusListWorkspaceCopy("en"));
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
  const translated = getStatusListWorkspaceCopy(locale);
  assert.deepEqual(Object.keys(translated), keys);
  assert.ok(Object.values(translated).every(value => typeof value === "string" && value.trim().length > 0));
}
console.log("Workspace copy: all keys present in all 7 languages");
