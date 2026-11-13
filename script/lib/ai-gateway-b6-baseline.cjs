"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const P = require("../ai-gateway-b4-pilot.cjs");
const B5 = require("../ai-gateway-b5-pilot.cjs");
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = code => { throw new P.PilotError(code); };
function verifyBaseline(report, plan) {
  const expectedHash = hash({ schema: P.SCHEMA, instruction: B5.INSTRUCTION, corpus: P.CORPUS });
  if (!report || !plan || report.phase !== "B5" || report.model !== P.MODEL ||
      report.code !== null || report.finalVerified !== true ||
      !report.before || !report.after || !P.unchanged(report.before, report.after) ||
      report.planSha256 !== expectedHash || plan.planSha256 !== expectedHash ||
      hash(plan.schema ?? null) !== hash(P.SCHEMA) ||
      hash(plan.corpus ?? null) !== hash(P.CORPUS) || plan.instruction !== B5.INSTRUCTION ||
      !Array.isArray(report.rows) || report.rows.length !== 10 ||
      new Set(report.rows.map(r => r.id)).size !== 10)
    fail("B6_B5_BASELINE_INVALID");
  const rows = P.CORPUS.map(doc => {
    const row = report.rows.find(r => r.id === doc.id);
    if (!row || !row.attempted || !row.actual || !row.jsonValid || !row.schemaValid ||
        row.transportError || !Number.isSafeInteger(row.durationMs) || row.durationMs < 0)
      fail("B6_B5_ROW_INVALID");
    const evaluated = P.evaluate(JSON.stringify(row.actual), doc.expected);
    if (!evaluated.schemaValid || evaluated.correct !== row.correct ||
        JSON.stringify(evaluated.wrong) !== JSON.stringify(row.wrong))
      fail("B6_B5_SCORES_MISMATCH");
    return { id: doc.id, attempted: true, durationMs: row.durationMs, ...evaluated };
  });
  const summary = P.aggregate(rows, true);
  const wrong = rows.flatMap(row => row.wrong.map(field => `${row.id}:${field}`)).sort();
  if (JSON.stringify(wrong) !== JSON.stringify([
    "SYN-B4-03:document_id", "SYN-B4-09:document_id",
  ]) || summary.correctFields !== 78 || summary.exactDocuments !== 8 || summary.unsupportedValues !== 0)
    fail("B6_B5_DIFFERS_FROM_REVIEW");
  for (const key of ["attempted", "correctFields", "fieldAccuracyPercent", "validJson",
    "validSchema", "exactDocuments", "unsupportedValues", "meanProcessingMs"]) {
    if (typeof report.summary?.[key] !== "number" ||
        Math.abs(summary[key] - report.summary[key]) > 1e-8) fail("B6_B5_SUMMARY_MISMATCH");
  }
  return { model: report.model, before: report.before, after: report.after, rows, summary,
    planSha256: expectedHash, schemaSha256: hash(P.SCHEMA), regressionCorpusSha256: hash(P.CORPUS) };
}
function loadBaseline() {
  const base = path.join(os.homedir(), ".indexus-b5");
  function read(filename) {
    try {
      if (fs.realpathSync(filename) !== filename) fail("B6_BASELINE_SYMLINK_REFUSED");
      const s = fs.lstatSync(filename);
      if (!s.isFile() || s.uid !== process.getuid() || (s.mode & 0o077) || s.size > 1024 * 1024)
        fail("B6_BASELINE_FILE_UNSAFE");
      return JSON.parse(fs.readFileSync(filename, "utf8"));
    } catch (error) {
      if (error instanceof P.PilotError) throw error;
      fail("B6_B5_BASELINE_UNREADABLE");
    }
  }
  const marker = read(path.join(base, "b5-started.json"));
  if (typeof marker.runDir !== "string" || path.dirname(marker.runDir) !== base ||
      !/^run-[A-Za-z0-9]+$/.test(path.basename(marker.runDir))) fail("B6_B5_MARKER_INVALID");
  return verifyBaseline(read(path.join(marker.runDir, "report.json")),
    read(path.join(marker.runDir, "plan.json")));
}
module.exports = { verifyBaseline, loadBaseline };
