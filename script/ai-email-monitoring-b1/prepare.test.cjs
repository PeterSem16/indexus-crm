const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const { assertRuntime, classifyTarget } = require("./runtime.cjs");
const { checkDiscovery } = require("./discovery.cjs");
const { prepareArtifacts, launchArguments, processEnvironment } = require("./prepare-console.cjs");
const valid = () => ({ NODE_ENV: "production", INDEXUS_AI_GATEWAY_ENABLED: "true",
  INDEXUS_AI_ROUTER_MODE: "routed", INDEXUS_AI_GATEWAY_BASE_URL: "https://ai.cordbloodcenter.com/gateway/",
  INDEXUS_AI_GATEWAY_TOKEN: "SYNTHETIC_RUNTIME_TEST_TOKEN" });
test("read-only discovery sends exactly three HTTPS GETs without model inference or credential output", async () => {
  const calls = [], token = "SYNTHETIC_DISCOVERY_SECRET";
  const result = await checkDiscovery({ token, fetch: async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("health/ready")) return new Response(null);
    if (url.endsWith("v1/models")) return Response.json({ data: [{ id: "indexus-email-monitoring:v1" }], ignored: token });
    return Response.json({ apiVersion: "1", models: [{ id: "indexus-email-monitoring:v1",
      maxOutputTokens: 200, inputModalities: ["text"], operations: ["chat.completions"], outputFormats: ["json_object"] }] });
  } });
  assert.equal(calls.length, 3);
  assert.ok(calls.every(c => c.url.startsWith("https://ai.cordbloodcenter.com/gateway/") &&
    c.init.method === "GET" && c.init.redirect === "error" && c.init.body === undefined));
  assert.equal(result.error, null); assert.equal(result.inferenceCalls, 0);
  assert.equal(result.declaredMaxOutputTokens, 200);
  assert.equal(JSON.stringify(result).includes(token), false);
});
test("read-only discovery stops on redirect and reports absent models rather than inventing capabilities", async () => {
  let calls = 0;
  const blocked = await checkDiscovery({ token: "SYNTHETIC", fetch: async () => {
    calls++; return new Response(null, { status: 301 });
  } });
  assert.equal(calls, 1); assert.equal(blocked.error, "B1_DISCOVERY_HTTP_ERROR");
  const missing = await checkDiscovery({ token: "SYNTHETIC", fetch: async url =>
    url.endsWith("health/ready") ? new Response(null) : Response.json({ data: [], models: [] }) });
  assert.equal(missing.error, "B1_DISCOVERY_MODEL_UNAVAILABLE");
  assert.equal(missing.declaredMaxOutputTokens, null);
  const invalidShape = await checkDiscovery({ token: "SYNTHETIC", fetch: async url =>
    url.endsWith("health/ready") ? new Response(null) : Response.json({ data: {}, models: {} }) });
  assert.equal(invalidShape.error, "B1_DISCOVERY_CONTRACT_MISMATCH");
  assert.equal(invalidShape.listed, null); assert.equal(invalidShape.declared, null);
});
test("B1 permits exactly three canonical HTTPS checks and the single private HTTP inference URL", () => {
  for (const p of ["health/ready", "v1/models", "indexus/v1/capabilities"])
    assert.equal(classifyTarget("https://ai.cordbloodcenter.com/gateway/" + p), "DISCOVERY");
  assert.equal(classifyTarget("http://10.9.2.140/gateway/v1/chat/completions"), "INFERENCE");
  for (const url of ["http://10.9.2.140/gateway/health/ready",
    "https://ai.cordbloodcenter.com/gateway/v1/chat/completions",
    "http://10.9.2.140/gateway/v1/chat/completions?redirect=1",
    "http://10.9.2.140/gateway/v1/models",
    "https://example.org/gateway/health/ready"])
    assert.throws(() => classifyTarget(url), /B1_UNEXPECTED_TARGET/);
});
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
  assert.deepEqual(launchArguments("/private/runtime.cjs", "/private/run-b12.cjs", "/private/original/evidence.json").run,
    ["--require", "/etc/indexus-ai-runtime/preload.cjs", "/private/run-b12.cjs", "--run-b12", "/private/original/evidence.json"]);
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
