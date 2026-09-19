import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { QueueEngine } from "./queue-engine";

class FakeAri extends EventEmitter {
  hangups: string[] = [];
  destroyed: string[] = [];
  stopped: string[] = [];
  async hangupChannel(id: string) { this.hangups.push(id); }
  async destroyBridge(id: string) { this.destroyed.push(id); }
  async stopRecording(name: string) { this.stopped.push(name); }
}

test("QueueEngine normalizes duplicate RecordingFinished delivery", async () => {
  const ari = new FakeAri();
  const engine = new QueueEngine(ari as any);
  let saves = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  (engine as any).handleMobileRecordingFinished = async () => {
    saves++;
    await pending;
  };

  const event = {
    type: "RecordingFinished",
    recording: { name: "mobile_call-1_standing_1" },
  };
  ari.emit("recording-finished", event);
  ari.emit("event", event);
  assert.equal(saves, 1);
  release();
  await new Promise(resolve => setImmediate(resolve));
});

test("QueueEngine bridge teardown waits for persistence and finalizes once", async () => {
  const ari = new FakeAri();
  const engine = new QueueEngine(ari as any);
  let ready!: () => void;
  const readyPromise = new Promise<void>((resolve) => { ready = resolve; });
  let finalized = 0;
  (engine as any).agentCompletedCall = async () => { finalized++; };
  const bridge = {
    bridgeId: "bridge-1",
    callerChannelId: "caller-1",
    agentChannelId: "agent-1",
    callId: "call-1",
    agentId: "standing:user-1",
    queueId: "queue-1",
    campaignId: "mission-1",
    createdAt: new Date(),
    recordingName: "mobile_call-1_standing_1",
    ready: readyPromise,
  };
  (engine as any).activeBridges.set("caller-1", bridge);
  (engine as any).activeBridges.set("agent-1", bridge);

  const first = (engine as any).handleActiveBridgeHangup(bridge, "caller");
  const duplicate = (engine as any).handleActiveBridgeHangup(bridge, "agent");
  await duplicate;
  assert.deepEqual(ari.hangups, ["agent-1"]);
  assert.equal(finalized, 0);
  ready();
  await first;
  assert.equal(finalized, 1);
  assert.deepEqual(ari.destroyed, ["bridge-1"]);
  assert.deepEqual(ari.stopped, ["mobile_call-1_standing_1"]);
});

test("direct queue handoff ignores provisional ARI hangup and caller Up", async () => {
  const ari = new FakeAri();
  const engine = new QueueEngine(ari as any);
  (engine as any).directQueueForwardedRoots.add("root");
  const tracking = { answeredAt: null };
  (engine as any).forwardedCallTracking.set("root", tracking);
  (engine as any).assignedCalls.set("root", { agentId: "agent-1" });
  await (engine as any).handleChannelLeftStasis("root");
  await (engine as any).handleChannelDestroyed("root");
  ari.emit("channel-state-change", { channel: { id: "root", state: "Up" } });
  assert.equal(tracking.answeredAt, null);
  assert.equal((engine as any).forwardedCallTracking.get("root"), tracking);
  assert.equal((engine as any).directQueueForwardedRoots.has("root"), true);
  assert.equal((engine as any).assignedCalls.has("root"), true);
});