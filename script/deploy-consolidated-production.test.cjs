const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { test } = require("node:test");
const deploy = require("./deploy-consolidated-production.cjs");
const { execFileSync } = require("node:child_process");

const COMMIT = "a".repeat(40);
const TREE = "b".repeat(40);
const BASE = "1060a63c3bc3f3613b81c6d5c16c78bb879d3275";
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "corpcrm-deploy-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function sha(data) { return crypto.createHash("sha256").update(data).digest("hex"); }
function manifest(dir, paths = ["server/routes.ts"]) {
  const file = path.join(dir, "reviewed.json");
  fs.writeFileSync(file, JSON.stringify({ base: BASE, commit: COMMIT, tree: TREE, paths }), { mode: 0o600 });
  return file;
}

test("default invocation is help-only and parses no mutation", async () => {
  const messages = [];
  assert.equal(await deploy.main([], { log: x => messages.push(x), testMode: true }), null);
  assert.match(messages[0], /No operation by default/);
});

test("operation selector rejects mixed deploy phases", () => {
  assert.throws(() => deploy.parseArgs(["--prepare", "--apply", "--commit", COMMIT, "--manifest", "m",
    "--maintenance-window", "--health-path", "/api/users"]), /exactly one/);
});

test("explicit operations require pinned release and operator maintenance acknowledgement", () => {
  assert.throws(() => deploy.parseArgs(["--apply", "--commit", COMMIT, "--manifest", "m", "--health-path", "/health"]), /maintenance-window/);
  assert.throws(() => deploy.parseArgs(["--apply", "--commit", COMMIT, "--manifest", "m", "--maintenance-window", "--health-path", "/api/auth/me"]), /health path/);
  assert.throws(() => deploy.parseArgs(["--prepare", "--commit", "bad", "--manifest", "m"]), /commit/);
  assert.equal(deploy.parseArgs(["--rollback", "--maintenance-window", "--health-path", "/api/users"]).rollback, true);
});

test("manifest must remain operator-private and non-symlinked", t => {
  const dir = fixture(t), file = manifest(dir);
  fs.chmodSync(file, 0o644);
  assert.throws(() => deploy.readManifest(file, COMMIT), /unsafe pinned manifest/);
});

test("manifest admits only a pinned, reviewed source path list", t => {
  const dir = fixture(t), file = manifest(dir, ["server/routes.ts", "docs/releases/indexus-consolidation.md"]);
  assert.deepEqual(deploy.readManifest(file, COMMIT).paths, ["docs/releases/indexus-consolidation.md", "server/routes.ts"]);
  const bad = manifest(dir, ["dist/index.cjs"]);
  assert.throws(() => deploy.readManifest(bad, COMMIT), /manifest/);
  const mismatch = manifest(dir);
  assert.throws(() => deploy.readManifest(mismatch, "c".repeat(40)), /manifest/);
});

test("PM2 direct secret environment outside e.env is hashed without exposure", () => {
  const a = { name: "indexus-crm", pm2_env: { env: { PORT: "5000" }, SESSION_SECRET: "first" } };
  const b = { name: "indexus-crm", pm2_env: { env: { PORT: "5000" }, SESSION_SECRET: "second" } };
  assert.notEqual(deploy.pmConfigHash(a), deploy.pmConfigHash(b));
  assert.match(deploy.pmConfigHash(a), /^[a-f0-9]{64}$/);
});

test("PM2 adapter must identify one online app at the exact cwd/script and runtime port", t => {
  const root = path.join(fixture(t), "app");
  const row = { name: "indexus-crm", pid: 77, pm2_env: {
    status: "online", pm_cwd: root, pm_exec_path: path.join(root, "dist/index.cjs"), env: { PORT: "4100", SESSION_SECRET: "one" },
  } };
  const runtime = deploy.pm2({ pm2List: () => [row] }, root);
  assert.equal(runtime.pid, 77); assert.equal(runtime.port, 4100); assert.match(runtime.configHash, /^[a-f0-9]{64}$/);
  assert.throws(() => deploy.pm2({ pm2List: () => [row, row] }, root), /mismatch/);
  assert.throws(() => deploy.pm2({ pm2List: () => [{ ...row, pm2_env: { ...row.pm2_env, status: "stopped" } }] }, root), /mismatch/);
  const noPort = { ...row, pm2_env: { ...row.pm2_env, env: {} } };
  assert.equal(deploy.pm2({ pm2List: () => [noPort] }, root).port, 5000);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, ".env"), "PORT=4400\n");
  assert.equal(deploy.pm2({ pm2List: () => [noPort], parseEnvFile: () => ({ PORT: "4400" }) }, root).port, 4400);
  const changed = { ...row, pm2_env: { ...row.pm2_env, env: { ...row.pm2_env.env, SESSION_SECRET: "two" } } };
  assert.notEqual(deploy.pm2({ pm2List: () => [row] }, root).configHash, deploy.pm2({ pm2List: () => [changed] }, root).configHash);
});

