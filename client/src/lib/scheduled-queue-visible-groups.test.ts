import assert from "node:assert/strict";
import test from "node:test";
import { visibleScheduledQueueGroups } from "./scheduled-queue-visible-groups";

test("limits rendered rows across buckets without losing their order or totals", () => {
  const groups = { overdue: [1, 2, 3], today: [4, 5], later: [6] };
  assert.deepEqual(visibleScheduledQueueGroups(groups, ["overdue", "today", "later"], 4), [
    { bucket: "overdue", items: [1, 2, 3], total: 3 },
    { bucket: "today", items: [4], total: 2 },
  ]);
  assert.deepEqual(visibleScheduledQueueGroups(groups, ["later", "today", "overdue"], 3), [
    { bucket: "later", items: [6], total: 1 },
    { bucket: "today", items: [4, 5], total: 2 },
  ]);
});

test("empty, zero-limit, and fully visible queues remain predictable", () => {
  assert.deepEqual(visibleScheduledQueueGroups({}, ["today"], 40), []);
  assert.deepEqual(visibleScheduledQueueGroups({ today: [1] }, ["today"], 0), []);
  assert.deepEqual(visibleScheduledQueueGroups({ today: [1] }, ["today"], 40), [
    { bucket: "today", items: [1], total: 1 },
  ]);
});