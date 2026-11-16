import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { emailMonitoringSchema } from "../../server/lib/ai/email-monitoring-contract";
import { B12 } from "./b12-test";
import { B13_CORPUS, B13_FIELDS, B13_CATEGORIES } from "./b13-corpus";
import { B14_CORPUS, B14_CORPUS_SHA256 } from "./b14-corpus";
import { evaluateB14, validateB14Baseline } from "./b14-pilot";
import { executeEmailPilot, type EmailPilotOptions } from "./b13-pilot";
import { productionComparison } from "./b11-check.cjs";

/** B1.5 is a new authorization, not a new corpus. */
export const B15_CORPUS = B14_CORPUS;
export const B15_PROBLEM_IDS = Object.freeze([
  "SYN-B13-18", "SYN-B13-20", "SYN-B13-26", "SYN-B13-28",
  "SYN-B13-29", "SYN-B13-30", "SYN-B14-32", "SYN-B14-34",
]);
export function validateB15Baselines(b13: any, b14: any, source: any) {
  const original = validateB14Baseline(b13, source);
  if (b14?.phase !== "B1.4" || b14.kind !== "LIVE_ISOLATED_35_SYNTHETIC_EMAILS" ||
    b14.complete !== true || b14.error !== null || b14.corpusSha256 !== B14_CORPUS_SHA256 ||
    b14.originalRequestSha256 !== source.requestSha256 || b14.rows?.length !== 35 ||
    b14.productionSettingsWrites !== 0 || b14.productionRecordWrites !== 0 || b14.customerNotifications !== 0 ||
    b14.baseline?.sha256 !== original.sha256 || !b14.production?.beforeMatchesOriginal ||
    !b14.production.afterMatchesOriginal || !b14.production.unchangedDuringCheck)
    throw Error("B15_B14_BASELINE_INVALID");
  const production = productionComparison(original.reference, b14.before, b14.after);
  if (!production.beforeMatchesOriginal || !production.afterMatchesOriginal || !production.unchangedDuringCheck)
    throw Error("B15_BASELINE_PRODUCTION_CHANGED");
  b14.rows.forEach((row: any, i: number) => {
    const c = B15_CORPUS[i];
    if (row.id !== c.id || row.category !== c.category || row.input !== c.input ||
      !isDeepStrictEqual(row.expected, c.expected) || row.httpStatus !== 200 ||
      row.integrationProcessed !== true || row.usedModel !== B12.model ||
      row.inferenceAttempts !== 1 || row.cloudCalls !== 0 ||
      !emailMonitoringSchema.safeParse(row.actualJson).success ||
      !isDeepStrictEqual(JSON.parse(row.modelContent), row.actualJson))
      throw Error("B15_B14_CORPUS_OR_RESULTS_INVALID");
  });
  const summary = evaluateB14(structuredClone(b14.rows), true, false);
  // Classification FAIL is valid historical evidence; don't require a successful B1.4.
  if (!isDeepStrictEqual(summary, b14.summary) || summary.executedCases !== 35 ||
    summary.httpErrors || summary.parserErrors || summary.contractErrors || summary.transportErrors ||
    summary.integrationErrors || summary.cloudCalls)
    throw Error("B15_B14_SCORE_INVALID");
  return { original, previous: { summary,
    sha256: crypto.createHash("sha256").update(JSON.stringify(b14)).digest("hex") },
    reference: b14.after };
}
function differences(before: any[], after: any[], count: number) {
  const repaired: any[] = [], regressions: any[] = [], stillWrong: any[] = [];
  for (let i = 0; i < count; i++) {
    if (after[i].verdict === "NOT_RUN") continue;
    for (const field of B13_FIELDS) {
      const expected = B15_CORPUS[i].expected[field], old = before[i].actualJson[field];
      const check = after[i].checks.find((c: any) => c.field === field);
      const row = { id: B15_CORPUS[i].id, field, expected, before: old, after: check.actual };
      if (old !== expected && check.pass) repaired.push(row);
      else if (old === expected && !check.pass) regressions.push(row);
      else if (old !== expected && !check.pass) stillWrong.push(row);
    }
  }
  return { scopeCases: count, repaired, regressions, stillWrong };
}
function critical(errors: any[]) {
  return { falseConsents: errors.filter(e => e.code === "FALSE_POSITIVE_CONSENT").length,
    falseCancellations: errors.filter(e => e.code === "FALSE_POSITIVE_CANCELLATION").length,
    missedCancellations: errors.filter(e => e.code === "MISSED_EXPLICIT_CANCELLATION").length,
    missedCriticalAlerts: errors.filter(e => e.code === "CRITICAL_ALERT_REQUIRED").length };
}
export function compareB15(b13: any, b14: any, report: any, validated: ReturnType<typeof validateB15Baselines>) {
  return {
    // Never fabricate B1.3 results for the five cases that did not exist then.
    vsB13: differences(b13.rows, report.rows, 30),
    vsB14: differences(b14.rows, report.rows, 35),
    accuracy: {
      b13Original: { correct: validated.original.summary.correctExpectations, expectations: 240,
        passed: validated.original.summary.passedCases, total: 30,
        fieldSuccessPct: validated.original.summary.fieldSuccessPct },
      b14Original: validated.previous.summary.original,
      b14Boundary: validated.previous.summary.boundary,
      b14Total: { correct: validated.previous.summary.correctExpectations, expectations: 280,
        passed: validated.previous.summary.passedCases, total: 35,
        fieldSuccessPct: validated.previous.summary.fieldSuccessPct },
      b15Original: report.summary.original, b15Boundary: report.summary.boundary,
      b15Total: { correct: report.summary.correctExpectations, expectations: 280,
        passed: report.summary.passedCases, total: 35, fieldSuccessPct: report.summary.fieldSuccessPct },
    },
    critical: {
      b13Original: critical(validated.original.critical.errors),
      b14Original: critical(validated.previous.summary.criticalErrors.filter((e: any) => B13_CORPUS.some(c => c.id === e.id))),
      b14Total: critical(validated.previous.summary.criticalErrors),
      b15Original: critical(report.summary.criticalErrors.filter((e: any) => B13_CORPUS.some(c => c.id === e.id))),
      b15Total: critical(report.summary.criticalErrors),
    },
    problemCases: B15_PROBLEM_IDS.map(id => {
      const i = B15_CORPUS.findIndex(c => c.id === id), row = report.rows[i];
      return { id, input: B15_CORPUS[i].input, expected: B15_CORPUS[i].expected,
        b13: i < 30 ? b13.rows[i].actualJson : null,
        b13Available: i < 30, b14: b14.rows[i].actualJson, b15: row.actualJson,
        verdict: row.verdict, remainingDifferences: row.checks?.filter((c: any) => !c.pass) ?? null,
        criticalErrors: report.summary.criticalErrors.filter((e: any) => e.id === id) };
    }),
  };
}
export function executeB15(options: EmailPilotOptions & { baseline: any; previous: any }) {
  const validated = validateB15Baselines(options.baseline, options.previous, options.source);
  if (!productionComparison(validated.reference, options.reference, options.reference).beforeMatchesOriginal)
    throw Error("B15_REFERENCE_MISMATCH");
  return executeEmailPilot(options, { phase: "B1.5", corpus: B15_CORPUS,
    corpusSha256: B14_CORPUS_SHA256, evaluate: evaluateB14,
    decorate(report) {
      report.baselines = { b13: { sha256: validated.original.sha256, summary: validated.original.summary },
        b14: { sha256: validated.previous.sha256, summary: validated.previous.summary } };
      report.comparison = compareB15(options.baseline, options.previous, report, validated);
    },
  });
}
export function renderB15(report: any) {
  const s = report.summary, cmp = report.comparison;
  const pretty = (value: any) => JSON.stringify(value, null, 2).replace(/`/g, "\\u0060").replace(/</g, "\\u003c");
  const labels: Record<keyof typeof cmp.accuracy, string> = {
    b13Original: "B1.3 pôvodných 30", b14Original: "B1.4 pôvodných 30", b14Boundary: "B1.4 hraničných 5",
    b14Total: "B1.4 spolu", b15Original: "B1.5 pôvodných 30", b15Boundary: "B1.5 hraničných 5", b15Total: "B1.5 spolu",
  };
  const lines = ["# B1.5 — finálny izolovaný regresný test", `Výsledok: **${s.verdict}**`,
    "| Sada | Správne polia | Presnosť | Celé prípady PASS |", "|---|---:|---:|---:|"];
  for (const [key, value] of Object.entries(cmp.accuracy) as [keyof typeof labels, any][])
    lines.push(`| ${labels[key]} | ${value.correct}/${value.expectations} | ${value.fieldSuccessPct.toFixed(2)} % | ${value.passed}/${value.total} |`);
  lines.push("", "## Kritické klasifikačné chyby",
    "| Chyba | B1.3 pôvodných 30 | B1.4 spolu 35 | B1.5 spolu 35 |", "|---|---:|---:|---:|",
    ...["falseConsents", "falseCancellations", "missedCancellations", "missedCriticalAlerts"].map(key =>
      `| ${key} | ${cmp.critical.b13Original[key]} | ${cmp.critical.b14Total[key]} | ${cmp.critical.b15Total[key]} |`),
    `HTTP: ${s.httpErrors}; parser: ${s.parserErrors}; JSON: ${s.contractErrors}; transport: ${s.transportErrors}; integrácia: ${s.integrationErrors}.`,
    `Inferenčné pokusy: ${s.inferenceAttempts}/35; cloud fallback: ${s.cloudCalls}.`,
    `Produkcia nezmenená: ${s.productionUnchanged === true ? "áno" : s.productionUnchanged === false ? "nie" : "neoverené"}.`,
    `Zápisy nastavení: ${report.productionSettingsWrites}; zápisy záznamov: ${report.productionRecordWrites}; notifikácie: ${report.customerNotifications}.`,
    `Dôvody: ${s.reasons.join(", ") || "žiadne"}.`,
    "B1.3 nemal päť hraničných prípadov; ich historické výsledky sú nedostupné, nie dopočítané.",
    "", "## Osem problémových prípadov", "```json", pretty(cmp.problemCases), "```",
    "", "## Porovnanie s B1.3 — opravy, regresie a pretrvávajúce odchýlky", "```json", pretty(cmp.vsB13), "```",
    "", "## Porovnanie s B1.4 — opravy, regresie a pretrvávajúce odchýlky", "```json", pretty(cmp.vsB14), "```",
    "", "## Všetky zostávajúce odchýlky", "```json", pretty(s.remainingDifferences), "```",
    "", "## Aktuálne kritické chyby", "```json", pretty(s.criticalErrors), "```");
  for (const row of report.rows) lines.push("", `## ${row.id} — ${B13_CATEGORIES[row.category as keyof typeof B13_CATEGORIES]}`,
    row.input, `Výsledok: ${row.verdict}; HTTP: ${row.httpStatus ?? "bez odpovede"}; chyba: ${row.error ?? "žiadna"}.`,
    "Očakávania:", "```json", pretty(row.expected), "```", "Skutočný JSON:", "```json", pretty(row.actualJson), "```",
    "Nespracovaný obsah (JSON zápis textu):", "```json", pretty(row.modelContent), "```");
  return lines.join("\n") + "\n";
}
