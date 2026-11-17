import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { emailMonitoringSchema } from "../../server/lib/ai/email-monitoring-contract";
import { B12 } from "./b12-test";
import { B13_FIELDS } from "./b13-corpus";
import { B14_CORPUS_SHA256 } from "./b14-corpus";
import { executeEmailPilot, type EmailPilotOptions } from "./b13-pilot";
import { B16_CORPUS, evaluateB16 } from "./b16-pilot";
import { B17_CORPUS, B17_CORPUS_SHA256 } from "./b17-corpus";
import { evaluateB17, validateB17Approval, validateB17Baseline, performanceMetrics } from "./b17-pilot";
import { findVerifiedBaseline } from "./b15-baseline-files";
import { productionComparison } from "./b11-check.cjs";

export const B18_CORPUS = Object.freeze([...B17_CORPUS, ...B16_CORPUS]);
export const B18_CORPUS_SHA256 = crypto.createHash("sha256").update(JSON.stringify(B18_CORPUS)).digest("hex");
export const B18_EXECUTION_PROFILE = Object.freeze({
  id: "B18-technical-120s-warmup", requestTimeoutMs: 120_000, totalDeadlineMs: null,
  warmupAttempts: 1, scoredAttempts: 135, maxTotalAttempts: 136, retries: 0,
});
export const B18_SPECIAL_IDS = Object.freeze(["024", "025", "052", "061", "071", "074", "077", "088", "092"]
  .map(id => "SYN-B17-" + id));
