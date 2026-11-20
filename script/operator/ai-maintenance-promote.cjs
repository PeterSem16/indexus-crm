"use strict";
// Operator-only cutover of the already-built, backed-up, approved feature.
// No dependency installation, provider changes, inference smoke or DB restore.
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const http = require("node:http");
const os = require("node:os");
const { createRequire } = require("node:module");
const APP = "/var/www/indexus-crm", DATA = APP + "/data";
const BASE = "def0850154852b344bcdc9f4c9052e91887d15a1";
const TARGET = "3a1406b7d5c05f29fc5107a7a34a1032c0079ae8";
const BACKUP = DATA + "/ai-maintenance-backup-0FFGbm";
const MARKER = "0d339c7c815824a25b423a4147262e8b882a4869b17bc3e6692d007d2e613634";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = code => { throw Object.assign(Error(code), { safeCode: code }); };
async function hashFile(file) {
  const h = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}
function spec(p, fingerprint) {
  const e = p.pm2_env;
  const bool = value => value === "true" ? true : value === "false" ? false : value;
  return fingerprint({ id: p.pm_id, name: p.name, script: e.pm_exec_path, cwd: e.pm_cwd,
    interpreter: e.exec_interpreter, args: e.args || [], nodeArgs: e.node_args ?? [],
    nodeOptions: e.NODE_OPTIONS || e.env?.NODE_OPTIONS || "",
    killTimeout: Number(e.kill_timeout ?? 1600), mode: e.exec_mode, instances: e.instances,
    autorestart: bool(e.autorestart), watch: bool(e.watch),
    protectedEnvironment: Object.fromEntries(Object.entries(e.env || {}).filter(([k]) =>
      /^(?:DATABASE_URL$|PG[A-Z_]*$|SESSION_SECRET$|NODE_ENV$|PORT$|AI_|INDEXUS_|INTERNAL_AI_|OPENAI_)/.test(k))),
  });
}
function assertBackup(m, stage, backup) {
  if (m.mode !== "backup_validated_not_deployed" || m.productionBase !== BASE ||
      m.sourceCommit !== TARGET || m.sourceTree !== stage.TREE || m.backupDirectory !== BACKUP ||
      m.stageDirectory !== backup.STAGE || !m.backupValidated || !m.nativeDatabaseIdentityVerified ||
      !m.databaseDump?.archiveListed || !m.databaseDump.archiveFullyDecoded ||
      m.databaseDump.restoredIntoDatabase !== false || m.maintenanceBefore?.exists !== false ||
      !m.workerGracefulStopBudgetSufficient || m.activeWorkersAtRecheck !== 1)
    fail("verified_backup_required");
  backup.validatePrepared({ ...m, mode: "prepared_not_deployed", unchangedProcesses: m.processes });
}
async function orchestrate(ops) {
  const flags = { stopAttempted: false, sourceAttempted: false, runtimeAttempted: false,
    apiRestartAttempted: false, workerRestartAttempted: false, released: false };
  await ops.preflight();
  try {
    await ops.acquire();
    await ops.drain();
    flags.stopAttempted = true; await ops.stop();
    flags.sourceAttempted = true; await ops.source();
    flags.runtimeAttempted = true; await ops.publish();
    flags.apiRestartAttempted = true; await ops.restartApi();
    await ops.schema();
    flags.workerRestartAttempted = true; await ops.restartWorker();
    await ops.workerReady();
    await ops.expose();
    await ops.verify();
    await ops.persist();
    await ops.release(); flags.released = true;
    return await ops.success();
  } catch (e) {
    try { await ops.failure?.(e); } catch { /* A logging failure must not prevent guarded recovery. */ }
    if (flags.stopAttempted && !flags.released) {
      try { await ops.rollback(flags); e.rollbackVerified = true; }
      catch { e.rollbackFailed = true; }
    }
    if (flags.released) e.postRelease = true;
    throw e;
  }
}
function productionOperations(stage, backup) {
  const sha = backup.sha, fingerprint = backup.fingerprint;
  const env = backup.safeEnvironment(process.env);
  let db, gate = false, gateLost = false, marker, runtime, built, account, pm2, journal;
  let expectedSpecs, maintenance, oldApiPid, newApiPid, newWorkerPid;
  const state = { productionBase: BASE, sourceCommit: TARGET, backupDirectory: BACKUP,
    providersChangedByThisTool: false, databaseRestored: false, schemaMayHaveChanged: false,
    gatewayDrain: "unverified", backendDrain: "unverified" };
  const run = (bin, args, opts = {}) => {
    try { return cp.execFileSync(bin, args, { encoding: "utf8", timeout: 30000,
      maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], env, ...opts }); }
    catch (e) { throw Object.assign(Error("native_operation_failed"), {
      safeCode: "native_" + bin.replace(/[^a-z0-9]/gi, "_") + "_failed",
      nativeExitStatus: Number.isInteger(e.status) ? e.status : null }); }
  };
  const git = args => run("git", ["--no-optional-locks", "-c", `safe.directory=${APP}`,
    "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-C", APP, ...args]).trim();
  const blob = (ref, file) => run("git", ["--no-optional-locks", "-c", `safe.directory=${APP}`,
    "-C", APP, "show", `${ref}:${file}`], { encoding: null });
  const asUser = (bin, args, opts = {}) => run("runuser", ["-u", "seman", "--", bin, ...args],
    { ...opts, env: { ...env, HOME: account.home, PM2_HOME: account.home + "/.pm2" } });
  function phase(name) {
    state.phase = name; console.log("PHASE=" + name);
    if (journal) fs.appendFileSync(journal, JSON.stringify({ phase: name, at: new Date().toISOString() }) + "\n");
  }
  function privateDirectory(dir) {
    const s = fs.lstatSync(dir);
    if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== 0 || (s.mode & 0o777) !== 0o700 ||
        fs.realpathSync(dir) !== dir) fail("private_directory_changed");
    for (const uid of [1001, 33]) for (const access of ["-r", "-x"]) {
      const p = cp.spawnSync("setpriv", [`--reuid=${uid}`, `--regid=${uid}`, "--clear-groups",
        "/usr/bin/test", access, dir], { env, timeout: 10000, stdio: "ignore" });
      if (p.status !== 1) fail("private_directory_access_not_verified");
    }
  }
  function sources(ref) {
    if (git(["rev-parse", "HEAD"]) !== ref || git(["status", "--porcelain", "--untracked-files=no"]))
      fail("production_sources_changed");
    const tracked = new Set(git(["ls-tree", "-r", "--name-only", ref]).split("\n"));
    for (const f of [...stage.FILES, "package.json", "package-lock.json", "script/build.ts",
      "server/index.ts", "server/ai-worker.ts", "server/routes.ts"]) {
      const bytes = stage.regular(APP, f, true);
      if (tracked.has(f) ? !bytes || sha(bytes) !== sha(blob(ref, f)) : bytes !== null)
        fail("source_bytes_changed");
    }
  }
  function unchangedConfiguration() {
    if (sha(fs.readFileSync(backup.LOADER)) !== marker.preloadSha256) fail("preload_changed");
    const bytes = stage.regular(APP, ".env", true);
    if ((bytes ? sha(bytes) : null) !== marker.applicationEnvSha256) fail("application_environment_changed");
  }
  async function settings() {
    const rows = (await db.query("SELECT version,value FROM ai_router_configuration WHERE singleton=true")).rows;
    if (rows.length !== 1 || fingerprint(rows[0]) !== marker.settingsSha256) fail("ai_configuration_changed");
  }
  function managed({ stopped = false, recovery = false } = {}) {
    if (fs.readFileSync(account.home + "/.pm2/pm2.pid", "utf8").trim() !== String(marker.pm2.daemonPid) ||
        !/^Uid:\s+1001\s+1001\s+1001\s+1001\s*$/m.test(
          fs.readFileSync(`/proc/${marker.pm2.daemonPid}/status`, "utf8"))) fail("pm2_daemon_changed");
    const sock = fs.lstatSync(account.home + "/.pm2/rpc.sock");
    if (!sock.isSocket() || sock.uid !== 1001) fail("pm2_socket_changed");
    const selected = JSON.parse(asUser(pm2, ["jlist"])).filter(p =>
      ["indexus-crm", "indexus-ai-worker"].includes(p.name) ||
      [APP + "/dist/index.cjs", APP + "/dist/ai-worker.cjs"].includes(p.pm2_env?.pm_exec_path));
    if (selected.length !== 2) fail("managed_services_ambiguous");
    const result = {};
    for (const original of marker.pm2.processes) {
      const p = selected.find(p => p.pm_id === original.id), e = p?.pm2_env;
      if (!p || p.name !== original.name || e.pm_exec_path !== original.script || e.pm_cwd !== APP ||
          e.exec_interpreter !== original.interpreter) fail("managed_service_identity_changed");
      if (expectedSpecs && spec(p, fingerprint) !== expectedSpecs[original.role]) fail("pm2_configuration_changed");
      if (e.status === "online" && p.pid > 0) {
        const status = fs.readFileSync(`/proc/${p.pid}/status`, "utf8");
        if (!/^Uid:\s+1001\s+1001\s+1001\s+1001\s*$/m.test(status) ||
            Number(/^PPid:\s+(\d+)/m.exec(status)?.[1]) !== marker.pm2.daemonPid ||
            fs.readlinkSync(`/proc/${p.pid}/cwd`) !== APP ||
            fs.readlinkSync(`/proc/${p.pid}/exe`) !== "/usr/bin/node") fail("service_owner_changed");
      } else if (!(p.pid === 0 && ["stopped", "errored"].includes(e.status) &&
                   (recovery || stopped && original.role === "worker"))) fail("managed_service_not_online");
      result[original.role] = p;
    }
    return result;
  }
  async function assertGate() {
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
    const end = Date.now() + 180000;
    do {
      await assertGate();
      const c = await counts();
      if (c?.jobs === 0 && c.inference === 0) return;
      await pause(500);
    } while (Date.now() < end);
    fail("inflight_work_did_not_finish_no_forced_cancellation");
  }
  async function readMaintenance() {
    return (await db.query(`SELECT mode,version,operation_id,owner_id FROM ai_queue_maintenance
      WHERE scope='internal-gateway'`)).rows[0];
  }
  async function schemaReady() {
    const end = Date.now() + 180000;
    do {
      await assertGate();
      try {
        await db.query("SELECT maintenance_protocol,maintenance_version FROM ai_inference_workers LIMIT 0");
        await db.query("SELECT action,version FROM ai_queue_maintenance_audit LIMIT 0");
        const m = await readMaintenance();
        if (m?.mode === "running" && m.version === 0 && m.operation_id === null && m.owner_id === null) {
          maintenance = { mode: m.mode, version: m.version }; return;
        }
      } catch (e) { if (!["42P01", "42703"].includes(e.code)) throw e; }
      await pause(1000);
    } while (Date.now() < end);
    fail("maintenance_schema_not_ready");
  }
  function httpRead(relative) {
    return new Promise((resolve, reject) => {
      const req = http.get({ hostname: "127.0.0.1", port: 5000, path: relative, timeout: 5000 }, res => {
        const parts = []; let size = 0;
        res.on("data", b => { size += b.length; if (size > 131072) res.destroy(Error("response_limit")); else parts.push(b); });
        res.on("error", reject);
        res.on("end", () => resolve({ status: res.statusCode, sha256: sha(Buffer.concat(parts)) }));
      });
      req.on("error", reject); req.on("timeout", () => req.destroy(Error("http_timeout")));
    });
  }
  async function healthy(index, { wait = false, changedPid = false, newRoute = false } = {}) {
    const end = Date.now() + (wait ? 180000 : 10000); let stable = 0;
    do {
      try {
        const p = managed({ stopped: true }), root = await httpRead("/");
        const config = await httpRead("/api/configurator/ai");
        const auth = await httpRead("/api/call-logs/browse");
        const extra = newRoute ? await httpRead("/api/configurator/ai/maintenance") : { status: 401 };
        state.lastHttpObservation = { root: root.status, indexMatches: root.sha256 === index,
          config: config.status, auth: auth.status, maintenance: newRoute ? extra.status : null };
        if (root.status === 200 && root.sha256 === index && config.status === 401 &&
            auth.status === 401 && extra.status === 401 && (!changedPid || p.api.pid !== oldApiPid)) {
          if (++stable >= (wait ? 3 : 1)) return p.api.pid;
        } else stable = 0;
      } catch { stable = 0; }
      if (!wait) break;
      await pause(1000);
    } while (Date.now() < end);
    fail("application_health_not_verified");
  }
  function atomicCopy(from, relative, metadata) {
    const to = path.join(APP, relative), parent = path.dirname(to);
    fs.mkdirSync(parent, { recursive: true, mode: 0o755 });
    if (fs.realpathSync(parent) !== parent || fs.lstatSync(parent).isSymbolicLink()) fail("runtime_destination_symlink");
    const tmp = path.join(parent, "ai-maintenance-" + crypto.randomUUID() + ".tmp");
    try {
      const fd = fs.openSync(tmp, "wx", 0o600);
      try {
        fs.writeFileSync(fd, fs.readFileSync(from));
        fs.fchmodSync(fd, metadata?.mode ?? 0o644);
        fs.fchownSync(fd, metadata?.uid ?? account.uid, metadata?.gid ?? account.gid);
        if (fs.fstatSync(fd).ino !== fs.lstatSync(tmp).ino || fs.lstatSync(tmp).isSymbolicLink())
          fail("runtime_temporary_file_changed");
      } finally { fs.closeSync(fd); }
      fs.renameSync(tmp, to);
    } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  }
  function persist() {
    for (const name of ["dump.pm2", "dump.pm2.bak"]) {
      const f = account.home + "/.pm2/" + name;
      if (!fs.existsSync(f)) { fs.closeSync(fs.openSync(f, "wx", 0o600)); fs.chownSync(f, account.uid, account.gid); }
      const s = fs.lstatSync(f);
      if (!s.isFile() || s.isSymbolicLink() || s.uid !== 1001) fail("pm2_dump_identity_changed");
      fs.chmodSync(f, 0o600);
    }
    asUser(pm2, ["save"]);
    for (const name of ["dump.pm2", "dump.pm2.bak"]) fs.chmodSync(account.home + "/.pm2/" + name, 0o600);
  }
  async function readyWorker(protocol) {
    const end = Date.now() + 45000; let stable = 0, lastPid;
    do {
      await assertGate();
      try {
        const p = managed(), c = (await db.query(protocol ?
          `SELECT count(*)::int AS total,count(*) FILTER (WHERE maintenance_protocol=1
            AND maintenance_version=0)::int AS compatible FROM ai_inference_workers
            WHERE heartbeat_at > clock_timestamp() - interval '30 seconds'` :
          `SELECT count(*)::int AS total FROM ai_inference_workers
            WHERE heartbeat_at > clock_timestamp() - interval '30 seconds'`)).rows[0];
        if (c?.total === 1 && (!protocol || c.compatible === 1)) {
          stable = lastPid === p.worker.pid ? stable + 1 : 1; lastPid = p.worker.pid;
          if (stable >= 3) return p.worker.pid;
        } else stable = 0;
      } catch { stable = 0; }
      await pause(1000);
    } while (Date.now() < end);
    fail("worker_readiness_not_verified");
  }
  return {
    state,
    failure: async e => {
      state.failedPhase = state.phase;
      state.failedCode = e.safeCode || "deployment_operation_failed";
      state.failedHttpObservation = state.lastHttpObservation ? { ...state.lastHttpObservation } : null;
      if (journal) fs.appendFileSync(journal, JSON.stringify({ event: "failure",
        phase: state.failedPhase, code: state.failedCode, http: state.failedHttpObservation,
        at: new Date().toISOString() }) + "\n");
    },
    preflight: async () => {
      phase("verify_existing_backup");
      privateDirectory(BACKUP); privateDirectory(backup.STAGE);
      const bytes = stage.regular(BACKUP, "backup-validated.json");
      if (sha(bytes) !== MARKER) fail("backup_marker_changed");
      marker = JSON.parse(bytes); assertBackup(marker, stage, backup);
      const age = Date.now() - Date.parse(marker.checkedAt);
      if (!Number.isFinite(age) || age < -300000 || age > 2 * 60 * 60 * 1000) fail("fresh_backup_required");
      if (fs.statSync(BACKUP + "/database.dump").size !== marker.databaseDump.bytes ||
          await hashFile(BACKUP + "/database.dump") !== marker.databaseDump.sha256 ||
          await hashFile(BACKUP + "/source.tar") !== marker.sourceArchiveSha256) fail("backup_archive_changed");
      stage.validateScope(git(["rev-parse", TARGET + "^"]), git(["rev-parse", TARGET + "^{tree}"]),
        git(["diff", "--name-only", BASE, TARGET]).split("\n").filter(Boolean));
      sources(BASE);
      for (const [f, expected] of Object.entries(stage.RUNTIME))
        if (sha(stage.regular(APP, f)) !== expected) fail("live_runtime_changed");
      runtime = JSON.parse(stage.regular(BACKUP, "runtime-manifest.json"));
      if (fingerprint(backup.inventory(APP + "/dist")) !== fingerprint(runtime) ||
          fingerprint(backup.contentInventory(backup.inventory(BACKUP + "/dist"))) !==
          fingerprint(backup.contentInventory(runtime))) fail("runtime_backup_changed");
      const prepared = JSON.parse(stage.regular(backup.STAGE, "prepared.json")); backup.validatePrepared(prepared);
      for (const f of stage.FILES)
        if (sha(stage.regular(backup.STAGE + "/source", f)) !== sha(blob(TARGET, f))) fail("stage_source_changed");
      for (const [f, expected] of Object.entries(backup.BUILT))
        if (sha(stage.regular(backup.STAGE + "/source", f)) !== expected) fail("stage_build_changed");
      built = backup.inventory(backup.STAGE + "/source/dist");
      const space = fs.statfsSync(APP + "/dist");
      if (space.bsize * space.bavail < built.reduce((n, f) => n + f.bytes, 0) * 2 + 128 * 1024 ** 2)
        fail("live_runtime_space_insufficient");
      for (const f of built) {
        if (!["index.cjs", "ai-worker.cjs"].includes(f.path) && !f.path.startsWith("public/"))
          fail("unexpected_build_output");
        const old = stage.regular(APP + "/dist", f.path, true);
        if (!["index.cjs", "ai-worker.cjs", "public/index.html"].includes(f.path) &&
            old && sha(old) !== f.sha256) fail("immutable_asset_collision");
      }
      stage.assertProcessSnapshot(marker.processes, stage.applicationProcesses());
      const u = run("getent", ["passwd", "seman"]).trim().split(":");
      account = { uid: +u[2], gid: +u[3], home: u[5] };
      if (account.uid !== 1001 || !path.isAbsolute(account.home || "")) fail("application_account_changed");
      pm2 = run("runuser", ["-l", "seman", "-c", "command -v pm2"]).trim();
      if (!path.isAbsolute(pm2) || pm2.includes("\n")) fail("pm2_command_unavailable");
      const p = managed();
      for (const original of marker.pm2.processes)
        if (fingerprint(backup.processDescription(p[original.role])) !== fingerprint(original))
          fail("pm2_inventory_changed");
      expectedSpecs = Object.fromEntries(Object.entries(p).map(([role, v]) => [role, spec(v, fingerprint)]));
      oldApiPid = p.api.pid; unchangedConfiguration();
      const req = createRequire(APP + "/package.json");
      const inherited = fs.readFileSync(`/proc/${oldApiPid}/environ`, "utf8").split("\0");
      let connection = inherited.find(v => v.startsWith("DATABASE_URL="))?.slice(13);
      if (!connection) connection = req("dotenv").parse(stage.regular(APP, ".env")).DATABASE_URL;
      if (!connection) fail("database_configuration_missing");
      const { Client } = req("pg");
      db = new Client({ connectionString: connection, connectionTimeoutMillis: 10000,
        statement_timeout: 20000, options: "-c default_transaction_read_only=on" });
      db.on("error", () => { gateLost = true; }); await db.connect();
      const identity = (await db.query(`SELECT current_database() AS database,current_user AS role,
        inet_server_addr()::text AS address,inet_server_port() AS port`)).rows[0];
      if (fingerprint(identity) !== marker.databaseIdentitySha256) fail("database_identity_changed");
      await settings();
      const exists = (await db.query("SELECT to_regclass('public.ai_queue_maintenance') IS NOT NULL AS present")).rows[0];
      if (exists?.present !== false) fail("maintenance_schema_changed_since_backup");
      for (const f of ["server/lib/ai-jobs/store.ts", "server/lib/ai-jobs/inference-store.ts"])
        if (!blob(BASE, f).toString().includes("pg_try_advisory_xact_lock(517,1)"))
          fail("legacy_claim_serialization_not_supported");
      await healthy(stage.RUNTIME["dist/public/index.html"]);
      journal = BACKUP + "/deployment-" + crypto.randomUUID() + ".jsonl";
      fs.writeFileSync(journal, "", { mode: 0o600 });
    },
    acquire: async () => {
      phase("hold_compatible_claim_gate");
      const end = Date.now() + 10000;
      do {
        if ((await db.query("SELECT pg_try_advisory_lock(517,1) AS acquired")).rows[0]?.acquired === true) {
          gate = true; await assertGate(); return;
        }
        await pause(100);
      } while (Date.now() < end);
      fail("claim_gate_busy");
    },
    drain: async () => { phase("finish_existing_ai_work"); await drain(); },
    stop: async () => {
      phase("stop_idle_existing_worker"); await assertGate(); await drain(); await settings();
      stage.assertProcessSnapshot(marker.processes, stage.applicationProcesses()); sources(BASE);
      if (fingerprint(backup.inventory(APP + "/dist")) !== fingerprint(runtime))
        fail("live_runtime_changed");
      unchangedConfiguration(); const p = managed();
      asUser(pm2, ["stop", String(p.worker.pm_id)], { timeout: 180000 });
      const stopped = managed({ stopped: true }).worker;
      if (stopped.pid !== 0 || stopped.pm2_env.status !== "stopped" ||
          ![0, "0"].includes(stopped.pm2_env.exit_code))
        fail("worker_graceful_stop_not_verified");
      const alive = (await db.query(`SELECT count(*)::int AS count FROM ai_inference_workers
        WHERE heartbeat_at > clock_timestamp() - interval '30 seconds'`)).rows[0]?.count;
      if (alive !== 0) fail("unexpected_worker_heartbeat");
      await assertGate();
    },
    source: async () => {
      phase("promote_exact_feature_sources"); await assertGate(); sources(BASE);
      asUser("git", ["--no-optional-locks", "-c", "core.hooksPath=/dev/null", "-C", APP,
        "merge", "--ff-only", "--no-edit", TARGET]); sources(TARGET);
    },
    publish: async () => {
      phase("publish_assets_and_backend"); await assertGate(); unchangedConfiguration();
      if (fingerprint(backup.inventory(APP + "/dist")) !== fingerprint(runtime))
        fail("live_runtime_changed");
      for (const f of built.filter(f => !["index.cjs", "ai-worker.cjs", "public/index.html"].includes(f.path))) {
        const old = stage.regular(APP + "/dist", f.path, true);
        if (old && sha(old) !== f.sha256) fail("immutable_asset_collision");
        if (!old) atomicCopy(backup.STAGE + "/source/dist/" + f.path, "dist/" + f.path);
      }
      for (const f of ["dist/index.cjs", "dist/ai-worker.cjs"])
        atomicCopy(backup.STAGE + "/source/" + f, f);
    },
    restartApi: async () => {
      phase("restart_indexus_web"); await assertGate(); state.schemaMayHaveChanged = true;
      const p = managed({ stopped: true }); asUser(pm2, ["restart", String(p.api.pm_id)], { timeout: 40000 });
      newApiPid = await healthy(stage.RUNTIME["dist/public/index.html"], { wait: true, changedPid: true, newRoute: true });
    },
    schema: async () => { phase("verify_additive_maintenance_schema"); await schemaReady(); },
    restartWorker: async () => {
      phase("restart_same_worker_configuration"); await assertGate();
      const p = managed({ stopped: true }); asUser(pm2, ["restart", String(p.worker.pm_id)], { timeout: 40000 });
    },
    workerReady: async () => { phase("verify_worker_protocol"); newWorkerPid = await readyWorker(true); },
    expose: async () => {
      phase("publish_new_frontend_entry"); await assertGate();
      atomicCopy(backup.STAGE + "/source/dist/public/index.html", "dist/public/index.html");
    },
    verify: async () => {
      phase("verify_completed_cutover"); await assertGate(); await settings(); unchangedConfiguration(); sources(TARGET);
      for (const f of built) if (sha(stage.regular(APP + "/dist", f.path)) !== f.sha256) fail("published_runtime_changed");
      await healthy(backup.BUILT["dist/public/index.html"], { wait: true, changedPid: true, newRoute: true });
      await schemaReady(); await readyWorker(true);
    },
    persist: async () => { phase("persist_existing_pm2_services"); await assertGate(); managed(); persist(); await settings(); },
    release: async () => {
      phase("release_operator_claim_gate"); await assertGate();
      if ((await db.query("SELECT pg_advisory_unlock(517,1) AS released")).rows[0]?.released !== true)
        fail("claim_gate_release_not_verified");
      gate = false;
    },
    success: async () => {
      phase("deployed");
      const result = { ...state, mode: "deployed", backupValidated: true, workerReady: true,
        workerProtocol: 1, apiPid: newApiPid, workerPid: newWorkerPid, maintenanceAtVerification: maintenance,
        operatorClaimGateReleased: true, checkedAt: new Date().toISOString() };
      fs.writeFileSync(journal + ".result.json", JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
      console.log(JSON.stringify(result, null, 2)); return result;
    },
    rollback: async flags => {
      phase("restore_previous_code_without_database_restore"); await assertGate(); await drain();
      if (state.schemaMayHaveChanged) {
        try {
          const m = await readMaintenance();
          if (m && (m.mode !== "running" || m.version !== 0 || m.operation_id !== null || m.owner_id !== null))
            fail("maintenance_changed_manual_recovery_required");
        } catch (e) { if (!["42P01", "42703"].includes(e.code)) throw e; }
      }
      let p = managed({ recovery: true });
      if (flags.workerRestartAttempted && p.worker.pid > 0) {
        asUser(pm2, ["stop", String(p.worker.pm_id)], { timeout: 180000 });
        p = managed({ recovery: true }); if (p.worker.pid !== 0) fail("rollback_worker_not_stopped");
      }
      if (flags.runtimeAttempted) for (const file of Object.keys(stage.RUNTIME)) {
        const current = sha(stage.regular(APP, file));
        if (![stage.RUNTIME[file], backup.BUILT[file]].includes(current)) fail("rollback_runtime_conflict");
        atomicCopy(BACKUP + "/" + file, file, runtime.find(f => "dist/" + f.path === file));
      }
      if (flags.sourceAttempted) {
        const head = git(["rev-parse", "HEAD"]);
        if (head === TARGET) {
          sources(TARGET);
          asUser("git", ["--no-optional-locks", "-c", "core.hooksPath=/dev/null", "-C", APP, "reset", "--keep", BASE]);
        } else if (head !== BASE) fail("rollback_source_conflict");
        sources(BASE);
      }
      if (flags.apiRestartAttempted) asUser(pm2, ["restart", String(p.api.pm_id)], { timeout: 40000 });
      p = managed({ stopped: true });
      if (p.worker.pid === 0) asUser(pm2, ["restart", String(p.worker.pm_id)], { timeout: 40000 });
      await healthy(stage.RUNTIME["dist/public/index.html"], { wait: true });
      await readyWorker(false); await settings(); unchangedConfiguration(); sources(BASE); persist();
    },
    close: async () => { if (db) await db.end().catch(() => {}); },
  };
}
async function main(args, stage, backup) {
  if (args.length !== 2 || args[0] !== "--apply" || args[1] !== TARGET) fail("use_apply_exact_feature_commit");
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid() !== 0)
    fail("root_on_corpcrm01_required");
  if (stage?.BASE !== BASE || stage?.TARGET !== TARGET || backup?.TARGET !== TARGET)
    fail("verified_helper_bundle_required");
  stage.assertMount(JSON.parse(cp.execFileSync("findmnt",
    ["--json", "--target", DATA, "--output", "SOURCE,TARGET"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: backup.safeEnvironment(process.env) })).filesystems);
  const lock = DATA + "/ai-services-deployment-lock";
  try { fs.mkdirSync(lock, { mode: 0o700 }); } catch { fail("deployment_lock_exists"); }
  const ops = productionOperations(stage, backup);
  try { return await orchestrate(ops); }
  catch (e) {
    console.log(JSON.stringify({ ...ops.state, mode: e.postRelease ? "deployed_final_report_incomplete" :
      e.rollbackVerified ? "previous_code_restored" : e.rollbackFailed ? "manual_recovery_required" :
      "deployment_stopped", code: e.safeCode || "deployment_operation_failed",
      nativeExitStatus: e.nativeExitStatus ?? null, rollbackVerified: !!e.rollbackVerified,
      sqlState: /^[A-Z0-9]{5}$/.test(e.code || "") ? e.code : null,
      schemaMayHaveChanged: ops.state.schemaMayHaveChanged, databaseRestored: false }, null, 2));
    throw Object.assign(Error("deployment_stopped"), { alreadyReported: true });
  } finally { await ops.close(); fs.rmdirSync(lock); }
}
if (require.main === module) { console.error("use_verified_promotion_bundle"); process.exitCode = 2; }
module.exports = { main, productionOperations, orchestrate, spec, assertBackup, BASE, TARGET, BACKUP, MARKER, hashFile };
