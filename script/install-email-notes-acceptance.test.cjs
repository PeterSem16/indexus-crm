const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const esbuild = require("esbuild");
const { FILES, SHARED_PRELOAD, gatewayInvocation, gitBlobId, install } = require("./install-email-notes-acceptance.cjs");

test("notes use the same shared Gateway preload as email.monitoring, without a private token config", () => {
  const env = { INDEXUS_AI_EMAIL_NOTES_ENABLED: "false", UNRELATED: "preserved" };
  const original = { ...env };
  const invocation = gatewayInvocation("/private/acceptance.cjs", env);
  assert.deepEqual(invocation.args, ["--require", "/etc/indexus-ai-runtime/preload.cjs", "/private/acceptance.cjs"]);
  assert.equal(SHARED_PRELOAD, "/etc/indexus-ai-runtime/preload.cjs");
  assert.equal(invocation.options.env.NODE_ENV, "production");
  assert.equal(invocation.options.env.INDEXUS_AI_EMAIL_NOTES_ENABLED, "false");
  assert.equal(invocation.options.env.UNRELATED, "preserved");
  assert.equal(invocation.options.env.INDEXUS_AI_GATEWAY_TOKEN, undefined);
  assert.equal(invocation.options.env.INDEXUS_AI_GATEWAY_ENABLED, undefined);
  assert.equal(invocation.options.env.INDEXUS_AI_ROUTER_MODE, undefined);
  assert.deepEqual(env, original); // Only the child receives environment additions.
});

function fixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "email-notes-installer-"));
  const appRoot = path.join(dir, "app");
  fs.mkdirSync(appRoot);
  try { return fn({ appRoot, destination: path.join(dir, "private", "acceptance.cjs"),
    getBlob: file => fs.readFileSync(path.resolve(file)), builder: esbuild }); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test("all four frozen source identities match verified inputs", () => {
  for (const [file, expected] of Object.entries(FILES))
    assert.equal(gitBlobId(fs.readFileSync(file)), expected);
});
test("verified sources compile and install an executable standalone script", () => fixture(options => {
  const result = install(options);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(fs.statSync(result.destination).mode & 0o777, 0o600);
  assert.match(cp.execFileSync(process.execPath, [result.destination, "--help"],
    { encoding: "utf8" }), /No production DB connection/);
  assert.deepEqual(fs.readdirSync(path.dirname(result.destination)), ["acceptance.cjs"]);
}));
test("different compiler rendering is accepted with identical verified source inputs", () => fixture(options => {
  options.builder = { version: "format-variation", buildSync(config) {
    const built = esbuild.buildSync(config);
    built.outputFiles[0].contents = Buffer.concat([
      Buffer.from("// Different compiler formatting; verified sources unchanged.\n"),
      built.outputFiles[0].contents,
    ]);
    return built;
  }};
  assert.equal(install(options).compiler, "format-variation");
}));
test("one corrupted source blocks compilation and preserves an existing installer result", () => fixture(options => {
  fs.mkdirSync(path.dirname(options.destination), { mode: 0o700 });
  fs.writeFileSync(options.destination, "keep-existing");
  options.getBlob = file => Buffer.concat([fs.readFileSync(file), Buffer.from("\nCORRUPTED")]);
  options.builder = { buildSync() { assert.fail("must not compile unverified input"); } };
  assert.throws(() => install(options), /source_integrity_failed/);
  assert.equal(fs.readFileSync(options.destination, "utf8"), "keep-existing");
  assert.deepEqual(fs.readdirSync(path.dirname(options.destination)), ["acceptance.cjs"]);
}));
test("shared destination permissions are rejected", () => fixture(options => {
  fs.mkdirSync(path.dirname(options.destination), { mode: 0o755 });
  assert.throws(() => install(options), /private_directory_owner_and_0700_required/);
}));
test("application directory cannot be an installation destination", () => fixture(options => {
  const privateInApp = path.join(options.appRoot, "private");
  fs.mkdirSync(privateInApp, { mode: 0o700 });
  options.destination = path.join(privateInApp, "acceptance.cjs");
  assert.throws(() => install(options), /destination_must_be_outside_application/);
}));
