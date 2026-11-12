"use strict";
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const cp = require("node:child_process"), vm = require("node:vm");
const { C, ensure, hash, stable, assertRoutes, assertOpenAI, renderUnit } = require("./ai-gateway-policy.cjs");
const CLEAN = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  HOME: "/root", LANG: "C.UTF-8" };
function command(bin, argv, options = {}) {
  try {
    return cp.execFileSync(bin, argv, { env: CLEAN, cwd: "/", encoding: "utf8", timeout: 30000,
      maxBuffer: 16 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"], ...options });
  } catch (error) {
    const code = error?.code === "ENOENT" ? "OPERATOR_EXECUTABLE_NOT_FOUND" :
      ["EACCES", "EPERM"].includes(error?.code) ? "OPERATOR_EXECUTABLE_ACCESS_DENIED" : "OPERATOR_COMMAND_FAILED";
    const safe = Error(code);
    safe.operatorCode = code;
    if (Number.isInteger(error?.status) && error.status >= 0 && error.status <= 255)
      safe.operatorExitStatus = error.status;
    throw safe;
  }
}
function noLinks(file) {
  let cursor = "/";
  for (const p of path.resolve(file).slice(1).split("/")) {
    cursor = path.join(cursor, p);
    ensure(!fs.lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink(), "UNSAFE_SYMLINK");
  }
}
function file(file, optional = false) {
  noLinks(file);
  const s = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!s && optional) return null;
  ensure(s?.isFile() && s.size <= 16 * 1024 * 1024, "UNSAFE_FILE");
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const actual = fs.fstatSync(fd);
    ensure(actual.ino === s.ino && actual.dev === s.dev, "FILE_IDENTITY_CHANGED");
    return { bytes: fs.readFileSync(fd), uid: s.uid, gid: s.gid, mode: s.mode & 0o7777, ino: s.ino, dev: s.dev };
  } finally { fs.closeSync(fd); }
}
function atomic(fileName, bytes, profile, replace = false) {
  noLinks(fileName);
  const temporary = path.join(path.dirname(fileName), ".gateway-" + require("node:crypto").randomUUID());
  try {
    const fd = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(fd, bytes); fs.fchownSync(fd, profile.uid, profile.gid);
      fs.fchmodSync(fd, profile.mode); fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    if (replace) fs.renameSync(temporary, fileName);
    else { fs.linkSync(temporary, fileName); fs.unlinkSync(temporary); }
    const dir = fs.openSync(path.dirname(fileName), "r");
    try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function privateJSON(fileName, value, replace = false) {
  atomic(fileName, JSON.stringify(value, null, 2), { uid: 0, gid: 0, mode: 0o600 }, replace);
}
function bundleTestSummary(bundleRoot) {
  const args = ["--test", path.join(bundleRoot, "script/ai-gateway-production.test.cjs"),
    path.join(bundleRoot, "script/ai-gateway-preflight.test.cjs")];
  const result = cp.spawnSync("/usr/bin/node", args, { env: CLEAN, cwd: "/", encoding: "utf8",
    timeout: 60000, maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  // Only static findings and counts leave the captured TAP output.
  const output = typeof result.stdout === "string" ? result.stdout : "";
  const count = key => { const match = output.match(new RegExp("^# " + key + " (\\d+)$", "m")); return match ? +match[1] : null; };
  return {
    exitStatus: Number.isInteger(result.status) ? result.status : null,
    timedOut: result.error?.code === "ETIMEDOUT",
    tests: count("tests"), passed: count("pass"), failed: count("fail"), skipped: count("skipped"),
    missingLauncherFailureReproduced: /not ok \d+ - console launcher accepts only read-only modes/.test(output) &&
      /ai-gateway-preflight-console\.sh: No such file or directory/.test(output),
  };
}
function systemdInspection() {
  const result = cp.spawnSync("systemctl", ["show", "pm2-seman.service", "--no-pager",
    "--property=LoadState,ActiveState,UnitFileState,MainPID"], {
    env: CLEAN, cwd: "/", encoding: "utf8", timeout: 10000,
    maxBuffer: 16384, stdio: ["ignore", "pipe", "pipe"],
  });
  const fields = Object.fromEntries(String(result.stdout || "").split("\n").filter(line => line.includes("="))
    .map(line => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)]; }));
  const load = ["loaded", "not-found", "error", "masked"].includes(fields.LoadState) ? fields.LoadState : "unknown";
  const active = ["active", "inactive", "failed", "activating", "deactivating", "reloading"]
    .includes(fields.ActiveState) ? fields.ActiveState : "unknown";
  const unit = ["", "enabled", "disabled", "static", "masked", "not-found", "indirect"]
    .includes(fields.UnitFileState) ? fields.UnitFileState : "unknown";
  const pid = /^\d+$/.test(fields.MainPID || "") ? +fields.MainPID : null;
  return { loadState: load, activeState: active, unitFileState: unit, mainPID: pid,
    baselineNotRegistered: load === "not-found" && active === "inactive" && pid === 0 };
}
function proc(pid) {
  const raw = fs.readFileSync("/proc/" + pid + "/stat", "utf8");
  const fields = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
  return { pid, uid: fs.statSync("/proc/" + pid).uid, parent: +fields[1], start: fields[19],
    cwd: fs.realpathSync("/proc/" + pid + "/cwd"), exe: fs.realpathSync("/proc/" + pid + "/exe") };
}
function daemon() {
  ensure(file(C.home + "/pm2.pid").bytes.toString().trim() === String(C.daemon), "PM2_DAEMON_CHANGED");
  const p = proc(C.daemon);
  ensure(p.uid === C.uid && p.start === C.daemonStart &&
    fs.readFileSync("/proc/" + C.daemon + "/comm", "utf8").startsWith("PM2"), "PM2_DAEMON_CHANGED");
  const socket = fs.lstatSync(C.home + "/rpc.sock");
  ensure(socket.isSocket() && socket.uid === C.uid && socket.gid === C.gid &&
    !(socket.mode & 0o002), "PM2_RPC_SOCKET_UNSAFE");
  return p;
}
function initialEnvironment(pid) {
  return Object.fromEntries(fs.readFileSync("/proc/" + pid + "/environ", "utf8").split("\0")
    .filter(s => s.includes("=")).map(s => { const i = s.indexOf("="); return [s.slice(0, i), s.slice(i + 1)]; }));
}
function aclAbsent(paths) {
  const source = `import os,json,errno,sys
ok=True
for p in json.loads(sys.stdin.read()):
 for key in ('system.posix_acl_access','system.posix_acl_default'):
  try:
   os.getxattr(p,key,follow_symlinks=False)
   ok=False
  except OSError as e:
   if e.errno!=errno.ENODATA: ok=False
print('ACL_ABSENT' if ok else 'ACL_REVIEW_REQUIRED')
`;
  ensure(command("python3", ["-c", source], { input: JSON.stringify(paths) }).trim() === "ACL_ABSENT", "ACL_REVIEW_REQUIRED");
}
function disk() {
  noLinks(C.data);
  const m = JSON.parse(command("findmnt", ["-b", "-J", "-T", C.data, "-o", "SOURCE,TARGET,AVAIL,OPTIONS"])).filesystems[0];
  ensure(m.source === "/dev/sdb1" && m.target === C.data &&
    String(m.options).split(",").includes("rw") && +m.avail > 512 * 1024 * 1024, "BACKUP_DISK_UNSAFE");
}
function verifyPM2Merge(source) {
  const context = vm.createContext({ Utility: {} });
  for (const name of ["extend", "extendMix", "extendExtraConfig"]) {
    const match = source.match(new RegExp("\\b" + name + "\\s*:\\s*(function\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n  \\})\\s*,"));
    ensure(match, "PM2_MERGE_IMPLEMENTATION_UNSUPPORTED");
    vm.runInContext("Utility." + name + " = (" + match[1] + ")", context, { timeout: 1000 });
  }
  context.fixture = { pm2_env: { env: { OPENAI_API_KEY: "fixture", KEEP: "unchanged" }, node_args: [] } };
  for (const nodeArgs of [["--require", C.loader], "null"]) {
    context.options = { env: { current_conf: { node_args: nodeArgs, env: {} } } };
    vm.runInContext("Utility.extend(fixture.pm2_env.env, options.env); Utility.extendExtraConfig(fixture, options)",
      context, { timeout: 1000 });
    ensure(JSON.stringify(context.fixture.pm2_env.env) === '{"OPENAI_API_KEY":"fixture","KEEP":"unchanged"}',
      "PM2_MERGE_CHANGES_ENVIRONMENT");
    ensure(nodeArgs === "null" ? !Object.hasOwn(context.fixture.pm2_env, "node_args") :
      JSON.stringify(context.fixture.pm2_env.node_args) === JSON.stringify(nodeArgs), "PM2_NODE_ARGS_UNSUPPORTED");
  }
}
function discoverPM2() {
  const cli = command("runuser", ["-u", "seman", "--", "sh", "-c", "command -v pm2"],
    { env: { ...CLEAN, HOME: "/home/seman", PM2_HOME: C.home } }).trim();
  ensure(/^\/[A-Za-z0-9_./-]+$/.test(cli), "PM2_PATH_UNAVAILABLE");
  const real = fs.realpathSync(cli), directory = path.dirname(path.dirname(real));
  const pkg = JSON.parse(file(directory + "/package.json").bytes);
  ensure(pkg.name === "pm2" && /^[56]\.\d+\.\d+$/.test(pkg.version) && path.basename(real) === "pm2", "PM2_VERSION_UNSUPPORTED");
  const utility = file(directory + "/lib/Utility.js").bytes.toString();
  verifyPM2Merge(utility);
  const actions = file(directory + "/lib/God/ActionMethods.js").bytes.toString();
  ensure(actions.includes("God.restartProcessId") && actions.includes("Utility.extendExtraConfig(proc, opts)"),
    "PM2_RESTART_IMPLEMENTATION_UNSUPPORTED");
  return { directory, cli: real, version: pkg.version,
    fingerprint: hash(utility + actions + file(directory + "/lib/Client.js").bytes.toString()) };
}
// RPC-only connection: never call pm2.connect(), Client.start(), CLI, or daemon launch.
function rpcChild() {
  return String.raw`
const fs=require('node:fs');
const request=JSON.parse(fs.readFileSync(0,'utf8'));
const finish=(value)=>{process.stdout.write('\nGATEWAY_RPC_RESULT='+JSON.stringify(value)+'\n');process.exit(0)};
console.log=console.info=console.warn=console.error=()=>{};
const pm=require(request.directory);
pm.Client.start=()=>{throw Error('DAEMON_LAUNCH_FORBIDDEN')};
pm.connect=()=>{throw Error('DAEMON_LAUNCH_FORBIDDEN')};
const timer=setTimeout(()=>finish({ok:false}),18000);
pm.Client.launchRPC(error=>{
 if(error)return finish({ok:false});
 const method=request.action==='list'?'getMonitorData':'restartProcessId';
 if(!['list','restart'].includes(request.action))return finish({ok:false});
 const data=request.action==='list'?{}:{id:4,env:{current_conf:{node_args:request.nodeArgs,env:{}}}};
 pm.Client.client.call(method,data,(error,value)=>{clearTimeout(timer);finish(error?{ok:false}:{ok:true,value})});
});
`;
}
function rpc(pm2, action, nodeArgs) {
  daemon();
  ensure(["list", "restart"].includes(action), "RPC_ACTION_FORBIDDEN");
  const out = command("runuser", ["-u", "seman", "--", "/usr/bin/node", "-e", rpcChild()],
    { input: JSON.stringify({ directory: pm2.directory, action, nodeArgs }),
      env: { ...CLEAN, HOME: "/home/seman", USER: "seman", LOGNAME: "seman", PM2_HOME: C.home } });
  const lines = out.trim().split("\n").filter(s => s.startsWith("GATEWAY_RPC_RESULT="));
  ensure(lines.length === 1, "PM2_RPC_FAILED");
  const result = JSON.parse(lines[0].slice("GATEWAY_RPC_RESULT=".length));
  ensure(result.ok, "PM2_RPC_FAILED"); daemon();
  return result.value;
}
function application(rows, allowStopped = false) {
  ensure(Array.isArray(rows), "INVALID_PM2_LIST");
  const chosen = rows.filter(r => r.name === "indexus-crm" || r.pm2_env?.pm_exec_path === C.root + "/dist/index.cjs");
  ensure(chosen.length === 1, "INDEXUS_PM2_COUNT_CHANGED");
  const row = chosen[0], e = row.pm2_env;
  ensure(row.pm_id === C.appID && row.name === "indexus-crm" &&
    (e.status === "online" || (allowStopped && ["errored", "stopped", "launching", "stopping"].includes(e.status))) &&
    e.pm_cwd === C.root && e.pm_exec_path === C.root + "/dist/index.cjs" && e.exec_mode === "fork_mode", "INDEXUS_IDENTITY_CHANGED");
  if (e.status === "online") {
    const p = proc(row.pid);
    ensure(p.parent === C.daemon && p.uid === C.uid && p.cwd === C.root && p.exe === "/usr/bin/node", "INDEXUS_IDENTITY_CHANGED");
  }
  return row;
}
async function readAI(env) {
  ensure(env.DATABASE_URL, "DATABASE_CONFIGURATION_MISSING");
  const { Client } = require(C.root + "/node_modules/pg");
  const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 6000,
    query_timeout: 8000, application_name: "indexus-gateway-preparation",
    options: "-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=1000" });
  client.on("error", () => {});
  try {
    await client.connect(); await client.query("BEGIN READ ONLY");
    const rows = (await client.query("SELECT version,value,gateway_check FROM public.ai_router_configuration WHERE singleton=true")).rows;
    ensure(rows.length === 1, "AI_CONFIGURATION_MISSING");
    ensure((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only === "on", "DATABASE_NOT_READ_ONLY");
    return rows[0];
  } finally { await client.query("ROLLBACK").catch(() => {}); await client.end().catch(() => {}); }
}
function health() {
  for (const [route, expected] of [["/login", "200"], ["/api/configurator/ai", "401"]]) {
    ensure(command("curl", ["-q", "-sS", "--noproxy", "*", "--max-time", "5", "-o", "/dev/null",
      "-w", "%{http_code}", "http://127.0.0.1:5000" + route]).trim() === expected, "HTTP_HEALTH_FAILED");
  }
}
async function preflight() {
  ensure(os.hostname().toUpperCase() === "CORPCRM01" && process.getuid() === 0, "ROOT_ON_CORPCRM01_REQUIRED");
  ensure(+command("id", ["-u", "seman"]) === C.uid && +command("id", ["-g", "seman"]) === C.gid, "SERVICE_ACCOUNT_CHANGED");
  for (const directory of ["/etc", "/etc/systemd/system", "/etc/systemd/system/multi-user.target.wants", "/usr/bin"]) {
    noLinks(directory); const s = fs.statSync(directory);
    ensure(s.isDirectory() && s.uid === 0 && !(s.mode & 0o022), "SYSTEM_DIRECTORY_PERMISSIONS_UNSAFE");
  }
  const group = command("getent", ["group", String(C.gid)]).trim().split(":");
  ensure(group[0] === "seman" && group[3].split(",").every(n => !n || n === "seman"), "SERVICE_GROUP_MEMBERSHIP_CHANGED");
  const accounts = command("getent", ["passwd"]).trim().split("\n").map(s => s.split(":"));
  ensure(accounts.filter(p => +p[3] === C.gid).every(p => +p[2] === C.uid), "SERVICE_GROUP_MEMBERSHIP_CHANGED");
  daemon(); disk();
  const live = proc(C.initialPID);
  ensure(live.start === C.initialStart && live.parent === C.daemon && live.uid === C.uid && live.cwd === C.root &&
    live.exe === "/usr/bin/node", "INITIAL_INDEXUS_PROCESS_CHANGED");
  ensure(command("/usr/bin/node", ["--version"]).trim() === C.nodeVersion, "NODE_VERSION_CHANGED");
  const env = initialEnvironment(live.pid);
  ensure(env.NODE_ENV === "production" && env.OPENAI_API_KEY && env.DATABASE_URL &&
    !env.NODE_OPTIONS && !env.REPL_ID && !env.REPLIT_DEV_DOMAIN && !env.INDEXUS_AI_GATEWAY_TOKEN &&
    [undefined, "", "false"].includes(env.INDEXUS_AI_GATEWAY_ENABLED) &&
    [undefined, "routed"].includes(env.INDEXUS_AI_ROUTER_MODE), "INITIAL_ENVIRONMENT_REQUIRES_REVIEW");
  const dotenv = file(C.root + "/.env");
  ensure(dotenv.uid === C.uid && dotenv.mode === 0o600, "DOTENV_PERMISSIONS_CHANGED");
  const parsed = require(C.root + "/node_modules/dotenv").parse(dotenv.bytes);
  ensure(parsed.OPENAI_API_KEY === env.OPENAI_API_KEY && parsed.DATABASE_URL === env.DATABASE_URL, "DOTENV_DIFFERS_FROM_PROCESS");
  ensure(hash(file(C.root + "/dist/index.cjs").bytes) === C.backend, "BACKEND_CHANGED");
  const head = command("runuser", ["-u", "seman", "--", "git", "--no-optional-locks", "-C", C.root, "rev-parse", "HEAD"]).trim();
  ensure(head === C.head, "SOURCE_HEAD_CHANGED");
  const ecosystem = file(C.root + "/ecosystem.config.cjs");
  ensure(hash(ecosystem.bytes) === C.ecosystemHash && ecosystem.uid === C.uid &&
    ecosystem.gid === C.gid && ecosystem.mode === 0o664, "ECOSYSTEM_BASELINE_CHANGED");
  const dumpFile = file(C.home + "/dump.pm2");
  ensure(dumpFile.uid === C.uid && dumpFile.gid === C.gid && dumpFile.mode === 0o600, "PM2_DUMP_PERMISSIONS_CHANGED");
  const saved = JSON.parse(dumpFile.bytes);
  ensure(Array.isArray(saved) && saved.length === 1 && saved[0].name === "indexus-crm" &&
    saved[0].pm_exec_path === C.root + "/dist/index.cjs" && saved[0].pm_cwd === C.root &&
    !saved[0].node_args?.length, "PM2_SAVED_CONFIGURATION_CHANGED");
  const savedEnv = { ...saved[0], ...(saved[0].env || {}) };
  ensure(savedEnv.OPENAI_API_KEY === env.OPENAI_API_KEY && savedEnv.DATABASE_URL === env.DATABASE_URL &&
    !dumpFile.bytes.toString().includes("INDEXUS_AI_GATEWAY_TOKEN"), "PM2_SAVED_ENVIRONMENT_CHANGED");
  for (const name of [C.runtime, C.unit, C.link]) {
    noLinks(path.dirname(name)); ensure(!fs.lstatSync(name, { throwIfNoEntry: false }), "TARGET_ALREADY_EXISTS");
  }
  const parent = fs.statSync(path.dirname(C.token));
  noLinks(C.token);
  const t = fs.statSync(C.token);
  ensure(parent.uid === 0 && parent.gid === 0 && (parent.mode & 0o7777) === 0o700 &&
    t.isFile() && t.uid === 0 && t.gid === 0 && (t.mode & 0o7777) === 0o600 &&
    t.size > 0 && t.size < 16384, "TOKEN_METADATA_CHANGED");
  aclAbsent(["/etc", path.dirname(C.token), C.token, C.data, C.root + "/.env", C.home + "/dump.pm2"]);
  const catalog = file(C.root + "/server/lib/ai/service-catalog.ts").bytes.toString();
  ensure([...catalog.matchAll(/^\s*"([a-z0-9_.]+)":\s*"/gm)].length === 65, "AI_CATALOG_CHANGED");
  const ai = await readAI(env); assertRoutes(ai); health();
  const pm2 = discoverPM2();
  return { live, env, ai, pm2, dotenv, ecosystem, unit: renderUnit(pm2.cli) };
}
module.exports = { command, noLinks, file, atomic, privateJSON, bundleTestSummary, systemdInspection, proc, daemon, initialEnvironment,
  aclAbsent, disk, verifyPM2Merge, discoverPM2, rpcChild, rpc, application, readAI, health,
  preflight };
