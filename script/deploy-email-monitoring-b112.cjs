"use strict";
// Approved, backend-only operator release. No install, frontend build, model
// invocation, schema migration, routing write, PM2 environment change or DB restore.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const cp = require("node:child_process"), crypto = require("node:crypto");
const ROOT = "/var/www/indexus-crm", DATA = ROOT + "/data", PMHOME = "/home/seman/.pm2";
const BASE = "52902d20b5bad42c60d543f365d33badae647f05";
const TARGET = "742888533f9fbb802c7c619dee77c8b56dcb770d";
const OLD_BACKEND = "f6183a3f0766eeb3446de366b9fac38c42f92817d0a9801cc402dc036957687d";
const OLD_INDEX = "234e1d1ff45953dfe087bd7fa5264173faeaba237a1cf2fa322ade35e9bd09d9";
const BUILD_CONFIG = "35df8bf9d4c1aad8cdff54df8108bbc964a853bbc29538ec0ec6e1b1a9b0d54f";
const FILES = Object.freeze([
  "server/lib/ai/email-monitoring-contract.ts", "server/lib/ai/email-monitoring-profile.ts",
  "server/lib/ai/internal-adapter.ts", "server/lib/ai/internal-contract.ts",
  "server/lib/ai/openai-adapter.ts", "server/lib/ai/router.ts",
  "server/lib/ai/settings-controller.ts", "server/lib/ai/settings-policy.ts",
  "server/lib/email-monitoring-service.ts", "shared/ai-settings.ts",
]);
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const ensure = (value, code) => { if (!value) throw Error(code); };
function noLinks(file) {
  let current = path.parse(path.resolve(file)).root;
  for (const part of path.resolve(file).slice(current.length).split(path.sep)) {
    current = path.join(current, part);
    const st = fs.lstatSync(current, { throwIfNoEntry: false });
    ensure(!st?.isSymbolicLink(), "B112_SYMLINK_PATH_REFUSED");
  }
}
function fingerprint(file) {
  noLinks(file);
  const st = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!st) return { hash: "missing" };
  ensure(st.isFile(), "B112_REGULAR_FILE_REQUIRED");
  return { hash: hash(fs.readFileSync(file)), uid: st.uid, gid: st.gid, mode: st.mode & 0o777 };
}
function atomicCopy(source, dest, expected, profile) {
  noLinks(source); noLinks(dest);
  ensure(fingerprint(source).hash === expected, "B112_COPY_SOURCE_CHANGED");
  const temporary = path.join(path.dirname(dest), "B112-install-" + crypto.randomUUID());
  try {
    fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
    fs.chownSync(temporary, profile.uid, profile.gid); fs.chmodSync(temporary, profile.mode);
    const fd = fs.openSync(temporary, "r");
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    ensure(fingerprint(temporary).hash === expected, "B112_COPY_BYTES_CHANGED");
    fs.renameSync(temporary, dest);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
}
function configHash(row) {
  const env = row.pm2_env || {};
  return hash(JSON.stringify(stable({ env: env.env || {}, direct: Object.fromEntries(
    Object.entries(env).filter(([k]) => /^[A-Z][A-Z0-9_]*$/.test(k))) })));
}
function assertRouting(snapshot) {
  const row = snapshot?.state;
  ensure(row?.version === 5 && row.value?.gateway?.enabled === false &&
    row.value.routes && Object.keys(row.value.routes).length === 0 &&
    Number.isSafeInteger(snapshot.auditCount), "B112_ROUTING_HOLD_CHANGED");
}
function releasePaths(actual) {
  ensure(JSON.stringify([...actual].sort()) === JSON.stringify([...FILES].sort()),
    "B112_UNREVIEWED_RELEASE_PATHS");
}
async function cutover(actions) {
  try { await actions.install(); await actions.restart(); await actions.verify(); }
  catch (error) {
    try { await actions.restore(); await actions.restartOld(); await actions.verifyOld(); }
    catch { throw Error("B112_RECOVERY_REQUIRES_OPERATOR_KEEP_PRIVATE_BACKUP"); }
    throw Error("B112_NEW_RUNTIME_FAILED_ORIGINAL_RESTORED");
  }
}
// A pinned operator wrapper may reuse the same deployment protections for a
// separately reviewed release. The original entry retains its original profile.
function deploymentFor(profile) {
  const { BASE, TARGET, OLD_BACKEND, OLD_INDEX, BUILD_CONFIG, FILES,
    assertRouting, releasePaths, resultOverrides = {} } = profile;
async function main(args = process.argv.slice(2)) {
  ensure(args.length === 3 && args[0] === "--apply" && args[1] === TARGET &&
    args[2] === "--allow-restart", "B112_EXPLICIT_PINNED_APPLY_REQUIRED");
  ensure(process.getuid() === 0 && os.hostname().split(".")[0].toUpperCase() === "CORPCRM01",
    "B112_ROOT_ON_CORPCRM01_REQUIRED");
  process.umask(0o077);
  let phase = "preflight", privateRoot, locked = false, changed = false;
  const lock = "/run/lock/indexus-email-b112.lock";
  const env = { PATH: process.env.PATH, HOME: "/root", LANG: "C.UTF-8" };
  function run(bin, argv, options = {}) {
    try {
      return cp.execFileSync(bin, argv, { cwd: ROOT, env, encoding: "utf8", timeout: 120000,
        maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...options });
    } catch (error) {
      if (privateRoot) fs.writeFileSync(path.join(privateRoot, "command-failure.private.log"),
        Buffer.concat([Buffer.from(error.stdout || ""), Buffer.from(error.stderr || "")]), { mode: 0o600 });
      throw Error("B112_COMMAND_FAILED_" + path.basename(bin).replace(/[^a-z0-9_-]/gi, "_"));
    }
  }
  const user = (bin, argv) => run("runuser", ["-u", "seman", "--", bin, ...argv],
    { env: { ...env, HOME: "/home/seman", PM2_HOME: PMHOME } });
  const git = argv => user("git", ["--no-optional-locks", "-c", "core.hooksPath=/dev/null",
    "-c", "core.fsmonitor=false", "-C", ROOT, ...argv]).trim();
  const json = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  function mark(value) { phase = value; console.log("B112_DEPLOY_PHASE " + phase); }
  function sourceMatches(commit) {
    for (const file of FILES) {
      const entry = git(["ls-tree", commit, "--", file]);
      if (!entry) ensure(fingerprint(path.join(ROOT, file)).hash === "missing", "B112_NEW_SOURCE_COLLISION");
      else {
        const blob = entry.split(/\s+/)[2];
        const bytes = run("git", ["-c", "safe.directory=" + ROOT, "-C", ROOT, "cat-file", "blob", blob],
          { encoding: null });
        ensure(fingerprint(path.join(ROOT, file)).hash === hash(bytes), "B112_PHYSICAL_SOURCE_CHANGED");
      }
    }
  }
  const liveServer = ROOT + "/dist/index.cjs", liveIndex = ROOT + "/dist/public/index.html";
  const beforeSources = {};
  let originalProcess, pmBinary, originalEnvHash, originalConfigHash, originalRouting, queryRouting;
  let builtHash, oldBackendProfile, promoted = false, daemon, daemonStart;
  function daemonProof() {
    const pid = Number(fs.readFileSync(PMHOME + "/pm2.pid", "utf8").trim());
    ensure(Number.isSafeInteger(pid) && pid > 1 && fs.statSync("/proc/" + pid).uid === 1001 &&
      fs.readFileSync("/proc/" + pid + "/comm", "utf8").startsWith("PM2") &&
      fs.statSync(PMHOME + "/rpc.sock").isSocket(), "B112_EXISTING_USER_PM2_REQUIRED");
    const stat = fs.readFileSync("/proc/" + pid + "/stat", "utf8");
    const start = stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
    if (daemon) ensure(pid === daemon && start === daemonStart, "B112_PM2_DAEMON_CHANGED");
    daemon = pid; daemonStart = start;
  }
  function pm2() {
    daemonProof();
    const rows = JSON.parse(user(pmBinary, ["jlist"])).filter(r => r.name === "indexus-crm");
    ensure(rows.length === 1, "B112_PM2_PROCESS_NOT_UNIQUE");
    const row = rows[0], e = row.pm2_env;
    ensure(e?.status === "online" && e.pm_cwd === ROOT && e.pm_exec_path === liveServer &&
      Number.isInteger(row.pid) && row.pid > 1 && fs.statSync("/proc/" + row.pid).uid === 1001,
      "B112_PM2_WORKER_MISMATCH");
    const stat = fs.readFileSync("/proc/" + row.pid + "/stat", "utf8");
    ensure(Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]) === daemon,
      "B112_PM2_WORKER_PARENT_MISMATCH");
    return row;
  }
  function unchangedConfiguration() {
    const row = pm2();
    ensure(configHash(row) === originalConfigHash &&
      fingerprint(ROOT + "/.env").hash === originalEnvHash, "B112_RUNTIME_CONFIGURATION_CHANGED");
    return row;
  }
  async function health(candidate) {
    const deadline = Date.now() + 90000;
    do {
      try {
        const row = unchangedConfiguration();
        if (candidate) ensure(row.pid !== originalProcess.pid, "B112_RUNTIME_NOT_RESTARTED");
        const e = row.pm2_env, port = e.env?.PORT || e.PORT || 5000;
        ensure(/^\d+$/.test(String(port)) && +port > 0 && +port < 65536, "B112_INVALID_PORT");
        for (const [route, code] of [["/", "200"], ["/api/users", "401"]])
          ensure(run("curl", ["-sS", "--max-time", "5", "-o", "/dev/null", "-w", "%{http_code}",
            "http://127.0.0.1:" + port + route]) === code, "B112_RUNTIME_NOT_HEALTHY");
        ensure(fingerprint(liveIndex).hash === OLD_INDEX, "B112_FRONTEND_CHANGED");
        if (candidate) ensure(fingerprint(liveServer).hash === builtHash, "B112_BACKEND_CHANGED");
        const state = await queryRouting();
        assertRouting(state);
        ensure(hash(JSON.stringify(stable(state))) === originalRouting, "B112_AI_CONFIGURATION_CHANGED");
        return;
      } catch (error) { if (Date.now() >= deadline) throw error; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    } while (true);
  }
  try {
    noLinks(ROOT); noLinks(DATA); noLinks(lock);
    fs.mkdirSync(lock, { mode: 0o700 }); locked = true;
    ensure(run("findmnt", ["-n", "-o", "SOURCE", "-T", DATA]).trim() === "/dev/sdb1",
      "B112_APPROVED_DATA_DISK_REQUIRED");
    const disk = fs.statfsSync(DATA);
    ensure(disk.bavail * disk.bsize > 8 * 1024 ** 3, "B112_DATA_DISK_SPACE_LOW");
    ensure(run("id", ["-u", "seman"]).trim() === "1001", "B112_OPERATOR_UID_CHANGED");
    ensure(git(["rev-parse", "HEAD"]) === BASE && !git(["status", "--porcelain", "--untracked-files=no"]),
      "B112_PRODUCTION_GIT_BASE_CHANGED");
    ensure(git(["rev-parse", TARGET + "^"]) === BASE, "B112_RELEASE_PARENT_CHANGED");
    releasePaths(git(["diff", "--name-only", BASE, TARGET]).split("\n"));
    ensure(!git(["diff", "--diff-filter=DR", "--name-only", BASE, TARGET]), "B112_RELEASE_DELETION_REFUSED");
    sourceMatches(BASE);
    ensure(fingerprint(liveServer).hash === OLD_BACKEND && fingerprint(liveIndex).hash === OLD_INDEX,
      "B112_RUNNING_BUILD_CHANGED");
    ensure(fingerprint(ROOT + "/script/build.ts").hash === BUILD_CONFIG, "B112_BUILD_CONFIGURATION_CHANGED");
    daemonProof();
    pmBinary = user("sh", ["-c", "command -v pm2"]).trim();
    ensure(path.isAbsolute(pmBinary), "B112_PM2_BINARY_UNAVAILABLE");
    originalProcess = pm2(); originalConfigHash = configHash(originalProcess);
    originalEnvHash = fingerprint(ROOT + "/.env").hash;
    oldBackendProfile = fingerprint(liveServer);
    const dotenv = require(ROOT + "/node_modules/dotenv").parse(fs.readFileSync(ROOT + "/.env"));
    const runtime = originalProcess.pm2_env;
    const connectionString = runtime.env?.DATABASE_URL || runtime.DATABASE_URL || dotenv.DATABASE_URL;
    ensure(connectionString, "B112_APPLICATION_DATABASE_CONFIGURATION_REQUIRED");
    const { Client } = require(ROOT + "/node_modules/pg");
    queryRouting = async () => {
      const db = new Client({ connectionString, connectionTimeoutMillis: 8000,
        options: "-c default_transaction_read_only=on -c statement_timeout=8000" });
      try {
        await db.connect(); await db.query("BEGIN READ ONLY");
        const result = await db.query("SELECT row_to_json(c) AS state FROM ai_router_configuration c WHERE singleton=true");
        ensure(result.rows.length === 1, "B112_AI_CONFIGURATION_MISSING");
        const audit = await db.query("SELECT count(*)::integer AS count FROM ai_router_configuration_audit");
        return { state: result.rows[0].state, auditCount: audit.rows[0].count };
      } finally { await db.query("ROLLBACK").catch(() => {}); await db.end(); }
    };
    const routing = await queryRouting(); assertRouting(routing);
    originalRouting = hash(JSON.stringify(stable(routing)));
    privateRoot = fs.mkdtempSync(DATA + "/INDEXUS-B112-private-");
    fs.chmodSync(privateRoot, 0o700);
    const denied = cp.spawnSync("runuser", ["-u", "seman", "--", "test", "-r", privateRoot]);
    ensure(denied.status === 1, "B112_BACKUP_READABLE_BY_APPLICATION");
    mark("private-code-backup");
    const backup = path.join(privateRoot, "backup"), stage = path.join(privateRoot, "stage");
    fs.mkdirSync(backup, { mode: 0o700 }); fs.mkdirSync(stage, { mode: 0o700 });
    for (const file of FILES) {
      const original = beforeSources[file] = fingerprint(path.join(ROOT, file));
      if (original.hash === "missing") continue;
      const dest = path.join(backup, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
      fs.copyFileSync(path.join(ROOT, file), dest); fs.chmodSync(dest, 0o600);
      ensure(fingerprint(dest).hash === original.hash, "B112_SOURCE_BACKUP_INVALID");
    }
    fs.copyFileSync(liveServer, backup + "/index.cjs"); fs.chmodSync(backup + "/index.cjs", 0o600);
    ensure(fingerprint(backup + "/index.cjs").hash === OLD_BACKEND, "B112_BACKEND_BACKUP_INVALID");
    json(backup + "/manifest.json", { base: BASE, target: TARGET, beforeSources, backend: oldBackendProfile,
      frontend: OLD_INDEX, routingSha256: originalRouting, runtimeConfigurationSha256: originalConfigHash });
    mark("isolated-backend-build");
    const archive = privateRoot + "/source.tar";
    run("git", ["-c", "safe.directory=" + ROOT, "-C", ROOT, "archive", "--format=tar", "--output=" + archive, TARGET],
      { timeout: 300000 });
    run("tar", ["-xf", archive, "-C", stage], { timeout: 300000 });
    fs.unlinkSync(archive);
    fs.symlinkSync(ROOT + "/node_modules", stage + "/node_modules");
    ensure(fingerprint(stage + "/script/build.ts").hash === BUILD_CONFIG, "B112_STAGE_BUILD_CONFIGURATION_CHANGED");
    // Same backend configuration as the hash-pinned normal build. Do NOT call
    // buildAll(): it deletes dist and rebuilds the frontend.
    const ts = require(ROOT + "/node_modules/typescript");
    const ast = ts.createSourceFile("build.ts", fs.readFileSync(stage + "/script/build.ts", "utf8"), ts.ScriptTarget.Latest, true);
    const declarations = ast.statements.flatMap(n => ts.isVariableStatement(n) ? [...n.declarationList.declarations] : []);
    const list = declarations.find(n => n.name.getText(ast) === "allowlist")?.initializer;
    ensure(list && ts.isArrayLiteralExpression(list) && list.elements.every(ts.isStringLiteral), "B112_BUILD_ALLOWLIST_INVALID");
    const allowlist = list.elements.map(n => n.text);
    const pkg = JSON.parse(fs.readFileSync(stage + "/package.json", "utf8"));
    const external = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]
      .filter(name => !allowlist.includes(name));
    require(ROOT + "/node_modules/esbuild").buildSync({ absWorkingDir: stage, entryPoints: ["server/index.ts"],
      platform: "node", bundle: true, format: "cjs", outfile: "dist/index.cjs",
      define: { "process.env.NODE_ENV": '"production"' }, minify: true, external, logLevel: "silent" });
    builtHash = fingerprint(stage + "/dist/index.cjs").hash;
    ensure(builtHash !== "missing", "B112_BACKEND_NOT_BUILT");
    run(process.execPath, ["--check", stage + "/dist/index.cjs"]);
    mark("recheck-before-promotion");
    ensure(git(["rev-parse", "HEAD"]) === BASE && !git(["status", "--porcelain", "--untracked-files=no"]),
      "B112_SOURCE_CHANGED_DURING_BUILD");
    sourceMatches(BASE);
    ensure(fingerprint(liveServer).hash === OLD_BACKEND && fingerprint(liveIndex).hash === OLD_INDEX,
      "B112_BUILD_CHANGED_DURING_PREPARATION");
    const servingDisk = fs.statfsSync(ROOT + "/dist");
    ensure(servingDisk.bavail * servingDisk.bsize >
      2 * Math.max(fs.statSync(liveServer).size, fs.statSync(stage + "/dist/index.cjs").size) + 64 * 1024 ** 2,
      "B112_SERVING_DISK_SPACE_LOW");
    ensure(unchangedConfiguration().pid === originalProcess.pid, "B112_PROCESS_CHANGED_DURING_BUILD");
    ensure(hash(JSON.stringify(stable(await queryRouting()))) === originalRouting, "B112_ROUTING_CHANGED_DURING_BUILD");
    await cutover({
      install() {
        changed = true; mark("promote-backend-only");
        git(["merge", "--ff-only", TARGET]); promoted = true; sourceMatches(TARGET);
        atomicCopy(stage + "/dist/index.cjs", liveServer, builtHash, oldBackendProfile);
      },
      restart() { mark("restart-existing-indexus-only"); daemonProof(); user(pmBinary, ["restart", String(originalProcess.pm_id)]); },
      verify() { return health(true); },
      restore() {
        mark("guarded-code-recovery");
        ensure([BASE, TARGET].includes(git(["rev-parse", "HEAD"])), "B112_EXTERNAL_GIT_CHANGE");
        const worktreeChanges = git(["diff", "--name-only", "HEAD"]).split("\n").filter(Boolean);
        const indexChanges = git(["diff", "--cached", "--name-only", "HEAD"]).split("\n").filter(Boolean);
        ensure([...worktreeChanges, ...indexChanges].every(file => FILES.includes(file)),
          "B112_EXTERNAL_INDEX_OR_SOURCE_CHANGE");
        ensure([OLD_BACKEND, builtHash].includes(fingerprint(liveServer).hash), "B112_EXTERNAL_BACKEND_CHANGE");
        for (const file of FILES) {
          const now = fingerprint(path.join(ROOT, file)).hash;
          ensure(now === beforeSources[file].hash || now === fingerprint(path.join(stage, file)).hash,
            "B112_EXTERNAL_SOURCE_CHANGE");
        }
        if (fingerprint(liveServer).hash !== OLD_BACKEND)
          atomicCopy(backup + "/index.cjs", liveServer, OLD_BACKEND, oldBackendProfile);
        for (const file of FILES) {
          if (fingerprint(path.join(ROOT, file)).hash === beforeSources[file].hash) continue;
          if (beforeSources[file].hash === "missing") fs.unlinkSync(path.join(ROOT, file));
          else atomicCopy(path.join(backup, file), path.join(ROOT, file), beforeSources[file].hash, beforeSources[file]);
        }
        if (git(["rev-parse", "HEAD"]) === TARGET) git(["update-ref", "HEAD", BASE, TARGET]);
        git(["read-tree", BASE]); promoted = false; sourceMatches(BASE);
      },
      restartOld() { daemonProof(); user(pmBinary, ["restart", String(originalProcess.pm_id)]); },
      verifyOld() { return health(false); },
    });
    mark("verify-complete");
    const report = { status: "APPLIED_GATEWAY_OFF_NOT_FUNCTIONALLY_VERIFIED", base: BASE, target: TARGET,
      changedPaths: FILES, backendSha256: builtHash, frontendSha256: OLD_INDEX, frontendChanged: false,
      gatewayEnabled: false, openaiServices: 65, internalServices: 0, routingUnchanged: true,
      serviceTimeoutMs: 120000, productionModelCalls: 0, databaseRestored: false, backup: privateRoot,
      next: "Run the approved seven synthetic cases; do not activate internal production routing.",
      ...resultOverrides };
    json(privateRoot + "/result.json", report);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    const report = { status: "STOPPED_NOT_READY", phase,
      code: /^B112_[A-Z0-9_]+$/.test(error.message || "") ? error.message : "B112_PRIVATE_DETAILS_NOT_PRINTED",
      liveChangesAttempted: changed, sourceAtTarget: promoted, privateBackup: privateRoot || null,
      productionActivation: false, databaseRestored: false };
    if (privateRoot) json(privateRoot + "/failure.json", report);
    console.error(JSON.stringify(report, null, 2)); process.exitCode = 1;
  } finally { if (locked) fs.rmdirSync(lock); }
}
  return main;
}
const main = deploymentFor({ BASE, TARGET, OLD_BACKEND, OLD_INDEX, BUILD_CONFIG, FILES, assertRouting, releasePaths });
module.exports = { BASE, TARGET, FILES, fingerprint, atomicCopy, configHash, assertRouting, releasePaths, cutover, main, deploymentFor };
if (require.main === module) main().catch(() => { console.error("B112_DEPLOY_REFUSED_NO_OPERATION"); process.exitCode = 1; });
