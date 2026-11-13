#!/usr/bin/env node
"use strict";

// Test-only prompt change. Reuses the unchanged B4 corpus, schema and scoring.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const P = require("./ai-gateway-b4-pilot.cjs");
const hash = x => crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
const fail = code => { throw new P.PilotError(code); };
const INSTRUCTION = P.INSTRUCTION + `

STRICT FIELD RULES (these clarify the rules above):
1. document_id contains ONLY the standalone document identifier token copied
from this document. Preserve every character, letter case and leading zero.
NEVER include the document type, title, label, adjective, quotation marks or
surrounding punctuation. Example: "Delivery note DEMO-731" has document_id
"DEMO-731", NOT "Delivery note DEMO-731". Example: "Poznámka MEM-X9" has
document_id "MEM-X9", NOT "Poznámka MEM-X9". Do not use a reference number
as the document identifier.
2. For issue_date and due_date require an explicit complete date belonging
to THAT field, with an unambiguous day, month and year. Otherwise return null.
NEVER infer the locale, day/month order, year, or a date from context.
A slash date with unspecified locale is ambiguous: return null, do not guess.
NEVER substitute a delivery date, payment date or other field for issue_date.
NEVER fill a missing year from another date, an identifier or the current date.
3. These rules change no other field. Copy supported values faithfully and
keep unsupported or missing values null. Return exactly the original eight
JSON keys with their original types. No prose and no additional properties.`;

