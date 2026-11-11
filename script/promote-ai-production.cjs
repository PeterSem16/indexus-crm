#!/usr/bin/env node
"use strict";
// Promote ONLY the already prepared release. No build, package install, DB writes,
// secret changes, Gateway calls, git reset/clean, or management of root's PM2.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const crypto = require("node:crypto"), cp = require("node:child_process");
const prepared = require("./prepare-ai-production.cjs");
const ROOT = "/var/www/indexus-crm", BACKUP = ROOT + "/data/.ai-release-private-tF1VcH";
const PMHOME = "/home/seman/.pm2", UID = 1001, ID = 4, OLD_PID = 806258, DAEMON = 22545;
const START = "2634615967", DAEMON_START = "49248242";
const BUILT = "f6183a3f0766eeb3446de366b9fac38c42f92817d0a9801cc402dc036957687d";
const INDEX = "234e1d1ff45953dfe087bd7fa5264173faeaba237a1cf2fa322ade35e9bd09d9";
const MANIFEST = "cd671d7d5ffd4a439bd5c11edb11759f0facfa60fd58df13f343cb70b9c39e5f";
const OLD_BACKEND = "e078705eddd999079747038a2fad4dc8cd5e882bdce963e3648bf784e9d46f07";
const OLD_INDEX = "6d2a50b02d4cdce240866421ecc8e7d6bc75f6ce408630018db06cca4e5d6d7f";
const ensure = (ok, code) => { if (!ok) throw Error(code); };
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
function noLinks(file) {
  let current = path.parse(path.resolve(file)).root;
  for (const part of path.resolve(file).slice(current.length).split(path.sep)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    ensure(!stat?.isSymbolicLink(), "SYMLINK_IN_OPERATION_PATH");
  }
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function configHash(row) {
  const e = row.pm2_env || {}, env = e.env || {};
  const direct = Object.fromEntries(Object.entries(e).filter(([k]) => /^[A-Z][A-Z0-9_]*$/.test(k) && !(k in env)));
  return hash(JSON.stringify(stable({ env, direct })));
}
function assertHold(environment, dotenv) {
  for (const env of [environment, dotenv]) {
    ensure(!env.INDEXUS_AI_GATEWAY_ENABLED || env.INDEXUS_AI_GATEWAY_ENABLED === "false",
      "GATEWAY_ENVIRONMENT_REQUIRES_REVIEW");
    ensure(!env.INDEXUS_AI_ROUTER_MODE || env.INDEXUS_AI_ROUTER_MODE === "routed",
      "ROUTER_MODE_REQUIRES_REVIEW");
  }
}
function assertDatabaseHold(state) {
  ensure(state?.version === 1 && state.gatewayDisabled === true && state.routesEmpty === true &&
    state.gatewayUntested === true && state.openaiUntested === true && +state.auditCount === 0,
    "PRODUCTION_AI_DEFAULTS_REQUIRE_REVIEW");
}
function decodeHTTP(raw) {
  ensure(Buffer.isBuffer(raw), "HTTP_BYTES_REQUIRED");
  const i = raw.lastIndexOf(Buffer.from("\n"));
  ensure(i >= 0, "HTTP_STATUS_MISSING");
  const body = raw.subarray(0, i), status = Number(raw.subarray(i + 1).toString("ascii"));
  return { body, status, sha256: hash(body) };
}
function atomicFile(source, target, expected, replace, profile) {
  noLinks(source); noLinks(target);
  ensure(fs.lstatSync(source).isFile() && prepared.fileHash(source) === expected, "COPY_SOURCE_CHANGED");
  const parent = path.dirname(target);
  const firstCreated = fs.mkdirSync(parent, { recursive: true, mode: 0o755 });
  if (firstCreated) {
    // sudo may retain the launcher's private umask. Make only newly created
    // public directories readable by the verified application account.
    let directory = parent;
    while (true) {
      noLinks(directory);
      fs.chownSync(directory, profile.uid, profile.gid); fs.chmodSync(directory, 0o755);
      if (directory === firstCreated) break;
      directory = path.dirname(directory);
    }
  }
  noLinks(parent);
  const temp = path.join(parent, ".ai-install-" + crypto.randomUUID());
  try {
    fs.copyFileSync(source, temp, fs.constants.COPYFILE_EXCL);
    fs.chownSync(temp, profile.uid, profile.gid); fs.chmodSync(temp, profile.mode & 0o777);
    ensure(prepared.fileHash(temp) === expected, "ATOMIC_COPY_BYTES_CHANGED");
    const fd = fs.openSync(temp, "r"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (replace) {
      ensure(fs.lstatSync(target).isFile(), "REPLACEMENT_TARGET_CHANGED");
      fs.renameSync(temp, target);
    } else {
      fs.linkSync(temp, target); // atomic no-clobber publication of an immutable asset
      fs.unlinkSync(temp);
    }
    const dir = fs.openSync(parent, "r"); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
  } finally { try { fs.unlinkSync(temp); } catch (e) { if (e.code !== "ENOENT") throw e; } }
}
function performPromotion(a) {
  let sourcesAdvanced = false, backendTouched = false, restartAttempted = false, entryTouched = false, phase;
  const step = (name, action) => { phase = name; a.phase(name); action(); };
  try {
    step("publish_missing_immutable_assets", a.assets);
    step("fast_forward_reviewed_sources", () => { a.sources(); sourcesAdvanced = true; });
    step("install_verified_backend", () => { backendTouched = true; a.backend(); });
    step("restart_only_indexus_pm2_4", () => { restartAttempted = true; a.restart(); });
    step("verify_backend_and_openai_defaults", a.verifyBackend);
    step("publish_frontend_entry", () => { entryTouched = true; a.entry(); });
    step("verify_serving_release", a.verifyFinal);
    step("record_success", a.complete);
  } catch (error) {
    error.failedPhase = phase;
    error.sourcesAdvanced = sourcesAdvanced;
    try { a.failure(error); } catch {}
    error.runtimeRecovery = "not_needed";
    if (backendTouched) {
      try {
        a.phase("restore_previous_runtime_only");
        if (entryTouched) a.restoreEntry();
        a.restoreBackend();
        if (restartAttempted) a.restart();
        a.verifyRecovery(restartAttempted);
        error.runtimeRecovery = "previous_runtime_verified";
      } catch {
        error.runtimeRecovery = "operator_attention_required";
      }
    }
    error.schemaMayHaveChanged = restartAttempted;
    throw error;
  }
}
function main(args = process.argv.slice(2)) {
  ensure(args.length === 2 && args[0] === "--apply" && args[1] === prepared.TARGET, "EXPLICIT_PINNED_APPLY_REQUIRED");
  ensure(os.hostname().toUpperCase() === "CORPCRM01" && process.getuid() === 0, "ROOT_ON_CORPCRM01_REQUIRED");
  let phase = "preflight", attempt, lock, locked = false, report, after, lastObservation;
  const environment = { PATH: process.env.PATH, HOME: "/root", LANG: "C.UTF-8" };
  function privateJSON(file, value) {
    const temp = file + ".tmp-" + crypto.randomUUID();
    try {
      fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600, flag: "wx" });
      const fd = fs.openSync(temp, "r"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temp, file);
    } finally { try { fs.unlinkSync(temp); } catch (e) { if (e.code !== "ENOENT") throw e; } }
  }
  function mark(name) {
    phase = name;
    if (attempt) privateJSON(attempt + "/phase.json", { phase, at: new Date().toISOString() });
    console.log("AI_PROMOTE_PHASE=" + name);
  }
  function run(bin, argv, options = {}) {
    try { return cp.execFileSync(bin, argv, { cwd: ROOT, env: environment, encoding: "utf8",
      timeout: 120000, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...options }); }
    catch (error) {
      if (attempt) fs.writeFileSync(attempt + "/command-failure.log",
        Buffer.concat([Buffer.from(error.stdout || ""), Buffer.from(error.stderr || "")]), { mode: 0o600 });
      const safe = Error("COMMAND_FAILED_" + path.basename(bin).replace(/[^a-z0-9_-]/gi, "_"));
      safe.nativeStatus = error.status ?? null; throw safe;
    }
  }
  const userRun = (bin, argv) => run("runuser", ["-u", "seman", "--", bin, ...argv],
    { env: { PATH: environment.PATH, HOME: "/home/seman", PM2_HOME: PMHOME, LANG: "C.UTF-8" } });
  const git = argv => userRun("git", ["--no-optional-locks", "-c", "core.hooksPath=/dev/null",
    "-c", "core.fsmonitor=false", "-C", ROOT, ...argv]).trim();
  function processInfo(pid) {
    const p = "/proc/" + pid, raw = fs.readFileSync(p + "/stat", "utf8");
    const fields = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
    return { pid, uid: fs.statSync(p).uid, parent: +fields[1], start: fields[19], cwd: fs.realpathSync(p + "/cwd") };
  }
  function daemonProof() {
    const p = processInfo(DAEMON);
    ensure(p.uid === UID && p.start === DAEMON_START &&
      fs.readFileSync("/proc/" + DAEMON + "/comm", "utf8").startsWith("PM2") &&
      fs.statSync(PMHOME).uid === UID && fs.readFileSync(PMHOME + "/pm2.pid", "utf8").trim() === String(DAEMON),
      "VERIFIED_USER_PM2_DAEMON_CHANGED");
  }
  function liveEnvironment(pid) {
    const keys = ["DATABASE_URL", "INDEXUS_AI_GATEWAY_ENABLED", "INDEXUS_AI_ROUTER_MODE"];
    return Object.fromEntries(fs.readFileSync("/proc/" + pid + "/environ", "utf8").split("\0")
      .filter(s => keys.some(key => s.startsWith(key + "=")))
      .map(s => [s.slice(0, s.indexOf("=")), s.slice(s.indexOf("=") + 1)]));
  }
  let pmBinary;
  function pm2() {
    daemonProof();
    const rows = JSON.parse(userRun(pmBinary, ["jlist"]));
    const selected = rows.filter(row => row.name === "indexus-crm" ||
      (row.pm2_env?.pm_cwd === ROOT && row.pm2_env?.pm_exec_path === ROOT + "/dist/index.cjs"));
    ensure(selected.length === 1, "INDEXUS_WORKER_COUNT_CHANGED");
    const row = selected[0], e = row.pm2_env || {};
    ensure(row.pm_id === ID && row.name === "indexus-crm" && e.status === "online" &&
      e.pm_cwd === ROOT && e.pm_exec_path === ROOT + "/dist/index.cjs" &&
      e.exec_mode === "fork_mode" && +e.instances === 1, "PM2_APPLICATION_CONFIGURATION_CHANGED");
    const p = processInfo(row.pid);
    ensure(p.uid === UID && p.parent === DAEMON && p.cwd === ROOT, "WRONG_PM2_APPLICATION_PROCESS");
    return { row, process: p, configHash: configHash(row) };
  }
  function http(route, expectedStatus, expectedHash) {
    const raw = run("curl", ["-sS", "--max-time", "5", "-w", "\n%{http_code}", "http://127.0.0.1:5000" + route], { encoding: null });
    const { body, status, sha256 } = decodeHTTP(raw);
    lastObservation = { route, status, sha256 };
    ensure(status === expectedStatus && (!expectedHash || lastObservation.sha256 === expectedHash), "HTTP_READINESS_FAILED");
    if (expectedStatus === 401) {
      let json; try { json = JSON.parse(body.toString("utf8")); } catch {}
      ensure(json && typeof json.error === "string" && json.error.toLowerCase() === "unauthorized", "AUTH_RESPONSE_NOT_VERIFIED");
    }
  }
  function health(index, includeAI) {
    http("/", 200, index); http("/login", 200, index); http("/api/users", 401);
    if (includeAI) http("/api/configurator/ai", 401);
  }
  try {
    noLinks(BACKUP); noLinks(ROOT + "/dist"); noLinks(PMHOME);
    const directory = fs.statSync(BACKUP);
    ensure(directory.uid === 0 && (directory.mode & 0o777) === 0o700, "PRIVATE_BACKUP_PERMISSIONS_CHANGED");
    const mount = JSON.parse(run("findmnt", ["-b", "-J", "-T", BACKUP, "-o", "SOURCE,TARGET,AVAIL"])).filesystems[0];
    ensure(fs.realpathSync(String(mount.source).replace(/\[.*$/, "")) === "/dev/sdb1" &&
      mount.target === ROOT + "/data", "BACKUP_DISK_CHANGED");
    ensure(!fs.existsSync(BACKUP + "/PROMOTED.json"), "RELEASE_ALREADY_PROMOTED");
    lock = BACKUP + "/PROMOTION_LOCK";
    const fd = fs.openSync(lock, "wx", 0o600); locked = true;
    fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
    attempt = fs.mkdtempSync(BACKUP + "/promotion-"); fs.chmodSync(attempt, 0o700);
    mark("verify_prepared_release_and_backups");
    const r = JSON.parse(fs.readFileSync(BACKUP + "/prepared.json", "utf8"));
    ensure(r.status === "PREPARED_NOT_DEPLOYED" && r.backup === BACKUP && r.base === prepared.BASE &&
      r.target === prepared.TARGET && r.tree === prepared.TREE && r.pid === OLD_PID && r.uid === UID &&
      r.processStart === START && String(r.port) === "5000" &&
      r.build === "passed" && r.aiTypecheck === "passed" && r.databaseBlockedTests === "passed" &&
      r.built.backend === BUILT && r.built.index === INDEX && r.built.files === 78 &&
      r.built.manifestSha256 === MANIFEST && r.databaseDump.verified === true &&
      r.internalAI === "not_enabled" && r.gatewayToken === "not_transferred", "PREPARATION_REPORT_CHANGED");
    const checksums = {
      "runtime.tar": "a9b981150bf971c6566e854e48051332208dfff1d94d8ccbafab5245cd091d29",
      "source-base.tar": "737e6e98aceaff080b2fa63bdd701259202098f6bfb615736eab53c235f6fa6e",
      "database.dump": "63216b41ef4308e08a6fdd2ef66d46cfa1cf3b15a062c7192d3eee15fa510ba4",
      "candidate-artifacts.json": MANIFEST,
    };
    for (const [name, expected] of Object.entries(checksums)) {
      noLinks(BACKUP + "/" + name);
      ensure(prepared.fileHash(BACKUP + "/" + name) === expected, "PREPARED_BACKUP_BYTES_CHANGED");
    }
    run("pg_restore", ["--list", BACKUP + "/database.dump"]);
    const stage = BACKUP + "/build", stageDist = stage + "/dist";
    noLinks(stageDist);
    const artifacts = JSON.parse(fs.readFileSync(BACKUP + "/candidate-artifacts.json", "utf8"));
    ensure(JSON.stringify(prepared.artifactManifest(stageDist)) === JSON.stringify(artifacts), "PREPARED_ARTIFACTS_CHANGED");
    ensure(prepared.fileHash(stageDist + "/index.cjs") === BUILT &&
      prepared.fileHash(stageDist + "/public/index.html") === INDEX, "PREPARED_ENTRY_BYTES_CHANGED");
    ensure(git(["rev-parse", "HEAD"]) === prepared.BASE && git(["rev-parse", prepared.TARGET + "^{tree}"]) === prepared.TREE &&
      git(["symbolic-ref", "--short", "HEAD"]) === "main" &&
      !git(["status", "--porcelain", "--untracked-files=no"]), "LIVE_GIT_STATE_CHANGED");
    const changed = git(["diff", "--name-only", prepared.BASE, prepared.TARGET]).split("\n").filter(Boolean);
    ensure(changed.length === prepared.ALLOWED.size && changed.every(p => prepared.ALLOWED.has(p)), "UNREVIEWED_RELEASE_PATHS");
    const baseRows = prepared.gitEntries(git(["ls-tree", "-rz", prepared.BASE, "--", ...changed]));
    const existing = new Set(baseRows.map(row => row.name)), absent = changed.filter(p => !existing.has(p));
    prepared.verifyFiles(ROOT, baseRows, absent);
    prepared.verifyFiles(stage, prepared.gitEntries(git(["ls-tree", "-rz", prepared.TARGET])));
    ensure(prepared.fileHash(ROOT + "/dist/index.cjs") === OLD_BACKEND &&
      prepared.fileHash(ROOT + "/dist/public/index.html") === OLD_INDEX, "LIVE_RUNTIME_BYTES_CHANGED");
    daemonProof();
    pmBinary = userRun("sh", ["-c", "command -v pm2"]).trim();
    ensure(path.isAbsolute(pmBinary) && fs.statSync(fs.realpathSync(pmBinary)).isFile(), "PM2_CLI_UNAVAILABLE");
    const before = pm2();
    ensure(before.process.pid === OLD_PID && before.process.start === START, "LIVE_PROCESS_CHANGED");
    privateJSON(attempt + "/pm2-before.private.json", before.row);
    const envFile = ROOT + "/.env"; noLinks(envFile);
    const envBytes = fs.readFileSync(envFile), envHash = hash(envBytes);
    ensure(hash(run("tar", ["-xOf", BACKUP + "/runtime.tar", ".env"])) === envHash, "ENVIRONMENT_CHANGED_SINCE_PREPARATION");
    const dotenv = require(ROOT + "/node_modules/dotenv").parse(envBytes);
    const liveEnv = liveEnvironment(OLD_PID);
    assertHold(liveEnv, dotenv);
    const pgEnv = { ...environment, ...prepared.databaseEnv(envBytes.toString("utf8"), liveEnv) };
    const query = sql => JSON.parse(run("psql", ["-X", "-w", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: pgEnv }).trim());
    const schema = query("SELECT json_build_object('configuration',to_regclass('public.ai_router_configuration') IS NOT NULL,'audit',to_regclass('public.ai_router_configuration_audit') IS NOT NULL)");
    ensure(schema.configuration === false && schema.audit === false, "AI_CONFIGURATION_APPEARED_SINCE_PREPARATION");
    const defaults = () => query(`SELECT json_build_object('version',version,
      'gatewayDisabled',value->'gateway'->'enabled'='false'::jsonb,'routesEmpty',value->'routes'='{}'::jsonb,
      'gatewayUntested',gateway_check IS NULL,'openaiUntested',openai_check IS NULL,
      'auditCount',(SELECT count(*) FROM ai_router_configuration_audit))
      FROM ai_router_configuration WHERE singleton=true`);
    health(OLD_INDEX, false);
    const profile = fs.statSync(ROOT + "/dist/index.cjs"), entryProfile = fs.statSync(ROOT + "/dist/public/index.html");
    const newProfile = { uid: UID, gid: profile.gid, mode: 0o644 };
    fs.mkdirSync(attempt + "/before", { mode: 0o700 });
    fs.copyFileSync(ROOT + "/dist/index.cjs", attempt + "/before/index.cjs");
    fs.copyFileSync(ROOT + "/dist/public/index.html", attempt + "/before/index.html");
    const oldAssets = prepared.artifactManifest(ROOT + "/dist/public/assets");
    const auxiliary = artifacts.filter(a => !["index.cjs", "public/index.html"].includes(a.path));
    for (const a of auxiliary) {
      ensure(a.path.startsWith("public/"), "UNREVIEWED_BUILD_ARTIFACT_LOCATION");
      const dest = ROOT + "/dist/" + a.path; noLinks(dest);
      if (fs.existsSync(dest)) ensure(fs.lstatSync(dest).isFile() &&
        prepared.fileHash(dest) === a.sha256, "STATIC_ASSET_COLLISION");
    }
    const missingBytes = auxiliary.reduce((total, a) => total + (fs.existsSync(ROOT + "/dist/" + a.path) ? 0 : a.bytes), 0);
    const disk = fs.statfsSync(ROOT + "/dist");
    ensure(disk.bavail * disk.bsize > missingBytes + 2 * fs.statSync(stageDist + "/index.cjs").size + 256 * 1024 ** 2,
      "INSUFFICIENT_SERVING_DISK_SPACE");
    function unchangedConfig() {
      ensure(hash(fs.readFileSync(envFile)) === envHash, "ENVIRONMENT_CHANGED_DURING_PROMOTION");
      const current = pm2();
      ensure(current.configHash === before.configHash, "PM2_ENVIRONMENT_CHANGED");
      assertHold(liveEnvironment(current.process.pid), dotenv);
      return current;
    }
    function restart() {
      daemonProof();
      userRun(pmBinary, ["restart", String(ID)]); // Never --update-env, all, root PM2, or save.
    }
    function waitForRuntime(index, candidate) {
      const deadline = Date.now() + 120000;
      while (true) {
        try {
          const current = unchangedConfig();
          if (candidate) ensure(current.process.pid !== OLD_PID, "CANDIDATE_PROCESS_NOT_STARTED");
          health(index, candidate);
          if (candidate) assertDatabaseHold(defaults());
          return current;
        } catch (error) {
          if (Date.now() >= deadline) throw error;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
        }
      }
    }
    performPromotion({
      phase: mark,
      assets: () => {
        for (const a of auxiliary) if (!fs.existsSync(ROOT + "/dist/" + a.path))
          atomicFile(stageDist + "/" + a.path, ROOT + "/dist/" + a.path, a.sha256, false, newProfile);
      },
      sources: () => {
        ensure(git(["rev-parse", "HEAD"]) === prepared.BASE, "LIVE_HEAD_CHANGED_BEFORE_PROMOTION");
        ensure(unchangedConfig().process.pid === OLD_PID, "LIVE_PROCESS_CHANGED_BEFORE_PROMOTION");
        prepared.verifyFiles(ROOT, baseRows, absent);
        git(["merge", "--ff-only", prepared.TARGET]);
        ensure(git(["rev-parse", "HEAD"]) === prepared.TARGET, "FAST_FORWARD_DID_NOT_REACH_PIN");
        prepared.verifyFiles(ROOT, prepared.gitEntries(git(["ls-tree", "-rz", prepared.TARGET, "--", ...changed])));
      },
      backend: () => {
        ensure(prepared.fileHash(ROOT + "/dist/index.cjs") === OLD_BACKEND, "BACKEND_CHANGED_BEFORE_INSTALL");
        atomicFile(stageDist + "/index.cjs", ROOT + "/dist/index.cjs", BUILT, true, profile);
      },
      restart,
      verifyBackend: () => { after = waitForRuntime(OLD_INDEX, true); },
      entry: () => {
        ensure(prepared.fileHash(ROOT + "/dist/public/index.html") === OLD_INDEX, "FRONTEND_CHANGED_BEFORE_INSTALL");
        atomicFile(stageDist + "/public/index.html", ROOT + "/dist/public/index.html", INDEX, true, entryProfile);
      },
      verifyFinal: () => {
        const initial = after.process;
        for (const a of artifacts) ensure(prepared.fileHash(ROOT + "/dist/" + a.path) === a.sha256, "INSTALLED_ARTIFACT_CHANGED");
        for (const a of oldAssets) ensure(prepared.fileHash(ROOT + "/dist/public/assets/" + a.path) === a.sha256, "OLD_BROWSER_ASSET_LOST");
        for (const a of artifacts.filter(a => a.path.startsWith("public/assets/")))
          http("/" + a.path.slice("public/".length), 200, a.sha256);
        if (oldAssets.length) http("/assets/" + oldAssets[0].path, 200, oldAssets[0].sha256);
        for (let i = 0; i < 3; i++) {
          after = unchangedConfig();
          ensure(after.process.pid === initial.pid && after.process.start === initial.start, "CANDIDATE_PROCESS_RESTARTED");
          health(INDEX, true); assertDatabaseHold(defaults());
          if (i < 2) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
        }
        ensure(git(["rev-parse", "HEAD"]) === prepared.TARGET &&
          !git(["status", "--porcelain", "--untracked-files=no"]), "FINAL_SOURCE_STATE_CHANGED");
      },
      complete: () => {
        report = { status: "DEPLOYED_OPENAI_ONLY", target: prepared.TARGET, tree: prepared.TREE,
          backup: BACKUP, attempt, pm2: { id: ID, name: "indexus-crm", uid: UID, daemon: DAEMON,
            pid: after.process.pid, processStart: after.process.start, environmentUnchanged: true },
          built: { backend: BUILT, index: INDEX, files: artifacts.length }, oldBrowserAssetsPreserved: oldAssets.length,
          startupOfCandidate: "verified", unauthenticatedAIAPI: 401, databaseDefaults: "verified_openai_only",
          internalAI: "not_enabled", gatewayToken: "not_transferred", gatewayCalls: "not_attempted",
          databaseRestored: false, signedInUI: "not_verified", completedAt: new Date().toISOString() };
        privateJSON(attempt + "/result.json", report);
        privateJSON(BACKUP + "/PROMOTED.json", report);
      },
      failure: error => privateJSON(attempt + "/failed-check.json", { phase: error.failedPhase,
        code: /^[A-Z0-9_]+$/.test(error.message || "") ? error.message : "PRIVATE_DETAILS_NOT_PRINTED",
        nativeStatus: error.nativeStatus ?? null, observation: lastObservation }),
      restoreEntry: () => atomicFile(attempt + "/before/index.html", ROOT + "/dist/public/index.html", OLD_INDEX, true, entryProfile),
      restoreBackend: () => atomicFile(attempt + "/before/index.cjs", ROOT + "/dist/index.cjs", OLD_BACKEND, true, profile),
      verifyRecovery: restarted => {
        ensure(prepared.fileHash(ROOT + "/dist/index.cjs") === OLD_BACKEND &&
          prepared.fileHash(ROOT + "/dist/public/index.html") === OLD_INDEX, "PREVIOUS_RUNTIME_NOT_RESTORED");
        if (restarted) waitForRuntime(OLD_INDEX, false); else health(OLD_INDEX, false);
      },
    });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    let sourceHead = null;
    try { sourceHead = git(["rev-parse", "HEAD"]); } catch {}
    const result = { status: error.runtimeRecovery === "previous_runtime_verified" ? "FAILED_PREVIOUS_RUNTIME_RESTORED" :
      error.runtimeRecovery === "operator_attention_required" ? "FAILED_OPERATOR_ATTENTION_REQUIRED" : "STOPPED_NO_RUNTIME_ACTIVATION",
      phase: error.failedPhase || phase,
      code: /^[A-Z0-9_]+$/.test(error.message || "") ? error.message : "PRIVATE_DETAILS_NOT_PRINTED",
      runtimeRecovery: error.runtimeRecovery || "not_needed", sourceHead,
      sourcesAtTarget: sourceHead === prepared.TARGET,
      schemaMayHaveChanged: error.schemaMayHaveChanged || false, databaseRestored: false,
      gitResetAttempted: false, privateLogs: attempt || null, observation: lastObservation };
    if (attempt) try { privateJSON(attempt + "/result.json", result); } catch {}
    console.error(JSON.stringify(result, null, 2)); process.exitCode = 1;
  } finally { if (locked) fs.unlinkSync(lock); }
}
module.exports = { assertHold, assertDatabaseHold, atomicFile, configHash, decodeHTTP, performPromotion, main };
if (require.main === module) {
  try { main(); } catch { console.error("AI_PROMOTE_REFUSED_NO_OPERATION"); process.exitCode = 1; }
}
