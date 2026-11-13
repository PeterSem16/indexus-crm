#!/usr/bin/env node
"use strict";
const crypto = require("node:crypto");
const P = require("./ai-gateway-b4-pilot.cjs");
const B5 = require("./ai-gateway-b5-pilot.cjs");
const { NEW_CORPUS } = require("./lib/ai-gateway-b6-corpus.cjs");
const { POLICY, evaluateResponse } = require("./lib/ai-gateway-b6-normalization.cjs");
const { loadBaseline } = require("./lib/ai-gateway-b6-baseline.cjs");
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const CORPUS = [...P.CORPUS, ...NEW_CORPUS];
const INSTRUCTION = B5.INSTRUCTION + `

DOCUMENT_ID TOKEN BOUNDARIES:
document_id is the identifier token, NEVER a document heading or description.
Separate the document type/title from its number before copying the number.
Remove ONLY surrounding labels, spaces, brackets and sentence punctuation;
preserve punctuation that is INSIDE the identifier, including / _ . : -,
and preserve letter case and leading zeros. For example,
"Purchase order [CASE/2041/0007]" means document_id "CASE/2041/0007".
If an identifier has the form SYN-B4 followed by a hyphen and two digits,
return that token alone; no "dodací list", "objednávka" or other title.
Do not concatenate any preceding or following words with the identifier.
These refinements apply only to document_id. All other extraction rules,
including explicit date evidence and null handling, remain unchanged.`;

