import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getEventListeners } from "node:events";
import { replay } from "./replay.cjs";
import { diagnose, tokenLimits } from "./diagnostics.cjs";
import { captureTransport } from "./run";
import { executeAttempt } from "./evidence";
import { build, validateEvidence, verifySources } from "./offline-c11.cjs";

function parserFixture(t: any, tail: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "c11-parser-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const expression = '{model:"fixture"}';
  fs.writeFileSync(path.join(root, "source.ts"),
    `async function original(){\nconst response = await client.create(${expression});\n${tail}\n}`);
  return { root, variant: { source: { file: "source.ts", line: 2 }, originalExpression: expression } };
}
test("legitimate void return is preserved and never parsed as JSON", async t => {
  const { root, variant } = parserFixture(t,
    'const result=JSON.parse(response.choices[0].message.content); if(result.negative!==true)return;');
  const result = await replay("task.sentiment", '{"negative":false}', {}, {}, variant, { sourceRoot: root });
  assert.equal(result.state, "ACCEPTED");
  assert.equal(result.returnKind, "undefined");
  assert.equal(result.value, null);
});
test("actual model JSON syntax failure remains an application rejection", async t => {
  const { root, variant } = parserFixture(t, 'return JSON.parse(response.choices[0].message.content);');
  const result = await replay("unknown", '{"broken":', {}, {}, variant, { sourceRoot: root });
  assert.equal(result.state, "REJECTED");
  assert.equal(result.validationError, "C1_APPLICATION_SYNTAXERROR");
});
test("database, messaging and event effects fail closed even if original catches them", async t => {
  for (const effect of ['db.update("x")', 'pool.query("UPDATE x")', 'sendEmail("x")',
    'sendSms("x")', 'fetch("https://example.invalid")', 'emitEventOnceForIdentity({})']) {
    const { root, variant } = parserFixture(t, `try{await ${effect};}catch{} return {ok:true};`);
    const result = await replay("unknown", "{}", {}, {}, variant, { sourceRoot: root });
    assert.equal(result.state, "NOT_REPLAYED");
    assert.ok(result.blockedEffects.length > 0);
  }
});
test("bounded original parser stops before database enrichment without substituting a parser", async t => {
  const { root, variant } = parserFixture(t,
    'const parsed=JSON.parse(response.choices[0].message.content); await db.select(); return parsed;');
  const result = await replay("lead_intelligence.goal", '{"segment":"gynaecology"}', {}, {}, variant,
    { sourceRoot: root, bounded: true });
  assert.equal(result.state, "ACCEPTED");
  assert.deepEqual(result.value, { segment: "gynaecology" });
  assert.equal(result.omittedDownstream, true);
  assert.equal(result.integrationVerified, false);
  assert.deepEqual(result.blockedEffects, []);
});
test("model content remains data, not executable source", async t => {
  const { root, variant } = parserFixture(t, 'return JSON.parse(response.choices[0].message.content);');
  const raw = '{"code":"process.exit(99); require(\\"fs\\").writeFileSync(\\"x\\",\\"y\\")"}';
  const result = await replay("unknown", raw, {}, {}, variant, { sourceRoot: root });
  assert.equal(result.state, "ACCEPTED");
  assert.deepEqual(result.value, JSON.parse(raw));
});
test("timeout diagnostics distinguish local abort, deadline, HTTP timeout and upstream HTTP error", () => {
  const controller = new AbortController(); controller.abort();
  assert.equal(diagnose({ signal: controller.signal }).kind, "LOCAL_ABORT");
  assert.equal(diagnose({ signal: controller.signal, localReason: "C11_LOCAL_DEADLINE" }).kind, "LOCAL_DEADLINE");
  assert.equal(diagnose({ error: { name: "APIConnectionTimeoutError" } }).kind, "SDK_TIMEOUT");
  for (const status of [408, 504])
    assert.equal(diagnose({ traces: [{ status, stage: "INFERENCE" }] }).kind, "HTTP_TIMEOUT");
  assert.equal(diagnose({ traces: [{ status: 500, stage: "INFERENCE" }] }).kind, "AI_SERVER_OR_GATEWAY_HTTP_ERROR");
  assert.equal(diagnose({ error: { code: "ai_internal_token_limit_exceeded" } }).kind, "LOCAL_ADAPTER_TOKEN_LIMIT");
  assert.equal(diagnose({ error: { code: "C1_APPLICATION_SYNTAXERROR" },
    traces: [{ status: 200, stage: "INFERENCE" }] }).kind, "NO_TRANSPORT_FAILURE");
  const old = diagnose({ error: { code: "C1_UNEXPECTED_HARNESS_ERROR" }, elapsedMs: 120002, historical: true });
  assert.equal(old.kind, "SUSPECTED_120S_TIMEOUT"); assert.equal(old.confirmed, false);
});
test("model limits preserve the requested token value and missing historical limits stay unknown", () => {
  const request = { model: "fixture", max_tokens: 16000 };
  const declared = { models: [{ id: "fixture", maxOutputTokens: 8192, maxInputTokens: 32768 }] };
  assert.equal(tokenLimits(request, declared).declaredMaxOutputTokens, 8192);
  assert.equal(tokenLimits(request, declared).requestedMaxTokens, 16000);
  assert.equal(request.max_tokens, 16000);
  assert.equal(tokenLimits(request).declaredMaxOutputTokens, null);
});
test("transport captures actual discovery limits separately from raw completion and HTTP errors", async () => {
  const capture = captureTransport("synthetic-token", (async (url: any) =>
    String(url).includes("capabilities") ? Response.json({
      apiVersion: "1", models: [{ id: "fixture", maxOutputTokens: 4096, maxInputTokens: 10000 }],
    }) : Response.json({ error: "synthetic" }, { status: 504 })) as typeof fetch);
  await capture.fetch("https://example.invalid/gateway/indexus/v1/capabilities");
  await capture.fetch("https://example.invalid/gateway/v1/chat/completions");
  const observed = capture.diagnostics();
  assert.equal(observed.declarations.models[0].maxOutputTokens, 4096);
  assert.equal((await capture.result()).status, 504);
  assert.equal(diagnose(observed).kind, "HTTP_TIMEOUT");
});
test("discovery secret echo is retained only as a stop code, never as token-bearing evidence", async () => {
  const capture = captureTransport("synthetic-token", (async () =>
    Response.json({ models: [{ id: "synthetic-token" }] })) as typeof fetch);
  await assert.rejects(capture.fetch("https://example.invalid/gateway/indexus/v1/capabilities"), /C1_SECRET_ECHO/);
  assert.equal((await capture.result()).captureError, "C1_SECRET_ECHO");
  assert.equal(JSON.stringify(capture.diagnostics()).includes("synthetic-token"), false);
});
test("each attempt removes its parent abort listener and records a local deadline", async () => {
  const parent = new AbortController();
  const capture = { reset() {}, result: async () => null };
  const variant = { id: "unknown:1", request: { model: "fixture", messages: [] } };
  const success = { chat: { completions: { create: async () => ({ choices: [{ message: { content: "{}" } }] }) } } };
  for (let i = 0; i < 20; i++) {
    await executeAttempt({ id: "unknown" }, variant, i, success, capture, parent.signal);
    assert.equal(getEventListeners(parent.signal, "abort").length, 0);
  }
  const stalled = { chat: { completions: { create: (_: any, options: any) =>
    new Promise((_resolve, reject) => options.signal.addEventListener("abort", () =>
      reject(new DOMException("Synthetic timeout", "AbortError")), { once: true })) } } };
  const timed = await executeAttempt({ id: "unknown" }, variant, 1, stalled, capture, parent.signal, 5);
  assert.equal(timed.transportDiagnostic.kind, "LOCAL_DEADLINE");
  assert.equal(getEventListeners(parent.signal, "abort").length, 0);
});
const fixtureRootFile = "generated-artifacts/ai-gateway-c1-launch-fixed/validation-root.txt";
const reportFile = "attached_assets/0_C1-textove-vysledky-zRf8ck_1794770583711.json";
test("all 162 stored attempts replay offline with immutable source, model and adapter evidence", {
  skip: !fs.existsSync(fixtureRootFile) || !fs.existsSync(reportFile),
}, async () => {
  const root = fs.readFileSync(fixtureRootFile, "utf8").trim();
  const plan = JSON.parse(fs.readFileSync(path.join(root, "plan.json"), "utf8"));
  const reports = [reportFile, "attached_assets/C1-vysledok-hBVcvd_1794765653657.json"]
    .map(f => JSON.parse(fs.readFileSync(f, "utf8")));
  const before = JSON.stringify(reports);
  const priorFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = (() => { networkCalls++; throw Error("NETWORK FORBIDDEN"); }) as typeof fetch;
  let result;
  try { result = await build(plan, root, reports); }
  finally { globalThis.fetch = priorFetch; }
  assert.equal(networkCalls, 0);
  assert.equal(JSON.stringify(reports), before);
  assert.equal(result.summary.attempts, 162);
  assert.equal(result.summary.adapterStates.ACCEPTED, 149);
  assert.equal(result.summary.parserStates.ACCEPTED, 148);
  assert.equal(result.summary.parserStates.REJECTED, 1);
  assert.equal(result.summary.parserStates.NOT_REPLAYED || 0, 0);
  assert.equal(result.summary.unknownDeclaredLimitCount, 162);
  assert.equal(result.summary.blockedEffects, 0);
  assert.equal(result.summary.compatible, 0);
  const task = result.rows.find((r: any) => r.id === "task.sentiment");
  assert.ok(task.replayAttempts.every((a: any) => a.applicationParser.offlineReplay.returnKind === "undefined"));
  const tampered = structuredClone(reports[0]);
  tampered.rows.find((r: any) => r.attempts.length).attempts[0].originalRequest.max_tokens = 1;
  assert.throws(() => validateEvidence(tampered, plan));
  const badPlan = structuredClone(plan); badPlan.sourceHashes["server/routes.ts"] = "bad";
  assert.throws(() => verifySources(badPlan, root), /C11_SOURCE_HASH_MISMATCH/);
});
