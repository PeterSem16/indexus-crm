import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createInternalAIAdapter } from "../../server/lib/ai/internal-adapter";
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { MODEL, BASE, preparedRow, executeAttempt, safeFailure, html, aggregateRow } from "./evidence";
import { captureTransport, executeSuite, initialReport, limitedText, validatePlan } from "./run";
import { prepare } from "./prepare.cjs";
import { replay } from "./replay.cjs";
import { reconcile } from "./reconcile.cjs";

const catalogPath = "generated-artifacts/ai-service-inventory/INDEXUS-65-AI-sluzieb.json";
// Offline unit tests need the supplied reference catalog; NEVER perform provider requests.
const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, "utf8")) : null;
const sourceTest = (name: string, fn: () => any) => test(name, { skip: !catalog }, fn);
const plan = catalog ? prepare(catalog) : null;
const completion = (content: string) => ({ id: "c1-mocked", object: "chat.completion", model: MODEL,
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] });
function harness(raw: string, options: { status?: number; invalidEnvelope?: boolean } = {}) {
  const calls: string[] = [];
  const transport = (async (input: any) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    if (url.pathname.endsWith("/health/ready")) return new Response("ready");
    if (url.pathname.endsWith("/v1/models")) return Response.json({ object: "list", data: [{ id: MODEL }] });
    if (url.pathname.endsWith("/indexus/v1/capabilities")) return Response.json({
      apiVersion: "1", models: [{ id: MODEL, revision: "mock-only", operations: ["chat.completions"],
        inputModalities: ["text"], outputFormats: ["text", "json_object"], streaming: false,
        maxInputTokens: null, maxOutputTokens: 20_000 }],
    });
    return Response.json(options.invalidEnvelope ? { ...completion(raw), model: "wrong" } : completion(raw),
      { status: options.status || 200 });
  }) as typeof fetch;
  const capture = captureTransport("fake-test-token", transport);
  const adapter = createInternalAIAdapter({ readConfiguration: () => ({
    production: true, replit: false, enabled: true, baseURL: BASE, token: "fake-test-token",
  }), fetch: capture.fetch });
  return { calls, capture, client: adapter.createClient({ maxRetries: 0, timeout: 1000 }) };
}
const snapshot = () => ({ gatewayEnabled: false, openai: 65, internal: 0, modelOverrides: 0,
  version: 1, routesSha256: "mock", gatewayParametersSha256: "mock", fullConfigurationSha256: "mock" });

