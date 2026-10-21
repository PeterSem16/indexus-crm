import assert from "node:assert/strict";
import { test } from "node:test";
import { checkStatusListExecution, statusListAnswerChanges, statusListExecutionMode } from "./status-list-execution-policy";
test("default Immediate; unknown or malformed stored modes fail explicitly", () => {
  assert.equal(statusListExecutionMode(null), "immediate");
  assert.equal(statusListExecutionMode("{}"), "immediate");
  assert.equal(statusListExecutionMode('{"statusListMode":"batch"}'), "batch");
  assert.throws(() => statusListExecutionMode({ statusListMode: "other" }));
  assert.throws(() => statusListExecutionMode("{"));
});
test("Batch writes require an explicit current-mode Save", () => {
  for (const command of [{}, { commit: true }, { executionMode: "batch" }, { executionMode: "batch", commit: false }])
    assert.throws(() => checkStatusListExecution({ statusListMode: "batch" }, command));
  assert.equal(checkStatusListExecution({ statusListMode: "batch" }, { executionMode: "batch", commit: true }), "batch");
});
test("stale clients cannot execute after a manager changes the mode", () => {
  assert.throws(() => checkStatusListExecution({}, { executionMode: "batch", commit: true }), /mode_changed/);
  assert.throws(() => checkStatusListExecution({ statusListMode: "batch" }, { executionMode: "immediate", commit: true }), /mode_changed/);
});
test("radio / ONE persistence includes sibling clears and ignores unchanged answers", () => {
  assert.deepEqual(statusListAnswerChanges({ a: true, c: "yes" }, { b: true, c: "yes" }), [
    { questionId: "a", expected: true, value: null }, { questionId: "b", expected: null, value: true },
  ]);
  assert.deepEqual(statusListAnswerChanges({ a: null }, {}), []);
  assert.deepEqual(statusListAnswerChanges({ a: "yes" }, { a: "no" }), [{ questionId: "a", expected: "yes", value: "no" }]);
});