const hash = (value: any) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Historical failure is valid evidence. Changed gold, unparsed output or fabricated scores are not. */
export function validateB18Baselines(b17: any, b16: any, source: any) {
  const approval = validateB17Approval(source);
  const old16 = validateB17Baseline(b16, source);
  if (b16.rows.some((r: any) => !r.transportTraces?.length ||
    r.transportTraces.some((t: any) => t.status !== 200) ||
    !r.production?.beforeMatchesOriginal || !r.production.afterMatchesOriginal || !r.production.unchangedDuringCheck))
    throw Error("B18_B16_TECHNICAL_EVIDENCE_INVALID");
  const { input: _, ...configuration } = B12;
  if (b17?.phase !== "B1.7" || b17.kind !== "LIVE_ISOLATED_100_SYNTHETIC_EMAILS" ||
    b17.complete !== true || b17.error !== null || b17.rows?.length !== 100 ||
    b17.originalRequestSha256 !== source.requestSha256 || b17.corpusSha256 !== B17_CORPUS_SHA256 ||
    !isDeepStrictEqual(b17.request, { ...configuration, phase: "B1.7" }) ||
    !isDeepStrictEqual(b17.independentReferenceApproval, approval) ||
    b17.baseline?.sha256 !== old16.sha256 ||
    b17.productionSettingsWrites !== 0 || b17.productionRecordWrites !== 0 || b17.customerNotifications !== 0 ||
    !b17.production?.beforeMatchesOriginal || !b17.production.afterMatchesOriginal || !b17.production.unchangedDuringCheck ||
    !productionComparison(b17.before, b17.before, b17.after).unchangedDuringCheck ||
    !productionComparison(old16.reference, b17.before, b17.after).beforeMatchesOriginal)
    throw Error("B18_BASELINES_INVALID");
  b17.rows.forEach((r: any, i: number) => {
    const c = B17_CORPUS[i];
    if (r.id !== c.id || r.category !== c.category || r.input !== c.input ||
      !isDeepStrictEqual(r.expected, c.expected) || r.verdict === "NOT_RUN" ||
      r.httpStatus !== 200 || r.integrationProcessed !== true || r.usedModel !== B12.model ||
      r.inferenceAttempts !== 1 || r.cloudCalls !== 0 || !r.transportTraces?.length ||
      r.transportTraces.some((t: any) => t.status !== 200) ||
      !emailMonitoringSchema.safeParse(r.actualJson).success ||
      !isDeepStrictEqual(JSON.parse(r.modelContent), r.actualJson) ||
      !r.production?.beforeMatchesOriginal || !r.production.afterMatchesOriginal || !r.production.unchangedDuringCheck)
      throw Error("B18_B17_RESULTS_INVALID");
  });
  const summary = evaluateB17(structuredClone(b17.rows), true, false);
  if (!isDeepStrictEqual(summary, b17.summary) || summary.technicalSuccesses !== 100)
    throw Error("B18_B17_SCORE_INVALID");
  return { b17: { sha256: hash(b17), summary }, b16: old16, reference: b17.after };
}
export function findB17Baseline(root: string, uid: number, source: any, b16: any) {
  return findVerifiedBaseline(root, uid, { phase: "B1.7", directoryPrefix: "B17", errorPrefix: "B18_B17",
    filename: "B17_evidence.json", validate(report) {
      const validated = validateB18Baselines(report, b16, source);
      return { ...validated.b17, reference: validated.reference };
    } });
}
export function evaluateB18(rows: any[], safe: boolean | null, interrupted = false) {
  if (rows.length !== 135) throw Error("B18_ROWS_INVALID");
  const b17 = evaluateB17(rows.slice(0, 100), safe, interrupted);
  const b16 = evaluateB16(rows.slice(100), safe, interrupted);
  const allCritical = [...b17.criticalErrors, ...b16.criticalErrors];
  let technicalSuccesses = 0;
  for (const r of rows) {
    if (r.verdict === "NOT_RUN") continue;
    let rawMatches = false;
    try { rawMatches = isDeepStrictEqual(JSON.parse(r.modelContent), r.actualJson); } catch {}
    const technicalOK = rawMatches && emailMonitoringSchema.safeParse(r.actualJson).success &&
      r.integrationProcessed === true && r.usedModel === B12.model && r.httpStatus === 200 &&
      r.inferenceAttempts === 1 && r.cloudCalls === 0 && r.transportTraces.length > 0 &&
      r.transportTraces.every((t: any) => t.status === 200) &&
      (!r.error || r.error === "B12_SEMANTIC_MISMATCH");
    r.technical = { ...r.technical, success: technicalOK, rawMatches };
    if (technicalOK) technicalSuccesses++;
    r.criticalErrors = allCritical.filter(e => e.id === r.id)
      .map(e => ({ ...e, technicalSuccess: technicalOK }));
    r.checks?.forEach((c: any) => { if (c.expected === null) c.status = "REVIEW_REQUIRED"; });
    if (!r.noteChecks) {
      const note = r.actualJson?.note;
      r.noteChecks = { shapeValid: typeof note === "string" && note.trim().length > 0 &&
        note.length <= 100 && [...note].length <= 100, slovakLanguage: "REVIEW_REQUIRED" };
    }
  }
  const noteFailures = rows.filter(r => r.verdict !== "NOT_RUN" && !r.noteChecks?.shapeValid).length;
  const reasons = [...b17.reasons.map((r: string) => "B17_" + r), ...b16.reasons.map((r: string) => "B16_" + r)];
  if (noteFailures) reasons.push("NOTE_SHAPE_FAILURE");
  const executedCases = b17.executedCases + b16.executedCases;
  if (technicalSuccesses !== executedCases) reasons.push("TECHNICAL_RESPONSE_FAILURE");
  return { verdict: b17.verdict === "FAIL" || b16.verdict === "FAIL" || noteFailures || technicalSuccesses !== executedCases ? "FAIL" : "REVIEW_REQUIRED",
    reasons, totalCases: 135, totalExpectations: 1080,
    executedCases, technicalSuccesses,
    inferenceAttempts: b17.inferenceAttempts + b16.inferenceAttempts,
    cloudCalls: b17.cloudCalls + b16.cloudCalls, productionUnchanged: safe, noteFailures,
    b17, b16, criticalErrors: rows.flatMap(r => r.criticalErrors ?? []) };
}
export function compareB18(b17: any, b16: any, rows: any[]) {
  const fields: any[] = [], regressions: any[] = [], repaired: any[] = [], stillWrong: any[] = [];
  const cases = rows.map((r, i) => {
    const c = B18_CORPUS[i], old = i < 100 ? b17.rows[i] : b16.rows[i - 100];
    const available = r.verdict !== "NOT_RUN" && r.technical?.success === true;
    const checks = B13_FIELDS.map(field => {
      const expected = c.expected[field], before = old.actualJson[field], after = r.actualJson?.[field] ?? null;
      const status = expected === null ? "REVIEW_REQUIRED" : !available ? "NOT_COMPARABLE" :
        before === expected ? after === expected ? "UNCHANGED_CORRECT" : "REGRESSION" :
          after === expected ? "REPAIRED" : "STILL_WRONG";
      const check = { id: c.id, baselinePhase: i < 100 ? "B1.7" : "B1.6", field, expected,
        before, after, status, changed: available ? !isDeepStrictEqual(before, after) : null };
      fields.push(check);
      if (status === "REGRESSION") regressions.push(check);
      if (status === "REPAIRED") repaired.push(check);
      if (status === "STILL_WRONG") stillWrong.push(check);
      return check;
    });
    return { id: c.id, input: c.input, expected: c.expected, before: old.actualJson, after: r.actualJson,
      checks, verdict: r.verdict, technical: r.technical ?? { parserProcessed: r.integrationProcessed },
      noteChecks: r.noteChecks ?? null, criticalErrors: r.criticalErrors ?? [] };
  });
  return { fields, cases, regressions, repaired, stillWrong,
    reviewRequired: fields.filter(f => f.status === "REVIEW_REQUIRED"),
    notComparable: fields.filter(f => f.status === "NOT_COMPARABLE"),
    specialCases: B18_SPECIAL_IDS.map(id => cases.find(c => c.id === id)),
    interpretation: "Same frozen inputs and references. Null gold is neither correct nor wrong. Technical failures are not asserted to be model regressions." };
}
export function executeB18(options: EmailPilotOptions & { b17: any; b16: any }) {
  const baselines = validateB18Baselines(options.b17, options.b16, options.source);
  if (!productionComparison(baselines.reference, options.reference, options.reference).beforeMatchesOriginal)
    throw Error("B18_REFERENCE_MISMATCH");
  return executeEmailPilot(options, { phase: "B1.8", corpus: B18_CORPUS,
    corpusSha256: B18_CORPUS_SHA256, recordTiming: true, evaluate: evaluateB18,
    requestTimeoutMs: B18_EXECUTION_PROFILE.requestTimeoutMs, warmup: true,
    decorate(report) {
      report.executionProfile = B18_EXECUTION_PROFILE;
      report.modelMapping = { status: "REVIEW_REQUIRED",
        crmService: "email.monitoring", requestedAlias: B12.model,
        gatewayDeclarations: report.warmup?.transportTraces?.filter((t: any) => t.modelDeclaration)
          .map((t: any) => ({ route: t.route, ...t.modelDeclaration })) ?? [],
        ollamaModel: null, ollamaDigest: null, classificationRulesSha256: null,
        explanation: "CRM request and Gateway declarations are observed. Backend alias mapping and deployed classification rules require independent AI-server evidence; response model alias is not proof." };
      report.performance = performanceMetrics(report.rows.filter((r: any) => r.verdict !== "NOT_RUN").map((r: any) => r.processingMs));
      report.successfulPerformance = performanceMetrics(report.rows.filter((r: any) => r.technical?.success === true).map((r: any) => r.processingMs));
      report.totalInferenceAttempts = report.summary.inferenceAttempts + (report.warmup?.inferenceAttempts ?? 0);
      if (report.warmup?.state === "COMPLETED" && (report.warmup.error && report.warmup.error !== "B12_SEMANTIC_MISMATCH" ||
        report.warmup.integrationProcessed !== true || report.warmup.httpStatus !== 200 ||
        report.warmup.usedModel !== B12.model || report.warmup.cloudCalls !== 0)) {
        report.summary.verdict = "FAIL";
        report.summary.reasons.push("WARMUP_TECHNICAL_FAILURE");
      }
      report.baselines = { b17: baselines.b17, b16: { sha256: baselines.b16.sha256, summary: baselines.b16.summary } };
      report.corpora = { b17: B17_CORPUS_SHA256, b16: B14_CORPUS_SHA256 };
      report.serverRuleVersion = { requested: "B1.8", source: "Operator-declared server update; model alias alone does not independently attest deployed rule bytes." };
      report.comparison = compareB18(options.b17, options.b16, report.rows);
      const oldCritical = [...baselines.b17.summary.criticalErrors, ...baselines.b16.summary.criticalErrors];
      report.comparison.newCriticalErrors = report.summary.criticalErrors.filter((e: any) =>
        e.technicalSuccess && !oldCritical.some((old: any) => old.id === e.id && old.code === e.code && old.field === e.field));
      if (report.comparison.regressions.length) {
        report.summary.verdict = "FAIL"; report.summary.reasons.push("NEW_FIELD_REGRESSION");
      }
      report.acceptance = { b17: "Original 98% fields / 95% cases, uncertainty bounds preserved",
        b16: "Original strict 280/280 fields and 35/35 cases", newRegressions: 0, criticalErrors: 0,
        unresolvedReferences: "REVIEW_REQUIRED", noteLanguage: "Independent post-run review required",
        maxAttempts: 135, warmupAttempts: 1, maxTotalAttempts: 136, retries: 0, productionActivation: false };
    } });
}
export function failuresB18(report: any) {
  return { phase: "B1.8", verdict: report.summary.verdict, reasons: report.summary.reasons,
    warmup: report.warmup ?? null, runtime: report.runtime ?? null, modelMapping: report.modelMapping,
    newRegressions: report.comparison.regressions, repaired: report.comparison.repaired,
    stillWrong: report.comparison.stillWrong, criticalErrors: report.summary.criticalErrors,
    newCriticalErrors: report.comparison.newCriticalErrors,
    reviewRequired: report.comparison.reviewRequired, notComparable: report.comparison.notComparable,
    technicalFailures: report.rows.filter((r: any) => r.verdict !== "NOT_RUN" &&
      (r.technical?.success === false || !r.integrationProcessed || r.httpStatus !== 200 || r.error && r.error !== "B12_SEMANTIC_MISMATCH")),
    noteReviews: report.rows.filter((r: any) => r.verdict !== "NOT_RUN")
      .map((r: any) => ({ id: r.id, note: r.actualJson?.note ?? null, ...r.noteChecks })),
    notRunIds: report.rows.filter((r: any) => r.verdict === "NOT_RUN").map((r: any) => r.id) };
}
export function renderB18(report: any) {
  const s = report.summary, cmp = report.comparison;
  const pretty = (v: any) => JSON.stringify(v, null, 2).replace(/`/g, "\\u0060").replace(/</g, "\\u003c");
  const lines = ["# B1.8 — izolované regresné overenie", `Výsledok: **${s.verdict}**`,
    `Vykonané: ${s.executedCases}/135; inferenčné pokusy: ${s.inferenceAttempts}/135; cloud: ${s.cloudCalls}.`,
    "Nezmenené vstupy a referencie: 100 správ B1.7 + 35 správ B1.6. Žiadne automatické opakovanie ani oprava výstupu.",
    `B1.7 sada: ${s.b17.correctExpectations}/800 správnych, ${s.b17.wrongExpectations} chybných, ${s.b17.unresolvedExpectations} nerozhodnutých polí.`,
    `Presnosť B1.7: ${s.b17.fieldSuccessPct.toFixed(2)}–${s.b17.fieldUpperBoundPct.toFixed(2)} %; iba rozhodnuté polia: ${s.b17.knownOnlyFieldSuccessPct ?? "neoverené"} %.`,
    `Celé klasifikačné prípady B1.7: ${s.b17.passedCases}–${s.b17.caseUpperBoundPct}/100.`,
    `B1.6 sada: ${s.b16.correctExpectations}/280; celé prípady: ${s.b16.passedCases}/35.`,
    `Opravené polia: ${cmp.repaired.length}; nové regresie: ${cmp.regressions.length}; pretrvávajúce chyby: ${cmp.stillWrong.length}.`,
    "Null referencie sú vždy REVIEW_REQUIRED, nikdy automatický úspech alebo chyba. Slovenčina všetkých note potrebuje nezávislé posúdenie.",
    "Ide o regresiu známych sád, nie o novú nezávislú validáciu zovšeobecnenia.",
     "", "## Technické nastavenie a zahriatie",
     "Timeout 120 s je iba v izolovanom klientovi (SDK aj časovač); produkčné nastavenie sa nemení.",
     "Jedna zahrievacia požiadavka je mimo skóre aj regresných latencií. Bez retries, fallbacku a opráv klasifikácie.",
     "```json", pretty({ profile: report.executionProfile, runtime: report.runtime ?? null,
       warmup: report.warmup ?? null, totalInferenceAttempts: report.totalInferenceAttempts,
       performance: report.performance, successfulPerformance: report.successfulPerformance,
       modelMapping: report.modelMapping }), "```",
     "Pôvodný snapshot pri 79/135 s rozbehnutým 80. pokusom sám nepreukazuje ukončenie procesu. Príčina prípadného ukončenia vyžaduje procesný log.",
     "Runner ani jeho spúšťač nemajú celkový deadline regresie. Externý timeout alebo SIGKILL tým nie je vylúčený.",
    "", "## Osobitne požadované prípady", "```json", pretty(cmp.specialCases), "```",
    "", "## Nové regresie", "```json", pretty(cmp.regressions), "```",
    "", "## Kritické chyby", "```json", pretty({ all: s.criticalErrors, new: cmp.newCriticalErrors }), "```",
    "", "## Opravené a pretrvávajúce chyby", "```json", pretty({ repaired: cmp.repaired, stillWrong: cmp.stillWrong }), "```",
    "", "## Nerozhodnuté referencie a technicky neporovnateľné polia", "```json",
    pretty({ reviewRequired: cmp.reviewRequired, notComparable: cmp.notComparable }), "```",
    "", "## Historické a aktuálne skóre", "```json",
    pretty({ baselines: report.baselines, current: { b17: s.b17, b16: s.b16 }, corpora: report.corpora,
      serverRuleVersion: report.serverRuleVersion }), "```",
    "", "## Produkčná bezpečnosť",
    `Zápisy nastavení: ${report.productionSettingsWrites}; záznamov: ${report.productionRecordWrites}; notifikácie: ${report.customerNotifications}.`,
    "```json", pretty({ before: report.before, after: report.after, comparison: report.production }), "```",
    "Gateway musí zostať vypnutá; všetkých 65 služieb na OpenAI, model overrides 0. Produkčné prepnutie nie je povolené ani pri PASS.",
    "Časy sú end-to-end vrátane discovery a read-only kontrol, nie čistá GPU inferencia.",
    "", "## Dôvody", ...s.reasons.map((r: string) => "- " + r),
    "", "## Všetkých 1080 párových klasifikačných polí", "```json", pretty(cmp.fields), "```"];
  for (const r of report.rows) lines.push("", "## " + r.id, r.input, "```json",
    pretty({ expected: r.expected, actual: r.actualJson, rawContent: r.modelContent, checks: r.checks,
      verdict: r.verdict, error: r.error, httpStatus: r.httpStatus, usedModel: r.usedModel,
      crmResult: r.crmResult, technical: r.technical, noteChecks: r.noteChecks,
      processingMs: r.processingMs, inferenceAttempts: r.inferenceAttempts, cloudCalls: r.cloudCalls,
       timeout: r.timeout, errorIdentity: r.errorIdentity,
       transportTraces: r.transportTraces, production: r.production }), "```");
  return lines.join("\n") + "\n";
}
