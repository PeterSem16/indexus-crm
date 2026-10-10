import assert from "node:assert/strict";
import { it } from "node:test";
import { communicationTaskCounts, communicationTaskVersion, communicationChatCount } from "./communication-updates";

const pending = { id: "one", status: "pending", boState: "received" };
it("initial history is a baseline, not a flood of new updates", () => {
  assert.deepEqual(communicationTaskCounts([{ ...pending, status: "completed" }], null), { inProgress: 0, completed: 0 });
});
it("tracks unread in-progress and completed transitions independently", () => {
  const seen = { one: communicationTaskVersion(pending), two: communicationTaskVersion({ ...pending, id: "two" }) };
  const rows = [{ ...pending, status: "in_progress" }, { ...pending, id: "two", boState: "done" }];
  assert.deepEqual(communicationTaskCounts(rows, seen), { inProgress: 1, completed: 1 });
  seen.one = communicationTaskVersion(rows[0]);
  assert.deepEqual(communicationTaskCounts(rows, seen), { inProgress: 0, completed: 1 });
});
it("ignores cancellations and pending tasks but detects a new work cycle", () => {
  const task = { ...pending, status: "in_progress", workStartedAt: "2026-10-10T09:00:00.000Z" };
  const seen = { one: communicationTaskVersion(task) };
  assert.deepEqual(communicationTaskCounts([task, { ...pending, id: "two", status: "cancelled", boState: "done" }], seen), { inProgress: 0, completed: 0 });
  assert.equal(communicationTaskCounts([{ ...task, workStartedAt: "2026-10-10T10:00:00.000Z" }], seen).inProgress, 1);
  assert.equal(communicationTaskVersion(task), communicationTaskVersion({ ...task, workStartedAt: new Date(task.workStartedAt) }));
});
it("deduplicates persisted and websocket unread counts by conversation", () => {
  assert.equal(communicationChatCount([{ partnerId: "a", unreadCount: 3 }], new Map([["a", 2], ["b", 1]])), 4);
  assert.equal(communicationChatCount([{ partnerId: "a", unreadCount: 0 }], new Map([["a", 0]])), 0);
});
