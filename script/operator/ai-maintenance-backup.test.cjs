"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const op = require("./ai-maintenance-backup.cjs");
const fixture = () => ({
  mode: "prepared_not_deployed", productionBase: op.BASE, sourceCommit: op.TARGET, sourceTree: op.TREE,
  stageDirectory: op.STAGE, unchangedProcesses: [{ role: "api" }, { role: "worker" }],
  outputs: Object.fromEntries(Object.entries(op.BUILT).map(([key, sha256]) => [key, { bytes: 50, sha256 }])),
});
test("only the verified prepared build and source identity are accepted", () => {
  op.validatePrepared(fixture());
  for (const mutate of [
    x => x.productionBase = op.TARGET, x => x.sourceTree = "a".repeat(40),
    x => x.sourceCommit = op.BASE, x => x.stageDirectory = "/tmp/stage",
    x => x.outputs["dist/index.cjs"].sha256 = "a".repeat(64),
    x => x.outputs["dist/index.cjs"].bytes = 0, x => x.unchangedProcesses.pop(),
    x => x.outputs["extra.cjs"] = x.outputs["dist/index.cjs"],
  ]) {
    const value = fixture(); mutate(value);
    assert.throws(() => op.validatePrepared(value), /prepared_/);
  }
});
test("native backup uses explicit URL components and does not inherit root, PG or provider credentials", () => {
  const e = op.nativeEnvironment("postgresql://fixture:p%40ss@db.invalid:5444/fixture%20db?sslmode=verify-full&options=-c%20lock_timeout%3D1000",
    { PGHOST: "wrong", PGDATABASE: "wrong", PGUSER: "root", PGPASSWORD: "wrong",
      NODE_OPTIONS: "--require=untrusted", DATABASE_URL: "synthetic", INDEXUS_AI_GATEWAY_TOKEN: "synthetic",
      PATH: "/usr/bin", HOME: "/root" });
  assert.equal(e.PGHOST, "db.invalid"); assert.equal(e.PGPORT, "5444");
  assert.equal(e.PGUSER, "fixture"); assert.equal(e.PGDATABASE, "fixture db");
  assert.equal(e.PGPASSWORD, "p@ss"); assert.equal(e.PGSSLMODE, "verify-full");
  assert.equal(e.PGOPTIONS, "-c lock_timeout=1000 -c default_transaction_read_only=on");
  assert.equal(e.PATH, "/usr/bin"); assert.equal(e.HOME, "/root");
  for (const key of ["DATABASE_URL", "NODE_OPTIONS", "INDEXUS_AI_GATEWAY_TOKEN"])
    assert.equal(e[key], undefined);
});
test("unsupported, duplicate or incomplete database configurations fail closed", () => {
  for (const value of ["invalid", "mysql://a:b@host/db", "postgres://host/db",
    "postgres://a:b@host/", "postgres://a:b@host/db?sslmode=require&sslmode=disable",
    "postgres://a:b@host/db?unhandled=1", "postgres://a:b@host/db#ignored"]) {
    assert.throws(() => op.nativeEnvironment(value), /database_/);
  }
});
test("semantic fingerprints are independent of JSON property order", () => {
  assert.equal(op.fingerprint({ version: 1, value: { b: 2, a: 1 } }),
    op.fingerprint({ value: { a: 1, b: 2 }, version: 1 }));
  assert.notEqual(op.fingerprint({ version: 1 }), op.fingerprint({ version: 2 }));
});
function pm2Fixture() {
  return { pm_id: 7, pid: 111, name: "indexus-ai-worker", pm2_env: {
    status: "online", pm_cwd: "/var/www/indexus-crm", exec_mode: "fork_mode", instances: 1,
    pm_exec_path: "/var/www/indexus-crm/dist/ai-worker.cjs", exec_interpreter: "/usr/bin/node",
    node_args: ["--require", op.LOADER], args: ["--run"], kill_timeout: 160000,
  } };
}
test("PM2 inventory binds the existing worker identity and graceful stop budget", () => {
  const p = op.processDescription(pm2Fixture());
  assert.equal(p.role, "worker"); assert.equal(p.id, 7);
  assert.equal(p.killTimeoutMs, 160000); assert.equal(p.preloadConfigured, true);
  assert.equal(p.args, undefined); assert.equal(p.nodeArgs, undefined);
  for (const mutate of [
    x => x.name = "other", x => x.pm2_env.status = "stopped", x => x.pid = 0,
    x => x.pm2_env.pm_exec_path = "/other/ai-worker.cjs", x => x.pm2_env.pm_cwd = "/other",
    x => x.pm2_env.args = ["--check"], x => x.pm2_env.exec_mode = "cluster_mode",
  ]) {
    const value = pm2Fixture(); mutate(value);
    assert.throws(() => op.processDescription(value), /pm2_process_identity_invalid/);
  }
});
test("preload detection understands NODE_OPTIONS without printing it", () => {
  const value = pm2Fixture(); value.pm2_env.node_args = [];
  value.pm2_env.NODE_OPTIONS = `--require=${op.LOADER} --title=synthetic-private`;
  const p = op.processDescription(value);
  assert.equal(p.preloadConfigured, true);
  assert(!JSON.stringify(p).includes("synthetic-private"));
  value.pm2_env.NODE_OPTIONS = "";
  assert.equal(op.processDescription(value).preloadConfigured, false);
});
test("PM2 fingerprint preserves args and stop settings but not ephemeral PID or uptime", () => {
  const a = pm2Fixture(), b = pm2Fixture();
  b.pid = 222; b.pm2_env.pm_uptime = Date.now();
  assert.equal(op.processDescription(a).specificationSha256, op.processDescription(b).specificationSha256);
  b.pm2_env.kill_timeout = 1600;
  assert.notEqual(op.processDescription(a).specificationSha256, op.processDescription(b).specificationSha256);
});
test("private runtime copies compare contents independently of root-owned backup metadata", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maintenance-backup-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(dir + "/public"); fs.writeFileSync(dir + "/public/index.html", "old");
  const entries = op.inventory(dir);
  const differentOwners = entries.map(x => ({ ...x, uid: x.uid + 1, gid: x.gid + 1 }));
  assert.deepEqual(op.contentInventory(entries), op.contentInventory(differentOwners));
  assert.notDeepEqual(entries, differentOwners);
  fs.symlinkSync(dir + "/public/index.html", dir + "/link");
  assert.throws(() => op.inventory(dir), /runtime_symlink/);
});
test("backup completes only after its post-backup live-state verification", async () => {
  const calls = [], ops = {};
  for (const key of ["preflight", "backup", "verify", "success"]) ops[key] = async () => calls.push(key);
  await op.sequence(ops);
  assert.deepEqual(calls, ["preflight", "backup", "verify", "success"]);
});
for (const at of ["preflight", "backup", "verify"]) {
  test("failure at " + at + " never reports a validated backup", async () => {
    const calls = [], ops = {};
    for (const key of ["preflight", "backup", "verify", "success"])
      ops[key] = async () => { calls.push(key); if (key === at) throw Error("synthetic"); };
    await assert.rejects(op.sequence(ops));
    assert(!calls.includes("success"));
  });
}
test("the actual CommonJS stdin entrypoint rejects apply mode before privileged operations", () => {
  const code = `
const fs=require("node:fs"),Module=require("node:module");
const m=new Module("verified-backup.cjs",module);m.filename=process.cwd()+"/verified-backup.cjs";
m.paths=module.paths;m._compile(fs.readFileSync(process.argv[2],"utf8"),m.filename);
m.exports.main(["--apply"]).catch(e=>{console.log(e.safeCode);process.exitCode=2;});`;
  const p = spawnSync(process.execPath, ["-", require.resolve("./ai-maintenance-backup.cjs")],
    { input: code, encoding: "utf8" });
  assert.equal(p.status, 2); assert.equal(p.stdout.trim(), "usage_backup_only");
  assert.equal(p.stderr, "");
});
test("direct execution fails explicitly instead of silently skipping the backup", () => {
  const p = spawnSync(process.execPath, [require.resolve("./ai-maintenance-backup.cjs"), "--backup"],
    { encoding: "utf8" });
  assert.equal(p.status, 2); assert.equal(p.stdout, "");
  assert.equal(p.stderr.trim(), "use_verified_backup_bundle");
});
test("the backup tool cannot promote, restart services, mutate configuration or restore a database", () => {
  const source = fs.readFileSync(require.resolve("./ai-maintenance-backup.cjs"), "utf8");
  assert(!/(?:UPDATE|INSERT INTO|DELETE FROM|ALTER TABLE|CREATE TABLE)\s+ai_/i.test(source));
  assert(!/asUser\(pm2,\s*\[["'](?:start|restart|reload|delete|stop|save)["']/.test(source));
  assert(!/["'](?:--update-env|--hard|--dbname|--clean|db:push)["']/.test(source));
  assert(!/run\(["'](?:npm|ssh|curl)["']/.test(source));
  assert(source.includes('["--file=/dev/null", directory + "/database.dump"]'));
  assert(source.includes("native_database_identity_mismatch"));
});
