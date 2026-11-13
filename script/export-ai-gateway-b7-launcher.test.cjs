"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
test("B7 transfer launcher validates every pinned dependency and cannot deploy or run inference", () => {
  const filename = "script/export-ai-gateway-b7.sh";
  const source = fs.readFileSync(filename, "utf8");
  assert.equal(spawnSync("bash", ["-n", filename]).status, 0);
  const pin = source.match(/^pin=([a-f0-9]{40})$/m)?.[1];
  assert(pin);
  const hashes = [...source.matchAll(/^([a-f0-9]{64})  ([a-zA-Z0-9_./-]+)$/gm)];
  assert.equal(hashes.length, 9);
  const loop = source.match(/for file in ([\s\S]+?); do/)[1].replace(/\\\n/g, " ");
  assert.deepEqual(loop.trim().split(/\s+/).sort(), hashes.map(m => m[2]).sort());
  for (const [, expected, file] of hashes) {
    const pinned = spawnSync("git", ["show", `${pin}:script/${file}`]);
    assert.equal(pinned.status, 0);
    assert.equal(crypto.createHash("sha256").update(pinned.stdout).digest("hex"), expected);
    assert.deepEqual(pinned.stdout, fs.readFileSync(`script/${file}`));
  }
  assert.match(source, /node "\$work\/export-ai-gateway-b7\.cjs" --export-b7/);
  assert(!/git (?:pull|checkout|reset)|pm2|systemctl|preload\.cjs|--run-b[4567]|curl|wget/.test(source));
  const child = spawnSync("bash", [filename], { encoding: "utf8" });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /B7_EXPORT_(RUN_AS_SEMAN|CORPCRM01_ONLY)/);
});
