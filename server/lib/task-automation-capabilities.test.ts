import { test } from "node:test";
import assert from "node:assert/strict";
import { FIELD_OPTIONS, fieldsForEvent, operatorsForEvent, validateRuleCapabilities } from "./automation-capabilities";
import { TASK_PRIORITIES, TASK_STATUSES } from "@shared/schema";
const rule = (eventType: string, conditions: any = null, assignmentTarget?: any) => ({
  module: "task", trigger: { type: "event", entityType: "task", eventType, assignmentTarget }, conditions,
  actions: [{ type: "notify_user", config: { userId: "alice", title: "Test" } }],
});

test("task choices exactly match task creation priorities and statuses", () => {
  assert.deepEqual(FIELD_OPTIONS.task.find(f => f.value === "newValues.priority")?.options, TASK_PRIORITIES.map(p => p.value));
  assert.deepEqual(FIELD_OPTIONS.task.find(f => f.value === "newValues.status")?.options, TASK_STATUSES.map(s => s.value));
  assert.ok(validateRuleCapabilities(rule("created", { field: "newValues.priority", op: "eq", value: "normal" })).length);
  assert.ok(validateRuleCapabilities(rule("created", { field: "newValues.status", op: "eq", value: "resolved" })).length);
  assert.deepEqual(validateRuleCapabilities(rule("created", { field: "newValues.status", op: "eq", value: "completed" })), []);
});

test("task status changes offer complete task conditions without widening other record types", () => {
  assert.ok(fieldsForEvent("task", "status_changed").some(f => f.value === "newValues.assignedUserId"));
  assert.ok(fieldsForEvent("task", "status_changed").some(f => f.value === "newValues.resolvedAt"));
  assert.deepEqual(fieldsForEvent("customer", "status_changed").map(f => f.value), ["newValues.status"]);
});

test("group and resolver group condition lists validate real ID selections", () => {
  for (const field of ["newValues.taskGroupIds", "newValues.resolvedByGroupIds"]) {
    assert.deepEqual(validateRuleCapabilities(rule("task.completed", { field, op: "in", value: ["it", "bo"] })), []);
    assert.ok(validateRuleCapabilities(rule("task.completed", { field, op: "eq", value: "it" })).length);
  }
  assert.deepEqual(operatorsForEvent("task.completed", "list").map(op => op.value), ["in", "not_in", "is_null", "is_not_null"]);
});

test("target filters validate on task assigned only and reject empty or mixed-shaped routing", () => {
  assert.deepEqual(validateRuleCapabilities(rule("task.assigned", null, { kind: "groups", ids: ["it"] })), []);
  assert.deepEqual(validateRuleCapabilities(rule("task.assigned", null, { kind: "users", ids: ["alice"] })), []);
  assert.ok(validateRuleCapabilities(rule("created", null, { kind: "users", ids: ["alice"] })).length);
  assert.ok(validateRuleCapabilities(rule("task.assigned", null, { kind: "groups", ids: [] })).length);
});

test("resolved at retains date semantics and rejects a recipient ID", () => {
  assert.deepEqual(validateRuleCapabilities(rule("task.completed", { field: "newValues.resolvedAt", op: "gte", value: "2026-10-07" })), []);
  assert.ok(validateRuleCapabilities(rule("task.completed", { field: "newValues.resolvedAt", op: "eq", value: "alice" })).length);
});
