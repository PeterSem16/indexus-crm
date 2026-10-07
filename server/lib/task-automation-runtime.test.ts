import { test, after } from "node:test";
import assert from "node:assert/strict";
import { dryRunRule } from "./automation-engine";
import { pool } from "../db";

// Dry-runs evaluate the actual engine without executing actions or writing CRM data.
after(async () => { await pool.end(); });
const rule = (assignmentTarget?: any, conditions?: any) => ({
  module: "task",
  trigger: { type: "event", entityType: "task", eventType: "task.assigned", assignmentTarget },
  conditions: conditions || null,
  actions: [{ type: "create_task", config: { title: "Test", assignedUserId: "anna" } }],
}) as any;

test("actual dry-run matches selected groups and rejects their nominal personal owner", async () => {
  const sample = { eventType: "task.assigned", newValues: { assignedUserId: "anna", taskGroupIds: ["it"] } };
  assert.equal((await dryRunRule(rule({ kind: "groups", ids: ["bo", "it"] }), sample)).conditionMet, true);
  assert.equal((await dryRunRule(rule({ kind: "groups", ids: ["bo"] }), sample)).conditionMet, false);
  assert.equal((await dryRunRule(rule({ kind: "users", ids: ["anna"] }), sample)).conditionMet, false);
  assert.equal((await dryRunRule(rule({ kind: "users", ids: ["anna"] }), {
    ...sample, newValues: { assignedUserId: "anna", taskGroupIds: [] },
  })).conditionMet, true);
});

test("actual IF evaluator matches group overlap and resolution date", async () => {
  const sample = { eventType: "task.completed", newValues: {
    taskGroupIds: ["it"], resolvedByGroupIds: ["bo"], resolvedAt: "2026-10-07T09:00:00.000Z",
  } };
  const conditions = { all: [
    { field: "newValues.taskGroupIds", op: "in", value: ["it", "other"] },
    { field: "newValues.resolvedByGroupIds", op: "in", value: ["bo"] },
    { field: "newValues.resolvedAt", op: "gte", value: "2026-10-07" },
  ] };
  assert.equal((await dryRunRule(rule(undefined, conditions), sample)).conditionMet, true);
  assert.equal((await dryRunRule(rule(undefined, { field: "newValues.resolvedByGroupIds", op: "not_in", value: ["bo"] }), sample)).conditionMet, false);
  assert.equal((await dryRunRule(rule(undefined, { field: "newValues.taskGroupIds", op: "not_in", value: ["other"] }), sample)).conditionMet, true);
});
