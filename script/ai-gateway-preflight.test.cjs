"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { EventEmitter } = require("node:events");
const F = require("./lib/ai-gateway-preflight.cjs"), P = require("./lib/ai-gateway-policy.cjs");
const cp = require("node:child_process"), path = require("node:path");
const SECRET = "SYNTHETIC_PREFLIGHT_TOKEN_123456789";
const models = () => ({ object: "list", data: [{ id: F.MODEL }] });
const caps = () => ({ apiVersion: "1", models: [{ id: F.MODEL, revision: "fixture-1",
  operations: ["chat.completions"], inputModalities: ["text"], outputFormats: ["text", "json_object"],
  streaming: false, maxInputTokens: 100, maxOutputTokens: null }] });
test("Gateway discovery requires the expected model and text plus JSON contract", () => {
  assert.equal(F.discovery(models(), caps()).model, F.MODEL);
  for (const mutate of [c => c.apiVersion = "2", c => c.models[0].outputFormats = ["text"],
    c => c.models[0].inputModalities = ["audio"], c => c.models[0].revision = "invalid revision",
    c => c.models.push(structuredClone(c.models[0])), c => c.models[0].maxInputTokens = -1]) {
    const c = caps(); mutate(c); assert.throws(() => F.discovery(models(), c), /GATEWAY_/);
  }
  assert.throws(() => F.discovery({ object: "list", data: [] }, caps()), /UNAVAILABLE/);
});
function transport(status = 200, body = JSON.stringify(models()), contentType = "application/json") {
  return { request(url, options, callback) {
    assert.equal(url.origin, "https://ai.cordbloodcenter.com");
    assert.ok(url.pathname.startsWith("/gateway/"));
    assert.equal(options.method, "GET"); assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.headers.authorization, "Bearer " + SECRET);
    const req = new EventEmitter();
    req.destroy = () => {}; req.end = () => queueMicrotask(() => {
      const res = new EventEmitter();
      res.headers = { "content-type": contentType }; res.statusCode = status;
      res.resume = () => {}; res.destroy = () => {};
      callback(res); res.emit("data", Buffer.from(body)); res.emit("end");
    });
    return req;
  } };
}
test("transport uses GET, TLS certificate validation and a fixed /gateway prefix", async () => {
  assert.deepEqual(await F.getJSON("v1/models", SECRET, transport()), models());
  assert.equal(await F.getJSON("health/ready", SECRET, transport(200, "OK", "text/plain")), null);
});
for (const status of [301, 302, 401, 403, 404, 503]) {
  test("HTTP " + status + " blocks without redirects or credential disclosure", async () => {
    await assert.rejects(F.getJSON("v1/models", SECRET, transport(status, SECRET)), e =>
      e.operatorCode === "GATEWAY_HTTP_" + status && !e.message.includes(SECRET));
  });
}
test("malformed, non-JSON and oversized Gateway responses block safely", async () => {
  for (const [body, type, code] of [["{", "application/json", "GATEWAY_JSON_INVALID"],
    ["{}", "text/html", "GATEWAY_CONTENT_TYPE_INVALID"],
    ["x".repeat(F.LIMIT + 1), "application/json", "GATEWAY_RESPONSE_TOO_LARGE"]]) {
    await assert.rejects(F.getJSON("v1/models", SECRET, transport(200, body, type)),
      e => e.operatorCode === code);
  }
});
test("inference endpoints and whitespace-bearing credentials are refused before transport", () => {
  const never = { request() { assert.fail("must not connect"); } };
  assert.throws(() => F.getJSON("v1/chat/completions", SECRET, never), /ENDPOINT_FORBIDDEN/);
  assert.throws(() => F.getJSON("v1/models", "bad token", never), /TOKEN_FORMAT/);
});
test("TLS/network exceptions cannot disclose credentials or vendor messages", async () => {
  await assert.rejects(F.getJSON("v1/models", SECRET, { request() { throw Error(SECRET); } }),
    e => e.operatorCode === "GATEWAY_TLS_OR_NETWORK_FAILED" && !e.message.includes(SECRET));
});
function fixture() {
  const row = { pid: P.C.initialPID, pm_id: 4, pm2_env: {
    env: { OPENAI_API_KEY: "fake-openai", DATABASE_URL: "fake-db" }, node_args: [] } };
  const ai = { version: 1, value: { gateway: { enabled: false,
    baseURL: "https://ai.cordbloodcenter.com/gateway/" }, routes: {} } };
  const dotenv = { bytes: Buffer.from("fake-env"), uid: 1001, gid: 1001, mode: 0o600 };
  const files = new Map([
    [P.C.root + "/server/lib/ai/service-catalog.ts", Array.from({ length: 65 }, (_, i) => ` "service.${i}": "chat",`).join("\n")],
    [P.C.root + "/server/config/ai-routing.ts", "AI_ROUTING_OVERRIDES: AIRoutingOverrides = Object.freeze({})"],
    ["/fixture/ops/ai-gateway/preload.cjs", "fake-loader"],
    ["/fixture/script/fake.cjs", "fake-source"],
    [P.C.root + "/.env", "fake-env"],
    [P.C.token, SECRET],
    [P.C.root + "/dist/index.cjs", "backend"],
  ]);
  let readCount = 0; const calls = [];
  const host = {
    async preflight() { return { env: row.pm2_env.env, ai, dotenv, pm2: { version: "6.0.0" } }; },
    rpc(_p, action) { assert.equal(action, "list"); calls.push("pm2-read"); return [row]; },
    application(rows) { return rows[0]; }, fileProfile() { return null; }, optionalFile() { return null; },
    noLinks() {}, disk() {}, aclAbsent() {}, daemon() {}, health() {},
    command(bin, args) { assert.ok(bin === "systemd-analyze" || (bin === "/usr/bin/node" && args[0] === "--check")); },
    file(name) {
      assert.ok(files.has(name), "fixture absent: " + name);
      return { ...(name.endsWith("/.env") ? dotenv : { uid: 0, gid: 0, mode: 0o600 }),
        bytes: Buffer.from(files.get(name)) };
    },
    async readAI() { readCount++; return structuredClone(ai); },
  };
  const policy = { ...P, C: { ...P.C, backend: P.hash("backend") }, verifyLoader: () => ["valid"] };
  const options = { sourceRoot: "/fixture", sources: ["script/fake.cjs"], host, policy,
    async get(endpoint, token) {
      assert.equal(token, SECRET); calls.push(endpoint);
      return endpoint === "v1/models" ? models() : endpoint.includes("capabilities") ? caps() : null;
    } };
  return { options, host, files, calls, row, ai, readCount: () => readCount };
}
test("READY requires every check, all 65 OpenAI routes, three GETs and unchanged final state", async () => {
  const f = fixture(), report = await F.run(f.options);
  assert.equal(report.status, "READY");
  assert.equal(report.gatewayGETRequests, 3);
  assert.equal(report.checks.all65Routes.routes.length, 65);
  assert.equal(report.productionChanges, false); assert.equal(report.restarts, 0);
  assert.equal(report.backupCreated, false); assert.equal(report.targetAchieved, false);
  assert.equal(report.checks.backupAndRollbackPrerequisites.actualBackupVerified, false);
  assert.equal(report.checks.tokenAndGateway.inferenceTested, false);
  assert.ok(!JSON.stringify(report).includes(SECRET)); assert.equal(f.readCount(), 1);
});
test("a host failure reports BLOCKED and never even reads the token or calls Gateway", async () => {
  const f = fixture(); f.host.preflight = async () => { P.ensure(false, "INITIAL_INDEXUS_PROCESS_CHANGED"); };
  f.host.file = () => assert.fail("must not read");
  const r = await F.run(f.options);
  assert.equal(r.status, "BLOCKED"); assert.equal(r.gatewayGETRequests, 0);
  assert.equal(r.blockedBy, "INITIAL_INDEXUS_PROCESS_CHANGED");
});
test("any changed route blocks before Gateway access", async () => {
  const f = fixture(); f.ai.value.routes.x = { provider: "internal" };
  const r = await F.run(f.options); assert.equal(r.status, "BLOCKED");
  assert.equal(r.gatewayGETRequests, 0);
});
test("backup collision or an active operation lock blocks without testing writes", async () => {
  for (const mutate of [h => h.fileProfile = () => ({ directory: true, uid: 1001, gid: 1001, mode: 0o700 }),
    h => h.optionalFile = () => ({ bytes: Buffer.from("lock") })]) {
    const f = fixture(); mutate(f.host);
    const r = await F.run(f.options); assert.equal(r.status, "BLOCKED");
    assert.equal(r.blockedAt, "backupAndRollbackPrerequisites"); assert.equal(r.gatewayGETRequests, 0);
  }
});
test("invalid or unavailable Gateway blocks and does not pretend deployment is complete", async () => {
  const f = fixture(); f.options.get = async () => { throw Error(SECRET); };
  const r = await F.run(f.options);
  assert.equal(r.status, "BLOCKED"); assert.equal(r.gatewayGETRequests, 1);
  assert.equal(r.blockedBy, "PREFLIGHT_CHECK_FAILED"); assert.ok(!JSON.stringify(r).includes(SECRET));
});
test("invalid token contents or permissions block before any authenticated GET", async () => {
  for (const mode of [0o644, 0o600]) {
    const f = fixture(), original = f.host.file;
    f.host.file = name => name === P.C.token ?
      { uid: 0, gid: 0, mode, bytes: Buffer.from(mode === 0o600 ? "invalid token" : SECRET) } : original(name);
    const r = await F.run(f.options);
    assert.equal(r.status, "BLOCKED"); assert.equal(r.gatewayGETRequests, 0);
  }
});
test("a concurrent change after Gateway GETs blocks the final result", async () => {
  const f = fixture(); f.host.readAI = async () => ({ ...f.ai, version: 2 });
  const r = await F.run(f.options);
  assert.equal(r.status, "BLOCKED"); assert.equal(r.blockedAt, "unchangedAfterChecks");
});
test("actual CLI outside CORPCRM01 returns a single BLOCKED report without production access", () => {
  if (require("node:os").hostname().toUpperCase() === "CORPCRM01") return;
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, "ai-gateway-production.cjs"), "--preflight"],
    { encoding: "utf8", env: { PATH: process.env.PATH } });
  assert.equal(r.status, 1); assert.equal(r.stderr, "");
  const report = JSON.parse(r.stdout);
  assert.equal(report.status, "BLOCKED"); assert.equal(report.blockedBy, "ROOT_ON_CORPCRM01_REQUIRED");
  assert.equal(report.gatewayGETRequests, 0); assert.equal(report.productionChanges, false);
});
