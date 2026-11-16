import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { snapshot } from "../ai-gateway-b4-pilot.cjs";
import { productionComparison } from "./b11-check.cjs";
import { analyzeSource } from "./source.cjs";
import { B12 } from "./b12-test";
import { B14_CORPUS_SHA256 } from "./b14-corpus";
import { B16_CORPUS, evaluateB16 } from "./b16-pilot";
import { B17_CORPUS, B17_CORPUS_SHA256 } from "./b17-corpus";
import { evaluateB17, validateB17Approval } from "./b17-pilot";
import { B18_CORPUS, B18_SPECIAL_IDS, evaluateB18, executeB18, validateB18Baselines,
  findB17Baseline, failuresB18, renderB18 } from "./b18-pilot";

const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
const token = "SYNTHETIC_B18_CREDENTIAL";
function current(version = 7) {
  return snapshot({ version, value: { routes: {}, gateway: { enabled: false,
    baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
    maxRetries: 0, maxTokens: null, temperature: null } } }, Object.keys(AI_SERVICES));
}
function rows(corpus: readonly any[] = B18_CORPUS): any[] {
  return corpus.map(c => {
    const actualJson = { ...Object.fromEntries(Object.entries(c.expected).map(([k, v]) =>
      [k, v ?? (k === "sentiment" ? "neutral" : k === "alertLevel" ? "none" : false)])), note: "Zákazník posiela správu." };
    return { ...c, actualJson, modelContent: JSON.stringify(actualJson), verdict: "PASS", state: "COMPLETED",
      httpStatus: 200, usedModel: B12.model, error: null, integrationProcessed: true,
      inferenceAttempts: 1, cloudCalls: 0, processingMs: 10,
      transportTraces: [{ stage: "INFERENCE", status: 200 }],
      production: productionComparison(current(), current(), current()) };
  });
}
/** All historical/model values in this file are synthetic fixtures, not real performance evidence. */
function baselines(failed = false) {
  const { input: _, ...configuration } = B12;
  const base = { complete: true, error: null, originalRequestSha256: source.requestSha256,
    before: current(), after: current(), production: productionComparison(current(), current(), current()),
    productionSettingsWrites: 0, productionRecordWrites: 0, customerNotifications: 0 };
  const rs16 = rows(B16_CORPUS);
  const b16 = { ...base, phase: "B1.6", kind: "LIVE_ISOLATED_35_SYNTHETIC_EMAILS",
    corpusSha256: B14_CORPUS_SHA256, request: { ...configuration, phase: "B1.6" },
    rows: rs16, summary: evaluateB16(rs16, true) };
  const rs17 = rows(B17_CORPUS);
  if (failed) {
    rs17[23].actualJson.wantsConsent = true;
    rs17[23].modelContent = JSON.stringify(rs17[23].actualJson);
  }
  const b17 = { ...base, phase: "B1.7", kind: "LIVE_ISOLATED_100_SYNTHETIC_EMAILS",
    corpusSha256: B17_CORPUS_SHA256, request: { ...configuration, phase: "B1.7" },
    independentReferenceApproval: validateB17Approval(source),
    baseline: { sha256: crypto.createHash("sha256").update(JSON.stringify(b16)).digest("hex") },
    rows: rs17, summary: evaluateB17(rs17, true) };
  return { b17, b16 };
}
async function run(opts: { regressionAt?: number; criticalAt?: number; httpAt?: number;
  schemaAt?: number; abortAt?: number; changeAt?: number; finalError?: boolean; duplicate?: boolean;
  wrongModel?: boolean; failedBaseline?: boolean } = {}) {
  const old = baselines(opts.failedBaseline), controller = new AbortController(), saved: any[] = [];
  let calls = 0, requests = 0, reads = 0, claims = 0;
  const expected = rows();
  const report = await executeB18({ ...old, reference: old.b17.after, source, token,
    signal: controller.signal,
    readSnapshot: async () => {
      reads++; if (opts.finalError && reads === 272) throw Error("PRIVATE_DATABASE_ERROR");
      return current(opts.changeAt && reads >= opts.changeAt ? 8 : 7);
    },
    claimOnce() { claims++; if (opts.duplicate) throw Error("B12_RUN_ALREADY_STARTED"); },
    persist(r) { saved.push({ calls, attempts: r.summary.inferenceAttempts, first: r.rows[0].state }); },
    progress(_, i) { if (i + 1 === opts.abortAt) controller.abort(); },
    fetch: (async (url, init) => {
      requests++; assert.equal(init?.redirect, "error");
      assert.ok(String(url).startsWith("https://ai.cordbloodcenter.com/gateway/"));
      if (String(url).endsWith("health/ready")) return new Response(null);
      if (String(url).endsWith("v1/models")) return Response.json({ object: "list", data: [{ id: B12.model }] });
      if (String(url).endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1", models: [{
        id: B12.model, revision: "SYNTHETIC_B18", operations: ["chat.completions"],
        inputModalities: ["text"], outputFormats: ["text", "json_object"], streaming: false,
        maxInputTokens: 8192, maxOutputTokens: 200,
      }] });
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(String(url), B12.endpoint); assert.equal(body.model, B12.model);
      assert.equal(body.max_tokens, 200); assert.equal(body.temperature, .1);
      assert.equal(body.stream, false); assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(body.messages.length, 2);
      assert.equal(body.messages[1].content, B18_CORPUS[calls - 1].input);
      assert.equal(body.expected, undefined); assert.equal(body.messages[0].content.includes("SYN-B17"), false);
      if (opts.httpAt === calls) return new Response(null, { status: 403 });
      const actual = { ...expected[calls - 1].actualJson };
      if (opts.regressionAt === calls) actual.sentiment = actual.sentiment === "negative" ? "neutral" : "negative";
      if (opts.criticalAt === calls) actual.wantsConsent = true;
      if (opts.schemaAt === calls) actual.wantsConsent = "false";
      return Response.json({ id: "SYNTHETIC_B18", object: "chat.completion", model: opts.wrongModel && calls === 1 ? "WRONG" : B12.model,
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(actual) } }] });
    }) as typeof fetch });
  return { report, calls, requests, reads, claims, saved };
}
test("reuses both original corpora without changing any reference, including 092 and all 35 nulls", () => {
  assert.deepEqual(B18_CORPUS.slice(0, 100), B17_CORPUS);
  assert.deepEqual(B18_CORPUS.slice(100), B16_CORPUS);
  assert.equal(B18_CORPUS.length, 135);
  assert.equal(new Set(B18_CORPUS.map(c => c.id)).size, 135);
  assert.equal(B18_CORPUS.flatMap(c => Object.values(c.expected)).filter(v => v === null).length, 35);
  assert.equal(B17_CORPUS[91].expected.wantsConsent, true);
  assert.deepEqual(B18_SPECIAL_IDS.map(id => id.slice(-3)), ["024", "025", "052", "061", "071", "074", "077", "088", "092"]);
});
test("independently rescored historical classification FAIL is accepted, tampering blocks before inference", () => {
  const old = baselines(true);
  assert.equal(validateB18Baselines(old.b17, old.b16, source).b17.summary.verdict, "FAIL");
  for (const mutate of [
    (b: any) => b.b17.rows[0].input += "changed",
    (b: any) => b.b17.rows[24].expected.wantsConsent = false,
    (b: any) => b.b17.rows[0].modelContent = "{}",
    (b: any) => b.b17.summary.correctExpectations++,
    (b: any) => b.b17.baseline.sha256 = "wrong",
    (b: any) => b.b17.request.max_tokens = 999,
    (b: any) => b.b17.productionRecordWrites++,
    (b: any) => b.b17.independentReferenceApproval.reviewer = "Changed",
    (b: any) => b.b17.rows[0].transportTraces = [],
    (b: any) => b.b16.rows[0].production.afterMatchesOriginal = false,
  ]) {
    const changed = structuredClone(old); mutate(changed);
    assert.throws(() => validateB18Baselines(changed.b17, changed.b16, source));
  }
});
test("exactly 135 sequential CRM calls, durable pre-send attempts, full field comparison and nine highlighted cases", async () => {
  const h = await run({ failedBaseline: true }), r = h.report;
  assert.equal(h.calls, 135); assert.equal(h.requests, 540); assert.equal(h.reads, 272); assert.equal(h.claims, 1);
  assert.equal(r.complete, true); assert.equal(r.summary.technicalSuccesses, 135);
  assert.equal(r.summary.b17.correctExpectations, 765); assert.equal(r.summary.b16.correctExpectations, 280);
  assert.equal(r.summary.verdict, "REVIEW_REQUIRED");
  assert.equal(r.comparison.fields.length, 1080); assert.equal(r.comparison.reviewRequired.length, 35);
  assert.equal(r.comparison.regressions.length, 0); assert.equal(r.comparison.repaired.length, 1);
  assert.equal(r.comparison.repaired[0].id, "SYN-B17-024");
  assert.deepEqual(r.comparison.specialCases.map((c: any) => c.id), B18_SPECIAL_IDS);
  assert.ok(r.comparison.specialCases[1].checks.some((c: any) => c.status === "REVIEW_REQUIRED"));
  assert.ok(r.comparison.specialCases[2].checks.some((c: any) => c.field === "wantsToCancel" && c.status === "REVIEW_REQUIRED"));
  assert.equal(r.rows[24].checks.find((c: any) => c.field === "wantsConsent").status, "REVIEW_REQUIRED");
  assert.equal(r.summary.productionUnchanged, true); assert.equal(r.summary.cloudCalls, 0);
  assert.equal(r.productionSettingsWrites + r.productionRecordWrites + r.customerNotifications, 0);
  assert.ok(h.saved.some(s => s.calls === 0 && s.attempts === 1 && s.first === "INFERENCE_STARTED"));
  assert.equal(JSON.stringify(r).includes(token), false);
  const failed = failuresB18(r);
  assert.equal(failed.noteReviews.length, 135); assert.equal(failed.reviewRequired.length, 35);
  assert.equal(failed.technicalFailures.length, 0);
  const md = renderB18(r);
  for (const text of ["1080", "135/135", "SYN-B17-092", "REVIEW_REQUIRED", "Gateway", "B1.6"])
    assert.ok(md.includes(text));
});
test("one noncritical new B1.7 regression fails even when average accuracy remains within bounds", async () => {
  const h = await run({ regressionAt: 1 });
  assert.equal(h.report.summary.verdict, "FAIL");
  assert.equal(h.report.comparison.regressions.length, 1);
  assert.ok(h.report.summary.reasons.includes("NEW_FIELD_REGRESSION"));
});
test("last B1.6 case is executed and covered by strict regression and critical tracking", async () => {
  const h = await run({ criticalAt: 135 });
  assert.equal(h.calls, 135); assert.equal(h.report.summary.verdict, "FAIL");
  assert.equal(h.report.comparison.regressions[0].id, B16_CORPUS[34].id);
  assert.ok(h.report.summary.criticalErrors.some((e: any) => e.id === B16_CORPUS[34].id));
  assert.ok(failuresB18(h.report).newCriticalErrors.length > 0);
});
test("authorization or production safety failures stop the combined run without starting the second set", async () => {
  const http = await run({ httpAt: 2 });
  assert.equal(http.calls, 2); assert.equal(http.report.complete, false); assert.equal(http.report.summary.verdict, "FAIL");
  assert.equal(http.report.comparison.regressions.length, 0);
  assert.ok(http.report.comparison.notComparable.length > 0);
  const changed = await run({ changeAt: 4 });
  assert.equal(changed.calls, 1); assert.equal(changed.report.summary.verdict, "FAIL");
});
test("invalid schema and wrong model are technical failures, not invented paired model regressions", async () => {
  const schema = await run({ schemaAt: 101 });
  assert.equal(schema.calls, 135); assert.equal(schema.report.summary.technicalSuccesses, 134);
  assert.equal(schema.report.summary.verdict, "FAIL");
  assert.ok(failuresB18(schema.report).technicalFailures.some((r: any) => r.id === B16_CORPUS[0].id));
  const wrong = await run({ wrongModel: true });
  assert.equal(wrong.report.summary.technicalSuccesses, 134);
  assert.equal(wrong.report.comparison.regressions.length, 0);
});
test("interruption, duplicate invocation and missing final snapshot cannot produce PASS", async () => {
  const abort = await run({ abortAt: 100 });
  assert.equal(abort.calls, 100); assert.equal(abort.report.summary.verdict, "REVIEW_REQUIRED");
  assert.equal(failuresB18(abort.report).notRunIds.length, 35);
  const duplicate = await run({ duplicate: true });
  assert.equal(duplicate.calls, 0); assert.equal(duplicate.report.error, "B12_RUN_ALREADY_STARTED");
  const final = await run({ finalError: true });
  assert.equal(final.report.summary.productionUnchanged, null);
  assert.equal(final.report.summary.verdict, "REVIEW_REQUIRED");
});
test("raw equality and all four critical error types remain checked without treating nulls as errors", () => {
  for (const [i, key, value, code] of [
    [0, "wantsConsent", true, "FALSE_POSITIVE_CONSENT"],
    [0, "wantsToCancel", true, "FALSE_POSITIVE_CANCELLATION"],
    [40, "wantsToCancel", false, "MISSED_EXPLICIT_CANCELLATION"],
    [60, "alertLevel", "warning", "CRITICAL_ALERT_REQUIRED"],
  ] as const) {
    const rs = rows(); rs[i].actualJson[key] = value; rs[i].modelContent = JSON.stringify(rs[i].actualJson);
    const s = evaluateB18(rs, true);
    assert.equal(s.verdict, "FAIL"); assert.ok(s.criticalErrors.some(e => e.code === code));
  }
  const rs = rows(); rs[51].actualJson.wantsToCancel = true; rs[51].modelContent = JSON.stringify(rs[51].actualJson);
  assert.equal(evaluateB18(rs, true).b17.falseCancellations, 0);
  rs[0].modelContent = "{}"; assert.equal(evaluateB18(rs, true).technicalSuccesses, 134);
});
test("actual named B17 evidence discovery is private, read-only and fails on missing or ambiguous baselines", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "B18-baseline-test-")), old = baselines();
  const put = (name: string, r: any) => {
    const dir = path.join(root, name); fs.mkdirSync(dir, { mode: 0o700 });
    fs.writeFileSync(path.join(dir, "B17_evidence.json"), JSON.stringify(r), { mode: 0o600 });
  };
  try {
    assert.throws(() => findB17Baseline(root, process.getuid!(), source, old.b16), /NOT_FOUND/);
    put("B17-run-ONE", old.b17);
    assert.equal(findB17Baseline(root, process.getuid!(), source, old.b16).report.phase, "B1.7");
    const other = { ...structuredClone(old.b17), startedAtUtc: "2026-11-16T15:00:00Z" };
    put("B17-run-TWO", other);
    assert.throws(() => findB17Baseline(root, process.getuid!(), source, old.b16), /AMBIGUOUS/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