function verifyBaseline(report, plan) {
  if (!report || typeof report !== "object" || !plan || typeof plan !== "object" ||
      !plan.schema || !Array.isArray(plan.corpus)) fail("B5_BASELINE_REPORT_INVALID");
  const expectedPlanHash = hash({ schema: P.SCHEMA, instruction: P.INSTRUCTION, corpus: P.CORPUS });
  if (hash(plan?.schema) !== hash(P.SCHEMA) || hash(plan?.corpus) !== hash(P.CORPUS) ||
      plan?.instruction !== P.INSTRUCTION || plan?.planSha256 !== expectedPlanHash ||
      report?.planSha256 !== expectedPlanHash) fail("B5_BASELINE_FIXTURES_MISMATCH");
  if (report.model !== P.MODEL || report.code !== null || report.finalVerified !== true ||
      !report.before || !report.after || !P.unchanged(report.before, report.after) ||
      !Array.isArray(report.rows) || report.rows.length !== 10 ||
      new Set(report.rows.map(r => r.id)).size !== 10)
    fail("B5_BASELINE_REPORT_INVALID");
  const rows = P.CORPUS.map(doc => {
    const row = report.rows.find(r => r.id === doc.id);
    if (!row || row.attempted !== true || !row.actual || row.jsonValid !== true ||
        row.schemaValid !== true || row.transportError ||
        !Number.isSafeInteger(row.durationMs) || row.durationMs < 0)
      fail("B5_BASELINE_ROW_INVALID");
    const evaluated = P.evaluate(JSON.stringify(row.actual), doc.expected);
    if (!evaluated.schemaValid || evaluated.correct !== row.correct ||
        JSON.stringify(evaluated.wrong) !== JSON.stringify(row.wrong) ||
        JSON.stringify(evaluated.unsupported) !== JSON.stringify(row.unsupported))
      fail("B5_BASELINE_SCORES_MISMATCH");
    return { id: row.id, attempted: true, durationMs: row.durationMs, ...evaluated };
  });
  const summary = P.aggregate(rows, true);
  for (const key of ["attempted", "correctFields", "fieldAccuracyPercent", "nonNullFieldAccuracyPercent",
    "validJson", "validSchema", "exactDocuments", "unsupportedValues", "meanProcessingMs"]) {
    if (typeof report.summary?.[key] !== "number" ||
        Math.abs(summary[key] - report.summary[key]) > 1e-8)
      fail("B5_BASELINE_SUMMARY_MISMATCH");
  }
  const wrong = rows.flatMap(r => r.wrong);
  if (summary.correctFields !== 72 || summary.exactDocuments !== 2 ||
      summary.unsupportedValues !== 1 ||
      wrong.filter(k => k === "document_id").length !== 7 ||
      wrong.filter(k => k === "issue_date").length !== 1 ||
      wrong.length !== 8 ||
      !rows.find(r => r.id === "SYN-B4-07").unsupported.includes("issue_date"))
    fail("B5_BASELINE_DIFFERS_FROM_REVIEW");
  return {
    model: report.model, before: report.before, after: report.after, rows, summary,
    schemaSha256: hash(P.SCHEMA), corpusSha256: hash(P.CORPUS),
    expectedSha256: hash(P.CORPUS.map(d => ({ id: d.id, expected: d.expected }))),
    originalPlanSha256: expectedPlanHash,
    provenance: "B4 report and plan read locally; all extraction scores recomputed",
  };
}
function loadBaseline(filename) {
  const root = path.join(os.homedir(), ".indexus-b4") + path.sep;
  if (!path.isAbsolute(filename) || !filename.startsWith(root) ||
      path.basename(filename) !== "report.json") fail("B5_BASELINE_PATH_INVALID");
  function read(file) {
    try {
      if (fs.realpathSync(file) !== file) fail("B5_BASELINE_SYMLINK_REFUSED");
      const s = fs.lstatSync(file);
      if (!s.isFile() || s.uid !== process.getuid() || (s.mode & 0o077) || s.size > 1024 * 1024)
        fail("B5_BASELINE_FILE_UNSAFE");
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      if (error instanceof P.PilotError) throw error;
      fail("B5_BASELINE_UNREADABLE");
    }
  }
  return verifyBaseline(read(filename), read(path.join(path.dirname(filename), "plan.json")));
}
function finalize(report, baseline) {
  if (!baseline) fail("B5_BASELINE_REQUIRED");
  let fixed = 0, remaining = 0, regressions = 0;
  for (const doc of P.CORPUS) {
    const before = baseline.rows.find(r => r.id === doc.id);
    const after = report.rows.find(r => r.id === doc.id);
    for (const field of P.FIELDS) {
      const wasCorrect = !before.wrong.includes(field);
      const isCorrect = !!after?.schemaValid && !!after.fields?.find(f => f.field === field)?.correct;
      if (!wasCorrect && isCorrect) fixed++;
      if (!wasCorrect && !isCorrect) remaining++;
      if (wasCorrect && !isCorrect) regressions++;
    }
  }
  report.comparison = {
    baseline: baseline.summary,
    schemaUnchanged: baseline.schemaSha256 === hash(P.SCHEMA),
    corpusUnchanged: baseline.corpusSha256 === hash(P.CORPUS),
    expectedUnchanged: baseline.expectedSha256 === hash(P.CORPUS.map(d => ({ id: d.id, expected: d.expected }))),
    fixedOriginalErrors: fixed, remainingOriginalErrors: remaining,
    previouslyCorrectFieldsNowWrongOrUnverified: regressions,
    fieldAccuracyDeltaPercentagePoints: report.summary.fieldAccuracyPercent - baseline.summary.fieldAccuracyPercent,
    exactDocumentsDelta: report.summary.exactDocuments - baseline.summary.exactDocuments,
    unsupportedValuesDelta: report.summary.unsupportedValues - baseline.summary.unsupportedValues,
    meanProcessingMsDelta: report.summary.meanProcessingMs === null ? null :
      report.summary.meanProcessingMs - baseline.summary.meanProcessingMs,
    generationNote: "temperature=0, stream=false, max_tokens=512 and retries=0 unchanged from B4; " +
      "seed is not supported by the current Gateway contract; exact reproducibility is not guaranteed",
    evidenceNote: "Same previously evaluated documents: prompt regression check, not independent generalization evidence. " +
      "Same model alias, model revision not independently verified.",
  };
  report.optimizationPassed = report.status === "PASSED_SYNTHETIC_PILOT" &&
    fixed === 8 && regressions === 0 && report.summary.unsupportedValues === 0;
  report.summary.recommendation = report.optimizationPassed ?
    "VALIDATE_ON_UNSEEN_SYNTHETIC_DOCUMENTS_BEFORE_REAL_USE" : "NOT_READY_FOR_REAL_USE";
}
function markdown(report) {
  const c = report.comparison, b = c.baseline, s = report.summary;
  const pct = n => n.toFixed(2) + " %";
  const time = ms => ms === null ? "—" : (ms / 1000).toFixed(3) + " s";
  return P.markdown(report) + "\n## Porovnanie B4 a B5\n\n" +
    "| Ukazovateľ | B4 | B5 |\n|---|---:|---:|\n" +
    `| Počet pokusov | ${b.attempted}/10 | ${s.attempted}/10 |\n` +
    `| Správnosť všetkých polí | ${pct(b.fieldAccuracyPercent)} | ${pct(s.fieldAccuracyPercent)} |\n` +
    `| Správnosť nenulových polí | ${pct(b.nonNullFieldAccuracyPercent)} | ${pct(s.nonNullFieldAccuracyPercent)} |\n` +
    `| Úplne správne dokumenty | ${b.exactDocuments}/10 | ${s.exactDocuments}/10 |\n` +
    `| Platný JSON | ${b.validJson}/10 | ${s.validJson}/10 |\n` +
    `| Správna štruktúra | ${b.validSchema}/10 | ${s.validSchema}/10 |\n` +
    `| Nepodložené hodnoty | ${b.unsupportedValues} | ${s.unsupportedValues} |\n` +
    `| Priemerný čas dokumentu | ${time(b.meanProcessingMs)} | ${time(s.meanProcessingMs)} |\n\n` +
    `Opravené pôvodné chyby: **${c.fixedOriginalErrors}/8**. ` +
    `Pôvodne správne polia teraz chybné alebo neoverené: **${c.previouslyCorrectFieldsNowWrongOrUnverified}**.\n` +
    `Schéma nezmenená: **${c.schemaUnchanged}**; dokumenty: **${c.corpusUnchanged}**; ` +
    `očakávané výsledky: **${c.expectedUnchanged}**.\n` +
    "Generovanie: temperature=0, stream=false, max_tokens=512, bez retries — rovnaké ako B4. " +
    "Aktuálny Gateway kontrakt nepodporuje seed; bitovo zhodné opakovanie preto nie je garantované.\n\n" +
    (report.optimizationPassed ?
      "**Odporúčanie:** oprava prešla na známej sade. Pred prvým reálnym použitím overiť " +
      "novú nezávislú syntetickú sadu; potom najviac asistovaná extrakcia s ľudskou kontrolou. " :
      "**Odporúčanie:** zatiaľ nepoužiť na reálne údaje; zostali chyby alebo nebol beh úplný. ") +
    "Žiadne automatické zápisy ani presmerovanie produkčných služieb. " +
    "Rovnakých desať dokumentov preveruje opravu promptu, nie všeobecnú spoľahlivosť modelu.\n";
}
const options = () => ({ phase: "B5", instruction: INSTRUCTION, loadBaseline, finalize, render: markdown });
module.exports = { INSTRUCTION, verifyBaseline, loadBaseline, finalize, markdown, options };
if (require.main === module) P.main(options()).catch(error => {
  console.error(error instanceof P.PilotError ? error.code : "B5_LOCAL_OR_DATABASE_ERROR");
  process.exitCode = 1;
});
