"use strict";
// Offline only. Host, identity and Git reads are mocked; no SSH or inference.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const source = fs.readFileSync("script/export-ai-gateway-b71.sh", "utf8");
test("B7.1 exporter pins all three portable runtime files and cannot deploy or infer", () => {
  assert.equal(spawnSync("bash", ["-n", "script/export-ai-gateway-b71.sh"]).status, 0);
  const hashes = [...source.matchAll(/^([a-f0-9]{64})  ([a-zA-Z0-9_.-]+)$/gm)];
  assert.equal(hashes.length, 3);
  for (const [, hash, name] of hashes) {
    const file = "script/" + (name === "ai_gateway_b7_core.py" ? "lib/" : "") + name;
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"), hash);
  }
  assert(!/git (?:pull|checkout|reset)|pm2|systemctl|preload\.cjs|--run-b|curl|wget/.test(source));
  assert.match(source, /if \[\[ "\$mode" == "--transfer-to-ai" \]\]; then\s+scp /);
  const child = spawnSync("bash", ["script/export-ai-gateway-b71.sh", "a".repeat(40)], { encoding: "utf8" });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /B71_EXPORT_CORPCRM01_SEMAN_ONLY/);
});
test("mocked full export is private, checksum-valid and portable without Node on AI host", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "b71-export-test-"));
  try {
    const bin = path.join(temp, "bin");
    fs.mkdirSync(bin);
    const stub = (name, text) => fs.writeFileSync(path.join(bin, name), "#!/usr/bin/env bash\n" + text, { mode: 0o700 });
    stub("id", 'echo 1001\n');
    stub("hostname", 'echo CORPCRM01\n');
    stub("stat", 'if [[ "$1" == "-c" && "$2" == "%u:%a" ]]; then echo 1001:700; else exit 2; fi\n');
    stub("git", `case "$2" in\n` +
      `*script/ai-gateway-b71.py) cat "${path.resolve("script/ai-gateway-b71.py")}";;\n` +
      `*script/ai-gateway-b7.py) cat "${path.resolve("script/ai-gateway-b7.py")}";;\n` +
      `*script/lib/ai_gateway_b7_core.py) cat "${path.resolve("script/lib/ai_gateway_b7_core.py")}";;\n` +
      `*) exit 2;;\nesac\n`);
    stub("scp", 'echo FORBIDDEN_TRANSFER >&2; exit 99\n');
    // Only replace the fixed production working directory in the test copy.
    const script = path.join(temp, "export.sh");
    fs.writeFileSync(script, source.replace("cd /var/www/indexus-crm", `cd "${temp}"`));
    const child = spawnSync("bash", [script, "a".repeat(40)], {
      env: { ...process.env, HOME: temp, PATH: bin + ":" + process.env.PATH }, encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr);
    assert(!child.stderr.includes("FORBIDDEN_TRANSFER"));
    const archive = child.stdout.match(/^B71_ARCHIVE (.+)$/m)?.[1];
    assert(archive);
    assert.equal(fs.statSync(archive).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.dirname(archive)).mode & 0o777, 0o700);
    const unpacked = path.join(temp, "unpacked");
    fs.mkdirSync(unpacked);
    assert.equal(spawnSync("tar", ["-xzf", archive, "-C", unpacked]).status, 0);
    assert.deepEqual(fs.readdirSync(unpacked).sort(),
      ["SHA256SUMS", "ai-gateway-b71.py", "ai-gateway-b7.py", "ai_gateway_b7_core.py"].sort());
    assert.equal(spawnSync("sha256sum", ["-c", "SHA256SUMS"], { cwd: unpacked }).status, 0);
    const cli = spawnSync("python3", ["ai-gateway-b71.py", "--run-b71", "--previous-run", "/not-used"], {
      cwd: unpacked, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }, encoding: "utf8",
    });
    assert.equal(cli.status, 1);
    assert.match(cli.stderr, /B71_AI_SERVER_ONLY/); // Imports resolved; no request sent.
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