test("health gate rejects a lone frontend 200 without expected protected-API JSON 401", () => {
  assert.throws(() => deploy.checkHealth(5000, "/api/users", { health: () =>
    ({ status: 200, body: "<html>ok</html>", rootStatus: 200 }) }), /API unauthorized/);
});

test("health probe uses protected API 401 JSON plus frontend 200, not auth page or frontend alone", () => {
  assert.doesNotThrow(() => deploy.checkHealth(4100, "/api/users", { health: (port, route) => {
    assert.equal(port, 4100); assert.equal(route, "/api/users"); return { status: 401, body: { error: "Unauthorized" }, rootStatus: 200 };
  } }));
  for (const response of [
    { status: 401, body: { error: "Unauthorized" }, rootStatus: 503 },
    { status: 200, body: "<html>login</html>", rootStatus: 200 },
    { status: 401, body: {}, rootStatus: 200 },
  ]) assert.throws(() => deploy.checkHealth(4100, "/api/users", { health: () => response }), /API|frontend/);
  assert.throws(() => deploy.checkHealth(4100, "/api/auth/me", { health: () => ({ status: 401, body: { error: "Unauthorized" }, rootStatus: 200 }) }), /health check/);
});

test("staged route declaration rejects unrelated endpoint strings", t => {
  const root = fixture(t), server = path.join(root, "server");
  fs.mkdirSync(server);
  fs.writeFileSync(path.join(server, "routes.ts"), 'const note = "/api/users"; app.get("/api/other", handler);\n');
  assert.equal(deploy.healthDeclared(root, "/api/users"), false);
});

test("health route must be declared in actual staged server source", t => {
  const root = fixture(t), server = path.join(root, "server");
  fs.mkdirSync(server);
  fs.writeFileSync(path.join(server, "routes.ts"), 'app.get("/api/users", requireAuth, async (_req, res) => res.json([]));\n');
  assert.equal(deploy.healthDeclared(root, "/api/users"), true);
  assert.equal(deploy.healthDeclared(root, "/api/auth/me"), false);
});

test("release fetch is restricted to pinned main and rejects remote commit drift", t => {
  const root = fixture(t), calls = [];
  const deps = { command(name, args) {
    calls.push([name, args]);
    if (args[0] === "fetch") return { status: 0, stdout: "" };
    if (args[0] === "rev-parse" && args[1] === "origin/main") return { status: 0, stdout: `${"c".repeat(40)}\n` };
    return { status: 1, stdout: "" };
  } };
  assert.throws(() => deploy.validateRelease(root, { commit: COMMIT, tree: TREE, paths: ["server/routes.ts"] }, deps), /origin\/main/);
  assert.deepEqual(calls.map(x => x[1]), [["fetch", "origin", "main:refs/remotes/origin/main"], ["rev-parse", "origin/main"]]);
});

test("runtime/dependency release paths cannot pass reviewed source scope", t => {
  const dir = fixture(t), file = manifest(dir, ["private-task-attachments/new.dat"]);
  assert.throws(() => deploy.readManifest(file, COMMIT), /manifest/);
});

test("release validation verifies pinned origin, direct parent, ancestry, tree and exact paths via shell adapter", t => {
  const root = fixture(t), calls = [];
  const answers = {
    "rev-parse origin/main": COMMIT,
    [`rev-parse ${COMMIT}^{tree}`]: TREE,
    [`rev-list --parents -n 1 ${COMMIT}`]: `${COMMIT} ${BASE} ${"c".repeat(40)}`,
    [`diff --name-only -z ${BASE} ${COMMIT}`]: "server/routes.ts\0",
  };
  const deps = { command(name, args) {
    calls.push(args);
    if (name === "git" && args[0] === "fetch") return { status: 0, stdout: "" };
    if (name === "git" && args[0] === "merge-base") return { status: args[3] === COMMIT ? 0 : 1, stdout: "" };
    const key = args.join(" ");
    if (key in answers) return { status: 0, stdout: answers[key] };
    return { status: 1, stdout: "" };
  } };
  assert.doesNotThrow(() => deploy.validateRelease(root, { commit: COMMIT, tree: TREE, paths: ["server/routes.ts"] }, deps));
  assert(calls.some(args => args[0] === "merge-base"));
  const fail = { ...deps, command(name, args) {
    if (name === "git" && args[0] === "rev-list") return { status: 0, stdout: `${COMMIT} ${"c".repeat(40)}` };
    return deps.command(name, args);
  } };
  assert.throws(() => deploy.validateRelease(root, { commit: COMMIT, tree: TREE, paths: ["server/routes.ts"] }, fail), /pinned base/);
});

