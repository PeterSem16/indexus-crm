import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { snapshot } from "../ai-gateway-b4-pilot.cjs";
import { analyzeSource } from "./source.cjs";
import { B12 } from "./b12-test";
import { B13_CORPUS, B13_CATEGORIES, B13_FIELDS } from "./b13-corpus";
import { evaluateB13, executeB13, renderB13, validateB13Corpus } from "./b13-pilot";
const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
const token = "SYNTHETIC_B13_CREDENTIAL";
function current(version = 7) {
  return snapshot({ version, value: { routes: {}, gateway: { enabled: false,
    baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
    maxRetries: 0, maxTokens: null, temperature: null } } }, Object.keys(AI_SERVICES));
}
function perfectRows(): any[] {
  return B13_CORPUS.map(c => ({ ...c, actualJson: { ...c.expected, note: "Syntetická klasifikácia." },
    verdict: "PASS", httpStatus: 200, usedModel: B12.model, error: null, inferenceAttempts: 1,
    cloudCalls: 0, integrationProcessed: true, transportTraces: [{ stage: "INFERENCE", status: 200 }] }));
}
async function liveHarness(options: { badFirstJson?: boolean; badFirstSchema?: boolean; firstStatus?: number; discoveryStatus?: number; abortAfter?: number;
  changeAt?: number; failFinal?: boolean } = {}) {
  let calls = 0, claims = 0, reads = 0;
  const requests: any[] = [], persisted: any[] = [], progress: string[] = [];
  const abort = new AbortController();
  const report = await executeB13({ token, source, reference: current(), signal: abort.signal,
    readSnapshot: async () => {
      reads++; if (options.failFinal && reads === 62) throw Error("PRIVATE_DB_ERROR_NOT_FOR_REPORT");
      return current(options.changeAt && reads >= options.changeAt ? 8 : 7);
    },
    claimOnce() { claims++; },
    persist(value) { persisted.push({ inferenceCalls: calls, report: JSON.parse(JSON.stringify(value)) }); },
    progress(row, index) { progress.push(row.id); if (index + 1 === options.abortAfter) abort.abort(); },
    fetch: (async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith("health/ready")) return new Response(null, { status: options.discoveryStatus ?? 200 });
      if (String(url).endsWith("v1/models")) return Response.json({ object: "list", data: [{ id: B12.model }] });
      if (String(url).endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1", models: [{
        id: B12.model, revision: "SYNTHETIC_B13", operations: ["chat.completions"],
        inputModalities: ["text"], outputFormats: ["text", "json_object"], streaming: false,
        maxInputTokens: 8192, maxOutputTokens: 200,
      }] });
      calls++;
      assert.equal(String(url), B12.endpoint); assert.equal(init?.redirect, "error");
      const body = JSON.parse(String(init?.body));
      const c = B13_CORPUS.find(c => c.input === body.messages.find((m: any) => m.role === "user").content);
      assert.ok(c); assert.equal(body.expected, undefined); assert.equal(body.messages.length, 2);
      assert.equal(body.max_tokens, 200); assert.equal(body.temperature, 0.1); assert.equal(body.stream, false);
      if (calls === 1 && options.firstStatus) return new Response(null, { status: options.firstStatus });
      return Response.json({ id: `SYNTHETIC_B13_${calls}`, object: "chat.completion", model: B12.model,
        choices: [{ index: 0, message: { role: "assistant",
          content: calls === 1 && options.badFirstJson ? "{broken" : JSON.stringify({
            ...c.expected, ...(calls === 1 && options.badFirstSchema ? { wantsConsent: "false" } : {}),
            note: "Syntetická klasifikácia." }) },
          finish_reason: "stop" }] });
    }) as typeof fetch,
  });
  return { report, calls, claims, reads, requests, persisted, progress };
}
test("30 immutable unique cases have six categories of five and exactly eight predefined expectations each", () => {
  validateB13Corpus();
  assert.equal(B13_CORPUS.length, 30); assert.equal(B13_FIELDS.length, 8);
  assert.equal(Object.keys(B13_CATEGORIES).length, 6);
  assert.ok(B13_CORPUS.every(c => Object.isFrozen(c) && Object.isFrozen(c.expected) && Object.keys(c.expected).length === 8));
});
test("perfect pilot passes with 240 independently scored fields and all six category summaries", () => {
  const summary = evaluateB13(perfectRows(), true);
  assert.equal(summary.verdict, "PASS"); assert.equal(summary.correctExpectations, 240);
  assert.equal(summary.fieldSuccessPct, 100); assert.equal(summary.passedCases, 30);
  assert.ok(Object.values(summary.categories).every(c => c.passed === 5 && c.correctExpectations === 40));
});
test("field threshold is exactly 90 percent; full-case success is reported separately", () => {
  const boundary = perfectRows();
  for (let i = 0; i < 24; i++) boundary[i].actualJson.hasRudeExpressions = !boundary[i].actualJson.hasRudeExpressions;
  assert.equal(evaluateB13(boundary, true).verdict, "PASS");
  assert.equal(evaluateB13(boundary, true).fieldSuccessPct, 90);
  boundary[24].actualJson.hasRudeExpressions = !boundary[24].actualJson.hasRudeExpressions;
  assert.equal(evaluateB13(boundary, true).verdict, "FAIL");
});
test("one false consent or one missed explicit cancellation fails even above 90 percent", () => {
  const consent = perfectRows(); consent[0].actualJson.wantsConsent = true;
  assert.equal(evaluateB13(consent, true).falseConsents, 1);
  assert.equal(evaluateB13(consent, true).verdict, "FAIL");
  const cancel = perfectRows(); cancel[20].actualJson.wantsToCancel = false;
  assert.equal(evaluateB13(cancel, true).missedCancellations, 1);
  assert.equal(evaluateB13(cancel, true).verdict, "FAIL");
});
test("extra fields, wrong types and wrong returned model cannot be hidden by high field accuracy", () => {
  const extra = perfectRows(); extra[0].actualJson.extra = true;
  assert.equal(evaluateB13(extra, true).contractErrors, 1); assert.equal(evaluateB13(extra, true).verdict, "FAIL");
  const wrong = perfectRows(); wrong[0].actualJson.wantsConsent = "false";
  assert.equal(evaluateB13(wrong, true).verdict, "FAIL");
  const model = perfectRows(); model[0].usedModel = "UNEXPECTED_MODEL";
  assert.equal(evaluateB13(model, true).integrationErrors, 1); assert.equal(evaluateB13(model, true).verdict, "FAIL");
});
test("tampered row expectations do not influence scoring and incomplete evidence requires review", () => {
  const rows = perfectRows(); rows[0].actualJson.wantsConsent = true; rows[0].expected = rows[0].actualJson;
  assert.equal(evaluateB13(rows, true).verdict, "FAIL");
  const partial = perfectRows();
  for (let i = 2; i < 30; i++) partial[i].verdict = "NOT_RUN";
  assert.equal(evaluateB13(partial, true, true).verdict, "REVIEW_REQUIRED");
  assert.equal(evaluateB13(perfectRows(), null).verdict, "REVIEW_REQUIRED");
  assert.equal(evaluateB13(perfectRows(), false).verdict, "FAIL");
});
test("pilot executes exactly 30 single CRM integrations, saves expectations before inference and persists each result", async () => {
  const h = await liveHarness();
  assert.equal(h.report.summary.verdict, "PASS"); assert.equal(h.calls, 30); assert.equal(h.claims, 1);
  assert.equal(h.reads, 62); assert.equal(h.requests.length, 120); assert.equal(h.progress.length, 30);
  assert.equal(h.persisted[0].inferenceCalls, 0);
  assert.ok(h.persisted.some(s => s.inferenceCalls === 0 &&
    s.report.rows[0].state === "INFERENCE_STARTED" && s.report.summary.inferenceAttempts === 1));
  assert.ok(h.persisted[0].report.rows.every((r: any) => r.verdict === "NOT_RUN" && Object.keys(r.expected).length === 8));
  assert.ok(h.persisted.length >= 32); assert.equal(h.report.summary.cloudCalls, 0);
  assert.equal(h.report.summary.productionUnchanged, true); assert.equal(h.report.complete, true);
  assert.equal(JSON.stringify(h.report).includes(token), false);
  const markdown = renderB13(h.report);
  assert.ok(markdown.includes("SYN-B13-30")); assert.ok(markdown.includes("240/240"));
});
test("malformed JSON is retained and scored as failure while later cases continue without retry", async () => {
  const h = await liveHarness({ badFirstJson: true });
  assert.equal(h.calls, 30); assert.equal(h.report.summary.verdict, "FAIL");
  assert.equal(h.report.summary.parserErrors, 0); assert.equal(h.report.summary.contractErrors, 1);
  assert.equal(h.report.rows[0].modelContent, "{broken"); assert.equal(h.report.rows[0].actualJson, null);
  assert.equal(h.report.rows[29].verdict, "PASS");
  const schema = await liveHarness({ badFirstSchema: true });
  assert.equal(schema.report.summary.parserErrors, 1);
  assert.equal(schema.report.summary.verdict, "FAIL");
});
test("HTTP 500 fails quality but is never retried; unauthorized access stops the remaining pilot", async () => {
  const server = await liveHarness({ firstStatus: 500 });
  assert.equal(server.calls, 30); assert.equal(server.report.summary.httpErrors, 1);
  assert.equal(server.report.summary.verdict, "FAIL");
  const auth = await liveHarness({ firstStatus: 401 });
  assert.equal(auth.calls, 1); assert.equal(auth.report.summary.verdict, "FAIL");
  assert.equal(auth.report.summary.executedCases, 1);
  const discovery = await liveHarness({ discoveryStatus: 403 });
  assert.equal(discovery.calls, 0); assert.equal(discovery.requests.length, 1);
  assert.equal(discovery.report.summary.executedCases, 1);
  assert.equal(discovery.report.summary.verdict, "FAIL");
});
test("production change stops before another inference and final verification failure is not a false change", async () => {
  const changed = await liveHarness({ changeAt: 4 });
  assert.equal(changed.calls, 1); assert.equal(changed.report.summary.verdict, "FAIL");
  assert.equal(changed.report.summary.productionUnchanged, false);
  const unavailable = await liveHarness({ failFinal: true });
  assert.equal(unavailable.calls, 30); assert.equal(unavailable.report.summary.verdict, "REVIEW_REQUIRED");
  assert.equal(unavailable.report.summary.productionUnchanged, null);
});
test("operator interruption preserves partial evidence without scheduling remaining cases", async () => {
  const h = await liveHarness({ abortAfter: 2 });
  assert.equal(h.calls, 2); assert.equal(h.report.summary.executedCases, 2);
  assert.equal(h.report.summary.verdict, "REVIEW_REQUIRED");
  assert.equal(h.report.rows[2].verdict, "NOT_RUN");
});
