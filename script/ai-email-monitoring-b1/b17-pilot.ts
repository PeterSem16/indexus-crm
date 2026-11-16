import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import approval from "./b17-review.json";
import { emailMonitoringSchema } from "../../server/lib/ai/email-monitoring-contract";
import { B12 } from "./b12-test";
import { B13_FIELDS } from "./b13-corpus";
import { B14_CORPUS_SHA256 } from "./b14-corpus";
import { B16_CORPUS, evaluateB16 } from "./b16-pilot";
import { findVerifiedBaseline } from "./b15-baseline-files";
import { executeEmailPilot, type EmailPilotOptions } from "./b13-pilot";
import { productionComparison } from "./b11-check.cjs";
import { B17_CORPUS, B17_CORPUS_SHA256, B17_CATEGORIES, B17_POLICY, B17_POLICY_SHA256, validateB17Corpus } from "./b17-corpus";

export function validateB17Approval(source: any, reviewed: any = approval) {
  validateB17Corpus();
  if (reviewed.decision !== "APPROVED_FOR_ISOLATED_INFERENCE" ||
    reviewed.corpusSha256 !== B17_CORPUS_SHA256 || reviewed.policySha256 !== B17_POLICY_SHA256 ||
    reviewed.sourceRequestSha256 !== source.requestSha256 || reviewed.beforeInference !== true ||
    reviewed.reviewedCases !== 100 || reviewed.reviewedFields !== 800 ||
    typeof reviewed.reviewer !== "string" || !reviewed.reviewer.trim() ||
    !Number.isFinite(Date.parse(reviewed.reviewedAtUtc)) ||
    !isDeepStrictEqual(reviewed.ambiguousIds, B17_CORPUS.filter(c => c.reviewReason).map(c => c.id)))
    throw Error("B17_INDEPENDENT_APPROVAL_REQUIRED");
  return reviewed;
}
export function validateB17Baseline(report: any, source: any) {
  const { input: _, ...configuration } = B12;
  if (report?.phase !== "B1.6" || report.kind !== "LIVE_ISOLATED_35_SYNTHETIC_EMAILS" ||
    report.complete !== true || report.error !== null || report.rows?.length !== 35 ||
    report.originalRequestSha256 !== source.requestSha256 || report.corpusSha256 !== B14_CORPUS_SHA256 ||
    !isDeepStrictEqual(report.request, { ...configuration, phase: "B1.6" }) ||
    report.productionSettingsWrites !== 0 || report.productionRecordWrites !== 0 || report.customerNotifications !== 0 ||
    !report.production?.beforeMatchesOriginal || !report.production.afterMatchesOriginal || !report.production.unchangedDuringCheck ||
    !productionComparison(report.before, report.before, report.after).unchangedDuringCheck)
    throw Error("B17_B16_BASELINE_INVALID");
  for (let i = 0; i < 35; i++) {
    const row = report.rows[i], c = B16_CORPUS[i];
    if (row.id !== c.id || row.category !== c.category || row.input !== c.input ||
      !isDeepStrictEqual(row.expected, c.expected) || row.httpStatus !== 200 ||
      !row.integrationProcessed || row.usedModel !== B12.model || row.inferenceAttempts !== 1 || row.cloudCalls !== 0 ||
      !emailMonitoringSchema.safeParse(row.actualJson).success ||
      !isDeepStrictEqual(JSON.parse(row.modelContent), row.actualJson))
      throw Error("B17_B16_RESULTS_INVALID");
  }
  const summary = evaluateB16(structuredClone(report.rows), true);
  if (!isDeepStrictEqual(summary, report.summary) || summary.httpErrors || summary.parserErrors ||
    summary.contractErrors || summary.transportErrors || summary.integrationErrors || summary.cloudCalls)
    throw Error("B17_B16_SCORE_INVALID");
  return { summary, reference: report.after,
    sha256: crypto.createHash("sha256").update(JSON.stringify(report)).digest("hex") };
}
export function findB16Baseline(root: string, uid: number, source: any) {
  return findVerifiedBaseline(root, uid, { phase: "B1.6", directoryPrefix: "B16", errorPrefix: "B17_B16",
    validate: report => validateB17Baseline(report, source) });
}
export function performanceMetrics(values: number[]) {
  const sorted = values.filter(v => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const n = sorted.length;
  return { measuredCases: n, meanMs: n ? sorted.reduce((a, b) => a + b, 0) / n : null,
    medianMs: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : null,
    p95Ms: n ? sorted[Math.ceil(n * .95) - 1] : null, minMs: sorted[0] ?? null, maxMs: sorted[n - 1] ?? null };
}
export function evaluateB17(rows: any[], safe: boolean | null, interrupted = false) {
  if (rows.length !== 100) throw Error("B17_ROWS_INVALID");
  let executed = 0, correct = 0, wrong = 0, unresolved = 0, unknownNotRun = 0, passed = 0;
  let technical = 0, attempts = 0, cloud = 0, noteFailures = 0;
  const criticalErrors: any[] = [], differences: any[] = [], manualReview: any[] = [];
  const categories: Record<string, any> = Object.fromEntries(Object.entries(B17_CATEGORIES).map(([key, label]) =>
    [key, { label, total: 10, executed: 0, technicalSuccesses: 0, correct: 0, wrong: 0, unresolved: 0,
      passedCases: 0, ambiguousCases: 0, totalFields: 80 }]));
  for (let i = 0; i < 100; i++) {
    const r = rows[i], c = B17_CORPUS[i], group = categories[c.category];
    if (r.id !== c.id || r.input !== c.input || r.category !== c.category) throw Error("B17_CASE_IDENTITY_INVALID");
    attempts += r.inferenceAttempts; cloud += r.cloudCalls;
    r.language = c.language; r.referenceReviewReason = c.reviewReason;
    if (r.verdict === "NOT_RUN") { unknownNotRun += 8; continue; }
    executed++; group.executed++;
    const rawValid = emailMonitoringSchema.safeParse(r.actualJson).success;
    let jsonValid = false;
    try { if (typeof r.modelContent === "string") { JSON.parse(r.modelContent); jsonValid = true; } } catch {}
    const technicalOK = jsonValid && rawValid && r.integrationProcessed === true && r.usedModel === B12.model &&
      r.httpStatus === 200 && r.inferenceAttempts === 1 && r.cloudCalls === 0 &&
      r.transportTraces.every((t: any) => t.status === 200) &&
      (!r.error || r.error === "B12_SEMANTIC_MISMATCH");
    r.technical = { success: technicalOK, jsonValid,
      schemaValid: rawValid, parserProcessed: r.integrationProcessed === true };
    if (technicalOK) { technical++; group.technicalSuccesses++; }
    r.checks = B13_FIELDS.map(field => {
      const expected = c.expected[field], actual = r.actualJson?.[field] ?? null;
      if (expected === null) {
        unresolved++; group.unresolved++;
        return { field, expected: null, actual, pass: null, status: "REFERENCE_REVIEW_REQUIRED" };
      }
      const pass = rawValid && actual === expected;
      if (pass) { correct++; group.correct++; } else { wrong++; group.wrong++; differences.push({ id: c.id, field, expected, actual }); }
      return { field, expected, actual, pass, status: pass ? "PASS" : "FAIL" };
    });
    const add = (code: string, field: string) => criticalErrors.push({ id: c.id, code, field,
      expected: c.expected[field as keyof typeof c.expected], actual: r.actualJson?.[field] ?? null });
    if (c.expected.wantsConsent === false && r.actualJson?.wantsConsent === true) add("FALSE_POSITIVE_CONSENT", "wantsConsent");
    if (c.expected.wantsToCancel === false && r.actualJson?.wantsToCancel === true) add("FALSE_POSITIVE_CANCELLATION", "wantsToCancel");
    if (c.expected.wantsToCancel === true && r.actualJson?.wantsToCancel !== true) add("MISSED_EXPLICIT_CANCELLATION", "wantsToCancel");
    if (c.expected.alertLevel === "critical" && r.actualJson?.alertLevel !== "critical") add("CRITICAL_ALERT_REQUIRED", "alertLevel");
    const note = r.actualJson?.note;
    const noteOK = typeof note === "string" && note.trim().length > 0 && note.length <= 100 && [...note].length <= 100;
    r.noteChecks = { present: typeof note === "string", type: typeof note, utf16Length: typeof note === "string" ? note.length : null,
      codePointLength: typeof note === "string" ? [...note].length : null, shapeValid: noteOK,
      slovakLanguage: "REVIEW_REQUIRED", languageMethod: "Independent post-run linguistic review; no heuristic or same-model self-approval." };
    if (!noteOK) noteFailures++;
    if (c.reviewReason) group.ambiguousCases++;
    manualReview.push({ id: c.id, referenceFields: r.checks.filter((v: any) => v.pass === null).map((v: any) => v.field),
      referenceReason: c.reviewReason, note, noteLanguage: "REVIEW_REQUIRED" });
    const knownFailure = !technicalOK || !noteOK || r.checks.some((v: any) => v.pass === false);
    r.classificationVerdict = knownFailure ? "FAIL" : c.reviewReason ? "REVIEW_REQUIRED" : "PASS";
    // Language assessment is not fabricated by a short-string language detector.
    r.verdict = knownFailure ? "FAIL" : "REVIEW_REQUIRED";
    if (r.classificationVerdict === "PASS") { passed++; group.passedCases++; }
    r.criticalErrors = criticalErrors.filter(e => e.id === c.id);
  }
  const notRun = 100 - executed, ambiguous = rows.filter(r => r.verdict !== "NOT_RUN" && r.referenceReviewReason).length;
  const possibleFields = correct + unresolved + unknownNotRun;
  const possibleCases = passed + rows.filter(r => r.classificationVerdict === "REVIEW_REQUIRED" && r.verdict !== "NOT_RUN").length + notRun;
  const reasons: string[] = [];
  if (criticalErrors.length) reasons.push("CRITICAL_CLASSIFICATION_ERROR");
  if (executed - technical) reasons.push("TECHNICAL_RESPONSE_FAILURE");
  if (cloud) reasons.push("CLOUD_FALLBACK_DETECTED");
  if (attempts > 100 || rows.some(r => r.inferenceAttempts > 1)) reasons.push("INFERENCE_BUDGET_EXCEEDED");
  if (safe === false) reasons.push("PRODUCTION_CONFIGURATION_CHANGED");
  if (noteFailures) reasons.push("NOTE_MISSING_EMPTY_OR_INVALID_LENGTH");
  if (possibleFields < 784) reasons.push("FIELD_ACCURACY_CANNOT_REACH_98_PERCENT");
  if (possibleCases < 95) reasons.push("CASE_ACCURACY_CANNOT_REACH_95_PERCENT");
  const failed = reasons.length > 0;
  if (unresolved) reasons.push("AMBIGUOUS_REFERENCES_REQUIRE_MANUAL_REVIEW");
  if (executed) reasons.push("SLOVAK_NOTE_LANGUAGE_REQUIRES_INDEPENDENT_REVIEW");
  if (notRun || attempts !== 100 || interrupted) reasons.push("TEST_INCOMPLETE");
  if (safe === null) reasons.push("PRODUCTION_CONFIGURATION_UNVERIFIED");
  const count = (code: string) => criticalErrors.filter(e => e.code === code).length;
  return { verdict: failed ? "FAIL" : reasons.length ? "REVIEW_REQUIRED" : "PASS", reasons,
    totalCases: 100, executedCases: executed, technicalSuccesses: technical, passedCases: passed,
    fullyClassifiedCases: executed - ambiguous, ambiguousCases: ambiguous,
    totalExpectations: 800, correctExpectations: correct, wrongExpectations: wrong,
    unresolvedExpectations: unresolved, notRunExpectations: unknownNotRun,
    fieldSuccessPct: 100 * correct / 800, fieldUpperBoundPct: 100 * possibleFields / 800,
    knownOnlyFieldSuccessPct: correct + wrong ? 100 * correct / (correct + wrong) : null,
    caseSuccessPct: passed, caseUpperBoundPct: Math.min(100, possibleCases),
    categories, criticalErrors, falseConsents: count("FALSE_POSITIVE_CONSENT"),
    falseCancellations: count("FALSE_POSITIVE_CANCELLATION"), missedCancellations: count("MISSED_EXPLICIT_CANCELLATION"),
    missedCriticalAlerts: count("CRITICAL_ALERT_REQUIRED"), remainingDifferences: differences,
    manualReview, noteFailures, inferenceAttempts: attempts, cloudCalls: cloud, productionUnchanged: safe,
    performance: performanceMetrics(rows.filter(r => r.verdict !== "NOT_RUN").map(r => r.processingMs)) };
}
export function failuresB17(report: any) {
  return { phase: "B1.7", corpusSha256: B17_CORPUS_SHA256, verdict: report.summary.verdict,
    classificationFailures: report.rows.filter((r: any) => r.classificationVerdict === "FAIL"),
    ambiguousClassifications: report.rows.filter((r: any) => r.referenceReviewReason),
    noteLanguageReviews: report.summary.manualReview, notRunIds: report.rows.filter((r: any) => r.verdict === "NOT_RUN").map((r: any) => r.id) };
}
export function executeB17(options: EmailPilotOptions & { previous: any }) {
  const reviewed = validateB17Approval(options.source), baseline = validateB17Baseline(options.previous, options.source);
  if (!productionComparison(baseline.reference, options.reference, options.reference).beforeMatchesOriginal)
    throw Error("B17_REFERENCE_MISMATCH");
  return executeEmailPilot(options, { phase: "B1.7", corpus: B17_CORPUS, recordTiming: true,
    corpusSha256: B17_CORPUS_SHA256, evaluate: evaluateB17,
    decorate(report) {
      report.independentReferenceApproval = reviewed; report.acceptance = B17_POLICY;
      report.baseline = { phase: "B1.6", sha256: baseline.sha256, summary: baseline.summary };
      report.comparison = { method: "Different unseen corpus, not paired regression; denominators 280 vs 800.",
        b16: baseline.summary, b17: { ...report.summary, manualReview: undefined }, timingScope: "Per-case end-to-end CRM router/adapter/parser, discovery and read-only safety snapshots; not GPU-only latency." };
    } });
}
export function renderB17(report: any) {
  const s = report.summary;
  const pretty = (v: any) => JSON.stringify(v, null, 2).replace(/`/g, "\\u0060").replace(/</g, "\\u003c");
  const lines = ["# B1.7 — nezávislá validácia Email Monitoring", `Výsledok: **${s.verdict}**`,
    `Korpus SHA-256: ${B17_CORPUS_SHA256}`, "## Referenčné hodnoty a rozsah",
    "100 nových syntetických správ; 10 kategórií, SK/CS/EN/HU. Referencie pred inferenciou posúdil samostatný AI hodnotiteľ, nie ľudský hodnotiteľ.",
    "Null označuje nerozhodnutú referenciu, nie chybu modelu ani automatický úspech. Po inferencii sa zmrazený korpus nemení.",
    `Potvrdené správne polia: ${s.correctExpectations}/800; nesprávne: ${s.wrongExpectations}; nerozhodnuté: ${s.unresolvedExpectations}; nespustené: ${s.notRunExpectations}.`,
    `Presnosť zo všetkých 800 polí: ${s.fieldSuccessPct.toFixed(2)}–${s.fieldUpperBoundPct.toFixed(2)} %. Presnosť iba rozhodnutých polí: ${s.knownOnlyFieldSuccessPct ?? "neoverená"} %.`,
    `Klasifikačne úplne správne prípady: ${s.passedCases}/100; horná hranica: ${s.caseUpperBoundPct}/100. Nejednoznačných: ${s.ambiguousCases}.`,
    `Technicky úspešné: ${s.technicalSuccesses}/100; vykonané: ${s.executedCases}/100.`,
    "Kontrola note: prítomnosť, neprázdny reťazec a limit 100 znakov sa kontrolujú automaticky. Slovenčina vyžaduje nezávislé posúdenie každej skutočnej poznámky; zatiaľ REVIEW_REQUIRED.",
    "Cieľ: ≥98 % polí a ≥95 % úplných prípadov zo všetkých 800/100. Nejednoznačné referencie ani poznámky sa nepovažujú za schválené.",
    "", "## Výsledky podľa kategórií", "| Kategória | Technicky OK | Klasifikačne PASS | Správne polia | Chybné | Nejednoznačné polia |",
    "|---|---:|---:|---:|---:|---:|",
    ...Object.values(s.categories).map((c: any) => `| ${c.label} | ${c.technicalSuccesses}/10 | ${c.passedCases}/10 | ${c.correct}/80 | ${c.wrong} | ${c.unresolved} |`),
    "", "## Kritické chyby", "```json", pretty({ falseConsents: s.falseConsents, falseCancellations: s.falseCancellations,
      missedCancellations: s.missedCancellations, missedCriticalAlerts: s.missedCriticalAlerts, errors: s.criticalErrors }), "```",
    "", "## Porovnanie s B1.6", "Nejde o rovnaké správy: B1.6 meral známu regresnú sadu, B1.7 nové syntetické prípady. Nemožno tvrdiť párové opravy či regresie.",
    "```json", pretty(report.comparison), "```", "", "## Výkonnosť", "```json", pretty(s.performance), "```",
    "Časy zahŕňajú discovery, skutočný CRM router/adaptér/parser a read-only snapshoty; nejde o samotný čas inferencie na GPU.",
    "", "## Produkčná bezpečnosť", `Pokusy: ${s.inferenceAttempts}/100; cloud: ${s.cloudCalls}; zápisy: ${report.productionRecordWrites}; nastavenia: ${report.productionSettingsWrites}; notifikácie: ${report.customerNotifications}.`,
    "```json", pretty({ before: report.before, after: report.after, comparison: report.production }), "```",
    "", "## Dôvody a odporúčania", ...s.reasons.map((r: string) => `- ${r}`),
    "- Pred záverom posúdiť nejednoznačné klasifikácie a slovenčinu každej note nezávisle od testovaného modelu.",
    "- Opravy odvodzovať z priložených chýb; nemení sa tento korpus ani jeho referencie. Nové ladenie potrebuje ďalšiu nezávislú validačnú sadu.",
    "- Technické chyby oddeliť od klasifikačných. Produkčné prepnutie nie je povolené ani pri PASS.",
    "", "## Nezávislé predinferenčné schválenie", "```json", pretty(report.independentReferenceApproval), "```"];
  for (const r of report.rows) lines.push("", `## ${r.id} — ${r.language ?? B17_CORPUS.find(c => c.id === r.id)?.language}`,
    r.input, `Stav: ${r.verdict}; klasifikácia: ${r.classificationVerdict ?? "nespustená"}; HTTP: ${r.httpStatus ?? "žiadny"}; chyba: ${r.error ?? "žiadna"}.`,
    "```json", pretty({ expected: r.expected, actual: r.actualJson, rawContent: r.modelContent, checks: r.checks,
      technical: r.technical, crmResult: r.crmResult, noteChecks: r.noteChecks, reviewReason: r.referenceReviewReason,
      processingMs: r.processingMs, inferenceAttempts: r.inferenceAttempts, cloudCalls: r.cloudCalls,
      transportTraces: r.transportTraces, criticalErrors: r.criticalErrors }), "```");
  return lines.join("\n") + "\n";
}
