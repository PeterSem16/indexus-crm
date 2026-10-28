import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as drizzle from "drizzle-orm";
import { callLogs, callRecordings, inboundCallLogs } from "@shared/schema";
import { resolveMissionRecordingPolicy } from "@shared/mission-recording";
import { canAnalyzeStandingRecording, createStandingAnalysisDispatcher, type StandingAnalysisPublication } from "./standing-recording-analysis-policy";

function publication(): StandingAnalysisPublication {
  const policy = resolveMissionRecordingPolicy({ callRecordingPolicy: { enabled: true, mode: "both" } });
  return {
    recording: {
      id: "standing_call", callLogId: "call", campaignId: "mission", filename: "mobile_call_standing_123.wav",
      filePath: "/private/audio.wav", analysisStatus: "pending", recordingMode: "both", recordingPolicySnapshot: policy,
    },
    call: { id: "call", inboundCallLogId: "inbound", campaignId: "mission", status: "completed", isForwarded: true },
    inbound: { id: "inbound", callLogId: "call", metadata: {
      standingForward: true,
      standingForwardRecording: {
        authorized: true, bridgeConnected: true, state: "saved", campaignId: "mission",
        recordingName: "mobile_call_standing_123", recordingPolicySnapshot: policy,
        inboundCallLogId: "inbound", pbxIdentity: { host: "saved-pbx", port: 8088 },
      },
    } },
  };
}

test("published standing recordings are analyzable from saved evidence without a live PBX or queue_forwarded_calls row", () => {
  assert.equal(canAnalyzeStandingRecording(publication()), true);
});

test("analysis fails closed for broken identities, unfinished calls and unauthorized/mixed-policy conflicts", () => {
  const changes: ((row: any) => void)[] = [
    r => r.recording.id = "qfwd_call",
    r => r.recording.callLogId = "other",
    r => r.inbound.callLogId = "other",
    r => r.call.inboundCallLogId = "other",
    r => r.recording.campaignId = "other",
    r => r.call.isForwarded = false,
    r => r.call.status = "answered",
    r => r.recording.analysisStatus = "failed",
    r => r.recording.recordingMode = "agent_only",
    r => r.recording.recordingPolicySnapshot = null,
    r => r.recording.recordingPolicySnapshot.active = false,
    r => r.recording.filename = "other.wav",
    r => r.inbound.metadata.standingForward = false,
    r => r.inbound.metadata.standingForwardRecording.authorized = false,
    r => r.inbound.metadata.standingForwardRecording.state = "saving",
    r => r.inbound.metadata.standingForwardRecording.bridgeConnected = false,
    r => r.inbound.metadata.standingForwardRecording.campaignId = "other",
    r => r.inbound.metadata.standingForwardRecording.inboundCallLogId = "other",
    r => r.inbound.metadata.standingForwardRecording.recordingPolicySnapshot.mode = "agent_only",
    r => r.inbound.metadata.standingForwardRecording.pbxIdentity = null,
    r => r.inbound.metadata.standingForwardRecording.recordingName = "mobile_other_standing_123",
  ];
  for (const change of changes) {
    const row = publication();
    change(row);
    assert.equal(canAnalyzeStandingRecording(row), false, String(change));
  }
});

test("duplicate publications share one analysis; rejected analysis does not mutate audio/history", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started = 0;
  let failed = 0;
  const dispatch = createStandingAnalysisDispatcher(async () => { started++; await gate; throw Error("upstream"); }, () => failed++);
  const row = publication();
  const before = structuredClone(row);
  const pending = dispatch(row);
  await dispatch(row);
  assert.equal(started, 1);
  release();
  await pending;
  assert.equal(failed, 1);
  assert.deepEqual(row, before);
});

test("native recovery worker starts at registration, survives PBX absence and discovers pending audio on its timer", async () => {
  const row = publication();
  let available: StandingAnalysisPublication[] = [row];
  let tick!: () => void;
  let scans = 0;
  const analyzed: string[] = [];
  const chain: any = {};
  for (const name of ["from", "innerJoin", "where", "orderBy"]) chain[name] = () => chain;
  chain.limit = async () => { scans++; return available; };
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync("server/lib/standing-recording-analysis.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, console,
    process: { env: { OPENAI_API_KEY: "test-only-not-a-credential" } },
    setInterval(callback: () => void, ms: number) {
      assert.equal(ms, 30_000); tick = callback; return { unref() {} };
    },
    require(name: string) {
      if (name === "drizzle-orm") return drizzle;
      if (name === "@shared/schema") return { callLogs, callRecordings, inboundCallLogs };
      if (name === "../db") return { db: { select: () => chain } };
      if (name === "./standing-recording-analysis-policy") return { createStandingAnalysisDispatcher };
      throw Error(`Unexpected dependency ${name}`);
    },
  });
  exports.setStandingRecordingAnalyzer(async (id: string) => { analyzed.push(id); row.recording.analysisStatus = "completed"; });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(analyzed, ["standing_call"]);
  available = [publication()];
  tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(scans, 2);
  assert.equal(analyzed.length, 2);
});
