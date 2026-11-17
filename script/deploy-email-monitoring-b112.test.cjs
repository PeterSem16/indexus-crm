"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const cp = require("node:child_process"), crypto = require("node:crypto");
const deploy = require("./deploy-email-monitoring-b112.cjs");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b112-deploy-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
test("release accepts exactly ten backend/shared paths, never extra source or manifests", () => {
  assert.equal(deploy.FILES.length, 10);
  deploy.releasePaths([...deploy.FILES].reverse());
  for (const file of ["server/index.ts", "package.json", "client/src/pages/email-client.tsx", ".env"]) {
    assert.throws(() => deploy.releasePaths([...deploy.FILES, file]), /UNREVIEWED_RELEASE_PATHS/);
  }
  assert.throws(() => deploy.releasePaths(deploy.FILES.slice(1)), /UNREVIEWED_RELEASE_PATHS/);
});
test("routing hold requires the observed version, disabled Gateway and no route overrides", () => {
  const base = { state: { version: 5, value: { gateway: { enabled: false }, routes: {} } }, auditCount: 10 };
  deploy.assertRouting(base);
  for (const state of [
    { ...base, auditCount: undefined },
    { ...base, state: { ...base.state, version: 6 } },
    { ...base, state: { ...base.state, value: { ...base.state.value, gateway: { enabled: true } } } },
    { ...base, state: { ...base.state, value: { ...base.state.value, routes: { "email.monitoring": { provider: "internal" } } } } },
  ]) assert.throws(() => deploy.assertRouting(state), /ROUTING_HOLD_CHANGED/);
});
test("PM2 environment fingerprint ignores process restarts but detects configuration changes", () => {
  const a = { pid: 1, pm2_env: { status: "online", restart_time: 1, env: { B: "2", A: "1" }, PORT: "5000" } };
  const b = { pid: 2, pm2_env: { status: "online", restart_time: 2, PORT: "5000", env: { A: "1", B: "2" } } };
  assert.equal(deploy.configHash(a), deploy.configHash(b));
  b.pm2_env.env.A = "different";
  assert.notEqual(deploy.configHash(a), deploy.configHash(b));
});
test("fingerprinting distinguishes absent files and refuses files or parents reached through symlinks", t => {
  const dir = temp(t), file = path.join(dir, "source");
  assert.deepEqual(deploy.fingerprint(file), { hash: "missing" });
  fs.writeFileSync(file, "source");
  assert.equal(deploy.fingerprint(file).hash, hash("source"));
  fs.symlinkSync(file, path.join(dir, "link"));
  assert.throws(() => deploy.fingerprint(path.join(dir, "link")), /SYMLINK_PATH_REFUSED/);
  fs.symlinkSync(dir, path.join(dir, "parent"));
  assert.throws(() => deploy.fingerprint(path.join(dir, "parent/source")), /SYMLINK_PATH_REFUSED/);
  assert.throws(() => deploy.fingerprint(dir), /REGULAR_FILE_REQUIRED/);
});
test("atomic backend replacement preserves ownership/mode and refuses changed source bytes", t => {
  const dir = temp(t), source = path.join(dir, "built"), live = path.join(dir, "live");
  fs.writeFileSync(source, "new"); fs.writeFileSync(live, "old", { mode: 0o640 });
  const profile = deploy.fingerprint(live);
  assert.throws(() => deploy.atomicCopy(source, live, hash("wrong"), profile), /COPY_SOURCE_CHANGED/);
  assert.equal(fs.readFileSync(live, "utf8"), "old");
  deploy.atomicCopy(source, live, hash("new"), profile);
  assert.deepEqual(deploy.fingerprint(live), { ...profile, hash: hash("new") });
  assert.deepEqual(fs.readdirSync(dir).sort(), ["built", "live"]);
});
test("successful promotion never invokes recovery", async () => {
  const events = [];
  await deploy.cutover(Object.fromEntries(["install", "restart", "verify", "restore", "restartOld", "verifyOld"]
    .map(name => [name, () => { events.push(name); }])));
  assert.deepEqual(events, ["install", "restart", "verify"]);
});
for (const failure of ["install", "restart", "verify"]) {
  test(`failed ${failure} restores code and restarts/verifies the original runtime`, async () => {
    const events = [];
    const actions = Object.fromEntries(["install", "restart", "verify", "restore", "restartOld", "verifyOld"]
      .map(name => [name, async () => { events.push(name); if (name === failure) throw Error("simulated"); }]));
    await assert.rejects(deploy.cutover(actions), /NEW_RUNTIME_FAILED_ORIGINAL_RESTORED/);
    assert.deepEqual(events.slice(-3), ["restore", "restartOld", "verifyOld"]);
  });
}
test("a concurrent-change recovery refusal does not restart over external changes", async () => {
  const events = [];
  await assert.rejects(deploy.cutover({
    install() { throw Error("simulated"); }, restart() {}, verify() {},
    restore() { events.push("guard"); throw Error("external change"); },
    restartOld() { events.push("restart"); }, verifyOld() {},
  }), /RECOVERY_REQUIRES_OPERATOR/);
  assert.deepEqual(events, ["guard"]);
});
test("exact standalone console entry refuses the wrong host without a deployment", () => {
  const result = cp.spawnSync(process.execPath, [path.join(__dirname, "deploy-email-monitoring-b112.cjs"),
    "--apply", deploy.TARGET, "--allow-restart"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /B112_DEPLOY_REFUSED_NO_OPERATION/);
  assert.equal(result.stdout, "");
});
test("script has no package install, frontend build, database restore or Gateway request command", () => {
  const source = fs.readFileSync(path.join(__dirname, "deploy-email-monitoring-b112.cjs"), "utf8");
  assert.doesNotMatch(source, /(?:npm|pnpm|yarn)["'],\s*\[["'](?:install|build)/);
  assert.doesNotMatch(source, /pg_restore|db:push|--update-env|fetch\(|git\(\[["'](?:pull|reset|clean)/);
  assert.match(source, /"--output=" \+ archive/);
  assert.match(source, /default_transaction_read_only=on/);
});
