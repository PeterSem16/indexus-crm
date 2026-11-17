"use strict";
// Read-only operator report. No AI requests, app imports, writes or PM2 commands.
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto");
const ROOT = "/var/www/indexus-crm", PMHOME = "/home/seman/.pm2";
function summarizeLogs(text) {
  const requests = [], counts = { personalUnavailable: 0, systemFailures: 0 };
  for (const line of text.split(/\r?\n/)) {
    if (line.includes("[EmailMonitor] Personal monitoring result unavailable")) counts.personalUnavailable++;
    if (line.includes("[EmailMonitor] Error in system mailbox monitoring")) counts.systemFailures++;
    const marker = line.indexOf("[AI Router]");
    if (marker < 0) continue;
    try {
      const v = JSON.parse(line.slice(marker + "[AI Router]".length).trim());
      if (v.event !== "ai.request" || v.service !== "email.monitoring" ||
          !["internal", "openai"].includes(v.provider) || !["ok", "error"].includes(v.outcome)) continue;
      requests.push({ provider: v.provider, outcome: v.outcome,
        model: ["indexus-email-monitoring:v1", "gpt-4o-mini"].includes(v.model) ? v.model : "other",
        durationMs: Number.isFinite(v.durationMs) && v.durationMs >= 0 ? v.durationMs : null,
        httpStatus: Number.isInteger(v.httpStatus) && v.httpStatus >= 100 && v.httpStatus <= 599 ? v.httpStatus : null });
    } catch { /* Never print unparsed log lines or model content. */ }
  }
  return { requests: requests.slice(-20), counts };
}
function tail(file) {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size, start = Math.max(0, size - 256 * 1024);
    const buf = Buffer.alloc(size - start); fs.readSync(fd, buf, 0, buf.length, start);
    const text = buf.toString("utf8");
    return { modifiedAt: fs.fstatSync(fd).mtime.toISOString(),
      ...summarizeLogs(start ? text.slice(text.indexOf("\n") + 1) : text) };
  } finally { fs.closeSync(fd); }
}
function ensure(ok) { if (!ok) throw Error("MONITOR_DIAGNOSTIC_CONFIGURATION_REVIEW_REQUIRED"); }
async function main(args = process.argv.slice(2)) {
  ensure(args.length === 1 && args[0] === "--read-only" && process.getuid?.() === 0 &&
    os.hostname().split(".")[0].toUpperCase() === "CORPCRM01");
  const daemon = Number(fs.readFileSync(PMHOME + "/pm2.pid", "utf8").trim());
  ensure(Number.isSafeInteger(daemon) && daemon > 1 &&
    fs.readFileSync("/proc/" + daemon + "/comm", "utf8").startsWith("PM2"));
  const uid = fs.statSync(PMHOME).uid, workers = [];
  ensure(uid > 0 && fs.statSync("/proc/" + daemon).uid === uid);
  for (const id of fs.readdirSync("/proc").filter(v => /^\d+$/.test(v))) {
    try {
      if (fs.statSync("/proc/" + id).uid === uid &&
          fs.readlinkSync("/proc/" + id + "/cwd") === ROOT &&
          Number(fs.readFileSync("/proc/" + id + "/status", "utf8").match(/^PPid:\s+(\d+)/m)?.[1]) === daemon)
        workers.push(id);
    } catch {}
  }
  ensure(workers.length === 1);
  const initial = Object.fromEntries(fs.readFileSync("/proc/" + workers[0] + "/environ", "utf8")
    .split("\0").filter(v => v.includes("=")).map(v => [v.slice(0, v.indexOf("=")), v.slice(v.indexOf("=") + 1)]));
  const fileEnv = require(ROOT + "/node_modules/dotenv").parse(fs.readFileSync(ROOT + "/.env"));
  ensure(!initial.DATABASE_URL || !fileEnv.DATABASE_URL || initial.DATABASE_URL === fileEnv.DATABASE_URL);
  const connectionString = initial.DATABASE_URL || fileEnv.DATABASE_URL; ensure(!!connectionString);
  const client = new (require(ROOT + "/node_modules/pg").Client)({ connectionString,
    connectionTimeoutMillis: 8000, options: "-c default_transaction_read_only=on -c statement_timeout=8000" });
  const report = { at: new Date().toISOString(), readOnly: true, aiRequests: 0, configurationChanged: false,
    backendSha256: crypto.createHash("sha256").update(fs.readFileSync(ROOT + "/dist/index.cjs")).digest("hex") };
  try {
    await client.connect();
    const { rows } = await client.query("SELECT version,value FROM ai_router_configuration WHERE singleton=true");
    ensure(rows.length === 1);
    const { value, version } = rows[0], route = value.routes?.["email.monitoring"];
    report.routing = { version, gatewayEnabled: value.gateway?.enabled === true,
      canonicalHTTPS: value.gateway?.baseURL === "https://ai.cordbloodcenter.com/gateway/",
      emailProvider: route?.provider === "internal" ? "internal" : route?.provider === "openai" || !route ? "openai" : "unknown",
      emailModel: route?.model === "indexus-email-monitoring:v1" ? route.model : route?.model == null ? null : "other",
      emailEnabled: route?.enabled !== false,
      otherInternalOverrides: Object.entries(value.routes || {}).filter(([id, r]) =>
        id !== "email.monitoring" && r.provider === "internal" && r.enabled).length };
  } finally { await client.end(); }
  const dump = JSON.parse(fs.readFileSync(PMHOME + "/dump.pm2", "utf8"));
  const matching = dump.filter(v => (v.pm_cwd || v.pm2_env?.pm_cwd) === ROOT);
  ensure(matching.length === 1);
  report.logs = {};
  for (const [label, key] of [["output", "pm_out_log_path"], ["errors", "pm_err_log_path"]]) {
    const file = matching[0][key] || matching[0].pm2_env?.[key];
    ensure(typeof file === "string" && path.resolve(file).startsWith(PMHOME + "/logs/"));
    try { report.logs[label] = tail(file); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      report.logs[label] = { available: false };
    }
  }
  console.log(JSON.stringify(report, null, 2));
}
module.exports = { summarizeLogs, main };
if (require.main === module) main().catch(error => {
  const code = /^[A-Z0-9_]{2,75}$/.test(error.code || "") ? error.code : "MONITOR_DIAGNOSTIC_STOPPED";
  console.error(JSON.stringify({ status: "READ_ONLY_CHECK_FAILED", code, configurationChanged: false, aiRequests: 0 }));
  process.exitCode = 1;
});
