"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const cp = require("node:child_process"), vm = require("node:vm");
const P = require("./lib/ai-gateway-policy.cjs"), H = require("./lib/ai-gateway-host.cjs");
const helper = require("./ai-gateway-production.cjs");
const LOADER = fs.readFileSync(path.join(__dirname, "../ops/ai-gateway/preload.cjs"), "utf8");
const SECRET = "SYNTHETIC_SECRET_NEVER_PRINT_123456789";
const ECO = `module.exports = {
  apps: [{
    name: 'indexus-crm',
    script: 'dist/index.cjs',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
`;
test("loader self-tests cover successful load and failures without touching OpenAI", () => {
  assert.equal(P.verifyLoader(LOADER).length, 7);
});
function loadCase(options = {}) {
  const env = { NODE_ENV: "production", OPENAI_API_KEY: SECRET, DATABASE_URL: "synthetic-db",
    UNRELATED: "preserved", INDEXUS_AI_GATEWAY_TOKEN: "stale", INDEXUS_AI_GATEWAY_ENABLED: "true",
    ...(options.env || {}) };
  let diagnostics = "", closed = 0;
  const payload = options.payload ?? JSON.stringify({ token: SECRET, baseURL: "https://ai.cordbloodcenter.com/gateway/",
    enabled: true, mode: "routed" });
  const fake = {
    constants: { O_RDONLY: 0, O_NOFOLLOW: 131072 },
    lstatSync: p => {
      if (options.missing) throw Error(SECRET);
      return { uid: options.owner ?? 0, isSymbolicLink: () => !!options.symlink };
    },
    statSync: () => ({ gid: options.dirGid ?? 1001, mode: options.dirMode ?? 0o750,
      isDirectory: () => options.directory !== false }),
    openSync: (_p, flags) => { assert.ok(flags & 131072); if (options.denied) throw Error(SECRET); return 9; },
    fstatSync: () => ({ uid: options.fileUID ?? 0, gid: options.fileGid ?? 1001,
      mode: options.mode ?? 0o640, size: options.size ?? payload.length, isFile: () => options.file !== false }),
    readFileSync: () => { if (options.readError) throw Error(SECRET); return payload; },
    closeSync: () => { closed++; },
  };
  vm.runInNewContext(LOADER, { process: { env, stderr: { write: s => { diagnostics += s; } } },
    require: name => { assert.equal(name, "node:fs"); return fake; } }, { timeout: 1000 });
  assert.equal(env.OPENAI_API_KEY, SECRET); assert.equal(env.DATABASE_URL, "synthetic-db");
  assert.equal(env.UNRELATED, "preserved");
  assert.ok(!diagnostics.includes(SECRET));
  return { env, diagnostics, closed };
}
test("valid loader changes exactly the four approved Gateway variables", () => {
  const r = loadCase();
  assert.equal(r.env.INDEXUS_AI_GATEWAY_ENABLED, "true");
  assert.equal(r.env.INDEXUS_AI_GATEWAY_TOKEN, SECRET);
  assert.equal(r.env.INDEXUS_AI_GATEWAY_BASE_URL, "https://ai.cordbloodcenter.com/gateway/");
  assert.equal(r.env.INDEXUS_AI_ROUTER_MODE, "routed");
  assert.equal(r.diagnostics, ""); assert.equal(r.closed, 1);
});
for (const [name, options] of Object.entries({
  missing: { missing: true }, denied: { denied: true }, malformed: { payload: "{" }, null: { payload: "null" },
  array: { payload: "[]" }, wrongOwner: { owner: 1001 }, wrongFileUID: { fileUID: 1001 },
  wrongGroup: { fileGid: 0 }, sharedDirectory: { dirMode: 0o775 }, wrongDirGroup: { dirGid: 0 },
  worldReadable: { mode: 0o644 }, specialMode: { mode: 0o4640 }, notDirectory: { directory: false },
  notFile: { file: false }, symlink: { symlink: true }, oversized: { size: 20000 },
  readFailure: { readError: true }, development: { env: { NODE_ENV: "development" } },
  replit: { env: { REPL_ID: "synthetic" } }, proxy: { env: { REPLIT_DEV_DOMAIN: "synthetic.invalid" } },
})) {
  test("loader " + name + " disables only Gateway; CRM/OpenAI remain available", () => {
    const r = loadCase(options);
    assert.equal(r.env.INDEXUS_AI_GATEWAY_ENABLED, "false");
    assert.equal(Object.hasOwn(r.env, "INDEXUS_AI_GATEWAY_TOKEN"), false);
    assert.equal(r.diagnostics, "INDEXUS_GATEWAY_PRELOAD_BLOCKED\n");
  });
}
for (const patch of [{ token: "bad token" }, { token: "" }, { enabled: false }, { mode: "legacy" },
  { baseURL: "https://example.invalid/" }, { OPENAI_API_KEY: "forbidden" }]) {
  test("loader rejects unsupported configuration " + Object.keys(patch)[0] + JSON.stringify(patch).length, () => {
    const payload = JSON.stringify({ token: SECRET, baseURL: "https://ai.cordbloodcenter.com/gateway/",
      enabled: true, mode: "routed", ...patch });
    assert.equal(loadCase({ payload }).env.INDEXUS_AI_GATEWAY_ENABLED, "false");
  });
}
test("actual Node --require with absent credentials continues to application code", () => {
  const r = cp.spawnSync(process.execPath, ["--require", path.join(__dirname, "../ops/ai-gateway/preload.cjs"),
    "-e", "if(process.env.OPENAI_API_KEY!=='synthetic-openai')process.exit(9);console.log('CRM_STILL_RUNS');"],
  { encoding: "utf8", env: { PATH: process.env.PATH, NODE_ENV: "development", OPENAI_API_KEY: "synthetic-openai" } });
  assert.equal(r.status, 0); assert.equal(r.stdout.trim(), "CRM_STILL_RUNS");
  assert.equal(r.stderr, "INDEXUS_GATEWAY_PRELOAD_BLOCKED\n");
});
test("development and Replit refuse before even opening a production credential path", () => {
  for (const env of [{ NODE_ENV: "development" }, { NODE_ENV: "production", REPL_ID: "fixture" }]) {
    let imported = false;
    vm.runInNewContext(LOADER, { process: { env, stderr: { write() {} } },
      require() { imported = true; throw Error("must not read"); } });
    assert.equal(imported, false); assert.equal(env.INDEXUS_AI_GATEWAY_ENABLED, "false");
  }
});
test("ecosystem byte change adds only the approved preload line", () => {
  assert.equal(P.hash(ECO), P.C.ecosystemHash);
  const changed = P.transformEcosystem(ECO);
  assert.equal(changed.replace("    node_args: ['--require', '" + P.C.loader + "'],\n", ""), ECO);
  assert.throws(() => P.transformEcosystem(ECO + "\n"), /BASELINE_CHANGED/);
});
test("systemd unit uses the seman daemon, absolute paths and no secret environment", () => {
  const s = P.renderUnit("/usr/lib/node_modules/pm2/bin/pm2");
  assert.match(s, /User=seman/); assert.match(s, /Group=seman/);
  assert.match(s, /PIDFile=\/home\/seman\/.pm2\/pm2.pid/);
  assert.match(s, /ExecStart=\/usr\/bin\/node \/usr\/lib\/node_modules\/pm2\/bin\/pm2 resurrect/);
  assert.doesNotMatch(s, /TOKEN|OPENAI|--update-env|\/root\/.pm2/);
  for (const bad of ["pm2", "/bad path/pm2", "/bin/../pm2", "/bin/pm2;whoami"])
    assert.throws(() => P.renderUnit(bad), /UNSAFE_PM2_PATH/);
});
const goodAI = () => ({ version: 1, value: { gateway: { enabled: false,
  baseURL: "https://ai.cordbloodcenter.com/gateway/" }, routes: {} } });
