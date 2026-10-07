import { test } from "node:test";
import assert from "node:assert/strict";
import { isTaskAssignmentTriggerTarget, taskAssignmentTriggerMatches, taskAutomationGroupIds, taskAutomationListMatches } from "./task-automation";

test("group snapshot extracts only group IDs, deduplicates, and never retains free text tags", () => {
  assert.deepEqual(taskAutomationGroupIds({ tags: ["secret text", "group_id:it", "group_id:it", "group_id:bo", "group_id:"] }), ["it", "bo"]);
  assert.deepEqual(taskAutomationGroupIds({ taskGroupIds: ["it"], tags: ["group_id:bo"] }), ["it"]);
});

test("assignment targets are exclusive, nonempty, bounded and use unique IDs", () => {
  assert.equal(isTaskAssignmentTriggerTarget({ kind: "groups", ids: ["it", "bo"] }), true);
  assert.equal(isTaskAssignmentTriggerTarget({ kind: "users", ids: ["alice"] }), true);
  for (const value of [{ kind: "all", ids: ["it"] }, { kind: "groups", ids: [] }, { kind: "users", ids: [""] },
    { kind: "users", ids: ["alice", "alice"] }, { kind: "users", ids: Array(201).fill("alice") },
    { kind: "users", ids: ["alice"], groupIds: ["it"] }]) {
    assert.equal(isTaskAssignmentTriggerTarget(value), false);
  }
});

test("multiple group choices use OR semantics", () => {
  const trigger = { eventType: "task.assigned", assignmentTarget: { kind: "groups", ids: ["it", "bo"] } };
  assert.equal(taskAssignmentTriggerMatches(trigger, { taskGroupIds: ["bo"], assignedUserId: "alice" }), true);
  assert.equal(taskAssignmentTriggerMatches(trigger, { taskGroupIds: ["other"], assignedUserId: "alice" }), false);
  assert.equal(taskAssignmentTriggerMatches(trigger, { assignedUserId: "alice" }), false);
});

test("personal targets never match the nominal owner of a shared group task", () => {
  const trigger = { eventType: "task.assigned", assignmentTarget: { kind: "users", ids: ["alice", "bob"] } };
  assert.equal(taskAssignmentTriggerMatches(trigger, { assignedUserId: "alice", taskGroupIds: [] }), true);
  assert.equal(taskAssignmentTriggerMatches(trigger, { assignedUserId: "bob" }), true);
  assert.equal(taskAssignmentTriggerMatches(trigger, { assignedUserId: "alice", taskGroupIds: ["it"] }), false);
  assert.equal(taskAssignmentTriggerMatches(trigger, { assignedUserId: "alice", tags: ["group_id:it"] }), false);
  assert.equal(taskAssignmentTriggerMatches(trigger, { assignedUserId: "other" }), false);
});

test("legacy assignment triggers remain unfiltered, malformed new filters fail closed", () => {
  assert.equal(taskAssignmentTriggerMatches({ eventType: "task.assigned" }, {}), true);
  assert.equal(taskAssignmentTriggerMatches({ eventType: "task.assigned", assignmentTarget: { kind: "groups", ids: [] } }, {}), false);
});

test("group IF conditions use overlap, not array identity", () => {
  assert.equal(taskAutomationListMatches(["it"], ["bo", "it"]), true);
  assert.equal(taskAutomationListMatches(["it"], ["bo"]), false);
  assert.equal(taskAutomationListMatches([], ["bo"]), false);
  assert.equal(taskAutomationListMatches(undefined, ["bo"]), false);
});
