"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const op = require("./promote-ai-services.cjs");
test("native backup uses explicit application identity, not root or ambient PG settings", () => {
  const env = op.nativeEnvironment("postgresql://unit:p%40ss@db.invalid:5444/fixture?sslmode=verify-full&options=-c%20lock_timeout%3D1000",
    { PGHOST: "wrong", PGDATABASE: "wrong", PGUSER: "root", PGPASSWORD: "wrong",
      NODE_OPTIONS: "--require=must-not-run", DATABASE_URL: "must-not-inherit", PATH: "/usr/bin" });
  assert.equal(env.PGHOST, "db.invalid"); assert.equal(env.PGPORT, "5444");
  assert.equal(env.PGUSER, "unit"); assert.equal(env.PGPASSWORD, "p@ss");
  assert.equal(env.PGDATABASE, "fixture"); assert.equal(env.PGSSLMODE, "verify-full");
  assert.equal(env.PGOPTIONS, "-c lock_timeout=1000 -c default_transaction_read_only=on");
  assert.equal(env.NODE_OPTIONS, undefined); assert.equal(env.DATABASE_URL, undefined);
});
test("ambiguous native identities and unsupported TLS/connection settings stop before backup", () => {
  for (const value of ["invalid", "mysql://a:b@host/db", "postgres://host/db",
    "postgres://a:b@host/", "postgres://a:b@host/db?sslmode=require&sslmode=disable",
    "postgres://a:b@host/db?unknown=1", "postgres://a:b@host/db#ignored"]) {
    assert.throws(() => op.nativeEnvironment(value), /database_/);
  }
});
test("deployment with worker off never disables an already-active internal service silently", () => {
  const value = { gateway: { enabled: true }, routes: {
    "email.monitoring": { provider: "internal", enabled: true },
    "email.summary": { provider: "openai", enabled: true },
  } };
  assert.throws(() => op.assertOfflineSafe(value, "routed"),
    e => e.safeCode === "active_internal_routes_require_worker_approval" &&
      e.serviceIds.length === 1 && e.serviceIds[0] === "email.monitoring");
  assert.doesNotThrow(() => op.assertOfflineSafe(value, "legacy"));
  value.routes["email.monitoring"].enabled = false;
  assert.doesNotThrow(() => op.assertOfflineSafe(value));
});
test("settings fingerprints are semantic and do not expose settings values", () => {
  assert.equal(op.settingsHash({ b: 2, a: { y: 1, x: 2 } }),
    op.settingsHash({ a: { x: 2, y: 1 }, b: 2 }));
  assert.notEqual(op.settingsHash({ provider: "openai" }), op.settingsHash({ provider: "internal" }));
});
function fake(failAt, rollbackFails) {
  const calls = [], ops = {};
  for (const method of ["preflight", "backup", "recheck", "source", "runtime", "restart", "verify", "success"])
    ops[method] = async () => { calls.push(method); if (failAt === method) throw Error("synthetic"); };
  ops.phase = async phase => calls.push("phase:" + phase);
  ops.rollback = async flags => {
    calls.push({ rollback: flags }); if (rollbackFails) throw Error("synthetic rollback conflict");
  };
  return { ops, calls };
}
test("approved sequence backs up before any source/runtime promotion and restarts only after promotion", async () => {
  const { ops, calls } = fake();
  await op.orchestrate(ops);
  assert.deepEqual(calls.filter(c => typeof c === "string" && !c.startsWith("phase:")),
    ["preflight", "backup", "recheck", "source", "runtime", "restart", "verify", "success"]);
});
for (const at of ["preflight", "backup", "recheck"]) {
  test("failure at " + at + " leaves production untouched", async () => {
    const { ops, calls } = fake(at);
    await assert.rejects(op.orchestrate(ops));
    assert(!calls.includes("source")); assert(!calls.includes("runtime")); assert(!calls.includes("restart"));
    assert(!calls.some(c => typeof c === "object"));
  });
}
for (const at of ["source", "runtime", "restart", "verify", "success"]) {
  test("failure at " + at + " enters bounded code/runtime rollback, never database restore", async () => {
    const { ops, calls } = fake(at);
    await assert.rejects(op.orchestrate(ops));
    assert.deepEqual(calls.find(c => typeof c === "object"), {
      rollback: { sourceAttempted: true, runtimeAttempted: at !== "source" },
    });
  });
}
test("an incomplete rollback is reported explicitly instead of claiming recovery", async () => {
  const { ops } = fake("verify", true);
  await assert.rejects(op.orchestrate(ops), e => e.rollbackFailed === true);
});
test("the exact prepared identity, path scope and built runtime hashes are pinned", () => {
  const fixture = () => ({
    manifest: { format: 2, productionBase: op.BASE, sourceCommit: op.TARGET, sourceTree: op.TREE,
      files: Array.from({ length: 70 }, (_, i) => ({ path: `server/test-${i}.ts`,
        baseSha256: null, sha256: "a".repeat(64) })) },
    prepared: { mode: "prepared_not_deployed",
      stageDirectory: "/var/www/indexus-crm/data/ai-services-stage-aBwcWg",
      sourceCommit: op.TARGET, productionBase: op.BASE,
      outputs: Object.fromEntries(Object.entries(op.BUILT).map(([k, v]) => [k, { sha256: v }])) },
  });
  const good = fixture(); op.validatePrepared(good.manifest, good.prepared);
  for (const mutate of [
    x => x.manifest.sourceCommit = op.BASE, x => x.prepared.stageDirectory = "/tmp/untrusted",
    x => x.manifest.files[0].path = "server/../private",
    x => x.manifest.files[1].path = x.manifest.files[0].path,
    x => x.prepared.outputs["dist/index.cjs"].sha256 = "b".repeat(64),
    x => x.manifest.files.length = 69,
  ]) {
    const value = fixture(); mutate(value);
    assert.throws(() => op.validatePrepared(value.manifest, value.prepared), /prepared_|release_/);
  }
});
test("standalone CLI refuses unpinned or worker-start execution without privileged activity", () => {
  for (const args of [[], ["--apply", "HEAD", "unused"], ["--start-worker", op.TARGET, "unused"]]) {
    const r = spawnSync(process.execPath, [require.resolve("./promote-ai-services.cjs"), ...args], { encoding: "utf8" });
    assert.equal(r.status, 2); assert.equal(r.stderr, "");
    assert.equal(JSON.parse(r.stdout).code, "use_apply_pinned_release_and_manifest");
  }
});
test("provider updates, dependency installs and DB restoration remain forbidden; worker start is separately gated", () => {
  const source = fs.readFileSync(require.resolve("./promote-ai-services.cjs"), "utf8");
  assert(!/run\(["'](?:npm|ssh|curl)["']/.test(source));
  assert(!/["'](?:--update-env|--hard|db:push)["']/.test(source));
  assert(!/asUser\(pm2,\s*\[["'](?:start|reload|stop)["']/.test(source));
  assert(source.includes('workerApproved: args[0] === "--apply-with-worker"'));
  assert(source.includes("if (!workerAttempted) return"));
  assert(!/(?:UPDATE|INSERT INTO)\s+ai_router_configuration/i.test(source));
  assert(source.includes('["--file=/dev/null", backup + "/database.dump"]'));
  assert(source.includes('["reset", "--keep", BASE]'));
  assert(!/pg_restore[^\n]*(?:--clean|--dbname)/.test(source));
  assert(source.includes("for await (const chunk of fs.createReadStream(file))"));
});
test("worker cutover is pinned to the observed active monitoring route, not arbitrary new services", () => {
  const settings = { gateway: { enabled: true }, routes: {
    "email.monitoring": { enabled: true, provider: "internal" },
  } };
  assert.doesNotThrow(() => op.assertWorkerCutover(settings, "routed"));
  settings.routes["task.checklist"] = { enabled: true, provider: "internal" };
  assert.throws(() => op.assertWorkerCutover(settings, "routed"), /approved_monitoring_route_changed/);
  delete settings.routes["task.checklist"];
  assert.throws(() => op.assertWorkerCutover(settings, "legacy"), /approved_monitoring_route_changed/);
});
test("one worker inherits existing configuration without inheriting PM2 process identity", () => {
  const env = op.workerEnvironment({ DATABASE_URL: "fixture-file", SESSION_SECRET: "synthetic",
    NODE_OPTIONS: "--require /existing/loader.cjs" },
  { DATABASE_URL: "fixture-live", pm_id: "4", NODE_APP_INSTANCE: "0", PM2_HOME: "/old",
    INDEXUS_AI_ROUTER_MODE: "routed" });
  assert.equal(env.DATABASE_URL, "fixture-live"); assert.equal(env.SESSION_SECRET, "synthetic");
  assert.equal(env.NODE_OPTIONS, "--require /existing/loader.cjs");
  assert.equal(env.AI_JOBS_GATEWAY_TIMEOUT_MS, "120000");
  assert.equal(env.pm_id, undefined); assert.equal(env.NODE_APP_INSTANCE, undefined);
  const spec = op.workerSpecification(env, "/usr/bin/node");
  assert.equal(spec.name, "indexus-ai-worker"); assert.equal(spec.instances, 1);
  assert.equal(spec.exec_mode, "fork"); assert.equal(spec.kill_timeout, 160000);
  assert.deepEqual(spec.args, ["--run"]);
  assert.deepEqual(spec.node_args, ["--require", "/etc/indexus-ai-runtime/preload.cjs"]);
  assert.equal(spec.env, env);
});
