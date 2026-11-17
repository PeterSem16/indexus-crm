const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readResume, claimRun } = require("./b18-state.cjs");
test("private resume blocks a live process, unsafe files and duplicate ownership without modifying evidence", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "B18-resume-"));
  const file = path.join(home, "B18_evidence_final.json"), marker = path.join(home, "B18-batch.started");
  const uid = process.getuid();
  const text = JSON.stringify({ executionProcess: { pid: 1234 }, complete: false });
  fs.writeFileSync(file, text, { mode: 0o600 });
  try {
    assert.throws(() => readResume(file, { home, uid, alive: () => true }), /STILL_RUNNING/);
    const resumed = readResume(file, { home, uid, alive: () => false });
    claimRun(marker, null, uid);
    assert.throws(() => claimRun(marker, null, uid), /ALREADY_STARTED/);
    claimRun(marker, resumed, uid);
    assert.throws(() => claimRun(marker, resumed, uid), /ALREADY_STARTED/);
    assert.equal(fs.readFileSync(file, "utf8"), text);
    fs.chmodSync(file, 0o644);
    assert.throws(() => readResume(file, { home, uid, alive: () => false }), /UNSAFE/);
    fs.chmodSync(file, 0o600);
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "B18-outside-"));
    try { assert.throws(() => readResume(file, { home: outside, uid, alive: () => false }), /UNSAFE/); }
    finally { fs.rmSync(outside, { recursive: true, force: true }); }
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
