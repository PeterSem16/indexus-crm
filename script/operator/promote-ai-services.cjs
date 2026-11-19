"use strict";
// Operator-run promotion of the already-built, explicitly approved release.
// No inference, provider changes, worker start or automatic database restoration.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const http = require("node:http");
const { createRequire } = require("node:module");
const APP = "/var/www/indexus-crm";
const DATA = APP + "/data";
const STAGE = DATA + "/ai-services-stage-aBwcWg";
const BASE = "0ee328b123a33014fab7380210ac7ee158b14085";
const TARGET = "328527d5699f4a13a30b9e945bf1bf5f59cb9f42";
const TREE = "475ef9067dcb4dc1aac28a33fd24ad61193a3c10";
const LOADER = "/etc/indexus-ai-runtime/preload.cjs";
const LOADER_HASH = "33af3aaff20605583f9152fcad2abe61ec0cef4c4ebe771e43f0cf7d87aa0fac";
const BUILT = {
  "dist/index.cjs": "03e956745252f86f73378e349bf686474fe334c760e3273319dfc454b38de871",
  "dist/ai-worker.cjs": "6fc5c55a2669129f0442ff9fccdeef9b22262a89144e86e58002a2b71700bf37",
  "dist/public/index.html": "1e1768754e6b3c810017b9baa50617b56060c9b5d7c0e675bb37f5e6f7813d7f",
};
const OLD = {
  "dist/index.cjs": "2bef809aef7a9ab71c1d30babfce99411dc275e0abe10e97264d5cb86bbe9415",
  "dist/public/index.html": "3643e7041bfa1aef46a8a726c26fc6dfd631b741e172c14f39209db115c20854",
};
const sha = data => crypto.createHash("sha256").update(data).digest("hex");
async function hashFile(file) {
  const digest = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
}
const fail = code => { throw Object.assign(new Error(code), { safeCode: code }); };
const cleanEnv = input => Object.fromEntries(Object.entries(input).filter(([key]) =>
  !key.startsWith("PG") && !["DATABASE_URL", "NODE_OPTIONS", "NODE_PATH"].includes(key)));
function nativeEnvironment(connection, inherited = {}) {
  let u;
  try { u = new URL(connection); } catch { fail("database_configuration_invalid"); }
  if (!["postgres:", "postgresql:"].includes(u.protocol) || !u.hostname || !u.username ||
      !u.pathname.slice(1) || u.hash) fail("database_configuration_incomplete");
  const env = { ...cleanEnv(inherited), PGCONNECT_TIMEOUT: "10",
    PGHOST: u.hostname.replace(/^\[|\]$/g, ""), PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)) };
  const mapping = { sslmode: "PGSSLMODE", sslcert: "PGSSLCERT", sslkey: "PGSSLKEY",
    sslrootcert: "PGSSLROOTCERT", sslcrl: "PGSSLCRL", gssencmode: "PGGSSENCMODE",
    connect_timeout: "PGCONNECT_TIMEOUT", options: "PGOPTIONS", application_name: "PGAPPNAME",
    channel_binding: "PGCHANNELBINDING", ssl_min_protocol_version: "PGSSLMINPROTOCOLVERSION" };
  const seen = new Set();
  for (const [key, value] of u.searchParams) {
    if (!mapping[key] || seen.has(key)) fail("database_url_parameter_unsupported");
    env[mapping[key]] = value; seen.add(key);
  }
  env.PGOPTIONS = (env.PGOPTIONS ? env.PGOPTIONS + " " : "") + "-c default_transaction_read_only=on";
  return env;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function settingsHash(value) { return sha(Buffer.from(JSON.stringify(canonical(value)))); }
