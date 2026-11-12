"use strict";
const crypto = require("node:crypto"), vm = require("node:vm");
const C = Object.freeze({
  root: "/var/www/indexus-crm", data: "/var/www/indexus-crm/data",
  home: "/home/seman/.pm2", uid: 1001, gid: 1001, appID: 4, daemon: 22545,
  daemonStart: "49248242", initialPID: 833559, initialStart: "2644446143",
  head: "52902d20b5bad42c60d543f365d33badae647f05", nodeVersion: "v20.20.0",
  backend: "f6183a3f0766eeb3446de366b9fac38c42f92817d0a9801cc402dc036957687d",
  ecosystemHash: "d3463a77b496f81e07ad6421fb6e5c943337c59916a2c695a5de12554e4a61d0",
  runtime: "/etc/indexus-ai-runtime", loader: "/etc/indexus-ai-runtime/preload.cjs",
  token: "/etc/indexus-ai/gateway-token", unit: "/etc/systemd/system/pm2-seman.service",
  link: "/etc/systemd/system/multi-user.target.wants/pm2-seman.service",
  backupRoot: "/var/www/indexus-crm/data/.ai-gateway-private",
  approval: "CORPCRM01_GATEWAY_RUNTIME_CHANGE_APPROVED",
  rollbackApproval: "CORPCRM01_GATEWAY_ROLLBACK_APPROVED",
});
const ensure = (condition, code) => {
  if (!condition) { const error = Error(code); error.operatorCode = code; throw error; }
};
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const args = () => ["--require", C.loader];
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
}
function envValues(row) {
  const e = row.pm2_env;
  ensure(e && e.env && typeof e.env === "object", "PM2_ENVIRONMENT_UNAVAILABLE");
  const direct = Object.fromEntries(Object.entries(e).filter(([k]) => /^[A-Z][A-Z0-9_]*$/.test(k)));
  return stable({ direct, nested: e.env });
}
function assertPreserved(before, after) {
  ensure(JSON.stringify(envValues(before)) === JSON.stringify(envValues(after)), "PM2_ENVIRONMENT_CHANGED");
  for (const key of ["pm_cwd", "pm_exec_path", "exec_interpreter", "exec_mode", "watch",
    "autorestart", "max_memory_restart", "kill_timeout", "wait_ready", "namespace"]) {
    ensure(JSON.stringify(before.pm2_env[key]) === JSON.stringify(after.pm2_env[key]), "PM2_SETTINGS_CHANGED");
  }
}
function assertOtherProcesses(before, after) {
  const comparable = rows => rows.filter(r => r.pm_id !== C.appID).map(r => ({
    id: r.pm_id, pid: r.pid, name: r.name, env: envValues(r), nodeArgs: r.pm2_env.node_args,
    cwd: r.pm2_env.pm_cwd, script: r.pm2_env.pm_exec_path,
  }));
  ensure(JSON.stringify(stable(comparable(before))) === JSON.stringify(stable(comparable(after))), "OTHER_PM2_PROCESS_CHANGED");
}
function transformEcosystem(source) {
  ensure(hash(source) === C.ecosystemHash, "ECOSYSTEM_BASELINE_CHANGED");
  const anchor = "    script: 'dist/index.cjs',";
  ensure(source.split(anchor).length === 2 && !/\bnode_args\b|\binterpreter_args\b/.test(source),
    "ECOSYSTEM_REQUIRES_REVIEW");
  return source.replace(anchor, anchor + "\n    node_args: ['--require', '" + C.loader + "'],");
}
function assertRoutes(row) {
  ensure(row && row.version === 1 && row.value && row.value.gateway?.enabled === false &&
    row.value.gateway.baseURL === "https://ai.cordbloodcenter.com/gateway/" &&
    row.value.routes && !Array.isArray(row.value.routes) && Object.keys(row.value.routes).length === 0,
    "AI_OPENAI_BASELINE_CHANGED");
}
function assertOpenAI(row) {
  ensure(row?.value?.routes && !Array.isArray(row.value.routes) &&
    Object.keys(row.value.routes).length === 0, "AI_ROUTES_CHANGED");
}
function renderUnit(pm2CLI) {
  ensure(/^\/[A-Za-z0-9_./-]+$/.test(pm2CLI) && !pm2CLI.split("/").includes(".."), "UNSAFE_PM2_PATH");
  return `[Unit]
Description=INDEXUS existing seman PM2 process manager
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
User=seman
Group=seman
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=PM2_HOME=/home/seman/.pm2
PIDFile=/home/seman/.pm2/pm2.pid
ExecStart=/usr/bin/node ${pm2CLI} resurrect
Restart=on-failure
TimeoutStartSec=120
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
`;
}
function dumpRows(rows) {
  return rows.filter(r => !r.pm2_env.pmx_module).map(r => {
    const e = structuredClone(r.pm2_env);
    for (const k of ["instances", "pm_id", "prev_restart_delay", "_tree_pids"]) delete e[k];
    return e;
  });
}
function assertNoToken(value, token) {
  const bytes = typeof value === "string" ? value : JSON.stringify(value);
  ensure(!bytes.includes(token) && !bytes.includes("INDEXUS_AI_GATEWAY_TOKEN"), "TOKEN_IN_PM2_CONFIGURATION");
}
function verifyLoader(source) {
  const token = "synthetic_gateway_token_0123456789", marker = "synthetic_openai_unchanged";
  const base = { token, baseURL: "https://ai.cordbloodcenter.com/gateway/", mode: "routed", enabled: true };
  const cases = [
    ["valid", JSON.stringify(base), false, true],
    ["missing", null, false, false],
    ["malformed", "{", false, false],
    ["extra_key", JSON.stringify({ ...base, OPENAI_API_KEY: "forbidden" }), false, false],
    ["wrong_url", JSON.stringify({ ...base, baseURL: "https://example.invalid/" }), false, false],
    ["bad_token", JSON.stringify({ ...base, token: "bad token" }), false, false],
    ["symlink", JSON.stringify(base), true, false],
  ];
  for (const [name, bytes, symlink, valid] of cases) {
    const env = { NODE_ENV: "production", OPENAI_API_KEY: marker, KEEP: "unchanged",
      INDEXUS_AI_GATEWAY_TOKEN: "stale", INDEXUS_AI_GATEWAY_ENABLED: "true" };
    let output = "", closed = false;
    const fake = {
      constants: { O_RDONLY: 0, O_NOFOLLOW: 131072 },
      lstatSync: p => ({ uid: 0, isSymbolicLink: () => symlink && p.endsWith("gateway.json") }),
      statSync: () => ({ gid: C.gid, mode: 0o750, isDirectory: () => true }),
      openSync: () => { if (bytes === null) throw Error(token); return 7; },
      fstatSync: () => ({ uid: 0, gid: C.gid, mode: 0o640, size: bytes?.length, isFile: () => true }),
      readFileSync: () => bytes, closeSync: () => { closed = true; },
    };
    vm.runInNewContext(source, { process: { env, stderr: { write: s => { output += s; } } },
      require: name => { ensure(name === "node:fs", "UNEXPECTED_LOADER_IMPORT"); return fake; } }, { timeout: 1000 });
    ensure(env.OPENAI_API_KEY === marker && env.KEEP === "unchanged", "LOADER_CHANGED_OPENAI");
    ensure(env.INDEXUS_AI_GATEWAY_ENABLED === String(valid), "LOADER_TEST_FAILED");
    ensure(valid ? env.INDEXUS_AI_GATEWAY_TOKEN === token : !Object.hasOwn(env, "INDEXUS_AI_GATEWAY_TOKEN"), "LOADER_TOKEN_TEST_FAILED");
    ensure(!output.includes(token) && (valid ? !output : output === "INDEXUS_GATEWAY_PRELOAD_BLOCKED\n"), "LOADER_UNSAFE_OUTPUT");
    if (bytes !== null && !symlink) ensure(closed, "LOADER_FD_NOT_CLOSED");
  }
  return cases.map(c => c[0]);
}
async function applyFlow(io) {
  const state = { restartAttempted: false };
  await io.preflight();
  const backup = await io.backup();
  io.failureStage = "backupVerification";
  try {
    await io.verifyBackup(backup); // No live writes are allowed above this boundary.
  } catch (error) {
    const failure = failureEvidence(io, error);
    const recorded = await recordFailureSafely(io, backup, failure);
    const safe = Error("BACKUP_VERIFICATION_FAILED_NO_RUNTIME_CHANGES");
    safe.operatorCode = safe.message; safe.backup = backup;
    safe.failure = failure; safe.failureRecorded = recorded;
    // Never install, restart or recover from a bundle that failed verification.
    throw safe;
  }
  try {
    io.failureStage = "runtimeInstall";
    await io.install(backup);
    io.failureStage = "installedLoaderValidation";
    await io.testInstalledLoader(backup);
    io.failureStage = "restartPrerequisites";
    state.restartAttempted = true;
    await io.restart(backup);
    io.failureStage = "runtimeVerification";
    await io.verifyRuntime(backup);
    io.failureStage = "pm2DumpSave";
    await io.saveDump(backup);
    io.failureStage = "bootEnable";
    await io.enableBoot(backup);
    io.failureStage = "finalVerification";
    await io.verifyFinal(backup);
    io.failureStage = "completion";
    return await io.complete(backup);
  } catch (error) {
    const failure = failureEvidence(io, error);
    const failureRecorded = await recordFailureSafely(io, backup, failure);
    let recovered = false;
    try { await io.recover(backup, state); recovered = true; } catch {}
    const safe = Error(recovered ? "APPLY_FAILED_ROLLBACK_VERIFIED" : "APPLY_FAILED_OPERATOR_ATTENTION_REQUIRED");
    safe.operatorCode = safe.message; safe.backup = backup;
    safe.failure = failure; safe.failureRecorded = failureRecorded; throw safe;
  }
}
function failureEvidence(io, error) {
  return {
    stage: FAILURE_STAGES.has(io.failureStage) ? io.failureStage : "unknown",
    code: FAILURE_CODES.has(error?.operatorCode) ? error.operatorCode : "UNCLASSIFIED_OPERATION_FAILURE",
    ...(Number.isInteger(error?.operatorExitStatus) && error.operatorExitStatus >= 0 &&
      error.operatorExitStatus <= 255 ? { exitStatus: error.operatorExitStatus } : {}),
    ...(["EACCES", "EPERM", "ENOENT", "ENOSPC", "EROFS", "EIO", "EDQUOT", "EMFILE", "EEXIST"]
      .includes(error?.code) ? { systemCode: error.code } : {}),
  };
}
async function recordFailureSafely(io, backup, failure) {
  // No raw stderr/message/stack; a diagnostic write must never block recovery.
  try { if (io.recordFailure) { await io.recordFailure(backup, failure); return true; } } catch {}
  return false;
}
const FAILURE_STAGES = new Set(["backupVerification", "backupIntegrityValidation", "backupPrivacyValidation",
  "rollbackSyntaxValidation", "rollbackBundleTests", "bootUnitSyntaxValidation",
  "runtimeInstall", "runtimeDirectoryCreate", "runtimeConfigurationInstall",
  "runtimeLoaderInstall", "runtimeACLValidation", "ecosystemInstall", "installedLoaderValidation",
  "restartPrerequisites", "restartDispatch", "runtimeVerification", "pm2DumpSave", "bootEnable",
  "finalVerification", "completion"]);
