"use strict";
// Approved backup and read-only cutover inventory. No deployment mode.
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const os = require("node:os");
const { createRequire } = require("node:module");
const APP = "/var/www/indexus-crm", DATA = APP + "/data";
const BASE = "def0850154852b344bcdc9f4c9052e91887d15a1";
const TARGET = "3a1406b7d5c05f29fc5107a7a34a1032c0079ae8";
const TREE = "c7b06be1ad4e016fb49fa079be0b6c23e8961294";
const STAGE = DATA + "/ai-maintenance-stage-0cqk8a";
const LOADER = "/etc/indexus-ai-runtime/preload.cjs";
const BUILT = {
  "dist/index.cjs": "431db012803076a3dd740af21d325374afca3c5062c2ff01810a24d0eb4b8f9d",
  "dist/ai-worker.cjs": "df5d5c4b135ce2a67162395633327caaf920514220d4b858664c35d89cf3ba80",
  "dist/public/index.html": "2b40e282ef7f6101d87e65894fc74a6c040aa0aab894f9ba9e0592a1a17ec39d",
};
const INPUTS = ["client", "server", "shared", "script", "ops", "package.json", "package-lock.json",
  "tsconfig.json", "vite.config.ts", "postcss.config.js", "tailwind.config.ts", "components.json"];
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw Object.assign(new Error(code), { safeCode: code }); };
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") return Object.fromEntries(
    Object.keys(v).sort().map(k => [k, canonical(v[k])]));
  return v;
}
const fingerprint = v => sha(Buffer.from(JSON.stringify(canonical(v))));
function safeEnvironment(source = {}) {
  return Object.fromEntries(["PATH", "HOME", "LANG", "LC_ALL", "TZ"]
    .filter(key => typeof source[key] === "string").map(key => [key, source[key]]));
}
function nativeEnvironment(connection, inherited = {}) {
  let u;
  try { u = new URL(connection); } catch { fail("database_configuration_invalid"); }
  if (!["postgres:", "postgresql:"].includes(u.protocol) || !u.hostname || !u.username ||
      !u.pathname.slice(1) || u.hash) fail("database_configuration_incomplete");
  const env = { ...safeEnvironment(inherited), PGCONNECT_TIMEOUT: "10",
    PGHOST: u.hostname.replace(/^\[|\]$/g, ""), PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)) };
  const options = { sslmode: "PGSSLMODE", sslcert: "PGSSLCERT", sslkey: "PGSSLKEY",
    sslrootcert: "PGSSLROOTCERT", sslcrl: "PGSSLCRL", gssencmode: "PGGSSENCMODE",
    connect_timeout: "PGCONNECT_TIMEOUT", options: "PGOPTIONS", application_name: "PGAPPNAME",
    channel_binding: "PGCHANNELBINDING", ssl_min_protocol_version: "PGSSLMINPROTOCOLVERSION" };
  const seen = new Set();
  for (const [key, value] of u.searchParams) {
    if (!options[key] || seen.has(key)) fail("database_url_parameter_unsupported");
    seen.add(key); env[options[key]] = value;
  }
  env.PGOPTIONS = (env.PGOPTIONS ? env.PGOPTIONS + " " : "") + "-c default_transaction_read_only=on";
  return env;
}
async function hashFile(file) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
function validatePrepared(p) {
  if (p?.mode !== "prepared_not_deployed" || p.productionBase !== BASE || p.sourceCommit !== TARGET ||
      p.sourceTree !== TREE || p.stageDirectory !== STAGE ||
      Object.keys(p.outputs || {}).sort().join() !== Object.keys(BUILT).sort().join() ||
      !Array.isArray(p.unchangedProcesses) || !p.unchangedProcesses.some(x => x.role === "api") ||
      !p.unchangedProcesses.some(x => x.role === "worker")) fail("prepared_identity_changed");
  for (const [file, expected] of Object.entries(BUILT))
    if (p.outputs[file]?.sha256 !== expected || !(p.outputs[file]?.bytes > 0)) fail("prepared_build_changed");
}
function inventory(root, prefix = "") {
  const result = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name), file = path.join(root, relative);
    if (entry.isSymbolicLink()) fail("runtime_symlink");
    if (entry.isDirectory()) result.push(...inventory(root, relative));
    else if (entry.isFile()) {
      const s = fs.statSync(file);
      result.push({ path: relative, bytes: s.size, sha256: sha(fs.readFileSync(file)),
        mode: s.mode & 0o777, uid: s.uid, gid: s.gid });
    } else fail("runtime_file_type_invalid");
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}
const contentInventory = entries => entries.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }));
function processDescription(p) {
  const e = p.pm2_env;
  if (!e || !Number.isInteger(p.pm_id) || !(p.pid > 0) || e.status !== "online" ||
      e.pm_cwd !== APP || e.exec_mode !== "fork_mode" ||
      ![APP + "/dist/index.cjs", APP + "/dist/ai-worker.cjs"].includes(e.pm_exec_path))
    fail("pm2_process_identity_invalid");
  const worker = e.pm_exec_path.endsWith("/ai-worker.cjs");
  if (p.name !== (worker ? "indexus-ai-worker" : "indexus-crm") ||
      worker && JSON.stringify(e.args) !== JSON.stringify(["--run"])) fail("pm2_process_identity_invalid");
  const nodeArgs = e.node_args ?? [];
  const preloadOptions = e.NODE_OPTIONS || e.env?.NODE_OPTIONS || "";
  const configured = [Array.isArray(nodeArgs) ? nodeArgs.join(" ") : nodeArgs, preloadOptions]
    .filter(x => typeof x === "string").join(" ").split(/[ \t=]+/).includes(LOADER);
  const spec = { id: p.pm_id, name: p.name, role: worker ? "worker" : "api", cwd: e.pm_cwd,
    script: e.pm_exec_path, interpreter: e.exec_interpreter, args: e.args || [], nodeArgs, preloadOptions,
    killTimeoutMs: Number(e.kill_timeout ?? 1600), mode: e.exec_mode, instances: e.instances,
    autorestart: e.autorestart, watch: e.watch };
  const { args, nodeArgs: unusedNodeArgs, preloadOptions: unusedPreload, ...publicSpec } = spec;
  return { ...publicSpec, pid: p.pid, preloadConfigured: configured,
    specificationSha256: fingerprint(spec) };
}
async function sequence(ops) {
  await ops.preflight();
  await ops.backup();
  await ops.verify();
  return ops.success();
}
async function main(args, helpers) {
  if (args.length !== 1 || args[0] !== "--backup") fail("usage_backup_only");
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid() !== 0)
    fail("root_on_corpcrm01_required");
  if (!helpers || helpers.BASE !== BASE || helpers.TARGET !== TARGET || helpers.TREE !== TREE ||
      typeof helpers.applicationProcesses !== "function") fail("verified_stage_helper_required");
  const env = safeEnvironment(process.env);
  const run = (bin, argv, extra = {}) => cp.execFileSync(bin, argv, {
    encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"], env, ...extra,
  });
  const git = argv => run("git", ["--no-optional-locks", "-c", "core.fsmonitor=false",
    "-c", `safe.directory=${APP}`, "-C", APP, ...argv]).trim();
  const blob = (ref, file) => run("git", ["--no-optional-locks", "-c", `safe.directory=${APP}`,
    "-C", APP, "show", `${ref}:${file}`], { encoding: null });
  const regular = helpers.regular;
  let db, directory, phase = "preflight", locked = false, nativeEnv, settings, dbIdentity;
  let processes, prepared, runtime, loaderHash, envFileHash, pm2Before, pm2, account, row, dumpHash;
  let queueInventory, queueInventoryCapturedAt, maintenanceBefore, activeWorkers, nativeIdentityVerified = false;
  const mount = () => helpers.assertMount(JSON.parse(run("findmnt", [
    "--json", "--target", DATA, "--output", "SOURCE,TARGET",
  ])).filesystems);
  mount();
  const lock = DATA + "/ai-services-deployment-lock";
  try { fs.mkdirSync(lock, { mode: 0o700 }); locked = true; }
  catch { fail("deployment_lock_exists"); }
  function log(value) { phase = value; console.log("PHASE=" + value); }
  function denied(root) {
    const stat = fs.lstatSync(root);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== 0 ||
        (stat.mode & 0o777) !== 0o700 || fs.realpathSync(root) !== root) fail("private_directory_invalid");
    for (const uid of new Set([1001, 33])) for (const access of ["-r", "-x"]) {
      const p = cp.spawnSync("setpriv", [`--reuid=${uid}`, `--regid=${uid}`, "--clear-groups",
        "/usr/bin/test", access, root], { env, stdio: "ignore", timeout: 10000 });
      if (p.status !== 1) fail("private_directory_access_not_verified");
    }
  }
  function baseline() {
    mount(); denied(STAGE);
    if (git(["rev-parse", "HEAD"]) !== BASE ||
        git(["status", "--porcelain", "--untracked-files=no"])) fail("production_sources_changed");
    helpers.validateScope(git(["rev-parse", TARGET + "^"]), git(["rev-parse", TARGET + "^{tree}"]),
      git(["diff", "--name-only", BASE, TARGET]).split("\n").filter(Boolean));
    const tracked = new Set(git(["ls-tree", "-r", "--name-only", BASE]).split("\n"));
    for (const file of [...helpers.FILES, "package.json", "package-lock.json", "script/build.ts",
      "server/index.ts", "server/ai-worker.ts", "server/routes.ts"]) {
      const bytes = regular(APP, file, true);
      if (tracked.has(file) ? !bytes || sha(bytes) !== sha(blob(BASE, file)) : bytes !== null)
        fail("production_source_conflict");
    }
    for (const [file, digest] of Object.entries(helpers.RUNTIME))
      if (sha(regular(APP, file)) !== digest) fail("production_runtime_changed");
    for (const [file, digest] of Object.entries(BUILT))
      if (sha(regular(STAGE + "/source", file)) !== digest) fail("prepared_build_changed");
    for (const file of helpers.FILES)
      if (sha(regular(STAGE + "/source", file)) !== sha(blob(TARGET, file))) fail("prepared_source_changed");
    helpers.assertProcessSnapshot(prepared.unchangedProcesses, helpers.applicationProcesses());
  }
  function asUser(bin, argv) {
    return run("runuser", ["-u", "seman", "--", bin, ...argv],
      { env: { ...env, HOME: account.home, PM2_HOME: account.home + "/.pm2" } });
  }
  function pm2Inventory() {
    const daemon = regular(account.home, ".pm2/pm2.pid").toString().trim();
    if (!/^\d+$/.test(daemon)) fail("pm2_daemon_identity_invalid");
    const status = fs.readFileSync(`/proc/${daemon}/status`, "utf8");
    if (!/^Uid:\s+1001\s+1001\s+1001\s+1001\s*$/m.test(status)) fail("pm2_daemon_owner_changed");
    const sock = fs.lstatSync(account.home + "/.pm2/rpc.sock");
    if (!sock.isSocket() || sock.uid !== 1001) fail("pm2_socket_not_verified");
    const all = JSON.parse(asUser(pm2, ["jlist"]));
    const selected = all.filter(p => [APP + "/dist/index.cjs", APP + "/dist/ai-worker.cjs"]
      .includes(p.pm2_env?.pm_exec_path));
    if (selected.length !== 2) fail("pm2_inventory_ambiguous");
    const descriptions = selected.map(processDescription).sort((a, b) => a.role.localeCompare(b.role));
    if (!descriptions.some(p => p.role === "api") || !descriptions.some(p => p.role === "worker"))
      fail("pm2_inventory_ambiguous");
    for (const p of descriptions) {
      if (processes.find(x => x.role === p.role)?.pid !== p.pid ||
          Number(/^PPid:\s+(\d+)/m.exec(fs.readFileSync(`/proc/${p.pid}/status`, "utf8"))?.[1]) !== +daemon)
        fail("pm2_process_parent_changed");
    }
    return { daemonPid: +daemon, processes: descriptions };
  }
  async function readSettings() {
    const rows = (await db.query("SELECT version,value FROM ai_router_configuration WHERE singleton=true")).rows;
    if (rows.length !== 1) fail("ai_configuration_unavailable");
    return fingerprint(rows[0]);
  }
  try {
    return await sequence({
      preflight: async () => {
        log("preflight");
        prepared = JSON.parse(regular(STAGE, "prepared.json"));
        validatePrepared(prepared); processes = helpers.applicationProcesses(); baseline();
        const user = run("getent", ["passwd", "seman"]).trim().split(":");
        account = { uid: +user[2], gid: +user[3], home: user[5] };
        if (account.uid !== 1001 || !path.isAbsolute(account.home || "")) fail("application_account_changed");
        pm2 = run("runuser", ["-l", "seman", "-c", "command -v pm2"]).trim();
        if (!path.isAbsolute(pm2) || pm2.includes("\n")) fail("pm2_command_unavailable");
        pm2Before = pm2Inventory();
        const preload = fs.lstatSync(LOADER);
        if (!preload.isFile() || preload.isSymbolicLink() || preload.uid !== 0 || preload.mode & 0o022)
          fail("runtime_preload_not_verified");
        loaderHash = sha(fs.readFileSync(LOADER));
        const envBytes = regular(APP, ".env", true);
        envFileHash = envBytes ? sha(envBytes) : null;
        const req = createRequire(APP + "/package.json");
        const api = processes.find(p => p.role === "api");
        const inherited = fs.readFileSync(`/proc/${api.pid}/environ`, "utf8").split("\0");
        let connection = inherited.find(v => v.startsWith("DATABASE_URL="))?.slice(13);
        if (!connection) {
          const bytes = regular(APP, ".env", true);
          const line = bytes?.toString().split(/\r?\n/).find(x => x.startsWith("DATABASE_URL="));
          connection = req("dotenv").parse(line || "").DATABASE_URL;
        }
        if (!connection) fail("database_configuration_missing");
        nativeEnv = nativeEnvironment(connection, process.env);
        const { Client } = req("pg");
        db = new Client({ connectionString: connection, connectionTimeoutMillis: 10000,
          statement_timeout: 20000, options: "-c default_transaction_read_only=on" });
        db.on("error", () => {}); // Suppress raw errors; all operations still reject.
        await db.connect();
        row = (await db.query(`SELECT current_database() AS database,current_user AS role,
          inet_server_addr()::text AS address,inet_server_port() AS port,
          pg_database_size(current_database())::text AS bytes`)).rows[0];
        dbIdentity = fingerprint({ ...row, bytes: undefined });
        const nativeRow = JSON.parse(run("psql", ["-X", "--no-password", "--tuples-only", "--no-align",
          "-v", "ON_ERROR_STOP=1", "-c", `SELECT json_build_object('database',current_database(),
            'role',current_user,'address',inet_server_addr()::text,'port',inet_server_port())`],
          { env: nativeEnv }).trim());
        if (fingerprint(nativeRow) !== dbIdentity) fail("native_database_identity_mismatch");
        nativeIdentityVerified = true;
        settings = await readSettings();
        queueInventory = (await db.query(`SELECT 'jobs' AS queue,status,count(*)::int AS count
          FROM ai_jobs GROUP BY status UNION ALL
          SELECT 'inference',status,count(*)::int FROM ai_inference_jobs GROUP BY status
          ORDER BY queue,status`)).rows;
        if (queueInventory.some(r => !["jobs", "inference"].includes(r.queue) ||
            !["pending", "processing", "completed", "failed"].includes(r.status) ||
            !Number.isSafeInteger(r.count) || r.count < 0)) fail("queue_inventory_invalid");
        queueInventoryCapturedAt = new Date().toISOString();
        const exists = (await db.query("SELECT to_regclass('public.ai_queue_maintenance') IS NOT NULL AS present")).rows[0];
        maintenanceBefore = exists?.present ? {
          exists: true, stateSha256: fingerprint((await db.query(
            "SELECT to_jsonb(m) AS state FROM ai_queue_maintenance m WHERE scope='internal-gateway'")).rows),
        } : { exists: false };
        runtime = inventory(APP + "/dist");
        const available = fs.statfsSync(DATA);
        if (!(Number(row?.bytes) > 0) ||
            available.bsize * available.bavail < Number(row.bytes) * 2 +
              runtime.reduce((n, f) => n + f.bytes, 0) * 3 + 2 * 1024 ** 3)
          fail("backup_space_insufficient");
        for (let parent = DATA; parent !== path.dirname(parent); parent = path.dirname(parent))
          if (fs.existsSync(parent + "/PG_VERSION") && fs.existsSync(parent + "/global/pg_control"))
            fail("backup_path_inside_database_cluster");
        run("pg_dump", ["--version"]); run("pg_restore", ["--version"]);
      },
      backup: async () => {
        log("private_code_backup"); mount();
        directory = fs.mkdtempSync(DATA + "/ai-maintenance-backup-");
        fs.chmodSync(directory, 0o700); denied(directory);
        fs.cpSync(APP + "/dist", directory + "/dist", { recursive: true, dereference: false });
        if (fingerprint(contentInventory(inventory(directory + "/dist"))) !== fingerprint(contentInventory(runtime)))
          fail("runtime_backup_mismatch");
        const archive = fs.openSync(directory + "/source.tar", "wx", 0o600);
        try { run("git", ["--no-optional-locks", "-c", `safe.directory=${APP}`, "-C", APP,
          "archive", BASE, ...INPUTS], { stdio: ["ignore", archive, "pipe"], timeout: 120000 }); }
        finally { fs.closeSync(archive); }
        run("tar", ["-tf", directory + "/source.tar"]);
        for (const [from, name] of [[APP + "/.env", "application.env"], [LOADER, "preload.cjs"],
          [account.home + "/.pm2/dump.pm2", "dump.pm2"],
          [account.home + "/.pm2/dump.pm2.bak", "dump.pm2.bak"]]) {
          if (!fs.existsSync(from)) continue;
          if (!fs.lstatSync(from).isFile() || fs.lstatSync(from).isSymbolicLink()) fail("backup_source_not_regular");
          fs.copyFileSync(from, directory + "/" + name);
          fs.chmodSync(directory + "/" + name, 0o600);
          if (sha(fs.readFileSync(from)) !== sha(fs.readFileSync(directory + "/" + name)))
            fail("configuration_backup_mismatch");
        }
        fs.writeFileSync(directory + "/runtime-manifest.json", JSON.stringify(runtime, null, 2) + "\n",
          { mode: 0o600 });
        log("database_dump");
        const logfd = fs.openSync(directory + "/database-backup.log", "wx", 0o600);
        try {
          run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--no-password",
            "--file", directory + "/database.dump"],
            { env: nativeEnv, timeout: 3600000, stdio: ["ignore", "ignore", logfd] });
          log("database_archive_validation");
          run("pg_restore", ["--list", directory + "/database.dump"],
            { env: nativeEnv, timeout: 120000, stdio: ["ignore", "ignore", logfd] });
          run("pg_restore", ["--file=/dev/null", directory + "/database.dump"],
            { env: nativeEnv, timeout: 3600000, stdio: ["ignore", "ignore", logfd] });
        } finally { fs.closeSync(logfd); }
        fs.chmodSync(directory + "/database.dump", 0o600);
        if (fs.statSync(directory + "/database.dump").size <= 5) fail("database_backup_empty");
        dumpHash = await hashFile(directory + "/database.dump");
      },
      verify: async () => {
        log("recheck_live_application"); baseline(); denied(directory);
        if (fingerprint(pm2Before) !== fingerprint(pm2Inventory()) ||
            sha(fs.readFileSync(LOADER)) !== loaderHash ||
            settings !== await readSettings()) fail("live_configuration_changed");
        const bytes = regular(APP, ".env", true);
        if ((bytes ? sha(bytes) : null) !== envFileHash) fail("live_configuration_changed");
        if (fingerprint(inventory(APP + "/dist")) !== fingerprint(runtime))
          fail("live_runtime_changed");
        activeWorkers = (await db.query(`SELECT count(*)::int AS count FROM ai_inference_workers
          WHERE heartbeat_at > clock_timestamp() - interval '30 seconds'`)).rows[0]?.count;
        if (!Number.isSafeInteger(activeWorkers) || activeWorkers < 0) fail("worker_inventory_invalid");
      },
      success: async () => {
        const metadata = {
          mode: "backup_validated_not_deployed", productionBase: BASE, sourceCommit: TARGET,
          sourceTree: TREE, stageDirectory: STAGE, backupDirectory: directory,
          checkedAt: new Date().toISOString(), databaseIdentitySha256: dbIdentity,
          settingsSha256: settings, preloadSha256: loaderHash, applicationEnvSha256: envFileHash,
          nativeDatabaseIdentityVerified: nativeIdentityVerified, queueInventory, queueInventoryCapturedAt,
          maintenanceBefore, activeWorkersAtRecheck: activeWorkers,
          sourceArchiveSha256: await hashFile(directory + "/source.tar"),
          databaseDump: { bytes: fs.statSync(directory + "/database.dump").size, sha256: dumpHash,
            archiveListed: true, archiveFullyDecoded: true, restoredIntoDatabase: false },
          processes, pm2: pm2Before, outputs: prepared.outputs,
          backupValidated: true, liveApplicationChanged: false, workerRestarted: false,
          providersActivated: false, databaseSchemaChanged: false,
          workerGracefulStopBudgetSufficient: pm2Before.processes.find(p => p.role === "worker").killTimeoutMs >= 160000,
          gatewayDrain: "unverified", backendDrain: "unverified",
        };
        fs.writeFileSync(directory + "/backup-validated.json", JSON.stringify(metadata, null, 2) + "\n",
          { mode: 0o600 });
        console.log(JSON.stringify(metadata, null, 2));
        return metadata;
      },
    });
  } catch (e) {
    console.log(JSON.stringify({ mode: "backup_failed_no_deployment", phase,
      code: e.safeCode || "backup_operation_failed", ...(typeof e.code === "string" &&
        /^[A-Z0-9_]{3,32}$/.test(e.code) ? { diagnosticCode: e.code } : {}),
      backupDirectory: directory || null, liveApplicationChangedByThisTool: false, workerRestarted: false,
      providersActivated: false, databaseSchemaChanged: false }));
    throw Object.assign(Error("backup_stopped"), { alreadyReported: true });
  } finally {
    if (db) await db.end().catch(() => {});
    if (locked) fs.rmdirSync(lock);
  }
}
if (require.main === module) {
  console.error("use_verified_backup_bundle");
  process.exitCode = 2;
}
module.exports = { main, BASE, TARGET, TREE, BUILT, STAGE, LOADER, INPUTS, sha, fingerprint,
  safeEnvironment, nativeEnvironment, validatePrepared, inventory, contentInventory, processDescription, sequence };
