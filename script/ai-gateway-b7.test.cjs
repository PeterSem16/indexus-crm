"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), vm = require("node:vm");
const { createRequire } = require("node:module");
const P = require("./ai-gateway-b4-pilot.cjs");
const B6 = require("./ai-gateway-b6-pilot.cjs");
const { POLICY } = require("./lib/ai-gateway-b6-normalization.cjs");
const { buildFixture } = require("./export-ai-gateway-b7.cjs");
function mockB6() {
  // Only synthetic unit-test evidence. Never an executed B6/B7 report.
  const plan = { schema: P.SCHEMA, instruction: B6.INSTRUCTION, corpus: B6.CORPUS,
    testPolicy: { normalization: POLICY } };
  plan.planSha256 = crypto.createHash("sha256").update(JSON.stringify(plan)).digest("hex");
  const state = { atUtc: "2026-11-13T00:00:00Z", version: 1, gatewayEnabled: false,
    total: 65, openai: 65, internal: 0, modelOverrides: 0, enabled: 65,
    routesSha256: "a".repeat(64), gatewayParametersSha256: "b".repeat(64),
    fullConfigurationSha256: "c".repeat(64) };
  const rows = B6.CORPUS.map(doc => ({ id: doc.id, attempted: true, durationMs: 20000,
    ...P.evaluate(JSON.stringify(doc.expected), doc.expected) }));
  return { plan, report: { phase: "B6", model: P.MODEL, code: null, finalVerified: true,
    rawPassed: true, before: state, after: { ...state }, rows, summary: P.aggregate(rows, true, B6.CORPUS),
    normalizationEffect: { applied: 0 }, planSha256: plan.planSha256,
    generation: { temperature: 0, max_tokens: 512, stream: false, retries: 0 } } };
}
function fixture() { const { report, plan } = mockB6(); return buildFixture(report, plan); }
if (process.argv.includes("--mock-fixture-json")) {
  process.stdout.write(JSON.stringify(fixture()));
} else {
  test("B7 exports byte-identical B6 reference, schema and twenty source documents", () => {
    const f = fixture();
    assert.equal(f.payload.referencePrompt, B6.INSTRUCTION);
    assert.deepEqual(f.payload.schema, P.SCHEMA);
    assert.deepEqual(f.payload.corpus, B6.CORPUS);
    assert.equal(f.payload.baselineB6.correctFields, 160);
    assert.equal(f.payload.baselineB6.normalizationApplied, 0);
    assert(!JSON.stringify(f).includes('"actual"'));
  });
  test("B7 refuses changed source, raw errors, normalization or unverified historical routing", () => {
    for (const mutate of [
      x => { x.plan.instruction += "changed"; },
      x => { x.report.rows[0].actual.document_id = "wrong"; },
      x => { x.report.rows[0].schemaValid = false; },
      x => { x.report.rows[0].duplicateKeys = true; },
      x => { x.report.rows[0].extraKeys = 1; },
      x => { x.report.normalizationEffect.applied = 1; },
      x => { x.report.rawPassed = false; },
      x => { x.report.generation.temperature = 1; },
      x => { x.report.after.openai = 64; },
      x => { x.report.after.gatewayEnabled = true; },
      x => { x.report.rows.pop(); },
    ]) {
      const f = mockB6(); mutate(f);
      assert.throws(() => buildFixture(f.report, f.plan), /^Error: B7_/);
    }
  });
  test("export is blocked outside the operator server and does not load runtime credentials", () => {
    const child = spawnSync(process.execPath, ["script/export-ai-gateway-b7.cjs", "--export-b7"], { encoding: "utf8" });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /B7_EXPORT_CORPCRM01_SEMAN_ONLY/);
  });
  test("full mocked operator export packages only Python and synthetic fixtures, never credentials", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "b7-export-test-"));
    try {
      const base = path.join(home, ".indexus-b6"), run = path.join(base, "run-TEST");
      fs.mkdirSync(run, { recursive: true, mode: 0o700 });
      const { report, plan } = mockB6();
      for (const [filename, value] of [["b6-started.json", { runDir: run }],
        ["run-TEST/report.json", report], ["run-TEST/plan.json", plan]])
        fs.writeFileSync(path.join(base, filename), JSON.stringify(value), { mode: 0o600 });
      const filename = path.resolve("script/export-ai-gateway-b7.cjs");
      const realRequire = createRequire(filename), module = { exports: {} }, lines = [];
      const fakeFs = { ...fs, lstatSync(...args) { const s = fs.lstatSync(...args); s.uid = 1001; return s; } };
      const context = { module, exports: module.exports, Buffer, __dirname: path.dirname(filename),
        process: { argv: ["node", filename, "--export-b7"], env: {}, getuid: () => 1001 },
        console: { log: line => lines.push(line), error: line => { throw Error(line); } },
        require: name => name === "node:fs" ? fakeFs : name === "node:os" ?
          { ...os, homedir: () => home, hostname: () => "CORPCRM01" } : realRequire(name) };
      vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
      module.exports.main();
      const archive = lines.find(x => x.startsWith("B7_ARCHIVE ")).slice("B7_ARCHIVE ".length);
      const unpacked = path.join(home, "unpacked");
      fs.mkdirSync(unpacked, { mode: 0o700 });
      assert.equal(spawnSync("tar", ["-xzf", archive, "-C", unpacked]).status, 0);
      assert.deepEqual(fs.readdirSync(unpacked).sort(),
        ["SHA256SUMS", "ai-gateway-b7.py", "ai_gateway_b7_core.py", "fixtures.json"].sort());
      assert.equal(spawnSync("sha256sum", ["-c", "SHA256SUMS"], { cwd: unpacked }).status, 0);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(unpacked, "fixtures.json"), "utf8")), fixture());
      const py = spawnSync("python3", ["ai-gateway-b7.py", "--run-b7", "--fixtures", "fixtures.json"],
        { cwd: unpacked, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
      assert.equal(py.status, 1);
      assert.match(py.stderr, /B7_AI_SERVER_ONLY/); // Imports succeeded; no request was sent.
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
  });
}
