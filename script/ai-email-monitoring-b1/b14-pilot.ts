import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { emailMonitoringSchema } from "../../server/lib/ai/email-monitoring-contract";
import { B12 } from "./b12-test";
import { B13_CORPUS, B13_FIELDS, B13_CATEGORIES } from "./b13-corpus";
import { B13_CORPUS_SHA256, evaluateB13, executeEmailPilot, validateB13Corpus, type EmailPilotOptions } from "./b13-pilot";
import { B14_CORPUS, B14_CORPUS_SHA256, B14_PROBLEM_IDS } from "./b14-corpus";
import { productionComparison } from "./b11-check.cjs";

function criticalErrorsFor(c: typeof B14_CORPUS[number], row: any) {
  const errors: any[] = [];
  const add = (code: string, field: string, expected: any) =>
    errors.push({ id: c.id, code, field, expected, actual: row.actualJson?.[field] ?? null });
  if (!c.expected.wantsConsent && row.actualJson?.wantsConsent === true) add("FALSE_POSITIVE_CONSENT", "wantsConsent", false);
  if (!c.expected.wantsToCancel && row.actualJson?.wantsToCancel === true) add("FALSE_POSITIVE_CANCELLATION", "wantsToCancel", false);
  if (c.expected.wantsToCancel && row.actualJson?.wantsToCancel !== true) add("MISSED_EXPLICIT_CANCELLATION", "wantsToCancel", true);
  if ((c.category === "cancellation" || c.category === "complaint") && row.actualJson?.alertLevel !== "critical")
    add("CRITICAL_ALERT_REQUIRED", "alertLevel", "critical");
  return errors;
}
function criticalCounts(errors: any[]) {
  return { falseConsents: errors.filter(e => e.code === "FALSE_POSITIVE_CONSENT").length,
    falseCancellations: errors.filter(e => e.code === "FALSE_POSITIVE_CANCELLATION").length,
    missedCancellations: errors.filter(e => e.code === "MISSED_EXPLICIT_CANCELLATION").length,
    missedCriticalAlerts: errors.filter(e => e.code === "CRITICAL_ALERT_REQUIRED").length };
}
export function validateB14Baseline(baseline: any, source: any) {
  validateB13Corpus();
  if (baseline?.phase !== "B1.3" || baseline.kind !== "LIVE_ISOLATED_30_SYNTHETIC_EMAILS" ||
    baseline.complete !== true || baseline.error !== null || baseline.corpusSha256 !== B13_CORPUS_SHA256 ||
    baseline.originalRequestSha256 !== source.requestSha256 || baseline.rows?.length !== 30 ||
    baseline.productionSettingsWrites !== 0 || baseline.productionRecordWrites !== 0 || baseline.customerNotifications !== 0 ||
    !baseline.production?.comparedWithOriginalB1 || !baseline.production.beforeMatchesOriginal ||
    !baseline.production.afterMatchesOriginal || !baseline.production.unchangedDuringCheck)
    throw Error("B14_BASELINE_INVALID");
  const comparison = productionComparison(baseline.before, baseline.before, baseline.after);
  if (!comparison.unchangedDuringCheck) throw Error("B14_BASELINE_PRODUCTION_INVALID");
  for (let i = 0; i < 30; i++) {
    const row = baseline.rows[i], original = B13_CORPUS[i];
    if (row.id !== original.id || row.category !== original.category || row.input !== original.input ||
      !isDeepStrictEqual(row.expected, original.expected) || !emailMonitoringSchema.safeParse(row.actualJson).success ||
      !isDeepStrictEqual(JSON.parse(row.modelContent), row.actualJson) ||
      row.usedModel !== B12.model || row.inferenceAttempts !== 1 || row.cloudCalls !== 0)
      throw Error("B14_BASELINE_CORPUS_OR_RESULTS_INVALID");
  }
  const summary = evaluateB13(structuredClone(baseline.rows), true);
  if (!isDeepStrictEqual(summary, baseline.summary) || summary.verdict !== "PASS" ||
    summary.correctExpectations !== 225 || summary.passedCases !== 22)
    throw Error("B14_BASELINE_SCORE_INVALID");
  const criticalErrors = baseline.rows.flatMap((row: any, i: number) => criticalErrorsFor(B13_CORPUS[i], row));
  return { reference: baseline.after, summary, critical: { ...criticalCounts(criticalErrors), errors: criticalErrors },
    sha256: crypto.createHash("sha256").update(JSON.stringify(baseline)).digest("hex") };
}
export function evaluateB14(rows: any[], safe: boolean | null, interrupted = false) {
  if (rows.length !== 35) throw Error("B14_ROWS_INVALID");
  const original = evaluateB13(structuredClone(rows.slice(0, 30)), safe, interrupted);
  const groups = { original: { total: 30, executed: 0, passed: 0, correct: 0, expectations: 240 },
    boundary: { total: 5, executed: 0, passed: 0, correct: 0, expectations: 40 } };
  const criticalErrors: any[] = [], remainingDifferences: any[] = [];
  let httpErrors = 0, parserErrors = 0, contractErrors = 0, transportErrors = 0, integrationErrors = 0;
  let attempts = 0, cloud = 0;
  rows.forEach((row, i) => {
    const c = B14_CORPUS[i], group = i < 30 ? groups.original : groups.boundary;
    if (row.id !== c.id || row.category !== c.category || row.input !== c.input) throw Error("B14_CASE_IDENTITY_INVALID");
    attempts += row.inferenceAttempts; cloud += row.cloudCalls;
    if (row.verdict === "NOT_RUN") return;
    group.executed++;
    const rawValid = emailMonitoringSchema.safeParse(row.actualJson).success;
    const valid = rawValid && row.integrationProcessed === true && row.usedModel === B12.model && row.httpStatus === 200;
    row.checks = B13_FIELDS.map(field => ({ field, expected: c.expected[field],
      actual: row.actualJson?.[field] ?? null, pass: valid && row.actualJson[field] === c.expected[field] }));
    for (const check of row.checks) {
      if (check.pass) group.correct++;
      else remainingDifferences.push({ id: c.id, ...check });
    }
    criticalErrors.push(...criticalErrorsFor(c, row));
    if (row.transportTraces.some((t: any) => typeof t.status === "number" && t.status !== 200)) httpErrors++;
    if (row.httpStatus === 200 && !rawValid) contractErrors++;
    if (row.error === "email_monitoring_invalid_analysis") parserErrors++;
    if (/transport_error|ABORT|TIMEOUT|RESPONSE_TOO_LARGE/.test(row.error || "")) transportErrors++;
    if (!valid) integrationErrors++;
    row.verdict = valid && row.checks.every((c: any) => c.pass) && !row.error &&
      row.inferenceAttempts === 1 && row.cloudCalls === 0 ? "PASS" : "FAIL";
    if (row.verdict === "PASS") group.passed++;
  });
  const reasons = [...new Set(criticalErrors.map(e => e.code))];
  if (httpErrors || parserErrors || contractErrors || transportErrors || integrationErrors) reasons.push("HTTP_JSON_OR_INTEGRATION_ERROR");
  if (cloud) reasons.push("CLOUD_FALLBACK_DETECTED");
  if (attempts > 35 || rows.some(r => r.inferenceAttempts > 1)) reasons.push("INFERENCE_BUDGET_EXCEEDED");
  if (safe === false) reasons.push("PRODUCTION_CONFIGURATION_CHANGED");
  // Preserve the original pilot's accuracy floor on the original denominator, never diluted by added cases.
  if (groups.original.executed === 30 && groups.original.correct < 216) reasons.push("ORIGINAL_FIELD_ACCURACY_BELOW_90_PERCENT");
  const executed = groups.original.executed + groups.boundary.executed;
  const incomplete = executed !== 35 || attempts !== 35 || safe === null || interrupted;
  const verdict = reasons.length ? "FAIL" : incomplete ? "REVIEW_REQUIRED" : "PASS";
  if (executed !== 35) reasons.push("NOT_ALL_35_CASES_EXECUTED");
  if (attempts !== 35) reasons.push("NOT_35_SINGLE_INFERENCE_ATTEMPTS");
  if (safe === null) reasons.push("PRODUCTION_CONFIGURATION_UNVERIFIED");
  if (interrupted) reasons.push("PILOT_INTERRUPTED_OR_INCOMPLETE");
  const metrics = (g: typeof groups.original) => ({ ...g,
    fieldSuccessPct: 100 * g.correct / g.expectations, caseSuccessPct: 100 * g.passed / g.total });
  return { verdict, reasons, totalCases: 35, executedCases: executed,
    passedCases: groups.original.passed + groups.boundary.passed,
    correctExpectations: groups.original.correct + groups.boundary.correct, totalExpectations: 280,
    fieldSuccessPct: 100 * (groups.original.correct + groups.boundary.correct) / 280,
    original: metrics(groups.original), boundary: metrics(groups.boundary), originalCategories: original.categories,
    criticalErrors, ...criticalCounts(criticalErrors),
    remainingDifferences, httpErrors, parserErrors, contractErrors, transportErrors, integrationErrors,
    inferenceAttempts: attempts, cloudCalls: cloud, productionUnchanged: safe };
}
export function compareB14(baseline: any, rows: any[]) {
  const repaired: any[] = [], regressions: any[] = [], stillWrong: any[] = [];
  for (let i = 0; i < 30; i++) {
    if (rows[i].verdict === "NOT_RUN") continue;
    for (const field of B13_FIELDS) {
      const expected = B13_CORPUS[i].expected[field], before = baseline.rows[i].actualJson[field];
      const check = rows[i].checks.find((c: any) => c.field === field);
      const item = { id: rows[i].id, field, expected, b13: before, b14: check.actual };
      if (before !== expected && check.pass) repaired.push(item);
      if (before === expected && !check.pass) regressions.push(item);
      if (before !== expected && !check.pass) stillWrong.push(item);
    }
  }
  return { repaired, regressions, stillWrong, problemCases: B14_PROBLEM_IDS.map(id => {
    const i = B13_CORPUS.findIndex(c => c.id === id);
    return { id, input: B13_CORPUS[i].input, expected: B13_CORPUS[i].expected,
      b13: baseline.rows[i].actualJson, b14: rows[i].actualJson, verdict: rows[i].verdict,
      remainingDifferences: rows[i].checks?.filter((c: any) => !c.pass) ?? null };
  }) };
}
export function executeB14(options: EmailPilotOptions & { baseline: any }) {
  const validated = validateB14Baseline(options.baseline, options.source);
  if (!productionComparison(validated.reference, options.reference, options.reference).beforeMatchesOriginal)
    throw Error("B14_REFERENCE_MISMATCH");
  return executeEmailPilot(options, { phase: "B1.4", corpus: B14_CORPUS,
    corpusSha256: B14_CORPUS_SHA256, evaluate: evaluateB14,
    decorate(report) {
      report.baseline = { phase: "B1.3", sha256: validated.sha256, corpusSha256: B13_CORPUS_SHA256,
        summary: validated.summary, critical: validated.critical };
      report.comparison = compareB14(options.baseline, report.rows);
      report.comparison.b13 = { correct: validated.summary.correctExpectations, expectations: 240,
        passed: validated.summary.passedCases, fieldSuccessPct: validated.summary.fieldSuccessPct };
      report.comparison.b14 = report.summary.original;
      report.comparison.critical = {
        b13Original: criticalCounts(validated.critical.errors),
        b14Original: criticalCounts(report.summary.criticalErrors.filter((e: any) => B13_CORPUS.some(c => c.id === e.id))),
        b14Boundary: criticalCounts(report.summary.criticalErrors.filter((e: any) => !B13_CORPUS.some(c => c.id === e.id))),
      };
      report.comparison.fieldAccuracyDeltaPercentagePoints =
        report.summary.original.fieldSuccessPct - validated.summary.fieldSuccessPct;
    },
  });
}
export function renderB14(report: any) {
  const s = report.summary, cmp = report.comparison;
  const pretty = (value: any) => JSON.stringify(value, null, 2).replace(/`/g, "\\u0060").replace(/</g, "\\u003c");
  const lines = ["# B1.4 — regresný test Email Monitoring", `Výsledok: **${s.verdict}**`,
    "| Sada | Správne polia | Presnosť | Celé prípady PASS |", "|---|---:|---:|---:|",
    `| B1.3 pôvodná | ${cmp.b13.correct}/240 | ${cmp.b13.fieldSuccessPct.toFixed(2)} % | ${cmp.b13.passed}/30 |`,
    `| B1.4 pôvodných 30 | ${s.original.correct}/240 | ${s.original.fieldSuccessPct.toFixed(2)} % | ${s.original.passed}/30 |`,
    `| B1.4 nových 5 | ${s.boundary.correct}/40 | ${s.boundary.fieldSuccessPct.toFixed(2)} % | ${s.boundary.passed}/5 |`,
    `| B1.4 spolu | ${s.correctExpectations}/280 | ${s.fieldSuccessPct.toFixed(2)} % | ${s.passedCases}/35 |`,
    `Opravené odchýlky: ${cmp.repaired.length}; nové regresie: ${cmp.regressions.length}; pretrvávajúce: ${cmp.stillWrong.length}.`,
    `Falošné súhlasy: ${s.falseConsents}; falošné zrušenia: ${s.falseCancellations}; nerozpoznané zrušenia: ${s.missedCancellations}; nesprávne nízka naliehavosť: ${s.missedCriticalAlerts}.`,
    `HTTP: ${s.httpErrors}; parser: ${s.parserErrors}; JSON: ${s.contractErrors}; transport: ${s.transportErrors}; integrácia: ${s.integrationErrors}.`,
    `Inferenčné pokusy: ${s.inferenceAttempts}/35; cloud fallback: ${s.cloudCalls}; nezmenená produkcia: ${s.productionUnchanged === true ? "áno" : s.productionUnchanged === false ? "nie" : "neoverené"}.`,
    `Produkčné zápisy: ${report.productionRecordWrites}; zmeny nastavení: ${report.productionSettingsWrites}; notifikácie: ${report.customerNotifications}.`,
    `Dôvody: ${s.reasons.join(", ") || "žiadne"}.`,
    "", "## Porovnanie kritických chýb",
    "| Chyba | B1.3 pôvodných 30 | B1.4 pôvodných 30 | B1.4 nových 5 |",
    "|---|---:|---:|---:|",
    ...(["falseConsents", "falseCancellations", "missedCancellations", "missedCriticalAlerts"] as const).map(key =>
      `| ${key} | ${cmp.critical.b13Original[key]} | ${cmp.critical.b14Original[key]} | ${cmp.critical.b14Boundary[key]} |`),
    "", "## Kritické klasifikačné chyby", "```json", pretty(s.criticalErrors), "```",
    "", "## Prípady 12, 17, 21–26", "```json", pretty(cmp.problemCases), "```",
    "", "## Opravené odchýlky", "```json", pretty(cmp.repaired), "```",
    "", "## Nové regresie", "```json", pretty(cmp.regressions), "```",
    "", "## Všetky zostávajúce odchýlky", "```json", pretty(s.remainingDifferences), "```",
    "", "## Kategórie pôvodnej sady", "```json", pretty(s.originalCategories), "```"];
  for (const r of report.rows) lines.push("", `## ${r.id} — ${B13_CATEGORIES[r.category as keyof typeof B13_CATEGORIES]}`,
    r.input, `Výsledok: ${r.verdict}; HTTP: ${r.httpStatus ?? "bez odpovede"}; chyba: ${r.error ?? "žiadna"}.`,
    "Očakávania:", "```json", pretty(r.expected), "```", "Skutočný JSON:", "```json", pretty(r.actualJson), "```",
    "Nespracovaný obsah (JSON zápis textu):", "```json", pretty(r.modelContent), "```");
  return lines.join("\n") + "\n";
}
