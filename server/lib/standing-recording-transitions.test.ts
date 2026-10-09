import assert from "node:assert/strict";
import test from "node:test";
import { allowedStandingRecordingStates, isCurrentCallerBridgeExit } from "./standing-recording-transitions";
import { isTrustedStandingRecording } from "./queue-call-lifecycle";

test("late recording start and stop never regress saving, saved, or failed", () => {
  assert.deepEqual(allowedStandingRecordingStates("recording"), ["starting"]);
  for (const state of ["saving", "saved", "failed"]) {
    assert.ok(!allowedStandingRecordingStates("recording").includes(state));
    assert.ok(!allowedStandingRecordingStates("stop_requested").includes(state));
  }
});

test("a failed half-connected attempt cannot publish audio for a later successful retry", () => {
  const identity = { host: "isolated-pbx", port: 8088 };
  assert.equal(isTrustedStandingRecording({
    callLogId: "call", recordingName: "mobile_call_standing_123",
    standingForward: true, currentPbxIdentity: identity,
    authorization: {
      authorized: true, bridgeConnected: false, state: "recording", campaignId: null,
      recordingPolicySnapshot: null, recordingName: "mobile_call_standing_123", pbxIdentity: identity,
    },
  }), false);
});

test("only the saver owning the claim can release a failed download for recovery", () => {
  assert.ok(allowedStandingRecordingStates("stop_requested", true).includes("saving"));
  assert.ok(!allowedStandingRecordingStates("stop_requested", false).includes("saving"));
  assert.deepEqual(allowedStandingRecordingStates("saved", true), ["saving"]);
});

test("delayed old bridge exit must not hang up the new mobile forward", () => {
  const active = { bridgeId: "new-mixing-bridge", callerChannelId: "caller" };
  assert.equal(isCurrentCallerBridgeExit(active, "caller", "old-moh-bridge"), false);
  assert.equal(isCurrentCallerBridgeExit(active, "caller", undefined), false);
  assert.equal(isCurrentCallerBridgeExit(active, "agent", "new-mixing-bridge"), false);
  assert.equal(isCurrentCallerBridgeExit(active, "caller", "new-mixing-bridge"), true);
});
