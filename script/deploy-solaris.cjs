"use strict";
// Operator-only, pinned release for CORPCRM01. Never restores business data.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const cp = require("node:child_process");

const ROOT = "/var/www/indexus-crm";
const DATA = ROOT + "/data";
const PMHOME = "/home/seman/.pm2";
const BASE = "35f585483d119e2f9a7a77e2aa13c22655a2b1d8";
const SOLARIS = "indexus-ai-solaris:v1";
const LEGACY = "indexus-document-audio:latest";
const SERVICES = Object.freeze(["email.translation", "email.reply", "email.compose"]);
const OLD = Object.freeze({
  "dist/index.cjs": "946a041a75bf6ab70e1bdc078124d5d3f26b9fefc62ff15d92fd1bec2ecdc40c",
  "dist/ai-worker.cjs": "6fc5c55a2669129f0442ff9fccdeef9b22262a89144e86e58002a2b71700bf37",
  "dist/public/index.html": "1e1768754e6b3c810017b9baa50617b56060c9b5d7c0e675bb37f5e6f7813d7f",
});
const FILES = Object.freeze([
  "client/src/components/configurator/AISettingsTab.tsx",
  "client/src/i18n/ai-settings-translations.ts",
  "server/lib/ai/admin-email-discovery.test.ts",
  "server/lib/ai/internal-contract.ts",
  "server/lib/ai/settings-check.ts",
  "server/lib/ai/settings-policy.ts",
  "server/lib/ai/settings.test.ts",
  "server/lib/ai/solaris-model.test.ts",
  "server/lib/ai/three-services.test.ts",
  "shared/ai-settings.ts",
  "script/deploy-solaris.cjs",
  "script/deploy-solaris.test.cjs",
  "docs/solaris-production.md",
]);
const TESTS = Object.freeze([
  "server/lib/ai/solaris-model.test.ts", "server/lib/ai/settings.test.ts",
  "server/lib/ai/admin-email-discovery.test.ts", "server/lib/ai/three-services.test.ts",
  "server/lib/ai/internal-adapter.test.ts",
  "server/lib/ai-jobs/inference.test.ts", "client/src/i18n/ai-settings-translations.test.ts",
]);
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const ensure = (value, code) => { if (!value) throw Error(code); };
const stable = value => Array.isArray(value) ? value.map(stable) :
  value && typeof value === "object" && !(value instanceof Date)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const identity = value => sha(JSON.stringify(stable(value)));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function releasePaths(actual) {
  ensure(identity([...actual].sort()) === identity([...FILES].sort()), "SOLARIS_RELEASE_SCOPE_CHANGED");
}
function planRoutes(row) {
  ensure(row?.version === 11 && row.value?.gateway?.enabled === true &&
    row.value.gateway.baseURL === "https://ai.cordbloodcenter.com/gateway/",
  "SOLARIS_CONFIGURATION_BASE_CHANGED");
  const routes = row.value.routes;
  ensure(routes && identity(Object.keys(routes).sort()) ===
    identity([...SERVICES, "email.monitoring"].sort()), "SOLARIS_ROUTE_SCOPE_CHANGED");
  for (const service of SERVICES)
    ensure(identity(routes[service]) === identity({ provider: "internal", model: LEGACY, enabled: true }),
      "SOLARIS_SOURCE_ROUTE_CHANGED");
  ensure(identity(routes["email.monitoring"]) === identity({
    provider: "internal", model: "indexus-email-monitoring:v1", enabled: true,
  }), "SOLARIS_MONITORING_ROUTE_CHANGED");
  const value = structuredClone(row.value);
  for (const service of SERVICES) value.routes[service].model = SOLARIS;
  return { value, version: row.version + 1 };
}
function validateSmoke(check, version) {
  ensure(check?.state === "ready" && check.kind === "smoke" && check.settingsVersion === version &&
    check.textVerified === true && check.jsonVerified === true &&
    Number.isFinite(Date.parse(check.checkedAt)) && Date.now() >= Date.parse(check.checkedAt) &&
    Date.now() - Date.parse(check.checkedAt) < 15 * 60000 &&
    check.models?.some(model => model.id === SOLARIS &&
      model.outputFormats.includes("text") && model.outputFormats.includes("json_object")),
  "SOLARIS_FRESH_CANONICAL_SMOKE_REQUIRED");
}
function noLinks(file) {
  let current = path.parse(path.resolve(file)).root;
  for (const part of path.resolve(file).slice(current.length).split(path.sep)) {
    current = path.join(current, part);
    ensure(!fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink(), "SOLARIS_SYMLINK_REFUSED");
  }
}
function privateDependencies(source, destination) {
  noLinks(source); noLinks(destination);
  fs.mkdirSync(destination, { mode: 0o700 });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    // Never share Vite/tsx caches or the node_modules container itself.
    if (entry.name.startsWith(".")) continue;
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.name.startsWith("@")) {
      ensure(entry.isDirectory(), "SOLARIS_DEPENDENCY_SCOPE_INVALID");
      fs.mkdirSync(to, { mode: 0o700 });
      for (const name of fs.readdirSync(from))
        fs.symlinkSync(path.join(from, name), path.join(to, name));
    } else fs.symlinkSync(from, to);
  }
}
function fingerprint(file) {
  noLinks(file);
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return { hash: null };
  ensure(stat.isFile(), "SOLARIS_REGULAR_FILE_REQUIRED");
  return { hash: sha(fs.readFileSync(file)), uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o777 };
}
function atomicCopy(source, target, expected, owner) {
  noLinks(source); noLinks(target);
  ensure(fingerprint(source).hash === expected, "SOLARIS_COPY_SOURCE_CHANGED");
  const temporary = path.join(path.dirname(target), "solaris-install-" + crypto.randomUUID());
  try {
    fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
    fs.chownSync(temporary, owner.uid, owner.gid); fs.chmodSync(temporary, owner.mode);
    ensure(fingerprint(temporary).hash === expected, "SOLARIS_COPY_HASH_CHANGED");
    const fd = fs.openSync(temporary, "r");
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, target);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function publishAssets(source, destination, owner) {
  const entries = [];
  const visit = (dir, relative = "") => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = path.join(relative, item.name), file = path.join(dir, item.name);
      noLinks(file);
      if (item.isDirectory()) visit(file, name);
      else {
        ensure(item.isFile(), "SOLARIS_ASSET_TYPE_REFUSED");
        if (name !== "index.html") entries.push({ name, file, hash: fingerprint(file).hash });
      }
    }
  };
  visit(source);
  // Validate every collision before publishing anything; retain all old assets.
  for (const entry of entries) {
    const old = fingerprint(path.join(destination, entry.name)).hash;
    ensure(old === null || old === entry.hash, "SOLARIS_ASSET_COLLISION");
  }
  for (const entry of entries) {
    const target = path.join(destination, entry.name);
    if (fingerprint(target).hash === entry.hash) continue;
    const missing = [];
    for (let dir = path.dirname(target); !fs.existsSync(dir); dir = path.dirname(dir)) missing.push(dir);
    for (const dir of missing.reverse()) {
      noLinks(dir); fs.mkdirSync(dir, { mode: 0o755 }); fs.chownSync(dir, owner.uid, owner.gid);
    }
    const temporary = path.join(path.dirname(target), "solaris-asset-" + crypto.randomUUID());
    try {
      fs.copyFileSync(entry.file, temporary, fs.constants.COPYFILE_EXCL);
      fs.chownSync(temporary, owner.uid, owner.gid); fs.chmodSync(temporary, 0o644);
      ensure(fingerprint(temporary).hash === entry.hash, "SOLARIS_ASSET_HASH_CHANGED");
      fs.linkSync(temporary, target);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
}
function nativeDatabaseEnvironment(urlString, base) {
  const url = new URL(urlString);
  ensure(["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.username && url.password && url.pathname === "/indexus_crm",
  "SOLARIS_LOCAL_DATABASE_IDENTITY_REQUIRED");
  const supported = new Set(["sslmode", "sslrootcert", "sslcert", "sslkey", "options",
    "application_name", "connect_timeout"]);
  ensure([...url.searchParams.keys()].every(key => supported.has(key)) &&
    [...supported].every(key => url.searchParams.getAll(key).length <= 1), "SOLARIS_DATABASE_OPTIONS_UNSUPPORTED");
  const env = { ...base, PGHOST: url.hostname.replace(/^\[|\]$/g, ""), PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGCONNECT_TIMEOUT: "10",
    PGAPPNAME: "indexus-solaris-private-backup", PGSSLMODE: "prefer" };
  for (const [key, value] of url.searchParams) {
    if (key === "sslmode") env.PGSSLMODE = value;
    else if (key === "sslrootcert") env.PGSSLROOTCERT = value;
    else if (key === "sslcert") env.PGSSLCERT = value;
    else if (key === "sslkey") env.PGSSLKEY = value;
    else if (key === "options") env.PGOPTIONS = value;
  }
  return env;
}
async function transaction(db, operation) {
  await db.query("BEGIN");
  try { const result = await operation(); await db.query("COMMIT"); return result; }
  catch (error) { await db.query("ROLLBACK").catch(() => {}); throw error; }
}
async function changeRoutes(db, before, smoke, action = "solaris_canonical_switch") {
  return transaction(db, async () => {
    const row = (await db.query("SELECT * FROM ai_router_configuration WHERE singleton=true FOR UPDATE")).rows[0];
    ensure(identity(row) === identity(before), "SOLARIS_CONCURRENT_CONFIGURATION_CHANGE");
    const next = planRoutes(row);
    validateSmoke(smoke, row.version);
    const carried = check => check && check.state !== "checking" ? { ...check, settingsVersion: next.version } : null;
    await db.query(`UPDATE ai_router_configuration SET version=$1,value=$2::jsonb,
      gateway_check=$3::jsonb,openai_check=$4::jsonb,updated_at=now() WHERE singleton=true AND version=$5`,
    [next.version, JSON.stringify(next.value), JSON.stringify(carried(smoke)),
      JSON.stringify(carried(row.openai_check)), row.version]);
    await db.query(`INSERT INTO ai_router_configuration_audit(actor_id,action,version,changes)
      VALUES($1,$2,$3,$4::jsonb)`, ["operator:solaris-canonical", action, next.version,
      JSON.stringify({ services: SERVICES, from: LEGACY, to: SOLARIS, gatewayUnchanged: true,
        monitoringUnchanged: true })]);
    return (await db.query("SELECT * FROM ai_router_configuration WHERE singleton=true")).rows[0];
  });
}
async function revertRoutes(db, after, before, onWrite = () => {}) {
  return transaction(db, async () => {
    const row = (await db.query("SELECT * FROM ai_router_configuration WHERE singleton=true FOR UPDATE")).rows[0];
    ensure(identity(row) === identity(after), "SOLARIS_ROLLBACK_CONFIGURATION_CHANGED");
    const version = row.version + 1;
    // Only restore this deployment's configuration, never business records or a DB dump.
    const carry = check => check && check.state !== "checking" ? { ...check, settingsVersion: version } : null;
    onWrite(); // After the locked comparison, before the first possible write.
    await db.query(`UPDATE ai_router_configuration SET version=$1,value=$2::jsonb,
      gateway_check=$3::jsonb,openai_check=$4::jsonb,updated_at=now() WHERE singleton=true`,
    [version, JSON.stringify(before.value), JSON.stringify(carry(before.gateway_check)),
      JSON.stringify(carry(before.openai_check))]);
    await db.query(`INSERT INTO ai_router_configuration_audit(actor_id,action,version,changes)
      VALUES($1,$2,$3,$4::jsonb)`, ["operator:solaris-canonical", "solaris_canonical_rollback", version,
      JSON.stringify({ services: SERVICES, from: SOLARIS, to: LEGACY, businessDataRestored: false })]);
    return (await db.query("SELECT * FROM ai_router_configuration WHERE singleton=true")).rows[0];
  });
}
async function guardedRecovery({ validate, stop, mutate, hasMutated, resume }) {
  // Routine conflicts must be rejected while production is still running.
  await validate();
  try {
    await stop();
    await validate(); // Catch edits made while the queue was draining.
    return await mutate();
  } catch (error) {
    if (!hasMutated()) await resume();
    throw error;
  }
}
async function main(args = process.argv.slice(2)) {
  const rollback = args[0] === "--rollback";
  ensure(args.length === 3 && (args[0] === "--apply" || rollback) &&
    args[2] === "--allow-restart" && (rollback ? path.isAbsolute(args[1]) : /^[a-f0-9]{40}$/.test(args[1])),
  "SOLARIS_EXPLICIT_PINNED_COMMAND_REQUIRED");
  ensure(process.getuid?.() === 0 && os.hostname().split(".")[0].toUpperCase() === "CORPCRM01",
    "SOLARIS_ROOT_ON_CORPCRM01_REQUIRED");
  process.umask(0o077);
  const lock = "/run/lock/indexus-solaris-deploy";
  let locked = false, privateRoot, db, phase = "preflight", mutated = false, stopped = false, gitChanged = false;
  let manifest, target, pmBinary, originals, originalConfig, afterConfig, expected, daemon;
  let buildView, buildMounted = false;
  const stoppedByAttempt = new Set();
  let resumedWithoutMutation = false;
  const env = { PATH: process.env.PATH, HOME: "/root", LANG: "C.UTF-8" };
  function run(bin, argv, options = {}) {
    try { return cp.execFileSync(bin, argv, { cwd: ROOT, env, encoding: "utf8", timeout: 120000,
      maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...options }); }
    catch (error) {
      if (privateRoot) fs.writeFileSync(privateRoot + "/command-failure.private.log",
        Buffer.concat([Buffer.from(error.stdout || ""), Buffer.from(error.stderr || "")]), { mode: 0o600 });
      throw Error("SOLARIS_COMMAND_FAILED_" + path.basename(bin).replace(/[^a-z0-9]/gi, "_").toUpperCase());
    }
  }
  const user = (bin, argv) => run("runuser", ["-u", "seman", "--", bin, ...argv],
    { env: { ...env, HOME: "/home/seman", PM2_HOME: PMHOME } });
  const git = argv => user("git", ["--no-optional-locks", "-c", "core.hooksPath=/dev/null",
    "-c", "core.fsmonitor=false", "-C", ROOT, ...argv]).trim();
  const blob = (pin, file) => run("git", ["-c", "safe.directory=" + ROOT, "-C", ROOT, "show", pin + ":" + file],
    { encoding: null });
  const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  const mark = name => { phase = name; console.log("SOLARIS_DEPLOY_PHASE " + name); };
  function sourceMatches(pin) {
    for (const file of [...FILES, "package.json", "package-lock.json", "script/build.ts",
      "server/ai-worker.ts", "server/routes.ts", "server/lib/ai/internal-adapter.ts"]) {
      const entry = git(["ls-tree", pin, "--", file]);
      const actual = fingerprint(ROOT + "/" + file).hash;
      ensure(entry ? actual === sha(blob(pin, file)) : actual === null, "SOLARIS_PHYSICAL_SOURCE_CHANGED");
    }
  }
  function pmRows() {
    const pid = Number(fs.readFileSync(PMHOME + "/pm2.pid", "utf8").trim());
    ensure(Number.isInteger(pid) && pid > 1 && fs.statSync("/proc/" + pid).uid === 1001 &&
      fs.readFileSync("/proc/" + pid + "/comm", "utf8").startsWith("PM2") &&
      fs.statSync(PMHOME + "/rpc.sock").isSocket(), "SOLARIS_EXISTING_PM2_REQUIRED");
    const start = fs.readFileSync("/proc/" + pid + "/stat", "utf8").split(")").slice(1).join(")")
      .trim().split(/\s+/)[19];
    const proof = pid + ":" + start;
    if (daemon) ensure(proof === daemon, "SOLARIS_PM2_DAEMON_CHANGED");
    daemon = proof;
    return JSON.parse(user(pmBinary, ["jlist"]));
  }
  function selectedProcesses(online = true) {
    const rows = pmRows();
    return [4, 5].map((id, index) => {
      const matches = rows.filter(row => row.pm_id === id);
      ensure(matches.length === 1, "SOLARIS_PM2_PROCESS_NOT_UNIQUE");
      const row = matches[0], e = row.pm2_env;
      ensure(row.name === (index ? "indexus-ai-worker" : "indexus-crm") && e.pm_cwd === ROOT &&
        e.pm_exec_path === ROOT + (index ? "/dist/ai-worker.cjs" : "/dist/index.cjs") &&
        (!online || e.status === "online") &&
        (!row.pid || fs.statSync("/proc/" + row.pid).uid === 1001),
      "SOLARIS_PM2_PROCESS_CHANGED");
      return row;
    });
  }
  const processConfig = row => identity({ env: row.pm2_env.env || {},
    direct: Object.fromEntries(Object.entries(row.pm2_env).filter(([key]) => /^[A-Z][A-Z0-9_]*$/.test(key))),
    args: row.pm2_env.args, node_args: row.pm2_env.node_args,
    interpreter: row.pm2_env.exec_interpreter });
  function runtimeUnchanged(online = true) {
    const current = selectedProcesses(online);
    ensure(current.every((row, index) => processConfig(row) === processConfig(originals[index])) &&
      fingerprint(ROOT + "/.env").hash === manifest.envHash, "SOLARIS_RUNTIME_ENVIRONMENT_CHANGED");
    return current;
  }
  const readConfig = async () => (await db.query("SELECT * FROM ai_router_configuration WHERE singleton=true")).rows[0];
  async function queueEmpty() {
    const result = await db.query(`SELECT (SELECT count(*) FROM ai_inference_jobs
      WHERE status IN ('pending','processing')) + (SELECT count(*) FROM ai_jobs
      WHERE status IN ('pending','processing')) AS count`);
    return Number(result.rows[0].count) === 0;
  }
  async function stopAndDrain() {
    mark("controlled-stop-and-drain");
    function stopOwned(id) {
      const row = selectedProcesses(false).find(item => item.pm_id === id);
      if (row.pid || row.pm2_env.status !== "stopped") {
        stopped = true; stoppedByAttempt.add(id);
        user(pmBinary, ["stop", String(id)]);
      }
    }
    stopOwned(4);
    const until = Date.now() + 150000;
    while (!(await queueEmpty())) {
      ensure(Date.now() < until, "SOLARIS_QUEUE_NOT_DRAINED");
      await pause(1000);
    }
    stopOwned(5);
    const rows = runtimeUnchanged(false);
    ensure(rows.every(row => row.pm2_env.status === "stopped" && !row.pid), "SOLARIS_PROCESSES_NOT_STOPPED");
    ensure(await queueEmpty(), "SOLARIS_QUEUE_CHANGED");
  }
  async function restartAndVerify(wantedConfig, hashes, compareOriginalPids = true, onlyStopped = false) {
    mark("restart-existing-worker-and-application");
    const restartedAfter = (await db.query("SELECT clock_timestamp() AS now")).rows[0].now;
    for (const id of [5, 4]) {
      const row = selectedProcesses(false).find(item => item.pm_id === id);
      // A drain timeout must not interrupt the worker which is finishing a call.
      if (!onlyStopped || row.pm2_env.status === "stopped" || !row.pid)
        user(pmBinary, ["restart", String(id)]);
    }
    const until = Date.now() + 120000;
    let lastCode = "SOLARIS_RUNTIME_NOT_READY";
    do {
      try {
        const rows = runtimeUnchanged();
        if (compareOriginalPids) ensure(rows.every((row, i) => row.pid !== originals[i].pid), "SOLARIS_PID_NOT_RESTARTED");
        for (const [file, hash] of Object.entries(hashes))
          ensure(fingerprint(ROOT + "/" + file).hash === hash, "SOLARIS_RUNTIME_HASH_CHANGED");
        const port = rows[0].pm2_env.env?.PORT || rows[0].pm2_env.PORT || 5000;
        ensure(/^\d+$/.test(String(port)) && +port > 0 && +port < 65536, "SOLARIS_PORT_INVALID");
        for (const [route, code] of [["/", "200"], ["/api/configurator/ai", "401"]])
          ensure(run("curl", ["-sS", "--max-time", "5", "-o", "/dev/null", "-w", "%{http_code}",
            "http://127.0.0.1:" + port + route]) === code, "SOLARIS_HTTP_NOT_READY");
        ensure(identity(await readConfig()) === identity(wantedConfig), "SOLARIS_CONFIGURATION_CHANGED_AFTER_RESTART");
        const heartbeat = await db.query(`SELECT count(*)::int AS count FROM ai_inference_workers
          WHERE heartbeat_at > now() - interval '30 seconds' AND heartbeat_at > $1`, [restartedAfter]);
        ensure(heartbeat.rows[0].count > 0, "SOLARIS_WORKER_HEARTBEAT_MISSING");
        stopped = false; return rows.map(row => ({ name: row.name, id: row.pm_id, pid: row.pid, status: row.pm2_env.status }));
      } catch (error) {
        lastCode = /^SOLARIS_[A-Z0-9_]+$/.test(error.message || "") ? error.message : "SOLARIS_RUNTIME_NOT_READY";
      }
      await pause(1000);
    } while (Date.now() < until);
    throw Error(lastCode);
  }
  async function recover() {
    mark("guarded-code-and-routing-recovery");
    let recoveryMutated = false, resumeHashes;
    const recordWrite = () => { recoveryMutated = true; mutated = true; };
    await guardedRecovery({
      validate: async () => {
        runtimeUnchanged(false);
        ensure([BASE, target].includes(git(["rev-parse", "HEAD"])), "SOLARIS_RECOVERY_EXTERNAL_GIT_CHANGE");
        ensure(!git(["status", "--porcelain", "--untracked-files=no"]), "SOLARIS_RECOVERY_EXTERNAL_SOURCE_CHANGE");
        ensure(identity(manifest.runtimeBefore) === identity(OLD), "SOLARIS_RECOVERY_INPUTS_CHANGED");
        const currentHashes = {};
        for (const [file, hash] of Object.entries(manifest.runtimeBefore)) {
          const owner = manifest.owners[file];
          ensure(owner && Number.isInteger(owner.uid) && owner.uid >= 0 &&
            Number.isInteger(owner.gid) && owner.gid >= 0 &&
            Number.isInteger(owner.mode) && owner.mode >= 0 && owner.mode <= 0o777,
          "SOLARIS_RECOVERY_INPUTS_CHANGED");
          currentHashes[file] = fingerprint(ROOT + "/" + file).hash;
          ensure(currentHashes[file] === hash || currentHashes[file] === expected[file],
            "SOLARIS_RECOVERY_EXTERNAL_RUNTIME_CHANGE");
          ensure(fingerprint(privateRoot + "/backup/" + file).hash === hash, "SOLARIS_RECOVERY_BACKUP_CHANGED");
        }
        for (const file of FILES) {
          const original = manifest.sourcesBefore[file], current = fingerprint(ROOT + "/" + file).hash;
          ensure(original && (original.hash === null || /^[a-f0-9]{64}$/.test(original.hash)) &&
            (original.hash === null || (Number.isInteger(original.uid) && original.uid >= 0 &&
              Number.isInteger(original.gid) && original.gid >= 0 &&
              Number.isInteger(original.mode) && original.mode >= 0 && original.mode <= 0o777)),
          "SOLARIS_RECOVERY_INPUTS_CHANGED");
          ensure(current === original.hash || current === sha(blob(target, file)), "SOLARIS_RECOVERY_SOURCE_CONFLICT");
          if (original.hash !== null)
            ensure(fingerprint(privateRoot + "/backup/" + file).hash === original.hash,
              "SOLARIS_RECOVERY_BACKUP_CHANGED");
        }
        ensure(identity(await readConfig()) === identity(afterConfig || originalConfig),
          "SOLARIS_ROLLBACK_CONFIGURATION_CHANGED");
        if (!resumeHashes) resumeHashes = currentHashes;
      },
      stop: stopAndDrain,
      hasMutated: () => !rollback || recoveryMutated,
      resume: async () => {
        // A late settings conflict is not permission to overwrite settings or
        // leave an otherwise unchanged application stopped.
        runtimeUnchanged(false);
        for (const [file, hash] of Object.entries(resumeHashes))
          ensure(fingerprint(ROOT + "/" + file).hash === hash, "SOLARIS_RESUME_RUNTIME_CHANGED");
        const until = Date.now() + 30000;
        const resumed = new Set();
        while (true) {
          for (const id of [5, 4]) {
            const row = selectedProcesses(false).find(item => item.pm_id === id);
            if (stoppedByAttempt.has(id) && !resumed.has(id) && row.pm2_env.status !== "online" && !row.pid) {
              user(pmBinary, ["restart", String(id)]); resumed.add(id);
            }
          }
          if (selectedProcesses(false).every(row => row.pm2_env.status === "online" && row.pid)) break;
          ensure(Date.now() < until, "SOLARIS_UNCHANGED_PROCESS_RESUME_FAILED");
          await pause(500);
        }
        stopped = false; resumedWithoutMutation = true;
      },
      mutate: async () => {
        if (afterConfig) {
          originalConfig = await revertRoutes(db, afterConfig, originalConfig, recordWrite);
          afterConfig = null;
        }
        recordWrite();
        for (const [file, hash] of Object.entries(manifest.runtimeBefore))
          atomicCopy(privateRoot + "/backup/" + file, ROOT + "/" + file, hash, manifest.owners[file]);
        for (const file of FILES) {
          const original = manifest.sourcesBefore[file], current = fingerprint(ROOT + "/" + file).hash;
          if (original.hash === null) { if (current !== null) fs.unlinkSync(ROOT + "/" + file); }
          else atomicCopy(privateRoot + "/backup/" + file, ROOT + "/" + file, original.hash, original);
        }
        if (git(["rev-parse", "HEAD"]) === target) git(["update-ref", "HEAD", BASE, target]);
        git(["read-tree", BASE]); gitChanged = false;
        sourceMatches(BASE);
        const rows = await restartAndVerify(originalConfig, manifest.runtimeBefore, false);
        json(privateRoot + "/rollback-result.json", { status: "ROLLED_BACK_CODE_AND_THREE_ROUTES",
          configurationVersion: originalConfig.version, processes: rows, databaseRestored: false });
      },
    });
  }
  try {
    noLinks(ROOT); noLinks(DATA); noLinks(lock);
    fs.mkdirSync(lock, { mode: 0o700 }); locked = true;
    ensure(run("findmnt", ["-n", "-o", "SOURCE", "-T", DATA]).trim() === "/dev/sdb1", "SOLARIS_BACKUP_DISK_REQUIRED");
    const disk = fs.statfsSync(DATA);
    ensure(disk.bavail * disk.bsize > 8 * 1024 ** 3, "SOLARIS_BACKUP_DISK_SPACE_LOW");
    ensure(run("id", ["-u", "seman"]).trim() === "1001", "SOLARIS_OPERATOR_UID_CHANGED");
    pmBinary = user("sh", ["-c", "command -v pm2"]).trim();
    ensure(path.isAbsolute(pmBinary), "SOLARIS_PM2_BINARY_MISSING");
    originals = selectedProcesses();
    const dotenv = require(ROOT + "/node_modules/dotenv").parse(fs.readFileSync(ROOT + "/.env"));
    const runtime = originals[0].pm2_env;
    const connectionString = runtime.env?.DATABASE_URL || runtime.DATABASE_URL || dotenv.DATABASE_URL;
    ensure(connectionString, "SOLARIS_DATABASE_CONFIGURATION_MISSING");
    const { Client } = require(ROOT + "/node_modules/pg");
    db = new Client({ connectionString, connectionTimeoutMillis: 8000,
      options: "-c statement_timeout=10000 -c lock_timeout=5000" });
    await db.connect();
    if (rollback) {
      noLinks(args[1]);
      ensure(args[1].startsWith(DATA + "/INDEXUS-Solaris-private-") && args[1].endsWith("/manifest.json"),
        "SOLARIS_ROLLBACK_MANIFEST_PATH_INVALID");
      const stat = fs.statSync(args[1]);
      ensure(stat.uid === 0 && !(stat.mode & 0o077), "SOLARIS_PRIVATE_MANIFEST_REQUIRED");
      manifest = JSON.parse(fs.readFileSync(args[1], "utf8"));
      privateRoot = path.dirname(args[1]); target = manifest.target; expected = manifest.runtimeAfter;
      ensure(manifest.base === BASE && /^[a-f0-9]{40}$/.test(target) &&
        git(["rev-parse", "HEAD"]) === target && git(["rev-parse", target + "^"]) === BASE,
      "SOLARIS_ROLLBACK_BASE_CHANGED");
      ensure(sha(fs.readFileSync(__filename)) === sha(blob(target, "script/deploy-solaris.cjs")),
        "SOLARIS_RUNNER_NOT_PINNED");
      releasePaths(git(["diff", "--name-only", BASE, target]).split("\n"));
      sourceMatches(target);
      originalConfig = manifest.configurationBefore; afterConfig = manifest.configurationAfter;
      ensure(afterConfig && expected, "SOLARIS_ROLLBACK_MANIFEST_INCOMPLETE");
      ensure(identity(originals.map(processConfig)) === identity(manifest.processConfigHashes),
        "SOLARIS_ROLLBACK_PROCESS_CONFIGURATION_CHANGED");
      runtimeUnchanged();
      await recover();
      console.log(JSON.stringify({ status: "ROLLED_BACK_CODE_AND_THREE_ROUTES", backup: privateRoot,
        configurationVersion: originalConfig.version, databaseRestored: false }, null, 2));
      return;
    }
    target = args[1];
    ensure(git(["rev-parse", "HEAD"]) === BASE && git(["branch", "--show-current"]) === "main" &&
      !git(["status", "--porcelain", "--untracked-files=no"]), "SOLARIS_PRODUCTION_BASE_CHANGED");
    ensure(git(["rev-parse", target + "^"]) === BASE, "SOLARIS_RELEASE_PARENT_CHANGED");
    releasePaths(git(["diff", "--name-only", BASE, target]).split("\n"));
    ensure(!git(["diff", "--diff-filter=DR", "--name-only", BASE, target]), "SOLARIS_RELEASE_DELETION_REFUSED");
    ensure(sha(fs.readFileSync(__filename)) === sha(blob(target, "script/deploy-solaris.cjs")),
      "SOLARIS_RUNNER_NOT_PINNED");
    sourceMatches(BASE);
    for (const [file, hash] of Object.entries(OLD))
      ensure(fingerprint(ROOT + "/" + file).hash === hash, "SOLARIS_RUNNING_BUILD_CHANGED");
    originalConfig = await readConfig(); planRoutes(originalConfig);
    ensure(await queueEmpty(), "SOLARIS_INITIAL_QUEUE_NOT_EMPTY");
    privateRoot = fs.mkdtempSync(DATA + "/INDEXUS-Solaris-private-"); fs.chmodSync(privateRoot, 0o700);
    for (const name of ["seman", "www-data"]) {
      run("id", ["-u", name]);
      const denied = cp.spawnSync("runuser", ["-u", name, "--", "test", "-r", privateRoot]);
      ensure(denied.status === 1, "SOLARIS_BACKUP_READABLE_BY_SERVICE");
    }
    manifest = { base: BASE, target, runtimeBefore: OLD, envHash: fingerprint(ROOT + "/.env").hash,
      owners: {}, sourcesBefore: {}, configurationBefore: originalConfig,
      processConfigHashes: originals.map(processConfig), createdAt: new Date().toISOString() };
    const backup = privateRoot + "/backup", stage = privateRoot + "/stage";
    fs.mkdirSync(backup, { mode: 0o700 }); fs.mkdirSync(stage, { mode: 0o700 });
    mark("private-runtime-and-configuration-backup");
    for (const file of [...FILES, ...Object.keys(OLD), ".env"]) {
      const original = fingerprint(ROOT + "/" + file);
      if (FILES.includes(file)) manifest.sourcesBefore[file] = original;
      if (Object.hasOwn(OLD, file)) manifest.owners[file] = original;
      if (original.hash === null) continue;
      fs.mkdirSync(path.dirname(backup + "/" + file), { recursive: true, mode: 0o700 });
      fs.copyFileSync(ROOT + "/" + file, backup + "/" + file); fs.chmodSync(backup + "/" + file, 0o600);
      ensure(fingerprint(backup + "/" + file).hash === original.hash, "SOLARIS_BACKUP_HASH_CHANGED");
    }
    json(privateRoot + "/pm2.private.json", originals);
    json(privateRoot + "/manifest.json", manifest);
    mark("private-database-backup");
    const pgEnv = nativeDatabaseEnvironment(connectionString, env);
    const nativeIdentity = run("psql", ["-X", "-At", "--no-password", "-c",
      "SELECT current_database() || ':' || current_user"], { env: pgEnv }).trim();
    const dbIdentity = (await db.query("SELECT current_database() || ':' || current_user AS identity")).rows[0].identity;
    ensure(nativeIdentity === dbIdentity, "SOLARIS_NATIVE_DATABASE_IDENTITY_CHANGED");
    const dump = backup + "/business-data.dump";
    run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--no-password", "--file", dump],
      { env: pgEnv, timeout: 30 * 60000 });
    const header = Buffer.alloc(5), dumpFd = fs.openSync(dump, "r");
    try { fs.readSync(dumpFd, header, 0, 5, 0); } finally { fs.closeSync(dumpFd); }
    ensure(fs.statSync(dump).size > 1024 && header.toString() === "PGDMP", "SOLARIS_DATABASE_BACKUP_INVALID");
    run("pg_restore", ["--list", dump], { timeout: 120000 });
    // A full DB dump can exceed Node's heap; hash it as a stream, never read it all.
    manifest.databaseBackupSha256 = run("sha256sum", [dump], { timeout: 30 * 60000 }).split(/\s+/)[0];
    ensure(/^[a-f0-9]{64}$/.test(manifest.databaseBackupSha256), "SOLARIS_DATABASE_BACKUP_HASH_INVALID");
    mark("build-and-test-pinned-release-outside-live-dist");
    const archive = privateRoot + "/source.tar";
    run("git", ["-c", "safe.directory=" + ROOT, "-C", ROOT, "archive", "--format=tar", "--output=" + archive, target],
      { timeout: 300000 });
    run("tar", ["-xf", archive, "-C", stage], { timeout: 300000 }); fs.unlinkSync(archive);
    const buildUid = run("id", ["-u", "nobody"]).trim();
    const buildGid = run("id", ["-g", "nobody"]).trim();
    ensure(/^\d+$/.test(buildUid) && +buildUid > 0 && +buildUid !== 1001 &&
      /^\d+$/.test(buildGid), "SOLARIS_BUILD_IDENTITY_REQUIRED");
    // A trusted build still must not write into the serving dependency tree.
    const writable = run("runuser", ["-u", "nobody", "--", "find",
      ROOT + "/node_modules", "-writable", "-print", "-quit"], { timeout: 120000 }).trim();
    ensure(!writable, "SOLARIS_LIVE_DEPENDENCIES_WRITABLE_BY_BUILD");
    privateDependencies(ROOT + "/node_modules", stage + "/node_modules");
    fs.mkdirSync(stage + "/operator-tmp", { mode: 0o700 });
    // -P/-h never follow the package links into the live installation.
    run("chown", ["-hRP", buildUid + ":" + buildGid, stage], { timeout: 120000 });
    buildView = fs.mkdtempSync("/run/indexus-solaris-build-");
    run("mount", ["--bind", stage, buildView]); buildMounted = true;
    const buildEnv = { ...env, HOME: buildView, TMPDIR: buildView + "/operator-tmp",
      NODE_ENV: "production" };
    const buildRun = (argv, overrides = {}) => run("runuser", ["-u", "nobody", "--", process.execPath, ...argv],
      { cwd: buildView, env: { ...buildEnv, ...overrides }, timeout: 300000 });
    // The application UID must not read the private build through either path.
    for (const directory of [privateRoot, buildView]) {
      const denied = cp.spawnSync("runuser", ["-u", "seman", "--", process.execPath, "-e",
        "try{require('fs').readdirSync(process.argv[1]);process.exit(2)}catch(e){process.exit(e.code==='EACCES'?0:3)}",
        directory], { env });
      ensure(denied.status === 0, "SOLARIS_BUILD_READABLE_BY_APPLICATION");
    }
    const testEnv = { NODE_ENV: "test",
      DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:1/synthetic" };
    fs.writeFileSync(privateRoot + "/tests.log", buildRun(
      [ROOT + "/node_modules/tsx/dist/cli.mjs", "--test", ...TESTS], testEnv),
    { mode: 0o600 });
    buildRun(["--test", buildView + "/script/deploy-solaris.test.cjs"], testEnv);
    fs.writeFileSync(privateRoot + "/build.log", buildRun(
      [ROOT + "/node_modules/tsx/dist/cli.mjs", buildView + "/script/build.ts"]),
    { mode: 0o600 });
    expected = Object.fromEntries(Object.keys(OLD).map(file => [file, fingerprint(stage + "/" + file).hash]));
    ensure(Object.values(expected).every(Boolean), "SOLARIS_RELEASE_OUTPUT_MISSING");
    for (const file of ["dist/index.cjs", "dist/ai-worker.cjs"])
      run(process.execPath, ["--check", stage + "/" + file]);
    manifest.runtimeAfter = expected;
    runtimeUnchanged(); sourceMatches(BASE);
    ensure(git(["rev-parse", "HEAD"]) === BASE && !git(["status", "--porcelain", "--untracked-files=no"]) &&
      identity(await readConfig()) === identity(originalConfig), "SOLARIS_BASE_CHANGED_DURING_PREPARATION");
    for (const [file, hash] of Object.entries(OLD))
      ensure(fingerprint(ROOT + "/" + file).hash === hash, "SOLARIS_BUILD_CHANGED_DURING_PREPARATION");
    const publicBytes = Number(run("du", ["-sb", stage + "/dist/public"]).split(/\s+/)[0]);
    const servingDisk = fs.statfsSync(ROOT + "/dist");
    ensure(Number.isSafeInteger(publicBytes) && servingDisk.bavail * servingDisk.bsize > publicBytes * 2 + 64 * 1024 ** 2,
      "SOLARIS_SERVING_DISK_SPACE_LOW");
    mark("canonical-gateway-smoke-with-installed-loader");
    const loader = "/etc/indexus-ai-runtime/preload.cjs";
    noLinks(loader);
    ensure(fs.statSync(loader).uid === 0, "SOLARIS_INSTALLED_LOADER_REQUIRED");
    manifest.loaderHash = fingerprint(loader).hash;
    const code = `(async()=>{const {checkAIProvider}=await import(${JSON.stringify(stage + "/server/lib/ai/settings-check.ts")});` +
      `const r=await checkAIProvider("smoke",${originalConfig.version});console.log("SOLARIS_CHECK:"+JSON.stringify(r));` +
      `if(r.state!=="ready")process.exitCode=1;})().catch(()=>{console.error("SOLARIS_CHECK_FAILED");process.exitCode=1;});`;
    const smokeOutput = run(process.execPath, ["--require", loader, ROOT + "/node_modules/tsx/dist/cli.mjs", "-e", code],
      { cwd: stage, env: { ...env, NODE_ENV: "production" }, timeout: 120000 });
    const smokeLine = smokeOutput.split(/\r?\n/).find(line => line.startsWith("SOLARIS_CHECK:"));
    ensure(smokeLine, "SOLARIS_SMOKE_RESULT_MISSING");
    const smoke = JSON.parse(smokeLine.slice("SOLARIS_CHECK:".length));
    validateSmoke(smoke, originalConfig.version);
    manifest.smoke = smoke; json(privateRoot + "/manifest.json", manifest);
    // All artifacts and recovery inputs exist before the first interruption.
    runtimeUnchanged(); sourceMatches(BASE);
    ensure(git(["rev-parse", "HEAD"]) === BASE && !git(["status", "--porcelain", "--untracked-files=no"]) &&
      identity(await readConfig()) === identity(originalConfig), "SOLARIS_CONFIGURATION_CHANGED_BEFORE_CUTOVER");
    for (const [file, hash] of Object.entries(OLD))
      ensure(fingerprint(ROOT + "/" + file).hash === hash, "SOLARIS_BUILD_CHANGED_BEFORE_CUTOVER");
    await stopAndDrain();
    ensure(fingerprint(loader).hash === manifest.loaderHash, "SOLARIS_INSTALLED_LOADER_CHANGED");
    mark("promote-only-reviewed-sources-and-completed-build");
    mutated = true;
    git(["merge", "--ff-only", target]); gitChanged = true; sourceMatches(target);
    publishAssets(stage + "/dist/public", ROOT + "/dist/public", manifest.owners["dist/public/index.html"]);
    for (const file of ["dist/index.cjs", "dist/ai-worker.cjs", "dist/public/index.html"])
      atomicCopy(stage + "/" + file, ROOT + "/" + file, expected[file], manifest.owners[file]);
    mark("switch-exactly-three-routes-with-audit");
    afterConfig = await changeRoutes(db, originalConfig, smoke);
    manifest.configurationAfter = afterConfig; json(privateRoot + "/manifest.json", manifest);
    const rows = await restartAndVerify(afterConfig, expected);
    mark("verified-code-routing-and-worker");
    const report = { status: "APPLIED_SOLARIS_CANONICAL", base: BASE, target,
      configurationVersion: afterConfig.version, model: SOLARIS, switchedServices: SERVICES,
      monitoringUnchanged: true, promptsUnchanged: true, workerSourceUnchanged: true,
      runtimeHashes: expected, processes: rows, backup: privateRoot,
      databaseBackupVerified: true, databaseRestored: false,
      gatewaySmoke: { textVerified: smoke.textVerified, jsonVerified: smoke.jsonVerified,
        checkedAt: smoke.checkedAt, inferenceCalls: 2 },
      endToEndThreeCasesVerified: false };
    json(privateRoot + "/result.json", report);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    const failedPhase = phase;
    const code = /^SOLARIS_[A-Z0-9_]+$/.test(error.message || "") ? error.message : "SOLARIS_PRIVATE_DIAGNOSTIC_REQUIRED";
    console.error("SOLARIS_DEPLOY_FAILED_PHASE " + failedPhase + " " + code);
    let recovery = "NOT_NEEDED";
    try {
      if (!rollback && mutated) { await recover(); recovery = "CODE_AND_OWN_ROUTING_RESTORED"; }
      else if (!rollback && stopped) {
        await restartAndVerify(originalConfig, OLD, false, true); recovery = "ORIGINAL_PROCESSES_RESTARTED";
      } else if (rollback && resumedWithoutMutation) recovery = "UNCHANGED_PROCESSES_RESUMED";
      else if (rollback && stopped) recovery = "OPERATOR_REQUIRED_KEEP_BACKUP";
    } catch { recovery = "OPERATOR_REQUIRED_KEEP_BACKUP"; }
    const report = { status: "STOPPED_NOT_COMPLETE", phase: failedPhase, code, recovery,
      liveChangesAttempted: mutated, sourceAtTarget: gitChanged, backup: privateRoot || null,
      databaseRestored: false };
    if (privateRoot) json(privateRoot + "/failure.json", report);
    console.error(JSON.stringify(report, null, 2)); process.exitCode = 1;
  } finally {
    if (db) await db.end().catch(() => {});
    if (buildMounted) {
      try { run("umount", [buildView]); buildMounted = false; }
      catch { console.error("SOLARIS_PRIVATE_BUILD_UNMOUNT_REQUIRED " + buildView); process.exitCode = 1; }
    }
    if (buildView && !buildMounted) fs.rmdirSync(buildView);
    if (locked) fs.rmdirSync(lock);
  }
}
module.exports = { BASE, SOLARIS, LEGACY, SERVICES, OLD, FILES, TESTS, releasePaths, planRoutes,
  validateSmoke, nativeDatabaseEnvironment, changeRoutes, revertRoutes, guardedRecovery,
  privateDependencies, fingerprint, atomicCopy, publishAssets, main };
if (require.main === module) main().catch(error => {
  console.error(/^SOLARIS_[A-Z0-9_]+$/.test(error.message || "") ? error.message : "SOLARIS_DEPLOY_REFUSED");
  process.exitCode = 1;
});
