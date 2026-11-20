"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const { main, BASE, TARGET, TREE, FILES, buildEnvironment, validateScope, assertMount,
  regular, sha, processRole, applicationProcesses, assertProcessSnapshot } = require("./ai-maintenance-stage.cjs");

const APP = "/var/www/indexus-crm";
function nodeProcess(pid, role, uid = 1001, extra = {}) {
  return { pid, cwd: APP, executable: "/usr/bin/node", uids: [uid, uid, uid, uid],
    cmdline: role === "manager" ? `PM2 v6.0.13: God Daemon (/fixture/${uid}/.pm2)\0`
      : `/usr/bin/node\0${APP}/dist/${role === "api" ? "index" : "ai-worker"}.cjs\0`,
    startTime: String(pid * 100), ...extra };
}
function processFixture(processes) {
  const entries = new Map(processes.map(p => [String(p.pid), p]));
  const lookup = name => {
    const [, , id, file] = name.split("/");
    const p = entries.get(id);
    if (!p) throw Object.assign(Error("gone"), { code: "ENOENT" });
    if (p.error) throw Object.assign(Error("not accessible"), { code: p.error });
    return { p, file };
  };
  return { ownPid: 9999999, procFs: {
    readdirSync: () => [...entries.keys()],
    readlinkSync: name => { const { p, file } = lookup(name); return file === "cwd" ? p.cwd : p.executable; },
    readFileSync: name => {
      const { p, file } = lookup(name);
      if (file === "cmdline") return p.cmdline;
      if (file === "status") return p.status ?? `Name:\tnode\nUid:\t${p.uids.join("\t")}\n`;
      if (file === "stat") return p.stat ?? `${p.pid} (node (fixture)) ${["S", ...Array(18).fill("0"), p.startTime].join(" ")}\n`;
      throw Error("unexpected fixture read");
    },
  } };
}

test("observed root and non-root PM2 daemons do not impersonate the web or worker", () => {
  const fixture = processFixture([nodeProcess(22260, "manager", 0), nodeProcess(22545, "manager"),
    nodeProcess(1012922, "worker"), nodeProcess(1012949, "api")]);
  const actual = applicationProcesses(fixture);
  assert.deepEqual(actual.map(p => [p.pid, p.uid, p.role]),
    [[1012922, 1001, "worker"], [1012949, 1001, "api"]]);
  assert(!JSON.stringify(actual).includes("God Daemon"));
});

test("root web, root worker and ambiguous root Node remain forbidden", () => {
  for (const bad of [nodeProcess(12, "api", 0), nodeProcess(13, "worker", 0),
    nodeProcess(14, "api", 0, { cmdline: "/usr/bin/node\0unknown-script.cjs\0" })]) {
    assert.throws(() => applicationProcesses(processFixture([
      nodeProcess(10, "api"), nodeProcess(11, "worker"), bad,
    ])), /application_privacy_not_verified/);
  }
});

test("effective, saved and filesystem root or unparseable ownership fail closed", () => {
  for (const extra of [{ uids: [1001, 0, 1001, 1001] }, { uids: [1001, 1001, 0, 1001] },
    { uids: [1001, 1001, 1001, 0] }, { uids: [1001, 1002, 1001, 1001] }, { status: "Uid: unknown\n" }]) {
    assert.throws(() => applicationProcesses(processFixture([
      nodeProcess(10, "api", 1001, extra), nodeProcess(11, "worker"),
    ])), /application_privacy_not_verified/);
  }
});

test("manager exemption is exact and both application roles must actually exist", () => {
  assert.equal(processRole("PM2 v6.0.13: God Daemon (/root/.pm2)\0", APP), "pm2-daemon");
  for (const cmdline of ["node PM2 manager.cjs\0", "PM2 v6.0.13: God Daemon (/root/.pm2)\0extra\0",
    "/usr/bin/node\0PM2 v6.0.13: God Daemon (/root/.pm2)\0"]) {
    assert.notEqual(processRole(cmdline, APP), "pm2-daemon");
    assert.throws(() => applicationProcesses(processFixture([
      nodeProcess(10, "api"), nodeProcess(11, "worker"), nodeProcess(12, "manager", 0, { cmdline }),
    ])), /application_privacy_not_verified/);
  }
  for (const processes of [[nodeProcess(10, "manager", 0)], [nodeProcess(10, "api")],
    [nodeProcess(10, "worker")]]) {
    assert.throws(() => applicationProcesses(processFixture(processes)), /running_application_not_identified/);
  }
  assert.equal(processRole(`node ${APP}/dist/index.cjs\0`, APP), "api");
  assert.equal(processRole("node\0./dist/ai-worker.cjs\0--run\0", APP), "worker");
});

test("changed process birth, UID, role or PID is detected after the build", () => {
  const original = [nodeProcess(10, "api"), nodeProcess(11, "worker")];
  const before = applicationProcesses(processFixture(original));
  assert.doesNotThrow(() => assertProcessSnapshot(before, applicationProcesses(processFixture([
    nodeProcess(5, "manager", 0), ...original,
  ]))));
  for (const replacement of [nodeProcess(12, "api"), nodeProcess(10, "api", 1001, { startTime: "999" }),
    nodeProcess(10, "api", 1002)]) {
    assert.throws(() => assertProcessSnapshot(before, applicationProcesses(processFixture([
      replacement, original[1],
    ]))), /application_process_changed/);
  }
  assert.throws(() => applicationProcesses(processFixture([
    nodeProcess(10, "api", 1001, { cwd: "/another-release" }), original[1],
  ])), /application_cwd_changed/);
});

