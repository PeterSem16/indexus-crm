import assert from "node:assert/strict";
import test from "node:test";
import { assertForwardedPbxIdentity, createForwardedAnalysisDispatcher, runForwardedSweep } from "./forwarded-call-reconciliation";
import { resolveMissionRecordingPolicy } from "@shared/mission-recording";
import { reconcileForwardedEvidence, type ForwardedCallEvidence } from "./forwarded-call-evidence";
import type { ForwardedCelEvent } from "./forwarded-cel-source";

test("PBX identity permits fresh credentials but rejects host/port changes and unknown legacy identity", () => {
  const row = { pbxHost: "pbx.example", pbxSshPort: 22 };
  assert.doesNotThrow(() => assertForwardedPbxIdentity(row, { host: "PBX.EXAMPLE", sshPort: 22 }));
  assert.throws(() => assertForwardedPbxIdentity(row, { host: "other.example", sshPort: 22 }), /identity/);
  assert.throws(() => assertForwardedPbxIdentity(row, { host: "pbx.example", sshPort: 2222 }), /identity/);
  assert.throws(() => assertForwardedPbxIdentity({ pbxHost: null, pbxSshPort: null }, { host: "pbx.example", sshPort: 22 }), /identity/);
});

test("empty durable backlog performs no SSH reads", async () => {
  let reads = 0;
  await runForwardedSweep({
    pending: async () => [], read: async () => { reads++; return []; },
    reconcile: async () => { assert.fail("no rows"); },
    failed: async () => { assert.fail("no failure"); },
  });
  assert.equal(reads, 0);
});

test("many durable rows share one source read and failures do not prevent other rows", async () => {
  let reads = 0;
  const reconciled: number[] = [];
  const failed: number[] = [];
  await runForwardedSweep({
    pending: async () => [1, 2, 3],
    read: async () => { reads++; return []; },
    reconcile: async row => { if (row === 2) throw new Error("retry"); reconciled.push(row); },
    failed: async row => { failed.push(row); },
  });
  assert.equal(reads, 1);
  assert.deepEqual(reconciled, [1, 3]);
  assert.deepEqual(failed, [2]);
});

test("source outage preserves durable evidence for a fresh worker's replay", async () => {
  const transfer = new Date("2026-06-01T12:00:00Z");
  let durable: ForwardedCallEvidence | null = null;
  const end: ForwardedCelEvent = {
    eventType: "HANGUP", eventTime: "2026-06-01T12:00:30.250Z",
    uniqueId: "root", linkedId: "root", channel: "PJSIP/root",
    peer: "", application: "", extra: '{"dialstatus":"BUSY"}',
  };
  let failures = 0;
  const store = {
    pending: async () => ["root"],
    reconcile: async (root: string, events: ForwardedCelEvent[]) => {
      durable = reconcileForwardedEvidence(root, transfer, durable, events);
    },
    failed: async () => { failures++; },
  };
  await runForwardedSweep({ ...store, read: async () => { throw new Error("SSH outage"); } });
  assert.equal(durable, null);
  assert.equal(failures, 1);
  await runForwardedSweep({ ...store, read: async () => [end] });
  assert.equal((durable as ForwardedCallEvidence | null)?.status, "busy");
  const persisted = JSON.stringify(durable);
  await runForwardedSweep({ ...store, read: async () => [end, end] });
  assert.equal(JSON.stringify(durable), persisted);
});

const publication = {
  recordingId: "qfwd_handoff",
  filePath: "/recordings/qfwd_handoff.wav",
  handoff: {
    id: "handoff", status: "completed", recordingState: "saved",
    recordingAuthorized: true, campaignId: null, recordingPolicySnapshot: null,
  },
};

test("published forwarding analysis invokes existing pipeline once during duplicate delivery", async () => {
  let runs = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const dispatch = createForwardedAnalysisDispatcher(async (id, filePath) => {
    assert.equal(id, publication.recordingId);
    assert.equal(filePath, publication.filePath);
    runs++;
    await gate;
  }, () => assert.fail("analysis succeeded"));
  const first = dispatch(publication);
  await dispatch(publication);
  assert.equal(runs, 1);
  release();
  await first;
});

test("fresh dispatcher resumes durable saved-but-pending publication without creating a recording", async () => {
  const saved = JSON.parse(JSON.stringify(publication));
  let analyzed: string | null = null;
  const restarted = createForwardedAnalysisDispatcher(async id => { analyzed = id; }, () => assert.fail("analysis succeeded"));
  await restarted(saved);
  assert.equal(analyzed, publication.recordingId);
  assert.deepEqual(saved, publication);
});

test("analysis failure is isolated and immutable snapshot authorization remains fail-closed", async () => {
  let analyses = 0;
  let failures = 0;
  const dispatch = createForwardedAnalysisDispatcher(async () => {
    analyses++;
    throw new Error("AI unavailable");
  }, () => { failures++; });
  await dispatch(publication);
  assert.equal(failures, 1);
  assert.equal(publication.handoff.status, "completed");
  await dispatch({ ...publication, handoff: { ...publication.handoff, recordingAuthorized: false } });
  await dispatch({ ...publication, handoff: { ...publication.handoff, recordingState: "pending" } });
  await dispatch({ ...publication, handoff: { ...publication.handoff, campaignId: "mission" } });
  await dispatch({ ...publication, recordingId: "unrelated" });
  const agentOnly = resolveMissionRecordingPolicy({ callRecordingPolicy: { enabled: true, mode: "agent_only" } });
  await dispatch({ ...publication, handoff: {
    ...publication.handoff, campaignId: "mission", recordingPolicySnapshot: agentOnly,
  } });
  assert.equal(analyses, 1);
});