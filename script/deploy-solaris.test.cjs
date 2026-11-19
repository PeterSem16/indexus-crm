"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const deploy = require("./deploy-solaris.cjs");
function initial() {
  return { version: 11, value: { gateway: { enabled: true,
    baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000, maxRetries: 0,
    temperature: null, maxTokens: null }, routes: {
    ...Object.fromEntries(deploy.SERVICES.map(service =>
      [service, { provider: "internal", enabled: true, model: deploy.LEGACY }])),
    "email.monitoring": { provider: "internal", enabled: true, model: "indexus-email-monitoring:v1" },
  } }, gateway_check: null, openai_check: null, updated_at: "synthetic" };
}
function smoke() {
  return { kind: "smoke", state: "ready", settingsVersion: 11, checkedAt: new Date().toISOString(),
    textVerified: true, jsonVerified: true,
    models: [{ id: deploy.SOLARIS, outputFormats: ["text", "json_object"] }] };
}
test("release is pinned to the observed production base and an exact source whitelist", () => {
  assert.equal(deploy.BASE, "35f585483d119e2f9a7a77e2aa13c22655a2b1d8");
  deploy.releasePaths([...deploy.FILES].reverse());
  for (const extra of ["server/routes.ts", "server/lib/email-monitoring-service.ts", "server/ai-worker.ts"])
    assert.throws(() => deploy.releasePaths([...deploy.FILES, extra]), /SCOPE_CHANGED/);
  assert.throws(() => deploy.releasePaths(deploy.FILES.slice(1)), /SCOPE_CHANGED/);
});
test("only the three selected models change; monitoring, settings and original object remain identical", () => {
  const before = initial(), copy = structuredClone(before);
  const next = deploy.planRoutes(before);
  assert.equal(next.version, 12);
  for (const service of deploy.SERVICES) assert.equal(next.value.routes[service].model, deploy.SOLARIS);
  const restored = structuredClone(next.value);
  for (const service of deploy.SERVICES) restored.routes[service].model = deploy.LEGACY;
  assert.deepEqual(restored, before.value);
  assert.deepEqual(before, copy);
});
test("changed versions, disabled routes, extra services and monitoring changes refuse the deployment", () => {
  const cases = [
    state => state.version++,
    state => state.value.routes["email.reply"].enabled = false,
    state => state.value.routes["email.compose"].provider = "openai",
    state => state.value.routes["email.summary"] = { enabled: true, provider: "internal", model: deploy.LEGACY },
    state => state.value.routes["email.monitoring"].model = deploy.SOLARIS,
    state => state.value.gateway.enabled = false,
  ];
  for (const modify of cases) { const state = initial(); modify(state); assert.throws(() => deploy.planRoutes(state)); }
});
test("activation needs fresh successful smoke for the canonical model, not an alias-only check", () => {
  deploy.validateSmoke(smoke(), 11);
  for (const patch of [
    { settingsVersion: 10 }, { state: "failed" }, { textVerified: false }, { jsonVerified: false },
    { checkedAt: new Date(Date.now() - 16 * 60000).toISOString() },
    { checkedAt: new Date(Date.now() + 60000).toISOString() }, { models: [] },
    { models: [{ id: deploy.LEGACY, outputFormats: ["text", "json_object"] }] },
  ]) assert.throws(() => deploy.validateSmoke({ ...smoke(), ...patch }, 11));
});
test("native backup tools get explicit private connection identity, never a URI in argv", () => {
  const env = deploy.nativeDatabaseEnvironment("postgresql://app:synthetic%40pw@localhost:5433/indexus_crm?sslmode=require", { PATH: "/usr/bin" });
  assert.equal(env.PGUSER, "app");
  assert.equal(env.PGPASSWORD, "synthetic@pw");
  assert.equal(env.PGPORT, "5433");
  assert.equal(env.PGDATABASE, "indexus_crm");
  assert.equal(env.PGSSLMODE, "require");
  for (const url of [
    "postgresql://app:synthetic@other.invalid/indexus_crm",
    "postgresql://app:synthetic@localhost/other",
    "postgresql://app:synthetic@localhost/indexus_crm?unreviewed=yes",
    "postgresql://app:synthetic@localhost/indexus_crm?sslmode=require&sslmode=disable",
  ]) assert.throws(() => deploy.nativeDatabaseEnvironment(url, {}));
});
function fakeDatabase(state) {
  const calls = [];
  return { calls, query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT *")) return { rows: [state] };
    return { rows: [], rowCount: 1 };
  } };
}
test("a concurrent configuration change is refused inside the transaction", async () => {
  const old = initial(), changed = initial(); changed.version++;
  const db = fakeDatabase(changed);
  await assert.rejects(deploy.changeRoutes(db, old, smoke()), /CONCURRENT_CONFIGURATION/);
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
  assert.equal(db.calls.some(call => call.sql.startsWith("UPDATE")), false);
});
test("activation updates only AI configuration and audit, with a carried fresh smoke", async () => {
  const state = initial(), db = fakeDatabase(state);
  await deploy.changeRoutes(db, state, smoke());
  const writes = db.calls.filter(call => /^(UPDATE|INSERT)/.test(call.sql));
  assert.equal(writes.length, 2);
  assert.match(writes[0].sql, /^UPDATE ai_router_configuration /);
  assert.equal(writes[0].params[0], 12);
  assert.equal(JSON.parse(writes[0].params[2]).settingsVersion, 12);
  assert.match(writes[1].sql, /^INSERT INTO ai_router_configuration_audit/);
  assert.equal(db.calls.at(-1).sql, "COMMIT");
});
test("rollback refuses later edits and never touches business tables", async () => {
  const before = initial(), after = { ...initial(), version: 12 }, changed = { ...after, version: 13 };
  await assert.rejects(deploy.revertRoutes(fakeDatabase(changed), after, before), /ROLLBACK_CONFIGURATION_CHANGED/);
  const db = fakeDatabase(after);
  await deploy.revertRoutes(db, after, before);
  assert.equal(db.calls.filter(call => /^(UPDATE|INSERT)/.test(call.sql)).length, 2);
  assert.equal(db.calls.some(call => /DELETE|DROP|TRUNCATE|pg_restore/.test(call.sql)), false);
});
test("asset collisions are checked before publishing and old assets remain available", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "solaris-assets-"));
  try {
    const source = root + "/source", destination = root + "/live";
    fs.mkdirSync(source); fs.mkdirSync(destination);
    fs.writeFileSync(source + "/new.js", "new");
    fs.writeFileSync(source + "/existing.js", "changed");
    fs.writeFileSync(destination + "/existing.js", "original");
    fs.writeFileSync(destination + "/old.js", "keep");
    assert.throws(() => deploy.publishAssets(source, destination, {
      uid: process.getuid(), gid: process.getgid(), mode: 0o644,
    }), /ASSET_COLLISION/);
    assert.equal(fs.existsSync(destination + "/new.js"), false);
    assert.equal(fs.readFileSync(destination + "/old.js", "utf8"), "keep");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("real CLI refuses unpinned invocation before any deployment action", () => {
  const result = cp.spawnSync(process.execPath, [require.resolve("./deploy-solaris.cjs")], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SOLARIS_EXPLICIT_PINNED_COMMAND_REQUIRED/);
  assert.doesNotMatch(result.stdout, /DEPLOY_PHASE/);
});
test("private dependency containers isolate Vite caches and keep scoped packages usable", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "solaris-deps-"));
  try {
    const live = root + "/live", stage = root + "/stage";
    fs.mkdirSync(live); fs.mkdirSync(stage);
    fs.mkdirSync(live + "/@scope"); fs.mkdirSync(live + "/@scope/package");
    fs.mkdirSync(live + "/vite"); fs.mkdirSync(live + "/.vite-temp");
    fs.writeFileSync(live + "/.vite-temp/sentinel", "unchanged");
    fs.writeFileSync(live + "/@scope/package/index.js", "module.exports=42");
    deploy.privateDependencies(live, stage + "/node_modules");
    assert.equal(fs.lstatSync(stage + "/node_modules").isSymbolicLink(), false);
    assert.equal(fs.lstatSync(stage + "/node_modules/@scope").isSymbolicLink(), false);
    assert.equal(fs.readlinkSync(stage + "/node_modules/vite"), live + "/vite");
    assert.equal(require(stage + "/node_modules/@scope/package"), 42);
    fs.mkdirSync(stage + "/node_modules/.vite-temp");
    fs.writeFileSync(stage + "/node_modules/.vite-temp/new-cache", "private");
    assert.deepEqual(fs.readdirSync(live + "/.vite-temp"), ["sentinel"]);
    assert.equal(fs.readFileSync(live + "/.vite-temp/sentinel", "utf8"), "unchanged");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("operator build is unprivileged, denies the application UID and always releases its bind mount", () => {
  const source = fs.readFileSync(require.resolve("./deploy-solaris.cjs"), "utf8");
  assert.doesNotMatch(source, /symlinkSync\(ROOT \+ "\/node_modules",/);
  assert.match(source, /run\("runuser", \["-u", "nobody", "--", process\.execPath/);
  assert.match(source, /SOLARIS_LIVE_DEPENDENCIES_WRITABLE_BY_BUILD/);
  assert.match(source, /SOLARIS_BUILD_READABLE_BY_APPLICATION/);
  assert.match(source, /finally \{[\s\S]*run\("umount", \[buildView\]\)/);
});
function recoveryScenario({ conflictBefore, conflictAfter, failDrain, lockedConflict } = {}) {
  const processes = new Map([[4, "online"], [5, "online"]]), stopped = new Set(), calls = [];
  let changed = Boolean(conflictBefore), mutated = false;
  return {
    processes, calls,
    run: () => deploy.guardedRecovery({
      validate: async () => { calls.push("validate"); assert.equal(changed, false, "later configuration edit"); },
      stop: async () => {
        calls.push("stop"); processes.set(4, "stopped"); stopped.add(4);
        if (failDrain) throw Error("drain timeout");
        processes.set(5, "stopped"); stopped.add(5);
        if (conflictAfter) changed = true;
      },
      mutate: async () => {
        if (lockedConflict) throw Error("locked configuration edit");
        mutated = true; calls.push("write");
      },
      hasMutated: () => mutated,
      resume: async () => {
        for (const id of [5, 4]) if (stopped.has(id) && processes.get(id) === "stopped") {
          calls.push("resume-" + id); processes.set(id, "online");
        }
      },
    }),
  };
}
test("rollback orchestration rejects a later configuration edit before stopping either process", async () => {
  const scenario = recoveryScenario({ conflictBefore: true });
  await assert.rejects(scenario.run(), /later configuration edit/);
  assert.deepEqual(scenario.calls, ["validate"]);
  assert.deepEqual([...scenario.processes.values()], ["online", "online"]);
});
test("rollback orchestration rechecks after draining and resumes unchanged processes on a settings race", async () => {
  const scenario = recoveryScenario({ conflictAfter: true });
  await assert.rejects(scenario.run(), /later configuration edit/);
  assert.deepEqual(scenario.calls, ["validate", "stop", "validate", "resume-5", "resume-4"]);
  assert.deepEqual([...scenario.processes.values()], ["online", "online"]);
});
test("rollback drain timeout resumes only the application and leaves the active worker alone", async () => {
  const scenario = recoveryScenario({ failDrain: true });
  await assert.rejects(scenario.run(), /drain timeout/);
  assert.deepEqual(scenario.calls, ["validate", "stop", "resume-4"]);
  assert.deepEqual([...scenario.processes.values()], ["online", "online"]);
});
test("rollback conflict under the DB lock also resumes processes without writing", async () => {
  const scenario = recoveryScenario({ lockedConflict: true });
  await assert.rejects(scenario.run(), /locked configuration edit/);
  assert.deepEqual(scenario.calls, ["validate", "stop", "validate", "resume-5", "resume-4"]);
  let wrote = false;
  await assert.rejects(deploy.revertRoutes(fakeDatabase({ ...initial(), version: 13 }),
    { ...initial(), version: 12 }, initial(), () => { wrote = true; }), /ROLLBACK_CONFIGURATION_CHANGED/);
  assert.equal(wrote, false);
});
test("successful recovery validates twice before its first mutation", async () => {
  const scenario = recoveryScenario();
  await scenario.run();
  assert.deepEqual(scenario.calls, ["validate", "stop", "validate", "write"]);
});
test("runtime and missing-backup guards refuse recovery without stopping processes", async () => {
  for (const code of ["SOLARIS_RECOVERY_EXTERNAL_RUNTIME_CHANGE", "SOLARIS_RECOVERY_BACKUP_CHANGED"]) {
    let stopped = false;
    await assert.rejects(deploy.guardedRecovery({
      validate: async () => { throw Error(code); },
      stop: async () => { stopped = true; },
      mutate: async () => assert.fail("must not write"),
      hasMutated: () => false,
      resume: async () => assert.fail("nothing was stopped"),
    }), new RegExp(code));
    assert.equal(stopped, false);
  }
});
test("a failure after a real mutation does not blindly restart a mixed runtime", async () => {
  let mutated = false;
  await assert.rejects(deploy.guardedRecovery({
    validate: async () => {},
    stop: async () => {},
    mutate: async () => { mutated = true; throw Error("write failed"); },
    hasMutated: () => mutated,
    resume: async () => assert.fail("must require operator after a write"),
  }), /write failed/);
});
