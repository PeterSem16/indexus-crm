import crypto from "node:crypto";
import { emailMonitoringSchema } from "../../server/lib/ai/email-monitoring-contract";
import { B12, executeB12 } from "./b12-test";
import { B13_CORPUS, B13_CATEGORIES, B13_FIELDS } from "./b13-corpus";
import { productionComparison } from "./b11-check.cjs";
export const B13_CORPUS_SHA256 = crypto.createHash("sha256").update(JSON.stringify(B13_CORPUS)).digest("hex");
export function validateB13Corpus() {
  if (B13_CORPUS.length !== 30 || new Set(B13_CORPUS.map(c => c.id)).size !== 30 ||
    new Set(B13_CORPUS.map(c => c.input)).size !== 30) throw Error("B13_CORPUS_INVALID");
  for (const category of Object.keys(B13_CATEGORIES))
    if (B13_CORPUS.filter(c => c.category === category).length !== 5) throw Error("B13_CATEGORY_COUNT_INVALID");
  for (const c of B13_CORPUS)
    if (c.input.length > 2000 || Object.keys(c.expected).length !== 8 ||
      !B13_FIELDS.every(k => Object.hasOwn(c.expected, k)) ||
      !emailMonitoringSchema.safeParse({ ...c.expected, note: "" }).success)
      throw Error("B13_EXPECTATIONS_INVALID");
}
export function evaluateB13(rows: any[], productionUnchanged: boolean | null, interrupted = false) {
  if (rows.length !== 30) throw Error("B13_REPORT_ROWS_INVALID");
  let correct = 0, falseConsents = 0, missedCancellations = 0, httpErrors = 0, parserErrors = 0;
  let contractErrors = 0, transportErrors = 0, integrationErrors = 0, attempts = 0, cloud = 0, executed = 0;
  const categories: Record<string, any> = Object.fromEntries(Object.entries(B13_CATEGORIES).map(([key, label]) =>
    [key, { label, total: 5, executed: 0, passed: 0, correctExpectations: 0, totalExpectations: 40 }]));
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], testCase = B13_CORPUS[i];
    // Expectations come only from the immutable corpus, never from returned rows/model content.
    if (row.id !== testCase.id || row.category !== testCase.category) throw Error("B13_REPORT_IDENTITY_INVALID");
    attempts += row.inferenceAttempts; cloud += row.cloudCalls;
    if (row.verdict === "NOT_RUN") continue;
    executed++; categories[row.category].executed++;
    const rawValid = emailMonitoringSchema.safeParse(row.actualJson).success;
    const contractValid = row.integrationProcessed === true && rawValid;
    if (row.httpStatus === 200 && !rawValid) contractErrors++;
    const fields = B13_FIELDS.map(field => ({
      field, expected: testCase.expected[field], actual: row.actualJson?.[field] ?? null,
      pass: contractValid && row.actualJson[field] === testCase.expected[field],
    }));
    row.checks = fields;
    const count = fields.filter(f => f.pass).length;
    correct += count; categories[row.category].correctExpectations += count;
    const actual = row.actualJson;
    if (!testCase.expected.wantsConsent && actual?.wantsConsent === true) falseConsents++;
    if (testCase.expected.wantsToCancel && actual?.wantsToCancel !== true) missedCancellations++;
    if (row.transportTraces.some((t: any) => typeof t.status === "number" && t.status !== 200)) httpErrors++;
    if (row.error === "email_monitoring_invalid_analysis") parserErrors++;
    if (/transport_error|ABORT|TIMEOUT|RESPONSE_TOO_LARGE/.test(row.error || "")) transportErrors++;
    if (row.httpStatus === 200 && (!row.integrationProcessed || row.usedModel !== B12.model) ||
      /^ai_internal_(?:invalid_discovery|model_unavailable|token_limit_exceeded)/.test(row.error || "")) integrationErrors++;
    row.verdict = !row.error && contractValid && count === 8 && row.httpStatus === 200 &&
      row.usedModel === B12.model && row.inferenceAttempts === 1 && row.cloudCalls === 0 ? "PASS" : "FAIL";
    if (row.verdict === "PASS") categories[row.category].passed++;
    else if (!row.error) row.error = !rawValid ? "B13_INVALID_RAW_JSON_CONTRACT" : "B13_EXPECTATION_MISMATCH";
  }
  for (const c of Object.values(categories)) {
    c.caseSuccessPct = 100 * c.passed / c.total;
    c.fieldSuccessPct = 100 * c.correctExpectations / c.totalExpectations;
  }
  const reasons: string[] = [];
  if (falseConsents) reasons.push("FALSE_POSITIVE_CONSENT");
  if (missedCancellations) reasons.push("MISSED_EXPLICIT_CANCELLATION");
  if (httpErrors || parserErrors || contractErrors || transportErrors) reasons.push("HTTP_TRANSPORT_OR_JSON_PARSER_ERROR");
  if (integrationErrors) reasons.push("CRM_INTEGRATION_ERROR");
  if (cloud) reasons.push("CLOUD_FALLBACK_DETECTED");
  if (attempts > 30) reasons.push("INFERENCE_BUDGET_EXCEEDED");
  if (productionUnchanged === false) reasons.push("PRODUCTION_CONFIGURATION_CHANGED");
  if (executed === 30 && correct / 240 < 0.9) reasons.push("FIELD_ACCURACY_BELOW_90_PERCENT");
  const incomplete = executed !== 30 || attempts !== 30 || productionUnchanged === null || interrupted;
  const verdict = reasons.length ? "FAIL" : incomplete ? "REVIEW_REQUIRED" : "PASS";
  if (executed !== 30) reasons.push("NOT_ALL_30_CASES_EXECUTED");
  if (attempts !== 30) reasons.push("NOT_30_SINGLE_INFERENCE_ATTEMPTS");
  if (productionUnchanged === null) reasons.push("PRODUCTION_CONFIGURATION_UNVERIFIED");
  if (interrupted) reasons.push("PILOT_INTERRUPTED_OR_INCOMPLETE");
  return { verdict, reasons, totalCases: 30, executedCases: executed,
    passedCases: rows.filter(r => r.verdict === "PASS").length,
    caseSuccessPct: 100 * rows.filter(r => r.verdict === "PASS").length / 30,
    correctExpectations: correct, totalExpectations: 240, fieldSuccessPct: 100 * correct / 240,
    categories, falseConsents, missedCancellations, httpErrors, parserErrors, contractErrors,
    transportErrors, integrationErrors, inferenceAttempts: attempts, cloudCalls: cloud, productionUnchanged };
}
export type EmailPilotOptions = {
  token: string; source: any; reference: any; readSnapshot: () => Promise<any>;
  claimOnce: () => void; fetch: typeof fetch; signal?: AbortSignal;
  persist: (report: any) => void; progress?: (row: any, index: number) => void;
  resumeReport?: any;
};
export function executeB13(options: EmailPilotOptions) {
  validateB13Corpus();
  return executeEmailPilot(options, { phase: "B1.3", corpus: B13_CORPUS,
    corpusSha256: B13_CORPUS_SHA256, evaluate: evaluateB13 });
}
export async function executeEmailPilot(options: EmailPilotOptions, definition: {
  phase: string; corpus: readonly { id: string; category: string; input: string; expected: any }[];
  corpusSha256: string; evaluate: typeof evaluateB13 | ((rows: any[], safe: boolean | null, interrupted: boolean) => any);
  recordTiming?: boolean;
  requestTimeoutMs?: number;
  warmup?: boolean;
  decorate?: (report: any) => void;
}) {
  const prefix = definition.phase.replace(".", "");
  const report: any = options.resumeReport ? structuredClone(options.resumeReport) : {
    phase: definition.phase, kind: `LIVE_ISOLATED_${definition.corpus.length}_SYNTHETIC_EMAILS`,
    startedAtUtc: new Date().toISOString(), request: { ...B12, phase: definition.phase, input: undefined },
    corpusSha256: definition.corpusSha256, originalRequestSha256: options.source.requestSha256,
    before: null, after: null, production: null, error: null, complete: false,
    productionSettingsWrites: 0, productionRecordWrites: 0, customerNotifications: 0,
    rows: definition.corpus.map(c => ({ id: c.id, category: c.category, input: c.input,
      expected: c.expected, actualJson: null, modelContent: null, state: "NOT_STARTED", verdict: "NOT_RUN", httpStatus: null,
      error: null, inferenceAttempts: 0, cloudCalls: 0, transportTraces: [], integrationProcessed: false })),
    summary: null };
  const previousElapsedMs = report.runtime?.elapsedMs ?? 0;
  const previousError = report.error;
  report.complete = false;
  report.error = null;
  delete report.finishedAtUtc;
  report.executionProcess = { pid: process.pid };
  report.segments ??= [];
  const segment: any = { startedAtUtc: new Date().toISOString(), mode: options.resumeReport ? "RESUME" : "NEW",
    previousError: previousError ?? null };
  report.segments.push(segment);
  let productionUnchanged: boolean | null = null;
  const runStart = performance.now();
  const save = () => {
    report.runtime = { elapsedMs: previousElapsedMs + performance.now() - runStart, totalDeadlineMs: null,
      requestTimeoutMs: definition.requestTimeoutMs ?? 30_000,
      termination: options.signal?.aborted
        ? (["SIGINT", "SIGTERM", "RUN_DEADLINE"].includes(options.signal.reason) ? options.signal.reason : "CALLER_ABORT")
        : report.finishedAtUtc ? report.error ? "ERROR" : "FINISHED" : "RUNNING",
      limitation: "No in-process total deadline. External shell, session, proxy and service deadlines are not controlled here; SIGKILL cannot be recorded." };
    report.summary = definition.evaluate(report.rows, productionUnchanged, !report.complete);
    definition.decorate?.(report);
    if (JSON.stringify(report).includes(options.token)) throw Error(prefix + "_SECRET_ECHO");
    options.persist(report);
  };
  try {
    const entrySnapshot = await options.readSnapshot();
    segment.before = entrySnapshot;
    if (!productionComparison(options.reference, entrySnapshot, entrySnapshot).beforeMatchesOriginal)
      throw Error(prefix + "_PRODUCTION_CHANGED_BEFORE_TEST");
    if (!options.resumeReport) report.before = entrySnapshot;
    options.claimOnce();
    save(); // Publish fixed inputs/expectations before the first inference.
    if (options.resumeReport && report.warmup?.state === "RUNNING" && report.warmup.inferenceAttempts === 0)
      delete report.warmup;
    if (definition.warmup && !report.warmup) {
      report.warmup = { state: "RUNNING", inferenceAttempts: 0, excludedFromScores: true };
      save();
      const start = performance.now();
      const warmup = await executeB12({ ...options, claimOnce() {},
        pilotCase: undefined, requestTimeoutMs: definition.requestTimeoutMs,
        beforeInference() { report.warmup.inferenceAttempts = 1; save(); } });
      report.warmup = { ...warmup, state: "COMPLETED", excludedFromScores: true,
        processingMs: performance.now() - start };
      save();
      if (!warmup.integrationProcessed || warmup.httpStatus !== 200 || warmup.usedModel !== B12.model ||
        warmup.inferenceAttempts !== 1 || warmup.cloudCalls !== 0 ||
        warmup.error && warmup.error !== "B12_SEMANTIC_MISMATCH" ||
        !warmup.production?.beforeMatchesOriginal || !warmup.production?.afterMatchesOriginal ||
        !warmup.production?.unchangedDuringCheck) throw Error(prefix + "_WARMUP_FAILED");
    }
    for (let i = 0; i < definition.corpus.length; i++) {
      if (options.signal?.aborted) { report.error = prefix + "_CALLER_ABORT"; break; }
      const c = definition.corpus[i];
      // A durable pre-send claim with no response can never be safely re-sent.
      if (report.rows[i].inferenceAttempts === 1 && report.rows[i].state !== "COMPLETED") {
        Object.assign(report.rows[i], { state: "INFERENCE_UNCERTAIN", verdict: "FAIL",
          error: prefix + "_INFERENCE_OUTCOME_UNCERTAIN" });
        save();
        continue;
      }
      if (report.rows[i].state === "COMPLETED") continue;
      report.rows[i].state = "RUNNING";
      save();
      const start = performance.now();
      const single = await executeB12({ ...options, claimOnce() {}, requestTimeoutMs: definition.requestTimeoutMs,
        pilotCase: { ...c, phase: definition.phase,
        expected: Object.fromEntries(Object.entries(c.expected).filter(([, v]) => v !== null)) as any },
        beforeInference() {
          report.rows[i].state = "INFERENCE_STARTED";
          report.rows[i].inferenceAttempts = 1;
          save(); // Durable attempt count before network send; never resume/retry uncertain work.
        },
      });
      report.rows[i] = {
        ...report.rows[i], actualJson: single.modelJson, crmResult: single.result, modelContent: single.modelContent,
        state: "COMPLETED", verdict: single.verdict, httpStatus: single.httpStatus, usedModel: single.usedModel,
        integrationProcessed: single.integrationProcessed, error: single.error,
        inferenceAttempts: single.inferenceAttempts, cloudCalls: single.cloudCalls,
        transportTraces: single.transportTraces, production: single.production,
        timeout: single.timeout,
        errorIdentity: single.errorIdentity ?? null,
        startedAtUtc: single.startedAtUtc, finishedAtUtc: single.finishedAtUtc,
        ...(definition.recordTiming ? { processingMs: performance.now() - start } : {}),
      };
      const safe = single.production?.beforeMatchesOriginal === true &&
        single.production?.afterMatchesOriginal === true && single.production?.unchangedDuringCheck === true;
      if (!safe || single.cloudCalls) report.error = prefix + "_SAFETY_CHECK_FAILED";
      if (single.transportTraces.some((t: any) => [401, 403, 429].includes(t.status)))
        report.error ||= prefix + "_AUTHORIZATION_OR_RATE_LIMIT_FAILURE";
      save();
      options.progress?.(report.rows[i], i);
      if (report.error) break;
    }
    report.complete = report.rows.every((r: any) => r.state === "COMPLETED" && r.inferenceAttempts === 1);
    if (report.rows.some((r: any) => r.state === "INFERENCE_UNCERTAIN"))
      report.error ||= prefix + "_INFERENCE_OUTCOME_UNCERTAIN";
  } catch (error: any) {
    report.error = /^B(?:12|13|14|15|16|17|18)_[A-Z0-9_]+$/.test(error?.message || "") ? error.message : prefix + "_PILOT_FAILED";
  } finally {
    try {
      report.after = await options.readSnapshot();
      segment.after = report.after;
      if (report.before) {
        report.production = productionComparison(options.reference, report.before, report.after);
        const comparisons = [report.production, ...(report.warmup ? [report.warmup.production] : []),
          ...report.segments.map((s: any, i: number) => s.before
            ? productionComparison(options.reference, s.before, s.after ?? report.segments[i + 1]?.before ?? report.after) : null),
          ...report.rows.filter((r: any) => r.verdict !== "NOT_RUN").map((r: any) => r.production)];
        const values = comparisons.flatMap(c => c ? [c.beforeMatchesOriginal, c.unchangedDuringCheck, c.afterMatchesOriginal] : [null]);
        productionUnchanged = values.includes(false) ? false : values.every(v => v === true) ? true : null;
      }
    } catch { report.error ||= prefix + "_FINAL_PRODUCTION_UNVERIFIED"; }
    report.finishedAtUtc = new Date().toISOString();
    segment.finishedAtUtc = report.finishedAtUtc;
    save();
    if (report.error && report.summary.verdict === "PASS") {
      report.summary.verdict = "REVIEW_REQUIRED"; report.summary.reasons.push(report.error); options.persist(report);
    } else if (report.error && !report.summary.reasons.includes(report.error)) {
      report.summary.reasons.push(report.error); options.persist(report);
    }
  }
  return report;
}
export function renderB13(report: any) {
  const s = report.summary;
  const lines = ["# B1.3 — Email Monitoring", `Výsledok: **${s.verdict}**`,
    `Klasifikačné očakávania: ${s.correctExpectations}/240 (${s.fieldSuccessPct.toFixed(2)} %).`,
    `Celé prípady PASS: ${s.passedCases}/30 (${s.caseSuccessPct.toFixed(2)} %).`,
    `Falošné súhlasy: ${s.falseConsents}; nerozpoznané zrušenia: ${s.missedCancellations}.`,
    `HTTP chyby: ${s.httpErrors}; transport: ${s.transportErrors}; parser: ${s.parserErrors}; JSON kontrakt: ${s.contractErrors}.`,
    `Inferenčné pokusy: ${s.inferenceAttempts}; cloud fallback: ${s.cloudCalls}.`,
    `Produkčné nastavenia nezmenené: ${s.productionUnchanged === true ? "áno" : s.productionUnchanged === false ? "nie" : "neoverené"}.`,
    `Dôvody: ${s.reasons.join(", ") || "žiadne"}.`, "",
    "| Kategória | Prípady PASS | Správne polia |", "|---|---:|---:|"];
  for (const c of Object.values(s.categories) as any[]) lines.push(`| ${c.label} | ${c.passed}/5 | ${c.correctExpectations}/40 |`);
  const pretty = (v: any) => JSON.stringify(v, null, 2).replace(/`/g, "\\u0060").replace(/</g, "\\u003c");
  for (const row of report.rows) {
    lines.push("", `## ${row.id} — ${B13_CATEGORIES[row.category as keyof typeof B13_CATEGORIES]}`,
      `Vstup: ${row.input}`, `Výsledok: ${row.verdict}; HTTP: ${row.httpStatus ?? "bez odpovede"}; chyba: ${row.error ?? "žiadna"}.`,
      "Očakávania:", "```json", pretty(row.expected), "```",
      "Skutočný JSON:", "```json", pretty(row.actualJson), "```");
    if (row.actualJson === null && row.modelContent)
      lines.push("Nespracovaný obsah modelu (JSON zápis textu):", "```json", pretty(row.modelContent), "```");
  }
  return lines.join("\n") + "\n";
}