sourceTest("all 65 real services and 72 call-sites are present; static evidence never claims live compatibility", () => {
  validatePlan(plan);
  assert.deepEqual(plan.services.map((s: any) => s.id).sort(), Object.keys(AI_SERVICES).sort());
  assert.equal(plan.services.flatMap((s: any) => s.variants).length, 72);
  assert.equal(plan.services.flatMap((s: any) => s.variants).filter((v: any) => v.request).length, 71);
  const report = initialReport(plan);
  assert.equal(report.rows.filter((r: any) => r.status === "UNSUPPORTED").length, 8);
  assert.equal(report.rows.filter((r: any) => r.status === "REQUIRES_FIX").length, 57);
  assert.ok(report.rows.every((r: any) => r.inferenceMs === null && r.execution === "NOT_EXECUTED"));
  assert.ok(plan.services.filter((s: any) => s.operation === "chat").every((s: any) => s.variants.every((v: any) => v.request)));
});
sourceTest("plan policy, missing pins and modified source fingerprints fail closed", () => {
  for (const change of [
    (p: any) => p.policy.gatewayEnabled = true,
    (p: any) => p.services.pop(),
    (p: any) => p.sourceHashes = {},
    (p: any) => p.sourceHashes["server/lib/ai/service-catalog.ts"] = "bad",
  ]) {
    const clone = structuredClone(plan); change(clone); assert.throws(() => validatePlan(clone));
  }
});
sourceTest("published-source reconciliation accepts only byte-identical service evidence blocks", () => {
  const parent = fs.mkdtempSync(path.resolve("generated-artifacts/c1-reference-test-"));
  const source = fs.readFileSync("server/routes.ts", "utf8");
  try {
    const ok = reconcile(catalog, source + "\n// unrelated synthetic test-only trailing comment\n",
      "a".repeat(40), path.join(parent, "ok"));
    assert.equal(ok.verifiedEvidenceBlocks, 43);
    const updated = JSON.parse(fs.readFileSync(ok.output, "utf8"));
    for (let i = 0; i < catalog.services.length; i++) {
      assert.deepEqual(updated.services[i].requests.map((r: any) => r.arguments),
        catalog.services[i].requests.map((r: any) => r.arguments));
    }
    assert.throws(() => reconcile(catalog,
      source.replace("You are an email analyzer", "Changed prompt"), "b".repeat(40),
      path.join(parent, "bad")), /C1_RELEVANT_PUBLISHED_SOURCE_CHANGED/);
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});
sourceTest("strict schema, image, Audio and Responses blockers identify adapter, not an untested local model", () => {
  for (const id of ["geography.priority", "collection.document", "ivr.speech", "automation.analysis"]) {
    const row = preparedRow(plan.services.find((s: any) => s.id === id));
    assert.equal(row.status, "UNSUPPORTED");
    assert.notEqual(row.owner, "LOCAL_MODEL");
  }
  assert.equal(preparedRow(plan.services.find((s: any) => s.id === "lead_sources.suggestion")).reason,
    "C1_SOURCE_CONTRACT_ARRAY_VS_JSON_OBJECT");
});
sourceTest("virtual agent synthetic request includes exact history builder and current utterance", () => {
  const v = plan.services.find((s: any) => s.id === "virtual_agent.response").variants[0];
  assert.equal(v.request.messages.length, 1 + v.bindings.session.turns.length + 1);
  assert.equal(v.request.messages.at(-1).content, v.bindings.userSpeech);
});
sourceTest("model raw output is separate from real application defaults", async () => {
  const service = plan.services.find((s: any) => s.id === "sms.sentiment");
  const h = harness('{"sentiment":"neutral"}');
  const result = await executeAttempt(service, service.variants[0], 1, h.client, h.capture);
  assert.equal(result.modelOutput, '{"sentiment":"neutral"}');
  assert.equal(result.rawJsonDecode.value.wantsToCancel, undefined);
  assert.equal(result.applicationParser.value.wantsToCancel, false);
  assert.equal(result.applicationParser.state, "ACCEPTED");
  assert.ok(result.inferenceMs >= 0); assert.equal(result.failure, null);
  const row = preparedRow(service); row.attempts.push(result); aggregateRow(row);
  assert.equal(row.status, "REQUIRES_FIX"); // Parser defaults are NOT a correctness oracle.
});
sourceTest("raw model text survives rejection by the existing adapter", async () => {
  const service = plan.services.find((s: any) => s.id === "status_list.translation");
  const h = harness("not-json");
  const result = await executeAttempt(service, service.variants[0], 1, h.client, h.capture);
  assert.equal(result.modelOutput, "not-json");
  assert.equal(result.failure.code, "ai_internal_invalid_json");
  assert.equal(result.failure.responsibilityConfirmed, false);
  assert.equal(result.adapterOutput, null);
  assert.equal(h.calls.filter(p => p.endsWith("/v1/chat/completions")).length, 1);
});
sourceTest("unsupported request is rejected before transport; no inference time is invented", async () => {
  const service = plan.services.find((s: any) => s.id === "geography.priority");
  const h = harness("{}");
  const result = await executeAttempt(service, service.variants[0], 1, h.client, h.capture);
  assert.equal(h.calls.length, 0);
  assert.equal(result.failure.owner, "INDEXUS_ADAPTER");
  assert.equal(result.inferenceMs, null);
});
sourceTest("all four dedicated parser replays run original application code", async () => {
  const outputs: Record<string, string> = { "email.sentiment": JSON.stringify({
    sentiment: "neutral", hasInappropriateContent: false, hasAngryTone: false,
    hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false,
    doesNotAcceptContract: false, alertLevel: "none", note: "Syntetická informačná správa.",
  }),
    "sms.sentiment": '{"sentiment":"neutral"}',
    "task.checklist": '{"steps":["Overiť prijatie správy","Zapísať výsledok overenia","Pripraviť stručnú odpoveď"]}',
    "task.resolution": '{"draft":"Prijatie syntetickej správy bolo overené."}' };
  for (const [id, raw] of Object.entries(outputs)) {
    const v = plan.services.find((s: any) => s.id === id).variants[0];
    const result = await replay(id, raw, v.bindings, v.request, v);
    assert.equal(result.state, "ACCEPTED", id + " " + JSON.stringify(result));
  }
  const v = plan.services.find((s: any) => s.id === "task.checklist").variants[0];
  assert.equal((await replay("task.checklist", '{"steps":["x"]}', v.bindings, v.request, v)).state, "REJECTED");
});
sourceTest("generic replay captures actual application HTTP response without executing a route", async () => {
  const v = plan.services.find((s: any) => s.id === "teams.summary").variants[0];
  const result = await replay("teams.summary", "<h3>Syntetický súhrn</h3>", v.bindings, v.request, v);
  assert.equal(result.state, "ACCEPTED");
  assert.equal(result.httpResponseStatus, 200);
});
test("credentials and oversized responses cannot enter evidence", async () => {
  await assert.rejects(limitedText(new Response("fake-test-token"), "fake-test-token"), /C1_SECRET_ECHO/);
  await assert.rejects(limitedText(new Response("x".repeat(2 * 1024 * 1024 + 1)), "fake-test-token"),
    /C1_RAW_RESPONSE_TOO_LARGE/);
});
test("error ownership never blames a local model for HTTP or contract errors", () => {
  assert.equal(safeFailure({ code: "ai_internal_http_error", status: 403 }).owner, "TRANSPORT_OR_GATEWAY");
  assert.equal(safeFailure({ code: "ai_internal_invalid_completion" }).responsibilityConfirmed, false);
  assert.equal(safeFailure({ message: "raw sensitive provider payload" }).code, "C1_UNEXPECTED_HARNESS_ERROR");
});
sourceTest("HTML report escapes model output and contains all 65 services", () => {
  const report = initialReport(plan);
  report.rows[0].attempts.push({ modelOutput: "<script>alert(1)</script>" });
  const output = html(report);
  assert.ok(output.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.equal((output.match(/<tr><td>/g) || []).length, 65);
});
sourceTest("circuit breaker preserves failed attempt and final snapshot without fallback", async () => {
  const h = harness("denied", { status: 403 }), report = initialReport(plan);
  let reads = 0, writes = 0;
  await executeSuite(plan, report, { readSnapshot: async () => { reads++; return snapshot(); },
    persist: async () => { writes++; }, ...h });
  assert.equal(reads, 2); assert.ok(writes > 0); assert.equal(report.finalVerified, true);
  assert.equal(report.error, "ai_internal_http_error");
  assert.equal(report.rows.flatMap((r: any) => r.attempts).length, 1);
});
sourceTest("policy failure makes zero requests, still performs final configuration check", async () => {
  const h = harness("{}"), report = initialReport(plan);
  let reads = 0;
  await executeSuite(plan, report, { readSnapshot: async () => {
    reads++; return { ...snapshot(), gatewayEnabled: true };
  }, persist: async () => {}, ...h });
  assert.equal(reads, 2); assert.equal(h.calls.length, 0);
  assert.equal(report.finalVerified, false);
  assert.equal(report.error, "C1_PRODUCTION_POLICY_MISMATCH");
});
test("live CLI refuses to run from Replit before any network or SQL", () => {
  const run = spawnSync(process.execPath, ["--import", "tsx", "script/ai-gateway-c1/run.ts",
    "--run-c1", "absent.json"], { encoding: "utf8", env: { ...process.env, REPL_ID: "offline-test" } });
  assert.notEqual(run.status, 0); assert.match(run.stderr, /C1_CORPCRM01_ONLY/);
});
