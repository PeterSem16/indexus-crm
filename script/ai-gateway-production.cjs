#!/usr/bin/env node
"use strict";
// Prepared tooling only: production modes require separate, explicit approval.
const fs = require("node:fs"), path = require("node:path");
const P = require("./lib/ai-gateway-policy.cjs"), H = require("./lib/ai-gateway-host.cjs");
const { C, ensure, hash } = P;
const SOURCES = ["script/ai-gateway-production.cjs", "script/lib/ai-gateway-policy.cjs",
  "script/lib/ai-gateway-host.cjs", "script/ai-gateway-production.test.cjs", "ops/ai-gateway/preload.cjs",
  "script/lib/ai-gateway-preflight.cjs", "script/ai-gateway-preflight.test.cjs"];
const SOURCE_ROOT = path.resolve(__dirname, "..");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function source(name) { return H.file(path.join(SOURCE_ROOT, name)).bytes; }
function safeError(error) {
  // Never serialize raw OS, SDK, HTTP, vendor or PostgreSQL exceptions.
  return /^[A-Z][A-Z0-9_]{2,90}$/.test(error?.operatorCode || "") ? error.operatorCode : "GATEWAY_OPERATION_STOPPED";
}
function assertBackupDirectory(directory) {
  ensure(path.dirname(directory) === C.backupRoot && /^attempt-[A-Za-z0-9-]+$/.test(path.basename(directory)),
    "INVALID_BACKUP_PATH");
  H.noLinks(directory);
  for (const p of [C.backupRoot, directory]) {
    const s = fs.statSync(p);
    ensure(s.isDirectory() && s.uid === 0 && s.gid === 0 && (s.mode & 0o7777) === 0o700, "UNSAFE_BACKUP_PERMISSIONS");
  }
}
function readManifest(directory) {
  assertBackupDirectory(directory);
  const f = H.file(directory + "/manifest.json");
  ensure(f.uid === 0 && f.mode === 0o600, "UNSAFE_BACKUP_MANIFEST");
  const m = JSON.parse(f.bytes);
  ensure(m.version === 1 && m.directory === directory && m.head === C.head, "INVALID_BACKUP_MANIFEST");
  return m;
}
function updatedManifest(directory, m) { H.privateJSON(directory + "/manifest.json", m, true); }
function loadSnapshot(directory, m) {
  const f = H.file(directory + "/snapshot.private.json");
  ensure(f.uid === 0 && f.mode === 0o600 && hash(f.bytes) === m.snapshotSHA256, "SNAPSHOT_INTEGRITY_FAILED");
  return JSON.parse(f.bytes);
}
function verifyBackupFiles(directory, m) {
  for (const [name, info] of Object.entries(m.files)) {
    ensure(/^[a-z0-9_.-]+$/.test(name), "INVALID_BACKUP_ENTRY");
    if (info === null) continue;
    const f = H.file(directory + "/files/" + name);
    ensure(f.uid === 0 && f.mode === 0o600 && hash(f.bytes) === info.sha256, "BACKUP_INTEGRITY_FAILED");
  }
  for (const [name, expected] of Object.entries(m.bundle)) {
    ensure(SOURCES.includes(name), "INVALID_BUNDLE_ENTRY");
    const f = H.file(directory + "/bundle/" + name);
    ensure(f.uid === 0 && f.mode === 0o600 && hash(f.bytes) === expected, "ROLLBACK_BUNDLE_CHANGED");
  }
  ensure(Object.keys(m.bundle).length === SOURCES.length, "INCOMPLETE_ROLLBACK_BUNDLE");
  ensure(hash(H.file(directory + "/rollback.cjs").bytes) === m.rollbackSHA256, "ROLLBACK_EXECUTABLE_CHANGED");
}
class Operations {
  async preflight() {
    this.pre = await H.preflight();
    P.verifyLoader(source("ops/ai-gateway/preload.cjs").toString());
    this.rows = H.rpc(this.pre.pm2, "list");
    this.before = H.application(this.rows);
    ensure(this.before.pid === C.initialPID, "INITIAL_WORKER_CHANGED");
    const managed = { ...this.before.pm2_env, ...this.before.pm2_env.env };
    ensure(managed.OPENAI_API_KEY === this.pre.env.OPENAI_API_KEY &&
      managed.DATABASE_URL === this.pre.env.DATABASE_URL, "LIVE_PM2_ENVIRONMENT_DIFFERS");
    ensure(!this.before.pm2_env.node_args?.length, "EXISTING_NODE_ARGUMENTS");
    P.assertNoToken(this.rows, "unused-synthetic-token-marker");
  }
  async backup() {
    H.disk(); H.noLinks(C.backupRoot);
    if (!fs.existsSync(C.backupRoot)) fs.mkdirSync(C.backupRoot, { mode: 0o700 });
    const s = fs.statSync(C.backupRoot);
    ensure(s.uid === 0 && s.gid === 0 && (s.mode & 0o7777) === 0o700, "UNSAFE_BACKUP_ROOT");
    this.lock = C.backupRoot + "/operation.lock";
    const fd = fs.openSync(this.lock, "wx", 0o600); this.lockOwned = true;
    fs.writeFileSync(fd, String(process.pid)); fs.fsyncSync(fd); fs.closeSync(fd);
    H.aclAbsent([C.backupRoot]);
    const dir = C.backupRoot + "/attempt-" + require("node:crypto").randomUUID();
    fs.mkdirSync(dir, { mode: 0o700 }); fs.mkdirSync(dir + "/files", { mode: 0o700 });
    this.directory = dir;
    const files = {};
    const targets = { "dotenv": C.root + "/.env", "ecosystem": C.root + "/ecosystem.config.cjs",
      "dump.pm2": C.home + "/dump.pm2", "dump.pm2.bak": C.home + "/dump.pm2.bak" };
    for (const [name, target] of Object.entries(targets)) {
      const f = H.file(target, name === "dump.pm2.bak");
      files[name] = f ? { target, sha256: hash(f.bytes), uid: f.uid, gid: f.gid, mode: f.mode } : null;
      if (f) H.atomic(dir + "/files/" + name, f.bytes, { uid: 0, gid: 0, mode: 0o600 });
    }
    const bundle = {};
    for (const name of SOURCES) {
      const destination = dir + "/bundle/" + name;
      fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      const bytes = source(name);
      H.atomic(destination, bytes, { uid: 0, gid: 0, mode: 0o600 }); bundle[name] = hash(bytes);
    }
    const snapshot = { row: this.before, rows: this.rows, initialEnvironment: this.pre.env, ai: this.pre.ai, pm2: this.pre.pm2 };
    H.privateJSON(dir + "/snapshot.private.json", snapshot);
    const rollback = `#!/usr/bin/env node
"use strict";
require("./bundle/script/ai-gateway-production.cjs").main(["--rollback",__dirname,...process.argv.slice(2)])
 .catch(()=>{console.error('ROLLBACK_STOPPED_OPERATOR_ATTENTION_REQUIRED');process.exitCode=1;});
`;
    H.atomic(dir + "/rollback.cjs", rollback, { uid: 0, gid: 0, mode: 0o600 });
    const m = { version: 1, directory: dir, head: C.head, files, bundle, rollbackSHA256: hash(rollback),
      snapshotSHA256: hash(H.file(dir + "/snapshot.private.json").bytes),
      expected: {}, runtimeCreated: false, restartAttempted: false, dumpWritten: false, unitTouched: false,
      enableAttempted: false, status: "BACKUP_CREATED_NOT_APPLIED" };
    H.privateJSON(dir + "/manifest.json", m);
    this.directory = dir;
    return dir;
  }
  async verifyBackup(dir) {
    const m = readManifest(dir);
    verifyBackupFiles(dir, m); loadSnapshot(dir, m);
    ensure(m.files.ecosystem.sha256 === C.ecosystemHash &&
      m.files.dotenv.sha256 === hash(this.pre.dotenv.bytes), "CONFIGURATION_CHANGED_DURING_BACKUP");
    for (const user of ["seman", "www-data"]) {
      H.command("runuser", ["-u", user, "--", "test", "!", "-r", dir + "/snapshot.private.json"]);
    }
    H.command("/usr/bin/node", ["--check", dir + "/rollback.cjs"]);
    const result = H.command("/usr/bin/node", ["--test", dir + "/bundle/script/ai-gateway-production.test.cjs",
      dir + "/bundle/script/ai-gateway-preflight.test.cjs"]);
    ensure(result.includes("# fail 0") || /ℹ fail 0/.test(result), "ROLLBACK_TEST_SUITE_FAILED");
    H.atomic(dir + "/pm2-seman.service", this.pre.unit, { uid: 0, gid: 0, mode: 0o600 });
    H.command("systemd-analyze", ["verify", dir + "/pm2-seman.service"]);
    m.backupVerified = true; updatedManifest(dir, m);
  }
  assertProtected(dir, m) {
    const dotenv = H.file(C.root + "/.env"), original = m.files.dotenv;
    ensure(hash(dotenv.bytes) === original.sha256 && dotenv.uid === original.uid &&
      dotenv.gid === original.gid && dotenv.mode === original.mode, "DOTENV_CHANGED");
    ensure(hash(H.file(C.root + "/dist/index.cjs").bytes) === C.backend, "BACKEND_CHANGED");
    H.daemon(); H.disk();
  }
  async install(dir) {
    const m = readManifest(dir); ensure(m.backupVerified, "VERIFIED_BACKUP_REQUIRED");
    this.assertProtected(dir, m);
    const current = H.rpc(this.pre.pm2, "list");
    ensure(H.application(current).pid === C.initialPID, "WORKER_CHANGED_BEFORE_INSTALL");
    P.assertPreserved(this.before, H.application(current)); P.assertOtherProcesses(this.rows, current);
    P.assertRoutes(await H.readAI(this.pre.env));
    ensure(hash(H.file(C.root + "/ecosystem.config.cjs").bytes) === C.ecosystemHash, "ECOSYSTEM_CHANGED_BEFORE_INSTALL");
    const original = H.file(C.token);
    ensure(original.uid === 0 && original.gid === 0 && original.mode === 0o600, "TOKEN_PERMISSIONS_CHANGED");
    this.tokenBytes = original.bytes;
    this.token = original.bytes.toString("utf8").replace(/\r?\n$/, "");
    ensure(/^[\x21-\x7e]{16,8192}$/.test(this.token), "TOKEN_FORMAT_REQUIRES_REVIEW");
    P.assertNoToken(current, this.token);
    const json = JSON.stringify({ baseURL: "https://ai.cordbloodcenter.com/gateway/", enabled: true, mode: "routed", token: this.token });
    const loader = source("ops/ai-gateway/preload.cjs"), ecosystem = P.transformEcosystem(this.pre.ecosystem.bytes.toString());
    m.expected = { [C.runtime + "/gateway.json"]: hash(json), [C.loader]: hash(loader),
      [C.root + "/ecosystem.config.cjs"]: hash(ecosystem), [C.unit]: hash(this.pre.unit) };
    m.originalToken = { sha256: hash(original.bytes), uid: original.uid, gid: original.gid, mode: original.mode };
    m.runtimeCreationAttempted = true; updatedManifest(dir, m);
    ensure(!fs.lstatSync(C.runtime, { throwIfNoEntry: false }), "RUNTIME_TARGET_COLLISION");
    this.failureStage = "runtimeDirectoryCreate";
    fs.mkdirSync(C.runtime, { mode: 0o750 }); fs.chownSync(C.runtime, 0, C.gid); fs.chmodSync(C.runtime, 0o750);
    const created = fs.statSync(C.runtime);
    m.runtimeCreated = true; m.runtimeIdentity = { ino: created.ino, dev: created.dev }; updatedManifest(dir, m);
    this.failureStage = "runtimeConfigurationInstall";
    H.atomic(C.runtime + "/gateway.json", json, { uid: 0, gid: C.gid, mode: 0o640 });
    this.failureStage = "runtimeLoaderInstall";
    H.atomic(C.loader, loader, { uid: 0, gid: 0, mode: 0o644 });
    this.failureStage = "runtimeACLValidation";
    H.aclAbsent([C.runtime, C.runtime + "/gateway.json", C.loader]);
    this.failureStage = "ecosystemInstall";
    H.atomic(C.root + "/ecosystem.config.cjs", ecosystem, m.files.ecosystem, true);
    m.status = "RUNTIME_FILES_INSTALLED_NOT_RESTARTED"; updatedManifest(dir, m);
  }
  async testInstalledLoader(dir) {
    this.failureStage = "installedLoaderValidation";
    const out = H.command("runuser", ["-u", "seman", "--", "/usr/bin/node", "--require", C.loader, "-e",
      "if(process.env.INDEXUS_AI_GATEWAY_ENABLED!=='true'||!process.env.INDEXUS_AI_GATEWAY_TOKEN||" +
      "process.env.OPENAI_API_KEY!=='synthetic-openai-marker')process.exit(1);process.stdout.write('LOADER_READY');"],
    { env: { PATH: "/usr/bin:/bin", HOME: "/home/seman", NODE_ENV: "production", OPENAI_API_KEY: "synthetic-openai-marker" } });
    ensure(out === "LOADER_READY", "INSTALLED_LOADER_TEST_FAILED");
    const m = readManifest(dir); m.installedLoaderVerified = true; updatedManifest(dir, m);
  }
  async restart(dir) {
    const m = readManifest(dir);
    ensure(m.backupVerified && m.installedLoaderVerified, "RESTART_PREREQUISITES_MISSING");
    verifyBackupFiles(dir, m); this.assertProtected(dir, m);
    P.assertRoutes(await H.readAI(this.pre.env));
    const current = H.application(H.rpc(this.pre.pm2, "list"));
    ensure(current.pid === C.initialPID, "WORKER_CHANGED_BEFORE_RESTART");
    P.assertPreserved(this.before, current);
    m.restartAttempted = true; updatedManifest(dir, m);
    this.failureStage = "restartDispatch";
    H.rpc(this.pre.pm2, "restart", P.args());
  }
  async recordFailure(dir, failure) {
    const m = readManifest(dir);
    m.applyFailure = failure;
    updatedManifest(dir, m);
  }
  async verifyRollback(dir) {
    // Read-only, also supports the original attempt's unmodified backup bundle.
    const m = readManifest(dir); verifyBackupFiles(dir, m);
    ensure(["ROLLBACK_VERIFIED_OPENAI_ONLY", "ROLLBACK_RUNTIME_RESTORED_GATEWAY_DB_DISABLE_REQUIRED"]
      .includes(m.status), "ROLLBACK_STATUS_REQUIRES_REVIEW");
    const snapshot = loadSnapshot(dir, m);
    this.assertProtected(dir, m);
    const rows = H.rpc(snapshot.pm2, "list"), current = H.application(rows);
    P.assertPreserved(snapshot.row, current); P.assertOtherProcesses(snapshot.rows, rows);
    ensure(JSON.stringify(current.pm2_env.node_args ?? []) === JSON.stringify(snapshot.row.pm2_env.node_args ?? []),
      "ROLLBACK_NODE_ARGUMENTS_DIFFER");
    if (!m.restartAttempted)
      ensure(current.pid === snapshot.row.pid && H.proc(current.pid).start === C.initialStart,
        "ROLLBACK_WORKER_IDENTITY_DIFFERS");
    const actual = H.initialEnvironment(current.pid);
    for (const [key, value] of Object.entries(snapshot.initialEnvironment))
      ensure(actual[key] === value, "ROLLBACK_PROCESS_ENVIRONMENT_DIFFERS");
    ensure(!actual.INDEXUS_AI_GATEWAY_TOKEN && actual.INDEXUS_AI_GATEWAY_ENABLED !== "true",
      "ROLLBACK_GATEWAY_RUNTIME_ENABLED");
    for (const [name, original] of Object.entries(m.files)) {
      const target = name === "dotenv" ? C.root + "/.env" : name === "ecosystem" ?
        C.root + "/ecosystem.config.cjs" : C.home + "/" + name;
      const f = H.file(target, true);
      ensure(original ? f && hash(f.bytes) === original.sha256 && f.uid === original.uid &&
        f.gid === original.gid && f.mode === original.mode : !f, "ROLLBACK_FILE_PROFILE_DIFFERS");
    }
    for (const target of [C.runtime, C.unit, C.link])
      ensure(!fs.lstatSync(target, { throwIfNoEntry: false }), "ROLLBACK_TARGET_REMAINS");
    ensure(m.originalToken, "ROLLBACK_TOKEN_EVIDENCE_MISSING");
    const token = H.file(C.token), expected = m.originalToken;
    ensure(hash(token.bytes) === expected.sha256 && token.uid === expected.uid &&
      token.gid === expected.gid && token.mode === expected.mode, "ORIGINAL_TOKEN_CHANGED");
    const ai = await H.readAI(snapshot.initialEnvironment);
    P.assertRoutes(ai); H.health();
    const probe = H.command("runuser", ["-u", "seman", "--", "/usr/bin/node", "-e",
      "if(process.env.NODE_ENV!=='production'||process.env.OPENAI_API_KEY!=='synthetic-openai-marker')" +
      "process.exit(1);process.stdout.write('SYNTHETIC_ENVIRONMENT_PRESERVED');"],
    { env: { PATH: "/usr/bin:/bin", HOME: "/home/seman", NODE_ENV: "production", OPENAI_API_KEY: "synthetic-openai-marker" } });
    ensure(probe === "SYNTHETIC_ENVIRONMENT_PRESERVED", "ROLLBACK_ENVIRONMENT_PROBE_FAILED");
    return { status: "ROLLBACK_READ_ONLY_VERIFIED", toolDirectory: SOURCE_ROOT,
      productionChanges: false, restarts: 0,
      inferenceRequests: 0, gatewayRequests: 0, backupIntegrityVerified: true,
      pm2ConfigurationVerified: true, processEnvironmentVerified: true, originalFilesVerified: true,
      runtimeAndBootTargetsAbsent: true, originalTokenVerified: true,
      openaiRoutes: 65, gatewayEnabledInINDEXUS: false, syntheticRunuserEnvironmentVerified: true,
      originalFailureRecorded: !!m.applyFailure };
  }
  async waitRuntime(snapshot, nodeArgs, mustChangePID) {
    const deadline = Date.now() + 120000;
    do {
      try {
        const rows = H.rpc(snapshot.pm2, "list"), row = H.application(rows);
        P.assertPreserved(snapshot.row, row); P.assertOtherProcesses(snapshot.rows, rows);
        ensure(JSON.stringify(row.pm2_env.node_args || []) === JSON.stringify(nodeArgs || []), "NODE_ARGUMENTS_NOT_APPLIED");
        if (mustChangePID) ensure(row.pid !== snapshot.row.pid, "WORKER_NOT_RESTARTED");
        // PM2's lowercase runtime metadata changes on restart; compare all original
        // application variables recorded in its nested env and uppercase config.
        const actual = H.initialEnvironment(row.pid);
        const keys = new Set([...Object.keys(snapshot.row.pm2_env.env), ...Object.keys(P.envValues(snapshot.row).direct)]);
        for (const k of keys) if (Object.hasOwn(snapshot.initialEnvironment, k))
          ensure(actual[k] === snapshot.initialEnvironment[k], "APPLICATION_ENVIRONMENT_CHANGED");
        H.health(); P.assertOpenAI(await H.readAI(snapshot.initialEnvironment));
        return { row, rows };
      } catch { if (Date.now() >= deadline) ensure(false, "RUNTIME_VERIFICATION_FAILED"); await sleep(1000); }
    } while (true);
  }
  async verifyRuntime(dir) {
    const m = readManifest(dir), snapshot = loadSnapshot(dir, m);
    this.after = await this.waitRuntime(snapshot, P.args(), true);
    this.assertProtected(dir, m);
    ensure(H.file(C.token).bytes.equals(this.tokenBytes), "ORIGINAL_TOKEN_CHANGED");
    P.assertNoToken(this.after.rows, this.token);
  }
  async saveDump(dir) {
    const m = readManifest(dir), snapshot = loadSnapshot(dir, m);
    const rows = H.rpc(snapshot.pm2, "list"); P.assertOtherProcesses(snapshot.rows, rows);
    const dump = JSON.stringify(P.dumpRows(rows), null, 2);
    P.assertNoToken(dump, this.token);
    for (const [name, original] of Object.entries(m.files).filter(([n]) => n.startsWith("dump"))) {
      const current = H.file(C.home + "/" + name, true);
      ensure(original ? current && hash(current.bytes) === original.sha256 : !current, "PM2_DUMP_CHANGED_EXTERNALLY");
    }
    m.dumpWritten = true; m.expectedDump = { "dump.pm2": hash(dump), "dump.pm2.bak": m.files["dump.pm2"].sha256 };
    updatedManifest(dir, m);
    H.atomic(C.home + "/dump.pm2.bak", H.file(dir + "/files/dump.pm2").bytes,
      { uid: C.uid, gid: C.gid, mode: 0o600 }, !!m.files["dump.pm2.bak"]);
    H.atomic(C.home + "/dump.pm2", dump, { uid: C.uid, gid: C.gid, mode: 0o600 }, true);
  }
  async enableBoot(dir) {
    const m = readManifest(dir);
    m.unitTouched = true; updatedManifest(dir, m);
    H.atomic(C.unit, this.pre.unit, { uid: 0, gid: 0, mode: 0o644 });
    m.unitCreated = true; updatedManifest(dir, m);
    H.command("systemd-analyze", ["verify", C.unit]);
    H.command("systemctl", ["daemon-reload"]);
    m.enableAttempted = true; updatedManifest(dir, m);
    H.command("systemctl", ["enable", "pm2-seman.service"]);
    ensure(fs.lstatSync(C.link).isSymbolicLink() && fs.realpathSync(C.link) === C.unit, "BOOT_LINK_NOT_VERIFIED");
    ensure(H.command("systemctl", ["is-enabled", "pm2-seman.service"]).trim() === "enabled", "BOOT_NOT_ENABLED");
  }
  async verifyFinal(dir) {
    const m = readManifest(dir);
    for (const [target, expected] of Object.entries(m.expected))
      ensure(hash(H.file(target).bytes) === expected, "INSTALLED_FILE_CHANGED");
    await this.verifyRuntime(dir);
    const ai = await H.readAI(this.pre.env); P.assertRoutes(ai);
    ensure(H.command("systemctl", ["show", "pm2-seman.service", "--property=MainPID", "--value"]).trim() === "0",
      "NEW_BOOT_SERVICE_UNEXPECTEDLY_STARTED");
  }
  async complete(dir) {
    const m = readManifest(dir); m.status = "RUNTIME_READY_OPENAI_ONLY_AWAITING_ADMIN_TESTS"; updatedManifest(dir, m);
    const result = { status: m.status, backup: dir, openaiRoutes: 65, routesChanged: false,
      originalDotenvUnchanged: true, originalTokenUnchanged: true, gatewayRequests: 0,
      startup: "enabled_static_verified_not_started", rebootTest: "not_performed",
      signedInUI: "not_verified", gatewayConnectivity: "not_run", gatewaySmoke: "not_run" };
    H.privateJSON(dir + "/result.json", result);
    return result;
  }
  async recover(dir, state = {}) {
    const m = readManifest(dir); verifyBackupFiles(dir, m);
    const snapshot = loadSnapshot(dir, m); this.assertProtected(dir, m);
    if (m.runtimeCreationAttempted && !m.runtimeCreated && fs.existsSync(C.runtime))
      ensure(false, "UNCONFIRMED_RUNTIME_DIRECTORY");
    if (m.unitTouched && !m.unitCreated && fs.existsSync(C.unit))
      ensure(false, "UNCONFIRMED_BOOT_UNIT");
    // Disable the runtime gate first. Never delete an externally modified file.
    if (m.runtimeCreated && fs.existsSync(C.runtime + "/gateway.json")) {
      ensure(hash(H.file(C.runtime + "/gateway.json").bytes) === m.expected[C.runtime + "/gateway.json"], "RUNTIME_CONFIG_CHANGED");
    }
    const current = H.application(H.rpc(snapshot.pm2, "list"), true);
    P.assertPreserved(snapshot.row, current); P.assertOtherProcesses(snapshot.rows, H.rpc(snapshot.pm2, "list"));
    if (m.restartAttempted) {
      H.rpc(snapshot.pm2, "restart", Object.hasOwn(snapshot.row.pm2_env, "node_args") ? snapshot.row.pm2_env.node_args : "null");
      await this.waitRuntime(snapshot, snapshot.row.pm2_env.node_args, true);
    }
    const restore = name => {
      const original = m.files[name], target = name === "ecosystem" ? C.root + "/ecosystem.config.cjs" : C.home + "/" + name;
      const existing = H.file(target, true);
      const allowed = name === "ecosystem" ? m.expected[target] : m.expectedDump?.[name];
      ensure(!existing || (original && hash(existing.bytes) === original.sha256) || hash(existing.bytes) === allowed,
        "RESTORE_TARGET_CHANGED_EXTERNALLY");
      if (original) H.atomic(target, H.file(dir + "/files/" + name).bytes, original, !!existing);
      else if (existing) fs.unlinkSync(target);
    };
    if (m.expected[C.root + "/ecosystem.config.cjs"]) restore("ecosystem");
    if (m.dumpWritten) { restore("dump.pm2"); restore("dump.pm2.bak"); }
    if (m.unitTouched && fs.existsSync(C.unit)) {
      ensure(hash(H.file(C.unit).bytes) === m.expected[C.unit], "BOOT_UNIT_CHANGED_EXTERNALLY");
      if (fs.lstatSync(C.link, { throwIfNoEntry: false })) {
        ensure(fs.lstatSync(C.link).isSymbolicLink() && fs.realpathSync(C.link) === C.unit, "BOOT_LINK_CHANGED");
        H.command("systemctl", ["disable", "pm2-seman.service"]); // NEVER --now
      }
      fs.unlinkSync(C.unit); H.command("systemctl", ["daemon-reload"]);
    }
    if (m.runtimeCreated && fs.existsSync(C.runtime)) {
      const currentDirectory = fs.statSync(C.runtime);
      ensure(currentDirectory.ino === m.runtimeIdentity.ino && currentDirectory.dev === m.runtimeIdentity.dev &&
        currentDirectory.uid === 0 && currentDirectory.gid === C.gid &&
        (currentDirectory.mode & 0o7777) === 0o750, "RUNTIME_DIRECTORY_CHANGED");
      for (const target of [C.runtime + "/gateway.json", C.loader]) {
        if (!fs.existsSync(target)) continue;
        ensure(hash(H.file(target).bytes) === m.expected[target], "RUNTIME_FILE_CHANGED_EXTERNALLY"); fs.unlinkSync(target);
      }
      fs.rmdirSync(C.runtime);
    }
    const ai = await H.readAI(snapshot.initialEnvironment); P.assertOpenAI(ai); H.health();
    if (m.originalToken) {
      const original = H.file(C.token);
      ensure(hash(original.bytes) === m.originalToken.sha256 && original.uid === m.originalToken.uid &&
        original.gid === m.originalToken.gid && original.mode === m.originalToken.mode, "ORIGINAL_TOKEN_CHANGED");
    }
    m.status = ai.value.gateway.enabled ? "ROLLBACK_RUNTIME_RESTORED_GATEWAY_DB_DISABLE_REQUIRED" : "ROLLBACK_VERIFIED_OPENAI_ONLY";
    updatedManifest(dir, m);
    return { status: m.status, backup: dir, routesChanged: false, databaseRestored: false, rebootPerformed: false };
  }
  release() { if (this.lockOwned) { fs.unlinkSync(this.lock); this.lockOwned = false; } }
}
function parseArgs(argv) {
  if (argv.length === 1 && ["--self-test", "--preflight"].includes(argv[0])) return { mode: argv[0] };
  if (argv.length === 2 && argv[0] === "--verify-rollback")
    return { mode: "--verify-rollback", directory: argv[1] };
  if (argv.length === 3 && argv[0] === "--apply" && argv[1] === "--approve" && argv[2] === C.approval)
    return { mode: "--apply" };
  if (argv.length === 4 && argv[0] === "--rollback" && argv[2] === "--approve" && argv[3] === C.rollbackApproval)
    return { mode: "--rollback", directory: argv[1] };
  ensure(false, "EXPLICIT_SEPARATE_APPROVAL_REQUIRED");
}
async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  if (parsed.mode === "--self-test") {
    const cases = P.verifyLoader(source("ops/ai-gateway/preload.cjs").toString());
    console.log(JSON.stringify({ status: "SYNTHETIC_SELF_TEST_PASSED", cases, productionChanges: false })); return;
  }
  const io = new Operations();
  try {
    let result;
    if (parsed.mode === "--preflight") {
      result = await require("./lib/ai-gateway-preflight.cjs").run({ sourceRoot: SOURCE_ROOT, sources: SOURCES });
      if (result.status === "BLOCKED") process.exitCode = 1;
    } else if (parsed.mode === "--verify-rollback") {
      ensure(require("node:os").hostname().toUpperCase() === "CORPCRM01" && process.getuid() === 0, "ROOT_ON_CORPCRM01_REQUIRED");
      result = await io.verifyRollback(parsed.directory);
    } else if (parsed.mode === "--apply") result = await P.applyFlow(io);
    else {
      ensure(require("node:os").hostname().toUpperCase() === "CORPCRM01" && process.getuid() === 0, "ROOT_ON_CORPCRM01_REQUIRED");
      assertBackupDirectory(parsed.directory); H.disk(); H.daemon();
      io.lock = C.backupRoot + "/operation.lock"; const fd = fs.openSync(io.lock, "wx", 0o600);
      io.lockOwned = true; fs.closeSync(fd);
      result = await io.recover(parsed.directory);
    }
    console.log(JSON.stringify(result, null, 2)); return result;
  } catch (error) {
    if (io.directory && !error.backup) error.backup = io.directory;
    throw error;
  } finally { io.release(); }
}
module.exports = { Operations, parseArgs, safeError, main, SOURCES, assertBackupDirectory, verifyBackupFiles };
if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ status: "OPERATION_STOPPED", code: safeError(error),
    ...(error.failure ? { failure: error.failure, failureRecorded: error.failureRecorded } : {}),
    ...(error.backup ? { backup: error.backup } : {}) })); process.exitCode = 1;
});
