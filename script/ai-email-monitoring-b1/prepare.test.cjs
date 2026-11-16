const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const { assertRuntime } = require("./runtime.cjs");
const { prepareArtifacts, launchArguments, processEnvironment } = require("./prepare-console.cjs");
const valid = () => ({ NODE_ENV: "production", INDEXUS_AI_GATEWAY_ENABLED: "true",
  INDEXUS_AI_ROUTER_MODE: "routed", INDEXUS_AI_GATEWAY_BASE_URL: "https://ai.cordbloodcenter.com/gateway/",
  INDEXUS_AI_GATEWAY_TOKEN: "SYNTHETIC_RUNTIME_TEST_TOKEN" });
test("valid existing preload output is checked without mutation or exposing a token", () => {
  const env = valid(), before = { ...env };
  assertRuntime(env);
  assert.deepEqual(env, before);
});
for (const [label, patch] of Object.entries({
  missingProductionEnvironment: { NODE_ENV: undefined },
  blockedPreload: { INDEXUS_AI_GATEWAY_ENABLED: "false", INDEXUS_AI_GATEWAY_TOKEN: undefined },
  missingToken: { INDEXUS_AI_GATEWAY_TOKEN: undefined },
  wrongEndpoint: { INDEXUS_AI_GATEWAY_BASE_URL: "http://10.9.2.140/gateway/" },
  wrongMode: { INDEXUS_AI_ROUTER_MODE: "legacy" },
})) test(`runtime ${label} stops; no .env credential fallback`, () => {
  assert.throws(() => assertRuntime({ ...valid(), ...patch }), error =>
    /^B1_[A-Z0-9_]+$/.test(error.message) && !error.message.includes("SYNTHETIC_RUNTIME_TEST_TOKEN"));
});
test("the corrected launch keeps production environment process-local and preloads before the runner", () => {
  const input = { NODE_ENV: "development", KEEP: "unchanged" };
  const child = processEnvironment(input);
  assert.equal(child.NODE_ENV, "production");
  assert.equal(child.KEEP, "unchanged");
  assert.equal(input.NODE_ENV, "development");
  const args = launchArguments("/private/runtime.cjs", "/private/run-b1.cjs");
  assert.deepEqual(args.run, ["--require", "/etc/indexus-ai-runtime/preload.cjs", "/private/run-b1.cjs", "--run-b1"]);
  assert.equal(args.preflight[2], "-e");
});
test("private tooling is materialized before launch without touching live source files or requiring the missing home path", t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "b1-preparation-test-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const app = path.join(temp, "app"), home = path.join(temp, "home"), src = path.join(temp, "fixture");
  for (const p of [app, home, src]) fs.mkdirSync(p, { mode: 0o700 });
  fs.mkdirSync(path.join(app, "node_modules"));
  fs.writeFileSync(path.join(app, "live-source"), "UNCHANGED");
  fs.writeFileSync(path.join(src, "tool"), "SYNTHETIC_TOOL");
  const archive = cp.execFileSync("tar", ["-cf", "-", "-C", src, "tool"]);
  const prepared = prepareArtifacts({
    app, home, uid: process.getuid(), archive,
    build(source, output) {
      assert.equal(fs.readFileSync(path.join(source, "tool"), "utf8"), "SYNTHETIC_TOOL");
      assert.equal(fs.realpathSync(path.join(source, "node_modules")), path.join(app, "node_modules"));
      fs.mkdirSync(output, { mode: 0o700 });
      const code = "/* SYNTHETIC NOT EXECUTED */";
      fs.writeFileSync(path.join(output, "run-b1.cjs"), code);
      fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify({
        files: { "run-b1.cjs": crypto.createHash("sha256").update(code).digest("hex") },
      }));
    },
  });
  assert.equal(fs.existsSync(prepared.runner), true);
  assert.ok(prepared.runner.startsWith(home + path.sep));
  assert.equal(fs.statSync(prepared.runner).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(path.join(app, "live-source"), "utf8"), "UNCHANGED");
  assert.equal(fs.existsSync(path.join(home, "indexus-email-monitoring-b1/run-b1.cjs")), false);
});