test("native Git adapter accepts real successful ancestry and rejects a non-ancestor", t => {
  const dir = fixture(t), origin = path.join(dir, "origin.git"), checkout = path.join(dir, "checkout");
  const repo = path.resolve(__dirname, "..");
  const git = (args, cwd = repo) => execFileSync("git", args, { cwd, encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_AUTHOR_NAME: "Deployment test",
      GIT_AUTHOR_EMAIL: "deployment@example.test", GIT_COMMITTER_NAME: "Deployment test",
      GIT_COMMITTER_EMAIL: "deployment@example.test" } }).trim();
  git(["clone", "--bare", "--shared", repo, origin]);
  const tree = git(["--git-dir", origin, "rev-parse", `${BASE}^{tree}`]);
  const commit = git(["--git-dir", origin, "commit-tree", tree, "-p", BASE, "-m", "Native adapter fixture"]);
  git(["--git-dir", origin, "update-ref", "refs/heads/main", commit]);
  git(["clone", "--no-checkout", "--branch", "main", origin, checkout]);
  assert.doesNotThrow(() => deploy.validateRelease(checkout, { commit, tree, paths: [] }, {}));
  const unrelated = git(["commit-tree", tree, "-m", "Unrelated fixture"], checkout);
  // Preserve the direct-parent check while replacing an ancestor only in this
  // isolated clone. A real merge-base exit 1 must still stop validation.
  git(["replace", BASE, unrelated], checkout);
  assert.throws(() => deploy.validateRelease(checkout, { commit, tree, paths: [] }, {}), /ancestry mismatch/);
});

test("backup verification streams hashes and rejects missing or altered manifest entries without DB commands", async t => {
  const dir = fixture(t), backupDir = path.join(dir, "backup");
  fs.mkdirSync(backupDir, { mode: 0o700 });
  const fp = "d0e1add5bcf9c38654376b342a543c42dce6924dde325e991a84723d7454aa9d";
  const entries = {
    "application.tar.gz": "synthetic archive",
    "source-fingerprint.json": JSON.stringify({ head: "b59f6e006cc2073cbb5ae909555c304cf0030903", aggregate: fp, rows: Array(93).fill({ path: "server/a.ts", sha256: "x" }) }),
    "pm2-jlist.json": "[]", "runtime-fingerprint.json": "{}",
  };
  for (const [name, value] of Object.entries(entries)) fs.writeFileSync(path.join(backupDir, name), value, { mode: 0o600 });
  fs.writeFileSync(path.join(backupDir, "SUCCESS"), "verified\n", { mode: 0o600 });
  const sums = Object.entries(entries).map(([name, value]) => `${sha(value)}  ${name}`).join("\n") + "\n";
  fs.writeFileSync(path.join(backupDir, "SHA256SUMS"), sums, { mode: 0o600 });
  const calls = [];
  const deps = { command(name, args) {
    calls.push(name);
    assert.equal(name, "tar");
    return { status: 0, stdout: "./\n./.git/\n./.git/HEAD\n./node_modules/\n./server/\n" };
  } };
  assert.equal((await deploy.verifyBackup(backupDir, deps)).count, 93);
  assert.deepEqual(calls, ["tar"]);
  fs.appendFileSync(path.join(backupDir, "application.tar.gz"), "tamper");
  await assert.rejects(deploy.verifyBackup(backupDir, deps), /checksum/);
});

