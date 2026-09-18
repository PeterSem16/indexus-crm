import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalCampaignId,
  completedCanonicalCallValues,
  finalizeCanonicalLifecycle,
  standingForwardUserId,
  standingMixedRecordingAllowed,
} from "./queue-call-lifecycle";

test("standing answer attributes the real user and preserves queued Mission", () => {
  assert.equal(standingForwardUserId("standing:user-42"), "user-42");
  assert.equal(canonicalCampaignId("mission-7", null), "mission-7");
  assert.equal(canonicalCampaignId(undefined, "mission-channel"), "mission-channel");
});

test("standing no-recording policy still permits canonical lifecycle", () => {
  assert.equal(standingMixedRecordingAllowed({
    recordCalls: false, campaignId: "mission-7", missionMode: "both",
  }), false);
  assert.deepEqual(completedCanonicalCallValues({
    answeredAt: new Date("2025-01-01T00:00:02Z"),
    endedAt: new Date("2025-01-01T00:00:12Z"),
  }), {
    status: "completed",
    answeredAt: new Date("2025-01-01T00:00:02Z"),
    endedAt: new Date("2025-01-01T00:00:12Z"),
    durationSeconds: 10,
  });
});

test("agent-only Mission never enables mixed standing recording", () => {
  assert.equal(standingMixedRecordingAllowed({
    recordCalls: true, campaignId: "mission-7", missionMode: "agent_only",
  }), false);
  assert.equal(standingMixedRecordingAllowed({
    recordCalls: true, campaignId: "mission-7", missionMode: "both",
  }), true);
});

test("answered bridge finalization is idempotent, including fast hangup", () => {
  const initial = {
    status: "answered" as const,
    answeredAt: new Date("2025-01-01T00:00:00.900Z"),
    endedAt: null,
    durationSeconds: 0,
  };
  const first = finalizeCanonicalLifecycle(initial, new Date("2025-01-01T00:00:01.100Z"));
  assert.equal(first.finalized, true);
  assert.equal(first.state.durationSeconds, 0);
  const duplicate = finalizeCanonicalLifecycle(first.state, new Date("2025-01-01T00:01:00Z"));
  assert.equal(duplicate.finalized, false);
  assert.deepEqual(duplicate.state, first.state);
});

test("logged-in dialplan forward is ended without fabricating mobile answer", () => {
  const endedAt = new Date("2025-01-01T00:00:30Z");
  assert.deepEqual(completedCanonicalCallValues({ answeredAt: null, endedAt }), {
    status: "forwarded",
    endedAt,
    durationSeconds: 0,
  });
  const notAnswered = finalizeCanonicalLifecycle({
    status: "forwarded",
    answeredAt: null,
    endedAt: null,
    durationSeconds: 0,
  }, endedAt);
  assert.equal(notAnswered.finalized, false);
});