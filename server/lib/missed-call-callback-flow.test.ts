import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import test from "node:test";
import ts from "typescript";
import { eq } from "drizzle-orm";
import { campaigns, insertCallLogSchema } from "@shared/schema";
import { resolveMissionRecordingPolicy } from "@shared/mission-recording";
import { selectedMissedCallbackSource } from "@shared/missed-call-callback";
import { authorizeMissedCallback, MissedCallbackError } from "./missed-call-callback";

const ids = {
  source: "11111111-1111-4111-8111-111111111111",
  mission: "22222222-2222-4222-8222-222222222222",
  person: "33333333-3333-4333-8333-333333333333",
  queue: "44444444-4444-4444-8444-444444444444",
  agent: "55555555-5555-4555-8555-555555555555",
};
const source = {
  callId: ids.source, campaignId: ids.mission, queueId: ids.queue, status: "abandoned",
  callerNumber: "+421912345678", activeCampaignId: ids.mission, activeCampaignIds: [ids.mission],
  activeQueueIds: [ids.queue], countries: ["SK"], queueMember: true, missionAssigned: true,
};
const person = { country_code: "SK", first_name: "Test", last_name: "Person", mobile: "0912345678", is_active: true };

function evidenceConnection(patch: Record<string, unknown> = {}, entityPatch: Record<string, unknown> = {}) {
  let reads = 0;
  return {
    execute: async () => ({ rows: reads++ === 0 ? [{ ...source, ...patch }] : [{ ...person, ...entityPatch }] }),
  } as unknown as Parameters<typeof authorizeMissedCallback>[1];
}

async function executeCallLog(inputPatch: Record<string, unknown> = {}, sourcePatch: Record<string, unknown> = {}, mode = "both") {
  const file = readFileSync("server/routes.ts", "utf8");
  const start = file.indexOf('  app.post("/api/call-logs",');
  const end = file.indexOf("  // Update a call log", start);
  assert.ok(start > 0 && end > start);
  let handler: any;
  const saved: any[] = [];
  const settings = { callRecordingPolicy: { enabled: true, mode } };
  // Match the real settings format rather than trusting a browser snapshot.
  const snapshot = resolveMissionRecordingPolicy(settings);
  const builder = { from() { return this; }, where() { return this; }, async limit() { return [{ settings }]; } };
  runInNewContext(ts.transpileModule(file.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    app: { post(_path: string, _auth: unknown, fn: unknown) { handler = fn; } }, requireAuth() {},
    authorizeMissedCallback: (input: Parameters<typeof authorizeMissedCallback>[0]) =>
      authorizeMissedCallback(input, evidenceConnection(sourcePatch)),
    MissedCallbackError, db: { select: () => builder }, campaigns, eq, crypto,
    resolveMissionRecordingPolicy, insertCallLogSchema, console: { error() {} },
    storage: { async createCallLog(data: unknown) { saved.push(data); return { ...data as object, id: "canonical-outbound" }; } },
  });
  const sourceId = selectedMissedCallbackSource({
    sourceId: ids.source, campaignId: ids.mission, entityId: ids.person,
    contactType: "collaborator", callerNumber: source.callerNumber,
  }, { campaignId: ids.mission, entityId: ids.person, contactType: "collaborator", phone: "0912345678", country: "SK" });
  const request = {
    session: { user: { id: ids.agent, role: "user", assignedCountries: ["SK"] } },
    body: {
      phoneNumber: "+421912345678", direction: "outbound", status: "initiated",
      customerId: ids.person, customerName: "untrusted label", campaignId: ids.mission,
      campaignContactId: "stale-clinic-enrollment",
      metadata: JSON.stringify({
        contactType: "collaborator", missedCallbackSourceId: sourceId,
        recordingPolicySnapshot: { active: true, mode: "both" },
        missedCallback: { inboundCallLogId: "invented" },
      }), ...inputPatch,
    },
  };
  const result = { status: 200, body: null as any };
  const response = { status(code: number) { result.status = code; return this; }, json(body: unknown) { result.body = body; return this; } };
  await handler(request, response);
  return { ...result, saved, snapshot };
}

test("card → pending SIP identity → real call-log route → person history identity without enrollment", async () => {
  const result = await executeCallLog();
  assert.equal(result.status, 201);
  assert.equal(result.saved.length, 1);
  const log = result.saved[0];
  assert.equal(log.customerId, ids.person);
  assert.equal(log.campaignId, ids.mission);
  assert.ok(!log.campaignContactId);
  assert.ok(!log.inboundCallLogId);
  const metadata = JSON.parse(log.metadata);
  assert.equal(metadata.missedCallback.customerName, "Test Person");
  assert.equal(metadata.contactType, "collaborator");
  assert.equal(metadata.missedCallback.inboundCallLogId, ids.source);
  assert.equal(metadata.missedCallback.queueId, ids.queue);
  const { evaluatedAt: actualAt, ...actualPolicy } = metadata.recordingPolicySnapshot;
  const { evaluatedAt: expectedAt, ...expectedPolicy } = result.snapshot;
  assert.deepEqual(actualPolicy, expectedPolicy);
  assert.ok(Number.isFinite(Date.parse(actualAt)));
});

test("callback uses server agent-only policy and emits a new SIP correlation token", async () => {
  const result = await executeCallLog({}, {}, "agent_only");
  assert.equal(result.status, 201);
  const metadata = JSON.parse(result.saved[0].metadata);
  assert.equal(metadata.recordingPolicySnapshot.mode, "agent_only");
  assert.equal(metadata.recordingPolicySnapshot.active, true);
  assert.equal(typeof result.body.recordingCorrelationToken, "string");
  assert.ok(metadata.recordingCorrelationHash);
  assert.equal(metadata.recordingExpectedPhone, "912345678");
});

test("wrong destination, other Mission and revoked queue/shift cannot create history or reach dialing", async () => {
  for (const [request, sourcePatch] of [
    [{ phoneNumber: "+420912345678" }, {}],
    [{ campaignId: "66666666-6666-4666-8666-666666666666" }, {}],
    [{}, { queueMember: false }], [{}, { activeCampaignIds: [], activeCampaignId: null }],
    [{}, { missionAssigned: false }], [{}, { activeQueueIds: ["different"] }],
  ]) {
    const result = await executeCallLog(request, sourcePatch);
    assert.equal(result.status, 403);
    assert.equal(result.saved.length, 0);
  }
});

test("source authorizer enforces inactive person, card country and international collision", async () => {
  const input = { userId: ids.agent, role: "user", sourceId: ids.source, campaignId: ids.mission,
    entityId: ids.person, contactType: "collaborator", phone: "+421912345678", assignedCountries: ["SK"] };
  await assert.rejects(authorizeMissedCallback(input, evidenceConnection({}, { is_active: false })), /CONTACT_INACTIVE/);
  await assert.rejects(authorizeMissedCallback(input, evidenceConnection({}, { country_code: "CZ" })), /MISSED_CALLBACK_FORBIDDEN/);
  await assert.rejects(authorizeMissedCallback({ ...input, phone: "+420912345678" }, evidenceConnection()), /MISSED_CALLBACK_FORBIDDEN/);
});