test("preflight accepts only the exact original OpenAI-only configuration", () => {
  P.assertRoutes(goodAI());
  for (const mutate of [r => r.version++, r => r.value.gateway.enabled = true,
    r => r.value.routes.a = { provider: "internal" }, r => r.value.routes.a = { provider: "openai" },
    r => r.value.routes = []]) {
    const r = goodAI(); mutate(r); assert.throws(() => P.assertRoutes(r), /BASELINE_CHANGED/);
  }
});
const row = (id = 4) => ({ pm_id: id, pid: 123, name: id === 4 ? "indexus-crm" : "module",
  pm2_env: { env: { OPENAI_API_KEY: SECRET, lowercase_custom: "preserve" }, OPENAI_API_KEY: SECRET,
    pm_cwd: "/var/www/indexus-crm", pm_exec_path: "/var/www/indexus-crm/dist/index.cjs",
    exec_mode: "fork_mode", autorestart: true, max_memory_restart: 1000000000, status: "online" } });
test("PM2 comparisons preserve nested and direct variables and operational parameters", () => {
  const a = row(), b = structuredClone(a); b.pid++; b.pm2_env.node_args = P.args(); b.pm2_env.pm_uptime = 42;
  P.assertPreserved(a, b);
  for (const mutate of [r => r.pm2_env.env.OPENAI_API_KEY = "changed",
    r => r.pm2_env.OPENAI_API_KEY = "changed", r => r.pm2_env.env.lowercase_custom = "changed",
    r => r.pm2_env.autorestart = false]) {
    const c = structuredClone(b); mutate(c); assert.throws(() => P.assertPreserved(a, c), /CHANGED/);
  }
});
test("other PM2 applications and modules must not restart or change", () => {
  const a = [row(), row(9)], b = structuredClone(a); b[0].pid++;
  P.assertOtherProcesses(a, b);
  b[1].pid++; assert.throws(() => P.assertOtherProcesses(a, b), /OTHER_PM2_PROCESS_CHANGED/);
});
test("dump serialization matches PM2's module and volatile-field handling", () => {
  const app = row(); app.pm2_env.pm_id = 4; app.pm2_env.instances = 1; app.pm2_env.prev_restart_delay = 50;
  const module = row(9); module.pm2_env.pmx_module = true;
  const dumped = P.dumpRows([app, module]);
  assert.equal(dumped.length, 1); assert.equal(dumped[0].env.OPENAI_API_KEY, SECRET);
  assert.equal(Object.hasOwn(dumped[0], "pm_id"), false);
  assert.equal(Object.hasOwn(dumped[0], "instances"), false);
  assert.equal(app.pm2_env.instances, 1);
});
test("Gateway token and its environment key are forbidden in PM2 configuration or dumps", () => {
  P.assertNoToken({ OPENAI_API_KEY: "synthetic" }, SECRET);
  assert.throws(() => P.assertNoToken({ env: { INDEXUS_AI_GATEWAY_TOKEN: "" } }, SECRET), /TOKEN_IN_PM2/);
  assert.throws(() => P.assertNoToken("prefix " + SECRET, SECRET), /TOKEN_IN_PM2/);
});
const UTILITY = `const Utility = {
  extendExtraConfig : function(proc, opts) {
    if (opts.env && opts.env.current_conf) {
      if (opts.env.current_conf.env && typeof(opts.env.current_conf.env) === 'object' && Object.keys(opts.env.current_conf.env).length === 0)
        delete opts.env.current_conf.env
      Utility.extendMix(proc.pm2_env, opts.env.current_conf);
      delete opts.env.current_conf;
    }
  },
  extend : function(destination, source){
    if (!source || typeof source != 'object') return destination;
    Object.keys(source).forEach(function(new_key) {
      if (source[new_key] != '[object Object]') destination[new_key] = source[new_key];
    });
    return destination;
  },
  extendMix : function(destination, source){
    if (!source || typeof source != 'object') return destination;
    Object.keys(source).forEach(function(new_key) {
      if (source[new_key] == 'null') delete destination[new_key];
      else destination[new_key] = source[new_key]
    });
    return destination;
  },
};`;
test("installed PM2 merge semantics are exercised with synthetic env before approval-bound use", () => {
  H.verifyPM2Merge(UTILITY);
  assert.throws(() => H.verifyPM2Merge(UTILITY.replace("source[new_key] != '[object Object]'", "true")), /CHANGES_ENVIRONMENT/);
  assert.throws(() => H.verifyPM2Merge("unsupported source"), /UNSUPPORTED/);
});
const stages = ["preflight", "backup", "verifyBackup", "install", "testInstalledLoader", "restart",
  "verifyRuntime", "saveDump", "enableBoot", "verifyFinal", "complete"];
