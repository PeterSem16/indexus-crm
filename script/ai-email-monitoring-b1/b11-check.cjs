"use strict";
// B1.1: read-only production configuration + three HTTPS GETs. No inference,
// application imports, CRM writes, run marker, configuration changes or retries.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { assertRuntime } = require("./runtime.cjs");
const { checkDiscovery } = require("./discovery.cjs");
const { snapshot, unchanged } = require("../ai-gateway-b4-pilot.cjs");
const APP = "/var/www/indexus-crm";
const sha = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function validSnapshot(s) {
  return !!s && Number.isSafeInteger(s.version) && s.gatewayEnabled === false &&
    s.total === 65 && s.openai === 65 && s.internal === 0 && s.modelOverrides === 0 && s.enabled === 65 &&
    ["routesSha256", "gatewayParametersSha256", "fullConfigurationSha256"].every(k => sha(s[k]));
}
function originalReference(report) {
  if (report?.phase !== "B1_EMAIL_MONITORING" || report?.kind !== "LIVE_ISOLATED_SYNTHETIC" ||
    report.finalVerified !== true || !validSnapshot(report.before) || !validSnapshot(report.after) ||
    !unchanged(report.before, report.after)) throw Error("B11_ORIGINAL_REFERENCE_INVALID");
  return report.after;
}
function productionComparison(reference, before, after) {
  if (![reference, before, after].every(validSnapshot)) throw Error("B11_SNAPSHOT_INVALID");
  return {
    comparedWithOriginalB1: true,
    beforeMatchesOriginal: unchanged(reference, before),
    unchangedDuringCheck: unchanged(before, after),
    afterMatchesOriginal: unchanged(reference, after),
    gatewayEnabled: after.gatewayEnabled, openai: after.openai,
    internal: after.internal, modelOverrides: after.modelOverrides,
  };
}
async function readProductionSnapshot({ Client, connectionString, catalog }) {
  const db = new Client({ connectionString, application_name: "indexus-b11-read-only",
    connectionTimeoutMillis: 8000, options: "-c default_transaction_read_only=on -c statement_timeout=8000" });
  try {
    await db.connect(); await db.query("BEGIN READ ONLY");
    if ((await db.query("SHOW transaction_read_only")).rows[0]?.transaction_read_only !== "on")
      throw Error("B11_DATABASE_NOT_READ_ONLY");
    const result = await db.query("SELECT version,value FROM ai_router_configuration WHERE singleton=true");
    if (result.rows.length !== 1) throw Error("B11_CONFIGURATION_UNAVAILABLE");
    return snapshot(result.rows[0], catalog);
  } finally { await db.query("ROLLBACK").catch(() => {}); await db.end(); }
}
async function executeCheck({ reference, readSnapshot, discovery }) {
  const report = { kind: "B11_DISCOVERY_AND_PRODUCTION_READ_ONLY", inferenceCalls: 0,
    before: null, after: null, discovery: null, production: null, error: null };
  try {
    report.before = await readSnapshot();
    report.discovery = await discovery();
    if (report.discovery.error) report.error = report.discovery.error;
    else if (report.discovery.existingModels?.originalDocumentModelListed !== true ||
      report.discovery.existingModels?.originalDocumentModelDeclared !== true)
      report.error = "B11_ORIGINAL_MODEL_UNAVAILABLE_OR_UNVERIFIED";
  } catch { report.error = "B11_READ_ONLY_CHECK_FAILED"; }
  finally {
    try {
      report.after = await readSnapshot();
      if (report.before) report.production = productionComparison(reference, report.before, report.after);
      if (!report.production || !report.production.beforeMatchesOriginal ||
        !report.production.unchangedDuringCheck || !report.production.afterMatchesOriginal)
        report.error ||= "B11_PRODUCTION_CHANGED_OR_UNVERIFIED";
    } catch { report.error ||= "B11_FINAL_PRODUCTION_UNVERIFIED"; }
  }
  report.discoveryPassed = !!report.discovery && !report.discovery.error;
  report.productionRoutingUnchanged = !!report.production && report.production.beforeMatchesOriginal &&
    report.production.unchangedDuringCheck && report.production.afterMatchesOriginal;
  // The original B1 stopped before discovery. It cannot prove the old model inventory.
  report.existingModelsHistoricallyUnchanged = null;
  report.fullyVerified = false;
  report.remainingEvidence = ["PRE_REGISTRATION_MODEL_INVENTORY_REQUIRED"];
  return report;
}
function catalogFromSource(text) {
  const ids = [...text.matchAll(/^\s*"([^"]+)":\s*"(?:chat|transcription|speech|responses|chat_probe)",?\s*$/gm)].map(m => m[1]);
  if (ids.length !== 65 || new Set(ids).size !== 65 || !ids.includes("geography.region"))
    throw Error("B11_LIVE_CATALOG_INVALID");
  return ids;
}
async function main() {
  if (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.platform !== "linux" ||
    os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid?.() !== 1001)
    throw Error("B11_CORPCRM01_AS_SEMAN_REQUIRED");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw Error("B11_TLS_VERIFICATION_REQUIRED");
  assertRuntime(process.env);
  if (process.argv.length !== 3) throw Error("B11_ORIGINAL_REPORT_REQUIRED");
  const home = path.join(os.homedir(), ".indexus-email-monitoring-b1");
  const parent = fs.lstatSync(home);
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid() || (parent.mode & 0o077))
    throw Error("B11_PRIVATE_DIRECTORY_REQUIRED");
  const original = fs.realpathSync(process.argv[2]);
  if (!original.startsWith(home + path.sep) || path.basename(original) !== "evidence.json")
    throw Error("B11_ORIGINAL_REPORT_REQUIRED");
  const st = fs.lstatSync(original);
  if (!st.isFile() || st.uid !== process.getuid() || st.size > 2 * 1024 * 1024 || (st.mode & 0o077))
    throw Error("B11_ORIGINAL_REPORT_UNSAFE");
  const reference = originalReference(JSON.parse(fs.readFileSync(original, "utf8")));
  // Existing production dependencies and configuration; no installation or token fallback.
  module.paths.unshift(path.join(APP, "node_modules"));
  const { Client } = require("pg"), { parse } = require("dotenv");
  const env = parse(fs.readFileSync(path.join(APP, ".env")));
  if (process.env.DATABASE_URL && env.DATABASE_URL && process.env.DATABASE_URL !== env.DATABASE_URL)
    throw Error("B11_DATABASE_ENV_CONFLICT");
  const connectionString = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!connectionString) throw Error("B11_DATABASE_CONFIGURATION_REQUIRED");
  const catalog = catalogFromSource(fs.readFileSync(path.join(APP, "server/lib/ai/service-catalog.ts"), "utf8"));
  const report = await executeCheck({ reference,
    readSnapshot: () => readProductionSnapshot({ Client, connectionString, catalog }),
    discovery: () => checkDiscovery({ fetch, token: process.env.INDEXUS_AI_GATEWAY_TOKEN }),
  });
  const text = JSON.stringify(report, null, 2);
  if (text.includes(process.env.INDEXUS_AI_GATEWAY_TOKEN)) throw Error("B11_SECRET_ECHO");
  // Save only this diagnostic evidence, never the original report or one-time marker.
  const directory = fs.mkdtempSync(path.join(home, "discovery-b11-"));
  const file = path.join(directory, "evidence.json");
  fs.writeFileSync(file, text + "\n", { mode: 0o600, flag: "wx" });
  console.log("B11_RESULTS " + file);
  console.log(text);
  process.exitCode = report.error ? 2 : 0;
}
module.exports = { originalReference, productionComparison, readProductionSnapshot, executeCheck, catalogFromSource };
if (require.main === module) main().catch(error => {
  console.error(/^B(?:11|1|4)_[A-Z0-9_]+$/.test(error?.message) ? error.message : "B11_LOCAL_CHECK_FAILED");
  process.exitCode = 1;
});
