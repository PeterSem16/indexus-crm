"use strict";
// Real filesystem/atomic-copy/rollback code; only OS, PM2, PostgreSQL and HTTP
// boundaries are simulated. No production access or real inference is used.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const vm = require("node:vm"), { EventEmitter } = require("node:events");
const P = require("./ai-maintenance-promote.cjs");
const B = require("./ai-maintenance-backup.cjs"), S = require("./ai-maintenance-stage.cjs");
const APP = "/var/www/indexus-crm", HOME = "/home/seman", DATA = APP + "/data";
function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-cutover-fixture-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const map = p => typeof p === "string" ? root + p : p;
  const write = (p, text) => { fs.mkdirSync(path.dirname(map(p)), { recursive: true }); fs.writeFileSync(map(p), text); };
  const read = p => fs.readFileSync(map(p), "utf8");
  const files = [...new Set([...S.FILES, "package.json", "package-lock.json", "script/build.ts",
    "server/index.ts", "server/ai-worker.ts", "server/routes.ts"])];
  const added = new Set(S.FILES.filter(f => /maintenance[-.]|AIMaintenanceControl/.test(f)));
  const baseFiles = files.filter(f => !added.has(f));
  const source = (ref, file) => (ref === P.BASE ? "old:" : "new:") + file +
    (file.endsWith("/store.ts") || file.endsWith("/inference-store.ts") ? "\n// pg_try_advisory_xact_lock(517,1)" : "");
  for (const f of files) {
    if (baseFiles.includes(f)) write(APP + "/" + f, source(P.BASE, f));
    write(B.STAGE + "/source/" + f, source(P.TARGET, f));
  }
  const old = {}, built = {};
  for (const f of Object.keys(S.RUNTIME)) {
    write(APP + "/" + f, "old-runtime:" + f); write(B.STAGE + "/source/" + f, "new-runtime:" + f);
    old[f] = B.sha(Buffer.from("old-runtime:" + f)); built[f] = B.sha(Buffer.from("new-runtime:" + f));
  }
  write(APP + "/dist/public/assets/old.js", "old asset");
  write(B.STAGE + "/source/dist/public/assets/new.js", "new asset");
  if (options.collision) {
    write(APP + "/dist/public/assets/fixed.css", "old css");
    write(B.STAGE + "/source/dist/public/assets/fixed.css", "new css");
  }
  write(B.LOADER, "synthetic preload");
  write(APP + "/.env", "DATABASE_URL=postgresql://unit:synthetic@fixture.invalid/db\n");
  write(HOME + "/.pm2/pm2.pid", "555"); write(HOME + "/.pm2/rpc.sock", "");
  for (const name of ["dump.pm2", "dump.pm2.bak"]) write(HOME + "/.pm2/" + name, "private");
  fs.mkdirSync(map(P.BACKUP), { recursive: true, mode: 0o700 }); fs.chmodSync(map(P.BACKUP), 0o700);
  fs.chmodSync(map(B.STAGE), 0o700);
  const processes = [
    { pid: 101, uid: 1001, role: "worker", startTime: "123", cwd: APP, executable: "/usr/bin/node" },
    { pid: 102, uid: 1001, role: "api", startTime: "124", cwd: APP, executable: "/usr/bin/node" },
  ];
  const pm2 = processes.map(p => ({ pid: p.pid, pm_id: p.role === "api" ? 4 : 5,
    name: p.role === "api" ? "indexus-crm" : "indexus-ai-worker", pm2_env: {
      pm_cwd: APP, pm_exec_path: APP + "/dist/" + (p.role === "api" ? "index.cjs" : "ai-worker.cjs"),
      status: "online", exec_interpreter: "/usr/bin/node", exec_mode: "fork_mode", instances: 1,
      node_args: ["--require", B.LOADER], args: p.role === "api" ? [] : ["--run"],
      kill_timeout: p.role === "api" ? 1600 : 160000, autorestart: true, watch: false,
      env: { INDEXUS_AI_GATEWAY_TOKEN: "synthetic-private-token" },
    } }));
  const describe = p => B.processDescription(p);
  const inv = p => B.inventory(map(p)).map(e => ({ ...e,
    uid: p.startsWith(DATA) ? 0 : 1001, gid: p.startsWith(DATA) ? 0 : 1001 }));
  const runtime = inv(APP + "/dist");
  fs.cpSync(map(APP + "/dist"), map(P.BACKUP + "/dist"), { recursive: true });
  write(P.BACKUP + "/runtime-manifest.json", JSON.stringify(runtime));
  write(P.BACKUP + "/database.dump", "PGDMPsynthetic"); write(P.BACKUP + "/source.tar", "synthetic tar");
  const identity = { database: "db", role: "unit", address: "127.0.0.1", port: 5432 };
  const settings = { version: 16, value: { gateway: { enabled: true } } };
  const outputs = Object.fromEntries(Object.entries(B.BUILT).map(([f, sha256]) => [f, { bytes: 50, sha256 }]));
  const checkedAt = new Date().toISOString();
  const marker = { mode: "backup_validated_not_deployed", productionBase: P.BASE, sourceCommit: P.TARGET,
    sourceTree: S.TREE, stageDirectory: B.STAGE, backupDirectory: P.BACKUP, checkedAt,
    backupValidated: true, nativeDatabaseIdentityVerified: true, activeWorkersAtRecheck: 1,
    workerGracefulStopBudgetSufficient: true, maintenanceBefore: { exists: false }, processes,
    pm2: { daemonPid: 555, processes: pm2.map(describe).sort((a, b) => a.role.localeCompare(b.role)) },
    databaseIdentitySha256: B.fingerprint(identity), settingsSha256: B.fingerprint(settings),
    preloadSha256: B.sha(Buffer.from(read(B.LOADER))), applicationEnvSha256: B.sha(Buffer.from(read(APP + "/.env"))),
    sourceArchiveSha256: B.sha(Buffer.from(read(P.BACKUP + "/source.tar"))),
    databaseDump: { bytes: 14, sha256: B.sha(Buffer.from(read(P.BACKUP + "/database.dump"))),
      archiveListed: true, archiveFullyDecoded: true, restoredIntoDatabase: false }, outputs };
  marker.databaseDump.bytes = fs.statSync(map(P.BACKUP + "/database.dump")).size;
  write(P.BACKUP + "/backup-validated.json", JSON.stringify(marker));
  write(B.STAGE + "/prepared.json", JSON.stringify({ ...marker, mode: "prepared_not_deployed", unchangedProcesses: processes }));
  const calls = [], output = [], queries = [];
  let head = P.BASE, gate = false, schema = false, pid = 200, tick = Date.now(), closed = false;
  let lastCountsZero = false, countsReads = 0, runningBackend = "old", lost = false;
  const worker = () => pm2.find(p => p.pm_id === 5), api = () => pm2.find(p => p.pm_id === 4);
  class Clock extends Date { static now() { return tick += 1000; } }
  class Client {
    constructor(o) { assert.equal(o.options, "-c default_transaction_read_only=on"); }
    on() {} async connect() {} async end() { closed = true; gate = false; }
    async query(sql) {
      queries.push(sql);
      if (sql.includes("current_database() AS")) return { rows: [identity] };
      if (sql.includes("SELECT version,value")) return { rows: [settings] };
      if (sql.includes("to_regclass")) return { rows: [{ present: schema }] };
      if (sql.includes("pg_try_advisory_lock")) { gate = !options.busyGate; return { rows: [{ acquired: gate }] }; }
      if (sql.includes("FROM pg_locks")) return { rows: [{ held: gate && !lost }] };
      if (sql.includes("AS jobs,")) {
        lastCountsZero = !options.drainFirst || ++countsReads > 2;
        return { rows: [{ jobs: lastCountsZero ? 0 : 1, inference: 0 }] };
      }
      if (sql.includes("pg_advisory_unlock")) { assert(gate); gate = false; return { rows: [{ released: true }] }; }
      if (sql.includes("FROM ai_queue_maintenance")) {
        if (!schema) throw Object.assign(Error("missing table"), { code: "42P01" });
        return { rows: [{ mode: "running", version: 0, operation_id: null, owner_id: null }] };
      }
      if (sql.includes("LIMIT 0")) return { rows: [] };
      if (sql.includes("AS count FROM ai_inference_workers")) return { rows: [{ count: worker().pid ? 1 : 0 }] };
      if (sql.includes("AS total")) return { rows: [{ total: worker().pid ? 1 : 0,
        compatible: options.badProtocol && runningBackend === "new" ? 0 : 1 }] };
      throw Error("Unexpected query");
    }
  }
  const fakeFS = new Proxy(fs, { get(target, key) {
    if (key === "statfsSync") return () => ({ bsize: 4096, bavail: options.noSpace ? 0 : 100000000 });
    if (key === "readFileSync") return (p, ...args) => {
      if (p === "/proc/555/status") return "Uid:\t1001\t1001\t1001\t1001\n";
      if (/^\/proc\/\d+\/status$/.test(p)) return "Uid:\t1001\t1001\t1001\t1001\nPPid:\t555\n";
      if (/^\/proc\/\d+\/environ$/.test(p)) return "DATABASE_URL=postgresql://unit:synthetic@fixture.invalid/db\0";
      return fs.readFileSync(map(p), ...args);
    };
    if (key === "readlinkSync") return p => p.endsWith("/exe") ? "/usr/bin/node" : APP;
    if (key === "realpathSync") return p => p;
    if (["chownSync", "fchownSync"].includes(key)) return () => {};
    if (key === "lstatSync") return p => {
      const s = fs.lstatSync(map(p)); return new Proxy(s, { get(s, k) {
        if (k === "uid" || k === "gid") return p.startsWith(DATA) ? 0 : 1001;
        if (k === "isSocket" && p.endsWith("/rpc.sock")) return () => true;
        return typeof s[k] === "function" ? s[k].bind(s) : s[k];
      } });
    };
    if (["renameSync", "copyFileSync"].includes(key)) return (from, to, ...a) => fs[key](map(from), map(to), ...a);
    if (["statSync", "createReadStream", "mkdirSync", "chmodSync", "unlinkSync",
      "existsSync", "writeFileSync", "appendFileSync", "openSync", "rmdirSync"].includes(key))
      return (p, ...a) => fs[key](map(p), ...a);
    return fs[key];
  } });
  function git(args) {
    const a = args.slice(args.indexOf(APP) + 1);
    if (a[0] === "status") return "";
    if (a[0] === "rev-parse") return a[1].includes("^{tree}") ? S.TREE : a[1].endsWith("^") ? P.BASE : head;
    if (a[0] === "diff") return S.FILES.join("\n");
    if (a[0] === "ls-tree") return (a.at(-1) === P.BASE ? baseFiles : files).join("\n");
    if (a[0] === "show") { const at = a[1].indexOf(":"); return Buffer.from(source(a[1].slice(0, at), a[1].slice(at + 1))); }
    if (["merge", "reset"].includes(a[0])) {
      assert(gate); assert.equal(worker().pid, 0); head = a.at(-1);
      for (const f of files) {
        if (head === P.BASE && added.has(f)) fs.rmSync(map(APP + "/" + f), { force: true });
        else write(APP + "/" + f, source(head, f));
      }
      return "";
    }
    throw Error("Unexpected git command");
  }
  function run(bin, args) {
    calls.push([bin, ...args]);
    if (bin === "findmnt") return JSON.stringify({ filesystems: [{ source: "/dev/sdb1", target: DATA }] });
    if (bin === "getent") return "seman:x:1001:1001::/home/seman:/bin/bash\n";
    if (bin === "git") return git(args);
    if (bin === "runuser") {
      if (args.includes("command -v pm2")) return "/usr/bin/pm2\n";
      if (args.includes("git")) return git(args.slice(args.indexOf("git") + 1));
      const a = args.slice(args.indexOf("/usr/bin/pm2") + 1);
      if (a[0] === "jlist") return JSON.stringify(pm2);
      assert(gate && !lost);
      if (a[0] === "save") return "";
      const p = pm2.find(p => p.pm_id === +a[1]);
      if (a[0] === "stop") {
        assert(lastCountsZero); p.pid = 0; p.pm2_env.status = "stopped"; p.pm2_env.exit_code = 0;
        if (options.loseGate) lost = true;
      } else if (a[0] === "restart") {
        p.pid = ++pid; p.pm2_env.status = "online";
        if (p.pm_id === 4) { schema = true; runningBackend = read(APP + "/dist/index.cjs").startsWith("new-") ? "new" : "old"; }
      } else throw Error("Unexpected PM2 mutation");
      return "";
    }
    throw Error("Unexpected executable");
  }
  const fakeHttp = { get(opts, callback) {
    const req = new EventEmitter(); req.destroy = e => req.emit("error", e);
    queueMicrotask(() => {
      const res = new EventEmitter(); res.destroy = e => res.emit("error", e);
      res.statusCode = options.badApi && runningBackend === "new" ? 500 : opts.path === "/" ? 200 : 401;
      callback(res);
      queueMicrotask(() => { res.emit("data", Buffer.from(opts.path === "/" ? read(APP + "/dist/public/index.html") : "{}")); res.emit("end"); });
    }); return req;
  } };
  const exported = { exports: {} };
  const text = fs.readFileSync(require.resolve("./ai-maintenance-promote.cjs"), "utf8")
    .replace(P.MARKER, B.sha(Buffer.from(read(P.BACKUP + "/backup-validated.json"))));
  vm.runInNewContext(`(function(require,module,exports){${text}\n})`, { Buffer, Date: Clock,
    setTimeout: fn => { queueMicrotask(fn); }, process: { env: { PATH: "/usr/bin" }, getuid: () => 0 },
    console: { log: s => output.push(s), error: s => output.push(s) },
  })(name => name === "node:fs" ? fakeFS : name === "node:child_process" ? {
    execFileSync: run, spawnSync: () => ({ status: 1 }),
  } : name === "node:http" ? fakeHttp : name === "node:os" ? { hostname: () => "CORPCRM01" } :
    name === "node:module" ? { createRequire: () => () => ({ Client }) } : require(name), exported, exported.exports);
  const helpers = { ...S, RUNTIME: old, assertMount: m => S.assertMount(m, p => p),
    applicationProcesses: () => JSON.parse(JSON.stringify(processes)),
    regular: (dir, f, optional) => {
      try { return fs.readFileSync(map(dir + "/" + f)); } catch (e) {
        if (optional && e.code === "ENOENT") return null; throw e;
      }
    } };
  return { output, queries, calls, read, pm2, isClosed: () => closed, head: () => head,
    run: () => exported.exports.main(["--apply", P.TARGET], helpers, { ...B, BUILT: built, inventory: inv }) };
}
test("actual promotion publishes assets, restarts the same services and releases claims only after readiness", async t => {
  const f = fixture(t, { drainFirst: true }); const result = await f.run();
  assert.equal(result.mode, "deployed"); assert.equal(result.operatorClaimGateReleased, true);
  assert.equal(f.head(), P.TARGET); assert.equal(result.workerProtocol, 1);
  assert.equal(f.read(APP + "/dist/public/assets/old.js"), "old asset");
  assert.equal(f.read(APP + "/dist/public/assets/new.js"), "new asset");
  assert(f.read(APP + "/dist/public/index.html").startsWith("new-runtime:"));
  assert(f.isClosed()); assert(!JSON.stringify(f.output).includes("synthetic-private-token"));
  assert(f.queries.every(q => /^\s*SELECT\b/.test(q)));
});
for (const option of ["collision", "busyGate", "noSpace"]) {
  test("actual pre-cutover refusal for " + option + " leaves both original processes running", async t => {
    const f = fixture(t, { [option]: true }); await assert.rejects(f.run());
    assert.equal(f.head(), P.BASE); assert.deepEqual(f.pm2.map(p => p.pid), [101, 102]);
    assert(f.read(APP + "/dist/index.cjs").startsWith("old-runtime:"));
  });
}
for (const option of ["badApi", "badProtocol"]) {
  test("actual " + option + " failure restores old code and runtime but retains additive schema and both asset generations", async t => {
    const f = fixture(t, { [option]: true }); await assert.rejects(f.run());
    const result = JSON.parse(f.output.at(-1));
    assert.equal(result.mode, "previous_code_restored"); assert.equal(result.databaseRestored, false);
    assert.equal(result.failedPhase, option === "badApi" ? "restart_indexus_web" : "verify_worker_protocol");
    assert.equal(result.schemaMayHaveChanged, true); assert.equal(f.head(), P.BASE);
    assert(f.read(APP + "/dist/index.cjs").startsWith("old-runtime:"));
    assert(f.read(APP + "/dist/public/index.html").startsWith("old-runtime:"));
    assert.equal(f.read(APP + "/dist/public/assets/new.js"), "new asset");
    assert(f.pm2.every(p => p.pid > 0)); assert(f.isClosed());
  });
}
test("actual lost claim gate prevents blind rollback or a forced worker restart", async t => {
  const f = fixture(t, { loseGate: true }); await assert.rejects(f.run());
  assert.equal(JSON.parse(f.output.at(-1)).mode, "manual_recovery_required");
  assert.equal(f.head(), P.BASE); assert.equal(f.pm2.find(p => p.pm_id === 5).pid, 0);
  assert(!f.calls.some(a => a.includes("restart")));
});