test("unreadable process ownership cannot silently remove a process from the inventory", () => {
  assert.throws(() => applicationProcesses(processFixture([
    nodeProcess(10, "api"), nodeProcess(11, "worker"), nodeProcess(12, "api", 0, { error: "EACCES" }),
  ])), /not accessible/);
  assert.throws(() => applicationProcesses(processFixture([
    nodeProcess(10, "api", 1001, { stat: "malformed" }), nodeProcess(11, "worker"),
  ])), /application_identity_not_verified/);
});

test("production release is an exact 18-file child of the operator-confirmed baseline", () => {
  const git = args => cp.execFileSync("git", args, { encoding: "utf8" }).trim();
  validateScope(git(["rev-parse", TARGET + "^"]), git(["rev-parse", TARGET + "^{tree}"]),
    git(["diff", "--name-only", BASE, TARGET]).split("\n"));
  assert.equal(FILES.length, 18);
  for (const [parent, tree, files] of [
    ["0".repeat(40), TREE, FILES], [BASE, "0".repeat(40), FILES],
    [BASE, TREE, FILES.slice(1)], [BASE, TREE, [...FILES, "server/routes.ts"]],
    [BASE, TREE, [...FILES, FILES[0]]],
  ]) assert.throws(() => validateScope(parent, tree, files), /scope_changed/);
});

test("no deployment, migration, test-inference or implicit preparation command exists", () => {
  for (const args of [[], ["--apply"], ["--deploy"], ["--prepare", "--restart"], ["--check"]])
    assert.throws(() => main(args), /usage_prepare_only/);
  const body = fs.readFileSync(require.resolve("./ai-maintenance-stage.cjs"), "utf8");
  assert(!/require\(["'](?:pg|pm2|openai)["']\)/.test(body));
  assert(!/run\(["'](?:pm2|systemctl|pg_dump|psql|npm|curl|wget)["']/.test(body));
  assert(!/git\(\[["'](?:reset|checkout|switch|merge|clean|fetch|pull)["']/.test(body));
});

test("build environment excludes credentials, inherited preloads and activation flags", () => {
  assert.deepEqual(buildEnvironment({
    PATH: "/usr/bin", HOME: "/root", LANG: "C", TZ: "UTC",
    DATABASE_URL: "forbidden", PGHOST: "forbidden", OPENAI_API_KEY: "forbidden",
    NODE_OPTIONS: "--require forbidden", NODE_PATH: "/forbidden",
    INDEXUS_AI_ROUTER_MODE: "routed", INDEXUS_AI_JOBS_ALLOW: "1", REPL_ID: "forbidden",
  }), { NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=3072",
    PATH: "/usr/bin", HOME: "/root", LANG: "C", TZ: "UTC" });
});

test("storage gate accepts only the designated data mount and physical device", () => {
  const target = "/var/www/indexus-crm/data";
  const canonical = x => x === "/dev/disk/by-label/data" ? "/dev/sdb1" : x;
  assert.doesNotThrow(() => assertMount([{ target, source: "/dev/sdb1" }], canonical));
  assert.doesNotThrow(() => assertMount([{ target, source: "/dev/disk/by-label/data" }], canonical));
  for (const mounts of [[], [{ target: "/", source: "/dev/sdb1" }],
    [{ target, source: "/dev/sda1" }], [{ target, source: "/dev/sdb1" }, { target, source: "/dev/sdb1" }]])
    assert.throws(() => assertMount(mounts, canonical), /approved_data_volume_required/);
});

test("source reads reject traversal, symlinks, directories and unreadable optional paths", () => {
  const parent = path.resolve("generated-artifacts/ai-maintenance-operator-tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "fixture-"));
  try {
    fs.writeFileSync(path.join(root, "source"), "verified\n");
    fs.mkdirSync(path.join(root, "directory"));
    fs.symlinkSync("source", path.join(root, "alias"));
    assert.equal(regular(root, "source").toString(), "verified\n");
    assert.equal(regular(root, "missing", true), null);
    assert.throws(() => regular(root, "missing"), /ENOENT/);
    assert.throws(() => regular(root, "directory", true), /source_not_regular/);
    assert.throws(() => regular(root, "alias", true), /source_symlink/);
    for (const p of ["../source", "/source", "directory/../source", "x\\source", ""])
      assert.throws(() => regular(root, p, true), /unsafe_path/);
  } finally { fs.rmSync(root, { recursive: true }); }
});

test("actual native CommonJS stdin wrapper verifies bytes before invoking the explicit entrypoint", () => {
  const source = fs.readFileSync(require.resolve("./ai-maintenance-stage.cjs"), "utf8");
  const wrapper = `
const fs=require("node:fs"),crypto=require("node:crypto"),Module=require("node:module");
const source=fs.readFileSync(0,"utf8");
if(crypto.createHash("sha256").update(source).digest("hex")!==process.argv[1])
  throw Error("operator_source_hash_mismatch");
const mod=new Module("verified-ai-maintenance-stage.cjs",module);
mod.filename="verified-ai-maintenance-stage.cjs";mod.paths=module.paths;
mod._compile(source,mod.filename);
try{mod.exports.main(["--unsupported"]);process.exitCode=2;}
catch(e){if(e.safeCode!=="usage_prepare_only")throw e;console.log("native_wrapper_guard_passed");}
`;
  const result = cp.spawnSync(process.execPath, ["--input-type=commonjs", "-e", wrapper, sha(source)],
    { input: source, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /native_wrapper_guard_passed/);
  const rejected = cp.spawnSync(process.execPath, ["--input-type=commonjs", "-e", wrapper, "0".repeat(64)],
    { input: source, encoding: "utf8" });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /operator_source_hash_mismatch/);
});
