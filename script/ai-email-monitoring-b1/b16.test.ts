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
import { B14_CORPUS, B14_CORPUS_SHA256 } from "./b14-corpus";
import { evaluateB14 } from "./b14-pilot";
import { B15_CORPUS } from "./b15-pilot";
import { B16_CORPUS, B16_PROBLEM_IDS, evaluateB16, executeB16,
  validateB16Baseline, findB15Baseline, renderB16 } from "./b16-pilot";
const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
const token = "SYNTHETIC_B16_CREDENTIAL";
function current(version = 7) {
  return snapshot({ version, value: { routes: {}, gateway: { enabled: false,
    baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
    maxRetries: 0, maxTokens: null, temperature: null } } }, Object.keys(AI_SERVICES));
}
function rows(): any[] {
  return B16_CORPUS.map(c => ({ ...c, actualJson: { ...c.expected, note: "SYNTHETIC TEST ONLY" },
    verdict: "PASS", state: "COMPLETED", error: null, httpStatus: 200, usedModel: B12.model,
    integrationProcessed: true, inferenceAttempts: 1, cloudCalls: 0,
    transportTraces: [{ stage: "INFERENCE", status: 200 }],
    production: productionComparison(current(), current(), current()) }));
}
/** Synthetic fixtures. No measured B1.5 outcome is assumed. */
function previous(kind: "problem" | "soft" | "perfect" = "problem") {
  const rs = rows();
  if (kind === "problem") {
    rs[27].actualJson.sentiment = "negative"; rs[28].actualJson.sentiment = "negative";
    Object.assign(rs[30].actualJson, { doesNotAcceptContract: true, alertLevel: "warning" });
    Object.assign(rs[31].actualJson, { wantsToCancel: true, alertLevel: "critical" });
  } else if (kind === "soft") rs[0].actualJson.sentiment = "negative";
  rs.forEach(row => {
    row.modelContent = JSON.stringify(row.actualJson);
    const mismatch = B13_FIELDS.some(k => row.expected[k] !== row.actualJson[k]);
    row.verdict = mismatch ? "FAIL" : "PASS"; row.error = mismatch ? "B12_SEMANTIC_MISMATCH" : null;
  });
  const { input: _, ...configuration } = B12;
  return { phase: "B1.5", kind: "LIVE_ISOLATED_35_SYNTHETIC_EMAILS", complete: true, error: null,
    request: { ...configuration, phase: "B1.5" }, corpusSha256: B14_CORPUS_SHA256,
    originalRequestSha256: source.requestSha256, before: current(), after: current(),
    production: productionComparison(current(), current(), current()),
    productionSettingsWrites: 0, productionRecordWrites: 0, customerNotifications: 0,
    baselines: { b13: { sha256: "1".repeat(64) }, b14: { sha256: "2".repeat(64) } },
    rows: rs, summary: evaluateB14(structuredClone(rs), true, false) };
}
async function run(opts: { regression?: boolean; legacy?: boolean; abortAfter?: number; httpAt?: number;
  schemaAt?: number; finalError?: boolean; changeAt?: number; duplicate?: boolean; wrongModel?: boolean } = {}) {
  const baseline = previous(), controller = new AbortController();
  let calls = 0, reads = 0, claims = 0, requests = 0;
  const saved: any[] = [];
  const report = await executeB16({ previous: baseline, reference: baseline.after, source, token,
    signal: controller.signal,
    readSnapshot: async () => {
      reads++; if (opts.finalError && reads === 72) throw Error("PRIVATE_DB_ERROR");
      return current(opts.changeAt && reads >= opts.changeAt ? 8 : 7);
    },
    claimOnce() { claims++; if (opts.duplicate) throw Error("B12_RUN_ALREADY_STARTED"); },
    persist(value) { saved.push({ calls, value: structuredClone(value) }); },
    progress(_, i) { if (i + 1 === opts.abortAfter) controller.abort(); },
    fetch: (async (url, init) => {
      requests++; assert.equal(init?.redirect, "error");
      assert.ok(String(url).startsWith("https://ai.cordbloodcenter.com/gateway/"));
      if (String(url).endsWith("health/ready")) return new Response(null);
      if (String(url).endsWith("v1/models")) return Response.json({ object: "list", data: [{ id: B12.model }] });
      if (String(url).endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1", models: [{
        id: B12.model, revision: "SYNTHETIC_B16_RULES", operations: ["chat.completions"],
        inputModalities: ["text"], outputFormats: ["text", "json_object"], streaming: false,
        maxInputTokens: 8192, maxOutputTokens: 200,
      }] });
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(String(url), B12.endpoint); assert.equal(body.model, B12.model);
      assert.equal(body.max_tokens, 200); assert.equal(body.temperature, 0.1);
      assert.equal(body.stream, false); assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(body.messages.length, 2); assert.equal(body.expected, undefined);
      assert.equal(body.messages[1].content, B16_CORPUS[calls - 1].input);
      if (opts.httpAt === calls) return new Response(null, { status: 403 });
      const actual = { ...(opts.legacy ? baseline.rows[calls - 1].actualJson : B16_CORPUS[calls - 1].expected),
        note: "SYNTHETIC B16" };
      if (opts.regression && calls === 1) actual.sentiment = "negative";
      return Response.json({ id: "SYNTHETIC_B16", object: "chat.completion",
        model: opts.wrongModel && calls === 1 ? "UNEXPECTED" : B12.model,
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant",
          content: JSON.stringify(opts.schemaAt === calls ? { ...actual, wantsConsent: "false" } : actual) } }] });
    }) as typeof fetch,
  });
  return { report, calls, reads, claims, requests, saved };
}
test("B1.6 is the identical frozen B1.5/B1.4 corpus and highlights exactly four requested IDs", () => {
  assert.strictEqual(B16_CORPUS, B15_CORPUS); assert.strictEqual(B16_CORPUS, B14_CORPUS);
  assert.equal(B16_CORPUS.length * B13_FIELDS.length, 280);
  assert.deepEqual(B16_PROBLEM_IDS, ["SYN-B13-28", "SYN-B13-29", "SYN-B14-31", "SYN-B14-32"]);
});
test("strict 35/35 and 280/280 replace the old average accuracy acceptance", () => {
  assert.equal(evaluateB16(rows(), true).verdict, "PASS");
  const soft = rows(); soft[0].actualJson.sentiment = "negative";
  assert.equal(evaluateB14(structuredClone(soft), true).verdict, "PASS");
  const s = evaluateB16(soft, true);
  assert.equal(s.correctExpectations, 279); assert.equal(s.passedCases, 34);
  assert.equal(s.falseConsents + s.falseCancellations + s.missedCancellations + s.missedCriticalAlerts, 0);
  assert.equal(s.verdict, "FAIL"); assert.ok(s.reasons.includes("CLASSIFICATION_FIELDS_NOT_280_OF_280"));
  const errored = rows(); errored[0].error = "B12_SEMANTIC_MISMATCH";
  const e = evaluateB16(errored, true);
  assert.equal(e.correctExpectations, 280); assert.equal(e.passedCases, 34);
  assert.equal(e.verdict, "FAIL"); assert.ok(e.reasons.includes("CASES_NOT_35_OF_35"));
});
test("incomplete evidence is review unless a known error already makes 280/280 impossible", () => {
  const partial = rows();
  for (let i = 1; i < 35; i++) { partial[i].verdict = "NOT_RUN"; partial[i].inferenceAttempts = 0; }
  assert.equal(evaluateB16(structuredClone(partial), null, true).verdict, "REVIEW_REQUIRED");
  partial[0].actualJson.sentiment = "negative";
  assert.equal(evaluateB16(partial, null, true).verdict, "FAIL");
});
test("all existing hard gates still fail independently", () => {
  for (const [index, field, value] of [
    [30, "wantsConsent", true], [31, "wantsToCancel", true], [32, "wantsToCancel", false],
    [32, "alertLevel", "warning"], [33, "alertLevel", "warning"],
  ] as const) {
    const rs = rows(); rs[index].actualJson[field] = value;
    assert.equal(evaluateB16(rs, true).verdict, "FAIL");
  }
});
test("historical B1.5 is rescored by its own rules without retroactively changing its PASS", () => {
  const b15 = previous("soft"), before = JSON.stringify(b15);
  assert.equal(validateB16Baseline(b15, source).summary.verdict, "PASS");
  assert.equal(evaluateB16(structuredClone(b15.rows), true).verdict, "FAIL");
  assert.equal(JSON.stringify(b15), before);
  assert.equal(validateB16Baseline(previous(), source).summary.verdict, "FAIL");
});
test("changed source, parameters, gold, raw output, score or production proof blocks the baseline", () => {
  for (const mutate of [
    (b: any) => { b.originalRequestSha256 = "changed"; },
    (b: any) => { b.request.temperature = 0.2; },
    (b: any) => { b.rows[0].expected.wantsConsent = true; },
    (b: any) => { b.rows[0].input += "changed"; },
    (b: any) => { b.rows[0].modelContent = "{}"; },
    (b: any) => { b.summary.correctExpectations = 280; },
    (b: any) => { b.productionRecordWrites = 1; },
    (b: any) => { b.after.version = 8; },
  ]) {
    const b = structuredClone(previous()); mutate(b);
    assert.throws(() => validateB16Baseline(b, source));
  }
});
test("35 CRM integrations preserve prompt parameters, save attempts before send and compare all cases", async () => {
  const h = await run(), r = h.report;
  assert.equal(r.summary.verdict, "PASS"); assert.equal(r.summary.correctExpectations, 280);
  assert.equal(r.summary.passedCases, 35); assert.equal(h.calls, 35); assert.equal(h.requests, 140);
  assert.equal(h.reads, 72); assert.equal(h.claims, 1);
  assert.equal(r.comparison.cases.length, 35); assert.equal(r.comparison.problemCases.length, 4);
  assert.equal(r.comparison.repaired.length, 6); assert.equal(r.comparison.regressions.length, 0);
  assert.equal(r.comparison.stillWrong.length, 0);
  assert.equal(r.productionRecordWrites + r.productionSettingsWrites + r.customerNotifications, 0);
  assert.equal(r.summary.cloudCalls, 0); assert.equal(r.summary.productionUnchanged, true);
  assert.ok(h.saved.some(p => p.calls === 0 && p.value.summary.inferenceAttempts === 1 &&
    p.value.rows[0].state === "INFERENCE_STARTED"));
  assert.equal(JSON.stringify(r).includes(token), false);
  const md = renderB16(r);
  assert.ok(md.includes("280/280")); assert.ok(md.includes("35/35"));
  assert.ok(md.includes("SYN-B14-35")); assert.ok(md.includes("SYN-B14-31"));
  assert.ok(md.includes("Kontrola produkčnej konfigurácie"));
});
test("one new noncritical regression fails despite fixing all six previous discrepancies", async () => {
  const h = await run({ regression: true });
  assert.equal(h.report.summary.correctExpectations, 279);
  assert.equal(h.report.summary.verdict, "FAIL");
  assert.equal(h.report.comparison.repaired.length, 6); assert.equal(h.report.comparison.regressions.length, 1);
});
test("unchanged previous errors remain failures, without being mislabeled as new regressions", async () => {
  const h = await run({ legacy: true });
  assert.equal(h.report.summary.verdict, "FAIL");
  assert.equal(h.report.comparison.stillWrong.length, 6); assert.equal(h.report.comparison.regressions.length, 0);
});
test("HTTP, parser and wrong-model failures cannot pass or trigger retries", async () => {
  const http = await run({ httpAt: 32 });
  assert.equal(http.calls, 32); assert.equal(http.report.summary.verdict, "FAIL");
  const schema = await run({ schemaAt: 35 });
  assert.equal(schema.calls, 35); assert.equal(schema.report.summary.parserErrors, 1);
  assert.equal(schema.report.summary.verdict, "FAIL");
  const wrong = await run({ wrongModel: true });
  assert.equal(wrong.report.summary.verdict, "FAIL");
});
test("interrupted, changed, duplicate and unverified runs never produce PASS", async () => {
  const partial = await run({ abortAfter: 2 });
  assert.equal(partial.calls, 2); assert.equal(partial.report.summary.verdict, "REVIEW_REQUIRED");
  const final = await run({ finalError: true });
  assert.equal(final.report.summary.verdict, "REVIEW_REQUIRED");
  const changed = await run({ changeAt: 4 });
  assert.equal(changed.calls, 1); assert.equal(changed.report.summary.verdict, "FAIL");
  const duplicate = await run({ duplicate: true });
  assert.equal(duplicate.calls, 0); assert.equal(duplicate.report.summary.verdict, "REVIEW_REQUIRED");
});
test("B1.5 report selection is read-only, rejects ambiguity and ignores incomplete or other phases", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "B16-report-test-"));
  const write = (name: string, report: any) => {
    const dir = path.join(root, name); fs.mkdirSync(dir, { mode: 0o700 });
    const file = path.join(dir, "evidence.json"); fs.writeFileSync(file, JSON.stringify(report), { mode: 0o600 });
    return file;
  };
  try {
    write("B14-run-OLD", { phase: "B1.4", complete: true });
    write("B15-run-PARTIAL", { phase: "B1.5", complete: false });
    assert.throws(() => findB15Baseline(root, process.getuid!(), source), /NOT_FOUND/);
    const report = previous(), file = write("B15-run-VALID", report), bytes = fs.readFileSync(file);
    assert.equal(findB15Baseline(root, process.getuid!(), source).file, file);
    assert.ok(fs.readFileSync(file).equals(bytes));
    write("B15-run-COPY", report);
    assert.doesNotThrow(() => findB15Baseline(root, process.getuid!(), source));
    const other = structuredClone(report); other.rows[0].actualJson.note = "Other synthetic note";
    other.rows[0].modelContent = JSON.stringify(other.rows[0].actualJson);
    write("B15-run-OTHER", other);
    assert.throws(() => findB15Baseline(root, process.getuid!(), source), /AMBIGUOUS/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
