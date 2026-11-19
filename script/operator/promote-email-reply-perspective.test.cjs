"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const vm = require("node:vm"), crypto = require("node:crypto"), { EventEmitter } = require("node:events");
const { spawnSync } = require("node:child_process");
const op = require("./promote-email-reply-perspective.cjs");
const hash = s => crypto.createHash("sha256").update(s).digest("hex");
const TARGET = "f".repeat(40);
const source = fs.readFileSync(__dirname + "/promote-email-reply-perspective.cjs", "utf8");
test("real operator entry rejects an unpinned invocation before any production activity", () => {
  const result = spawnSync(process.execPath, [__dirname + "/promote-email-reply-perspective.cjs", "--apply", "unreviewed"],
    { encoding: "utf8" });
  assert.equal(result.status, 1); assert.match(result.stderr, /explicit_pinned_apply_required/);
});
function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reply-promote-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = root + "/app", data = app + "/data", home = root + "/home";
  const contents = { backend: "old backend", index: "old frontend", worker: "running worker", loader: "loader" };
  const originals = ["03e956745252f86f73378e349bf686474fe334c760e3273319dfc454b38de871",
    "1e1768754e6b3c810017b9baa50617b56060c9b5d7c0e675bb37f5e6f7813d7f",
    "6fc5c55a2669129f0442ff9fccdeef9b22262a89144e86e58002a2b71700bf37",
    "33af3aaff20605583f9152fcad2abe61ec0cef4c4ebe771e43f0cf7d87aa0fac"];
  const replacements = Object.values(contents).map(hash);
  const files = { "server/routes.ts": "new source", "server/lib/ai/email-reply-perspective.test.cjs": "synthetic test" };
  const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  write(app + "/dist/index.cjs", contents.backend); write(app + "/dist/public/index.html", contents.index);
  write(app + "/dist/ai-worker.cjs", contents.worker); write(app + "/server/routes.ts", "old source");
  write(root + "/loader.cjs", contents.loader); write(home + "/.pm2/pm2.pid", "22545");
  fs.mkdirSync(data);
  let head = op.BASE, pid = 999493, settings = { active: "original" };
  const calls = [], logs = [], queries = [];
  let code = source.replaceAll('"/var/www/indexus-crm"', JSON.stringify(app))
    .replaceAll('"/etc/indexus-ai-runtime/preload.cjs"', JSON.stringify(root + "/loader.cjs"));
  originals.forEach((old, i) => { code = code.replaceAll(old, replacements[i]); });
  Object.entries(op.FILES).forEach(([file, old]) => { code = code.replaceAll(old, hash(files[file])); });
  const fsProxy = new Proxy(fs, { get(obj, key) {
    if (key === "readFileSync") return (file, ...rest) => {
      if (/^\/proc\/\d+\/status$/.test(file)) return "Uid:\t1001\t1001\t1001\t1001\n";
      if (/^\/proc\/\d+\/environ$/.test(file)) return "DATABASE_URL=postgresql://synthetic:synthetic@fixture.invalid/test\0";
      return fs.readFileSync(file, ...rest);
    };
    if (key === "readlinkSync") return file => /^\/proc\/\d+\/cwd$/.test(file) ? app : fs.readlinkSync(file);
    if (key === "fchownSync") return () => {};
    return obj[key];
  } });
  const pmRows = () => [
    { name: "indexus-crm", pm_id: 4, pid, pm2_env: {
      status: "online", exec_mode: "fork_mode", pm_cwd: app, pm_exec_path: app + "/dist/index.cjs" } },
    { name: "indexus-ai-worker", pm_id: 5, pid: 999532, pm2_env: {
      status: "online", exec_mode: "fork_mode", pm_cwd: app, pm_exec_path: app + "/dist/ai-worker.cjs" } },
  ];
  function git(args) {
    const at = args.findIndex(a => ["rev-parse", "status", "diff", "show", "archive", "merge", "reset"].includes(a));
    const a = args.slice(at);
    if (a[0] === "rev-parse") return a[1] === "HEAD" ? head : op.BASE;
    if (a[0] === "status") return "";
    if (a[0] === "diff") return [...Object.keys(files), ...(options.badScope ? ["package.json"] : [])].sort().join("\n");
    if (a[0] === "show") return files[a[1].slice(41)];
    if (a[0] === "archive") { write(a.find(s => s.startsWith("--output=")).slice(9), "disk archive"); return ""; }
    if (a[0] === "merge") {
      assert.deepEqual(Array.from(a), ["merge", "--ff-only", TARGET]);
      head = TARGET; for (const [file, text] of Object.entries(files)) write(app + "/" + file, text);
      return "";
    }
    if (a[0] === "reset") {
      assert.deepEqual(Array.from(a), ["reset", "--keep", op.BASE]);
      head = op.BASE; write(app + "/server/routes.ts", "old source");
      fs.unlinkSync(app + "/server/lib/ai/email-reply-perspective.test.cjs"); return "";
    }
    throw Error("Unmocked git");
  }
  const cpProxy = { execFileSync(bin, args, opts) {
    calls.push({ bin, args: Array.from(args) });
    if (bin === "findmnt") return JSON.stringify({ filesystems: [{ source: "/dev/sdb1", target: data }] });
    if (bin === "getent") return `seman:x:1001:1001::${home}:/bin/bash`;
    if (bin === "git") return git(args);
    if (bin === "tar") {
      const view = args[args.indexOf("-C") + 1];
      for (const [file, text] of Object.entries(files)) write(view + "/" + file, text);
      write(view + "/script/build.ts", 'const allowlist = ["pg",];');
      write(view + "/package.json", '{"dependencies":{"pg":"1","external-fixture":"1"}}');
      return "";
    }
    if (bin === "runuser") {
      const sep = args.indexOf("--"), command = args[sep + 1], a = args.slice(sep + 2);
      if (command === "sh") return "/usr/bin/pm2";
      if (command === "git") return git(a);
      if (command === "/usr/bin/pm2") {
        if (a[0] === "jlist") return JSON.stringify(pmRows());
        assert.deepEqual(Array.from(a), ["restart", "4"]);
        pid++;
        if (options.settingsChanged && head === TARGET) settings = { active: "edited externally" };
        return "";
      }
    }
    if (bin === process.execPath) {
      if (args[0] === "--test") {
        assert(opts.cwd.startsWith(data + "/email-reply-fix-"));
        if (options.badTests) throw Error("synthetic tests failure");
        return "4 tests passed";
      }
      assert.equal(args[0], "--check"); return "";
    }
    throw Error("Unmocked operation: " + bin);
  } };
  const appRequire = name => {
    if (name === "pg") return { Client: class {
      async connect() {}
      async end() {}
      async query(sql) {
        queries.push(sql); assert(/^(?:SELECT|SET default_transaction_read_only=on)/.test(sql));
        if (sql.includes("ai_router_configuration")) return { rows: [{ value: settings }] };
        return { rows: [{ count: 1 }] };
      }
    } };
    if (name === "esbuild") return { async build(config) {
      assert(config.absWorkingDir.startsWith(data + "/email-reply-fix-"));
      assert.equal(config.outfile, "dist/index.cjs"); assert.equal(config.minify, true);
      assert.deepEqual(Array.from(config.external), ["external-fixture"]);
      if (options.badBuild) throw Error("synthetic build failure");
      write(config.absWorkingDir + "/dist/index.cjs", "new backend");
    } };
    throw Error("Unmocked require: " + name);
  };
  fs.mkdirSync(app + "/node_modules");
  const httpProxy = { get(config, callback) {
    const req = new EventEmitter(); req.destroy = error => req.emit("error", error);
    queueMicrotask(() => {
      const res = new EventEmitter(); res.resume = () => {};
      res.statusCode = config.path === "/" ? options.badHealth && fs.readFileSync(app + "/dist/index.cjs", "utf8") === "new backend" ? 500 : 200 : 401;
      callback(res); queueMicrotask(() => res.emit("end"));
    });
    return req;
  } };
  let clock = 0;
  class FastDate extends Date { static now() { return clock += 10000; } }
  const fakeProcess = { env: {}, execPath: process.execPath, getuid: () => 0, exitCode: 0 };
  const module = { exports: {} };
  const requireMock = name => {
    if (name === "node:fs") return fsProxy;
    if (name === "node:os") return { hostname: () => "CORPCRM01" };
    if (name === "node:child_process") return cpProxy;
    if (name === "node:module") return { createRequire: () => appRequire };
    if (name === "node:http") return httpProxy;
    return require(name);
  };
  requireMock.main = {};
  vm.runInNewContext(code, { require: requireMock, module, process: fakeProcess,
    console: { log: s => logs.push(s), error: s => logs.push(s) }, Date: FastDate,
    setTimeout: fn => { queueMicrotask(fn); return 0; } });
  return { app, data, calls, queries, logs, head: () => head, settings: () => settings,
    run: () => module.exports.main(["--apply", TARGET]) };
}
test("actual operator promotes only the backend and keeps the running worker and configuration", async t => {
  const f = fixture(t); await f.run();
  const result = JSON.parse(f.logs.at(-1));
  assert.equal(result.mode, "email_reply_prompt_deployed");
  assert.equal(result.liveModelTestPerformed, false); assert.equal(result.workerPid, 999532);
  assert.equal(f.head(), TARGET);
  assert.equal(fs.readFileSync(f.app + "/dist/public/index.html", "utf8"), "old frontend");
  assert.equal(fs.readFileSync(f.app + "/dist/ai-worker.cjs", "utf8"), "running worker");
  assert.equal(fs.statSync(result.backupDirectory).mode & 0o777, 0o700);
  assert.equal(fs.readFileSync(result.backupDirectory + "/previous-index.cjs", "utf8"), "old backend");
  assert.equal(fs.existsSync(f.data + "/ai-services-deployment-lock"), false);
});
for (const failure of ["badScope", "badTests", "badBuild"]) {
  test("actual operator leaves live source and runtime untouched after " + failure, async t => {
    const f = fixture(t, { [failure]: true }); await f.run();
    assert.equal(JSON.parse(f.logs.at(-1)).mode, "email_reply_promotion_stopped");
    assert.equal(f.head(), op.BASE);
    assert.equal(fs.readFileSync(f.app + "/dist/index.cjs", "utf8"), "old backend");
    assert(!f.calls.some(c => c.args.includes("restart")));
  });
}
for (const failure of ["badHealth", "settingsChanged"]) {
  test("actual operator restores the old backend without overwriting settings after " + failure, async t => {
    const f = fixture(t, { [failure]: true }); await f.run();
    const result = JSON.parse(f.logs.at(-1));
    assert.equal(result.rollbackFailed, false); assert.equal(result.databaseRestored, false);
    assert.equal(f.head(), op.BASE);
    assert.equal(fs.readFileSync(f.app + "/dist/index.cjs", "utf8"), "old backend");
    assert.equal(fs.readFileSync(f.app + "/dist/ai-worker.cjs", "utf8"), "running worker");
    if (failure === "settingsChanged") assert.equal(f.settings().active, "edited externally");
  });
}
