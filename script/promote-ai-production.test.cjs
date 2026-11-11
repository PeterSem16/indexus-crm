const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { spawnSync } = require("node:child_process");
const helper = require("./promote-ai-production.cjs");
const prepared = require("./prepare-ai-production.cjs");
test("real CLI refuses this host and requires an explicit immutable application pin", () => {
  for (const args of [[], ["--apply", "main"], ["--apply", prepared.TARGET]]) {
    const result = spawnSync(process.execPath, [path.join(__dirname, "promote-ai-production.cjs"), ...args], { encoding: "utf8" });
    assert.equal(result.status, 1); assert.match(result.stderr, /AI_PROMOTE_REFUSED_NO_OPERATION/);
  }
});
test("both PM2 and dotenv must keep Gateway inactive and the production router routed", () => {
  helper.assertHold({}, {});
  helper.assertHold({ INDEXUS_AI_GATEWAY_ENABLED: "false" }, { INDEXUS_AI_ROUTER_MODE: "routed" });
  for (const bad of [{ INDEXUS_AI_GATEWAY_ENABLED: "true" }, { INDEXUS_AI_GATEWAY_ENABLED: "1" },
    { INDEXUS_AI_GATEWAY_ENABLED: "TRUE" }, { INDEXUS_AI_ROUTER_MODE: "legacy" }]) {
    assert.throws(() => helper.assertHold(bad, {}));
    assert.throws(() => helper.assertHold({}, bad));
  }
});
test("production defaults cannot hide internal routes, checks, overrides or prior administration", () => {
  const value = { version: 1, gatewayDisabled: true, routesEmpty: true, gatewayUntested: true, openaiUntested: true, auditCount: 0 };
  helper.assertDatabaseHold(value);
  for (const patch of [{ version: 2 }, { gatewayDisabled: false }, { routesEmpty: false },
    { gatewayUntested: false }, { openaiUntested: false }, { auditCount: 1 }])
    assert.throws(() => helper.assertDatabaseHold({ ...value, ...patch }), /PRODUCTION_AI_DEFAULTS_REQUIRE_REVIEW/);
});
test("HTTP hashes preserve binary bytes as well as UTF-8, including embedded newlines", () => {
  const bytes = Buffer.from([0, 255, 10, 195, 40, 128, 10]);
  const parsed = helper.decodeHTTP(Buffer.concat([bytes, Buffer.from("\n200")]));
  assert.deepEqual(parsed.body, bytes); assert.equal(parsed.status, 200);
  const crypto = require("node:crypto");
  assert.equal(parsed.sha256, crypto.createHash("sha256").update(bytes).digest("hex"));
  assert.throws(() => helper.decodeHTTP("text"), /HTTP_BYTES_REQUIRED/);
  assert.throws(() => helper.decodeHTTP(Buffer.from("no status")), /HTTP_STATUS_MISSING/);
});
test("PM2 config fingerprints ignore runtime counters, but cover secrets and direct flags without returning them", () => {
  const row = { pm2_env: { env: { DATABASE_URL: "fixture-private", PORT: "5000" }, INDEXUS_AI_GATEWAY_ENABLED: "false", restart_time: 1 } };
  const first = helper.configHash(row);
  assert.equal(first, helper.configHash({ pm2_env: { ...row.pm2_env, restart_time: 2 } }));
  assert.notEqual(first, helper.configHash({ pm2_env: { ...row.pm2_env, INDEXUS_AI_GATEWAY_ENABLED: "true" } }));
  assert.notEqual(first, helper.configHash({ pm2_env: { ...row.pm2_env, env: { DATABASE_URL: "changed" } } }));
  assert.match(first, /^[a-f0-9]{64}$/);
});
function harness(failure, recoveryFailure) {
  const order = [], actions = {};
  for (const name of ["assets", "sources", "backend", "restart", "verifyBackend", "entry", "verifyFinal", "complete",
    "restoreEntry", "restoreBackend", "verifyRecovery", "failure"])
    actions[name] = () => { order.push(name); if (name === failure || name === recoveryFailure) throw Error("SIMULATED_FAILURE"); };
  actions.phase = name => order.push("phase:" + name);
  return { actions, order };
}
test("entry HTML is published only after the backend and OpenAI-only defaults are verified", () => {
  const h = harness(); helper.performPromotion(h.actions);
  const calls = h.order.filter(x => !x.startsWith("phase:"));
  assert.deepEqual(calls, ["assets", "sources", "backend", "restart", "verifyBackend", "entry", "verifyFinal", "complete"]);
});
test("failure before runtime installation never restarts the application", () => {
  for (const point of ["assets", "sources"]) {
    const h = harness(point);
    assert.throws(() => helper.performPromotion(h.actions), error => error.runtimeRecovery === "not_needed");
    assert(!h.order.includes("restart")); assert(!h.order.includes("restoreBackend"));
  }
});
test("copy failure restores the backend without an unnecessary PM2 restart", () => {
  const h = harness("backend");
  assert.throws(() => helper.performPromotion(h.actions), error => error.runtimeRecovery === "previous_runtime_verified" && error.sourcesAdvanced);
  assert(h.order.includes("restoreBackend")); assert(!h.order.includes("restart"));
});
test("failed startup restores only runtime and verifies recovery, retaining schema and Git evidence", () => {
  const h = harness("verifyBackend");
  assert.throws(() => helper.performPromotion(h.actions), error =>
    error.failedPhase === "verify_backend_and_openai_defaults" && error.runtimeRecovery === "previous_runtime_verified" &&
    error.schemaMayHaveChanged === true && error.sourcesAdvanced === true);
  assert.equal(h.order.filter(x => x === "restart").length, 2);
  assert(!h.order.includes("entry")); assert(!h.order.includes("restoreEntry"));
});
test("failure after entry publication restores the old entry before the old backend", () => {
  const h = harness("verifyFinal");
  assert.throws(() => helper.performPromotion(h.actions));
  assert(h.order.indexOf("restoreEntry") < h.order.indexOf("restoreBackend"));
  assert(!h.order.includes("complete"));
});
test("failed recovery is explicit and never claimed as a successful deployment", () => {
  const h = harness("verifyFinal", "restoreBackend");
  assert.throws(() => helper.performPromotion(h.actions), error => error.runtimeRecovery === "operator_attention_required");
});
test("failure to persist success also restores the previous serving runtime", () => {
  const h = harness("complete");
  assert.throws(() => helper.performPromotion(h.actions), error => error.runtimeRecovery === "previous_runtime_verified");
  assert(h.order.includes("restoreEntry")); assert(h.order.includes("verifyRecovery"));
});
test("atomic publication preserves old files, refuses collisions, verifies bytes and rejects symlinks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-promote-test-"));
  try {
    const src = root + "/source", dest = root + "/public/assets/chunk.js";
    fs.writeFileSync(src, "new");
    const expected = prepared.fileHash(src), profile = { uid: process.getuid(), gid: process.getgid(), mode: 0o644 };
    const previousUmask = process.umask(0o077);
    try { helper.atomicFile(src, dest, expected, false, profile); } finally { process.umask(previousUmask); }
    assert.equal(fs.statSync(root + "/public").mode & 0o777, 0o755);
    assert.equal(fs.statSync(root + "/public/assets").mode & 0o777, 0o755);
    assert.equal(fs.statSync(dest).mode & 0o777, 0o644);
    assert.equal(fs.readFileSync(dest, "utf8"), "new");
    assert.throws(() => helper.atomicFile(src, dest, expected, false, profile), /EEXIST/);
    fs.writeFileSync(src, "replacement");
    assert.throws(() => helper.atomicFile(src, dest, expected, true, profile), /COPY_SOURCE_CHANGED/);
    assert.equal(fs.readFileSync(dest, "utf8"), "new");
    helper.atomicFile(src, dest, prepared.fileHash(src), true, profile);
    assert.equal(fs.readFileSync(dest, "utf8"), "replacement");
    fs.symlinkSync(dest, root + "/link");
    assert.throws(() => helper.atomicFile(src, root + "/link", prepared.fileHash(src), true, profile), /SYMLINK/);
    assert.deepEqual(fs.readdirSync(root + "/public/assets"), ["chunk.js"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
