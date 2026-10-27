const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const script = path.join(__dirname, "prepare-automation-production-release.sh");

test("operator preparation is syntactically valid and requires its exact read-only mode", () => {
  assert.equal(spawnSync("bash", ["-n", script]).status, 0);
  for (const args of [[], ["--apply"], ["--prepare", "--apply"], ["--allow-restart"]]) {
    const result = spawnSync("bash", [script, ...args], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stdout, /Usage:/);
  }
});

test("preparation cannot restart, migrate or promote the production runtime", () => {
  const source = readFileSync(script, "utf8");
  assert.doesNotMatch(source, /\bpm2\s|\bgit\s+(?:merge|pull|reset|checkout)\b|\bpg_restore\b|\bdb:push\b/);
  assert.match(source, /EXPECTED_LIVE=08a6c4e92a2834063eb6e14169ca4107b0d70bcd87a5aad47a44953088b02bc8/);
  assert.match(source, /test "\$\(findmnt -n -o SOURCE --target "\$ROOT\/data"\)" = \/dev\/sdb1/);
  assert.match(source, /PUBLIC_TREE_BEFORE/);
  assert.match(source, /execution|startAutomationAnalysisRetention/);
});