function fakeIO(failAt, recoveryFails = false) {
  const calls = [], io = {};
  for (const stage of stages) io[stage] = async () => {
    calls.push(stage);
    if (stage === failAt) throw Error(SECRET);
    return stage === "backup" ? "/synthetic/backup" : stage === "complete" ? { ok: true } : undefined;
  };
  io.recover = async (directory, state) => {
    calls.push("recover"); assert.equal(directory, "/synthetic/backup");
    io.recoveryState = state; if (recoveryFails) throw Error(SECRET);
  };
  return { io, calls };
}
test("successful apply flow verifies executable rollback backup before every live mutation", async () => {
  const f = fakeIO(); assert.deepEqual(await P.applyFlow(f.io), { ok: true });
  assert.deepEqual(f.calls, stages);
  assert.ok(f.calls.indexOf("verifyBackup") < f.calls.indexOf("install"));
  assert.ok(f.calls.indexOf("verifyBackup") < f.calls.indexOf("restart"));
  assert.ok(f.calls.indexOf("testInstalledLoader") < f.calls.indexOf("restart"));
  assert.ok(f.calls.indexOf("verifyRuntime") < f.calls.indexOf("saveDump"));
});
for (const stage of stages) {
  test("failure at " + stage + " cannot silently proceed or expose a raw error", async () => {
    const f = fakeIO(stage);
    await assert.rejects(P.applyFlow(f.io), error => {
      if (stages.indexOf(stage) < 3) assert.equal(f.calls.includes("recover"), false);
      else { assert.equal(helper.safeError(error), "APPLY_FAILED_ROLLBACK_VERIFIED"); assert.ok(!error.message.includes(SECRET)); }
      return true;
    });
    assert.equal(f.calls.includes("restart"), stages.indexOf(stage) >= stages.indexOf("restart"));
    assert.equal(f.calls.includes("install"), stages.indexOf(stage) >= stages.indexOf("install"));
  });
}
test("failed recovery is reported as operator attention, never as successful rollback", async () => {
  const f = fakeIO("verifyRuntime", true);
  await assert.rejects(P.applyFlow(f.io), error => helper.safeError(error) === "APPLY_FAILED_OPERATOR_ATTENTION_REQUIRED");
});
test("apply records a sanitized pre-restart failure before recovery and returns its stage", async () => {
  const f = fakeIO();
  f.io.testInstalledLoader = async () => {
    f.calls.push("testInstalledLoader");
    const e = Error(SECRET);
    e.operatorCode = "OPERATOR_COMMAND_FAILED"; e.operatorExitStatus = 1;
    throw e;
  };
  let saved;
  f.io.recordFailure = async (_dir, value) => { f.calls.push("recordFailure"); saved = value; };
  await assert.rejects(P.applyFlow(f.io), e => {
    assert.equal(e.operatorCode, "APPLY_FAILED_ROLLBACK_VERIFIED");
    assert.equal(e.failureRecorded, true);
    assert.deepEqual(e.failure, { stage: "installedLoaderValidation", code: "OPERATOR_COMMAND_FAILED", exitStatus: 1 });
    assert.deepEqual(saved, e.failure);
    assert.equal(JSON.stringify(e).includes(SECRET), false);
    return true;
  });
  assert(f.calls.indexOf("recordFailure") < f.calls.indexOf("recover"));
  assert.equal(f.calls.includes("restart"), false);
});
test("unknown codes, stages, raw exceptions and invalid exit values cannot enter failure evidence", async () => {
  const f = fakeIO();
  f.io.install = async () => {
    f.io.failureStage = SECRET;
    const e = Error(SECRET); e.operatorCode = SECRET; e.operatorExitStatus = SECRET; throw e;
  };
  f.io.recordFailure = async () => { throw Error(SECRET); };
  await assert.rejects(P.applyFlow(f.io), e => {
    assert.deepEqual(e.failure, { stage: "unknown", code: "UNCLASSIFIED_OPERATION_FAILURE" });
    assert.equal(e.failureRecorded, false);
    assert.equal(e.operatorCode, "APPLY_FAILED_ROLLBACK_VERIFIED");
    assert.equal(JSON.stringify(e).includes(SECRET), false); return true;
  });
  assert(f.calls.includes("recover")); assert.equal(f.calls.includes("restart"), false);
});
test("each pre-restart installation substage is retained without relaxing its validation", async () => {
  for (const stage of ["runtimeDirectoryCreate", "runtimeConfigurationInstall", "runtimeLoaderInstall",
    "runtimeACLValidation", "ecosystemInstall"]) {
    const f = fakeIO();
    f.io.install = async () => {
      f.io.failureStage = stage;
      const e = Error(SECRET); e.operatorCode = "ACL_REVIEW_REQUIRED"; throw e;
    };
    await assert.rejects(P.applyFlow(f.io), e =>
      e.failure.stage === stage && e.failure.code === "ACL_REVIEW_REQUIRED");
    assert.equal(f.calls.includes("restart"), false);
  }
});
test("filesystem failure evidence distinguishes permission errors without recording file paths", async () => {
  const f = fakeIO();
  f.io.install = async () => {
    f.io.failureStage = "runtimeConfigurationInstall";
    const e = Error(SECRET); e.code = "EACCES"; e.path = SECRET; throw e;
  };
  await assert.rejects(P.applyFlow(f.io), e => {
    assert.deepEqual(e.failure, { stage: "runtimeConfigurationInstall",
      code: "UNCLASSIFIED_OPERATION_FAILURE", systemCode: "EACCES" });
    assert.equal(JSON.stringify(e).includes(SECRET), false); return true;
  });
});
test("command errors expose only bounded exit status, never captured stderr or environment", () => {
  const sandbox = { module: { exports: {} }, Buffer, process,
    require(name) {
      if (name === "node:child_process") return { execFileSync() {
        const e = Error(SECRET); e.status = 1; e.stderr = SECRET; e.stdout = SECRET; throw e;
      } };
      if (name === "./ai-gateway-policy.cjs") return P;
      return require(name);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "lib/ai-gateway-host.cjs"), "utf8"), sandbox);
  assert.throws(() => sandbox.module.exports.command("synthetic", []), e => {
    assert.equal(e.operatorCode, "OPERATOR_COMMAND_FAILED"); assert.equal(e.operatorExitStatus, 1);
    assert.equal(e.message.includes(SECRET), false); assert.equal(JSON.stringify(e).includes(SECRET), false);
    return true;
  });
});
test("default, partial and mixed commands refuse production access before any inspection", () => {
  for (const args of [[], ["--apply"], ["--apply", "--approve", "yes"], ["--rollback"],
    ["--self-test", "--apply"], ["--rollback", "/tmp/foreign", "--approve", "yes"]]) {
    assert.throws(() => helper.parseArgs(args), /EXPLICIT_SEPARATE_APPROVAL_REQUIRED/);
  }
  assert.deepEqual(helper.parseArgs(["--apply", "--approve", P.C.approval]), { mode: "--apply" });
  assert.equal(helper.parseArgs(["--rollback", P.C.backupRoot + "/attempt-test", "--approve", P.C.rollbackApproval]).mode, "--rollback");
});
test("foreign backup paths and arbitrary raw exception messages are never accepted as reports", () => {
  for (const p of ["/tmp", P.C.backupRoot + "/../attempt-x", P.C.backupRoot + "/foreign"])
    assert.throws(() => helper.assertBackupDirectory(p), /INVALID_BACKUP_PATH/);
  assert.equal(helper.safeError(Error(SECRET)), "GATEWAY_OPERATION_STOPPED");
  assert.equal(helper.safeError(Error("DATABASE_PASSWORD")), "GATEWAY_OPERATION_STOPPED");
  let tagged; try { P.ensure(false, "KNOWN_SAFE_CHECK"); } catch (e) { tagged = e; }
  assert.equal(helper.safeError(tagged), "KNOWN_SAFE_CHECK");
});
test("actual CLI without approval exits safely; self-test requires no production DB", () => {
  const script = path.join(__dirname, "ai-gateway-production.cjs");
  for (const args of [[], ["--apply"], ["--apply", "--approve", "yes"]]) {
    const r = cp.spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { PATH: process.env.PATH } });
    assert.equal(r.status, 1); assert.equal(JSON.parse(r.stderr).code, "EXPLICIT_SEPARATE_APPROVAL_REQUIRED");
  }
  const r = cp.spawnSync(process.execPath, [script, "--self-test"], { encoding: "utf8", env: { PATH: process.env.PATH } });
  assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).productionChanges, false);
});
test("atomic copies, no-clobber and symlink guards work on actual disposable files", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexus-gateway-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "fixture"), profile = { uid: process.getuid(), gid: process.getgid(), mode: 0o600 };
  H.atomic(file, "first", profile);
  assert.equal(H.file(file).bytes.toString(), "first");
  assert.throws(() => H.atomic(file, "not-allowed", profile));
  assert.equal(fs.readFileSync(file, "utf8"), "first");
  H.atomic(file, "second", profile, true); assert.equal(H.file(file).bytes.toString(), "second");
  fs.symlinkSync(file, path.join(dir, "link"));
  assert.throws(() => H.file(path.join(dir, "link")), /UNSAFE_SYMLINK/);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});
