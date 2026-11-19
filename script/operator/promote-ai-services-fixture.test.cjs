"use strict";
// Exercises the actual filesystem/backup/publish/rollback implementation.
// Production processes, PostgreSQL and native commands are injected fixtures.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const real = require("./promote-ai-services.cjs");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-promotion-fixture-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = root + "/app", data = app + "/data", stage = data + "/ai-services-stage-aBwcWg";
  const home = root + "/home", loader = root + "/loader.cjs";
  const write = (name, bytes) => {
    fs.mkdirSync(path.dirname(name), { recursive: true });
    fs.writeFileSync(name, bytes);
  };
  write(home + "/.pm2/pm2.pid", "22545");
  write(home + "/.pm2/dump.pm2", "original PM2 configuration");
  write(root + "/pm2/package.json", JSON.stringify({ name: "pm2" }));
  write(loader, "fixture loader");
  const prior = { "dist/index.cjs": "old backend", "dist/public/index.html": "old index",
    "dist/public/assets/old.js": "old asset" };
  const next = { "dist/index.cjs": "new backend", "dist/ai-worker.cjs": "new worker",
    "dist/public/index.html": "new index", "dist/public/assets/new.js": "new asset" };
  for (const [name, bytes] of Object.entries(prior)) write(app + "/" + name, bytes);
  for (const [name, bytes] of Object.entries(next)) write(stage + "/source/" + name, bytes);
  fs.chmodSync(stage, 0o700);
  let head = real.BASE, pid = options.initialPid || 958103, worker = null;
  const calls = [], messages = [], queries = [];
  const files = Array.from({ length: 70 }, (_, i) => ({ path: `server/source-${i}.ts`,
    baseSha256: sha("old-" + i), sha256: sha("new-" + i) }));
  for (const [i, f] of files.entries()) {
    write(app + "/" + f.path, "old-" + i);
    write(stage + "/source/" + f.path, "new-" + i);
  }
  const expectedBuilt = Object.fromEntries(Object.keys(real.BUILT).map(name => [name, sha(next[name])]));
  const prepared = { mode: "prepared_not_deployed", productionBase: real.BASE, sourceCommit: real.TARGET,
    stageDirectory: stage, outputs: Object.fromEntries(Object.entries(expectedBuilt).map(([k, v]) => [k, { sha256: v }])) };
  write(stage + "/prepared.json", JSON.stringify(prepared));
  const manifest = { format: 2, productionBase: real.BASE, sourceCommit: real.TARGET,
    sourceTree: real.TREE, files };
  const value = { gateway: { enabled: !!options.activeInternal }, routes: {
    "email.monitoring": { enabled: true, provider: options.activeInternal ? "internal" : "openai" },
  } };
  class Client {
    async connect() { calls.push("db.connect"); }
    async end() { calls.push("db.end"); }
    async query(sql) {
      queries.push(sql);
      if (sql.includes("SELECT value FROM")) return { rows: [{ value }] };
      if (sql.includes("pg_database_size")) return { rows: [{ bytes: 1024 }] };
      if (sql.includes("count(*)::int AS count FROM ai_inference_workers"))
        return { rows: [{ count: worker && !options.badHeartbeat ? 1 : 0 }] };
      if (sql.includes("to_regclass")) return { rows: [{ jobs: !options.badSchema, inference: true,
        workers: true, checklist: true }] };
      throw Error("Unexpected SQL");
    }
  }
  const fsProxy = new Proxy(fs, {
    get(target, key) {
      if (key === "chownSync") return () => {};
      if (key === "statfsSync") return () => ({ bsize: 4096, bavail: 100000000 });
      if (key === "readlinkSync") return p => {
        if (/^\/proc\/\d+\/cwd$/.test(p)) return app;
        return fs.readlinkSync(p);
      };
      if (key === "realpathSync") return p => {
        if (p === "/usr/bin/pm2") return root + "/pm2/bin/pm2";
        return fs.realpathSync(p);
      };
      if (key === "readFileSync") return (p, ...args) => {
        if (/^\/proc\/\d+\/status$/.test(p)) return "Uid:\t1001\t1001\t1001\t1001\n";
        if (/^\/proc\/\d+\/environ$/.test(p))
          return "DATABASE_URL=postgresql://synthetic:synthetic@fixture.invalid/fixture\0INDEXUS_AI_ROUTER_MODE=routed\0";
        return fs.readFileSync(p, ...args);
      };
      if (key === "lstatSync") return p => {
        const stat = fs.lstatSync(p);
        if (p === stage || p.startsWith(home + "/.pm2/dump.pm2")) return new Proxy(stat, { get(s, k) {
          return k === "uid" ? p === stage ? 0 : 1001 :
          typeof s[k] === "function" ? s[k].bind(s) : s[k]; } });
        return stat;
      };
      return target[key];
    },
  });
  function git(args, opts) {
    if (args.includes("rev-parse")) {
      const arg = args.at(-1);
      if (arg === "HEAD") return head;
      if (arg === real.TARGET + "^{tree}") return real.TREE;
      if (arg === real.TARGET + "^") return real.BASE;
    }
    if (args.includes("status")) return "";
    if (args.includes("diff")) return files.map(f => f.path).sort().join("\n");
    if (args.includes("archive")) { fs.writeSync(opts.stdio[1], "synthetic archive"); return ""; }
    if (args.includes("merge") || args.includes("reset")) {
      head = args.at(-1);
      for (const [i, f] of files.entries()) write(app + "/" + f.path,
        (head === real.BASE ? "old-" : "new-") + i);
      return "";
    }
    throw Error("Unexpected Git operation");
  }
  const cpProxy = {
    spawnSync: (_bin, args) => {
      calls.push({ privacy: args });
      return { status: options.badPrivacy ? 74 : 0 };
    },
    execFileSync: (bin, args, opts) => {
      calls.push({ bin, args: [...args] });
      if (bin === "findmnt") return JSON.stringify({ filesystems: [{ source: data, target: data }] });
      if (bin === "getent") return `seman:x:1001:1001::${home}:/bin/bash`;
      if (bin === "git") return git(args, opts);
      if (bin === "runuser") {
        if (args.includes("-l")) return "/usr/bin/pm2";
        const operation = args.indexOf("--") + 1;
        const command = args[operation], parameters = args.slice(operation + 1);
        if (command === "git") return git(parameters, opts);
        if (command === "/usr/bin/pm2") {
          if (parameters[0] === "jlist") return JSON.stringify([{ pm_id: 4, name: "indexus-crm", pid,
            pm2_env: { status: "online", pm_cwd: app, pm_exec_path: app + "/dist/index.cjs" } },
            ...(worker ? [worker] : [])]);
          if (parameters[0] === "restart") { assert.equal(parameters[1], "4"); pid++; return ""; }
          if (parameters[0] === "delete") { assert.equal(parameters[1], "5"); worker = null; return ""; }
          if (parameters[0] === "save") {
            assert.equal(fs.statSync(home + "/.pm2/dump.pm2").mode & 0o777, 0o600);
            assert.equal(fs.statSync(home + "/.pm2/dump.pm2.bak").mode & 0o777, 0o600);
            write(home + "/.pm2/dump.pm2", worker ? "saved with worker" : "saved without worker");
            return "";
          }
        }
        if (command === process.execPath && parameters[0] === "-e") {
          assert.equal(opts.stdio[0], "pipe", "private worker JSON requires an actual stdin pipe");
          const code = parameters[1], input = JSON.parse(opts.input);
          assert(!parameters.some(p => p.includes("postgresql://")), "credentials must never be command arguments");
          if (code.includes("INDEXUS_WORKER_CHECK")) {
            assert.equal(input.args[0], "--run");
            if (options.badWorkerCheck) throw Error("synthetic worker check failure");
            return "";
          }
          if (code.includes("INDEXUS_WORKER_START")) {
            assert.equal(input.module, root + "/pm2");
            assert.equal(input.spec.env.DATABASE_URL, "postgresql://synthetic:synthetic@fixture.invalid/fixture");
            assert.equal(input.spec.instances, 1);
            worker = { pm_id: 5, name: "indexus-ai-worker", pid: 968001, pm2_env: {
              status: "online", pm_cwd: app, pm_exec_path: app + "/dist/ai-worker.cjs",
              exec_mode: "fork_mode", instances: 1, node_args: input.spec.node_args, args: ["--run"],
            } };
            if (options.badWorkerStart) throw Error("synthetic partial worker start failure");
            return "";
          }
        }
      }
      if (bin === "tar") {
        if (args[0] === "-xf") {
          const dest = args[args.indexOf("-C") + 1];
          for (const [i, f] of files.entries()) write(dest + "/" + f.path, "old-" + i);
        }
        return "";
      }
      if (bin === "pg_dump") {
        assert.equal(opts.env.PGUSER, "synthetic");
        assert.equal(opts.env.PGHOST, "fixture.invalid");
        assert(!args.some(a => a.includes("postgresql://")));
        if (options.badBackup) throw Error("Synthetic native backup failure");
        write(args[args.indexOf("--file") + 1], "PGDMP synthetic complete fixture");
        return "";
      }
      if (bin === "pg_restore") {
        assert(!args.includes("--dbname")); assert(!args.includes("--clean"));
        assert(args.includes("--list") || args.includes("--file=/dev/null"));
        return "";
      }
      throw Error("Unexpected command: " + bin);
    },
  };
  const httpProxy = { get: (optionsHttp, callback) => {
    const request = new EventEmitter();
    request.destroy = error => request.emit("error", error);
    queueMicrotask(() => {
      const response = new EventEmitter();
      response.destroy = () => {};
      const body = optionsHttp.path === "/" ? fs.readFileSync(app + "/dist/public/index.html") : Buffer.from("{}");
      response.statusCode = optionsHttp.path === "/" ? 200 : 401;
      if (options.badHealth && body.toString() === "new index") response.statusCode = 503;
      callback(response); response.emit("data", body); response.emit("end");
    });
    return request;
  } };
  let clock = Date.now();
  class FastDate extends Date { static now() { clock += 20000; return clock; } }
  const source = fs.readFileSync(require.resolve("./promote-ai-services.cjs"), "utf8")
    .replace('const APP = "/var/www/indexus-crm";', `const APP = ${JSON.stringify(app)};`)
    .replace('const LOADER = "/etc/indexus-ai-runtime/preload.cjs";', `const LOADER = ${JSON.stringify(loader)};`)
    .replace(/const LOADER_HASH = "[a-f0-9]+";/, `const LOADER_HASH = ${JSON.stringify(sha("fixture loader"))};`)
    .replace(/const BUILT = \{[\s\S]*?\n\};/, `const BUILT = ${JSON.stringify(expectedBuilt)};`)
    .replace(/const OLD = \{[\s\S]*?\n\};/, `const OLD = ${JSON.stringify(Object.fromEntries(
      Object.keys(real.OLD).map(name => [name, sha(prior[name])])))};`)
    .replace('fs.realpathSync("/dev/sdb1")', "fs.realpathSync(DATA)");
  const loaded = { exports: {} };
  vm.runInNewContext(source, {
    require: name => {
      if (name === "node:fs") return fsProxy;
      if (name === "node:os") return { hostname: () => "CORPCRM01" };
      if (name === "node:child_process") return cpProxy;
      if (name === "node:http") return httpProxy;
      if (name === "node:module") return { createRequire: () => name => {
        if (name === "pg") return { Client };
        throw Error("Unexpected app dependency");
      } };
      return require(name);
    },
    module: loaded, exports: loaded.exports, Buffer, URL, Date: FastDate,
    process: { env: { PATH: process.env.PATH }, execPath: process.execPath, getuid: () => 0 },
    console: { log: message => messages.push(message) },
    setTimeout: callback => setTimeout(callback, 0),
  });
  const operations = loaded.exports.productionOperations(manifest, { workerApproved: !!options.workerApproved });
  return { root, app, stage, calls, messages, queries, operations, loaded: loaded.exports,
    head: () => head, pid: () => pid, worker: () => worker, restartExternally: () => pid++, prior };
}
test("approved worker path checks schema, starts exactly one worker over stdin and verifies heartbeat and persistence", async t => {
  const f = fixture(t, { workerApproved: true, activeInternal: true });
  try { await f.loaded.orchestrate(f.operations); } finally { await f.operations.close(); }
  assert.equal(f.operations.state.mode, "deployed_worker_ready");
  assert.equal(f.operations.state.workerConcurrency, 1);
  assert.equal(f.operations.state.workerReady, true);
  assert.equal(f.worker().name, "indexus-ai-worker");
  assert.equal(fs.readFileSync(path.dirname(f.app) + "/home/.pm2/dump.pm2", "utf8"), "saved with worker");
  assert.equal(fs.statSync(path.dirname(f.app) + "/home/.pm2/dump.pm2").mode & 0o777, 0o600);
  assert(f.queries.every(q => q.startsWith("SELECT")));
});
test("a verified prior rollback may have a new PID without weakening the deployment identity checks", async t => {
  const f = fixture(t, { workerApproved: true, activeInternal: true, initialPid: 968003 });
  try { await f.loaded.orchestrate(f.operations); } finally { await f.operations.close(); }
  assert.equal(f.operations.state.mode, "deployed_worker_ready");
  assert.equal(f.pid(), 968004);
});
test("a concurrent application restart during backup still stops promotion before source changes", async t => {
  const f = fixture(t, { initialPid: 968003 });
  try {
    await f.operations.preflight(); await f.operations.backup(); f.restartExternally();
    await assert.rejects(f.operations.recheck(), /application_process_changed/);
    assert.equal(f.head(), real.BASE); assert.equal(f.worker(), null);
  } finally { await f.operations.close(); }
});
for (const failure of ["badWorkerCheck", "badWorkerStart", "badHeartbeat", "badHealth"]) {
  test("approved worker path safely restores original app and removes its own worker after " + failure, async t => {
    const f = fixture(t, { workerApproved: true, activeInternal: true, [failure]: true });
    try { await assert.rejects(f.loaded.orchestrate(f.operations)); }
    finally { await f.operations.close(); }
    assert.equal(f.head(), real.BASE);
    assert.equal(f.worker(), null);
    assert.equal(f.operations.state.databaseRestored, false);
    assert.equal(f.operations.state.mode, "failed_previous_runtime_restored");
    assert.equal(fs.readFileSync(f.app + "/dist/index.cjs", "utf8"), "old backend");
    assert.equal(fs.existsSync(f.app + "/dist/ai-worker.cjs"), false);
  });
}
test("actual implementation validates backup, promotes exact files, retains old assets and restarts seman only", async t => {
  const f = fixture(t);
  try { await f.loaded.orchestrate(f.operations); } finally { await f.operations.close(); }
  assert.equal(f.head(), real.TARGET); assert.equal(f.pid(), 958104);
  assert.equal(fs.readFileSync(f.app + "/dist/index.cjs", "utf8"), "new backend");
  assert.equal(fs.readFileSync(f.app + "/dist/public/assets/old.js", "utf8"), "old asset");
  assert.equal(fs.readFileSync(f.app + "/dist/public/assets/new.js", "utf8"), "new asset");
  assert.equal(f.operations.state.mode, "deployed_worker_off");
  assert.equal(f.operations.state.backupValidated, true);
  assert.equal(f.operations.state.providersUnchanged, true);
  assert(f.queries.every(q => q.startsWith("SELECT")));
  const native = f.calls.filter(c => c.bin === "pg_restore");
  assert.equal(native.length, 2);
});
for (const failure of ["badBackup", "badPrivacy", "activeInternal"]) {
  test("actual implementation refuses " + failure + " before live changes", async t => {
    const f = fixture(t, { [failure]: true });
    try { await assert.rejects(f.loaded.orchestrate(f.operations)); }
    finally { await f.operations.close(); }
    assert.equal(f.head(), real.BASE); assert.equal(f.pid(), 958103);
    for (const [name, bytes] of Object.entries(f.prior))
      assert.equal(fs.readFileSync(f.app + "/" + name, "utf8"), bytes);
    assert(!f.calls.some(c => c.bin === "runuser" && c.args.includes("restart")));
  });
}
for (const failure of ["badHealth", "badSchema"]) {
  test("actual implementation restores prior source and runtime after " + failure + ", without restoring DB", async t => {
    const f = fixture(t, { [failure]: true });
    try { await assert.rejects(f.loaded.orchestrate(f.operations)); }
    finally { await f.operations.close(); }
    assert.equal(f.head(), real.BASE);
    assert.equal(f.operations.state.mode, "failed_previous_runtime_restored");
    assert.equal(f.operations.state.databaseRestored, false);
    assert.equal(fs.existsSync(f.app + "/dist/ai-worker.cjs"), false);
    for (const [name, bytes] of Object.entries(f.prior))
      assert.equal(fs.readFileSync(f.app + "/" + name, "utf8"), bytes);
    assert.equal(fs.readFileSync(f.app + "/dist/public/assets/new.js", "utf8"), "new asset");
    assert(f.queries.every(q => q.startsWith("SELECT")));
  });
}
