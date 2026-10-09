import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, readFileSync as readAudio, rmSync } from "node:fs";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { and, eq, inArray, or } from "drizzle-orm";
import { callLogs, callRecordings, inboundCallLogs } from "@shared/schema";
import { resolveMissionRecordingPolicy } from "@shared/mission-recording";
import {
  inboundQueueForwardedRecordingAllowed, isTrustedStandingRecording, standingRecordingRecoveryDelayMs,
} from "./queue-call-lifecycle";
import { allowedStandingRecordingStates } from "./standing-recording-transitions";

const code = readFileSync("server/lib/queue-engine.ts", "utf8");
function method(from: string, until: string) {
  const start = code.indexOf(from);
  const end = code.indexOf(until, start);
  assert.ok(start > 0 && end > start);
  return code.slice(start, end);
}

async function runForward(mode: "both" | "agent_only", recordCalls: boolean, failDownloadOnce = false, failProofOnce = false) {
  const folder = mkdtempSync(path.join(tmpdir(), "indexus-forward-test-"));
  const order: string[] = [];
  let record: any = null;
  let authorization: any = null;
  let engine: any;
  let downloads = 0;
  let proofFailed = false;
  const snapshot = resolveMissionRecordingPolicy({ callRecordingPolicy: { enabled: true, mode } });
  const canonical: any = {
    id: "canonical", userId: "agent", customerId: "person", campaignId: "mission",
    direction: "inbound", inboundQueueId: "queue", inboundQueueName: "Queue",
    inboundCallLogId: "source", isForwarded: true, durationSeconds: 1,
    metadata: JSON.stringify({ recordingPolicySnapshot: snapshot }),
  };
  const wave = Buffer.alloc(16044);
  wave.write("RIFF", 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(8000, 24); wave.writeUInt32LE(16000, 28);
  wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write("data", 36);
  wave.writeUInt32LE(16000, 40);
  const pbxIdentity = { host: "isolated-test-pbx", port: 8088 };
  const pbx = {
    async createBridge() { order.push("bridge-created"); return { id: "mixing" }; },
    async startBridgeRecording(_id: string, input: any) {
      assert.equal(authorization.authorized, true);
      assert.equal(authorization.recordingName, input.name);
      order.push("recording-started");
    },
    async addChannelToBridge(_id: string, channel: string) { order.push(`joined:${channel}`); },
    getRecordingPbxIdentity() { return pbxIdentity; },
    async getSettings() { return null; },
    async getChannel() { return { name: "test-channel" }; },
    async hangupChannel() { order.push("peer-hangup"); },
    async destroyBridge() {
      order.push("bridge-destroyed");
      // Asterisk can finish automatically before the late stop-state write.
      if (authorization?.authorized) await engine.handleMobileRecordingFinished(authorization.recordingName);
    },
    async stopRecording(name: string) { await engine.handleMobileRecordingFinished(name); },
    async downloadStoredRecording() {
      downloads++;
      if (failDownloadOnce && downloads === 1) throw new Error("isolated transient download failure");
      return wave;
    },
    async deleteStoredRecording() { order.push("pbx-file-deleted"); },
  };
  const builder: any = {
    from(table: unknown) { this.table = table; return this; }, where() { return this; },
    async limit() {
      if (this.table === callLogs) return [canonical];
      if (this.table === callRecordings) return record ? [record] : [];
      return [{ metadata: { standingForward: true, standingForwardRecording: authorization } }];
    },
  };
  const db = {
    select: () => Object.create(builder),
    update: () => ({
      set: () => ({ where: () => ({ async returning() { order.push("answer-persisted"); return [{ id: "source" }]; } }) }),
    }),
    insert: () => ({
      values(value: unknown) { return { async onConflictDoNothing() { if (!record) record = value; order.push("history-audio-linked"); } }; },
    }),
  };
  const Harness = runInNewContext(ts.transpileModule(`class Harness {
    ${method("  private async handleAgentChannelAnswer(", "  async agentAnsweredCall(")}
    ${method("  private async handleActiveBridgeHangup(", "  private async handleChannelDestroyed(")}
    ${method("  async handleMobileRecordingFinished(", "  private async updateStandingRecordingState(")}
  }; Harness;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    db, and, eq, inArray, or, callLogs, callRecordings, inboundCallLogs, randomUUID, Buffer,
    fs, path, STORAGE_PATHS: { callRecordings: folder }, isTrustedStandingRecording,
    inboundQueueForwardedRecordingAllowed, standingRecordingRecoveryDelayMs,
    console: { log() {}, warn() {}, error() {} },
    setTimeout, inboundCallWs: { notifyCallHangup() {} },
    async claimStandingRecordingForSave(input: any) {
      if (!authorization || !["starting", "recording", "stop_requested"].includes(authorization.state)) return false;
      authorization = { ...authorization, state: "saving", claimToken: input.claimToken };
      return true;
    },
  });
  engine = new Harness();
  Object.assign(engine, {
    ariClient: pbx, pendingAgentCalls: new Map(), waitingCalls: new Map(), assignedCalls: new Map(),
    ringAllPending: new Map(), ringAllClaimedCallers: new Set(), activeBridges: new Map(),
    agentStates: new Map(), emit() {}, isStandingId: (id: string) => id.startsWith("standing:"),
    async stopMohForChannel() { order.push("moh-stopped"); },
    async resolveQueuedCallRecordingContext() { return { campaignId: "mission", recordingSnapshot: snapshot, recordCalls }; },
    async ensureStandingCanonicalCallLog() { order.push("canonical-created"); return canonical.id; },
    async persistStandingRecordingAuthorization(_source: string, _log: string, value: unknown) {
      authorization = value; order.push("recording-authorized");
    },
    async updateStandingRecordingState(_source: string, _log: string, _name: string, patch: any, token?: string) {
      if (failProofOnce && !proofFailed && patch.bridgeConnected && !patch.state) {
        proofFailed = true;
        throw new Error("isolated connection-proof write failure");
      }
      if (token && authorization.claimToken !== token) return;
      if (patch.state && !allowedStandingRecordingStates(patch.state, !!token).includes(authorization.state)) return;
      authorization = { ...authorization, ...patch };
    },
    async agentCompletedCall() { canonical.status = "completed"; order.push("canonical-completed"); },
  });
  const pending = {
    callerChannelId: "caller", agentId: "standing:agent", callId: "source", queueId: "queue",
    campaignId: "mission", callerNumber: "+421912345678", enteredAt: new Date(), customerId: "person",
  };
  engine.assignedCalls.set("caller", { call: { campaignId: "mission" }, queue: { id: "queue" }, queueId: "queue" });
  try {
    await engine.handleAgentChannelAnswer("agent-channel", pending);
    const bridge = engine.activeBridges.get("caller");
    assert.ok(bridge);
    assert.ok(!engine.assignedCalls.has("caller"), "answered call is synchronously removed from timeout tracking");
    await engine.handleActiveBridgeHangup(bridge);
    if (failDownloadOnce) await engine.handleMobileRecordingFinished(authorization.recordingName);
    return { order, record: record && { ...record, bytes: readAudio(record.filePath) }, authorization, canonical, downloads };
  } finally { rmSync(folder, { recursive: true, force: true }); }
}

test("real forward handlers authorize → record before joining → finish → download → person/Mission history", async () => {
  const result = await runForward("both", true);
  assert.ok(result.order.indexOf("recording-authorized") < result.order.indexOf("recording-started"));
  assert.ok(result.order.indexOf("recording-started") < result.order.indexOf("joined:caller"));
  assert.ok(result.order.indexOf("recording-started") < result.order.indexOf("joined:agent-channel"));
  assert.equal(result.record.callLogId, "canonical");
  assert.equal(result.record.customerId, "person");
  assert.equal(result.record.campaignId, "mission");
  assert.equal(result.record.direction, "inbound");
  assert.equal(result.record.bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(result.authorization.state, "saved", "late stop must not downgrade an already-saved recording");
  assert.equal(result.downloads, 1, "duplicate finish event must not save twice");
  assert.equal(result.canonical.status, "completed");
});

test("queue opt-out and agent-only policy never produce an unauthorized mixed file", async () => {
  for (const [mode, enabled] of [["both", false], ["agent_only", true]] as const) {
    const result = await runForward(mode, enabled);
    assert.ok(!result.order.includes("recording-started"));
    assert.equal(result.record, null);
    assert.equal(result.authorization.state, "off");
    assert.equal(result.canonical.status, "completed");
  }
});

test("transient download is released for retry and only one durable audio file is linked", async () => {
  const result = await runForward("both", true, true);
  assert.equal(result.authorization.state, "saved");
  assert.ok(result.record);
  assert.equal(result.downloads, 2);
  assert.equal(result.order.filter(step => step === "history-audio-linked").length, 1);
});

test("an optional recording DB failure does not disconnect the conversation and teardown retries its proof", async () => {
  const result = await runForward("both", true, false, true);
  assert.ok(result.order.includes("joined:agent-channel"));
  assert.equal(result.canonical.status, "completed");
  assert.equal(result.authorization.bridgeConnected, true);
  assert.equal(result.authorization.state, "saved");
  assert.ok(result.record);
});
