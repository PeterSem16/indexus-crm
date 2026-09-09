import assert from "node:assert/strict";
import {
  advancePulseCallCountTracker,
  EMPTY_PULSE_CALL_COUNT_TRACKER,
  type PulseCallCountTracker,
} from "./pulse-session-call-counter";

function run(states: string[]): number {
  let previous = "idle";
  let tracker: PulseCallCountTracker = EMPTY_PULSE_CALL_COUNT_TRACKER;
  let count = 0;
  for (const current of states) {
    const update = advancePulseCallCountTracker(tracker, previous, current);
    tracker = update.tracker;
    if (update.increment) count += 1;
    previous = current;
  }
  return count;
}

assert.equal(run(["connecting", "ringing", "active", "ended", "ended", "idle"]), 1);
assert.equal(run(["connecting", "active", "idle"]), 1);
assert.equal(run(["connecting", "ringing", "ended", "idle"]), 0);
assert.equal(run(["active", "ended", "idle", "ringing", "active", "ended"]), 2);

console.log("NEXUS Pulse session call counter tests passed");