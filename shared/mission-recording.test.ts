import assert from "node:assert/strict";
import {
  getMissionRecordingPolicy,
  resolveMissionRecordingPolicy,
  validateMissionRecordingSettings,
} from "./mission-recording";

const NOW = new Date("2026-08-31T10:00:00.000Z");

assert.equal(resolveMissionRecordingPolicy(null, NOW).active, false);
assert.equal(resolveMissionRecordingPolicy(null, NOW).inactiveReason, "disabled");

const activeSettings = JSON.stringify({
  callRecordingPolicy: {
    enabled: true,
    activeFrom: "2026-08-30T22:00:00.000Z",
    activeUntil: "2026-09-07T21:59:59.999Z",
    mode: "agent_only",
  },
});
const active = resolveMissionRecordingPolicy(activeSettings, NOW);
assert.equal(active.active, true);
assert.equal(active.mode, "agent_only");
assert.equal(active.timezone, "Europe/Bratislava");

assert.equal(resolveMissionRecordingPolicy({
  callRecordingPolicy: { enabled: true, mode: "both", activeFrom: "2026-09-01T00:00:00Z" },
}, NOW).inactiveReason, "not_started");

assert.equal(resolveMissionRecordingPolicy({
  callRecordingPolicy: { enabled: true, mode: "both", activeUntil: "2026-08-30T00:00:00Z" },
}, NOW).inactiveReason, "expired");

assert.equal(validateMissionRecordingSettings({
  callRecordingPolicy: { enabled: true, mode: "agent_only", activeUntil: "not-a-date" },
}), "Invalid Mission call recording activeUntil");

assert.equal(validateMissionRecordingSettings({
  callRecordingPolicy: {
    enabled: true,
    mode: "both",
    activeFrom: "2026-09-02T00:00:00Z",
    activeUntil: "2026-09-01T00:00:00Z",
  },
}), "Mission call recording activeUntil must be after activeFrom");

assert.deepEqual(getMissionRecordingPolicy({
  callRecordingPolicy: { enabled: true, mode: "invalid", customerMask: "raw" },
}), {
  enabled: true,
  activeFrom: null,
  activeUntil: null,
  mode: "both",
  customerMask: "soft_tone",
  timezone: "Europe/Bratislava",
});

console.log("mission-recording tests passed");