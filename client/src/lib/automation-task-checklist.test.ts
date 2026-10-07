import assert from "node:assert/strict";
import test from "node:test";
import { taskChecklistItems, taskChecklistText } from "./automation-task-checklist";

test("each line becomes one saved checklist item without saving blank lines", () => {
  assert.deepEqual(taskChecklistItems("First\n\nSecond\n"), ["First", "Second"]);
  assert.deepEqual(taskChecklistItems("  First \r\n Second \r\n "), ["First", "Second"]);
  assert.deepEqual(taskChecklistItems("\n\n"), []);
});
test("existing string and object checklist items retain their line boundaries", () => {
  assert.equal(taskChecklistText(["First", { label: "Second" }]), "First\nSecond");
  assert.equal(taskChecklistText(undefined), "");
  assert.equal(taskChecklistText([{ label: "{{newValues.name}}" }, "Check data"]), "{{newValues.name}}\nCheck data");
});
