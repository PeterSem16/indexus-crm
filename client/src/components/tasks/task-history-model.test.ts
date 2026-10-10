import { test } from "node:test";
import assert from "node:assert/strict";
import type { TaskComment } from "@shared/schema";
import { isCompletionEvent, taskHistoryComments, taskResolverId } from "./task-history-model";

const task = { resolvedAt: new Date("2026-10-10T09:00:00Z"), resolvedByUserId: "resolver", resolution: "Verified the result." };
const event = (overrides: Partial<TaskComment> = {}): TaskComment => ({
  id: "event", taskId: "task", userId: "resolver", kind: "state_change", content: task.resolution,
  metadata: { toState: "completed" }, createdAt: new Date("2026-10-10T09:00:00.050Z"), ...overrides,
});

test("latest completion is represented by the canonical task card once", () => {
  assert.deepEqual(taskHistoryComments(task, [event()]), []);
  assert.deepEqual(taskHistoryComments(task, [event({ metadata: { toState: "done" } })]), []);
});
test("legacy completion comments without metadata are deduplicated", () => {
  assert.deepEqual(taskHistoryComments(task, [event({ metadata: null })]), []);
});
test("older completions and other state changes remain in history", () => {
  const old = event({ id: "old", createdAt: new Date("2026-10-09T09:00:00Z"), content: "Previous result." });
  const handoff = event({ id: "handoff", metadata: { toState: "in_progress" }, content: "Handed to another group." });
  assert.deepEqual(taskHistoryComments(task, [old, handoff, event()]), [old, handoff]);
  assert.equal(isCompletionEvent(task, old), true);
  assert.equal(isCompletionEvent(task, handoff), false);
});
test("ordinary discussions with the same text are not completion events", () => {
  assert.equal(isCompletionEvent(task, event({ kind: "comment" })), false);
});
test("completion without canonical timestamp still has a history event", () => {
  assert.equal(taskHistoryComments({ ...task, resolvedAt: null }, [event()]).length, 1);
  assert.equal(taskHistoryComments(task, [event({ createdAt: new Date(NaN) })]).length, 1);
});
test("resolver is the actual actor, with a legacy completion-event fallback", () => {
  assert.equal(taskResolverId(task, [event({ userId: "other" })]), "resolver");
  assert.equal(taskResolverId({ ...task, resolvedByUserId: null }, [event()]), "resolver");
  assert.equal(taskResolverId({ ...task, resolvedByUserId: null }, []), null);
});
