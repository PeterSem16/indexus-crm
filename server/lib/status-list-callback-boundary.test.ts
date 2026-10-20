import assert from "node:assert/strict";
import { callbackDependencyBlockers, type CallbackDependencies } from "./status-list-callback-boundary";

const items = [{ id: "group" }, { id: "callback", parent_id: "group" },
  { id: "child", parent_id: "callback" }, { id: "other" }];
const questions = [{ id: "protected-question", item_id: "callback" }, { id: "other-question", item_id: "other" }];
const empty: CallbackDependencies = { rules: [], sources: [], option_sources: [] };
const rule = { name: "New action", enabled: true, source: { kind: "item", id: "callback" },
  trigger: "agent_confirmation", logic: "and", conditions: [],
  thenActions: [{ type: "append_note", target: { kind: "item", id: "callback" }, text: "Safe note" }], elseActions: [] };
let checks = 0;
function check(deps: Partial<CallbackDependencies>, expected: string[]) {
  assert.deepEqual(callbackDependencyBlockers(["callback"], items, questions, { ...empty, ...deps }), expected);
  checks++;
}
check({}, []);
check({ rules: [{ definition: rule }] }, []);
check({ rules: [{ definition: { ...rule, runTargetAutomations: true } }] }, []);
check({ rules: [{ definition: { ...rule, thenActions: [
  { type: "confirm_step", target: { kind: "item", id: "other" } }] } }] }, []);
for (const id of ["callback", "child", "group"]) {
  for (const branch of ["thenActions", "elseActions"]) {
    const unsafe = { ...rule, [branch]: [{ type: "unconfirm_step", target: { kind: "item", id } }] };
    check({ rules: [{ definition: unsafe }] }, ["internal_workflow_dependency"]);
    check({ rules: [{ definition: { ...unsafe, enabled: false } }] }, []);
  }
}
check({ rules: [{ definition: { ...rule, thenActions: [
  { type: "clear_answer", target: { kind: "question", id: "protected-question" } }] } }] }, ["internal_workflow_dependency"]);
check({ rules: [{ definition: { ...rule, thenActions: [
  { type: "clear_answer", target: { kind: "question", id: "other-question" } }] } }] }, []);
check({ rules: [{ definition: {} }] }, ["internal_workflow_dependency"]);
check({ rules: [{ definition: { ...rule, source: { kind: "item", id: "missing" } } }] }, ["internal_workflow_dependency"]);
check({ rules: [{ definition: { ...rule, thenActions: [
  { type: "append_note", target: { kind: "item", id: "missing" }, text: "Unknown" }] } }] }, ["internal_workflow_dependency"]);
check({ sources: [{ question_id: "other-question" }], option_sources: [{ group_id: "other" }] }, []);
check({ sources: [{ question_id: "protected-question" }] }, ["background_dependency"]);
check({ sources: [{ question_id: "missing" }] }, ["background_dependency"]);
check({ option_sources: [{ group_id: "group" }] }, ["background_dependency"]);
check({ option_sources: [{ group_id: "missing" }] }, ["background_dependency"]);
console.log(`Callback independence boundary: ${checks} checks passed.`);
