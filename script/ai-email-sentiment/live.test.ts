import test from "node:test";
import assert from "node:assert/strict";
import { createGatewayPilot } from "./gateway-client";
import { main } from "./live-cli";
import { makePreflight, telemetryState } from "./live-preflight";
import { runSequentialRegression } from "./live-runner";
import { regressionCases } from "./regression-corpus";
import { GATEWAY_URL } from "../../server/lib/ai/settings-policy";
import { EMAIL_MONITORING_PROFILE } from "../../server/lib/ai/email-monitoring-profile";
import { AI_ROUTING_OVERRIDES } from "../../server/config/ai-routing";

const token = "SYNTHETIC_EXISTING_GATEWAY_CREDENTIAL";
const model = "indexus-email-sentiment:4b";
const base = { sentiment: "neutral", hasInappropriateContent: false, hasAngryTone: false,
  hasRudeExpressions: false, wantsConsent: false, wantsToCancel: false,
  doesNotAcceptContract: false, alertLevel: "none", note: "Syntetická slovenská poznámka." };
const telemetry = () => ({ observedAt: new Date().toISOString(), sourceReference: "SYNTHETIC_TELEMETRY",
  available: true, otherServicesHealthy: true, resourceTelemetryAvailable: true,
  criticalResourceAlarm: false, newErrors: 0, newTimeouts: 0, backlog: 0, backlogLimit: 2,
  samples: 20, baselineSamples: 20, p95Ms: 100, baselineP95Ms: 100 });
const windowEvidence = () => ({ checkedAt: new Date().toISOString(), reference: "SYNTHETIC_WINDOW",
  noteContractCompatible: true, startsAt: new Date(Date.now() - 1000).toISOString(),
  endsAt: new Date(Date.now() + 19 * 60_000).toISOString() });
const preflight = () => makePreflight({ discovery: true, routingUnchanged: true,
  telemetry: telemetry(), window: windowEvidence() });
const defaults = () => ({ approved: true, preflight: preflight(), monitor: async () => telemetry(),
  readRoutingSnapshot: async () => ({ version: 1, routes: "SYNTHETIC_UNCHANGED" }),
  wait: async (_ms: number) => {}, onCase: async (_value: unknown) => {} });
