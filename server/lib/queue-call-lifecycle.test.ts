import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalCampaignId,
  canClaimStandingRecordingRecovery,
  completedCanonicalCallValues,
  failedQueueForwardHandoffReset,
  finalizeCanonicalLifecycle,
  standingForwardUserId,
  inboundQueueForwardedRecordingAllowed,
  isTrustedStandingRecording,
  standingRecordingRecoveryDelayMs,
  shouldRecoverStandingRecording,
} from "./queue-call-lifecycle";
import { resolveMissionRecordingPolicy } from "@shared/mission-recording";
import { isMissionCanonicalCall, isMissionInboundOnlyCall } from "./mission-call-list-scope";

test("standing answer attributes the real user and preserves queued Mission", () => {
  assert.equal(standingForwardUserId("standing:user-42"), "user-42");
  assert.equal(canonicalCampaignId("mission-7", null), "mission-7");
  assert.equal(canonicalCampaignId(undefined, "mission-channel"), "mission-channel");
  assert.throws(() => canonicalCampaignId("mission-7", "mission-other"), /Mission IDs conflict/);
});

test("failed external handoff detaches retryable attempt and reports later abandon/timeout", () => {
  const reset = failedQueueForwardHandoffReset(
    { campaignId: "mission-7", queueForwarded: true },
    new Date("2026-09-24T10:00:05.000Z"),
  );
  assert.equal(reset.callLog.status, "failed");
  assert.equal(reset.callLog.inboundCallLogId, null);
  assert.equal(reset.inboundCall.callLogId, null);
  assert.equal(reset.inboundCall.status, "queued");
  assert.equal(isMissionCanonicalCall({
    campaignId: "mission-7",
    campaignContactId: "contact-1",
    campaignContactIds: new Set(["contact-1"]),
    requestedCampaignId: "mission-7",
    metadata: reset.callLog.metadata,
  }), false);

  for (const status of ["abandoned", "timeout"]) {
    assert.equal(isMissionInboundOnlyCall({
      inbound: {
        campaignId: null,
        callLogId: reset.inboundCall.callLogId,
        inboundCallLogId: "inbound-1",
        startedAt: new Date("2026-09-24T10:00:00.000Z"),
        assignedAgentId: null,
        status,
        metadata: { campaignId: "mission-7" },
      },
      canonicalCallLogIds: new Set(),
      filters: { campaignId: "mission-7", status },
    }), true);
  }
});

