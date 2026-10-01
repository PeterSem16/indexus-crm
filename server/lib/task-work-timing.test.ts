import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripTaskWorkTimingInput, transitionTaskWorkTiming } from "./task-work-timing";

describe("server-managed task work timing", () => {
  const startedAt = new Date("2026-01-02T03:04:05.000Z");
  const later = new Date("2026-01-02T03:14:05.000Z");
  const stoppedAt = new Date("2026-01-02T03:24:05.000Z");

  it("stamps first start once and preserves it across repeated/active transitions", () => {
    const initial = { status: "pending", workStartedAt: null, workStoppedAt: null };
    const started = transitionTaskWorkTiming(initial, "in_progress", startedAt);
    assert.deepEqual(started, { workStartedAt: startedAt, workStoppedAt: null });
    assert.deepEqual(
      transitionTaskWorkTiming({ ...initial, ...started, status: "in_progress" }, "in_progress", later),
      started,
      "repeat updates and title-only edits while active retain the first start time",
    );
    assert.deepEqual(
      transitionTaskWorkTiming({ ...initial, ...started, status: "in_progress" }, "pending", later),
      started,
      "forwarding back to pending keeps the same elapsed-time cycle",
    );
  });

  it("freezes started cycles at completion or cancellation and preserves terminal timestamps", () => {
    const active = { status: "in_progress", workStartedAt: startedAt, workStoppedAt: null };
    assert.deepEqual(transitionTaskWorkTiming(active, "completed", stoppedAt), {
      workStartedAt: startedAt,
      workStoppedAt: stoppedAt,
    });
    assert.deepEqual(transitionTaskWorkTiming(active, "cancelled", stoppedAt), {
      workStartedAt: startedAt,
      workStoppedAt: stoppedAt,
    });
    assert.deepEqual(transitionTaskWorkTiming({
      status: "completed", workStartedAt: startedAt, workStoppedAt: stoppedAt,
    }, "cancelled", later), {
      workStartedAt: startedAt,
      workStoppedAt: stoppedAt,
    });
  });

  it("leaves unstarted terminal tasks unknown and does not backfill old active tasks", () => {
    const pending = { status: "pending", workStartedAt: null, workStoppedAt: null };
    assert.deepEqual(transitionTaskWorkTiming(pending, "completed", stoppedAt), {
      workStartedAt: null,
      workStoppedAt: null,
    });
    assert.deepEqual(transitionTaskWorkTiming(pending, "cancelled", stoppedAt), {
      workStartedAt: null,
      workStoppedAt: null,
    });
    assert.deepEqual(transitionTaskWorkTiming({
      status: "in_progress", workStartedAt: null, workStoppedAt: null,
    }, "in_progress", stoppedAt), {
      workStartedAt: null,
      workStoppedAt: null,
    });
  });

  it("resets on terminal reopen and starts a new clock only when reopening into active work", () => {
    const completed = { status: "completed", workStartedAt: startedAt, workStoppedAt: stoppedAt };
    assert.deepEqual(transitionTaskWorkTiming(completed, "pending", later), {
      workStartedAt: null,
      workStoppedAt: null,
    });
    assert.deepEqual(transitionTaskWorkTiming(completed, "in_progress", later), {
      workStartedAt: later,
      workStoppedAt: null,
    });
    assert.deepEqual(transitionTaskWorkTiming({
      status: "cancelled", workStartedAt: null, workStoppedAt: null,
    }, "in_progress", later), {
      workStartedAt: later,
      workStoppedAt: null,
    });
  });

  it("strips caller-supplied timestamps before server timing is applied", () => {
    const spoof = {
      title: "Edited title",
      workStartedAt: new Date("2000-01-01T00:00:00.000Z"),
      workStoppedAt: new Date("2000-01-02T00:00:00.000Z"),
    };
    assert.deepEqual(stripTaskWorkTimingInput(spoof), { title: "Edited title" });
    assert.deepEqual(spoof.workStartedAt, new Date("2000-01-01T00:00:00.000Z"), "input object is not mutated");
  });
});