function fixture(options: { missingModel?: boolean; status?: number; note?: string; stall?: boolean } = {}) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  let active = 0, peak = 0;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    assert.ok(String(input).startsWith(GATEWAY_URL));
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${token}`);
    calls.push({ url: String(input), init }); active++; peak = Math.max(peak, active);
    try {
      if (String(input).endsWith("health/ready")) return new Response(null, { status: 200 });
      if (String(input).endsWith("v1/models")) return Response.json({ object: "list",
        data: options.missingModel ? [] : [{ id: model }] });
      if (String(input).endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1",
        models: options.missingModel ? [] : [{ id: model, revision: "SYNTHETIC_ONLY",
          operations: ["chat.completions"], inputModalities: ["text"], outputFormats: ["json_object"],
          streaming: false, maxInputTokens: 8192, maxOutputTokens: 300 }] });
      if (options.stall) {
        await new Promise((_resolve, reject) => {
          const abort = () => reject(new Error(token));
          if (init?.signal?.aborted) abort(); else init?.signal?.addEventListener("abort", abort, { once: true });
        });
      }
      if (options.status) return Response.json({ error: token }, { status: options.status });
      const body = JSON.parse(String(init?.body));
      const row = regressionCases.find(row => body.messages.at(-1).content.endsWith(`Content: ${row.content}`));
      if (row?.id === "K12") return Response.json({ error: { code: "review_required", type: "review_required",
        reason_code: "possible_prompt_injection_affected_consent_classification" } }, { status: 422 });
      return Response.json({ id: "SYNTHETIC_NO_MODEL", object: "chat.completion", model,
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant",
          content: JSON.stringify({ ...base, ...row?.expected, ...(options.note ? { note: options.note } : {}) }) } }] });
    } finally { active--; }
  };
  return { calls, peak: () => peak, client: createGatewayPilot({ fetch,
    readConfiguration: () => ({ enabled: true, production: true, replit: false, baseURL: GATEWAY_URL, token }) }) };
}
test("offline preflight never reports real Gateway, telemetry or window verified", async () => {
  const result = await main(["prepare"]);
  assert.equal(result.outcome, "BLOCKED");
  assert.ok("api" in result && result.api === "NOT_VERIFIED");
  assert.equal(result.inferenceAttempts, 0);
  await assert.rejects(main(["preflight"]), /CORPCRM01/);
  await assert.rejects(main(["ports"]), /unknown_command/);
  await assert.rejects(main(["prepare", "--ca-file", "anything"]), /invalid_arguments/);
});
test("same existing API and Bearer mechanism; default gate blocks model POST even after discovery", async () => {
  const f = fixture();
  await assert.rejects(f.client.analyze("synthetic", "synthetic"), /inference_not_authorized/);
  assert.equal(f.calls.length, 0);
  await f.client.inspect();
  assert.equal(f.calls.length, 3); assert.equal(f.client.attempts(), 0);
  assert.deepEqual(f.calls.map(c => c.url), ["health/ready", "v1/models", "indexus/v1/capabilities"].map(p => GATEWAY_URL + p));
  await assert.rejects(f.client.analyze("synthetic", "synthetic"), /inference_not_authorized/);
});
test("unadvertised sentiment model cannot arm inference", async () => {
  const f = fixture({ missingModel: true });
  await assert.rejects(f.client.inspect());
  assert.throws(() => f.client.arm(Date.now() + 60_000), /discovery_required/);
  assert.equal(f.client.attempts(), 0);
});
test("existing analyzer preserves nine fields and note longer than 100 without truncation", async () => {
  const note = "Dlhá slovenská poznámka bez nového limitu. ".repeat(6);
  const f = fixture({ note });
  await f.client.inspect(); f.client.arm(Date.now() + 60_000);
  const result = await f.client.analyze("synthetic", "synthetic");
  assert.equal(Object.keys(result).length, 9);
  assert.equal(result.note, note);
  const body = JSON.parse(String(f.calls.at(-1)!.init!.body));
  assert.equal(body.model, model); assert.equal(body.max_tokens, 300);
  assert.equal(body.temperature, 0.1); assert.equal(body.stream, false);
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.ok(!body.messages[0].content.includes("100 chars"));
});
test("synthetic Gateway: original 18 inputs once, sequentially, real Router/SDK, HTTP states and safe K12 distinct", async () => {
  const f = fixture(), rows: any[] = [], waits: number[] = [];
  await f.client.inspect();
  const result = await runSequentialRegression({ ...defaults(), client: f.client,
    wait: async ms => { waits.push(ms); }, onCase: async value => { rows.push(value); } });
  assert.equal(result.completedCases, 18); assert.equal(result.stopped, null);
  assert.equal(result.inferenceAttempts, 18); assert.equal(f.peak(), 1);
  assert.equal(waits.length, 17); assert.ok(waits.every(n => n === 1000));
  assert.deepEqual(rows.map(r => r.id), regressionCases.map(r => r.id));
  assert.equal(rows[11].analysis.status, "review_required");
  assert.equal(rows[11].evaluation.status, "SAFE_REJECTION");
  assert.equal(rows[11].evaluation.classificationValid, false);
  assert.equal(rows[11].http.at(-1).status, 422);
  assert.ok(rows.every(row => row.businessEffects === 0 && row.noteLanguageReview === "NOT_REVIEWED"));
  const posts = f.calls.filter(c => c.init?.method === "POST");
  for (let i = 0; i < 18; i++) assert.equal(JSON.parse(String(posts[i].init!.body)).messages.at(-1).content,
    `Analyze this email:\n\nSubject: ${regressionCases[i].subject}\n\nContent: ${regressionCases[i].content}`);
  await assert.rejects(f.client.analyze("synthetic", "synthetic"), /inference_not_authorized/);
});
test("missing/stale telemetry, missing resource evidence, new errors, backlog and P95 alarm block safety", () => {
  for (const value of [null, {}, { ...telemetry(), observedAt: "2000-01-01" },
    { ...telemetry(), resourceTelemetryAvailable: false }, { ...telemetry(), newErrors: 1 },
    { ...telemetry(), newTimeouts: 1 }, { ...telemetry(), backlog: 3 }, { ...telemetry(), p95Ms: 121 }])
    assert.equal(telemetryState(value).safe, false);
  assert.equal(telemetryState({ ...telemetry(), samples: 0 }).latencyImpact, "NOT_VERIFIED");
  assert.equal(makePreflight({ discovery: true, routingUnchanged: true }).outcome, "BLOCKED");
});
test("missing approval or telemetry prevents all inference", async () => {
  const f = fixture(); await f.client.inspect();
  await assert.rejects(runSequentialRegression({ ...defaults(), client: f.client, approved: false }), /approved/);
  const result = await runSequentialRegression({ ...defaults(), client: f.client, monitor: async () => null });
  assert.equal(result.completedCases, 0); assert.equal(f.client.attempts(), 0);
});
test("technical HTTP failure has exactly one attempt, no fallback and no vendor/credential echo", async () => {
  const f = fixture({ status: 503 }); await f.client.inspect();
  const rows: unknown[] = [];
  const result = await runSequentialRegression({ ...defaults(), client: f.client,
    onCase: async row => { rows.push(row); } });
  assert.equal(result.completedCases, 1); assert.equal(result.inferenceAttempts, 1);
  assert.equal(result.notExecuted.length, 17);
  assert.ok(!f.client.stringifySafe(rows).includes(token));
});
test("configuration drift stops the corpus and does not change monitoring or global routing", async () => {
  const f = fixture(), original = JSON.stringify({ EMAIL_MONITORING_PROFILE, AI_ROUTING_OVERRIDES });
  await f.client.inspect();
  let snapshots = 0;
  const result = await runSequentialRegression({ ...defaults(), client: f.client,
    readRoutingSnapshot: async () => ({ version: ++snapshots < 3 ? 1 : 2 }) });
  assert.equal(result.stopped, "production_configuration_changed");
  assert.equal(result.inferenceAttempts, 1);
  assert.equal(JSON.stringify({ EMAIL_MONITORING_PROFILE, AI_ROUTING_OVERRIDES }), original);
});
test("fresh telemetry alarm aborts an in-flight request and never starts the next case", async () => {
  const f = fixture({ stall: true }); await f.client.inspect();
  let checks = 0;
  const result = await runSequentialRegression({ ...defaults(), client: f.client,
    monitor: async () => ++checks > 1 ? { ...telemetry(), criticalResourceAlarm: true } : telemetry() });
  assert.equal(result.inferenceAttempts, 1); assert.equal(result.stopped, "telemetry_stop");
});
