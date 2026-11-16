import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { snapshot } from "../ai-gateway-b4-pilot.cjs";
import { productionComparison } from "./b11-check.cjs";
import { analyzeSource } from "./source.cjs";
import { B12 } from "./b12-test";
import { B13_FIELDS } from "./b13-corpus";
import { B14_CORPUS_SHA256 } from "./b14-corpus";
import { B16_CORPUS, evaluateB16 } from "./b16-pilot";
import { B17_CORPUS, B17_CORPUS_SHA256, B17_CATEGORIES, validateB17Corpus } from "./b17-corpus";
import { validateB17Approval, validateB17Baseline, evaluateB17, executeB17,
  findB16Baseline, failuresB17, renderB17, performanceMetrics } from "./b17-pilot";
const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
const token = "SYNTHETIC_B17_CREDENTIAL";
function current(version = 7) {
  return snapshot({ version, value: { routes: {}, gateway: { enabled: false,
    baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
    maxRetries: 0, maxTokens: null, temperature: null } } }, Object.keys(AI_SERVICES));
}
function rows(corpus: readonly any[] = B17_CORPUS): any[] {
  return corpus.map(c => ({ ...c, actualJson: Object.fromEntries([...Object.entries(c.expected)
    .map(([key, value]) => [key, value === null ? (key === "sentiment" ? "neutral" : key === "alertLevel" ? "none" : false) : value]),
    ["note", "Zákazník posiela správu."]]),
    verdict: "PASS", state: "COMPLETED", error: null, httpStatus: 200, usedModel: B12.model,
    integrationProcessed: true, inferenceAttempts: 1, cloudCalls: 0, processingMs: 10,
    transportTraces: [{ stage: "INFERENCE", status: 200 }],
    production: productionComparison(current(), current(), current()) }))
    .map(r => ({ ...r, modelContent: JSON.stringify(r.actualJson) }));
}
/** Synthetic reference fixtures, not measured B1.6 performance. */
function previous() {
  const rs = rows(B16_CORPUS);
  rs.forEach(r => { r.modelContent = JSON.stringify(r.actualJson); });
  const { input: _, ...configuration } = B12;
  return { phase: "B1.6", kind: "LIVE_ISOLATED_35_SYNTHETIC_EMAILS", complete: true, error: null,
    request: { ...configuration, phase: "B1.6" }, corpusSha256: B14_CORPUS_SHA256,
    originalRequestSha256: source.requestSha256, before: current(), after: current(),
    production: productionComparison(current(), current(), current()),
    productionSettingsWrites: 0, productionRecordWrites: 0, customerNotifications: 0,
    rows: rs, summary: evaluateB16(structuredClone(rs), true) };
}
async function run(opts: { httpAt?: number; schemaAt?: number; regression?: boolean; abortAfter?: number;
  finalError?: boolean; changeAt?: number; duplicate?: boolean; wrongModel?: boolean } = {}) {
  const baseline = previous(), controller = new AbortController();
  let calls = 0, reads = 0, claims = 0, requests = 0;
  const saved: any[] = [];
  const report = await executeB17({ previous: baseline, reference: baseline.after, source, token,
    signal: controller.signal, readSnapshot: async () => {
      reads++; if (opts.finalError && reads === 202) throw Error("PRIVATE_DB_ERROR");
      return current(opts.changeAt && reads >= opts.changeAt ? 8 : 7);
    },
    claimOnce() { claims++; if (opts.duplicate) throw Error("B12_RUN_ALREADY_STARTED"); },
    persist(value) { saved.push({ calls, attempts: value.summary.inferenceAttempts,
      firstState: value.rows[0].state, goldHash: value.corpusSha256 }); },
    progress(_, i) { if (i + 1 === opts.abortAfter) controller.abort(); },
    fetch: (async (url, init) => {
      requests++; assert.equal(init?.redirect, "error");
      assert.ok(String(url).startsWith("https://ai.cordbloodcenter.com/gateway/"));
      if (String(url).endsWith("health/ready")) return new Response(null);
      if (String(url).endsWith("v1/models")) return Response.json({ object: "list", data: [{ id: B12.model }] });
      if (String(url).endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1", models: [{
        id: B12.model, revision: "SYNTHETIC_B17", operations: ["chat.completions"],
        inputModalities: ["text"], outputFormats: ["text", "json_object"], streaming: false,
        maxInputTokens: 8192, maxOutputTokens: 200,
      }] });
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(String(url), B12.endpoint); assert.equal(body.model, B12.model);
      assert.equal(body.max_tokens, 200); assert.equal(body.temperature, .1);
      assert.equal(body.stream, false); assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(body.messages[1].content, B17_CORPUS[calls - 1].input);
      assert.equal(body.messages.length, 2); assert.equal(body.expected, undefined);
      assert.equal(body.messages[0].content.includes("SYN-B17"), false);
      if (opts.httpAt === calls) return new Response(null, { status: 403 });
      const actual = { ...rows()[calls - 1].actualJson };
      if (opts.regression && calls === 1) actual.sentiment = "negative";
      if (opts.schemaAt === calls) actual.wantsConsent = "false";
      return Response.json({ id: "SYNTHETIC_B17", object: "chat.completion",
        model: opts.wrongModel && calls === 1 ? "WRONG" : B12.model,
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(actual) } }] });
    }) as typeof fetch });
  return { report, calls, reads, claims, requests, saved };
}
test("100 novel frozen inputs, 10 categories, four languages and all eight preregistered references", () => {
  validateB17Corpus();
  assert.equal(B17_CORPUS.length, 100);
  assert.equal(Object.keys(B17_CATEGORIES).length, 10);
  assert.deepEqual([...new Set(B17_CORPUS.map(c => c.language))].sort(), ["cs", "en", "hu", "sk"]);
  assert.ok(Object.isFrozen(B17_CORPUS) && B17_CORPUS.every(c => Object.isFrozen(c.expected)));
  assert.equal(B17_CORPUS.flatMap(c => Object.values(c.expected)).filter(v => v === null).length, 35);
  assert.equal(B17_CORPUS.filter(c => c.reviewReason).length, 18);
  assert.ok(B17_CORPUS.every(c => B13_FIELDS.every(f => Object.hasOwn(c.expected, f))));
});
test("independent pre-inference approval binds corpus, policy and actual CRM prompt", () => {
  const a = validateB17Approval(source);
  assert.match(a.reviewer, /AI/);
  for (const patch of [{ corpusSha256: "wrong" }, { policySha256: "wrong" },
    { sourceRequestSha256: "wrong" }, { beforeInference: false }, { reviewedFields: 799 },
    { decision: "REVIEW_REQUIRED" }, { ambiguousIds: [] }])
    assert.throws(() => validateB17Approval(source, { ...a, ...patch }), /APPROVAL_REQUIRED/);
});
test("ambiguity is neither correct nor incorrect and no short note is auto-certified as Slovak", () => {
  const rs = rows(), s = evaluateB17(rs, true);
  assert.equal(s.correctExpectations, 765); assert.equal(s.wrongExpectations, 0);
  assert.equal(s.unresolvedExpectations, 35); assert.equal(s.fieldSuccessPct, 95.625);
  assert.equal(s.fieldUpperBoundPct, 100); assert.equal(s.knownOnlyFieldSuccessPct, 100);
  assert.equal(s.passedCases, 82); assert.equal(s.caseUpperBoundPct, 100);
  assert.equal(s.technicalSuccesses, 100); assert.equal(s.verdict, "REVIEW_REQUIRED");
  rs[0].actualJson.note = "Customer sends a message.";
  assert.equal(evaluateB17(rs, true).verdict, "REVIEW_REQUIRED");
  assert.equal(rs[0].noteChecks.slovakLanguage, "REVIEW_REQUIRED");
});
test("98% and 95% use all800/all100 conservative bounds, not an improved filtered denominator", () => {
  const rs = rows();
  // Six definitely failed cases make 95/100 impossible, even with all ambiguous cases later accepted.
  for (let i = 0; i < 6; i++) rs[i].actualJson.sentiment = "negative";
  const s = evaluateB17(rs, true);
  assert.equal(s.verdict, "FAIL"); assert.equal(s.caseUpperBoundPct, 94);
  assert.ok(s.reasons.includes("CASE_ACCURACY_CANNOT_REACH_95_PERCENT"));
  const many = rows();
  for (let i = 0; i < 17; i++) many[i].actualJson.sentiment = i < 10 ? "negative" : "neutral";
  assert.ok(evaluateB17(many, true).reasons.includes("FIELD_ACCURACY_CANNOT_REACH_98_PERCENT"));
});
test("all four critical gates fail independently; cancellation ambiguity is not called a false cancellation", () => {
  for (const [i, k, v, code] of [
    [0, "wantsConsent", true, "FALSE_POSITIVE_CONSENT"],
    [0, "wantsToCancel", true, "FALSE_POSITIVE_CANCELLATION"],
    [40, "wantsToCancel", false, "MISSED_EXPLICIT_CANCELLATION"],
    [60, "alertLevel", "warning", "CRITICAL_ALERT_REQUIRED"],
  ] as const) {
    const rs = rows(); rs[i].actualJson[k] = v;
    const s = evaluateB17(rs, true); assert.equal(s.verdict, "FAIL");
    assert.ok(s.criticalErrors.some(e => e.code === code));
  }
  const rs = rows(); rs[51].actualJson.wantsToCancel = true;
  assert.equal(evaluateB17(rs, true).falseCancellations, 0);
});
test("note shape and transport/parser checks remain distinct from classification scores", () => {
  for (const note of ["", "x".repeat(101), false]) {
    const rs = rows(); rs[0].actualJson.note = note;
    assert.equal(evaluateB17(rs, true).verdict, "FAIL");
  }
  const rs = rows(); rs[0].integrationProcessed = false; rs[0].error = "email_monitoring_invalid_analysis";
  const s = evaluateB17(rs, true);
  assert.equal(s.correctExpectations, 765); assert.equal(s.technicalSuccesses, 99); assert.equal(s.verdict, "FAIL");
});
test("historical B1.6 is independently rescored; changed raw response, prompt or score blocks inference", () => {
  const old = previous(); assert.equal(validateB17Baseline(old, source).summary.verdict, "PASS");
  for (const mutate of [(r: any) => r.rows[0].actualJson.wantsConsent = true,
    (r: any) => r.summary.passedCases = 34, (r: any) => r.request.temperature = .3,
    (r: any) => r.originalRequestSha256 = "wrong", (r: any) => r.productionRecordWrites = 1]) {
    const b = structuredClone(old); mutate(b); assert.throws(() => validateB17Baseline(b, source));
  }
});
test("actual CRM integration performs exactly 100 sequential calls with unchanged prompt/parameters and no fallback", async () => {
  const h = await run(), r = h.report;
  assert.equal(h.calls, 100); assert.equal(h.requests, 400); assert.equal(h.reads, 202); assert.equal(h.claims, 1);
  assert.equal(r.complete, true); assert.equal(r.summary.technicalSuccesses, 100);
  assert.equal(r.summary.correctExpectations, 765); assert.equal(r.summary.verdict, "REVIEW_REQUIRED");
  assert.equal(r.summary.performance.measuredCases, 100);
  assert.equal(r.summary.cloudCalls, 0); assert.equal(r.summary.productionUnchanged, true);
  assert.equal(r.productionSettingsWrites + r.productionRecordWrites + r.customerNotifications, 0);
  assert.ok(h.saved.some(s => s.calls === 0 && s.attempts === 1 && s.firstState === "INFERENCE_STARTED"));
  assert.ok(h.saved.every(s => s.goldHash === B17_CORPUS_SHA256));
  assert.equal(JSON.stringify(r).includes(token), false);
  assert.equal(failuresB17(r).ambiguousClassifications.length, 18);
  assert.equal(failuresB17(r).noteLanguageReviews.length, 100);
  const md = renderB17(r);
  for (const text of ["SYN-B17-100", "B1.6", "Výkonnosť", "765/800", "REVIEW_REQUIRED"]) assert.ok(md.includes(text));
});
test("low-volume noncritical differences are recorded but not upgraded to B1.6's 100% requirement", async () => {
  const h = await run({ regression: true });
  assert.equal(h.report.summary.wrongExpectations, 1);
  assert.equal(h.report.summary.verdict, "REVIEW_REQUIRED");
  assert.equal(failuresB17(h.report).classificationFailures.length, 1);
});
test("HTTP, schema, wrong model and safety errors cannot pass and never retry", async () => {
  const http = await run({ httpAt: 32 });
  assert.equal(http.calls, 32); assert.equal(http.report.summary.verdict, "FAIL");
  const schema = await run({ schemaAt: 100 });
  assert.equal(schema.calls, 100); assert.equal(schema.report.summary.technicalSuccesses, 99);
  assert.equal(schema.report.summary.verdict, "FAIL");
  const wrong = await run({ wrongModel: true });
  assert.equal(wrong.report.summary.technicalSuccesses, 99); assert.equal(wrong.report.summary.verdict, "FAIL");
  const changed = await run({ changeAt: 4 });
  assert.equal(changed.calls, 1); assert.equal(changed.report.summary.verdict, "FAIL");
});
test("interrupt, duplicate run and missing final snapshot remain explicitly unverified", async () => {
  const partial = await run({ abortAfter: 2 });
  assert.equal(partial.calls, 2); assert.equal(partial.report.summary.verdict, "REVIEW_REQUIRED");
  const duplicate = await run({ duplicate: true });
  assert.equal(duplicate.calls, 0); assert.equal(duplicate.report.summary.verdict, "REVIEW_REQUIRED");
  const final = await run({ finalError: true });
  assert.equal(final.report.summary.verdict, "REVIEW_REQUIRED");
  assert.equal(final.report.summary.productionUnchanged, null);
});
test("timing percentiles are measured, not invented for absent cases", () => {
  assert.equal(performanceMetrics([]).meanMs, null);
  assert.deepEqual(performanceMetrics([40, 10, 30, 20]), {
    measuredCases: 4, meanMs: 25, medianMs: 25, p95Ms: 40, minMs: 10, maxMs: 40,
  });
});
test("B1.6 discovery selects actual read-only evidence and blocks distinct completed reports", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "B17-baseline-test-"));
  const put = (name: string, r: any) => {
    const dir = path.join(root, name); fs.mkdirSync(dir, { mode: 0o700 });
    fs.writeFileSync(path.join(dir, "evidence.json"), JSON.stringify(r), { mode: 0o600 });
  };
  try {
    assert.throws(() => findB16Baseline(root, process.getuid!(), source), /NOT_FOUND/);
    put("B16-run-ONE", previous());
    assert.equal(findB16Baseline(root, process.getuid!(), source).report.phase, "B1.6");
    const other = previous(); other.rows[0].actualJson.note = "Iná syntetická poznámka.";
    other.rows[0].modelContent = JSON.stringify(other.rows[0].actualJson); put("B16-run-TWO", other);
    assert.throws(() => findB16Baseline(root, process.getuid!(), source), /AMBIGUOUS/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
