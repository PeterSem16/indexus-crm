#!/usr/bin/env node
"use strict";
// Prepare a portable AI-server bundle. No DB imports, environment loader or HTTP.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const crypto = require("node:crypto"), cp = require("node:child_process");
const P = require("./ai-gateway-b4-pilot.cjs");
const B6 = require("./ai-gateway-b6-pilot.cjs");
const { POLICY } = require("./lib/ai-gateway-b6-normalization.cjs");
const hash = value => crypto.createHash("sha256").update(
  typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
const stable = value => Array.isArray(value) ? value.map(stable) :
  value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
const fail = code => { throw new P.PilotError(code); };
function buildFixture(report, plan) {
  const expected = { schema: P.SCHEMA, instruction: B6.INSTRUCTION, corpus: B6.CORPUS,
    testPolicy: { normalization: POLICY } };
  if (!report || !plan || report.phase !== "B6" || report.model !== P.MODEL ||
      report.planSha256 !== hash(expected) || plan.planSha256 !== hash(expected) ||
      hash(plan.schema) !== hash(P.SCHEMA) || hash(plan.corpus) !== hash(B6.CORPUS) ||
      plan.instruction !== B6.INSTRUCTION || !report.finalVerified || !report.rawPassed ||
      report.code !== null || !report.before || !report.after || !P.unchanged(report.before, report.after) ||
      report.normalizationEffect?.applied !== 0 ||
      JSON.stringify(report.generation) !== JSON.stringify({ temperature: 0, max_tokens: 512, stream: false, retries: 0 }) ||
      !Array.isArray(report.rows) || report.rows.length !== 20 ||
      new Set(report.rows.map(r => r.id)).size !== 20)
    fail("B7_B6_BASELINE_INVALID");
  for (const state of [report.before, report.after])
    if (state.gatewayEnabled !== false || state.total !== 65 || state.openai !== 65 ||
        state.internal !== 0 || state.modelOverrides !== 0 || state.enabled !== 65 ||
        !["routesSha256", "gatewayParametersSha256", "fullConfigurationSha256"].every(
          key => /^[a-f0-9]{64}$/.test(state[key] || ""))) fail("B7_B6_CONFIGURATION_INVALID");
  const rows = B6.CORPUS.map(doc => {
    const row = report.rows.find(r => r.id === doc.id);
    if (!row?.attempted || !row.actual || !row.jsonValid || !row.schemaValid ||
        row.extraKeys !== 0 || row.duplicateKeys || row.code || row.transportError ||
        !Number.isSafeInteger(row.durationMs) || row.durationMs < 0)
      fail("B7_B6_ROW_INVALID");
    const scored = P.evaluate(JSON.stringify(row.actual), doc.expected);
    if (!scored.schemaValid || scored.correct !== 8 || row.correct !== 8)
      fail("B7_B6_RAW_ACCURACY_NOT_PERFECT");
    return { id: doc.id, attempted: true, durationMs: row.durationMs, ...scored };
  });
  const summary = P.aggregate(rows, true, B6.CORPUS);
  if (summary.correctFields !== 160 || report.summary?.correctFields !== 160)
    fail("B7_B6_SUMMARY_MISMATCH");
  const payload = {
    model: P.MODEL, referencePrompt: B6.INSTRUCTION, schema: P.SCHEMA, corpus: B6.CORPUS,
    baselineB6: { correctFields: 160, totalFields: 160, exactDocuments: 20,
      normalizationApplied: 0, meanProcessingMs: summary.meanProcessingMs,
      crmStateVerifiedAt: report.after.atUtc, routesSha256: report.after.routesSha256,
      gatewayEnabled: false, openaiRoutes: 65, modelOverrides: 0 },
    sourcePlanSha256: report.planSha256,
  };
  return { payload, sha256: hash(stable(payload)) };
}
function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--export-b7") {
    console.log("node export-ai-gateway-b7.cjs --export-b7 (CORPCRM01 only; no AI or database calls)");
    return;
  }
  if (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN ||
      os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid() !== 1001)
    fail("B7_EXPORT_CORPCRM01_SEMAN_ONLY");
  const base = path.join(os.homedir(), ".indexus-b6");
  const read = filename => {
    if (fs.realpathSync(filename) !== filename) fail("B7_BASELINE_SYMLINK_REFUSED");
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.uid !== process.getuid() || stat.mode & 0o077 || stat.size > 1024 * 1024)
      fail("B7_BASELINE_FILE_UNSAFE");
    return JSON.parse(fs.readFileSync(filename, "utf8"));
  };
  const marker = read(path.join(base, "b6-started.json"));
  if (typeof marker.runDir !== "string" || path.dirname(marker.runDir) !== base ||
      !/^run-[A-Za-z0-9]+$/.test(path.basename(marker.runDir))) fail("B7_B6_MARKER_INVALID");
  const fixture = buildFixture(read(path.join(marker.runDir, "report.json")),
    read(path.join(marker.runDir, "plan.json")));
  const out = path.join(os.homedir(), ".indexus-b7-transfer");
  if (!fs.existsSync(out)) fs.mkdirSync(out, { mode: 0o700 });
  const s = fs.lstatSync(out);
  if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== process.getuid() || s.mode & 0o077)
    fail("B7_TRANSFER_DIRECTORY_UNSAFE");
  const dir = fs.mkdtempSync(path.join(out, "bundle-"));
  const names = ["ai-gateway-b7.py", "ai_gateway_b7_core.py", "fixtures.json"];
  fs.writeFileSync(path.join(dir, names[0]), fs.readFileSync(path.join(__dirname, names[0])), { mode: 0o600, flag: "wx" });
  fs.writeFileSync(path.join(dir, names[1]), fs.readFileSync(path.join(__dirname, "lib", names[1])), { mode: 0o600, flag: "wx" });
  fs.writeFileSync(path.join(dir, names[2]), JSON.stringify(fixture, null, 2), { mode: 0o600, flag: "wx" });
  fs.writeFileSync(path.join(dir, "SHA256SUMS"), names.map(name =>
    `${hash(fs.readFileSync(path.join(dir, name)))}  ${name}`).join("\n") + "\n", { mode: 0o600, flag: "wx" });
  const archive = path.join(dir, "b7-ai-server.tar.gz");
  const tar = cp.spawnSync("tar", ["-czf", archive, "-C", dir, ...names, "SHA256SUMS"], { stdio: "pipe" });
  if (tar.status !== 0) fail("B7_ARCHIVE_FAILED");
  fs.chmodSync(archive, 0o600);
  console.log("B7_ARCHIVE " + archive);
  console.log("B7_ARCHIVE_SHA256 " + hash(fs.readFileSync(archive)));
  console.log("Prenes iba tento archív na AI server 10.9.2.140. Zatiaľ neprebehla žiadna inferencia.");
}
module.exports = { buildFixture, main };
if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error instanceof P.PilotError ? error.code : "B7_EXPORT_LOCAL_ERROR");
    process.exitCode = 1;
  }
}