function normalizedRows(rows) {
  return rows.map(row => ({ id: row.id, attempted: row.attempted,
    durationMs: row.durationMs, transportError: row.transportError, code: row.code,
    ...(row.normalized ?? { correct: 0, presentCorrect: 0 }) }));
}
function finalize(report, baseline) {
  if (!baseline) throw new P.PilotError("B6_BASELINE_REQUIRED");
  report.normalizationPolicy = POLICY;
  report.fixtureParity = {
    schemaUnchanged: baseline.schemaSha256 === hash(P.SCHEMA),
    regressionUnchanged: baseline.regressionCorpusSha256 === hash(P.CORPUS),
    newCorpusSha256: hash(NEW_CORPUS),
  };
  report.groups = [
    { name: "Pôvodných 10 – regresia", corpus: P.CORPUS },
    { name: "Nových 10 – prvé vyhodnotenie", corpus: NEW_CORPUS },
  ].map(group => {
    const ids = new Set(group.corpus.map(doc => doc.id));
    const rows = report.rows.filter(row => ids.has(row.id));
    return { name: group.name,
      raw: P.aggregate(rows, report.finalVerified, group.corpus),
      normalized: P.aggregate(normalizedRows(rows), report.finalVerified, group.corpus),
      normalizationApplied: rows.filter(row => row.normalization?.applied).length,
      normalizationChanges: rows.filter(row => row.normalization?.applied).map(row => ({
        id: row.id, before: row.normalization.before, after: row.normalization.after,
        reason: row.normalization.reason })),
    };
  });
  report.normalizedSummary = P.aggregate(normalizedRows(report.rows), report.finalVerified, CORPUS);
  report.normalizationEffect = {
    applied: report.rows.filter(row => row.normalization?.applied).length,
    improvedDocuments: report.rows.filter(row => row.normalized &&
      row.normalized.correct > row.correct).length,
    worsenedDocuments: report.rows.filter(row => row.normalized &&
      row.normalized.correct < row.correct).length,
    fieldAccuracyDeltaPercentagePoints:
      report.normalizedSummary.fieldAccuracyPercent - report.summary.fieldAccuracyPercent,
  };
  report.b5RegressionBaseline = baseline.summary;
  const validRun = report.finalVerified && !report.code && report.summary.attempted === 20;
  report.rawPassed = validRun && report.summary.exactDocuments === 20;
  report.normalizedPassed = validRun && report.normalizedSummary.exactDocuments === 20;
  report.status = !validRun ? "FAILED_OR_INCOMPLETE" : report.rawPassed ?
    "PASSED_RAW_AND_NORMALIZED" : report.normalizedPassed ?
      "MODEL_ERRORS_REPAIRED_BY_TEST_NORMALIZATION" : "COMPLETED_WITH_EXTRACTION_ERRORS";
  report.summary.recommendation = !report.normalizedPassed ? "NOT_READY_FOR_REAL_USE" :
    report.rawPassed ? "ASSISTED_PILOT_ONLY_NOT_AUTOMATION" :
      "ASSISTED_PILOT_WITH_EXPLICIT_ID_VALIDATION_ONLY";
}
const pct = value => value.toFixed(2) + " %";
const seconds = ms => ms === null ? "—" : (ms / 1000).toFixed(3) + " s";
function markdown(report) {
  const rows = report.rows.map(row => `| ${row.id} | ${row.attempted ?
    row.jsonValid ? "OK" : "NIE" : "—"} | ${row.attempted ? row.schemaValid ? "OK" : "NIE" : "—"} | ` +
    `${row.correct ?? 0}/8 | ${row.normalized?.correct ?? 0}/8 | ${seconds(row.durationMs ?? null)} | ` +
    `${row.normalization?.applied ? "ÁNO" : "NIE"} | ${row.normalization?.reason ?? row.code ?? "—"} | ` +
    `${row.normalized ? row.normalized.code ?? "—" : row.code ?? "—"} |`).join("\n");
  const groups = report.groups.map(group =>
    `| ${group.name} | ${group.raw.attempted}/10 | ${pct(group.raw.fieldAccuracyPercent)} | ` +
    `${pct(group.normalized.fieldAccuracyPercent)} | ${group.raw.exactDocuments}/10 | ` +
    `${group.normalized.exactDocuments}/10 | ${group.raw.unsupportedValues} / ${group.normalized.unsupportedValues} | ` +
    `${seconds(group.raw.meanProcessingMs)} |`).join("\n");
  const raw = report.summary, normalized = report.normalizedSummary, b5 = report.b5RegressionBaseline;
  return `# B6 – jeden spoločný report\n\nStav: **${report.status}**. Model: \`${P.MODEL}\`.\n\n` +
    "| Dokument | JSON | Schéma | Model | Po normalizácii | Čas AI | Úprava ID | Dôvod normalizácie | Zvyšná chyba |\n" +
    "|---|---|---|---:|---:|---:|---|---|---|\n" + rows +
    "\n\n## Oddelené výsledky oboch sád\n\n" +
    "| Sada | Pokusy | Presnosť modelu | Po normalizácii | Presné dokumenty modelu | Po normalizácii | Nepodložené pred / po | Priemer AI |\n" +
    "|---|---:|---:|---:|---:|---:|---:|---:|\n" + groups +
    `\n\nSpolu model: **${raw.correctFields}/160 (${pct(raw.fieldAccuracyPercent)})**. ` +
    `Po normalizácii: **${normalized.correctFields}/160 (${pct(normalized.fieldAccuracyPercent)})**.\n` +
    `Nenulové polia pred / po: ${pct(raw.nonNullFieldAccuracyPercent)} / ${pct(normalized.nonNullFieldAccuracyPercent)}.\n` +
    `Platný JSON: ${raw.validJson}/20. Schéma: ${raw.validSchema}/20. ` +
    `Chýbajúce hodnoty pred / po: ${raw.missingValues} / ${normalized.missingValues}.\n` +
    `Normalizácia použitá: ${report.normalizationEffect.applied}; zlepšené dokumenty: ` +
    `${report.normalizationEffect.improvedDocuments}; zhoršené: ${report.normalizationEffect.worsenedDocuments}.\n` +
    `B5 na pôvodnej sade: ${pct(b5.fieldAccuracyPercent)}, presné dokumenty ${b5.exactDocuments}/10, ` +
    `priemer ${seconds(b5.meanProcessingMs)}. B6 model na rovnakej sade: ` +
    `${pct(report.groups[0].raw.fieldAccuracyPercent)}, presné ${report.groups[0].raw.exactDocuments}/10, ` +
    `priemer ${seconds(report.groups[0].raw.meanProcessingMs)}.\n` +
    `Schéma nezmenená: **${report.fixtureParity.schemaUnchanged}**; pôvodné dokumenty a očakávania: ` +
    `**${report.fixtureParity.regressionUnchanged}**.\n` +
    `Záverečná zhoda konfigurácie: **${report.finalVerified}**. Konečný stav: ` +
    `${report.after ? "Gateway vypnutá; 65 OpenAI; 0 overrides." : "NEOVERENÝ."} ` +
    `Chyba behu: ${report.code ?? "žiadna"}.\n\n` +
    `**Odporúčanie: ${raw.recommendation}.** ` +
    (!report.normalizedPassed ? "Zatiaľ nepoužiť na reálne údaje; zostali chyby alebo beh nebol úplný." :
      report.rawPassed ? "Výsledok podporuje iba malý asistovaný pilot s ľudskou kontrolou, nie automatické zápisy." :
        "Výsledok podporuje nanajvýš asistovaný pilot s explicitnou kontrolou ID. " +
        "Opravy normalizátorom NIE SÚ správne odpovede modelu.") +
    "\n\nNormalizuje sa iba jednoznačný, zdrojom potvrdený SYN-B4-XX v document_id. " +
    "Iné formáty ID, dátumy ani ostatné polia sa neopravujú. " +
    "Nová sada používa iné formáty ID, preto jej výsledok nemožno zachraňovať týmto pravidlom. " +
    "Očakávané odpovede sa neposielajú modelu ani normalizátoru. " +
    "temperature=0, max_tokens=512, stream=false, bez opakovania požiadaviek; seed kontrakt nepodporuje. " +
    "Čas je jedna inferencia na dokument, nie druhé AI volanie na normalizáciu. " +
    "Nepodložené hodnoty znamenajú nenulové odpovede namiesto očakávaného null, nie všetky druhy chýb. " +
    "Nová sada je iba malá prvá vzorka, nie dôkaz všeobecnej spoľahlivosti; revízia modelu nebola osobitne overená.\n";
}
const options = () => ({ phase: "B6", instruction: INSTRUCTION, corpus: CORPUS,
  loadBaseline, finalize, render: markdown, evaluateResponse, planMetadata: { normalization: POLICY } });
module.exports = { CORPUS, NEW_CORPUS, INSTRUCTION, finalize, markdown, options };
if (require.main === module) P.main(options()).catch(error => {
  console.error(error instanceof P.PilotError ? error.code : "B6_LOCAL_OR_DATABASE_ERROR");
  process.exitCode = 1;
});