function assertOfflineSafe(value, mode) {
  const active = value?.gateway?.enabled
    ? Object.entries(value.routes || {}).filter(([, r]) => r?.enabled && r.provider === "internal").map(([id]) => id)
    : [];
  if (mode !== "legacy" && active.length)
    throw Object.assign(new Error("active_internal_routes_require_worker_approval"),
      { safeCode: "active_internal_routes_require_worker_approval", serviceIds: active });
}
function run(bin, args, opts = {}) {
  return cp.execFileSync(bin, args, { encoding: "utf8", timeout: 30000,
    maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    env: cleanEnv(process.env), ...opts });
}
function regular(root, relative) {
  let current = root;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
    if (stat.isSymbolicLink()) fail("unexpected_source_symlink");
  }
  if (!fs.lstatSync(current).isFile()) fail("unexpected_source_type");
  return fs.readFileSync(current);
}
function inventory(root, prefix = "") {
  const result = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) result.push(...inventory(root, relative));
    else if (entry.isFile()) {
      const file = path.join(root, relative), stat = fs.statSync(file);
      result.push({ path: relative, sha256: sha(fs.readFileSync(file)), bytes: stat.size,
        mode: stat.mode & 0o777, uid: stat.uid, gid: stat.gid });
    } else fail("runtime_contains_nonregular_file");
  }
  return result;
}
function validatePrepared(manifest, prepared) {
  if (manifest?.format !== 2 || manifest.productionBase !== BASE || manifest.sourceCommit !== TARGET ||
      manifest.sourceTree !== TREE || !Array.isArray(manifest.files) || manifest.files.length !== 70 ||
      prepared?.mode !== "prepared_not_deployed" || prepared.stageDirectory !== STAGE ||
      prepared.sourceCommit !== TARGET || prepared.productionBase !== BASE) fail("prepared_identity_mismatch");
  const seen = new Set();
  for (const f of manifest.files) {
    if (!/^(?:client|server|shared|script|docs)\//.test(f.path || "") && f.path !== "package.json")
      fail("release_scope_invalid");
    if (f.path.split("/").some(p => !p || p === "." || p === ".." || p.startsWith(".")) ||
        f.path.includes("\\") || seen.has(f.path) || !/^[a-f0-9]{64}$/.test(f.sha256 || "") ||
        f.baseSha256 !== null && !/^[a-f0-9]{64}$/.test(f.baseSha256 || "")) fail("release_scope_invalid");
    seen.add(f.path);
  }
  for (const [file, digest] of Object.entries(BUILT))
    if (prepared.outputs?.[file]?.sha256 !== digest) fail("prepared_build_mismatch");
}
function httpRead(relative) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port: 5000, path: relative,
      timeout: 6000, headers: { "cache-control": "no-cache" } }, response => {
      const chunks = []; let bytes = 0;
      response.on("data", chunk => {
        bytes += chunk.length;
        if (bytes > 131072) { response.destroy(); reject(new Error("response_limit")); }
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({ status: response.statusCode, body: Buffer.concat(chunks) }));
      response.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("http_timeout")));
    req.on("error", reject);
  });
}
async function orchestrate(ops) {
  let sourceAttempted = false, runtimeAttempted = false;
  await ops.phase("preflight"); await ops.preflight();
  await ops.phase("private_backup"); await ops.backup();
  await ops.phase("recheck"); await ops.recheck();
  try {
    await ops.phase("source"); sourceAttempted = true; await ops.source();
    await ops.phase("runtime"); runtimeAttempted = true; await ops.runtime();
    await ops.phase("restart"); await ops.restart();
    await ops.phase("verify"); await ops.verify();
    await ops.phase("deployed"); await ops.success();
  } catch (error) {
    await ops.phase("rollback");
    try { await ops.rollback({ sourceAttempted, runtimeAttempted }); }
    catch { error.rollbackFailed = true; }
    throw error;
  }
}
function productionOperations(manifest) {
  let backup, journal, db, nativeEnv, user, pm2, oldPid, beforeSettings, runtimeBefore, buildFiles, databaseBytes;
  const stageSource = path.join(STAGE, "source");
  let phase = "initial";
  const appRequire = createRequire(APP + "/package.json");
  const state = { target: TARGET, productionBase: BASE, backupValidated: false,
    workerStarted: false, providersActivated: false, databaseRestored: false };
  const git = args => run("git", ["--no-optional-locks", "-c", `safe.directory=${APP}`,
    "-c", "core.hooksPath=/dev/null", "-C", APP, ...args]).trim();
  function asUser(bin, args) {
    return run("runuser", ["-u", "seman", "--", bin, ...args],
      { env: { ...cleanEnv(process.env), HOME: user.home, PM2_HOME: user.home + "/.pm2" } });
  }
  function gitUser(args) {
    return asUser("git", ["--no-optional-locks", "-c", "core.hooksPath=/dev/null", "-C", APP, ...args]).trim();
  }
  function processInfo(expectedPid) {
    if (fs.readFileSync(user.home + "/.pm2/pm2.pid", "utf8").trim() !== "22545")
      fail("pm2_daemon_changed");
    const daemon = fs.readFileSync("/proc/22545/status", "utf8");
    if (!/^Uid:\s+1001\s/m.test(daemon)) fail("pm2_owner_changed");
    const rows = JSON.parse(asUser(pm2, ["jlist"]));
    const p = rows.find(p => p.pm_id === 4 && p.name === "indexus-crm");
    if (!p || p.pm2_env.status !== "online" || p.pm2_env.pm_cwd !== APP ||
        p.pm2_env.pm_exec_path !== APP + "/dist/index.cjs" || !(p.pid > 0) ||
        expectedPid && p.pid !== expectedPid) fail("application_process_changed");
    if (rows.some(p => /(?:^|\/)ai-worker\.(?:cjs|[cm]?js|ts)$/.test(p.pm2_env?.pm_exec_path || "")))
      fail("unexpected_existing_worker");
    const status = fs.readFileSync(`/proc/${p.pid}/status`, "utf8");
    if (!/^Uid:\s+1001\s/m.test(status) || fs.readlinkSync(`/proc/${p.pid}/cwd`) !== APP)
      fail("application_owner_changed");
    return p;
  }
  function protectedRuntime(expected) {
    for (const [file, digest] of Object.entries(expected)) {
      const bytes = regular(APP, file);
      if (!bytes || sha(bytes) !== digest) fail("live_runtime_changed");
    }
    if (sha(fs.readFileSync(LOADER)) !== LOADER_HASH) fail("gateway_loader_changed");
  }
  function sources(expectedHead, target) {
    if (git(["rev-parse", "HEAD"]) !== expectedHead ||
        git(["status", "--porcelain", "--untracked-files=no"])) fail("production_sources_changed");
    for (const f of manifest.files) {
      const actual = regular(APP, f.path), digest = target ? f.sha256 : f.baseSha256;
      if (digest === null ? actual !== null : actual === null || sha(actual) !== digest)
        fail("production_source_conflict");
    }
  }
  function verifyStage() {
    const stat = fs.lstatSync(STAGE);
    if (stat.uid !== 0 || (stat.mode & 0o777) !== 0o700 || stat.isSymbolicLink() ||
        fs.realpathSync(STAGE) !== STAGE) fail("stage_privacy_invalid");
    validatePrepared(manifest, JSON.parse(fs.readFileSync(STAGE + "/prepared.json", "utf8")));
    for (const [file, digest] of Object.entries(BUILT)) {
      const bytes = regular(stageSource, file);
      if (!bytes || sha(bytes) !== digest) fail("prepared_build_changed");
    }
    for (const f of manifest.files.filter(f => !f.path.startsWith("docs/"))) {
      const actual = regular(stageSource, f.path);
      if (!actual || sha(actual) !== f.sha256) fail("prepared_source_changed");
    }
  }
  async function readSettings() {
    const result = await db.query("SELECT value FROM ai_router_configuration WHERE singleton=true");
    if (result.rows.length !== 1) fail("ai_configuration_unavailable");
    return result.rows[0].value;
  }
  async function healthy(indexHash, wait = false) {
    const deadline = Date.now() + (wait ? 180000 : 10000); let stable = 0;
    do {
      try {
        const p = processInfo();
        const root = await httpRead("/");
        const auth = await httpRead("/api/call-logs/browse");
        const config = await httpRead("/api/configurator/ai");
        if (root.status === 200 && sha(root.body) === indexHash && auth.status === 401 &&
            config.status === 401 && (!wait || p.pid !== oldPid)) {
          if (++stable >= (wait ? 3 : 1)) return p.pid;
        } else stable = 0;
      } catch { stable = 0; }
      if (!wait) break;
      await new Promise(resolve => setTimeout(resolve, 2000));
    } while (Date.now() < deadline);
    fail("application_health_failed");
  }
  function atomicCopy(from, relative, metadata) {
    const to = path.join(APP, relative), parent = path.dirname(to);
    fs.mkdirSync(parent, { recursive: true, mode: 0o755 });
    if (fs.lstatSync(parent).isSymbolicLink() || fs.realpathSync(parent) !== parent)
      fail("runtime_destination_symlink");
    const tmp = path.join(parent, "ai-release-" + crypto.randomUUID() + ".tmp");
    try {
      fs.copyFileSync(from, tmp, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(tmp, metadata?.mode ?? 0o644);
      fs.chownSync(tmp, metadata?.uid ?? user.uid, metadata?.gid ?? user.gid);
      fs.renameSync(tmp, to);
    } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  }
  function privateDenied(directory) {
    const canary = path.join(directory, "privacy-canary.txt");
    fs.writeFileSync(canary, crypto.randomUUID(), { mode: 0o600 });
    const code = 'try{require("fs").readFileSync(process.argv[1]);process.exit(74)}catch(e){process.exit(e.code==="EACCES"?0:75)}';
    const result = cp.spawnSync("runuser", ["-u", "seman", "--", process.execPath, "-e", code, canary],
      { env: cleanEnv(process.env), stdio: "ignore", timeout: 10000 });
    if (result.status !== 0) fail("backup_readable_by_application");
  }
  return {
    state,
    phase: async value => {
      phase = value; state.phase = value;
      console.log("PHASE=" + value);
      if (journal) fs.appendFileSync(journal, JSON.stringify({ phase: value, at: new Date().toISOString() }) + "\n");
    },
    preflight: async () => {
      if (process.getuid() !== 0 || os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01")
        fail("root_on_corpcrm01_required");
      const mounts = JSON.parse(run("findmnt", ["--json", "--target", DATA, "--output", "SOURCE,TARGET"])).filesystems;
      if (mounts?.length !== 1 || mounts[0].target !== DATA ||
          fs.realpathSync(mounts[0].source) !== fs.realpathSync("/dev/sdb1")) fail("approved_data_volume_required");
      for (let dir = DATA; dir !== path.dirname(dir); dir = path.dirname(dir))
        if (fs.existsSync(path.join(dir, "PG_VERSION")) && fs.existsSync(path.join(dir, "global", "pg_control")))
          fail("backup_path_inside_postgresql_cluster");
      verifyStage();
      if (git(["rev-parse", `${TARGET}^{tree}`]) !== TREE || git(["rev-parse", `${TARGET}^`]) !== BASE)
        fail("release_identity_invalid");
      if (JSON.stringify(git(["diff", "--name-only", BASE, TARGET]).split("\n").sort()) !==
          JSON.stringify(manifest.files.map(f => f.path).sort())) fail("release_scope_mismatch");
      const account = run("getent", ["passwd", "seman"]).trim().split(":");
      user = { uid: Number(account[2]), gid: Number(account[3]), home: account[5] };
      if (user.uid !== 1001 || !user.home?.startsWith("/")) fail("application_account_changed");
      pm2 = run("runuser", ["-l", "seman", "-c", "command -v pm2"]).trim();
      if (!pm2.startsWith("/") || pm2.includes("\n")) fail("pm2_command_unavailable");
      oldPid = processInfo(958103).pid;
      sources(BASE, false); protectedRuntime(OLD);
      await healthy(OLD["dist/public/index.html"]);
      const inherited = fs.readFileSync(`/proc/${oldPid}/environ`, "utf8").split("\0");
      let connection = inherited.find(s => s.startsWith("DATABASE_URL="))?.slice(13);
      if (!connection) {
        const bytes = regular(APP, ".env");
        if (bytes) connection = appRequire("dotenv").parse(bytes).DATABASE_URL;
      }
      if (!connection) fail("database_configuration_missing");
      nativeEnv = nativeEnvironment(connection, process.env);
      const { Client } = appRequire("pg");
      db = new Client({ connectionString: connection, connectionTimeoutMillis: 10000,
        statement_timeout: 20000, options: "-c default_transaction_read_only=on" });
      await db.connect();
      beforeSettings = await readSettings();
      const mode = inherited.find(s => s.startsWith("INDEXUS_AI_ROUTER_MODE="))?.split("=")[1];
      assertOfflineSafe(beforeSettings, mode);
      state.settingsSha256 = settingsHash(beforeSettings);
      databaseBytes = Number((await db.query("SELECT pg_database_size(current_database()) AS bytes")).rows[0].bytes);
      runtimeBefore = inventory(APP + "/dist");
      buildFiles = inventory(stageSource + "/dist");
      for (const f of buildFiles.filter(f => !["index.cjs", "ai-worker.cjs", "public/index.html"].includes(f.path))) {
        const existing = regular(APP + "/dist", f.path);
        if (existing && sha(existing) !== f.sha256) fail("immutable_asset_collision");
      }
      const space = fs.statfsSync(DATA), bytes = space.bsize * space.bavail;
      const runtimeBytes = runtimeBefore.reduce((n, f) => n + f.bytes, 0);
      if (!Number.isSafeInteger(databaseBytes) || databaseBytes <= 0 ||
          bytes < databaseBytes * 2 + runtimeBytes * 3 + 2 * 1024 ** 3) fail("backup_capacity_insufficient");
    },
    backup: async () => {
      backup = fs.mkdtempSync(DATA + "/ai-services-backup-");
      fs.chmodSync(backup, 0o700);
      privateDenied(backup); privateDenied(STAGE);
      state.backupDirectory = backup;
      journal = path.join(backup, "phases.jsonl");
      fs.writeFileSync(journal, "", { mode: 0o600 });
      fs.cpSync(APP + "/dist", backup + "/dist", { recursive: true, dereference: false });
      for (const f of runtimeBefore)
        if (sha(fs.readFileSync(path.join(backup, "dist", f.path))) !== f.sha256) fail("runtime_backup_mismatch");
      fs.writeFileSync(backup + "/runtime-manifest.json", JSON.stringify(runtimeBefore), { mode: 0o600 });
      const archive = fs.openSync(backup + "/source.tar", "wx", 0o600);
      try { run("git", ["-c", `safe.directory=${APP}`, "-C", APP, "archive", BASE,
        ...manifest.files.filter(f => f.baseSha256 !== null).map(f => f.path)],
        { stdio: ["ignore", archive, "pipe"], timeout: 120000 }); }
      finally { fs.closeSync(archive); }
      run("tar", ["-tf", backup + "/source.tar"]);
      fs.mkdirSync(backup + "/source", { mode: 0o700 });
      run("tar", ["-xf", backup + "/source.tar", "-C", backup + "/source"]);
      for (const f of manifest.files.filter(f => f.baseSha256 !== null))
        if (sha(fs.readFileSync(path.join(backup, "source", f.path))) !== f.baseSha256)
          fail("source_backup_mismatch");
      for (const [from, to] of [[APP + "/.env", "application.env"], [LOADER, "preload.cjs"]]) {
        if (fs.existsSync(from)) { fs.copyFileSync(from, backup + "/" + to); fs.chmodSync(backup + "/" + to, 0o600); }
      }
      const log = fs.openSync(backup + "/database-backup.log", "wx", 0o600);
      try {
        phase = state.phase = "database_dump";
        fs.appendFileSync(journal, JSON.stringify({ phase, at: new Date().toISOString() }) + "\n");
        console.log("PHASE=" + phase);
        run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--no-password",
          "--file", backup + "/database.dump"], { env: nativeEnv, timeout: 3600000, stdio: ["ignore", "ignore", log] });
        run("pg_restore", ["--list", backup + "/database.dump"],
          { env: nativeEnv, timeout: 120000, stdio: ["ignore", "ignore", log] });
        run("pg_restore", ["--file=/dev/null", backup + "/database.dump"],
          { env: nativeEnv, timeout: 3600000, stdio: ["ignore", "ignore", log] });
      } finally { fs.closeSync(log); }
      fs.chmodSync(backup + "/database.dump", 0o600);
      if (fs.statSync(backup + "/database.dump").size <= 5) fail("database_backup_empty");
      fs.writeFileSync(backup + "/backup-validated.json", JSON.stringify({
        productionBase: BASE, runtimeFiles: runtimeBefore.length, databaseBytes,
        dumpBytes: fs.statSync(backup + "/database.dump").size, dumpSha256: await hashFile(backup + "/database.dump"),
        archiveListed: true, archiveFullyDecoded: true, checkedAt: new Date().toISOString(),
      }, null, 2), { mode: 0o600 });
      state.backupValidated = true;
      console.log("BACKUP_VALIDATED");
    },
    recheck: async () => {
      sources(BASE, false); protectedRuntime(OLD); verifyStage(); processInfo(oldPid);
      if (settingsHash(await readSettings()) !== state.settingsSha256) fail("ai_configuration_changed");
    },
    source: async () => {
      gitUser(["merge", "--ff-only", "--no-edit", TARGET]); sources(TARGET, true);
    },
    runtime: async () => {
      for (const f of buildFiles.filter(f => !["index.cjs", "ai-worker.cjs", "public/index.html"].includes(f.path))) {
        const existing = regular(APP + "/dist", f.path);
        if (existing && sha(existing) !== f.sha256) fail("immutable_asset_collision");
        if (!existing) atomicCopy(path.join(stageSource, "dist", f.path), "dist/" + f.path);
      }
      // Publish immutable assets first; switch backend/worker and entry HTML atomically.
      for (const name of ["ai-worker.cjs", "index.cjs", "public/index.html"])
        atomicCopy(path.join(stageSource, "dist", name), "dist/" + name);
      for (const f of buildFiles)
        if (sha(regular(APP + "/dist", f.path)) !== f.sha256) fail("published_runtime_mismatch");
    },
    restart: async () => { asUser(pm2, ["restart", "4"]); },
    verify: async () => {
      state.pid = await healthy(BUILT["dist/public/index.html"], true);
      protectedRuntime(BUILT); sources(TARGET, true);
      if (settingsHash(await readSettings()) !== state.settingsSha256) fail("ai_configuration_changed");
      const result = await db.query(`SELECT
        to_regclass('public.ai_jobs') IS NOT NULL AS jobs,
        to_regclass('public.ai_inference_jobs') IS NOT NULL AS inference,
        to_regclass('public.ai_inference_workers') IS NOT NULL AS workers,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
          AND table_name='task_ai_checklist_generations' AND column_name='ai_job_id') AS checklist`);
      if (!Object.values(result.rows[0] || {}).every(v => v === true) || Object.keys(result.rows[0] || {}).length !== 4)
        fail("ai_schema_not_ready");
      for (const f of runtimeBefore.filter(f => f.path.startsWith("public/assets/"))) {
        const bytes = regular(APP + "/dist", f.path);
        if (!bytes || sha(bytes) !== f.sha256) fail("previous_static_asset_lost");
      }
      state.schemaReady = true; state.providersUnchanged = true;
    },
    success: async () => {
      state.mode = "deployed_worker_off";
      fs.writeFileSync(backup + "/deployment-result.json", JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
      console.log(JSON.stringify(state, null, 2));
    },
    rollback: async ({ runtimeAttempted }) => {
      let sourceOk = true;
      const head = git(["rev-parse", "HEAD"]);
      if (head === TARGET) {
        try { sources(TARGET, true); gitUser(["reset", "--keep", BASE]); sources(BASE, false); }
        catch { sourceOk = false; }
      } else if (head !== BASE) sourceOk = false;
      if (runtimeAttempted) {
        for (const name of ["index.cjs", "ai-worker.cjs", "public/index.html"]) {
          const old = runtimeBefore.find(f => f.path === name);
          if (old) atomicCopy(path.join(backup, "dist", name), "dist/" + name, old);
          else if (name === "ai-worker.cjs") {
            const actual = regular(APP + "/dist", name);
            if (actual && sha(actual) === BUILT["dist/" + name]) fs.unlinkSync(APP + "/dist/" + name);
          }
        }
        asUser(pm2, ["restart", "4"]);
        await healthy(OLD["dist/public/index.html"], true);
        protectedRuntime(OLD);
      }
      if (!sourceOk) fail("source_rollback_conflict");
      state.mode = "failed_previous_runtime_restored";
      state.schemaMayHaveAdditions = runtimeAttempted;
      fs.writeFileSync(backup + "/rollback-result.json", JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
      console.log(JSON.stringify(state, null, 2));
    },
    close: async () => { if (db) await db.end().catch(() => {}); },
    failure: error => ({ mode: state.mode || "deployment_stopped", phase,
      code: error.safeCode || "operator_operation_failed",
      ...(error.serviceIds ? { activeServiceIds: error.serviceIds } : {}),
      backupDirectory: backup || null, backupValidated: state.backupValidated,
      rollbackFailed: error.rollbackFailed === true, databaseRestored: false,
      workerStarted: false, providersActivated: false }),
  };
}
async function main(args) {
  if (args.length !== 3 || args[0] !== "--apply" || args[1] !== TARGET)
    fail("use_apply_pinned_release_and_manifest");
  if (process.getuid() !== 0 || os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01")
    fail("root_on_corpcrm01_required");
  const manifest = JSON.parse(fs.readFileSync(args[2], "utf8"));
  const ops = productionOperations(manifest);
  // The lock is on the approved data disk; never create it before verifying the mount.
  const mount = JSON.parse(run("findmnt", ["--json", "--target", DATA, "--output", "SOURCE,TARGET"])).filesystems;
  if (mount?.length !== 1 || mount[0].target !== DATA ||
      fs.realpathSync(mount[0].source) !== fs.realpathSync("/dev/sdb1")) fail("approved_data_volume_required");
  const lock = DATA + "/ai-services-deployment-lock";
  try { fs.mkdirSync(lock, { mode: 0o700 }); }
  catch { fail("deployment_lock_exists"); }
  try { await orchestrate(ops); }
  catch (error) { console.log(JSON.stringify(ops.failure(error), null, 2)); process.exitCode = 2; }
  finally { await ops.close(); fs.rmdirSync(lock); }
}
module.exports = { BASE, TARGET, TREE, BUILT, OLD, nativeEnvironment, canonical,
  settingsHash, assertOfflineSafe, validatePrepared, orchestrate, productionOperations, main };
if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.log(JSON.stringify({ mode: "deployment_refused", code: error.safeCode || "operator_unavailable",
    workerStarted: false, providersActivated: false, databaseRestored: false }));
  process.exitCode = 2;
});
