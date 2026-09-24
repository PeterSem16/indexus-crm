import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCallRecordingChunk,
  bindCallRecordingLog,
  createSequentialCallLogPatchQueue,
  createCallRecordingBinding,
  isCurrentCallSession,
  recordingBindingMatchesCall,
  resolveForceResetCallLogId,
  resolveSessionRecordingAuthority,
} from "./call-recording-identity";

const makeIdentity = (customerName: string, phoneNumber: string) => ({
  customerName,
  customerId: `customer-${customerName}`,
  phoneNumber,
  direction: "outbound" as const,
  recordingSnapshot: { active: true, mode: "both" },
});

test("rapid calls retain their own identity and chunks", () => {
  const callA = createCallRecordingBinding(makeIdentity("Customer A", "111"), "log-a");
  const callB = createCallRecordingBinding(makeIdentity("Customer B", "222"), "log-b");
  appendCallRecordingChunk(callA, new Blob(["audio-a"]));
  appendCallRecordingChunk(callB, new Blob(["audio-b"]));

  assert.equal(callA.identity.customerName, "Customer A");
  assert.equal(callB.identity.customerName, "Customer B");
  assert.equal(callA.chunks.length, 1);
  assert.equal(callB.chunks.length, 1);
  assert.equal(recordingBindingMatchesCall(callA, "log-a"), true);
  assert.equal(recordingBindingMatchesCall(callA, "log-b"), false);
});

test("delayed recorder stop remains bound to its original call", () => {
  const callA = createCallRecordingBinding(makeIdentity("Customer A", "111"));
  const callB = createCallRecordingBinding(makeIdentity("Customer B", "222"), "log-b");
  assert.equal(bindCallRecordingLog(callA, "log-a"), true);
  appendCallRecordingChunk(callA, new Blob(["late-audio-a"]));
  appendCallRecordingChunk(callB, new Blob(["audio-b"]));

  // Call A's asynchronous onstop runs after call B has already started.
  assert.equal(recordingBindingMatchesCall(callA, "log-a"), true);
  assert.equal(recordingBindingMatchesCall(callA, "log-b"), false);
  assert.equal(callA.identity.customerName, "Customer A");
  assert.equal(callA.chunks[0].size, 12);
  assert.equal(callB.identity.customerName, "Customer B");
  assert.equal(callB.chunks[0].size, 7);
  assert.equal(bindCallRecordingLog(callA, "log-b"), false);
});

test("force reset retains trusted policy and call id without browser recorder", () => {
  const callLogId = "a11ce000-1111-4aaa-8bbb-222222222222";
  const authority = {
    callLogId,
    recordingSnapshot: { active: true, mode: "agent_only" },
    identity: makeIdentity("Customer A", "111"),
  };
  const resolved = resolveSessionRecordingAuthority(authority);
  assert.equal(resolveForceResetCallLogId(authority, undefined), callLogId);
  assert.equal(resolved.callLogId, callLogId);
  assert.deepEqual(resolved.recordingSnapshot, { active: true, mode: "agent_only" });
  assert.equal(resolved.recordingSnapshot?.mode, "agent_only");
});

test("late inbound A response cannot write active B global call state", () => {
  const sessionA = { id: "A" };
  const sessionB = { id: "B" };
  assert.equal(isCurrentCallSession(sessionA, sessionB), false);
  assert.equal(isCurrentCallSession(sessionB, sessionB), true);
});

test("inbound answered and terminal patches stay ordered when answer resolves late", async () => {
  type Patch = { status: "answered" | "completed" };
  const appliedStatuses: Patch["status"][] = [];
  let releaseAnswered!: () => void;
  const answeredGate = new Promise<void>(resolve => { releaseAnswered = resolve; });
  const enqueuePatch = createSequentialCallLogPatchQueue<Patch>(async patch => {
    if (patch.status === "answered") await answeredGate;
    appliedStatuses.push(patch.status);
  });

  const answerRequest = enqueuePatch({ status: "answered" });
  const terminalRequest = enqueuePatch({ status: "completed" });
  releaseAnswered();
  await Promise.all([answerRequest, terminalRequest]);

  assert.deepEqual(appliedStatuses, ["answered", "completed"]);
});