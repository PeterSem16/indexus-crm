"use strict";
// Execute the production implementation with real private filesystem fixtures.
// Only privileged process, PostgreSQL and native CLI boundaries are replaced.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const real = require("./ai-maintenance-backup.cjs");
const stage = require("./ai-maintenance-stage.cjs");
const APP = "/var/www/indexus-crm", DATA = APP + "/data", HOME = "/home/seman";
function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-backup-production-fixture-"));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const mapped = p => typeof p !== "string" ? p : root + p;
  const write = (p, value) => {
    fs.mkdirSync(path.dirname(mapped(p)), { recursive: true });
    fs.writeFileSync(mapped(p), value);
  };
  const processes = [
    { pid: 101, role: "worker", uid: 1001, startTime: "123", cwd: APP, executable: "/usr/bin/node" },
    { pid: 102, role: "api", uid: 1001, startTime: "124", cwd: APP, executable: "/usr/bin/node" },
  ];
  const files = [...new Set([...stage.FILES, "package.json", "package-lock.json", "script/build.ts",
    "server/index.ts", "server/ai-worker.ts", "server/routes.ts"])];
  for (const file of files) {
    write(APP + "/" + file, "old:" + file);
    write(real.STAGE + "/source/" + file, "new:" + file);
  }
  const runtime = {}, built = {};
  for (const file of Object.keys(stage.RUNTIME)) {
    write(APP + "/" + file, "runtime:" + file);
    write(real.STAGE + "/source/" + file, "built:" + file);
    runtime[file] = real.sha(Buffer.from("runtime:" + file));
    built[file] = real.sha(Buffer.from("built:" + file));
  }
  write(real.LOADER, "synthetic preload");
  write(APP + "/.env", "DATABASE_URL=postgresql://unit:synthetic@fixture.invalid/db\n");
  write(HOME + "/.pm2/pm2.pid", "555");
  write(HOME + "/.pm2/rpc.sock", "");
  write(HOME + "/.pm2/dump.pm2", "synthetic private pm2 snapshot");
  fs.chmodSync(mapped(real.STAGE), 0o700);
  const prepared = { mode: "prepared_not_deployed", productionBase: real.BASE, sourceCommit: real.TARGET,
    sourceTree: real.TREE, stageDirectory: real.STAGE, unchangedProcesses: processes,
    outputs: Object.fromEntries(Object.entries(built).map(([file, sha256]) => [file, { sha256, bytes: 50 }])) };
  write(real.STAGE + "/prepared.json", JSON.stringify(prepared));
  const calls = [], output = [], queries = [];
  let settingsReads = 0, ended = false;
  const identity = { database: "db", role: "unit", address: "127.0.0.1", port: 5432 };
  const pm2 = processes.map(p => ({ pid: p.pid, pm_id: p.role === "api" ? 4 : 7,
    name: p.role === "api" ? "indexus-crm" : "indexus-ai-worker", pm2_env: {
      status: "online", pm_cwd: APP, exec_mode: "fork_mode", instances: 1,
      pm_exec_path: APP + "/dist/" + (p.role === "api" ? "index.cjs" : "ai-worker.cjs"),
      exec_interpreter: "/usr/bin/node", node_args: ["--require", real.LOADER],
      args: p.role === "api" ? [] : ["--run"], kill_timeout: 160000,
    } }));
  class Client {
    constructor(config) { assert.equal(config.options, "-c default_transaction_read_only=on"); }
    on() {}
    async connect() { calls.push("db.connect"); }
    async end() { ended = true; }
    async query(sql) {
      queries.push(sql);
      if (sql.includes("pg_database_size")) return { rows: [{ ...identity, bytes: "10000" }] };
      if (sql.includes("SELECT version,value")) return { rows: [{ version: ++settingsReads > 1 &&
        options.settingsChanged ? 17 : 16, value: { gateway: { enabled: true } } }] };
      if (sql.includes("GROUP BY status")) return { rows: [{ queue: "jobs", status: "pending", count: 2 }] };
      if (sql.includes("FROM ai_inference_workers")) return { rows: [{ count: 1 }] };
      if (sql.includes("to_regclass")) return { rows: [{ present: false }] };
      throw Error("Unexpected SQL");
    }
  }
  const fsProxy = new Proxy(fs, { get(target, key) {
    if (key === "statfsSync") return () => ({ bsize: 4096, bavail: 100000000 });
    if (key === "realpathSync") return p => p;
    if (key === "readFileSync") return (p, ...args) => {
      if (p === "/proc/555/status") return "Uid:\t1001\t1001\t1001\t1001\n";
      if (/^\/proc\/10[12]\/status$/.test(p)) return "PPid:\t555\n";
      if (p === "/proc/102/environ") return "DATABASE_URL=postgresql://unit:synthetic@fixture.invalid/db\0";
      return fs.readFileSync(mapped(p), ...args);
    };
    if (["lstatSync", "statSync"].includes(key)) return p => {
      const stat = fs[key](mapped(p));
      const uid = p.startsWith(DATA + "/ai-maintenance-") || p === real.LOADER ? 0 : 1001;
      return new Proxy(stat, { get(s, k) {
        if (k === "uid" || k === "gid") return uid;
        if (k === "isSocket" && p.endsWith("/rpc.sock")) return () => true;
        const value = s[k]; return typeof value === "function" ? value.bind(s) : value;
      } });
    };
    if (key === "mkdtempSync") return p => fs.mkdtempSync(mapped(p)).slice(root.length);
    if (["copyFileSync", "cpSync"].includes(key))
      return (from, to, ...args) => fs[key](mapped(from), mapped(to), ...args);
    if (["readdirSync", "chmodSync", "existsSync", "mkdirSync", "openSync",
      "rmdirSync", "createReadStream", "writeFileSync"].includes(key))
      return (p, ...args) => fs[key](mapped(p), ...args);
    return fs[key];
  } });
  function run(bin, argv, opts) {
    calls.push([bin, ...argv]);
    if (bin === "findmnt") return JSON.stringify({ filesystems: [{ source: "/dev/sdb1", target: DATA }] });
    if (bin === "getent") return "seman:x:1001:1001::/home/seman:/bin/bash\n";
    if (bin === "runuser") return argv.includes("jlist") ? JSON.stringify(pm2) : "/usr/bin/pm2\n";
    if (bin === "psql") return JSON.stringify({ ...identity, role: options.nativeMismatch ? "root" : "unit" });
    if (bin === "git") {
      const a = argv.slice(argv.indexOf(APP) + 1);
      if (a[0] === "status") return "";
      if (a[0] === "rev-parse") return a[1].includes("^{tree}") ? real.TREE : real.BASE;
      if (a[0] === "diff") return stage.FILES.join("\n");
      if (a[0] === "ls-tree") return files.join("\n");
      if (a[0] === "show") {
        const at = a[1].indexOf(":"), file = a[1].slice(at + 1);
        return Buffer.from((a[1].slice(0, at) === real.BASE ? "old:" : "new:") + file);
      }
      if (a[0] === "archive") { fs.writeSync(opts.stdio[1], "synthetic tar archive"); return ""; }
    }
    if (bin === "tar") return "synthetic source listing\n";
    if (["pg_dump", "pg_restore"].includes(bin)) {
      if (argv[0] === "--version") return bin + " (PostgreSQL) 17.0\n";
      assert.equal(opts.env.PGUSER, "unit"); assert.equal(opts.env.PGDATABASE, "db");
      if (bin === "pg_dump") {
        if (options.dumpFails) throw Object.assign(Error("synthetic-private-error"), { code: "SYNTHETIC" });
        write(argv[argv.indexOf("--file") + 1], "PGDMPsynthetic archive");
      } else if (options.decodeFails && argv[0] === "--file=/dev/null") throw Error("synthetic decode failed");
      return "";
    }
    throw Error("Unexpected native call: " + bin);
  }
  const module = { exports: {} };
  const source = fs.readFileSync(require.resolve("./ai-maintenance-backup.cjs"), "utf8");
  const replaced = source.replaceAll(/(?<=")[a-f0-9]{64}(?=")/g, match => {
    const file = Object.keys(real.BUILT).find(file => real.BUILT[file] === match);
    return file ? built[file] : match;
  });
  vm.runInNewContext(`(function(require,module,exports){${replaced}\n})`, {
    Buffer, URL, process: { env: { PATH: "/usr/bin", HOME: "/root" }, getuid: () => 0 },
    console: { log: value => output.push(value), error: value => output.push(value) },
  })(name => name === "node:fs" ? fsProxy : name === "node:os" ? { hostname: () => "CORPCRM01" }
    : name === "node:child_process" ? { execFileSync: run, spawnSync: () => ({ status: 1 }) }
    : name === "node:module" ? { createRequire: () => name => {
      if (name === "pg") return { Client };
      throw Error("Unexpected application dependency");
    } } : require(name), module, module.exports);
  const helpers = { ...stage, RUNTIME: runtime,
    assertMount: mounts => stage.assertMount(mounts, p => p),
    applicationProcesses: () => JSON.parse(JSON.stringify(processes)),
    regular: (root, file, optional) => {
      try { return fs.readFileSync(mapped(root + "/" + file)); }
      catch (e) { if (optional && e.code === "ENOENT") return null; throw e; }
    } };
  return { calls, output, queries, root, mapped, ended: () => ended,
    run: () => module.exports.main(["--backup"], helpers) };
}
test("actual production backup flow keeps live bytes and validates native identity and complete archive", async t => {
  const f = fixture(t);
  const before = fs.readFileSync(f.mapped(APP + "/dist/index.cjs"));
  const result = await f.run();
  assert.equal(result.mode, "backup_validated_not_deployed");
  assert.equal(result.nativeDatabaseIdentityVerified, true);
  assert.equal(result.databaseDump.archiveFullyDecoded, true);
  assert.equal(result.databaseDump.restoredIntoDatabase, false);
  assert.equal(result.workerGracefulStopBudgetSufficient, true);
  assert.equal(fs.statSync(f.mapped(result.backupDirectory)).mode & 0o777, 0o700);
  assert.equal(fs.statSync(f.mapped(result.backupDirectory + "/database.dump")).mode & 0o777, 0o600);
  assert.deepEqual(fs.readFileSync(f.mapped(APP + "/dist/index.cjs")), before);
  assert(f.ended()); assert(!JSON.stringify(f.output).includes("synthetic-private"));
  assert(!f.calls.some(c => Array.isArray(c) && ["start", "stop", "restart", "save"].some(x => c.includes(x))));
  assert(f.queries.every(sql => /^\s*SELECT\b/.test(sql)));
});
for (const [key, phase] of [["nativeMismatch", "preflight"], ["dumpFails", "database_dump"],
  ["decodeFails", "database_archive_validation"], ["settingsChanged", "recheck_live_application"]]) {
  test("actual production flow fails closed on " + key + " without publishing a valid-backup marker", async t => {
    const f = fixture(t, { [key]: true });
    await assert.rejects(f.run());
    const result = JSON.parse(f.output.at(-1));
    assert.equal(result.mode, "backup_failed_no_deployment"); assert.equal(result.phase, phase);
    assert.equal(result.workerRestarted, false); assert(f.ended());
    if (result.backupDirectory)
      assert.equal(fs.existsSync(f.mapped(result.backupDirectory + "/backup-validated.json")), false);
    assert(!JSON.stringify(f.output).includes("synthetic-private-error"));
    assert.equal(fs.existsSync(f.mapped(DATA + "/ai-services-deployment-lock")), false);
  });
}