test("RPC helper connects only to an existing socket and cannot launch a daemon", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexus-rpc-fixture-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "index.js"), `module.exports={Client:{launchRPC(cb){this.client={call(method,data,done){
    if(method==='restartProcessId'&&data.id!==4)throw Error('wrong target');
    done(null,{method,data});
  }};cb(null);}}};`);
  for (const action of ["list", "restart"]) {
    const r = cp.spawnSync(process.execPath, ["-e", H.rpcChild()], {
      input: JSON.stringify({ directory: dir, action, nodeArgs: P.args() }), encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.equal(r.status, 0);
    const result = JSON.parse(r.stdout.trim().split("GATEWAY_RPC_RESULT=")[1]);
    assert.equal(result.ok, true);
    if (action === "restart") {
      assert.equal(result.value.data.id, 4);
      assert.deepEqual(result.value.data.env.current_conf, { node_args: P.args(), env: {} });
    }
  }
  assert.doesNotMatch(H.rpcChild(), /pm\.connect\(|\.Client\.start\(/);
});
test("production helper has no Gateway requests, DB writers, reboot, or root PM2 operations", () => {
  const source = fs.readFileSync(path.join(__dirname, "ai-gateway-production.cjs"), "utf8");
  const host = fs.readFileSync(path.join(__dirname, "lib/ai-gateway-host.cjs"), "utf8");
  assert.doesNotMatch(source + host, /\bfetch\(|https\.request|\["reboot"\]|\["restart", "all"\]/);
  assert.doesNotMatch(host, /\.query\(["'`](?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/);
  assert.doesNotMatch(source, /\["disable", "pm2-seman.service", "--now"\]|\["start", "pm2-seman.service"\]/);
  assert.match(source, /ROLLBACK_RUNTIME_RESTORED_GATEWAY_DB_DISABLE_REQUIRED/);
  assert.match(source, /RUNTIME_READY_OPENAI_ONLY_AWAITING_ADMIN_TESTS/);
});
function recoveryFixture(options = {}) {
  const C = { ...P.C, root: "/fixture/app", home: "/fixture/home/.pm2", data: "/fixture/app/data",
    backupRoot: "/fixture/app/data/.ai-gateway-private", runtime: "/fixture/etc/runtime",
    loader: "/fixture/etc/runtime/preload.cjs", token: "/fixture/etc/original-token",
    unit: "/fixture/etc/systemd/system/pm2-seman.service",
    link: "/fixture/etc/systemd/system/multi-user.target.wants/pm2-seman.service",
    backend: P.hash("unchanged-backend") };
  const directory = C.backupRoot + "/attempt-test", storage = new Map(), calls = [];
  function put(name, bytes, profile = { uid: 0, gid: 0, mode: 0o600 }) {
    storage.set(name, { bytes: Buffer.from(bytes), ...profile });
  }
  const before = row(), current = structuredClone(before);
  current.pid = options.stopped ? 0 : options.beforeRestart ? before.pid : 456;
  if (!options.beforeRestart) current.pm2_env.node_args = P.args();
  current.pm2_env.status = options.stopped ? "errored" : "online";
  const snapshot = { row: before, rows: [before], initialEnvironment: { OPENAI_API_KEY: SECRET },
    pm2: { directory: "/synthetic/pm2" } };
  const m = { version: 1, head: C.head, directory, bundle: {}, files: {}, expected: {},
    runtimeCreated: true, runtimeCreationAttempted: true, runtimeIdentity: { ino: 17, dev: 7 },
    restartAttempted: !options.beforeRestart, dumpWritten: !options.untouchedPM2,
    unitTouched: !options.untouchedPM2, unitCreated: !options.untouchedPM2,
    originalToken: { sha256: P.hash(SECRET), uid: 0, gid: 0, mode: 0o600 }, expectedDump: {} };
  const originals = { dotenv: "unchanged-env", ecosystem: "original-ecosystem",
    "dump.pm2": "original-dump", "dump.pm2.bak": null };
  for (const [name, bytes] of Object.entries(originals)) {
    if (bytes === null) { m.files[name] = null; continue; }
    m.files[name] = { sha256: P.hash(bytes), uid: 1001, gid: 1001, mode: name === "ecosystem" ? 0o664 : 0o600 };
    put(directory + "/files/" + name, bytes);
  }
  put(C.root + "/.env", originals.dotenv, m.files.dotenv);
  put(C.root + "/dist/index.cjs", "unchanged-backend");
  put(C.token, SECRET);
  for (const [target, bytes] of [[C.root + "/ecosystem.config.cjs", "new-ecosystem"],
    [C.runtime + "/gateway.json", "synthetic-runtime-json"], [C.loader, "new-loader"], [C.unit, "new-unit"]]) {
    put(target, bytes); m.expected[target] = P.hash(bytes);
  }
  for (const [name, bytes] of [["dump.pm2", "new-dump"], ["dump.pm2.bak", "original-dump"]]) {
    put(C.home + "/" + name, bytes, { uid: 1001, gid: 1001, mode: 0o600 });
    m.expectedDump[name] = P.hash(bytes);
  }
  if (options.untouchedPM2) {
    put(C.home + "/dump.pm2", originals["dump.pm2"], m.files["dump.pm2"]);
    storage.delete(C.home + "/dump.pm2.bak"); storage.delete(C.unit);
  }
  for (const name of helper.SOURCES) {
    const bytes = "synthetic-bundle-" + name;
    put(directory + "/bundle/" + name, bytes); m.bundle[name] = P.hash(bytes);
  }
  put(directory + "/rollback.cjs", "synthetic-rollback"); m.rollbackSHA256 = P.hash("synthetic-rollback");
  const saved = JSON.stringify(snapshot);
  put(directory + "/snapshot.private.json", saved); m.snapshotSHA256 = P.hash(saved);
  const dirs = new Set([C.backupRoot, directory, C.runtime]);
  let link = !options.untouchedPM2;
  const fakeFS = {
    statSync(p) {
      assert.ok(dirs.has(p));
      return { uid: 0, gid: p === C.runtime ? 1001 : 0, mode: p === C.runtime ? 0o750 : 0o700,
        ino: 17, dev: 7, isDirectory: () => true };
    },
    existsSync: p => dirs.has(p) || storage.has(p) || (p === C.link && link),
    lstatSync: p => p === C.link && link ? { isSymbolicLink: () => true } :
      dirs.has(p) || storage.has(p) ? { isSymbolicLink: () => false } : undefined,
    realpathSync: p => { assert.equal(p, C.link); return C.unit; },
    unlinkSync: p => { assert.ok(storage.has(p)); calls.push("remove:" + p); storage.delete(p); },
    rmdirSync: p => {
      assert.equal(p, C.runtime); assert.equal([...storage.keys()].some(k => k.startsWith(p + "/")), false); dirs.delete(p);
    },
  };
  const host = {
    noLinks() {}, daemon() {}, disk() {}, health() { calls.push("health"); },
    proc() { return { start: C.initialStart }; },
    initialEnvironment() { return { ...snapshot.initialEnvironment }; },
    file(p, optional) { if (!storage.has(p) && optional) return null; assert.ok(storage.has(p), "missing fixture " + p); return storage.get(p); },
    privateJSON(p, value) { calls.push("journal"); put(p, JSON.stringify(value)); },
    atomic(p, bytes, profile) { calls.push("restore:" + p); put(p, bytes, profile); },
    rpc(_pm2, action, nodeArgs) {
      calls.push("rpc:" + action);
      if (action === "restart") {
        assert.equal(nodeArgs, "null"); delete current.pm2_env.node_args; current.pid = 789; current.pm2_env.status = "online";
      }
      return [current];
    },
    application(rows, allowStopped) {
      if (options.stopped) assert.equal(allowStopped, true);
      return rows[0];
    },
    async readAI() { const r = goodAI(); r.value.gateway.enabled = !!options.gatewayEnabled; return r; },
    command(bin, argv) {
      if (bin === "runuser") {
        calls.push("synthetic-environment-probe");
        assert.equal(argv.includes("--require"), false);
        return "SYNTHETIC_ENVIRONMENT_PRESERVED";
      }
      assert.equal(bin, "systemctl"); assert.equal(argv.includes("--now"), false);
      calls.push("systemctl:" + argv.join(" "));
      if (argv[0] === "disable") link = false;
      return "";
    },
  };
  put(directory + "/manifest.json", JSON.stringify(m));
  const sandbox = { module: { exports: {} }, Buffer, __dirname, process: { argv: [] }, console,
    require(name) {
      if (name === "node:fs") return fakeFS;
      if (name === "node:path") return path;
      if (name === "./lib/ai-gateway-policy.cjs") return { ...P, C };
      if (name === "./lib/ai-gateway-host.cjs") return host;
      throw Error("unexpected recovery import " + name);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "ai-gateway-production.cjs"), "utf8"), sandbox);
  const io = new sandbox.module.exports.Operations();
  io.waitRuntime = async (_snapshot, nodeArgs) => {
    calls.push("verify-original-runtime"); assert.equal(nodeArgs, undefined);
    return { rows: [current], row: current };
  };
  return { C, directory, io, calls, storage, options, put, original: originals, snapshot, manifest: m, host, current };
}
for (const [name, options] of Object.entries({
  complete: {}, failedWorker: { stopped: true }, beforeRestart: { beforeRestart: true },
  testedGateway: { gatewayEnabled: true },
})) {
  test("executable rollback restores actual simulated state: " + name, async () => {
    const f = recoveryFixture(options);
    const result = await f.io.recover(f.directory);
    assert.equal(result.status, options.gatewayEnabled ?
      "ROLLBACK_RUNTIME_RESTORED_GATEWAY_DB_DISABLE_REQUIRED" : "ROLLBACK_VERIFIED_OPENAI_ONLY");
    assert.equal(f.storage.get(f.C.root + "/.env").bytes.toString(), f.original.dotenv);
    assert.equal(f.storage.get(f.C.token).bytes.toString(), SECRET);
    assert.equal(f.storage.get(f.C.root + "/ecosystem.config.cjs").bytes.toString(), f.original.ecosystem);
    assert.equal(f.storage.get(f.C.root + "/ecosystem.config.cjs").mode, 0o664);
    assert.equal(f.storage.get(f.C.home + "/dump.pm2").bytes.toString(), f.original["dump.pm2"]);
    assert.equal(f.storage.has(f.C.home + "/dump.pm2.bak"), false);
    assert.equal(f.storage.has(f.C.runtime + "/gateway.json"), false);
    assert.equal(f.storage.has(f.C.loader), false); assert.equal(f.storage.has(f.C.unit), false);
    assert.equal(f.calls.includes("rpc:restart"), !options.beforeRestart);
    assert.ok(f.calls.includes("systemctl:disable pm2-seman.service"));
    assert.ok(f.calls.includes("health"));
  });
}
test("rollback refuses externally changed files instead of deleting or overwriting them", async () => {
  const f = recoveryFixture();
  f.put(f.C.runtime + "/gateway.json", "outside-change");
  await assert.rejects(f.io.recover(f.directory), /RUNTIME_CONFIG_CHANGED/);
  assert.equal(f.calls.includes("rpc:restart"), false);
  assert.equal(f.storage.get(f.C.runtime + "/gateway.json").bytes.toString(), "outside-change");
});
test("rollback refuses a damaged executable bundle before any restart or restoration", async () => {
  const f = recoveryFixture();
  f.put(f.directory + "/bundle/" + helper.SOURCES[0], "damaged");
  await assert.rejects(f.io.recover(f.directory), /ROLLBACK_BUNDLE_CHANGED/);
  assert.equal(f.calls.includes("rpc:restart"), false);
  assert.equal(f.calls.some(c => c.startsWith("restore:")), false);
});
test("standalone rollback verification reads the legacy backup and does not write or restart", async () => {
  const f = recoveryFixture({ beforeRestart: true });
  await f.io.recover(f.directory);
  const before = f.calls.length;
  const result = await f.io.verifyRollback(f.directory);
  assert.equal(result.status, "ROLLBACK_READ_ONLY_VERIFIED");
  assert.equal(result.originalFailureRecorded, false);
  assert.equal(result.productionChanges, false); assert.equal(result.restarts, 0);
  assert.equal(f.calls.slice(before).some(c => /^(journal|restore:|remove:|rpc:restart|systemctl:)/.test(c)), false);
  assert.equal(f.calls.slice(before).includes("synthetic-environment-probe"), true);
});
test("the reported production flag combination leaves PM2 dumps and boot registration untouched", async () => {
  const f = recoveryFixture({ beforeRestart: true, untouchedPM2: true });
  await f.io.recordFailure(f.directory, {
    stage: "installedLoaderValidation", code: "OPERATOR_COMMAND_FAILED", exitStatus: 1,
  });
  await f.io.recover(f.directory);
  assert.equal(f.calls.some(c => /^(rpc:restart|systemctl:)/.test(c)), false);
  assert.equal(f.calls.some(c => c === "restore:" + f.C.home + "/dump.pm2"), false);
  const manifest = JSON.parse(f.storage.get(f.directory + "/manifest.json").bytes);
  assert.equal(manifest.status, "ROLLBACK_VERIFIED_OPENAI_ONLY");
  assert.equal(manifest.applyFailure.stage, "installedLoaderValidation");
  const result = await f.io.verifyRollback(f.directory);
  assert.equal(result.status, "ROLLBACK_READ_ONLY_VERIFIED");
  assert.equal(result.originalFailureRecorded, true);
});
for (const [name, mutate, code] of [
  ["node arguments", f => { f.current.pm2_env.node_args = P.args(); }, "ROLLBACK_NODE_ARGUMENTS_DIFFER"],
  ["original file permissions", f => { f.storage.get(f.C.root + "/ecosystem.config.cjs").mode = 0o777; }, "ROLLBACK_FILE_PROFILE_DIFFERS"],
  ["untouched PM2 dump", f => { f.put(f.C.home + "/dump.pm2", "external-change"); }, "ROLLBACK_FILE_PROFILE_DIFFERS"],
  ["worker identity", f => { f.current.pid++; }, "ROLLBACK_WORKER_IDENTITY_DIFFERS"],
  ["process environment", f => { f.host.initialEnvironment = () => ({ OPENAI_API_KEY: "changed" }); }, "ROLLBACK_PROCESS_ENVIRONMENT_DIFFERS"],
  ["leftover runtime", f => { f.put(f.C.runtime + "/gateway.json", "external-file"); f.put(f.C.unit, "unexpected-unit"); }, "ROLLBACK_TARGET_REMAINS"],
  ["Gateway DB flag", f => { f.options.gatewayEnabled = true; }, "AI_OPENAI_BASELINE_CHANGED"],
]) {
  test("read-only rollback verification refuses " + name + " without changing it", async () => {
    const f = recoveryFixture({ beforeRestart: true });
    await f.io.recover(f.directory); mutate(f);
    const before = f.calls.length;
    await assert.rejects(f.io.verifyRollback(f.directory), new RegExp(code));
    assert.equal(f.calls.slice(before).some(c => /^(journal|restore:|remove:|rpc:restart|systemctl:)/.test(c)), false);
  });
}
test("read-only rollback verification has a separate unambiguous CLI mode", () => {
  assert.deepEqual(helper.parseArgs(["--verify-rollback", "/synthetic/backup"]),
    { mode: "--verify-rollback", directory: "/synthetic/backup" });
  assert.throws(() => helper.parseArgs(["--verify-rollback"]), /EXPLICIT_SEPARATE_APPROVAL_REQUIRED/);
});
test("console launcher accepts only read-only modes and forwards the exact backup to root staging", t => {
  const launcher = path.join(__dirname, "ai-gateway-preflight-console.sh");
  const tools = fs.mkdtempSync(path.join(os.tmpdir(), "gateway-launcher-test-"));
  t.after(() => fs.rmSync(tools, { recursive: true, force: true }));
  const capture = path.join(tools, "capture");
  const pin = "a".repeat(40);
  fs.writeFileSync(path.join(tools, "id"), "#!/bin/bash\nif [[ \"$1\" == -un ]]; then echo seman; else /usr/bin/id \"$@\"; fi\n", { mode: 0o700 });
  fs.writeFileSync(path.join(tools, "git"), "#!/bin/bash\nif [[ \"$3\" == -c && \"$4\" == core.hooksPath=/dev/null && \"$5\" == checkout ]]; then exit 0; fi\n[[ \"$3\" == rev-parse && \"$4\" == FETCH_HEAD ]] || exit 91\nprintf '%s\\n' \"$PREFLIGHT_REV\"\n", { mode: 0o700 });
  fs.writeFileSync(path.join(tools, "sudo"), "#!/bin/bash\n[[ \"$1\" != -v ]] || exit 0\nprintf '%s\\n' \"$@\" > \"$CAPTURE.args\"\ncat > \"$CAPTURE.stdin\"\n", { mode: 0o700 });
  for (const mode of ["preflight", "verify-rollback", "apply", "--apply"]) {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), "indexus-gateway-source."));
    t.after(() => fs.rmSync(src, { recursive: true, force: true }));
    for (const ext of [".args", ".stdin"]) fs.rmSync(capture + ext, { force: true });
    const backup = P.C.backupRoot + "/attempt-exact";
    const r = cp.spawnSync("bash", [launcher], {
      encoding: "utf8", env: { PATH: tools + ":" + process.env.PATH,
        CAPTURE: capture, PREFLIGHT_REV: pin, PREFLIGHT_SOURCE: src,
        PREFLIGHT_MODE: mode, PREFLIGHT_BACKUP: backup },
    });
    if (mode === "apply" || mode === "--apply") {
      assert.equal(r.status, 1); assert.match(r.stdout, /readOnlyModeOrBackup/);
      assert.equal(fs.existsSync(capture + ".args"), false);
    } else {
      assert.equal(r.status, 0, r.stderr);
      const argv = fs.readFileSync(capture + ".args", "utf8").trim().split("\n");
      assert.deepEqual(argv.slice(-3), [src, mode, backup]);
      const script = fs.readFileSync(capture + ".stdin", "utf8");
      assert.match(script, /--verify-rollback "\$BACKUP"/);
      assert.doesNotMatch(script, /--apply|--rollback |restart all/);
      for (const [, expected, name] of script.matchAll(/^([a-f0-9]{64})  ([^\n]+)$/gm))
        assert.equal(P.hash(fs.readFileSync(path.join(__dirname, "..", name))), expected, name);
    }
  }
});
