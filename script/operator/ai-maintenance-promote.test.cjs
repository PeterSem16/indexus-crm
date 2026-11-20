"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const op = require("./ai-maintenance-promote.cjs");
const backup = require("./ai-maintenance-backup.cjs");
const stage = require("./ai-maintenance-stage.cjs");
const steps = ["preflight", "acquire", "drain", "stop", "source", "publish", "restartApi",
  "schema", "restartWorker", "workerReady", "expose", "verify", "persist", "release", "success"];
function fake(at, rollbackFails = false) {
  const calls = [], ops = {};
  for (const step of steps) ops[step] = async () => { calls.push(step); if (at === step) throw Error("synthetic"); };
  ops.rollback = async flags => { calls.push({ rollback: flags }); if (rollbackFails) throw Error("conflict"); };
  return { calls, ops };
}
test("cutover drains and stops the old worker before changing code; exposes UI only after worker readiness", async () => {
  const { calls, ops } = fake(); await op.orchestrate(ops); assert.deepEqual(calls, steps);
});
for (const at of ["preflight", "acquire", "drain"]) {
  test("failure at " + at + " does not stop or roll back a running service", async () => {
    const { calls, ops } = fake(at); await assert.rejects(op.orchestrate(ops));
    assert(!calls.includes("stop")); assert(!calls.includes("publish"));
    assert(!calls.some(c => typeof c === "object"));
  });
}
for (const at of ["stop", "source", "publish", "restartApi", "schema", "restartWorker", "workerReady",
  "expose", "verify", "persist", "release"]) {
  test("failure at " + at + " attempts guarded code rollback before releasing claims", async () => {
    const { calls, ops } = fake(at);
    await assert.rejects(op.orchestrate(ops), e => e.rollbackVerified === true);
    const flags = calls.find(c => typeof c === "object").rollback;
    assert.equal(flags.stopAttempted, true); assert.equal(flags.released, false);
    assert.equal(flags.sourceAttempted, steps.indexOf(at) >= steps.indexOf("source"));
    assert.equal(flags.runtimeAttempted, steps.indexOf(at) >= steps.indexOf("publish"));
    assert.equal(flags.apiRestartAttempted, steps.indexOf(at) >= steps.indexOf("restartApi"));
    assert.equal(flags.workerRestartAttempted, steps.indexOf(at) >= steps.indexOf("restartWorker"));
  });
}
test("loss of the rollback safety conditions is reported as manual recovery, not hidden", async () => {
  const { ops } = fake("verify", true);
  await assert.rejects(op.orchestrate(ops), e => e.rollbackFailed && !e.rollbackVerified);
});
test("reporting failure after claims resume never blindly restarts a worker that may now be processing", async () => {
  const { calls, ops } = fake("success");
  await assert.rejects(op.orchestrate(ops), e => e.postRelease && !e.rollbackVerified);
  assert(!calls.some(c => typeof c === "object"));
});
test("PM2 settings retain argument and credential fingerprints while tolerating boolean serialization", () => {
  const p = { pm_id: 5, name: "indexus-ai-worker", pm2_env: { pm_exec_path: "/worker.cjs",
    args: ["--run"], node_args: ["--require", "/loader.cjs"], kill_timeout: 160000,
    autorestart: "true", watch: "false", env: { INDEXUS_AI_GATEWAY_TOKEN: "synthetic-private" } } };
  const a = op.spec(p, backup.fingerprint);
  p.pm2_env.autorestart = true; p.pm2_env.watch = false; p.pid = 999;
  assert.equal(op.spec(p, backup.fingerprint), a);
  p.pm2_env.env.INDEXUS_AI_GATEWAY_TOKEN = "other";
  assert.notEqual(op.spec(p, backup.fingerprint), a);
  assert(!a.includes("synthetic-private"));
});
function marker() {
  return { mode: "backup_validated_not_deployed", productionBase: op.BASE, sourceCommit: op.TARGET,
    sourceTree: stage.TREE, stageDirectory: backup.STAGE, backupDirectory: op.BACKUP,
    backupValidated: true, nativeDatabaseIdentityVerified: true,
    databaseDump: { archiveListed: true, archiveFullyDecoded: true, restoredIntoDatabase: false },
    maintenanceBefore: { exists: false }, workerGracefulStopBudgetSufficient: true, activeWorkersAtRecheck: 1,
    processes: [{ role: "api" }, { role: "worker" }],
    outputs: Object.fromEntries(Object.entries(backup.BUILT).map(([key, sha256]) => [key, { bytes: 1, sha256 }])) };
}
test("backup acceptance binds exact release and rejects incomplete or already-changed production", () => {
  op.assertBackup(marker(), stage, backup);
  for (const mutate of [
    m => m.databaseDump.archiveFullyDecoded = false, m => m.databaseDump.restoredIntoDatabase = true,
    m => m.backupDirectory = "/tmp/backup", m => m.sourceCommit = op.BASE,
    m => m.maintenanceBefore.exists = true, m => m.activeWorkersAtRecheck = 2,
    m => m.nativeDatabaseIdentityVerified = false, m => m.workerGracefulStopBudgetSufficient = false,
  ]) { const m = marker(); mutate(m); assert.throws(() => op.assertBackup(m, stage, backup)); }
});
test("direct invocation and unpinned apply cannot silently run", async () => {
  const p = spawnSync(process.execPath, [require.resolve("./ai-maintenance-promote.cjs")], { encoding: "utf8" });
  assert.equal(p.status, 2); assert.equal(p.stderr.trim(), "use_verified_promotion_bundle");
  for (const args of [[], ["--apply", "HEAD"], ["--apply", op.BASE], ["--apply", op.TARGET, "extra"]])
    await assert.rejects(op.main(args), e => e.safeCode === "use_apply_exact_feature_commit");
});
test("production code keeps worker/API configuration and never installs, restores DB, activates providers or deletes assets", () => {
  const s = fs.readFileSync(require.resolve("./ai-maintenance-promote.cjs"), "utf8");
  assert(!/["'](?:--update-env|--hard|--dbname|--clean|db:push)["']/.test(s));
  assert(!/(?:UPDATE|INSERT INTO|DELETE FROM|ALTER TABLE|CREATE TABLE)\s+ai_/i.test(s));
  assert(!/run\(["'](?:npm|ssh|curl|pg_restore)["']/.test(s));
  assert(!/asUser\(pm2,\s*\[["'](?:delete|start|reload)["']/.test(s));
  assert(!s.includes('rmSync(')); assert(!s.includes('SIGKILL'));
  assert(s.includes("pg_try_advisory_lock(517,1)"));
  assert(s.includes("pg_try_advisory_xact_lock(517,1)"));
  assert(s.includes('git", ["--no-optional-locks", "-c", "core.hooksPath=/dev/null"'));
});
