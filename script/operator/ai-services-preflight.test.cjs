"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const preflight = require("./ai-services-preflight.cjs");

function manifest() {
  const bytes = Buffer.from("synthetic source\n");
  return { format: 1, sourceCommit: preflight.SOURCE, baseCommit: preflight.BASE,
    sourceTree: "a".repeat(40), dependenciesSha256: "b".repeat(64),
    patchSha256: preflight.hash(Buffer.from("synthetic pinned patch\n")),
    files: Array.from({ length: 56 }, (_, i) => ({ path: `server/synthetic-${i}.ts`,
      baseBlob: null, blob: preflight.blob(bytes), sha256: preflight.hash(bytes) })) };
}
test("manifest pins both source versions and rejects traversal and duplicate paths", () => {
  assert(preflight.validateManifest(manifest()));
  for (const mutate of [
    m => m.sourceCommit = "c".repeat(40), m => m.baseCommit = "d".repeat(40),
    m => m.files.pop(), m => m.files[0].path = "server/../private",
    m => m.files[0].path = "server/.env", m => m.files[0].path = "/etc/passwd",
    m => m.files[0].path = "server\\secret", m => m.files[0].path = m.files[1].path,
    m => m.files[0].baseBlob = undefined,
  ]) {
    const m = manifest(); mutate(m); assert.throws(() => preflight.validateManifest(m), /manifest_invalid/);
  }
});
test("bundle checks all source bytes and rejects additions, omissions and symlinks", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-source-bundle-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir, "sources");
  fs.mkdirSync(path.join(source, "server"), { recursive: true });
  const m = manifest();
  fs.writeFileSync(path.join(dir, "application.patch"), "synthetic pinned patch\n");
  for (const e of m.files) fs.writeFileSync(path.join(source, e.path), "synthetic source\n");
  assert.equal(preflight.verifyBundle(dir, m).verified, true);
  fs.writeFileSync(path.join(dir, "application.patch"), "changed patch");
  assert.throws(() => preflight.verifyBundle(dir, m), /bundle_patch_mismatch/);
  fs.writeFileSync(path.join(dir, "application.patch"), "synthetic pinned patch\n");
  fs.writeFileSync(path.join(source, m.files[0].path), "changed");
  assert.throws(() => preflight.verifyBundle(dir, m), /bundle_source_mismatch/);
  fs.writeFileSync(path.join(source, m.files[0].path), "synthetic source\n");
  fs.writeFileSync(path.join(source, "unexpected"), "synthetic");
  assert.throws(() => preflight.verifyBundle(dir, m), /unexpected_bundle_source/);
  fs.unlinkSync(path.join(source, "unexpected"));
  fs.unlinkSync(path.join(source, m.files[0].path));
  assert.throws(() => preflight.verifyBundle(dir, m), /bundle_source_missing/);
  fs.symlinkSync(path.join(source, m.files[1].path), path.join(source, m.files[0].path));
  assert.throws(() => preflight.verifyBundle(dir, m), /unexpected_bundle_source/);
});
test("host and privilege rejection happen before any operating-system command", () => {
  const run = () => assert.fail("No command is permitted");
  assert.throws(() => preflight.inspect(manifest(), { hostname: () => "DEVELOPMENT", uid: () => 0, run }), /wrong_host/);
  assert.throws(() => preflight.inspect(manifest(), { hostname: () => "CORPCRM01", uid: () => 1000, run }), /root_console_required/);
});
test("preflight only uses bounded metadata reads and never prints raw failures", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-source-preflight-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const calls = [];
  const run = (bin, args) => {
    calls.push([bin, args]);
    if (bin === "git" && args.includes("rev-parse")) return "e".repeat(40);
    throw new Error("sensitive-provider-data-must-not-escape");
  };
  const result = preflight.inspect(manifest(), { app: dir, hostname: () => "CORPCRM01", uid: () => 0, run });
  assert.equal(result.preparationChecksPassed, false);
  assert.equal(result.deploymentAuthorized, false); assert.equal(result.backupValidated, false);
  assert.equal(result.checks[0].code, "production_baseline_changed");
  assert.equal(result.observedHead, "e".repeat(40));
  assert(!JSON.stringify(result).includes("sensitive-provider-data"));
  assert(calls.every(([bin]) => ["git", "findmnt", "df"].includes(bin)));
  assert(!calls.flatMap(([, args]) => args).some(a => /^(checkout|reset|clean|fetch|pull|restart|start|run)$/.test(a)));
});
test("dependency fingerprint ignores scripts and key order, not dependency changes", () => {
  const a = { dependencies: { z: "1", a: "2" }, scripts: { start: "old" } };
  const b = { dependencies: { a: "2", z: "1" }, scripts: { start: "new" } };
  assert.equal(preflight.dependencyHash(a), preflight.dependencyHash(b));
  b.dependencies.z = "3";
  assert.notEqual(preflight.dependencyHash(a), preflight.dependencyHash(b));
});
test("the real standalone CLI rejects missing arguments and every apply mode", () => {
  for (const args of [[], ["--apply", preflight.SOURCE], ["--start-worker", "yes"]]) {
    const result = spawnSync(process.execPath, [require.resolve("./ai-services-preflight.cjs"), ...args], { encoding: "utf8" });
    assert.equal(result.status, 2); assert.equal(JSON.parse(result.stdout).code, "usage_invalid");
    assert.equal(result.stderr, "");
  }
});
