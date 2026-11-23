"use strict";
// Read-only incident snapshot. No locks, service changes, build, inference, or DB writes.
const fs = require("node:fs"), cp = require("node:child_process"), path = require("node:path");
const os = require("node:os"), crypto = require("node:crypto"), { createRequire } = require("node:module");
const APP = "/var/www/indexus-crm";
const STAGE = APP + "/data/ai-summary-hotfix-private/release-VZn3Er";
const BACKUP = STAGE + "/backup-CS7gCu";
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const safeCode = e => /^[a-zA-Z0-9_]{2,64}$/.test(e?.code || "") ? e.code : "check_unavailable";
const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C.UTF-8" };
function shape(p) {
  const e = p.pm2_env, bool = v => v === "true" ? true : v === "false" ? false : v;
  return { id: p.pm_id, name: p.name, script: e.pm_exec_path, cwd: e.pm_cwd,
    interpreter: e.exec_interpreter, args: e.args || [], nodeArgs: e.node_args || [],
    nodeOptions: e.NODE_OPTIONS || e.env?.NODE_OPTIONS || "", mode: e.exec_mode,
    instances: e.instances, watch: bool(e.watch), autorestart: bool(e.autorestart),
    killTimeout: Number(e.kill_timeout ?? 1600),
    protectedEnvironment: Object.fromEntries(Object.entries(e.env || {}).filter(([k]) =>
      /^(?:DATABASE_URL$|PG[A-Z_]*$|SESSION_SECRET$|NODE_ENV$|PORT$|AI_|INDEXUS_|INTERNAL_AI_|OPENAI_)/.test(k))) };
}
const canonical = value => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
function compare(p, expected, dumped) {
  const current = shape(p);
  const result = { matchesBeforeRestart: sha(JSON.stringify(current)) === expected };
  if (dumped) {
    const before = shape({ pm_id: p.pm_id, name: dumped.name, pm2_env: dumped });
    result.savedDumpMatchesBeforeRestart = sha(JSON.stringify(before)) === expected;
    result.sameValuesAsSavedDump = JSON.stringify(canonical(before)) === JSON.stringify(canonical(current));
    result.differentFieldsFromSavedDump = Object.keys(current).filter(k =>
      JSON.stringify(canonical(current[k])) !== JSON.stringify(canonical(before[k])));
    result.keyOrderOnlyMismatchProven = !result.matchesBeforeRestart &&
      result.savedDumpMatchesBeforeRestart && result.sameValuesAsSavedDump;
  }
  return result;
}
function read(file, limit = 32 * 1024 ** 2) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const s = fs.fstatSync(fd);
    if (!s.isFile() || s.size > limit) throw Error("regular_file_required");
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}
function markers(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const s = fs.fstatSync(fd);
    if (!s.isFile()) throw Error("regular_log_required");
    const size = Math.min(s.size, 128 * 1024), bytes = Buffer.alloc(size);
    const count = fs.readSync(fd, bytes, 0, size, s.size - size);
    const text = bytes.subarray(0, count).toString("utf8");
    const known = ["Worker ready; pilot concurrency=1", "Worker startup failed",
      "Worker database unavailable", "Worker heartbeat unavailable",
      "Shutdown deadline reached; lease recovery required"];
    const ordered = [];
    for (const line of text.split("\n")) for (const marker of known)
      if (line.includes("[AI jobs] " + marker)) ordered.push(marker);
    return { scannedBytes: count, totalBytes: s.size, lastKnownMarkers: ordered.slice(-12),
      missingModuleSignals: (text.match(/\bMODULE_NOT_FOUND\b/g) || []).length,
      syntaxErrorSignals: (text.match(/\bSyntaxError\b/g) || []).length };
  } finally { fs.closeSync(fd); }
}
async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || args[0] !== "--inspect" || process.getuid() !== 0 ||
      os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01") throw Error("root_inspect_only");
  const report = { mode: "read_only_inspection", observedAt: new Date().toISOString(),
    servicesChanged: false, aiCalls: 0 };
  const run = (bin, args, options = {}) => cp.execFileSync(bin, args, { env, encoding: "utf8",
    timeout: 15000, maxBuffer: 8 * 1024 ** 2, stdio: ["ignore", "pipe", "pipe"], ...options });
  const stage = JSON.parse(read(STAGE + "/manifest.json")), recovery = JSON.parse(read(BACKUP + "/recovery.json"));
  report.files = {};
  for (const [file, desired] of Object.entries({
    "server/lib/ai-jobs/summary.ts": stage.outputs["summary.ts"],
    "server/lib/ai-jobs/summary-html.ts": stage.outputs["summary-html.ts"],
    "dist/ai-worker.cjs": stage.outputs["ai-worker.cjs"],
    "dist/index.cjs": stage.baseline["dist/index.cjs"],
    "dist/public/index.html": stage.baseline["dist/public/index.html"],
  })) {
    try {
      const hash = sha(read(APP + "/" + file));
      report.files[file] = { matchesPrepared: hash === desired, matchesOriginal: hash === stage.baseline[file] };
    } catch (e) { report.files[file] = { code: safeCode(e) }; }
  }
  report.otherBuildInputsChanged = [];
  for (const [file, expected] of Object.entries(stage.inputs)) {
    if (!file.startsWith(APP + "/") || path.normalize(file) !== file) throw Error("stage_scope_invalid");
    if (file === APP + "/server/lib/ai-jobs/summary.ts") continue;
    try { if (sha(read(file)) !== expected) report.otherBuildInputsChanged.push(file.slice(APP.length + 1)); }
    catch { report.otherBuildInputsChanged.push(file.slice(APP.length + 1)); }
  }
  const name = run("id", ["-nu", String(stage.processes.worker.uid)]).trim();
  const user = run("getent", ["passwd", name]).trim().split(":");
  const home = user[5], uid = Number(user[2]);
  if (!/^[a-z_][a-z0-9_-]*$/.test(name) || !path.isAbsolute(home || "") || uid !== stage.processes.worker.uid)
    throw Error("account_unverified");
  const daemon = read(home + "/.pm2/pm2.pid").toString().trim();
  if (!/^\d+$/.test(daemon) || !new RegExp(`^Uid:\\s+${uid}\\s`, "m").test(
    fs.readFileSync(`/proc/${daemon}/status`, "utf8"))) throw Error("daemon_unverified");
  const socket = fs.lstatSync(home + "/.pm2/rpc.sock");
  if (!socket.isSocket() || socket.uid !== uid) throw Error("daemon_socket_unverified");
  const pm2 = run("runuser", ["-u", name, "--", "sh", "-c", "command -v pm2"]).trim();
  if (!path.isAbsolute(pm2) || pm2.includes("\n")) throw Error("pm2_unavailable");
  const all = JSON.parse(run("runuser", ["-u", name, "--", pm2, "jlist"], {
    env: { ...env, HOME: home, PM2_HOME: home + "/.pm2" },
  }));
  let saved = [];
  try { saved = JSON.parse(read(home + "/.pm2/dump.pm2")); } catch { /* Optional comparison only. */ }
  report.processes = {};
  let web;
  for (const [role, script] of [["web", "index.cjs"], ["worker", "ai-worker.cjs"]]) {
    const list = all.filter(p => p.pm2_env?.pm_exec_path === APP + "/dist/" + script);
    if (list.length !== 1) throw Error("managed_identity_ambiguous");
    const p = list[0], e = p.pm2_env;
    report.processes[role] = { pid: p.pid, status: e.status, restartCount: e.restart_time,
      uptimeSeconds: Number.isFinite(Number(e.pm_uptime)) ? Math.floor((Date.now() - Number(e.pm_uptime)) / 1000) : null,
      originalPidUnchanged: p.pid === stage.processes[role].pid,
      specification: compare(p, recovery.pm2Specs[role], saved.find(x => x.name === p.name)) };
    if (p.pid > 0) {
      try {
        const status = fs.readFileSync(`/proc/${p.pid}/status`, "utf8");
        report.processes[role].expectedOwner = new RegExp(`^Uid:\\s+${uid}\\s`, "m").test(status);
        report.processes[role].sameDaemon = Number(/^PPid:\s+(\d+)/m.exec(status)?.[1]) === Number(daemon);
        report.processes[role].expectedCwd = fs.realpathSync(`/proc/${p.pid}/cwd`) === APP;
        report.processes[role].expectedExecutable = fs.realpathSync(`/proc/${p.pid}/exe`) === stage.processes[role].executable;
      } catch (e) { report.processes[role].identityCode = safeCode(e); }
    }
    if (role === "web") web = p;
    if (role === "worker") {
      report.workerLogs = {};
      for (const [kind, file] of [["out", e.pm_out_log_path], ["error", e.pm_err_log_path]]) {
        try {
          if (typeof file !== "string" || ![home + "/.pm2/logs/", APP + "/logs/"].some(x => file.startsWith(x)) ||
              path.normalize(file) !== file) throw Error("log_path_unverified");
          report.workerLogs[kind] = markers(file);
        } catch (e) { report.workerLogs[kind] = { code: safeCode(e) }; }
      }
    }
  }
  let db;
  try {
    const w = report.processes.web;
    if (!w.expectedOwner || !w.sameDaemon || !w.expectedCwd || !w.expectedExecutable)
      throw Error("web_identity_unverified");
    const req = createRequire(APP + "/package.json");
    const entries = fs.readFileSync(`/proc/${web.pid}/environ`, "utf8").split("\0");
    let connection = entries.find(x => x.startsWith("DATABASE_URL="))?.slice(13);
    if (!connection) {
      const line = read(APP + "/.env").toString().split(/\r?\n/).find(x => x.startsWith("DATABASE_URL="));
      connection = req("dotenv").parse(line || "").DATABASE_URL;
    }
    if (!connection) throw Error("database_configuration_missing");
    const { Client } = req("pg");
    db = new Client({ connectionString: connection, connectionTimeoutMillis: 10000,
      statement_timeout: 10000, options: "-c default_transaction_read_only=on" });
    db.on("error", () => {});
    await db.connect(); await db.query("BEGIN READ ONLY");
    const settings = (await db.query("SELECT version,value FROM ai_router_configuration WHERE singleton=true")).rows;
    const maintenance = (await db.query(`SELECT mode,version,operation_id,owner_id FROM ai_queue_maintenance
      WHERE scope='internal-gateway'`)).rows;
    report.configuration = { routerUnchanged: sha(JSON.stringify(settings)) === recovery.configurationSha256,
      maintenanceUnchanged: sha(JSON.stringify(maintenance)) === recovery.maintenanceSha256,
      maintenanceMode: maintenance[0]?.mode, maintenanceVersion: maintenance[0]?.version };
    report.queues = (await db.query(`SELECT
      (SELECT count(*)::int FROM ai_jobs WHERE status='pending') AS jobs_pending,
      (SELECT count(*)::int FROM ai_jobs WHERE status='processing') AS jobs_processing,
      (SELECT count(*)::int FROM ai_inference_jobs WHERE status='pending') AS inference_pending,
      (SELECT count(*)::int FROM ai_inference_jobs WHERE status='processing') AS inference_processing`)).rows[0];
    report.heartbeat = (await db.query(`SELECT count(*)::int AS alive,
      count(*) FILTER (WHERE maintenance_protocol=1 AND maintenance_version=$1)::int AS compatible,
      max(heartbeat_at) AS latest FROM ai_inference_workers
      WHERE heartbeat_at > clock_timestamp()-interval '30 seconds'`,
    [maintenance[0]?.version ?? -1])).rows[0];
    await db.query("ROLLBACK");
  } catch (e) { report.database = { code: safeCode(e) }; }
  finally { if (db) await db.end().catch(() => {}); }
  console.log(JSON.stringify(report, null, 2));
  return report;
}
module.exports = { main, shape, compare, canonical, markers };
if (require.main === module) main().catch(e => {
  console.error(JSON.stringify({ mode: "inspection_unavailable", code: safeCode(e),
    servicesChanged: false, aiCalls: 0 })); process.exitCode = 1;
});