const FAILURE_CODES = new Set(["OPERATOR_COMMAND_FAILED", "OPERATOR_EXECUTABLE_NOT_FOUND",
  "OPERATOR_EXECUTABLE_ACCESS_DENIED", "INSTALLED_LOADER_TEST_FAILED",
  "VERIFIED_BACKUP_REQUIRED", "DOTENV_CHANGED", "BACKEND_CHANGED", "PM2_DAEMON_CHANGED",
  "PM2_RPC_SOCKET_UNSAFE", "BACKUP_DISK_UNSAFE", "WORKER_CHANGED_BEFORE_INSTALL",
  "PM2_ENVIRONMENT_CHANGED", "PM2_SETTINGS_CHANGED", "OTHER_PM2_PROCESS_CHANGED",
  "AI_OPENAI_BASELINE_CHANGED", "ECOSYSTEM_CHANGED_BEFORE_INSTALL", "TOKEN_PERMISSIONS_CHANGED",
  "TOKEN_FORMAT_REQUIRES_REVIEW", "TOKEN_IN_PM2_CONFIGURATION", "ECOSYSTEM_BASELINE_CHANGED",
  "ECOSYSTEM_REQUIRES_REVIEW", "RUNTIME_TARGET_COLLISION", "ACL_REVIEW_REQUIRED",
  "UNSAFE_SYMLINK", "UNSAFE_FILE", "FILE_IDENTITY_CHANGED", "RESTART_PREREQUISITES_MISSING",
  "WORKER_CHANGED_BEFORE_RESTART", "RUNTIME_VERIFICATION_FAILED", "INSTALLED_FILE_CHANGED",
  "ORIGINAL_TOKEN_CHANGED", "PM2_DUMP_CHANGED_EXTERNALLY", "BOOT_LINK_NOT_VERIFIED",
  "BOOT_NOT_ENABLED", "NEW_BOOT_SERVICE_UNEXPECTEDLY_STARTED"]);
module.exports = { C, ensure, hash, args, stable, envValues, assertPreserved, assertOtherProcesses,
  transformEcosystem, assertRoutes, assertOpenAI, renderUnit, dumpRows, assertNoToken, verifyLoader, applyFlow };
