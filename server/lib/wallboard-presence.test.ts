import assert from "node:assert/strict";
import test from "node:test";
import {
  clearWallboardPresence,
  getWallboardPresence,
  updateWallboardPresence,
  WALLBOARD_PRESENCE_TTL_MS,
} from "./wallboard-presence";

test("heartbeats keep changedAt stable while refreshing seenAt and TTL", () => {
  clearWallboardPresence();
  const first = updateWallboardPresence("agent-1", {
    sessionId: "session-1", campaignId: "campaign-1", working: true,
  }, 1_000);
  const heartbeat = updateWallboardPresence("agent-1", {
    sessionId: "session-1", campaignId: "campaign-1", working: true,
  }, 9_000);

  assert.equal(first.changedAt, new Date(1_000).toISOString());
  assert.equal(heartbeat.changedAt, first.changedAt);
  assert.equal(heartbeat.seenAt, new Date(9_000).toISOString());
  assert.deepEqual(getWallboardPresence("agent-1", 28_999), heartbeat);
  assert.equal(getWallboardPresence("agent-1", 29_000), undefined);
});

test("session, campaign, and working transitions update changedAt", () => {
  clearWallboardPresence();
  const started = updateWallboardPresence("agent-2", {
    sessionId: "session-1", campaignId: "campaign-1", working: true,
  }, 10_000);
  const available = updateWallboardPresence("agent-2", {
    sessionId: "session-1", campaignId: "campaign-1", working: false,
  }, 11_000);
  const nextCard = updateWallboardPresence("agent-2", {
    sessionId: "session-1", campaignId: "campaign-2", working: true,
  }, 12_000);

  assert.notEqual(available.changedAt, started.changedAt);
  assert.equal(available.working, false);
  assert.notEqual(nextCard.changedAt, available.changedAt);
  assert.equal(nextCard.campaignId, "campaign-2");
});

test("false state remains available until its own lease expires", () => {
  clearWallboardPresence();
  const available = updateWallboardPresence("agent-3", {
    sessionId: "session-1", campaignId: "campaign-1", working: false,
  }, 20_000);

  assert.deepEqual(getWallboardPresence("agent-3", 20_000 + WALLBOARD_PRESENCE_TTL_MS - 1), available);
  assert.equal(getWallboardPresence("agent-3", 20_000 + WALLBOARD_PRESENCE_TTL_MS), undefined);
});