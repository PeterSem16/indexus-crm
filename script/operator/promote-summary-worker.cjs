"use strict";
// One approved worker-only hotfix. Never installs, migrates, builds, changes
// providers, cancels work, restarts the API, or sends an inference request.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const cp = require("node:child_process"), crypto = require("node:crypto");
const http = require("node:http"), { createRequire } = require("node:module");
const APP = "/var/www/indexus-crm", DATA = APP + "/data";
const STAGE = DATA + "/ai-summary-hotfix-private/release-VZn3Er";
const ORIGINAL = "9c223ba7aeb11149b692e82114c4668448a0ed235fe222efc46d2c8b625bd6be";
const FILES = {
  "server/lib/ai-jobs/summary.ts": "02ede79c16d9210fb522272a78f6ee0499db226847b42eef56d7458e49027776",
  "server/lib/ai-jobs/summary-html.ts": "cfffee7a025ae4b3770f8933135229370eec4f48b3c4717a1353d708b2412576",
  "dist/ai-worker.cjs": "1f5d03c8b7f761399f284d5a8e3733f8122a0a073ff8fb2c382d9c05f19efad1",
};
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const fail = code => { throw Object.assign(Error(code), { safeCode: code }); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C.UTF-8" };
function read(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const s = fs.fstatSync(fd);
    if (!s.isFile() || s.size > 32 * 1024 ** 2) fail("regular_file_required");
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}
function validateManifest(m, release) {
  if (release ? m.format !== 1 || m.mode !== "prepared_not_deployed" || m.directory !== release.stageDirectory ||
      JSON.stringify(m.processes) !== JSON.stringify(release.processes) || Object.keys(m.inputs || {}).length < 10 :
      m.format !== 1 || m.mode !== "prepared_not_deployed" || m.directory !== STAGE ||
      m.processes?.web?.pid !== 1040761 || m.processes?.worker?.pid !== 1040871 ||
      m.baseline?.["server/lib/ai-jobs/summary.ts"] !== ORIGINAL ||
      Object.keys(m.inputs || {}).length !== 474 ||
      m.inputs[APP + "/server/lib/ai-jobs/summary.ts"] !== ORIGINAL)
    fail("reviewed_stage_required");
  for (const [file, value] of Object.entries(release?.files || FILES))
    if (m.outputs?.[path.basename(file)] !== value) fail("reviewed_stage_required");
  for (const [file, value] of Object.entries({ ...m.inputs, ...m.baseline })) {
    const abs = file.startsWith("/") ? file : APP + "/" + file;
    if (!abs.startsWith(APP + "/") || path.normalize(abs) !== abs || !/^[a-f0-9]{64}$/.test(value))
      fail("stage_input_scope_invalid");
  }
}
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
function specification(p) {
  const e = p.pm2_env, bool = v => v === "true" ? true : v === "false" ? false : v;
  return sha(JSON.stringify(canonical({ id: p.pm_id, name: p.name, script: e.pm_exec_path, cwd: e.pm_cwd,
    interpreter: e.exec_interpreter, args: e.args || [], nodeArgs: e.node_args || [],
    nodeOptions: e.NODE_OPTIONS || e.env?.NODE_OPTIONS || "", mode: e.exec_mode,
    // A single verified fork process is authoritative; PM2 materializes this
    // inert default differently after restart and save.
    instances: e.exec_mode === "fork_mode" ? 1 : e.instances, watch: bool(e.watch), autorestart: bool(e.autorestart),
    killTimeout: Number(e.kill_timeout ?? 1600),
    protectedEnvironment: Object.fromEntries(Object.entries(e.env || {}).filter(([k]) =>
      /^(?:DATABASE_URL$|PG[A-Z_]*$|SESSION_SECRET$|NODE_ENV$|PORT$|AI_|INDEXUS_|INTERNAL_AI_|OPENAI_)/.test(k))) })));
}
async function originalBuildDriver() {
  const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
  const { createRequire } = require("node:module");
  const { app } = JSON.parse(fs.readFileSync(0, "utf8")), req = createRequire(app + "/package.json");
  const pkg = JSON.parse(fs.readFileSync(app + "/package.json", "utf8"));
  const config = fs.readFileSync(app + "/script/build.ts", "utf8");
  const match = /const allowlist = \[([\s\S]*?)\];/.exec(config);
  if (!match) throw Error("build_configuration_unrecognized");
  const allow = (match[1].match(/"[^"]+"/g) || []).map(x => JSON.parse(x));
  const external = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]
    .filter(x => !allow.includes(x));
  const result = await req("esbuild").build({ absWorkingDir: app, entryPoints: ["server/ai-worker.ts"],
    platform: "node", bundle: true, format: "cjs", outfile: "dist/ai-worker.cjs",
    define: { "process.env.NODE_ENV": '"production"' }, minify: true, external,
    logLevel: "silent", write: false, metafile: true });
  if (result.outputFiles.length !== 1) throw Error("unexpected_build_output");
  process.stdout.write(JSON.stringify({
    sha256: crypto.createHash("sha256").update(result.outputFiles[0].contents).digest("hex"),
    inputs: Object.keys(result.metafile.inputs).map(f => path.resolve(app, f)),
  }));
}
async function orchestrate(o) {
  let stopAttempted = false, releaseAttempted = false;
  try {
    await o.preflight(); await o.acquire(); await o.drain(); await o.backup();
    stopAttempted = true; await o.stop(); await o.publish(); await o.restart();
    await o.ready(); await o.verify(); await o.persist?.(); await o.receipt();
    // An unlock with a lost reply may already have admitted work. Never recover
    // by stopping a worker after even an uncertain release.
    releaseAttempted = true; await o.release(); return await o.success();
  } catch (error) {
    error.releaseAttempted = releaseAttempted;
    if (stopAttempted && !releaseAttempted) {
      try { await o.rollback(); error.rollbackVerified = true; }
      catch (recovery) {
        error.manualRecoveryRequired = true;
        error.recoveryCode = recovery.safeCode || "recovery_check_failed";
      }
    }
    throw error;
  } finally { await o.close(); }
}
function operations(release) {
  const stageDirectory = release?.stageDirectory || STAGE, files = release?.files || FILES;
  let m, account, pm2, daemon, specs, db, gate = false, gateLost = false, backupDir, journal;
  let configHash, maintenanceHash, maintenance, head, since, newPid, interrupted = false, phase = "preflight";
  let targetWorkerSpec, originalKillTimeout, lastReadiness;
  let restoring = false;
  const metadata = {};
  const signal = () => { interrupted = true; };
  const run = (bin, args, opts = {}) => {
    try { return cp.execFileSync(bin, args, { env, encoding: "utf8", timeout: 20000,
      maxBuffer: 16 * 1024 ** 2, stdio: ["pipe", "pipe", "pipe"], ...opts }); }
    catch { fail("native_" + path.basename(bin).replace(/[^a-z0-9]/gi, "_") + "_failed"); }
  };
  const gitHead = () => run("git", ["--no-optional-locks", "-c", "safe.directory=" + APP,
    "-c", "core.fsmonitor=false", "-C", APP, "rev-parse", "HEAD"]).trim();
  const asUser = args => run("runuser", ["-u", account.name, "--", pm2, ...args], {
    env: { ...env, HOME: account.home, PM2_HOME: account.home + "/.pm2" },
    timeout: Math.max(180000, (release?.killTimeoutMs || 0) + 10000) });
  function log(name) {
    phase = name; console.log("PHASE=" + name);
    if (journal) fs.appendFileSync(journal, JSON.stringify({ phase, at: new Date().toISOString() }) + "\n");
  }
  function privateDirectory(dir) {
    const s = fs.lstatSync(dir);
    if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== 0 ||
        (s.mode & 0o777) !== 0o700 || fs.realpathSync(dir) !== dir) fail("private_directory_changed");
    for (const uid of new Set([m.processes.web.uid, 33])) for (const access of ["-r", "-x"]) {
      const p = cp.spawnSync("setpriv", [`--reuid=${uid}`, `--regid=${uid}`, "--clear-groups",
        "/usr/bin/test", access, dir], { env, timeout: 10000, stdio: "ignore" });
      if (p.status !== 1) fail("private_directory_access_not_verified");
    }
  }
  function processIdentity(pid) {
    if (!Number.isSafeInteger(pid) || pid < 2) fail("process_identity_invalid");
    const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    if (!new RegExp(`^Uid:\\s+${account.uid}\\s+${account.uid}\\s+${account.uid}\\s+${account.uid}\\s*$`, "m").test(status))
      fail("process_owner_changed");
    return { pid, start: stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19],
      parent: Number(/^PPid:\s+(\d+)/m.exec(status)?.[1]) };
  }
  function managed(mode = "original") {
    if (fs.readFileSync(account.home + "/.pm2/pm2.pid", "utf8").trim() !== String(daemon.pid) ||
        processIdentity(daemon.pid).start !== daemon.start) fail("pm2_daemon_changed");
    const socket = fs.lstatSync(account.home + "/.pm2/rpc.sock");
    if (!socket.isSocket() || socket.uid !== account.uid) fail("pm2_socket_changed");
    const all = JSON.parse(asUser(["jlist"]));
    if (release?.persistPm2 && all.length !== 2) fail("other_pm2_services_require_separate_review");
    const list = all.filter(p =>
      ["indexus-crm", "indexus-ai-worker"].includes(p.name) ||
      [APP + "/dist/index.cjs", APP + "/dist/ai-worker.cjs"].includes(p.pm2_env?.pm_exec_path));
    if (list.length !== 2) fail("managed_services_ambiguous");
    const result = {};
    for (const role of ["web", "worker"]) {
      const file = role === "web" ? "index.cjs" : "ai-worker.cjs";
      const p = list.find(p => p.pm2_env?.pm_exec_path === APP + "/dist/" + file), e = p?.pm2_env;
      if (!p || e.pm_cwd !== APP || !Number.isInteger(p.pm_id) || e.exec_mode !== "fork_mode" ||
          ![false, "false", undefined].includes(e.watch) ||
          specs && specification(p) !== specs[role] &&
          !(role === "worker" && ["new", "any", "stopped"].includes(mode) &&
            targetWorkerSpec && specification(p) === targetWorkerSpec)) fail("managed_configuration_changed");
      if (role === "worker" && mode === "new" && release?.killTimeoutMs &&
          Number(e.kill_timeout) !== release.killTimeoutMs) fail("worker_shutdown_budget_not_installed");
      if (e.status === "online" && p.pid > 0) {
        const identity = processIdentity(p.pid);
        if (identity.parent !== daemon.pid || fs.realpathSync(`/proc/${p.pid}/cwd`) !== APP ||
            fs.realpathSync(`/proc/${p.pid}/exe`) !== m.processes[role].executable)
          fail("managed_process_changed");
        if ((role === "web" || mode === "original") &&
            (p.pid !== m.processes[role].pid || identity.start !== m.processes[role].start))
          fail("original_process_changed");
        if (role === "worker" && mode === "stopped") fail("worker_not_stopped");
        if (role === "worker" && ["new", "restored"].includes(mode) && p.pid === m.processes.worker.pid)
          fail("worker_not_replaced");
      } else if (!(role === "worker" && ["stopped", "any"].includes(mode) &&
          p.pid === 0 && e.status === "stopped" && [0, "0"].includes(e.exit_code)))
        fail("managed_service_not_ready");
      result[role] = p;
    }
    return result;
  }
  async function guard() {
    if (interrupted && !restoring) fail("operator_interrupted");
    if (!gate || gateLost) fail("claim_gate_lost_manual_recovery_required");
    const r = await db.query(`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory'
      AND classid=517 AND objid=1 AND objsubid=2 AND pid=pg_backend_pid() AND granted) AS held`);
    if (r.rows[0]?.held !== true) fail("claim_gate_lost_manual_recovery_required");
  }
  async function counts() {
    return (await db.query(`SELECT
      (SELECT count(*)::int FROM ai_jobs WHERE status='processing') AS jobs,
      (SELECT count(*)::int FROM ai_inference_jobs WHERE status='processing') AS inference`)).rows[0];
  }
  async function drain() {
    log("finish_existing_ai_work"); const until = Date.now() + (release?.drainMs || 180000);
    do {
      await guard(); const c = await counts();
      if (c?.jobs === 0 && c.inference === 0) return;
      await sleep(500);
    } while (Date.now() < until);
    fail("inflight_work_did_not_finish_no_forced_cancellation");
  }
  async function configuration(capture = false) {
    const r = (await db.query("SELECT version,value FROM ai_router_configuration WHERE singleton=true")).rows;
    const rows = (await db.query(`SELECT mode,version,operation_id,owner_id FROM ai_queue_maintenance
      WHERE scope='internal-gateway'`)).rows;
    if (r.length !== 1 || rows.length !== 1 || !["running", "paused"].includes(rows[0].mode))
      fail("ai_configuration_unverified");
    const a = sha(JSON.stringify(r)), b = sha(JSON.stringify(rows));
    if (capture) { configHash = a; maintenanceHash = b; maintenance = rows[0]; }
    else if (configHash !== a || maintenanceHash !== b) fail("ai_configuration_changed");
  }
  function verifyFiles(patched) {
    if (gitHead() !== head) fail("production_git_head_changed");
    for (const [file, expected] of Object.entries(m.baseline)) {
      const current = sha(read(APP + "/" + file));
      const allowed = patched === "recovery" ? [expected, files[file]] : [patched && files[file] || expected];
      if (!allowed.includes(current)) fail("live_file_changed");
    }
    for (const [file, expected] of Object.entries(m.inputs)) {
      if (patched && files[file.slice(APP.length + 1)]) continue;
      if (sha(read(file)) !== expected) fail("build_input_changed");
    }
    if (release) return;
    const helper = APP + "/server/lib/ai-jobs/summary-html.ts";
    const exists = fs.existsSync(helper);
    if (patched === "recovery" ? exists && sha(read(helper)) !== FILES["server/lib/ai-jobs/summary-html.ts"] :
        patched ? sha(read(helper)) !== FILES["server/lib/ai-jobs/summary-html.ts"] : exists)
      fail("helper_source_changed");
  }
  async function healthy() {
    const response = await new Promise((resolve, reject) => {
      const req = http.get({ hostname: "127.0.0.1", port: 5000, path: "/", timeout: 5000 }, res => {
        let size = 0; const parts = [];
        res.on("error", reject);
        res.on("data", b => { size += b.length; if (size > 131072) res.destroy(Error("size")); else parts.push(b); });
        res.on("end", () => resolve({ status: res.statusCode, hash: sha(Buffer.concat(parts)) }));
      });
      req.on("error", reject); req.on("timeout", () => req.destroy(Error("timeout")));
    });
    if (response.status !== 200 || response.hash !== m.baseline["dist/public/index.html"])
      fail("unchanged_web_health_unverified");
  }
  function copyAtomic(bytes, relative, meta) {
    const to = APP + "/" + relative, parent = path.dirname(to);
    if (fs.realpathSync(parent) !== parent) fail("destination_directory_changed");
    const temp = parent + "/summary-hotfix-" + crypto.randomUUID() + ".tmp";
    try {
      const fd = fs.openSync(temp, "wx", 0o600);
      try {
        fs.writeFileSync(fd, bytes); fs.fchownSync(fd, meta.uid, meta.gid);
        fs.fchmodSync(fd, meta.mode & 0o777); fs.fsyncSync(fd);
        if (fs.fstatSync(fd).ino !== fs.lstatSync(temp).ino) fail("temporary_file_changed");
      } finally { fs.closeSync(fd); }
      fs.renameSync(temp, to);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  }
  async function stopWorker() {
    await guard(); await drain(); await configuration();
    const p = managed("any");
    if (p.worker.pid > 0) asUser(["stop", String(p.worker.pm_id)]);
    managed("stopped"); await guard();
    const r = (await db.query(`SELECT count(*)::int AS total FROM ai_inference_workers
      WHERE heartbeat_at > clock_timestamp()-interval '30 seconds'`)).rows[0];
    if (r?.total !== 0) fail("another_ai_worker_detected");
  }
  async function ready(mode = "new") {
    const until = Date.now() + 45000; let stable = 0, last;
    do {
      await guard();
      try {
        const p = managed(mode);
        const r = (await db.query(`SELECT count(*)::int AS total,
          count(*) FILTER (WHERE maintenance_protocol=1 AND maintenance_version=$1
            AND heartbeat_at >= $2::timestamptz)::int AS compatible
          FROM ai_inference_workers WHERE heartbeat_at > clock_timestamp()-interval '30 seconds'`,
        [maintenance.version, since])).rows[0];
        lastReadiness = { workers: r?.total ?? null, compatible: r?.compatible ?? null };
        if (r?.total === 1 && r.compatible === 1) {
          stable = p.worker.pid === last ? stable + 1 : 1; last = p.worker.pid;
          if (stable >= 3) { newPid = p.worker.pid; return; }
        } else stable = 0;
      } catch (e) {
        stable = 0;
        lastReadiness = { code: e.safeCode || (/^[0-9A-Z]{5}$/.test(e.code || "") ? e.code : "readiness_observation_failed") };
      }
      await sleep(500);
    } while (Date.now() < until);
    fail("fresh_worker_readiness_unverified");
  }
  async function unlockGate() {
    await guard();
    if ((await db.query("SELECT pg_advisory_unlock(517,1) AS released")).rows[0]?.released !== true)
      fail("claim_gate_release_unverified");
    gate = false;
  }
  function persistPm2() {
    if (!release?.persistPm2) return;
    for (const name of ["dump.pm2", "dump.pm2.bak"]) {
      const file = account.home + "/.pm2/" + name, s = fs.lstatSync(file);
      if (!s.isFile() || s.isSymbolicLink() || s.uid !== account.uid || (s.mode & 0o777) !== 0o600)
        fail("private_pm2_dump_required");
    }
    asUser(["save"]);
    for (const name of ["dump.pm2", "dump.pm2.bak"]) {
      const file = account.home + "/.pm2/" + name;
      fs.chmodSync(file, 0o600);
      const rows = JSON.parse(read(file));
      if (name === "dump.pm2") {
        const worker = rows.filter(p => p.pm_exec_path === APP + "/dist/ai-worker.cjs");
        const expected = restoring ? originalKillTimeout : release.killTimeoutMs;
        if (worker.length !== 1 || Number(worker[0].kill_timeout) !== expected)
          fail("persisted_worker_shutdown_budget_unverified");
      }
    }
  }
  return {
    preflight: async () => {
      log("verify_reviewed_prepared_worker");
      process.on("SIGINT", signal); process.on("SIGTERM", signal);
      const disk = JSON.parse(run("findmnt", ["--json", "--target", DATA, "--output", "SOURCE,TARGET"])).filesystems;
      if (disk.length !== 1 || disk[0].source !== "/dev/sdb1" || disk[0].target !== DATA)
        fail("approved_data_disk_required");
      m = JSON.parse(read(stageDirectory + "/manifest.json")); validateManifest(m, release);
      privateDirectory(path.dirname(stageDirectory)); privateDirectory(stageDirectory);
      for (const [file, expected] of Object.entries(files)) {
        const staged = stageDirectory + "/" + path.basename(file), s = fs.lstatSync(staged);
        if (s.uid !== 0 || (s.mode & 0o777) !== 0o600 || sha(read(staged)) !== expected)
          fail("prepared_output_changed");
      }
      const worker = read(APP + "/dist/ai-worker.cjs").toString();
      if ((worker.match(/pg_try_advisory_xact_lock\(517,1\)/g) || []).length < 2)
        fail("both_live_claim_paths_must_support_gate");
      head = gitHead(); verifyFiles(false);
      run(process.execPath, ["--input-type=commonjs", "--check"], { input: read(stageDirectory + "/ai-worker.cjs") });
      for (const root of [DATA, APP + "/dist"]) {
        const s = fs.statfsSync(root);
        if (Number(s.bavail) * Number(s.bsize) < 128 * 1024 ** 2) fail("backup_and_promotion_space_required");
      }
      const name = run("id", ["-nu", String(m.processes.worker.uid)]).trim();
      const user = run("getent", ["passwd", name]).trim().split(":");
      account = { name, uid: +user[2], gid: +user[3], home: user[5] };
      if (account.uid !== m.processes.worker.uid || !path.isAbsolute(account.home || "") ||
          !/^[a-z_][a-z0-9_-]*$/.test(name) || m.processes.worker.executable !== fs.realpathSync(process.execPath))
        fail("worker_account_changed");
      daemon = processIdentity(processIdentity(m.processes.worker.pid).parent);
      const daemonFile = account.home + "/.pm2/pm2.pid";
      if (fs.readFileSync(daemonFile, "utf8").trim() !== String(daemon.pid)) fail("pm2_daemon_unverified");
      pm2 = run("runuser", ["-u", name, "--", "sh", "-c", "command -v pm2"],
        { env: { ...env, HOME: account.home } }).trim();
      if (!path.isAbsolute(pm2) || pm2.includes("\n")) fail("pm2_command_unavailable");
      if (release?.killTimeoutMs && !asUser(["--help"]).includes("--kill-timeout"))
        fail("pm2_shutdown_option_not_supported_no_service_changes");
      const p = managed();
      if (Number(p.worker.pm2_env.kill_timeout ?? 1600) < 160000) fail("worker_graceful_stop_budget_insufficient");
      specs = Object.fromEntries(Object.entries(p).map(([role, v]) => [role, specification(v)]));
      originalKillTimeout = Number(p.worker.pm2_env.kill_timeout);
      if (release?.killTimeoutMs) {
        targetWorkerSpec = specification({ ...p.worker,
          pm2_env: { ...p.worker.pm2_env, kill_timeout: release.killTimeoutMs } });
      }
      if (release?.persistPm2) for (const name of ["dump.pm2", "dump.pm2.bak"]) {
        const s = fs.lstatSync(account.home + "/.pm2/" + name);
        if (!s.isFile() || s.isSymbolicLink() || s.uid !== account.uid || (s.mode & 0o777) !== 0o600)
          fail("private_pm2_dump_required");
      }
      log("prove_original_sources_match_running_worker");
      const originalBuild = JSON.parse(run("runuser", ["-u", name, "--", process.execPath, "-e",
        `(${originalBuildDriver.toString()})().catch(()=>process.exit(1))`], {
        env: { ...env, HOME: account.home }, cwd: APP, timeout: 120000,
        input: JSON.stringify({ app: APP }),
      }));
      if (originalBuild.sha256 !== m.baseline["dist/ai-worker.cjs"] ||
          originalBuild.inputs.some(file => !Object.hasOwn(m.inputs, file)))
        fail("original_sources_do_not_match_running_worker");
      verifyFiles(false); managed();
      const req = createRequire(APP + "/package.json"), { Client } = req("pg");
      const entries = fs.readFileSync(`/proc/${p.web.pid}/environ`, "utf8").split("\0");
      let connection = entries.find(x => x.startsWith("DATABASE_URL="))?.slice(13);
      if (!connection) {
        const line = read(APP + "/.env").toString().split(/\r?\n/).find(x => x.startsWith("DATABASE_URL="));
        connection = req("dotenv").parse(line || "").DATABASE_URL;
      }
      if (!connection) fail("database_configuration_missing");
      db = new Client({ connectionString: connection, connectionTimeoutMillis: 10000,
        statement_timeout: 20000, options: "-c default_transaction_read_only=on" });
      db.on("error", () => { gateLost = true; }); await db.connect();
      await configuration(true); await healthy();
      const alive = (await db.query(`SELECT count(*)::int AS total FROM ai_inference_workers
        WHERE heartbeat_at > clock_timestamp()-interval '30 seconds'`)).rows[0];
      if (alive?.total !== 1) fail("single_existing_worker_required");
    },
    acquire: async () => {
      log("hold_claims_without_changing_saved_pause");
      const until = Date.now() + 10000;
      do {
        if (interrupted) fail("operator_interrupted");
        if ((await db.query("SELECT pg_try_advisory_lock(517,1) AS acquired")).rows[0]?.acquired === true) {
          gate = true; await guard(); return;
        }
        await sleep(100);
      } while (Date.now() < until);
      fail("claim_gate_busy");
    },
    drain,
    backup: async () => {
      log("back_up_current_worker_privately"); await guard(); managed(); verifyFiles(false); await configuration();
      backupDir = fs.mkdtempSync(stageDirectory + "/backup-"); fs.chmodSync(backupDir, 0o700);
      privateDirectory(backupDir);
      for (const file of Object.keys(files).filter(file => m.baseline[file])) {
        const s = fs.lstatSync(APP + "/" + file), bytes = read(APP + "/" + file);
        if (!s.isFile() || s.isSymbolicLink() || (s.mode & 0o7000)) fail("original_metadata_unverified");
        metadata[file] = { uid: s.uid, gid: s.gid, mode: s.mode & 0o777 };
        fs.writeFileSync(backupDir + "/" + path.basename(file), bytes, { flag: "wx", mode: 0o600 });
        if (sha(read(backupDir + "/" + path.basename(file))) !== m.baseline[file]) fail("backup_hash_mismatch");
      }
      if (!release) metadata["server/lib/ai-jobs/summary-html.ts"] = metadata["server/lib/ai-jobs/summary.ts"];
      if (release?.persistPm2) for (const name of ["dump.pm2", "dump.pm2.bak"]) {
        fs.writeFileSync(backupDir + "/" + name, read(account.home + "/.pm2/" + name), { flag: "wx", mode: 0o600 });
      }
      journal = backupDir + "/promotion.jsonl";
      fs.writeFileSync(journal, "", { flag: "wx", mode: 0o600 });
      fs.writeFileSync(backupDir + "/recovery.json", JSON.stringify({ baseline: m.baseline, metadata, head,
        configurationSha256: configHash, maintenanceSha256: maintenanceHash, pm2Specs: specs,
        originalWorkerPid: m.processes.worker.pid }), { flag: "wx", mode: 0o600 });
    },
    stop: async () => {
      log("stop_only_the_idle_ai_worker"); managed(); verifyFiles(false); await stopWorker();
    },
    publish: async () => {
      log(release ? "replace_only_approved_budget_sources_and_worker" : "replace_only_two_sources_and_worker");
      await guard(); managed("stopped"); verifyFiles(false);
      for (const [file, expected] of Object.entries(files)) {
        const bytes = read(stageDirectory + "/" + path.basename(file));
        if (sha(bytes) !== expected) fail("prepared_output_changed");
        copyAtomic(bytes, file, metadata[file]);
      }
      verifyFiles(true);
    },
    restart: async () => {
      log("start_same_worker_configuration"); await guard(); await configuration();
      const p = managed("stopped");
      since = (await db.query("SELECT clock_timestamp() AS since")).rows[0].since;
      asUser(["restart", String(p.worker.pm_id),
        ...(release?.killTimeoutMs ? ["--kill-timeout", String(release.killTimeoutMs)] : [])]);
    },
    ready: async () => { log("verify_fresh_worker_heartbeat"); await ready(); },
    verify: async () => {
      log("verify_unchanged_web_and_ai_settings"); await guard(); managed("new");
      verifyFiles(true); await configuration(); await healthy();
      const c = await counts(); if (c?.jobs !== 0 || c.inference !== 0) fail("work_started_while_gate_held");
    },
    persist: async () => { if (release?.persistPm2) { await guard(); persistPm2(); } },
    receipt: async () => {
      fs.writeFileSync(backupDir + "/verified-before-release.json", JSON.stringify({
        mode: "verified_claims_still_held", workerPid: newPid, workerSha256: files["dist/ai-worker.cjs"],
        webPid: m.processes.web.pid, maintenanceMode: maintenance.mode,
      }), { flag: "wx", mode: 0o600 });
    },
    release: async () => { log("release_only_operator_claim_gate"); await unlockGate(); },
    success: async () => {
      log("deployed");
      const result = { mode: "deployed", workerPid: newPid, previousWorkerPid: m.processes.worker.pid,
        webPid: m.processes.web.pid, webRestarted: false, backupDirectory: backupDir,
        workerSha256: files["dist/ai-worker.cjs"], workerReady: true, operatorClaimGateReleased: true,
        ...(release ? { emailSummaryTimeoutMs: 240000, workerShutdownTimeoutMs: 270000,
          pm2KillTimeoutMs: release.killTimeoutMs, pm2ConfigurationPersisted: !!release.persistPm2 } : {}),
        savedMaintenanceMode: maintenance.mode, providersChanged: false, aiCalls: 0 };
      fs.writeFileSync(backupDir + "/deployed.json", JSON.stringify(result, null, 2), { flag: "wx", mode: 0o600 });
      console.log(JSON.stringify(result, null, 2)); return result;
    },
    rollback: async () => {
      restoring = true; log("guarded_restore_before_claim_release"); await guard(); await drain(); await configuration();
      verifyFiles("recovery");
      const p = managed("any");
      if (p.worker.pid > 0) await stopWorker();
      for (const [file, patched] of Object.entries(files)) {
        const target = APP + "/" + file, exists = fs.existsSync(target);
        if (!m.baseline[file]) {
          if (exists) {
            if (sha(read(target)) !== patched) fail("restore_source_conflict");
            fs.unlinkSync(target);
          }
        } else {
          const current = sha(read(target));
          if (![m.baseline[file], patched].includes(current)) fail("restore_file_conflict");
          const bytes = read(backupDir + "/" + path.basename(file));
          if (sha(bytes) !== m.baseline[file]) fail("restore_backup_changed");
          if (current !== m.baseline[file]) copyAtomic(bytes, file, metadata[file]);
        }
      }
      verifyFiles(false); await guard();
      since = (await db.query("SELECT clock_timestamp() AS since")).rows[0].since;
      asUser(["restart", String(managed("stopped").worker.pm_id),
        ...(release?.killTimeoutMs ? ["--kill-timeout", String(originalKillTimeout)] : [])]);
      await ready(release ? "restored" : "new"); await healthy(); verifyFiles(false); await configuration();
      persistPm2();
      await unlockGate();
      console.log("ORIGINAL_WORKER_RESTORED=true");
    },
    close: async () => {
      try { if (db) await db.end(); } catch { /* Never print connection details. */ }
      process.off("SIGINT", signal); process.off("SIGTERM", signal);
    },
    failureState: () => ({ phase, gateLost, backupDirectory: backupDir || null, lastReadiness }),
  };
}
async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || args[0] !== "--apply") fail("usage_apply_only");
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid() !== 0 ||
      fs.realpathSync(APP) !== APP || fs.realpathSync(DATA) !== DATA) fail("root_on_corpcrm01_required");
  const o = operations();
  try { return await orchestrate(o); }
  catch (e) { e.state = o.failureState(); throw e; }
}
module.exports = { main, operations, orchestrate, validateManifest, specification, originalBuildDriver,
  APP, STAGE, FILES, ORIGINAL, sha };
if (require.main === module) main().catch(e => {
  console.error(JSON.stringify({ mode: "not_confirmed", code: e.safeCode || "promotion_operation_failed",
    ...e.state, rollbackVerified: !!e.rollbackVerified,
    recoveryCode: e.recoveryCode || null,
    manualRecoveryRequired: !!e.manualRecoveryRequired || !!e.releaseAttempted,
    claimReleaseAttempted: !!e.releaseAttempted }));
  process.exitCode = 1;
});
