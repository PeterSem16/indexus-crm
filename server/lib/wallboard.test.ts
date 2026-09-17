import assert from "node:assert/strict";
import test from "node:test";
import {
  canReadWallboardCampaign,
  deriveWallboardAgentState,
  matchesWallboardPresence,
  selectAuthorizedWallboardQueueCalls,
} from "./wallboard-policy";

test("wallboard country access intersects workspace and assigned countries", () => {
  const base = {
    role: "manager",
    campaignCountries: ["CZ"],
    isCampaignMember: false,
  } as const;
  assert.equal(canReadWallboardCampaign({
    ...base, assignedCountries: ["SK", "CZ"], workspaceCountries: ["SK"],
  }), false);
  assert.equal(canReadWallboardCampaign({
    ...base, assignedCountries: ["SK", "CZ"], workspaceCountries: ["SK", "CZ"],
  }), true);
});

test("empty country scope requires explicit campaign membership", () => {
  const base = {
    role: "user",
    assignedCountries: [],
    workspaceCountries: [],
    campaignCountries: ["SK"],
  } as const;
  assert.equal(canReadWallboardCampaign({ ...base, isCampaignMember: false }), false);
  assert.equal(canReadWallboardCampaign({ ...base, isCampaignMember: true }), true);
  assert.equal(canReadWallboardCampaign({ ...base, role: "admin", isCampaignMember: false }), true);
  assert.equal(canReadWallboardCampaign({
    ...base, assignedCountries: ["SK"], workspaceCountries: ["CZ"], isCampaignMember: true,
  }), false);
});

test("agent state precedence is live call, ring, break, work, available", () => {
  const common = {
    connected: true,
    inboundCallingSince: null,
    inboundRingingSince: null,
    outboundCallingSince: "2024-01-01T10:00:00.000Z",
    outboundRingingSince: "2024-01-01T09:59:00.000Z",
    breakSince: "2024-01-01T09:00:00.000Z",
    workingSince: "2024-01-01T08:00:00.000Z",
    availableSince: "2024-01-01T07:00:00.000Z",
  };
  assert.deepEqual(deriveWallboardAgentState(common), {
    state: "calling",
    stateSince: "2024-01-01T10:00:00.000Z",
    direction: "outbound",
  });
  assert.equal(deriveWallboardAgentState({
    ...common, outboundCallingSince: null,
  }).state, "ringing");
  assert.equal(deriveWallboardAgentState({
    ...common, outboundCallingSince: null, outboundRingingSince: null,
  }).state, "break");
  assert.equal(deriveWallboardAgentState({
    ...common, outboundCallingSince: null, outboundRingingSince: null, breakSince: null,
  }).state, "working");
});

test("disconnected agents are offline and do not expose a generated timestamp", () => {
  assert.deepEqual(deriveWallboardAgentState({
    connected: false,
    availableSince: "2024-01-01T07:00:00.000Z",
    outboundCallingSince: "2024-01-01T10:00:00.000Z",
  }), { state: "offline", stateSince: null, direction: null });
});

test("final queue selection drops null and unauthorized campaign attribution", () => {
  const calls = [
    { id: "good", campaignId: "mission-1", queueId: "q", agentId: null, status: "waiting" as const, since: null },
    { id: "other", campaignId: "mission-2", queueId: "q", agentId: null, status: "talking" as const, since: null },
    { id: "ambiguous", campaignId: null, queueId: "q", agentId: null, status: "ringing" as const, since: null },
  ];
  assert.deepEqual(selectAuthorizedWallboardQueueCalls(calls, new Set(["mission-1"]), null).map((c) => c.id), ["good"]);
  assert.deepEqual(selectAuthorizedWallboardQueueCalls(calls, new Set(["mission-1", "mission-2"]), "mission-2").map((c) => c.id), ["other"]);
});

test("presence must match the newest session and authorized Mission", () => {
  const visible = new Set(["mission-1"]);
  const presence = { sessionId: "session-1", campaignId: "mission-1", working: true };
  assert.equal(matchesWallboardPresence(presence, "session-1", ["mission-1"], visible), true);
  assert.equal(matchesWallboardPresence(presence, "session-old", ["mission-1"], visible), false);
  assert.equal(matchesWallboardPresence(presence, "session-1", ["mission-2"], visible), false);
});