async function deploymentFixture(t) {
  const base = fixture(t), root = path.join(base, "app"), home = path.join(base, "home"), backupDir = path.join(home, "indexus-backups", "synthetic");
  fs.mkdirSync(path.join(root, "dist/public/assets"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules/pkg"), { recursive: true });
  fs.mkdirSync(path.join(root, "server"), { recursive: true });
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "attached_assets"), { recursive: true });
  fs.mkdirSync(path.join(root, "runtime"), { recursive: true });
  fs.mkdirSync(path.join(root, "server/data"), { recursive: true });
  fs.mkdirSync(path.join(root, "server/uploads"), { recursive: true });
  fs.mkdirSync(path.join(root, "artifacts/design"), { recursive: true });
  fs.mkdirSync(path.join(root, "private-task-attachments"), { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(root, "dist/index.cjs"), "original bundle\n");
  fs.writeFileSync(path.join(root, "dist/public/index.html"), "old html\n");
  fs.writeFileSync(path.join(root, "dist/public/assets/old-hash.js"), "old lazy asset\n");
  fs.writeFileSync(path.join(root, "node_modules/pkg/index.js"), "original dependency\n");
  fs.writeFileSync(path.join(root, "server/routes.ts"), 'app.get("/api/users", requireAuth, (_req, res) => res.json([]));\n');
  fs.writeFileSync(path.join(root, ".git/HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(path.join(root, ".env"), "SESSION_SECRET=synthetic\nPORT=5010\n", { mode: 0o600 });
  fs.writeFileSync(path.join(root, "data/db-record.json"), "new database record\n");
  fs.writeFileSync(path.join(root, "attached_assets/upload.dat"), "preserve upload\n");
  fs.writeFileSync(path.join(root, "server/data/runtime.json"), "preserve runtime\n");
  fs.writeFileSync(path.join(root, "server/uploads/runtime.bin"), "preserve server upload\n");
  fs.writeFileSync(path.join(root, "artifacts/design/runtime.json"), "preserve design runtime\n");
  fs.writeFileSync(path.join(root, "private-task-attachments/new-task-file.bin"), "new task attachment\n");
  const target = path.join(base, "reviewed.json");
  fs.writeFileSync(target, JSON.stringify({ base: BASE, commit: COMMIT, tree: TREE, paths: ["server/routes.ts"] }), { mode: 0o600 });
  const rows = Array.from({ length: 93 }, (_, i) => ({ path: `server/legacy-${String(i).padStart(3, "0")}.ts`, sha256: "x" }));
  const fp = { aggregate: "d0e1add5bcf9c38654376b342a543c42dce6924dde325e991a84723d7454aa9d", rows };
  const state = { currentHead: "b59f6e006cc2073cbb5ae909555c304cf0030903", currentPid: 321, stopped: false,
    failPull: false, sourceChanged: false, calls: [], extract: "" };
  const pmRow = () => ({ name: "indexus-crm", pid: state.currentPid, pm2_env: {
    status: state.stopped ? "stopped" : "online", pm_cwd: root, pm_exec_path: path.join(root, "dist/index.cjs"),
    env: { PORT: "5010", SESSION_SECRET: "synthetic", DATABASE_URL: "postgres://fixture/test" },
  } });
  fs.mkdirSync(path.join(backupDir, "application.tar.gz").slice(0, -"/application.tar.gz".length), { recursive: true });
  const writeBackupFile = (name, data) => fs.writeFileSync(path.join(backupDir, name), data, { mode: 0o600 });
  const originalPm = pmRow();
  writeBackupFile("application.tar.gz", "synthetic tar");
  writeBackupFile("source-fingerprint.json", JSON.stringify({ head: "b59f6e006cc2073cbb5ae909555c304cf0030903", aggregate: fp.aggregate, rows }));
  writeBackupFile("pm2-jlist.json", JSON.stringify([originalPm]));
  writeBackupFile("runtime-fingerprint.json", JSON.stringify({ pid: state.currentPid, buildHash: "" }));
  writeBackupFile(".env.copy", fs.readFileSync(path.join(root, ".env")));
  const command = (name, args, opts = {}) => {
    state.calls.push([name, args, opts.cwd]);
    if (name === "bash" && args[2] === "indexus-tool-check") return { status: 0, stdout: "" };
    if (name === "tar" && args[0] === "-tzf") return { status: 0,
      stdout: "./\n./.git/\n./.git/HEAD\n./node_modules/\n./server/\n./server/routes.ts\n./private-task-attachments/\n./private-task-attachments/old-copy.bin\n" };
    if (name === "tar" && args[0] === "-xzf") {
      state.extract = args[args.indexOf("-C") + 1];
      const dest = state.extract;
      for (const d of ["dist/public/assets", "node_modules/pkg", "server", ".git", "private-task-attachments"])
        fs.mkdirSync(path.join(dest, d), { recursive: true });
      fs.writeFileSync(path.join(dest, ".git/HEAD"), "ref: refs/heads/main\n");
      fs.writeFileSync(path.join(dest, "server/routes.ts"), 'app.get("/api/users", requireAuth, (_req, res) => res.json([]));\n');
      fs.writeFileSync(path.join(dest, "dist/index.cjs"), "original bundle\n");
      fs.writeFileSync(path.join(dest, "dist/public/index.html"), "old html\n");
      fs.writeFileSync(path.join(dest, "dist/public/assets/old-hash.js"), "old lazy asset\n");
      fs.writeFileSync(path.join(dest, "node_modules/pkg/index.js"), "original dependency\n");
      fs.writeFileSync(path.join(dest, ".env"), "ARCHIVED_SECRET=older\n", { mode: 0o600 });
      fs.writeFileSync(path.join(dest, "private-task-attachments/old-copy.bin"), "old attachment snapshot\n");
      return { status: 0, stdout: "" };
    }
    if (name === "rsync") {
      assert(args.includes("--delete"));
      assert(!args.includes("--delete-excluded"));
      for (const excluded of ["/mobile-app", "/artifacts", "/design", "/private-task-attachments", "/data", "/uploads",
        "/attached_assets", "/runtime", "/server/data", "/server/uploads", "/.env", "/.env.*"])
        assert(args.some(arg => arg === `--exclude=${excluded}`), `missing protective rsync exclusion ${excluded}`);
      assert(args.includes("--exclude=private-task-attachments"), "nested private storage must also be protected");
      assert(args.includes("--exclude=private-clinic-agreements"), "nested private agreements must also be protected");
      restoreExceptRuntime(state.extract, root);
      state.currentHead = "b59f6e006cc2073cbb5ae909555c304cf0030903";
      return { status: 0, stdout: "" };
    }
    if (name !== "git") throw new Error(`unexpected command ${name}`);
    if (args[0] === "fetch") return { status: 0, stdout: "" };
    if (args[0] === "pull") {
      if (state.failPull) return { status: 1, stdout: "" };
      state.currentHead = COMMIT; return { status: 0, stdout: "" };
    }
    if (args[0] === "stash") return { status: 0, stdout: "" };
    if (args[0] === "symbolic-ref") return { status: 0, stdout: "main\n" };
    if (args[0] === "merge-base") return { status: 0, stdout: "" };
    if (args[0] === "rev-parse") {
      if (args[1] === "HEAD") return { status: 0, stdout: `${opts.cwd === state.extract ? "b59f6e006cc2073cbb5ae909555c304cf0030903" : state.currentHead}\n` };
      if (args[1] === "origin/main") return { status: 0, stdout: `${COMMIT}\n` };
      if (args[1] === `${COMMIT}^{tree}`) return { status: 0, stdout: `${TREE}\n` };
      if (args[1] === "refs/stash") return { status: 0, stdout: `${"d".repeat(40)}\n` };
    }
    if (args[0] === "rev-list") return { status: 0, stdout: `${COMMIT} ${BASE} b59f6e006cc2073cbb5ae909555c304cf0030903\n` };
    if (args[0] === "diff") return { status: 0, stdout: `server/routes.ts\0` };
    if (args[0] === "ls-files") return { status: 0, stdout: "" };
    throw new Error(`unexpected git ${args.join(" ")}`);
  };
  const deps = {
    testMode: true, root, home, command,
    fingerprint: dir => dir === state.extract ? fp : state.sourceChanged && dir === root
      ? { aggregate: "e".repeat(64), rows } : fp,
    pm2List: () => [pmRow()],
    pm2Restart: () => { state.stopped = false; state.currentPid++; },
    pm2Stop: () => { state.stopped = true; },
    health: () => ({ status: 401, body: { error: "Unauthorized" }, rootStatus: 200 }),
    extractArchive: (_commit, stage) => {
      fs.mkdirSync(path.join(stage, "server"), { recursive: true });
      fs.mkdirSync(path.join(stage, "dist/public/assets"), { recursive: true });
      fs.writeFileSync(path.join(stage, "server/routes.ts"), 'app.get("/api/users", requireAuth, (_req, res) => res.json([]));\n');
      fs.writeFileSync(path.join(stage, "dist/index.cjs"), "staged bundle\n");
      fs.writeFileSync(path.join(stage, "dist/public/index.html"), '<script src="/assets/new.js"></script>\n');
      fs.writeFileSync(path.join(stage, "dist/public/assets/new.js"), "new lazy asset\n");
    },
    build: (_stage, env) => { assert.deepEqual(Object.keys(env).sort(), ["HOME", "NODE_ENV", "PATH"]); return "synthetic build output"; },
  };
  const buildHash = await deploy.distFingerprint(root);
  writeBackupFile("runtime-fingerprint.json", JSON.stringify({ pid: state.currentPid, buildHash }));
  const files = ["application.tar.gz", "source-fingerprint.json", "pm2-jlist.json", "runtime-fingerprint.json", ".env.copy"];
  writeBackupFile("SHA256SUMS", files.map(name => `${sha(fs.readFileSync(path.join(backupDir, name)))}  ${name}`).join("\n") + "\n");
  writeBackupFile("SUCCESS", "verified\n");
  return { root, home, backupDir, manifest: target, state, deps, commit: COMMIT };
}
function restoreExceptRuntime(from, to) {
  const preserve = (base, rel) => rel === ".env" || /^\.env\./.test(rel)
    || ["data", "uploads", "attached_assets", "runtime", "server/data", "server/uploads",
      "artifacts", "design", "private-task-attachments", "private-clinic-agreements", "mobile-app"].includes(rel);
  const remove = (dir, rel = "") => {
    for (const name of fs.readdirSync(dir)) {
      const next = rel ? `${rel}/${name}` : name, full = path.join(dir, name);
      if (preserve(dir, next)) continue;
      if (fs.lstatSync(full).isDirectory()) remove(full, next);
      else fs.rmSync(full, { force: true });
      if (fs.existsSync(full) && fs.lstatSync(full).isDirectory() && !fs.readdirSync(full).length) fs.rmdirSync(full);
    }
  };
  remove(to);
  const copy = (src, rel = "") => {
    for (const name of fs.readdirSync(src)) {
      const next = rel ? `${rel}/${name}` : name;
      if (preserve(src, next)) continue;
      const a = path.join(src, name), b = path.join(to, next);
      if (fs.lstatSync(a).isDirectory()) { fs.mkdirSync(b, { recursive: true }); copy(a, next); }
      else { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); }
    }
  };
  copy(from);
}

test("missing rsync blocks preparation and rollback before any process stop or extraction", async t => {
  const f = await deploymentFixture(t), original = f.deps.command;
  const deps = { ...f.deps, command(name, args, opts) {
    if (name === "bash" && args[2] === "indexus-tool-check" && args[3] === "rsync")
      return { status: 1, stdout: "" };
    return original(name, args, opts);
  } };
  await assert.rejects(deploy.prepare({ commit: f.commit, manifest: f.manifest,
    backup: f.backupDir, health_path: "/api/users" }, deps), /unavailable: rsync/);
  await assert.rejects(deploy.rollbackInternal({}, f.root, deps), /unavailable: rsync/);
  assert.equal(f.state.stopped, false);
  assert.equal(f.state.extract, "");
});

test("restart health waits for readiness without weakening root/API response checks", () => {
  let clock = 0, attempts = 0;
  const deps = { healthClock: () => clock, healthWait: ms => { clock += ms; },
    healthTimeoutMs: 100, healthRetryMs: 10, health: () => ++attempts < 3
      ? { status: 503, body: { error: "Starting" }, rootStatus: 200 }
      : { status: 401, body: { error: "Unauthorized" }, rootStatus: 200 } };
  assert.doesNotThrow(() => deploy.waitForHealthAfterRestart(5010, "/api/users", deps));
  assert.equal(attempts, 3);
  clock = 0;
  assert.throws(() => deploy.waitForHealthAfterRestart(5010, "/api/users", {
    ...deps, health: () => ({ status: 200, body: {}, rootStatus: 200 }),
  }), /did not become ready/);
});

test("native curl restart health tolerates a real delayed HTTP service", async t => {
  const { spawn } = require("node:child_process");
  const child = spawn(process.execPath, ["-e", `
    const http = require("node:http"); let ready = false;
    const server = http.createServer((req, res) => {
      if (req.url === "/") { res.end("ok"); return; }
      res.writeHead(ready ? 401 : 503, {"content-type":"application/json"});
      res.end(JSON.stringify({error:ready ? "Unauthorized" : "Starting"}));
    });
    server.listen(0, "127.0.0.1", () => {
      console.log(server.address().port);
      setTimeout(() => { ready = true; }, 250);
    });
  `], { stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => child.kill());
  const port = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.stdout.once("data", data => resolve(Number(data.toString().trim())));
  });
  assert.doesNotThrow(() => deploy.waitForHealthAfterRestart(port, "/api/users", {
    healthTimeoutMs: 3000, healthRetryMs: 30,
  }));
});

test("synthetic prepare is build-first and does not mutate live source, dist, PM2, runtime, or database", async t => {
  const f = await deploymentFixture(t);
  const before = ["server/routes.ts", "dist/index.cjs", "dist/public/index.html", "node_modules/pkg/index.js"].map(p => fs.readFileSync(path.join(f.root, p), "utf8"));
  const result = await deploy.prepare({ commit: f.commit, manifest: f.manifest, backup: f.backupDir, health_path: "/api/users" }, f.deps);
  assert.equal(result.prepared, true);
  assert.deepEqual(["server/routes.ts", "dist/index.cjs", "dist/public/index.html", "node_modules/pkg/index.js"].map(p => fs.readFileSync(path.join(f.root, p), "utf8")), before);
  assert.equal(fs.readFileSync(path.join(f.root, "data/db-record.json"), "utf8"), "new database record\n");
  assert.equal(fs.statSync(path.join(result.runDir, "PREPARED.json")).mode & 0o777, 0o600);
  assert.equal(f.state.calls.some(([name]) => name === "pm2" || name === "rsync"), false);
  assert.equal(f.state.calls.some(([name, args]) => name === "git" && (args[0] === "pull" || args.includes("reset") || args.includes("clean"))), false);
});

test("prepared artifact mutation fails closed before pull or PM2 action", async t => {
  const f = await deploymentFixture(t);
  const result = await deploy.prepare({ commit: f.commit, manifest: f.manifest, backup: f.backupDir }, f.deps);
  fs.writeFileSync(path.join(result.runDir, "stage/dist/index.cjs"), "tampered build\n");
  await assert.rejects(deploy.apply({ commit: f.commit, manifest: f.manifest, maintenance: true, health_path: "/api/users" }, f.deps), /prepared build changed/);
  assert.equal(f.state.currentHead, "b59f6e006cc2073cbb5ae909555c304cf0030903");
  assert.equal(f.state.calls.some(([name, args]) => name === "git" && args[0] === "pull"), false);
  assert.equal(f.state.stopped, false);
});

test("synthetic apply and rollback retain old lazy assets, runtime records, active env, uploads and dependencies", async t => {
  const f = await deploymentFixture(t);
  const result = await deploy.prepare({ commit: f.commit, manifest: f.manifest, backup: f.backupDir }, f.deps);
  const applied = await deploy.apply({ commit: f.commit, manifest: f.manifest, maintenance: true, health_path: "/api/users" }, f.deps);
  assert.equal(applied.applied, true);
  assert.equal(f.state.currentHead, COMMIT);
  assert.equal(fs.existsSync(path.join(f.root, "dist/public/assets/old-hash.js")), true);
  assert.equal(fs.readFileSync(path.join(f.root, "dist/index.cjs"), "utf8"), "staged bundle\n");
  assert.equal(f.state.stopped, false);
  fs.writeFileSync(path.join(f.root, ".env"), "ACTIVE_ENV=preserve\n", { mode: 0o600 });
  const rolled = await deploy.rollback({ maintenance: true, health_path: "/api/users" }, f.deps);
  assert.equal(rolled.rolledBack, true);
  assert.equal(f.state.currentHead, "b59f6e006cc2073cbb5ae909555c304cf0030903");
  assert.equal(fs.readFileSync(path.join(f.root, "server/routes.ts"), "utf8").includes("/api/users"), true);
  assert.equal(fs.readFileSync(path.join(f.root, "dist/index.cjs"), "utf8"), "original bundle\n");
  assert.equal(fs.readFileSync(path.join(f.root, "node_modules/pkg/index.js"), "utf8"), "original dependency\n");
  assert.equal(fs.readFileSync(path.join(f.root, ".env"), "utf8"), "ACTIVE_ENV=preserve\n");
  assert.equal(fs.readFileSync(path.join(f.root, "data/db-record.json"), "utf8"), "new database record\n");
  assert.equal(fs.readFileSync(path.join(f.root, "attached_assets/upload.dat"), "utf8"), "preserve upload\n");
  assert.equal(fs.readFileSync(path.join(f.root, "server/data/runtime.json"), "utf8"), "preserve runtime\n");
  assert.equal(fs.readFileSync(path.join(f.root, "server/uploads/runtime.bin"), "utf8"), "preserve server upload\n");
  assert.equal(fs.readFileSync(path.join(f.root, "artifacts/design/runtime.json"), "utf8"), "preserve design runtime\n");
  assert.equal(fs.readFileSync(path.join(f.root, "private-task-attachments/new-task-file.bin"), "utf8"), "new task attachment\n");
  assert.equal(fs.existsSync(path.join(result.runDir, "PREPARED.json")), true);
});

test("source or configuration drift after prepare blocks pull and restart", async t => {
  for (const kind of ["source", "config", "backup"]) {
    const f = await deploymentFixture(t);
    await deploy.prepare({ commit: f.commit, manifest: f.manifest, backup: f.backupDir }, f.deps);
    if (kind === "source") f.state.sourceChanged = true;
    else fs.appendFileSync(path.join(f.root, ".env"), "CHANGED=1\n");
    if (kind === "backup") fs.appendFileSync(path.join(f.backupDir, "application.tar.gz"), "tampered\n");
    await assert.rejects(deploy.apply({ commit: f.commit, manifest: f.manifest, maintenance: true, health_path: "/api/users" }, f.deps));
    assert.equal(f.state.calls.some(([name, args]) => name === "git" && args[0] === "pull"), false);
    assert.equal(f.state.stopped, false);
  }
});

test("partial pull failure automatically restores app while retaining live runtime data", async t => {
  const f = await deploymentFixture(t);
  await deploy.prepare({ commit: f.commit, manifest: f.manifest, backup: f.backupDir }, f.deps);
  f.state.failPull = true;
  await assert.rejects(deploy.apply({ commit: f.commit, manifest: f.manifest, maintenance: true, health_path: "/api/users" }, f.deps), /rollback completed/);
  assert.equal(f.state.currentHead, "b59f6e006cc2073cbb5ae909555c304cf0030903");
  assert.equal(f.state.stopped, false);
  assert.equal(fs.readFileSync(path.join(f.root, "data/db-record.json"), "utf8"), "new database record\n");
  assert.equal(fs.readFileSync(path.join(f.root, ".env"), "utf8"), "SESSION_SECRET=synthetic\nPORT=5010\n");
  assert.equal(fs.readFileSync(path.join(f.root, "dist/index.cjs"), "utf8"), "original bundle\n");
  const privateRoot = path.join(f.home, ".indexus-consolidated-deploy");
  assert(fs.readdirSync(privateRoot).some(name => name.startsWith("rollback-")));
});

test("reviewed follow-up parent is pinned independently of the full-scope base", t => {
  const dir = fixture(t), file = manifest(dir), parent = "c".repeat(40);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ ...data, parent }));
  const pinned = deploy.readManifest(file, COMMIT);
  assert.equal(pinned.parent, parent);
  const command = (_name, args) => {
    if (args[0] === "fetch" || args[0] === "merge-base") return { status: 0, stdout: "" };
    if (args[0] === "rev-list") return { status: 0, stdout: `${COMMIT} ${parent}\n` };
    if (args[0] === "diff") return { status: 0, stdout: "server/routes.ts\0" };
    return { status: 0, stdout: args[1] === "origin/main" ? COMMIT : TREE };
  };
  assert.doesNotThrow(() => deploy.validateRelease(dir, pinned, { command }));
  assert.throws(() => deploy.validateRelease(dir, { ...pinned, parent: "d".repeat(40) }, { command }), /reviewed parent/);
  fs.writeFileSync(file, JSON.stringify({ ...data, parent: "not-a-commit" }));
  assert.throws(() => deploy.readManifest(file, COMMIT), /manifest/);
});

