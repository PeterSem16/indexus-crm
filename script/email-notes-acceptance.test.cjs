const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const toolPath = path.resolve("generated-artifacts/email-notes-acceptance.cjs");
const { parseConfig, readPrivateConfig, validateTestDatabase, probeGatewayHttps,
  createObservedGatewayTransport, appendMissingGatewayResults } = require(toolPath);

test("failed POST retains HTTP metadata, never bodies/headers/tokens, and is not repeated", async () => {
  let calls = 0;
  const observed = createObservedGatewayTransport(async () => {
    calls++;
    return new Response("PRIVATE RESPONSE BODY", { status: 422, headers: {
      "x-request-id": "synthetic-request-42", "x-private": "PRIVATE HEADER",
    } });
  }, () => "PRIVATE TOKEN");
  const response = await observed.fetch("https://example.invalid", { method: "POST",
    headers: { Authorization: "Bearer PRIVATE TOKEN" }, body: "PRIVATE EMAIL" });
  assert.equal(response.bodyUsed, false);
  assert.equal(calls, 1);
  assert.equal(observed.events[0].http_status, 422);
  assert.equal(observed.events[0].request_id, "synthetic-request-42");
  assert.match(observed.events[0].started_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.doesNotMatch(JSON.stringify(observed.events), /PRIVATE/);
  const rows = [];
  appendMissingGatewayResults(rows, observed.events);
  assert.equal(rows.find(row => row.test === "gateway_post").status, "FAIL");
  assert.equal(rows.find(row => row.test === "gateway_get").status, "BLOCKED");
  await response.body.cancel();
});
test("safe transport code is retained without raw exception or any automatic retry", async () => {
  let calls = 0;
  const observed = createObservedGatewayTransport(async () => {
    calls++;
    throw Object.assign(Error("PRIVATE URL AND TOKEN"), { cause: { code: "ECONNRESET" } });
  });
  await assert.rejects(observed.fetch("https://example.invalid", { method: "POST" }));
  assert.equal(calls, 1);
  assert.equal(observed.events[0].transport_error, "ECONNRESET");
  assert.doesNotMatch(JSON.stringify(observed.events), /PRIVATE/);
});
test("unknown transport details and token-bearing request identifiers are never reported", async () => {
  const hidden = createObservedGatewayTransport(async () =>
    new Response(null, { headers: { "x-request-id": "SECRET-SYNTHETIC-TOKEN" } }), () => "SYNTHETIC-TOKEN");
  await hidden.fetch("https://example.invalid", { method: "GET" });
  assert.equal(hidden.events[0].request_id, undefined);
  const failed = createObservedGatewayTransport(async () => {
    throw { message: "PRIVATE", cause: { code: "PRIVATE" } };
  });
  await assert.rejects(failed.fetch("https://example.invalid", { method: "GET" }));
  assert.equal(failed.events[0].transport_error, "transport_failed");
  assert.doesNotMatch(JSON.stringify(failed.events), /PRIVATE/);
});
test("missing prerequisites and already successful phases retain their actual outcomes", () => {
  const rows = [{ test: "gateway_post", status: "PASS", detail: "HTTP 202" }];
  appendMissingGatewayResults(rows, []);
  assert.equal(rows[0].status, "PASS");
  assert.equal(rows.filter(row => row.test === "gateway_post").length, 1);
  assert.equal(rows.find(row => row.test === "gateway_get").status, "BLOCKED");
});

test("a root 404 is HTTPS reachability, not a failure of the separately authenticated jobs API", async () => {
  for (const status of [200, 401, 404, 405, 503]) {
    const result = await probeGatewayHttps(new AbortController().signal, async (url, init) => {
      assert.equal(url, "https://ai.cordbloodcenter.com/gateway/");
      assert.equal(init.redirect, "error");
      assert.equal(init.headers, undefined); // No token on the root probe.
      assert.ok(init.signal instanceof AbortSignal);
      return new Response("root status is not the API contract", { status });
    });
    assert.equal(result, status);
  }
});
test("DNS/TLS/transport failures still fail the HTTPS probe", async () => {
  await assert.rejects(probeGatewayHttps(new AbortController().signal,
    async () => { throw Error("synthetic transport failure"); }), /synthetic transport failure/);
});

test("configuration whitelist never executes shell or expands secrets", () => {
  const config = parseConfig('OTHER=ignored\nINDEXUS_AI_GATEWAY_TOKEN="synthetic-placeholder"\n' +
    "EMAIL_NOTES_TEST_DATABASE_URL='$(must-not-run)'\nINDEXUS_AI_EMAIL_NOTES_ENABLED=false");
  assert.deepEqual(Object.keys(config).sort(), [
    "EMAIL_NOTES_TEST_DATABASE_URL", "INDEXUS_AI_EMAIL_NOTES_ENABLED"]);
  assert.equal(config.INDEXUS_AI_GATEWAY_TOKEN, undefined);
  assert.equal(config.EMAIL_NOTES_TEST_DATABASE_URL, "$(must-not-run)");
  assert.equal(config.INDEXUS_AI_EMAIL_NOTES_ENABLED, "false");
});
test("only an explicitly named separate test database is accepted", () => {
  assert.equal(validateTestDatabase("postgresql://localhost/indexus_email_notes_test_acceptance"),
    "indexus_email_notes_test_acceptance");
  for (const value of ["postgresql://localhost/indexus_crm", "postgresql://localhost/postgres",
    "postgresql://localhost/%69ndexus_crm", "https://localhost/indexus_email_notes_test_a", "not-a-url"])
    assert.throws(() => validateTestDatabase(value));
});
test("private configuration rejects public permissions and symbolic links", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "email-notes-tool-"));
  const file = path.join(dir, "secrets.env");
  try {
    fs.writeFileSync(file, "EMAIL_NOTES_TEST_DATABASE_URL=synthetic-placeholder\n", { mode: 0o600 });
    assert.equal(Object.keys(readPrivateConfig(file)).length, 1);
    fs.symlinkSync(file, path.join(dir, "link.env"));
    assert.throws(() => readPrivateConfig(path.join(dir, "link.env")));
    fs.chmodSync(file, 0o644);
    assert.throws(() => readPrivateConfig(file), /unsafe_secret_file/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test("help performs no inspection or integration test", () => {
  const result = spawnSync(process.execPath, [toolPath, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No production DB connection/);
  assert.doesNotMatch(result.stdout, /"results"/);
});
test("unavailable server exits BLOCKED without leaking inherited credentials", () => {
  const result = spawnSync(process.execPath, [toolPath], {
    env: { ...process.env, EMAIL_NOTES_APP_ROOT: "/path-that-does-not-exist-for-acceptance",
      INDEXUS_AI_GATEWAY_TOKEN: "synthetic-do-not-print" }, encoding: "utf8",
  });
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.overall, "BLOCKED");
  assert.ok(report.results.some(row => row.test === "gateway_post" && row.status === "BLOCKED"));
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-do-not-print/);
});
