import test from "node:test";
import assert from "node:assert/strict";
import {
  hasForwardedCallEvidence,
  isMissionCanonicalCall,
  hasMissionCallListSnapshot,
  isMissionInboundOnlyCall,
  markRetryableQueueHandoffFailure,
} from "./mission-call-list-scope";

const campaignId = "mission-sk";
const baseInbound = {
  campaignId: null,
  callLogId: null,
  inboundCallLogId: "inbound-1",
  startedAt: new Date("2026-09-24T10:00:00.000Z"),
  assignedAgentId: "agent-1",
  status: "abandoned",
  metadata: { campaignId },
};

test("Mission inbound inclusion requires the exact persisted call-time snapshot", () => {
  assert.equal(hasMissionCallListSnapshot({ campaignId }, campaignId), true);
  assert.equal(hasMissionCallListSnapshot({ campaignId: "other-mission" }, campaignId), false);
  assert.equal(hasMissionCallListSnapshot({}, campaignId), false);
  assert.equal(isMissionInboundOnlyCall({
    inbound: { ...baseInbound, metadata: { campaignId: "other-mission" } },
    canonicalCallLogIds: new Set(),
    filters: { campaignId },
  }), false);
});

test("canonical Mission calls accept exact ID or null-ID linked call-time snapshot only", () => {
  const campaignContactIds = new Set(["contact-1"]);
  const base = {
    campaignId: null,
    campaignContactId: null,
    campaignContactIds,
    requestedCampaignId: campaignId,
  };
  assert.equal(isMissionCanonicalCall({ ...base, campaignId }), true);
  assert.equal(isMissionCanonicalCall({ ...base, linkedInboundExists: true, linkedInboundCampaignId: campaignId }), true);
  assert.equal(isMissionCanonicalCall({ ...base, campaignContactId: "contact-1" }), true);
  assert.equal(isMissionCanonicalCall({
    ...base, campaignContactId: "contact-1", linkedInboundExists: true,
    linkedInboundCampaignId: "other-mission",
  }), false);
  assert.equal(isMissionCanonicalCall({
    ...base, campaignContactId: "contact-1", linkedInboundExists: true,
    linkedInboundCampaignId: null,
  }), false);
  assert.equal(isMissionCanonicalCall({
    ...base, campaignId: "other-mission", linkedInboundExists: true, linkedInboundCampaignId: campaignId,
  }), false);
});

test("inbound-only Mission rows honor direction, date, status, and agent filters", () => {
  const base = { inbound: baseInbound, canonicalCallLogIds: new Set<string>(), filters: { campaignId } };
  assert.equal(isMissionInboundOnlyCall(base), true);
  assert.equal(isMissionInboundOnlyCall({ ...base, filters: { campaignId, direction: "outbound" } }), false);
  assert.equal(isMissionInboundOnlyCall({ ...base, filters: { campaignId, status: "completed" } }), false);
  assert.equal(isMissionInboundOnlyCall({ ...base, filters: { campaignId, agentId: "agent-2" } }), false);
  assert.equal(isMissionInboundOnlyCall({
    ...base,
    filters: { campaignId, dateFrom: new Date("2026-09-24T10:00:01.000Z") },
  }), false);
  assert.equal(isMissionInboundOnlyCall({
    ...base,
    filters: { campaignId, dateToExclusive: new Date("2026-09-24T09:59:59.000Z") },
  }), false);
});

test("canonical call links deduplicate inbound-only rows", () => {
  assert.equal(isMissionInboundOnlyCall({
    inbound: { ...baseInbound, callLogId: "canonical-1" },
    canonicalCallLogIds: new Set(),
    filters: { campaignId },
  }), false);
  assert.equal(isMissionInboundOnlyCall({
    inbound: baseInbound,
    canonicalCallLogIds: new Set(["inbound-1"]),
    filters: { campaignId },
  }), false);
});

test("failed forward handoff is hidden so a later abandon/timeout is reported once", () => {
  const failedAttemptMetadata = markRetryableQueueHandoffFailure({ queueForwarded: true });
  assert.equal(isMissionCanonicalCall({
    campaignId,
    campaignContactId: "contact-1",
    campaignContactIds: new Set(["contact-1"]),
    requestedCampaignId: campaignId,
    metadata: failedAttemptMetadata,
  }), false);

  for (const terminalStatus of ["abandoned", "timeout"]) {
    const retriedInbound = {
      ...baseInbound,
      callLogId: null,
      status: terminalStatus,
      metadata: { campaignId },
    };
    assert.equal(isMissionInboundOnlyCall({
      inbound: retriedInbound,
      canonicalCallLogIds: new Set(),
      filters: { campaignId, status: terminalStatus },
    }), true);
  }
});

test("forwarded marker accepts canonical and persisted inbound forwarding evidence", () => {
  assert.equal(hasForwardedCallEvidence({ isForwarded: true }), true);
  assert.equal(hasForwardedCallEvidence({ status: "forwarded" }), true);
  assert.equal(hasForwardedCallEvidence({ inboundStatus: "forwarded" }), true);
  assert.equal(hasForwardedCallEvidence({ inboundTransferredTo: "+421900000000" }), true);
  assert.equal(hasForwardedCallEvidence({ inboundMetadata: { standingForward: true } }), true);
  assert.equal(hasForwardedCallEvidence({ metadata: '{"queueForwarded":true}' }), true);
  assert.equal(hasForwardedCallEvidence({ metadata: {} }), false);
});