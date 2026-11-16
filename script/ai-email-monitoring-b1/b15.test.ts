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
import { B13_CORPUS, B13_FIELDS } from "./b13-corpus";
import { B13_CORPUS_SHA256, evaluateB13 } from "./b13-pilot";
import { B14_CORPUS, B14_CORPUS_SHA256 } from "./b14-corpus";
import { evaluateB14, validateB14Baseline } from "./b14-pilot";
import { B15_CORPUS, B15_PROBLEM_IDS, executeB15, renderB15, validateB15Baselines } from "./b15-pilot";
import { findB14Baseline } from "./b15-baseline-files";
const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
const token = "SYNTHETIC_B15_CREDENTIAL";
function current(version = 7) {
  return snapshot({ version, value: { routes: {}, gateway: { enabled: false,
    baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
    maxRetries: 0, maxTokens: null, temperature: null } } }, Object.keys(AI_SERVICES));
}
function rows(corpus: readonly any[] = B15_CORPUS): any[] {
  return corpus.map(c => ({ ...c, actualJson: { ...c.expected, note: "SYNTHETIC TEST ONLY" },
    verdict: "PASS", state: "COMPLETED", error: null, httpStatus: 200, usedModel: B12.model,
    integrationProcessed: true, inferenceAttempts: 1, cloudCalls: 0,
    transportTraces: [{ stage: "INFERENCE", status: 200 }],
    production: productionComparison(current(), current(), current()) }));
}
function finalizeRows(rs: any[]) {
  for (const row of rs) {
    row.modelContent = JSON.stringify(row.actualJson);
    const mismatch = B13_FIELDS.some(k => row.actualJson[k] !== row.expected[k]);
    row.verdict = mismatch ? "FAIL" : "PASS"; row.error = mismatch ? "B12_SEMANTIC_MISMATCH" : null;
  }
}
/** Synthetic fixtures, not measured B1.4 results. */
function baselines() {
  const r13 = rows(B13_CORPUS);
  Object.assign(r13[11].actualJson, { doesNotAcceptContract: true, alertLevel: "warning" });
  Object.assign(r13[16].actualJson, { wantsToCancel: true, alertLevel: "critical" });
  for (let i = 20; i < 25; i++) Object.assign(r13[i].actualJson, { sentiment: "negative", alertLevel: "warning" });
  r13[25].actualJson.alertLevel = "warning"; finalizeRows(r13);
  const common = { complete: true, error: null, originalRequestSha256: source.requestSha256,
    productionRecordWrites: 0, productionSettingsWrites: 0, customerNotifications: 0,
    before: current(), after: current(), production: productionComparison(current(), current(), current()) };
  const b13 = { ...common, phase: "B1.3", kind: "LIVE_ISOLATED_30_SYNTHETIC_EMAILS",
    corpusSha256: B13_CORPUS_SHA256, rows: r13, summary: evaluateB13(structuredClone(r13), true) };
  const r14 = rows();
  for (const id of B15_PROBLEM_IDS) {
    const i = B15_CORPUS.findIndex(c => c.id === id);
    if (r14[i].category === "rejection") Object.assign(r14[i].actualJson, { wantsToCancel: true, alertLevel: "critical" });
    else r14[i].actualJson.alertLevel = "warning";
  }
  finalizeRows(r14);
  const b14 = { ...common, phase: "B1.4", kind: "LIVE_ISOLATED_35_SYNTHETIC_EMAILS",
    corpusSha256: B14_CORPUS_SHA256, rows: r14, summary: evaluateB14(structuredClone(r14), true),
    baseline: { sha256: validateB14Baseline(b13, source).sha256 } };
  return { b13, b14 };
}
async function run(opts: { legacy?: boolean; badTypeAt?: number; httpAt?: number; abortAfter?: number;
  finalError?: boolean; changeAt?: number; duplicate?: boolean; wrongModel?: boolean } = {}) {
  const { b13, b14 } = baselines(), controller = new AbortController();
  let calls = 0, reads = 0, requests = 0, claims = 0;
  const persisted: any[] = [];
  const report = await executeB15({ baseline: b13, previous: b14, reference: b14.after, token, source,
    signal: controller.signal,
    readSnapshot: async () => {
      reads++; if (opts.finalError && reads === 72) throw Error("PRIVATE_DB_ERROR");
      return current(opts.changeAt && reads >= opts.changeAt ? 8 : 7);
    },
    claimOnce() { claims++; if (opts.duplicate) throw Error("B12_RUN_ALREADY_STARTED"); },
    persist(value) { persisted.push({ calls, value: structuredClone(value) }); },
    progress(_, i) { if (i + 1 === opts.abortAfter) controller.abort(); },
    fetch: (async (url, init) => {
      requests++;
      assert.ok(String(url).startsWith("https://ai.cordbloodcenter.com/gateway/"));
      assert.equal(init?.redirect, "error");
      if (String(url).endsWith("health/ready")) return new Response(null);
      if (String(url).endsWith("v1/models")) return Response.json({ object: "list", data: [{ id: B12.model }] });
      if (String(url).endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1", models: [{
        id: B12.model, revision: "SYNTHETIC_B15_RULES", operations: ["chat.completions"],
        inputModalities: ["text"], outputFormats: ["text", "json_object"], streaming: false,
        maxInputTokens: 8192, maxOutputTokens: 200,
      }] });
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(String(url), B12.endpoint); assert.equal(body.model, B12.model);
      assert.equal(body.max_tokens, 200); assert.equal(body.temperature, 0.1);
      assert.equal(body.stream, false); assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(body.messages.length, 2); assert.equal(body.expected, undefined);
      assert.equal(body.messages[1].content, B15_CORPUS[calls - 1].input);
      if (opts.httpAt === calls) return new Response(null, { status: 403 });
      const actual = opts.legacy ? b14.rows[calls - 1].actualJson :
        { ...B15_CORPUS[calls - 1].expected, note: "SYNTHETIC B15" };
      return Response.json({ id: "SYNTHETIC_B15", object: "chat.completion",
        model: opts.wrongModel && calls === 1 ? "UNEXPECTED" : B12.model,
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant",
          content: JSON.stringify(opts.badTypeAt === calls ? { ...actual, wantsConsent: "false" } : actual) } }] });
    }) as typeof fetch,
  });
  return { report, calls, reads, requests, claims, persisted };
}
test("B1.5 reuses all 35 B1.4 objects and 280 labels, with exactly the requested problem IDs", () => {
  assert.strictEqual(B15_CORPUS, B14_CORPUS);
  assert.equal(B15_CORPUS.length, 35);
  assert.deepEqual(B15_PROBLEM_IDS, ["SYN-B13-18", "SYN-B13-20", "SYN-B13-26", "SYN-B13-28",
    "SYN-B13-29", "SYN-B13-30", "SYN-B14-32", "SYN-B14-34"]);
});
test("historical classification FAIL is valid evidence, but changed gold, source, score or raw JSON is rejected", () => {
  const { b13, b14 } = baselines();
  assert.equal(validateB15Baselines(b13, b14, source).previous.summary.verdict, "FAIL");
  for (const mutate of [
    (r: any) => { r.rows[0].input += "modified"; },
    (r: any) => { r.rows[0].expected.wantsConsent = true; },
    (r: any) => { r.summary.correctExpectations++; },
    (r: any) => { r.originalRequestSha256 = "changed"; },
    (r: any) => { r.baseline.sha256 = "wrong"; },
    (r: any) => { r.productionRecordWrites = 1; },
    (r: any) => { r.after.version = 8; },
    (r: any) => { r.rows[0].modelContent = "{}"; },
  ]) {
    const r = structuredClone(b14); mutate(r);
    assert.throws(() => validateB15Baselines(b13, r, source));
  }
});
test("35 CRM integrations preserve wire settings, durable attempt counts, zero writes and both comparisons", async () => {
  const h = await run(), s = h.report.summary, c = h.report.comparison;
  assert.equal(s.verdict, "PASS"); assert.equal(s.correctExpectations, 280);
  assert.equal(h.calls, 35); assert.equal(h.requests, 140); assert.equal(h.reads, 72); assert.equal(h.claims, 1);
  assert.equal(c.vsB13.repaired.length, 15); assert.equal(c.vsB13.regressions.length, 0);
  assert.equal(c.vsB14.stillWrong.length, 0); assert.equal(c.vsB14.regressions.length, 0);
  assert.equal(c.problemCases.length, 8);
  assert.equal(c.problemCases.find((r: any) => r.id === "SYN-B14-32").b13, null);
  assert.equal(c.problemCases.find((r: any) => r.id === "SYN-B14-34").b13Available, false);
  assert.equal(c.accuracy.b13Original.expectations, 240); assert.equal(c.accuracy.b14Total.expectations, 280);
  assert.equal(c.accuracy.b15Total.expectations, 280);
  assert.equal(s.falseConsents + s.falseCancellations + s.missedCancellations + s.missedCriticalAlerts, 0);
  assert.equal(h.report.productionSettingsWrites + h.report.productionRecordWrites + h.report.customerNotifications, 0);
  assert.equal(s.cloudCalls, 0);
  assert.ok(h.persisted.some(p => p.calls === 0 && p.value.summary.inferenceAttempts === 1 &&
    p.value.rows[0].state === "INFERENCE_STARTED"));
  assert.equal(JSON.stringify(h.report).includes(token), false);
  const md = renderB15(h.report);
  assert.ok(md.includes("280/280")); assert.ok(md.includes("225/240"));
  assert.ok(md.includes("SYN-B14-34")); assert.ok(md.includes("SYN-B14-35"));
});
test("unchanged previous mistakes fail B1.5 and are not described as new regressions", async () => {
  const h = await run({ legacy: true });
  assert.equal(h.report.summary.verdict, "FAIL");
  assert.equal(h.report.comparison.vsB14.regressions.length, 0);
  assert.ok(h.report.comparison.vsB14.stillWrong.length > 0);
  assert.ok(h.report.summary.falseCancellations > 0);
  assert.ok(h.report.summary.missedCriticalAlerts > 0);
});
test("new regressions remain visible even when average accuracy is high", async () => {
  const h = await run({ badTypeAt: 35 });
  assert.equal(h.calls, 35); assert.equal(h.report.summary.verdict, "FAIL");
  assert.equal(h.report.summary.parserErrors, 1);
  assert.ok(h.report.comparison.vsB14.regressions.some((d: any) => d.id === "SYN-B14-35"));
  const wrong = await run({ wrongModel: true });
  assert.equal(wrong.report.summary.verdict, "FAIL");
});
test("HTTP failure stops without retry, and interrupted or unverified runs cannot pass", async () => {
  const http = await run({ httpAt: 32 });
  assert.equal(http.calls, 32); assert.equal(http.report.summary.verdict, "FAIL");
  const partial = await run({ abortAfter: 2 });
  assert.equal(partial.calls, 2); assert.equal(partial.report.summary.verdict, "REVIEW_REQUIRED");
  const final = await run({ finalError: true });
  assert.equal(final.report.summary.verdict, "REVIEW_REQUIRED");
  const changed = await run({ changeAt: 4 });
  assert.equal(changed.calls, 1); assert.equal(changed.report.summary.verdict, "FAIL");
  const duplicate = await run({ duplicate: true });
  assert.equal(duplicate.calls, 0); assert.equal(duplicate.report.summary.verdict, "REVIEW_REQUIRED");
});
function withFiles(action: (root: string, b13: any, b14: any, write: (name: string, r: any) => string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "B15-report-test-"));
  const { b13, b14 } = baselines();
  const write = (name: string, r: any) => {
    const dir = path.join(root, name); fs.mkdirSync(dir, { mode: 0o700 });
    const file = path.join(dir, "evidence.json");
    fs.writeFileSync(file, JSON.stringify(r), { mode: 0o600 }); return file;
  };
  try { action(root, b13, b14, write); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test("read-only discovery finds exactly one actual completed B1.4 report and ignores incomplete runs", () => {
  withFiles((root, b13, b14, write) => {
    write("B14-run-PARTIAL", { phase: "B1.4", complete: false });
    assert.throws(() => findB14Baseline(root, process.getuid!(), b13, source), /NOT_FOUND/);
    const file = write("B14-run-VALID", b14);
    const before = fs.readFileSync(file);
    const found = findB14Baseline(root, process.getuid!(), b13, source);
    assert.equal(found.file, file); assert.equal(found.report.summary.verdict, "FAIL");
    assert.ok(fs.readFileSync(file).equals(before));
    write("B14-run-COPY", b14);
    assert.doesNotThrow(() => findB14Baseline(root, process.getuid!(), b13, source));
  });
});
test("multiple distinct complete baselines are rejected rather than guessing the newest", () => {
  withFiles((root, b13, b14, write) => {
    write("B14-run-ONE", b14);
    const different = structuredClone(b14);
    different.rows[0].actualJson.note = "Different synthetic explanation";
    different.rows[0].modelContent = JSON.stringify(different.rows[0].actualJson);
    write("B14-run-TWO", different);
    assert.throws(() => findB14Baseline(root, process.getuid!(), b13, source), /AMBIGUOUS/);
  });
});
test("unsafe permissions, symlinks, corruption and invalid complete baselines are blocked", () => {
  withFiles((root, b13, b14, write) => {
    const file = write("B14-run-ONE", b14);
    fs.chmodSync(file, 0o644);
    assert.throws(() => findB14Baseline(root, process.getuid!(), b13, source), /UNSAFE/);
    fs.chmodSync(file, 0o600); fs.writeFileSync(file, "{broken");
    assert.throws(() => findB14Baseline(root, process.getuid!(), b13, source), /JSON_INVALID/);
    fs.unlinkSync(file); fs.symlinkSync(path.join(root, "other.json"), file);
    fs.writeFileSync(path.join(root, "other.json"), JSON.stringify(b14), { mode: 0o600 });
    assert.throws(() => findB14Baseline(root, process.getuid!(), b13, source), /UNSAFE/);
  });
});
