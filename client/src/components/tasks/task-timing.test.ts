import assert from "node:assert/strict";
import {
  formatTaskElapsedTime,
  getTaskElapsedMilliseconds,
  getTaskDeadlineTimestamp,
  isTaskOverdue,
} from "./task-timing";

const springForwardBoundary = Date.parse("2025-03-30T22:00:00.000Z");
assert.equal(getTaskDeadlineTimestamp("2025-03-30"), springForwardBoundary);
assert.equal(getTaskDeadlineTimestamp("2025-03-30T00:00:00.000Z"), springForwardBoundary);
assert.equal(getTaskDeadlineTimestamp("2025-03-30T00:00:00+00:00"), springForwardBoundary);
assert.equal(isTaskOverdue("pending", "2025-03-30", springForwardBoundary - 1), false);
assert.equal(isTaskOverdue("in_progress", "2025-03-30", springForwardBoundary), true);
assert.equal(isTaskOverdue("completed", "2025-03-30", springForwardBoundary + 10_000), false);
assert.equal(isTaskOverdue("cancelled", "2025-03-30", springForwardBoundary + 10_000), false);

const fallBackBoundary = Date.parse("2025-10-26T23:00:00.000Z");
assert.equal(getTaskDeadlineTimestamp("2025-10-26"), fallBackBoundary);
assert.equal(getTaskDeadlineTimestamp("2025-10-26T12:30:00.000Z"), Date.parse("2025-10-26T12:30:00.000Z"));
assert.equal(getTaskDeadlineTimestamp("not-a-date"), null);
assert.equal(getTaskDeadlineTimestamp(new Date("2025-03-30T00:00:00.000Z")), springForwardBoundary);
assert.equal(formatTaskElapsedTime(2 * 60 * 60 * 1000 + 3 * 60 * 1000 + 4_000), "02:03:04");
assert.equal(formatTaskElapsedTime(27 * 60 * 60 * 1000), "27:00:00");
assert.equal(getTaskElapsedMilliseconds("pending", null, null, 10_000), null);
assert.equal(getTaskElapsedMilliseconds("in_progress", null, null, 10_000), null);
assert.equal(getTaskElapsedMilliseconds("in_progress", "1970-01-01T00:00:00.000Z", null, 10_000), 10_000);
assert.equal(getTaskElapsedMilliseconds("completed", "2025-01-01T00:00:00.000Z", "2025-01-01T00:05:00.000Z", 10_000), 5 * 60 * 1000);
assert.equal(getTaskElapsedMilliseconds("cancelled", "2025-01-01T00:00:00.000Z", null, 10_000), null);

console.log("task timing and Bratislava deadline checks passed");