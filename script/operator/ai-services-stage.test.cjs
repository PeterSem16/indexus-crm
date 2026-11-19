"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { validateManifest, dependencyHash } = require("./ai-services-stage.cjs");
const file = require.resolve("./ai-services-stage.cjs");
function fixture() {
  return { format: 2, productionBase: "0ee328b123a33014fab7380210ac7ee158b14085",
    sourceCommit: "a".repeat(40), sourceTree: "b".repeat(40), dependenciesSha256: "c".repeat(64),
    loaderSha256: "d".repeat(64),
    runtime: { "dist/index.cjs": "e".repeat(64), "dist/public/index.html": "f".repeat(64) },
    files: Array.from({ length: 70 }, (_, i) => ({ path: `server/synthetic-${i}.ts`,
      baseSha256: null, sha256: "1".repeat(64) })) };
}
test("only the observed production base and bounded source scope are accepted", () => {
  assert(validateManifest(fixture()));
  for (const mutate of [
    m => m.productionBase = "a".repeat(40), m => m.sourceCommit = "HEAD",
    m => m.files.length = 0, m => m.files[0].path = "server/../private",
    m => m.files[0].path = "server/.env", m => m.files[0].path = "/etc/passwd",
    m => m.files[0].path = "server\\secret", m => m.files[1].path = m.files[0].path,
    m => m.files[0].baseSha256 = undefined, m => m.runtime = {},
    m => m.loaderSha256 = "unknown", m => m.runtime["dist/index.cjs"] = "unknown",
  ]) {
    const m = fixture(); mutate(m);
    assert.throws(() => validateManifest(m), /manifest_/);
  }
});
test("standalone entry rejects deployment and worker-start modes", () => {
  for (const args of [[], ["--apply", "unused"], ["--start-worker", "unused"]]) {
    const r = spawnSync(process.execPath, [file, ...args], { encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.equal(r.stderr, "");
    assert.equal(JSON.parse(r.stdout).code, "usage_prepare_only");
    assert.equal(JSON.parse(r.stdout).liveApplicationChanged, false);
  }
});
test("dependency identity ignores script ordering but rejects any package version change", () => {
  const a = { dependencies: { a: "1", b: "2" }, scripts: { build: "old" } };
  const b = { dependencies: { b: "2", a: "1" }, scripts: { build: "new" } };
  assert.equal(dependencyHash(a), dependencyHash(b));
  b.dependencies.a = "3";
  assert.notEqual(dependencyHash(a), dependencyHash(b));
});
test("operator has no database, network, deployment or PM2 execution path", () => {
  const source = fs.readFileSync(file, "utf8");
  assert(!/\brequire\(["'](?:pg|https?|dotenv)["']\)/.test(source));
  assert(!/\b(?:fetch|execSync)\s*\(/.test(source));
  assert(!/run\(["'](?:pm2|npm|psql|curl|ssh)["']/.test(source));
  assert(!/["'](?:reset|checkout|clean|pull|restart|db:push)["']/.test(source));
  assert(source.includes('fs.mkdtempSync(DATA + "/ai-services-stage-")'));
  assert(source.includes("fs.chmodSync(work, 0o700)"));
  assert(source.includes('phase = "build"'));
  assert(source.includes('phase = "final_checks"'));
  assert(source.includes("baseline(m);"));
});
