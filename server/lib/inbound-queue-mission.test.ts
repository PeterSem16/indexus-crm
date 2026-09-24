import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveInboundQueueMission,
  resolveInboundQueueOverflowMission,
} from "./inbound-queue-mission";

test("inbound queue Mission uses the queue snapshot if PBX variable is absent", () => {
  assert.deepEqual(resolveInboundQueueMission({
    queueCampaignId: "mission-1",
    channelCampaignId: null,
  }), { campaignId: "mission-1", conflict: false });
});

test("explicit PBX Mission is retained when the queue has no Mission", () => {
  assert.deepEqual(resolveInboundQueueMission({
    queueCampaignId: null,
    channelCampaignId: "mission-1",
  }), { campaignId: "mission-1", conflict: false });
});

test("matching queue and PBX Missions resolve consistently", () => {
  assert.deepEqual(resolveInboundQueueMission({
    queueCampaignId: "mission-1",
    channelCampaignId: "mission-1",
  }), { campaignId: "mission-1", conflict: false });
});

test("conflicting trusted queue and PBX Mission IDs fail closed", () => {
  assert.deepEqual(resolveInboundQueueMission({
    queueCampaignId: "mission-1",
    channelCampaignId: "mission-2",
  }), { campaignId: null, conflict: true });
});

test("overflow from Mission A to Mission B preserves A and marks recording unsafe", () => {
  const result = resolveInboundQueueOverflowMission({
    sourceCampaignId: "mission-a",
    targetQueueCampaignId: "mission-b",
    channelCampaignId: "mission-a",
    targetClassificationVerified: true,
  });
  assert.deepEqual(result, {
    campaignId: "mission-a",
    conflict: true,
    unverified: false,
  });
});

test("overflow within the same Mission preserves verified attribution", () => {
  assert.deepEqual(resolveInboundQueueOverflowMission({
    sourceCampaignId: "mission-a",
    targetQueueCampaignId: "mission-a",
    channelCampaignId: "mission-a",
    targetClassificationVerified: true,
  }), {
    campaignId: "mission-a",
    conflict: false,
    unverified: false,
  });
});

test("verified unscoped call can adopt the target queue Mission on overflow", () => {
  assert.deepEqual(resolveInboundQueueOverflowMission({
    sourceCampaignId: null,
    targetQueueCampaignId: "mission-b",
    channelCampaignId: null,
    targetClassificationVerified: true,
  }), {
    campaignId: "mission-b",
    conflict: false,
    unverified: false,
  });
});

test("unverified overflow keeps an unscoped call unattributed", () => {
  assert.deepEqual(resolveInboundQueueOverflowMission({
    sourceCampaignId: null,
    targetQueueCampaignId: "mission-b",
    channelCampaignId: null,
    targetClassificationVerified: false,
  }), {
    campaignId: null,
    conflict: false,
    unverified: true,
  });
});

test("unverified source cannot be attributed to a later overflow queue", () => {
  assert.deepEqual(resolveInboundQueueOverflowMission({
    sourceCampaignId: null,
    sourceUnverified: true,
    targetQueueCampaignId: "mission-b",
    channelCampaignId: "mission-b",
    targetClassificationVerified: true,
  }), {
    campaignId: null,
    conflict: false,
    unverified: true,
  });
});

test("target queue and PBX Mission conflict preserves the source and blocks recording", () => {
  assert.deepEqual(resolveInboundQueueOverflowMission({
    sourceCampaignId: "mission-a",
    targetQueueCampaignId: "mission-b",
    channelCampaignId: "mission-c",
    targetClassificationVerified: true,
  }), {
    campaignId: "mission-a",
    conflict: true,
    unverified: false,
  });
});