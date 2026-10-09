"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { parsedMetadata, inboundMetadata } = require("./diagnose-callback-forwarding.cjs");

test("malformed, empty and array metadata cannot leak their original values", () => {
  for (const value of [null, undefined, "broken", '["private"]', ["private"], 123]) {
    assert.deepEqual(parsedMetadata(value), {});
    assert.deepEqual(inboundMetadata(value), {});
  }
});

test("standing authorization is inspectable without raw errors, PBX credentials or caller details", () => {
  const policy = { active: true, mode: "both", timezone: "Europe/Bratislava" };
  const result = inboundMetadata({
    campaignId: "test-mission",
    recordingPolicySnapshot: { ...policy, unrelated: "PRIVATE_NESTED_FIELD" },
    callerNumber: "PRIVATE_CALLER",
    callerName: "PRIVATE_NAME",
    standingForwardRecording: {
      authorized: true, state: "stop_requested", recordingName: "mobile_test_standing_1",
      recordingPolicySnapshot: { ...policy, unrelated: "PRIVATE_NESTED_FIELD" }, recoveryAttempts: 2,
      pbxIdentity: { host: "PRIVATE_HOST", password: "PRIVATE_PASSWORD" },
      lastError: "PRIVATE_ERROR", callerNumber: "PRIVATE_CALLER", unexpected: "PRIVATE_EXTRA",
    },
  });
  assert.equal(result.standingForwardRecording.authorized, true);
  assert.equal(result.standingForwardRecording.state, "stop_requested");
  assert.equal(result.standingForwardRecording.hasPbxIdentity, true);
  assert.equal(result.standingForwardRecording.hasError, true);
  assert.deepEqual(result.recordingPolicySnapshot, policy);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_"));
});

test("stringified metadata and explicit recording opt-out retain their meaning", () => {
  const result = inboundMetadata(JSON.stringify({
    campaignClassificationConflict: false,
    standingForwardRecording: { authorized: false, state: "off" },
  }));
  assert.equal(result.campaignClassificationConflict, false);
  assert.equal(result.standingForwardRecording.authorized, false);
  assert.equal(result.standingForwardRecording.hasPbxIdentity, false);
  assert.equal(result.standingForwardRecording.hasError, false);
});
