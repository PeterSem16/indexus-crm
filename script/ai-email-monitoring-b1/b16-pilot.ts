import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { emailMonitoringSchema } from "../../server/lib/ai/email-monitoring-contract";
import { B12 } from "./b12-test";
import { B13_FIELDS, B13_CATEGORIES } from "./b13-corpus";
import { B14_CORPUS_SHA256 } from "./b14-corpus";
import { evaluateB14 } from "./b14-pilot";
import { B15_CORPUS } from "./b15-pilot";
import { executeEmailPilot, type EmailPilotOptions } from "./b13-pilot";
import { findVerifiedBaseline } from "./b15-baseline-files";
import { productionComparison } from "./b11-check.cjs";

export const B16_CORPUS = B15_CORPUS;
export const B16_PROBLEM_IDS = Object.freeze(["SYN-B13-28", "SYN-B13-29", "SYN-B14-31", "SYN-B14-32"]);
export function evaluateB16(rows: any[], safe: boolean | null, interrupted = false) {
  const summary = evaluateB14(rows, safe, interrupted);
  if (summary.remainingDifferences.length) {
    summary.reasons.push("CLASSIFICATION_FIELDS_NOT_280_OF_280");
    summary.verdict = "FAIL";
  }
  if (summary.executedCases === 35 && summary.passedCases !== 35) {
    summary.reasons.push("CASES_NOT_35_OF_35");
    summary.verdict = "FAIL";
  }
  return summary;
}
export function validateB16Baseline(previous: any, source: any) {
  const { input: _, ...configuration } = B12;
  const sha = (s: any) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
  if (previous?.phase !== "B1.5" || previous.kind !== "LIVE_ISOLATED_35_SYNTHETIC_EMAILS" ||
    previous.complete !== true || previous.error !== null || previous.corpusSha256 !== B14_CORPUS_SHA256 ||
    previous.originalRequestSha256 !== source.requestSha256 || previous.rows?.length !== 35 ||
    !isDeepStrictEqual(previous.request, { ...configuration, phase: "B1.5" }) ||
    previous.productionSettingsWrites !== 0 || previous.productionRecordWrites !== 0 || previous.customerNotifications !== 0 ||
    !previous.production?.beforeMatchesOriginal || !previous.production.afterMatchesOriginal || !previous.production.unchangedDuringCheck ||
    !sha(previous.baselines?.b13?.sha256) || !sha(previous.baselines?.b14?.sha256))
    throw Error("B16_B15_BASELINE_INVALID");
  const production = productionComparison(previous.before, previous.before, previous.after);
  if (!production.unchangedDuringCheck) throw Error("B16_BASELINE_PRODUCTION_CHANGED");
  previous.rows.forEach((row: any, i: number) => {
    const c = B16_CORPUS[i];
    if (row.id !== c.id || row.category !== c.category || row.input !== c.input ||
      !isDeepStrictEqual(row.expected, c.expected) || row.httpStatus !== 200 ||
      row.integrationProcessed !== true || row.usedModel !== B12.model ||
      row.inferenceAttempts !== 1 || row.cloudCalls !== 0 ||
      !emailMonitoringSchema.safeParse(row.actualJson).success ||
      !isDeepStrictEqual(JSON.parse(row.modelContent), row.actualJson))
      throw Error("B16_B15_CORPUS_OR_RESULTS_INVALID");
  });
  // Historical B1.5 must be rescored by its own rules, not retroactively by B1.6's 100% gate.
  const summary = evaluateB14(structuredClone(previous.rows), true, false);
  if (!isDeepStrictEqual(summary, previous.summary) || summary.executedCases !== 35 ||
    summary.httpErrors || summary.parserErrors || summary.contractErrors || summary.transportErrors ||
    summary.integrationErrors || summary.cloudCalls)
    throw Error("B16_B15_SCORE_INVALID");
  return { summary, reference: previous.after,
    sha256: crypto.createHash("sha256").update(JSON.stringify(previous)).digest("hex") };
}
export function findB15Baseline(root: string, uid: number, source: any) {
  return findVerifiedBaseline(root, uid, { phase: "B1.5", directoryPrefix: "B15", errorPrefix: "B16_B15",
    validate: report => validateB16Baseline(report, source) });
}
function critical(summary: any) {
  return { falseConsents: summary.falseConsents, falseCancellations: summary.falseCancellations,
    missedCancellations: summary.missedCancellations, missedCriticalAlerts: summary.missedCriticalAlerts };
}
export function compareB16(previous: any, rows: any[], summary: any) {
  const repaired: any[] = [], regressions: any[] = [], stillWrong: any[] = [];
  const cases = rows.map((row, i) => {
    const c = B16_CORPUS[i], old = previous.rows[i];
    if (row.verdict !== "NOT_RUN") for (const field of B13_FIELDS) {
      const expected = c.expected[field], before = old.actualJson[field];
      const check = row.checks.find((c: any) => c.field === field);
      const diff = { id: c.id, field, expected, b15: before, b16: check.actual };
      if (before !== expected && check.pass) repaired.push(diff);
      else if (before === expected && !check.pass) regressions.push(diff);
      else if (before !== expected && !check.pass) stillWrong.push(diff);
    }
    return { id: c.id, input: c.input, expected: c.expected, b15: old.actualJson, b16: row.actualJson,
      b15Verdict: old.verdict, b16Verdict: row.verdict, httpStatus: row.httpStatus, error: row.error,
      remainingDifferences: row.checks?.filter((c: any) => !c.pass) ?? null,
      criticalErrors: summary.criticalErrors.filter((e: any) => e.id === c.id) };
  });
  return { repaired, regressions, stillWrong, cases,
    problemCases: B16_PROBLEM_IDS.map(id => cases.find(c => c.id === id)),
    accuracy: {
      b15: { correct: previous.summary.correctExpectations, total: 280, passed: previous.summary.passedCases,
        cases: 35, fieldSuccessPct: previous.summary.fieldSuccessPct, historicalVerdict: previous.summary.verdict },
      b16: { correct: summary.correctExpectations, total: 280, passed: summary.passedCases,
        cases: 35, fieldSuccessPct: summary.fieldSuccessPct },
      deltaPercentagePoints: summary.fieldSuccessPct - previous.summary.fieldSuccessPct,
    },
    critical: { b15: critical(previous.summary), b16: critical(summary) } };
}
export function executeB16(options: EmailPilotOptions & { previous: any }) {
  const baseline = validateB16Baseline(options.previous, options.source);
  if (!productionComparison(baseline.reference, options.reference, options.reference).beforeMatchesOriginal)
    throw Error("B16_REFERENCE_MISMATCH");
  return executeEmailPilot(options, { phase: "B1.6", corpus: B16_CORPUS,
    corpusSha256: B14_CORPUS_SHA256, evaluate: evaluateB16,
    decorate(report) {
      report.acceptance = { passedCases: 35, correctExpectations: 280, totalExpectations: 280,
        falseConsents: 0, falseCancellations: 0, missedCancellations: 0, missedCriticalAlerts: 0,
        cloudCalls: 0, productionWrites: 0, customerNotifications: 0 };
      report.baseline = { phase: "B1.5", sha256: baseline.sha256, summary: baseline.summary };
      report.comparison = compareB16(options.previous, report.rows, report.summary);
    } });
}
export function renderB16(report: any) {
  const s = report.summary, cmp = report.comparison;
  const pretty = (v: any) => JSON.stringify(v, null, 2).replace(/`/g, "\\u0060").replace(/</g, "\\u003c");
  const lines = ["# B1.6 — izolovaný regresný test", `Výsledok: **${s.verdict}**`,
    "PASS vyžaduje 35/35 celých prípadov a 280/280 klasifikačných polí.",
    "| Beh | Správne polia | Presnosť | Celé prípady PASS |", "|---|---:|---:|---:|",
    `| B1.5 | ${cmp.accuracy.b15.correct}/280 | ${cmp.accuracy.b15.fieldSuccessPct.toFixed(2)} % | ${cmp.accuracy.b15.passed}/35 |`,
    `| B1.6 | ${s.correctExpectations}/280 | ${s.fieldSuccessPct.toFixed(2)} % | ${s.passedCases}/35 |`,
    `Historický stav B1.5: ${cmp.accuracy.b15.historicalVerdict} podľa vtedajších pravidiel; spätne sa nemení.`,
    `Opravené odchýlky: ${cmp.repaired.length}; nové regresie: ${cmp.regressions.length}; pretrvávajúce: ${cmp.stillWrong.length}.`,
    "", "## Kritické chyby", "| Chyba | B1.5 | B1.6 |", "|---|---:|---:|",
    ...["falseConsents", "falseCancellations", "missedCancellations", "missedCriticalAlerts"].map(key =>
      `| ${key} | ${cmp.critical.b15[key]} | ${cmp.critical.b16[key]} |`),
    `HTTP: ${s.httpErrors}; parser: ${s.parserErrors}; JSON: ${s.contractErrors}; transport: ${s.transportErrors}; integrácia: ${s.integrationErrors}.`,
    `Inferenčné pokusy: ${s.inferenceAttempts}/35; cloud fallback: ${s.cloudCalls}.`,
    `Produkcia nezmenená: ${s.productionUnchanged === true ? "áno" : s.productionUnchanged === false ? "nie" : "neoverené"}.`,
    `Zápisy nastavení: ${report.productionSettingsWrites}; zápisy záznamov: ${report.productionRecordWrites}; notifikácie: ${report.customerNotifications}.`,
    `Dôvody: ${s.reasons.join(", ") || "žiadne"}.`,
    "", "## Štyri zvýraznené prípady", "```json", pretty(cmp.problemCases), "```",
    "", "## Všetky zostávajúce odchýlky", "```json", pretty(s.remainingDifferences), "```",
    "", "## Nové regresie", "```json", pretty(cmp.regressions), "```",
    "", "## Opravené odchýlky", "```json", pretty(cmp.repaired), "```",
    "", "## Pretrvávajúce odchýlky", "```json", pretty(cmp.stillWrong), "```",
    "", "## Kontrola produkčnej konfigurácie", "```json",
    pretty({ before: report.before, after: report.after, comparison: report.production }), "```",
    "", "Produkčné smerovanie sa neaktivuje ani pri PASS."];
  for (const row of report.rows) {
    const old = cmp.cases.find((c: any) => c.id === row.id);
    lines.push("", `## ${row.id} — ${B13_CATEGORIES[row.category as keyof typeof B13_CATEGORIES]}`, row.input,
      `B1.5: ${old.b15Verdict}; B1.6: ${row.verdict}; HTTP: ${row.httpStatus ?? "bez odpovede"}; chyba: ${row.error ?? "žiadna"}.`,
      "Očakávania:", "```json", pretty(row.expected), "```", "B1.5 JSON:", "```json", pretty(old.b15), "```",
      "B1.6 JSON:", "```json", pretty(row.actualJson), "```",
      "Kontrola všetkých ôsmich klasifikačných polí:", "```json", pretty(row.checks ?? null), "```",
      "Nespracovaný obsah B1.6 (JSON zápis textu):", "```json", pretty(row.modelContent), "```");
  }
  return lines.join("\n") + "\n";
}