test("restart waits for PM2 online even after HTTP is ready and preserves native timeout cause", () => {
  let now = 0, checks = 0;
  const deps = { health: () => ({ status: 401, body: { error: "Unauthorized" }, rootStatus: 200 }),
    healthClock: () => now, healthWait: ms => { now += ms; }, healthTimeoutMs: 2000 };
  deploy.waitForHealthAfterRestart(5000, "/api/users", deps, () => {
    if (++checks < 2) throw new Error("PM2 launching");
  });
  assert.equal(checks, 2);
  const failed = { ...deps, health: undefined, healthTimeoutMs: 0,
    command: () => ({ status: 7, stdout: "", stderr: "fixture connection refused" }) };
  assert.throws(() => deploy.waitForHealthAfterRestart(5000, "/api/users", failed),
    e => e.nativeTool === "curl" && e.nativeStatus === 7 && e.nativeStderr === "fixture connection refused");
});

test("rollback uses native rsync without touching independent mobile client or nested current documents", async t => {
  const f = await deploymentFixture(t);
  await deploy.prepare({ commit: f.commit, manifest: f.manifest, backup: f.backupDir }, f.deps);
  for (const rel of ["mobile-app/node_modules/lightningcss-linux-x64-musl", "custom/private-task-attachments",
    "private-clinic-agreements", "custom/private-clinic-agreements"]) {
    fs.mkdirSync(path.join(f.root, rel), { recursive: true });
    fs.writeFileSync(path.join(f.root, rel, "current.dat"), "current protected content");
  }
  const command = f.deps.command;
  f.deps.command = (name, args, opts) => {
    if (name !== "rsync") return command(name, args, opts);
    execFileSync("rsync", args, { cwd: opts.cwd, stdio: "pipe" });
    f.state.currentHead = "b59f6e006cc2073cbb5ae909555c304cf0030903";
    return { status: 0, stdout: "", stderr: "" };
  };
  await deploy.rollback({ maintenance: true, health_path: "/api/users" }, f.deps);
  for (const rel of ["mobile-app/node_modules/lightningcss-linux-x64-musl", "custom/private-task-attachments",
    "private-clinic-agreements", "custom/private-clinic-agreements"])
    assert.equal(fs.readFileSync(path.join(f.root, rel, "current.dat"), "utf8"), "current protected content");
  assert.equal(f.state.stopped, false);
  const extraction = f.state.calls.find(([name, args]) => name === "tar" && args[0] === "-xzf")[1];
  assert(extraction.includes("--exclude=./mobile-app") && extraction.includes("--exclude=private-task-attachments")
    && extraction.includes("--exclude=private-clinic-agreements"));
});

test("native failure details stay bounded and private while successful rollback retains diagnostics", async t => {
  const f = await deploymentFixture(t);
  const prepared = await deploy.prepare({ commit: f.commit, manifest: f.manifest, backup: f.backupDir }, f.deps);
  const command = f.deps.command;
  f.deps.command = (name, args, opts) => name === "git" && args[0] === "pull"
    ? { status: 23, stdout: "never store sensitive stdout", stderr: "x".repeat(9000) + "fixture failure tail" }
    : command(name, args, opts);
  await assert.rejects(deploy.apply({ commit: f.commit, manifest: f.manifest, maintenance: true, health_path: "/api/users" }, f.deps),
    e => /rollback completed/.test(e.message) && e.privateFailureLog === path.join(prepared.runDir, "ERROR_DEPLOY.json"));
  const file = path.join(prepared.runDir, "ERROR_DEPLOY.json");
  const detail = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(detail.phase, "pull_release"); assert.equal(detail.tool, "git"); assert.equal(detail.status, 23);
  assert.equal(detail.stderr.length, 8192); assert(detail.stderr.endsWith("fixture failure tail"));
  assert(!fs.readFileSync(file, "utf8").includes("sensitive stdout"));
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(f.state.stopped, false);
});