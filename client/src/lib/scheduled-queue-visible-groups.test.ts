import assert from "node:assert/strict";
import test from "node:test";
import { visibleScheduledQueueGroups } from "./scheduled-queue-visible-groups";

test("scheduled queue applies one aggregate cap in the requested bucket order", () => {
  const groups = {
    later: ["later-1", "later-2"],
    today: ["today-1", "today-2", "today-3"],
    overdue: ["overdue-1", "overdue-2"],
  };

  assert.deepEqual(
    visibleScheduledQueueGroups(groups, ["overdue", "today", "later"], 4),
    [
      { bucket: "overdue", items: ["overdue-1", "overdue-2"], total: 2 },
      { bucket: "today", items: ["today-1", "today-2"], total: 3 },
    ],
  );
});

test("scheduled queue reports full bucket totals while exposing only capped items", () => {
  const groups = {
    overdue: ["o1"],
    today: ["t1", "t2", "t3"],
    later: ["l1", "l2", "l3"],
  };

  assert.deepEqual(
    visibleScheduledQueueGroups(groups, ["overdue", "today", "later"], 3),
    [
      { bucket: "overdue", items: ["o1"], total: 1 },
      { bucket: "today", items: ["t1", "t2"], total: 3 },
    ],
  );
});

test("increasing the visible cap progressively reveals more queue items", () => {
  const groups = {
    overdue: Array.from({ length: 2 }, (_, index) => `o${index + 1}`),
    today: Array.from({ length: 3 }, (_, index) => `t${index + 1}`),
    later: Array.from({ length: 3 }, (_, index) => `l${index + 1}`),
  };
  const order = ["overdue", "today", "later"];
  const atInitialCap = visibleScheduledQueueGroups(groups, order, 2);
  const afterShowMore = visibleScheduledQueueGroups(groups, order, 5);
  const allVisible = visibleScheduledQueueGroups(groups, order, 8);

  assert.equal(atInitialCap.reduce((count, group) => count + group.items.length, 0), 2);
  assert.equal(afterShowMore.reduce((count, group) => count + group.items.length, 0), 5);
  assert.equal(allVisible.reduce((count, group) => count + group.items.length, 0), 8);
  assert.deepEqual(afterShowMore.map(group => group.bucket), ["overdue", "today"]);
  assert.deepEqual(allVisible.map(group => group.bucket), order);
});