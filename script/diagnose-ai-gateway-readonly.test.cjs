"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), cp = require("node:child_process");
const vm = require("node:vm");
const h = require("./diagnose-ai-gateway-readonly.cjs");
const SECRET = "DO_NOT_PRINT_fixture_secret_123";
test("environment summaries expose presence and equality, never credentials or arbitrary values", () => {
  const env = { OPENAI_API_KEY: SECRET, DATABASE_URL: SECRET, INDEXUS_AI_GATEWAY_TOKEN: SECRET,
    NODE_OPTIONS: SECRET, INDEXUS_AI_ROUTER_MODE: SECRET, INDEXUS_AI_GATEWAY_BASE_URL: SECRET };
  const result = h.environmentSummary(env);
  assert.equal(result.openaiPresent, true);
  assert.equal(result.routerMode, "other");
  assert.equal(result.approvedGatewayURL, false);
  assert.ok(!JSON.stringify(result).includes(SECRET));
  assert.equal(h.equality(env, { OPENAI_API_KEY: SECRET }, "OPENAI_API_KEY"), true);
  assert.equal(h.equality(env, {}, "OPENAI_API_KEY"), null);
});
test("proc parsing preserves equals signs and selects only necessary keys", () => {
  assert.deepEqual(h.parseEnvironment("OTHER=private\0OPENAI_API_KEY=a=b\0pm_id=4\0"),
    { OPENAI_API_KEY: "a=b", pm_id: "4" });
});
test("PM2 daemon sharing the worker cwd and UID must not count as an application", () => {
  const base = { uid: 1001, cwd: "/var/www/indexus-crm", executable: "/usr/bin/node" };
  const rows = [{ ...base, pid: 20, parent: 1 }, { ...base, pid: 10, parent: 20 },
    { ...base, pid: 30, parent: 999 }, { ...base, pid: 40, parent: 20, uid: 0 }];
  assert.deepEqual(h.selectWorker(rows, 1001, 20).map(p => p.pid), [10]);
});
test("multiple real workers remain ambiguous and unsupported executable names are not guessed", () => {
  const base = { uid: 1001, cwd: "/var/www/indexus-crm", executable: "/usr/bin/node20", parent: 20 };
  assert.equal(h.selectWorker([{ ...base, pid: 10 }, { ...base, pid: 11 }], 1001, 20).length, 2);
  assert.equal(h.selectWorker([{ ...base, pid: 10, executable: "/bin/bash" }], 1001, 20).length, 0);
});
test("empty routes resolve the whole known catalog to OpenAI without claiming provider calls", () => {
  const r = h.routeSummary({ gateway: { enabled: false }, routes: {} }, ["a", "b"]);
  assert.equal(r.allServicesOpenAI, true); assert.equal(r.noModelOverrides, true);
  assert.equal(r.gatewayEnabled, false); assert.equal(r.services.length, 2);
});
test("unknown/internal/disabled routes and model overrides are not hidden", () => {
  const r = h.routeSummary({ gateway: {}, routes: {
    a: { provider: "internal", enabled: true, model: SECRET },
    b: { provider: "openai", enabled: false, model: null },
    extra: { provider: "openai" },
  } }, ["a", "b"]);
  assert.equal(r.allServicesOpenAI, false); assert.equal(r.allServicesEnabled, false);
  assert.equal(r.unknownServices, 1); assert.equal(r.noModelOverrides, false);
  assert.equal(r.gatewayEnabled, null); assert.ok(!JSON.stringify(r).includes(SECRET));
});
test("malformed routes fail closed", () => {
  for (const value of [null, {}, { routes: [] }]) assert.throws(() => h.routeSummary(value, ["a"]));
  assert.equal(h.routeSummary({ routes: { a: null } }, ["a"]).allServicesOpenAI, false);
});
test("unit output never includes environment, command arguments or arbitrary unit values", () => {
  const r = h.safeUnit("User=seman\nUnitFileState=enabled\nActiveState=active\nMainPID=123\n" +
    "ExecStart=/usr/bin/pm2 resurrect " + SECRET + "\nEnvironment=PM2_HOME=/home/seman/.pm2 TOKEN=" + SECRET);
  assert.equal(r.resurrectCommand, true); assert.equal(r.homeMatches, true);
  assert.equal(r.enabled, true); assert.ok(!JSON.stringify(r).includes(SECRET));
});
test("raw exceptions, SQL details, URLs and secrets are suppressed", () => {
  assert.equal(h.errorCode(Error(SECRET)), "CHECK_UNAVAILABLE");
  assert.equal(h.errorCode({ code: "ECONNREFUSED", message: SECRET }), "ECONNREFUSED");
  assert.equal(h.errorCode({ code: "28P01", message: SECRET }), "CHECK_UNAVAILABLE");
});
test("CLI refuses wrong flags without entering production inspection", () => {
  for (const args of [[], ["--apply"], ["--read-only", "--apply"]]) {
    const result = cp.spawnSync(process.execPath, [require.resolve("./diagnose-ai-gateway-readonly.cjs"), ...args],
      { encoding: "utf8", env: { PATH: process.env.PATH } });
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stderr).code, "READ_ONLY_ARGUMENT_REQUIRED");
  }
});
test("stdin launcher runs main rather than silently skipping it", () => {
  const result = cp.spawnSync(process.execPath, ["-", "--wrong"], {
    input: fs.readFileSync(require.resolve("./diagnose-ai-gateway-readonly.cjs")),
    encoding: "utf8", env: { PATH: process.env.PATH },
  });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).code, "READ_ONLY_ARGUMENT_REQUIRED");
});
test("operator source contains no write, PM2 CLI, Gateway transport, or token-file read operation", () => {
  const source = fs.readFileSync(require.resolve("./diagnose-ai-gateway-readonly.cjs"), "utf8");
  assert.doesNotMatch(source, /writeFile|appendFile|mkdir|chmod|chown|unlink|renameSync|\bfetch\(|https\.request|http\.request/);
  assert.doesNotMatch(source, /readFileSync\(TOKEN|read\(TOKEN|run\("pm2"/);
  assert.doesNotMatch(source, /\.query\(["'`](?:UPDATE|DELETE|INSERT|CREATE|ALTER|DROP)/);
});
test("complete simulated inventory uses only read-only SQL and never reads the token file", async () => {
  const root = "/var/www/indexus-crm", home = "/home/seman/.pm2", outputs = [], queries = [], calls = [];
  const env = "DATABASE_URL=postgresql://fixture:fixture@fixture/fixture\0OPENAI_API_KEY=" + SECRET + "\0";
  const files = {
    [root + "/.env"]: "fixture",
    [root + "/ecosystem.config.cjs"]: "module.exports={apps:[]} // " + SECRET,
    [root + "/dist/index.cjs"]: "synthetic built application",
    [root + "/server/config/ai-routing.ts"]: "AI_ROUTING_OVERRIDES: AIRoutingOverrides = Object.freeze({})",
    [root + "/server/lib/ai/service-catalog.ts"]: '"email.reply": "chat",\n"sms.sentiment": "chat",',
    [home + "/pm2.pid"]: "20",
    [home + "/dump.pm2"]: JSON.stringify([{ name: "indexus-crm", pm_id: 4, pm_cwd: root,
      pm_exec_path: root + "/dist/index.cjs", instances: 1, exec_mode: "fork_mode",
      env: { OPENAI_API_KEY: SECRET } }]),
    "/proc/10/environ": env,
    "/proc/10/cmdline": "/usr/bin/node\0" + root + "/dist/index.cjs\0",
    "/proc/20/comm": "PM2 v6",
    "/etc/passwd": "seman:x:1001:1001::/home/seman:/bin/bash\n",
    "/etc/group": "seman:x:1001:\n",
  };
  for (const [pid, parent] of [[10, 20], [20, 1]]) {
    const f = Array(20).fill("0"); f[0] = "S"; f[1] = String(parent); f[19] = "100";
    files["/proc/" + pid + "/stat"] = pid + " (node) " + f.join(" ");
  }
  const stat = file => ({ uid: file.startsWith("/proc/") ? 1001 : 0, gid: 0, mode: 0o100600,
    size: Buffer.byteLength(files[file] || ""), isSymbolicLink: () => false,
    isDirectory: () => [root + "/data", "/etc/indexus-ai"].includes(file), isFile: () => true });
  const fakeFS = {
    lstatSync: stat, statSync: stat, existsSync: file => Object.hasOwn(files, file),
    readdirSync: file => { assert.equal(file, "/proc"); return ["10", "20"]; },
    realpathSync: file => file.endsWith("/exe") ? "/usr/bin/node" : file.endsWith("/cwd") ? root : file,
    readFileSync(file) {
      assert.notEqual(file, "/etc/indexus-ai/gateway-token");
      assert.ok(Object.hasOwn(files, file), "unexpected read: " + file);
      return files[file];
    },
  };
  const fakeCP = { execFileSync(bin, args) {
    calls.push([bin, args]);
    if (bin === "id") return args[0] === "-u" ? "1001\n" : "1001\n";
    if (bin === "getfacl") return "user::rw-\ngroup::---\nother::---";
    if (bin === "/usr/bin/node") return args[0] === "--version" ? "v20.20.0\n" : "supported\n";
    if (bin === "systemctl") return "User=seman\nUnitFileState=enabled\nActiveState=active\nMainPID=20\n" +
      "ExecStart=/usr/bin/pm2 resurrect\nEnvironment=PM2_HOME=" + home + " SECRET=" + SECRET;
    if (bin === "findmnt") return JSON.stringify({ filesystems: [
      { source: "/dev/sdb1", target: root + "/data", avail: 5000000000, options: "rw" },
    ] });
    if (bin === "runuser") return "52902d20b5bad42c60d543f365d33badae647f05\n";
    throw Error("unexpected subprocess");
  } };
  class Client {
    on() {}
    async connect() {}
    async end() {}
    async query(sql) {
      queries.push(sql);
      if (sql === "SELECT version,value FROM public.ai_router_configuration WHERE singleton=true")
        return { rows: [{ version: 1, value: { gateway: { enabled: false }, routes: {} } }] };
      if (sql === "SHOW transaction_read_only") return { rows: [{ transaction_read_only: "on" }] };
      assert.ok(["BEGIN READ ONLY", "ROLLBACK"].includes(sql));
      return { rows: [] };
    }
  }
  const sandbox = { module: { exports: {} }, process: { argv: ["node", "test"], getuid: () => 0 },
    console: { log: s => outputs.push(s), error: s => outputs.push(s) }, Buffer,
    require(name) {
      if (name === "node:fs") return fakeFS;
      if (name === "node:child_process") return fakeCP;
      if (name === "node:os") return { hostname: () => "CORPCRM01" };
      if (name === root + "/node_modules/dotenv") return { parse: () => ({
        DATABASE_URL: "postgresql://fixture:fixture@fixture/fixture", OPENAI_API_KEY: SECRET,
      }) };
      if (name === root + "/node_modules/pg") return { Client };
      if (["node:path", "node:crypto"].includes(name)) return require(name);
      throw Error("unexpected import");
    },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("./diagnose-ai-gateway-readonly.cjs"), "utf8"), sandbox);
  await sandbox.module.exports.main(["--read-only"]);
  assert.equal(outputs.length, 1);
  assert.ok(!outputs[0].includes(SECRET));
  const report = JSON.parse(outputs[0]);
  assert.equal(report.sections.aiRouting.allServicesOpenAI, true);
  assert.equal(report.sections.processes.length, 2);
  assert.equal(report.sections.processSelection.workerCount, 1);
  assert.equal(report.sections.aiRouting.transactionReadOnly, true);
  assert.equal(report.sections.automaticStart.enabled, true);
  assert.equal(report.sections.processIdentityAfter.unchanged, true);
  assert.equal(report.productionChanges, false);
  assert.equal(report.tokenFileContentRead, false);
  assert.equal(report.rebootVerified, false);
  assert.equal(report.result, "INVENTORY_ONLY_NOT_GATEWAY_READY");
  assert.ok(calls.every(([bin]) => bin !== "pm2"));
  assert.deepEqual(queries, ["BEGIN READ ONLY",
    "SELECT version,value FROM public.ai_router_configuration WHERE singleton=true",
    "SHOW transaction_read_only", "ROLLBACK"]);
  outputs.length = 0; queries.length = 0;
  files["/proc/11/stat"] = files["/proc/10/stat"].replace(/^10 /, "11 ");
  fakeFS.readdirSync = () => ["10", "20", "11"];
  await sandbox.module.exports.main(["--read-only"]);
  const stopped = JSON.parse(outputs[0]);
  assert.equal(stopped.status, "READ_ONLY_INVENTORY_STOPPED");
  assert.equal(stopped.sections.processSelection.workerCount, 2);
  assert.equal(stopped.sections.processes.length, 3);
  assert.equal(stopped.result, "PROCESS_SELECTION_REQUIRES_REVIEW");
  assert.equal(sandbox.process.exitCode, 1);
  assert.equal(queries.length, 0);
  assert.ok(!outputs[0].includes(SECRET));
});