test("queue recording off still permits canonical lifecycle", () => {
  assert.equal(inboundQueueForwardedRecordingAllowed({
    recordCalls: false, campaignId: null, recordingPolicySnapshot: null,
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

test("inbound queue setting authorizes non-Mission recording and Mission mixed capture only", () => {
  const missionBoth = resolveMissionRecordingPolicy({ callRecordingPolicy: { enabled: true, mode: "both" } });
  const missionAgentOnly = resolveMissionRecordingPolicy({ callRecordingPolicy: { enabled: true, mode: "agent_only" } });
  const missionOff = resolveMissionRecordingPolicy({ callRecordingPolicy: { enabled: false, mode: "both" } });
  assert.equal(inboundQueueForwardedRecordingAllowed({
    recordCalls: true, campaignId: null, recordingPolicySnapshot: null,
  }), true);
  assert.equal(inboundQueueForwardedRecordingAllowed({
    recordCalls: false, campaignId: null, recordingPolicySnapshot: null,
  }), false);
  assert.equal(inboundQueueForwardedRecordingAllowed({
    recordCalls: true, campaignId: "mission-7", recordingPolicySnapshot: null,
  }), false);
  assert.equal(inboundQueueForwardedRecordingAllowed({
    recordCalls: true, campaignId: "mission-7", recordingPolicySnapshot: missionOff,
  }), false);
  assert.equal(inboundQueueForwardedRecordingAllowed({
    recordCalls: true, campaignId: "mission-7", recordingPolicySnapshot: missionAgentOnly,
  }), false);
  assert.equal(inboundQueueForwardedRecordingAllowed({
    recordCalls: true, campaignId: "mission-7", recordingPolicySnapshot: missionBoth,
  }), true);
  // A later null ARI read cannot turn an earlier classification failure into
  // proof that a queue with a Mission-specific policy is non-Mission.
  assert.equal(inboundQueueForwardedRecordingAllowed({
    recordCalls: true, campaignId: null, recordingPolicySnapshot: null, classificationVerified: false,
  }), false);
  assert.equal(inboundQueueForwardedRecordingAllowed({
    recordCalls: false, campaignId: "mission-7", recordingPolicySnapshot: missionBoth,
  }), false);
});

test("standing queue recording authorizes non-Mission mixed audio but obeys Mission call-time policy", () => {
  const identity = { host: "pbx.example", port: 8088 };
  const name = "mobile_call-42_standing_1710000000000";
  const nonMission = {
    authorized: true,
    recordingName: name,
    state: "recording" as const,
    campaignId: null,
    recordingPolicySnapshot: null,
    pbxIdentity: identity,
  };
  const allowed = (authorization: typeof nonMission) => isTrustedStandingRecording({
    callLogId: "call-42", recordingName: name, standingForward: true,
    authorization, currentPbxIdentity: identity,
  });
  assert.equal(allowed(nonMission), true);
  assert.equal(allowed({ ...nonMission, authorized: false }), false);
  assert.equal(allowed({
    ...nonMission, campaignId: "mission-1",
  }), false);
  assert.equal(allowed({
    ...nonMission, campaignId: "mission-1",
    recordingPolicySnapshot: resolveMissionRecordingPolicy({ callRecordingPolicy: { enabled: false, mode: "both" } }),
  }), false);
  assert.equal(allowed({
    ...nonMission, campaignId: "mission-1",
    recordingPolicySnapshot: resolveMissionRecordingPolicy({ callRecordingPolicy: { enabled: true, mode: "agent_only" } }),
  }), false);
  assert.equal(allowed({
    ...nonMission, campaignId: "mission-1",
    recordingPolicySnapshot: resolveMissionRecordingPolicy({ callRecordingPolicy: { enabled: true, mode: "both" } }),
  }), true);
});

test("standing recording recovery requires persisted call identity and exact PBX", () => {
  const identity = { host: "pbx.example", port: 8088 };
  const authorization = {
    authorized: true,
    recordingName: "mobile_call-42_standing_1710000000000",
    state: "stop_requested" as const,
    campaignId: null,
    recordingPolicySnapshot: null,
    pbxIdentity: identity,
  };
  const input = {
    callLogId: "call-42",
    recordingName: authorization.recordingName,
    standingForward: true,
    authorization,
    currentPbxIdentity: identity,
  };
  assert.equal(isTrustedStandingRecording(input), true);
  assert.equal(isTrustedStandingRecording({ ...input, standingForward: false }), false);
  assert.equal(isTrustedStandingRecording({
    ...input, currentPbxIdentity: { host: "other-pbx.example", port: 8088 },
  }), false);
  assert.equal(isTrustedStandingRecording({
    ...input, recordingName: "mobile_someone-else_standing_1710000000000",
  }), false);
  assert.equal(isTrustedStandingRecording({
    ...input, authorization: { ...authorization, state: "saved" },
  }), false);
});

test("standing recording recovery is limited to a just-ended call and retryable recording states", () => {
  const now = new Date("2026-08-01T12:00:00Z");
  assert.equal(shouldRecoverStandingRecording({
    callStatus: "completed", endedAt: new Date("2026-08-01T11:59:59Z"),
    recordingState: "stop_requested", now,
  }), true);
  assert.equal(shouldRecoverStandingRecording({
    callStatus: "answered", endedAt: now, recordingState: "recording", now,
  }), false);
  assert.equal(shouldRecoverStandingRecording({
    callStatus: "completed", endedAt: now, recordingState: "saved", now,
  }), false);
  assert.equal(shouldRecoverStandingRecording({
    callStatus: "completed", endedAt: new Date("2026-07-20T12:00:00Z"),
    recordingState: "recording", now,
  }), false);
});

test("standing recording recovery backs off but remains outage-tolerant", () => {
  assert.equal(standingRecordingRecoveryDelayMs(0), 15_000);
  assert.equal(standingRecordingRecoveryDelayMs(1), 30_000);
  assert.equal(standingRecordingRecoveryDelayMs(100), 5 * 60_000);
});

test("recovery excludes saved rows before bounded paging and honors atomic-claim leases", () => {
  const now = new Date("2026-08-01T12:00:00Z");
  const base = {
    authorized: true,
    campaignId: null,
    recordingPolicySnapshot: null,
    pbxIdentity: { host: "pbx.example", port: 8088 },
  };
  const savedAhead = Array.from({ length: 600 }, () => ({
    callStatus: "completed",
    endedAt: new Date(now.getTime() - 1000),
    authorization: { ...base, state: "saved" as const },
  }));
  const recoverable = {
    callStatus: "completed",
    endedAt: new Date(now.getTime() - 1000),
    authorization: { ...base, state: "recording" as const },
  };
  const candidates = [...savedAhead, recoverable].filter(row =>
    canClaimStandingRecordingRecovery({ ...row, now }),
  );
  assert.deepEqual(candidates, [recoverable]);
  assert.equal(canClaimStandingRecordingRecovery({
    callStatus: "completed",
    endedAt: recoverable.endedAt,
    authorization: {
      ...base, state: "saving", claimToken: "worker-a",
      claimUntil: new Date(now.getTime() + 60_000).toISOString(),
    },
    now,
  }), false);
  assert.equal(canClaimStandingRecordingRecovery({
    callStatus: "completed",
    endedAt: recoverable.endedAt,
    authorization: {
      ...base, state: "saving", claimToken: "stale-worker",
      claimUntil: new Date(now.getTime() - 1).toISOString(),
    },
    now,
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