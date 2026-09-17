import assert from "node:assert/strict";
import test from "node:test";
import { projectWallboardQueueCalls } from "./wallboard-queue";

test("queue projection prefers talking, then ringing, over waiting", () => {
  const waitingAt = new Date("2024-01-01T10:00:00.000Z");
  const ringingAt = new Date("2024-01-01T10:01:00.000Z");
  const talkingAt = new Date("2024-01-01T10:02:00.000Z");
  const ringingAgentIds = ["agent-1", "agent-2"];

  assert.deepEqual(projectWallboardQueueCalls({
    waitingCalls: [{
      id: "call-1",
      campaignId: "mission-1",
      queueId: "queue-1",
      enteredAt: waitingAt,
    }],
    assignedCalls: [{
      id: "call-1",
      campaignId: "mission-1",
      queueId: "queue-1",
      agentId: "agent-1",
      agentIds: ringingAgentIds,
      assignedAt: ringingAt,
    }],
    activeBridges: [{
      callId: "call-1",
      campaignId: "mission-1",
      queueId: "queue-1",
      agentId: "agent-1",
      createdAt: talkingAt,
    }],
  }), [{
    id: "call-1",
    campaignId: "mission-1",
    queueId: "queue-1",
    agentId: "agent-1",
    status: "talking",
    since: talkingAt,
  }]);
});

test("ringing targets are copied and talking projection excludes ring-all losers", () => {
  const ringingAgentIds = ["agent-1", "agent-2"];
  const projected = projectWallboardQueueCalls({
    waitingCalls: [],
    assignedCalls: [{
      id: "call-1",
      campaignId: null,
      queueId: "queue-1",
      agentId: "agent-1",
      agentIds: ringingAgentIds,
      assignedAt: new Date("2024-01-01T10:01:00.000Z"),
    }],
    activeBridges: [{
      callId: "call-1",
      campaignId: null,
      queueId: "queue-1",
      agentId: "agent-1",
      createdAt: new Date("2024-01-01T10:02:00.000Z"),
    }],
  });

  assert.equal(projected[0].status, "talking");
  assert.equal("agentIds" in projected[0], false);

  const ringingOnly = projectWallboardQueueCalls({
    waitingCalls: [],
    assignedCalls: [{
      id: "call-2",
      campaignId: null,
      queueId: "queue-1",
      agentId: "agent-1",
      agentIds: ringingAgentIds,
      assignedAt: new Date("2024-01-01T10:01:00.000Z"),
    }],
    activeBridges: [],
  });
  assert.deepEqual(ringingOnly[0].agentIds, ringingAgentIds);
  assert.notEqual(ringingOnly[0].agentIds, ringingAgentIds);
  ringingOnly[0].agentIds!.push("agent-3");
  assert.deepEqual(ringingAgentIds, ["agent-1", "agent-2"]);
});

test("queue projection preserves null attribution and does not mutate inputs", () => {
  const enteredAt = new Date("2024-01-01T10:00:00.000Z");
  const assignedAt = new Date("2024-01-01T10:01:00.000Z");
  const waiting = {
    id: "waiting-call",
    campaignId: null,
    queueId: "queue-1",
    enteredAt,
  };
  const assigned = {
    id: "ringing-call",
    queueId: "queue-2",
    agentId: "agent-2",
    assignedAt,
  };
  const input = {
    waitingCalls: [waiting],
    assignedCalls: [assigned],
    activeBridges: [{
      callId: "talking-call",
      queueId: "queue-3",
      agentId: "agent-3",
      createdAt: null,
    }],
  };

  const projected = projectWallboardQueueCalls(input);

  assert.deepEqual(projected, [
    {
      id: "waiting-call",
      campaignId: null,
      queueId: "queue-1",
      agentId: null,
      status: "waiting",
      since: enteredAt,
    },
    {
      id: "ringing-call",
      campaignId: null,
      queueId: "queue-2",
      agentId: "agent-2",
      status: "ringing",
      since: assignedAt,
    },
    {
      id: "talking-call",
      campaignId: null,
      queueId: "queue-3",
      agentId: "agent-3",
      status: "talking",
      since: null,
    },
  ]);
  assert.notEqual(projected[0].since, enteredAt);
  assert.notEqual(projected[1].since, assignedAt);
  assert.equal(waiting.enteredAt, enteredAt);
  assert.equal(assigned.assignedAt, assignedAt);
});