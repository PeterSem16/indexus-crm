const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const toolPath = path.resolve("generated-artifacts/email-notes-acceptance.cjs");
const { parseConfig, readPrivateConfig, validateTestDatabase, probeGatewayHttps } = require(toolPath);

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
