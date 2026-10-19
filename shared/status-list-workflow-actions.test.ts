import assert from "node:assert/strict";
import { isWorkflowNoteAction, remapStatusListWorkflow, statusListWorkflowSchema, workflowActionSchema, workflowActionSupportsTarget, type WorkflowAction, type WorkflowCatalogItem } from "./status-list-workflow";
import { getStatusWorkflowActionCopy } from "../client/src/components/status-list-workflow-action-copy";

const item: WorkflowCatalogItem = { kind: "item", id: "target", label: "Target", writable: true, hidden: false, fieldType: "checkbox" };
const question: WorkflowCatalogItem = { ...item, kind: "question" };
const base = { name: "Action tests", enabled: true, source: { kind: "item", id: "source" }, trigger: "agent_confirmation", logic: "and", conditions: [], elseActions: [] };
const types = Object.keys(getStatusWorkflowActionCopy("en").labels) as WorkflowAction["type"][];
for (const type of types) {
  const action = { type, target: { kind: "item", id: "target" }, ...(type === "set_answer" ? { value: true, mode: "replace" } : type === "replace_note" || type === "append_note" ? { text: "Note" } : {}) };
  assert.ok(workflowActionSchema.safeParse(action).success, type);
  assert.ok(!workflowActionSchema.safeParse({ ...action, chained: true }).success);
  assert.equal(workflowActionSupportsTarget(type, { ...item, writable: false }), false);
  assert.equal(statusListWorkflowSchema.safeParse({ ...base, thenActions: [{ ...action, target: base.source }] }).success, isWorkflowNoteAction(type));
}
assert.equal(workflowActionSupportsTarget("clear_answer", question), true);
assert.equal(workflowActionSupportsTarget("clear_answer", item), false);
assert.equal(workflowActionSupportsTarget("replace_note", question), false);
assert.equal(workflowActionSupportsTarget("confirm_step", question), false);
assert.equal(workflowActionSupportsTarget("add_selection", question), false);
assert.equal(workflowActionSupportsTarget("add_selection", { ...question, multiSelectable: true }), true);
assert.equal(workflowActionSupportsTarget("remove_selection", { ...item, multiSelectable: true }), true);
assert.equal(workflowActionSchema.safeParse({ type: "append_note", target: base.source, text: " " }).success, false);
assert.equal(workflowActionSchema.safeParse({ type: "clear_answer", target: base.source, value: true }).success, false);
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
  const copy = getStatusWorkflowActionCopy(locale);
  assert.deepEqual(Object.keys(copy.labels), types);
  assert.ok(Object.values(copy.labels).every(label => label.trim()));
  assert.ok([copy.type, copy.text, copy.notes, copy.noteHint, copy.selectionHint, copy.clearHint].every(label => label.trim()));
}
console.log("PASS: all internal action schemas, protected targets, source-note exception, strict payloads and seven languages");
const cloned = remapStatusListWorkflow(statusListWorkflowSchema.parse({ ...base, name: "source", thenActions: [
  { type: "append_note", target: { kind: "item", id: "target" }, text: "source" },
  { type: "set_answer", target: { kind: "question", id: "question" }, value: "target", mode: "replace" },
] }), new Map([["source", "new-source"], ["target", "new-target"], ["question", "new-question"]]));
assert.equal(cloned.source.id, "new-source");
assert.equal(cloned.name, "source");
assert.deepEqual(cloned.thenActions[0], { type: "append_note", target: { kind: "item", id: "new-target" }, text: "source" });
assert.deepEqual(cloned.thenActions[1], { type: "set_answer", target: { kind: "question", id: "new-question" }, value: "target", mode: "replace" });
console.log("PASS: cloning remaps references without rewriting note text or answer content");
