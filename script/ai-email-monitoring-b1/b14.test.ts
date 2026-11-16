import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { snapshot } from "../ai-gateway-b4-pilot.cjs";
import { productionComparison } from "./b11-check.cjs";
import { analyzeSource } from "./source.cjs";
import { B12 } from "./b12-test";
import { B13_CORPUS, B13_FIELDS } from "./b13-corpus";
import { B13_CORPUS_SHA256, evaluateB13 } from "./b13-pilot";
import { B14_CORPUS, B14_PROBLEM_IDS } from "./b14-corpus";
import { compareB14, evaluateB14, executeB14, renderB14, validateB14Baseline } from "./b14-pilot";
const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
const token = "SYNTHETIC_B14_CREDENTIAL";
function current(version = 7) {
  return snapshot({ version, value: { routes: {}, gateway: { enabled: false,
    baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
    maxRetries: 0, maxTokens: null, temperature: null } } }, Object.keys(AI_SERVICES));
}
function rowsFor(corpus: readonly any[] = B14_CORPUS): any[] {
  return corpus.map(c => ({ ...c, actualJson: { ...c.expected, note: "Syntetické vysvetlenie." },
    modelContent: "", state: "COMPLETED", verdict: "PASS", httpStatus: 200,
    usedModel: B12.model, error: null, inferenceAttempts: 1, cloudCalls: 0,
    integrationProcessed: true, transportTraces: [{ stage: "INFERENCE", status: 200 }],
    production: productionComparison(current(), current(), current()) }));
}
function baselineFixture() {
  const rows = rowsFor(B13_CORPUS);
  Object.assign(rows[11].actualJson, { doesNotAcceptContract: true, alertLevel: "warning" });
  Object.assign(rows[16].actualJson, { wantsToCancel: true, alertLevel: "critical" });
  for (let i = 20; i < 25; i++) Object.assign(rows[i].actualJson, { sentiment: "negative", alertLevel: "warning" });
  rows[25].actualJson.alertLevel = "warning";
  for (const row of rows) {
    row.modelContent = JSON.stringify(row.actualJson);
    if (B13_FIELDS.some(k => row.actualJson[k] !== row.expected[k])) {
      row.verdict = "FAIL"; row.error = "B12_SEMANTIC_MISMATCH";
    }
  }
  return { phase: "B1.3", kind: "LIVE_ISOLATED_30_SYNTHETIC_EMAILS", complete: true, error: null,
    corpusSha256: B13_CORPUS_SHA256, originalRequestSha256: source.requestSha256,
    productionSettingsWrites: 0, productionRecordWrites: 0, customerNotifications: 0,
    production: productionComparison(current(), current(), current()), before: current(), after: current(),
    rows, summary: evaluateB13(structuredClone(rows), true) };
}
async function run(options: { statusAt?: number; schemaAt?: number; abortAfter?: number;
  finalError?: boolean; changeAt?: number; oldRules?: boolean; fenced?: boolean; duplicate?: boolean } = {}) {
  const baseline = baselineFixture(), abort = new AbortController();
  let calls = 0, reads = 0, claims = 0, requests = 0;
  const saved: any[] = [];
  const report = await executeB14({ token, source, baseline, reference: current(), signal: abort.signal,
    readSnapshot: async () => {
      reads++; if (options.finalError && reads === 72) throw Error("PRIVATE_FAILURE");
      return current(options.changeAt && reads >= options.changeAt ? 8 : 7);
    },
    claimOnce() { claims++; if (options.duplicate) throw Error("B12_RUN_ALREADY_STARTED"); },
    persist(value) { saved.push({ calls, value: structuredClone(value) }); },
    progress(_, i) { if (i + 1 === options.abortAfter) abort.abort(); },
    fetch: (async (url, init) => {
      requests++;
      assert.ok(String(url).startsWith("https://ai.cordbloodcenter.com/gateway/"));
      assert.equal(init?.redirect, "error");
      if (String(url).endsWith("health/ready")) return new Response(null);
      if (String(url).endsWith("v1/models")) return Response.json({ object: "list", data: [{ id: B12.model }] });
      if (String(url).endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1", models: [{
        id: B12.model, revision: "SYNTHETIC_UPDATED_RULES", operations: ["chat.completions"],
        inputModalities: ["text"], outputFormats: ["text", "json_object"], streaming: false,
        maxInputTokens: 8192, maxOutputTokens: 200,
      }] });
      calls++;
      assert.equal(String(url), B12.endpoint);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.messages.length, 2); assert.equal(body.expected, undefined);
      const c = B14_CORPUS[calls - 1];
      assert.equal(body.messages[1].content, c.input);
      assert.equal(body.model, B12.model); assert.equal(body.temperature, 0.1);
      assert.equal(body.max_tokens, 200); assert.equal(body.stream, false);
      assert.deepEqual(body.response_format, { type: "json_object" });
      if (calls === options.statusAt) return new Response(null, { status: 401 });
      const actual = options.oldRules && calls <= 30 ? baseline.rows[calls - 1].actualJson :
        { ...c.expected, note: "Syntetické vysvetlenie." };
      const content = JSON.stringify(calls === options.schemaAt ? { ...actual, wantsConsent: "false" } : actual);
      return Response.json({ id: "SYNTHETIC_B14", object: "chat.completion", model: B12.model,
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant",
          content: options.fenced && calls === 1 ? "```json\n" + content + "\n```" : content } }] });
    }) as typeof fetch,
  });
  return { report, calls, reads, claims, requests, saved };
}
test("B1.4 appends five immutable cases without changing any of the original 240 labels", () => {
  assert.equal(B14_CORPUS.length, 35);
  assert.equal(new Set(B14_CORPUS.map(c => c.id)).size, 35);
  assert.equal(new Set(B14_CORPUS.map(c => c.input)).size, 35);
  for (let i = 0; i < 30; i++) assert.strictEqual(B14_CORPUS[i], B13_CORPUS[i]);
  assert.ok(B14_CORPUS.every(c => Object.isFrozen(c.expected) && Object.keys(c.expected).length === 8));
});
test("baseline is independently recomputed and altered gold, prompt, score or production proof is refused", () => {
  assert.equal(validateB14Baseline(baselineFixture(), source).summary.correctExpectations, 225);
  for (const alter of [
    (b: any) => { b.rows[0].expected.wantsConsent = true; },
    (b: any) => { b.summary.correctExpectations = 240; },
    (b: any) => { b.originalRequestSha256 = "changed"; },
    (b: any) => { b.productionRecordWrites = 1; },
    (b: any) => { b.after.version = 8; },
    (b: any) => { b.rows[0].modelContent = "{}"; },
  ]) {
    const b = structuredClone(baselineFixture()); alter(b);
    assert.throws(() => validateB14Baseline(b, source));
  }
});
test("35 correct results pass; original and boundary denominators remain separate", () => {
  const s = evaluateB14(rowsFor(), true);
  assert.equal(s.verdict, "PASS"); assert.equal(s.correctExpectations, 280);
  assert.equal(s.original.expectations, 240); assert.equal(s.boundary.expectations, 40);
  assert.equal(s.falseCancellations, 0); assert.equal(s.missedCriticalAlerts, 0);
});
test("every new hard gate fails even if overall field accuracy exceeds 99 percent", () => {
  for (const [i, field, value, code] of [
    [30, "wantsConsent", true, "FALSE_POSITIVE_CONSENT"],
    [31, "wantsToCancel", true, "FALSE_POSITIVE_CANCELLATION"],
    [32, "wantsToCancel", false, "MISSED_EXPLICIT_CANCELLATION"],
    [32, "alertLevel", "warning", "CRITICAL_ALERT_REQUIRED"],
    [33, "alertLevel", "warning", "CRITICAL_ALERT_REQUIRED"],
    [25, "alertLevel", "warning", "CRITICAL_ALERT_REQUIRED"],
  ] as const) {
    const rows = rowsFor(); rows[i].actualJson[field] = value;
    const s = evaluateB14(rows, true);
    assert.equal(s.verdict, "FAIL"); assert.ok(s.reasons.includes(code)); assert.ok(s.fieldSuccessPct > 99);
  }
});
test("new easy cases cannot dilute the original accuracy floor", () => {
  const rows = rowsFor();
  for (let i = 0; i < 25; i++) rows[i].actualJson.hasRudeExpressions = true;
  const s = evaluateB14(rows, true);
  assert.equal(s.original.correct, 215); assert.ok(s.fieldSuccessPct > 90);
  assert.equal(s.verdict, "FAIL"); assert.ok(s.reasons.includes("ORIGINAL_FIELD_ACCURACY_BELOW_90_PERCENT"));
});
test("comparison distinguishes all 15 repairs, new regressions and eight previously problematic cases", () => {
  const rows = rowsFor(); rows[0].actualJson.hasRudeExpressions = true;
  evaluateB14(rows, true);
  const comparison = compareB14(baselineFixture(), rows);
  assert.equal(comparison.repaired.length, 15); assert.equal(comparison.regressions.length, 1);
  assert.equal(comparison.stillWrong.length, 0);
  assert.deepEqual(comparison.problemCases.map(c => c.id), B14_PROBLEM_IDS);
});
test("35 real CRM-layer integrations use fixed wire parameters, one attempt each and durable progress", async () => {
  const h = await run();
  assert.equal(h.report.summary.verdict, "PASS"); assert.equal(h.calls, 35);
  assert.equal(h.requests, 140); assert.equal(h.reads, 72); assert.equal(h.claims, 1);
  assert.equal(h.report.comparison.repaired.length, 15); assert.equal(h.report.comparison.regressions.length, 0);
  assert.equal(h.report.comparison.critical.b13Original.falseCancellations, 1);
  assert.equal(h.report.comparison.critical.b13Original.missedCriticalAlerts, 6);
  assert.equal(h.report.comparison.critical.b14Original.falseCancellations, 0);
  assert.equal(h.report.comparison.critical.b14Boundary.missedCriticalAlerts, 0);
  assert.ok(h.saved.some(s => s.calls === 0 && s.value.rows[0].state === "INFERENCE_STARTED" &&
    s.value.summary.inferenceAttempts === 1));
  assert.equal(h.report.productionRecordWrites, 0); assert.equal(h.report.productionSettingsWrites, 0);
  assert.equal(h.report.customerNotifications, 0); assert.equal(h.report.summary.cloudCalls, 0);
  assert.equal(JSON.stringify(h.report).includes(token), false);
  const md = renderB14(h.report);
  assert.ok(md.includes("225/240")); assert.ok(md.includes("280/280")); assert.ok(md.includes("SYN-B14-35"));
});
test("old rules reproduce the known score but now fail cancellation and critical-alert gates", async () => {
  const h = await run({ oldRules: true });
  assert.equal(h.report.summary.verdict, "FAIL");
  assert.equal(h.report.summary.original.correct, 225);
  assert.equal(h.report.summary.falseCancellations, 1); assert.equal(h.report.summary.missedCriticalAlerts, 6);
  assert.equal(h.report.comparison.stillWrong.length, 15);
});
test("new boundary parser failure and fenced raw output cannot become a false PASS", async () => {
  const bad = await run({ schemaAt: 35 });
  assert.equal(bad.calls, 35); assert.equal(bad.report.summary.verdict, "FAIL");
  assert.equal(bad.report.summary.parserErrors, 1);
  const fenced = await run({ fenced: true });
  assert.equal(fenced.report.summary.verdict, "FAIL"); assert.equal(fenced.report.rows[0].actualJson, null);
});
test("authorization failure stops on a boundary case, without retry or cloud fallback", async () => {
  const h = await run({ statusAt: 32 });
  assert.equal(h.calls, 32); assert.equal(h.report.summary.verdict, "FAIL");
  assert.equal(h.report.summary.executedCases, 32); assert.equal(h.report.rows[32].verdict, "NOT_RUN");
});
test("interruption, missing final proof, changed production and previous marker never produce PASS", async () => {
  const partial = await run({ abortAfter: 31 });
  assert.equal(partial.calls, 31); assert.equal(partial.report.summary.verdict, "REVIEW_REQUIRED");
  const final = await run({ finalError: true });
  assert.equal(final.calls, 35); assert.equal(final.report.summary.verdict, "REVIEW_REQUIRED");
  const changed = await run({ changeAt: 4 });
  assert.equal(changed.calls, 1); assert.equal(changed.report.summary.verdict, "FAIL");
  const duplicate = await run({ duplicate: true });
  assert.equal(duplicate.calls, 0); assert.equal(duplicate.report.summary.verdict, "REVIEW_REQUIRED");
});
