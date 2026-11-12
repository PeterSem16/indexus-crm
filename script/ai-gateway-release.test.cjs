"use strict";
// Release-level checks are intentionally OUTSIDE the seven-file rollback bundle.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const cp = require("node:child_process");
const P = require("./lib/ai-gateway-policy.cjs");
const helper = require("./ai-gateway-production.cjs");

test("the exact seven-file rollback bundle runs its complete tests without checkout-only dependencies", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gateway-bundle-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(helper.SOURCES.length, 7);
  for (const name of helper.SOURCES) {
    const destination = path.join(root, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(__dirname, "..", name), destination);
  }
  assert.equal(fs.existsSync(path.join(root, "script/ai-gateway-preflight-console.sh")), false);
  const result = cp.spawnSync(process.execPath, ["--test",
    path.join(root, "script/ai-gateway-production.test.cjs"),
    path.join(root, "script/ai-gateway-preflight.test.cjs")], {
    cwd: root, encoding: "utf8", timeout: 60000, maxBuffer: 2 * 1024 * 1024,
    env: { PATH: process.env.PATH, HOME: root, NODE_ENV: "test" },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /# fail 0/);
  assert.match(result.stdout, /# skipped 0/);
});

test("console launcher accepts only read-only modes and forwards exact backup paths to root staging", t => {
  const launcher = path.join(__dirname, "ai-gateway-preflight-console.sh");
  const tools = fs.mkdtempSync(path.join(os.tmpdir(), "gateway-launcher-test-"));
  t.after(() => fs.rmSync(tools, { recursive: true, force: true }));
  const capture = path.join(tools, "capture"), pin = "a".repeat(40);
  fs.writeFileSync(path.join(tools, "id"), "#!/bin/bash\nif [[ \"$1\" == -un ]]; then echo seman; else /usr/bin/id \"$@\"; fi\n", { mode: 0o700 });
  fs.writeFileSync(path.join(tools, "git"), "#!/bin/bash\nif [[ \"$3\" == -c && \"$4\" == core.hooksPath=/dev/null && \"$5\" == checkout ]]; then exit 0; fi\n[[ \"$3\" == rev-parse && \"$4\" == FETCH_HEAD ]] || exit 91\nprintf '%s\\n' \"$PREFLIGHT_REV\"\n", { mode: 0o700 });
  fs.writeFileSync(path.join(tools, "sudo"), "#!/bin/bash\n[[ \"$1\" != -v ]] || exit 0\nprintf '%s\\n' \"$@\" > \"$CAPTURE.args\"\ncat > \"$CAPTURE.stdin\"\n", { mode: 0o700 });
  for (const mode of ["preflight", "verify-rollback", "inspect-attempt", "apply", "--apply"]) {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), "indexus-gateway-source."));
    t.after(() => fs.rmSync(src, { recursive: true, force: true }));
    for (const ext of [".args", ".stdin"]) fs.rmSync(capture + ext, { force: true });
    const backup = P.C.backupRoot + "/attempt-exact", baseline = P.C.backupRoot + "/attempt-original";
    const r = cp.spawnSync("bash", [launcher], {
      encoding: "utf8", env: { PATH: tools + ":" + process.env.PATH,
        CAPTURE: capture, PREFLIGHT_REV: pin, PREFLIGHT_SOURCE: src,
        PREFLIGHT_MODE: mode, PREFLIGHT_BACKUP: backup, PREFLIGHT_BASELINE_BACKUP: baseline },
    });
    if (mode === "apply" || mode === "--apply") {
      assert.equal(r.status, 1); assert.match(r.stdout, /readOnlyModeOrBackup/);
      assert.equal(fs.existsSync(capture + ".args"), false);
    } else {
      assert.equal(r.status, 0, r.stderr);
      const argv = fs.readFileSync(capture + ".args", "utf8").trim().split("\n");
      assert.deepEqual(argv.slice(-4), [src, mode, backup, baseline]);
      const script = fs.readFileSync(capture + ".stdin", "utf8");
      assert.match(script, /--verify-rollback "\$BACKUP"/);
      assert.match(script, /--inspect-attempt "\$BACKUP" "\$BASELINE"/);
      assert.doesNotMatch(script, /--apply|--rollback |restart all/);
      for (const [, expected, name] of script.matchAll(/^([a-f0-9]{64})  ([^\n]+)$/gm))
        assert.equal(P.hash(fs.readFileSync(path.join(__dirname, "..", name))), expected, name);
    }
  }
});
