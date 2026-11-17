"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { selectPass, selectFinalPass } = require("./b112-pass.cjs");
const gatewaySha = "b".repeat(64);
function fixture(run) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "INDEXUS-B112-pass-"));
  const out = path.join(home, "B112-run-fixture");
  fs.mkdirSync(out, { mode: 0o700 });
  const marker = path.join(home, "B112-seven.started"), evidence = path.join(out, "B112_evidence.json");
  const prior = { verdict: "NOT_READY", inferenceAttempts: 1, complete: false, candidateDeployed: true,
    error: "B112_INTEGRATION_CASE_FAILED", after: { gatewayEnabled: false, openai: 65, internal: 0,
      fullConfigurationSha256: "a".repeat(64) },
    rows: [{ execution: { error: "B12_SEMANTIC_MISMATCH", result: { wantsToCancel: true, alertLevel: "warning" } } }] };
  const write = () => fs.writeFileSync(evidence, JSON.stringify(prior), { mode: 0o600 });
  fs.writeFileSync(marker, JSON.stringify({ out }), { mode: 0o600 }); write();
  try { run({ home, out, marker, evidence, prior, write }); }
  finally { fs.rmSync(home, { recursive: true, force: true }); }
}
test("original invocation keeps the original one-shot marker", () => {
  const pass = selectPass("/does-not-need-to-exist");
  assert.equal(pass.marker, "B112-seven.started"); assert.equal(pass.prior, null);
});
test("authorized second pass preserves the original marker and evidence bytes", () => fixture(f => {
  const before = [f.marker, f.evidence].map(p => fs.readFileSync(p));
  const pass = selectPass(f.home, gatewaySha);
  assert.equal(pass.marker, "B112-explicit-system-seven.started");
  assert.equal(pass.prefix, "B112-explicit-system-run-");
  assert.equal(pass.gatewaySourceSha256OperatorAttested, gatewaySha);
  pass.assertUnchanged();
  [f.marker, f.evidence].forEach((p, i) => assert.deepEqual(fs.readFileSync(p), before[i]));
}));
test("rejects absent or non-new operator-attested Gateway hashes", () => {
  for (const sha of ["bad", "406d1adf3b415d5cf3efbbaf2b9bb7eb8ae545811b7def0db63475c7a8345b6b"])
    assert.throws(() => selectPass("/unused", sha), /B112_NEW_GATEWAY_HASH_REQUIRED/);
});
test("refuses a completed old pass rather than pretending it was the failed attempt", () => fixture(f => {
  f.prior.complete = true; f.write();
  assert.throws(() => selectPass(f.home, gatewaySha), /B112_PRIOR_FAILURE_DIFFERS/);
}));
test("refuses changed error, deployed state, configuration or inference count", () => {
  for (const field of ["error", "candidateDeployed", "inferenceAttempts", "after"]) fixture(f => {
    f.prior[field] = null; f.write();
    assert.throws(() => selectPass(f.home, gatewaySha), /B112_PRIOR_FAILURE_DIFFERS/);
  });
});
test("refuses prior marker paths outside the private pilot directory", () => fixture(f => {
  fs.writeFileSync(f.marker, JSON.stringify({ out: "/tmp/B112-run-other" }));
  assert.throws(() => selectPass(f.home, gatewaySha), /B112_PRIOR_OUTPUT_PATH_UNSAFE/);
}));
test("refuses symlinked prior evidence", () => fixture(f => {
  const other = path.join(f.out, "other.json"); fs.renameSync(f.evidence, other); fs.symlinkSync(other, f.evidence);
  assert.throws(() => selectPass(f.home, gatewaySha), /B112_PRIOR_SYMLINK_REFUSED/);
}));
test("refuses public-readable prior evidence", () => fixture(f => {
  fs.chmodSync(f.evidence, 0o644);
  assert.throws(() => selectPass(f.home, gatewaySha), /B112_PRIOR_FILE_UNSAFE/);
}));
test("detects subsequent changes to the original evidence", () => fixture(f => {
  const pass = selectPass(f.home, gatewaySha); f.prior.rows[0].execution.result.alertLevel = "critical"; f.write();
  assert.throws(() => pass.assertUnchanged(), /B112_PRIOR_EVIDENCE_CHANGED/);
}));
test("detects subsequent changes to the original marker", () => fixture(f => {
  const pass = selectPass(f.home, gatewaySha); fs.writeFileSync(f.marker, JSON.stringify({ out: f.out, changed: true }));
  assert.throws(() => pass.assertUnchanged(), /B112_PRIOR_EVIDENCE_CHANGED/);
}));
function finalFixture(run) {
  fixture(f => {
    const out = path.join(f.home, "B112-explicit-system-run-fixture");
    fs.mkdirSync(out, { mode: 0o700 });
    const secondMarker = path.join(f.home, "B112-explicit-system-seven.started");
    const secondEvidence = path.join(out, "B112_evidence.json");
    fs.writeFileSync(secondMarker, JSON.stringify({ out }), { mode: 0o600 });
    fs.writeFileSync(secondEvidence, JSON.stringify(f.prior), { mode: 0o600 });
    run({ ...f, secondMarker, secondEvidence });
  });
}
test("final run uses a distinct marker, preserves BOTH prior runs and does not assume a Gateway hash", () =>
  finalFixture(f => {
    const pass = selectFinalPass(f.home);
    assert.equal(pass.marker, "Email-monitoring-final-seven.started");
    assert.equal(pass.prior.preserved.length, 4);
    assert.equal(pass.gatewaySourceSha256OperatorAttested, undefined);
    pass.assertUnchanged();
    fs.appendFileSync(f.secondEvidence, "\n");
    assert.throws(() => pass.assertUnchanged(), /B112_PRIOR_EVIDENCE_CHANGED/);
  }));
test("final run refuses missing prior evidence without touching the original", () => finalFixture(f => {
  fs.unlinkSync(f.secondEvidence);
  assert.throws(() => selectFinalPass(f.home));
  assert.equal(selectPass(f.home, gatewaySha).marker, "B112-explicit-system-seven.started");
}));
test("final run refuses unverified prior production configuration", () => finalFixture(f => {
  fs.writeFileSync(f.secondEvidence, JSON.stringify({ after: { gatewayEnabled: true } }));
  assert.throws(() => selectFinalPass(f.home), /B112_PRIOR_CONFIGURATION_UNVERIFIED/);
}));
function repeatFixture(run) {
  finalFixture(f => {
    const out = path.join(f.home, "Email-monitoring-final-run-fixture");
    fs.mkdirSync(out, { mode: 0o700 });
    const finalMarker = path.join(f.home, "Email-monitoring-final-seven.started");
    const finalEvidence = path.join(out, "B112_evidence.json");
    fs.writeFileSync(finalMarker, JSON.stringify({ out }), { mode: 0o600 });
    fs.writeFileSync(finalEvidence, JSON.stringify(f.prior), { mode: 0o600 });
    run({ ...f, finalMarker, finalEvidence });
  });
}
test("authorized repeat preserves all THREE prior runs and uses its own one-shot marker", () => repeatFixture(f => {
  const pass = selectFinalPass(f.home, process.getuid(), true);
  assert.equal(pass.id, "EXPLICITLY_AUTHORIZED_REPEAT_SAME_SEVEN");
  assert.equal(pass.marker, "Email-monitoring-repeat-seven.started");
  assert.equal(pass.prefix, "Email-monitoring-repeat-run-");
  assert.equal(pass.prior.preserved.length, 6);
  pass.assertUnchanged();
  fs.appendFileSync(f.finalEvidence, "\n");
  assert.throws(() => pass.assertUnchanged(), /B112_PRIOR_EVIDENCE_CHANGED/);
}));
test("repeat refuses missing final evidence and changed latest production configuration", () => repeatFixture(f => {
  fs.writeFileSync(f.finalEvidence, JSON.stringify({ after: { gatewayEnabled: true } }));
  assert.throws(() => selectFinalPass(f.home, process.getuid(), true), /B112_PRIOR_CONFIGURATION_UNVERIFIED/);
  fs.unlinkSync(f.finalEvidence);
  assert.throws(() => selectFinalPass(f.home, process.getuid(), true));
}));
function deployedFixFixture(run) {
  repeatFixture(f => {
    const out = path.join(f.home, "Email-monitoring-repeat-run-fixture");
    fs.mkdirSync(out, { mode: 0o700 });
    const repeatMarker = path.join(f.home, "Email-monitoring-repeat-seven.started");
    const repeatEvidence = path.join(out, "B112_evidence.json");
    fs.writeFileSync(repeatMarker, JSON.stringify({ out }), { mode: 0o600 });
    fs.writeFileSync(repeatEvidence, JSON.stringify(f.prior), { mode: 0o600 });
    run({ ...f, repeatMarker, repeatEvidence });
  });
}
test("deployed-fix verification preserves all FOUR prior runs and has a distinct marker", () => deployedFixFixture(f => {
  const pass = selectFinalPass(f.home, process.getuid(), false, true);
  assert.equal(pass.id, "VERIFY_OPERATOR_REPORTED_DEPLOYED_FIX");
  assert.equal(pass.marker, "Email-monitoring-deployed-fix-seven.started");
  assert.equal(pass.prefix, "Email-monitoring-deployed-fix-run-");
  assert.equal(pass.prior.preserved.length, 8);
  pass.assertUnchanged();
  fs.appendFileSync(f.repeatEvidence, "\n");
  assert.throws(() => pass.assertUnchanged(), /B112_PRIOR_EVIDENCE_CHANGED/);
}));
test("deployed-fix verification refuses missing or unsafe latest evidence", () => deployedFixFixture(f => {
  fs.chmodSync(f.repeatEvidence, 0o644);
  assert.throws(() => selectFinalPass(f.home, process.getuid(), false, true), /B112_PRIOR_FILE_UNSAFE/);
  fs.unlinkSync(f.repeatEvidence);
  assert.throws(() => selectFinalPass(f.home, process.getuid(), false, true));
}));
test("deployed-fix verification checks the latest configuration, not an older successful snapshot", () =>
  deployedFixFixture(f => {
    fs.writeFileSync(f.repeatEvidence, JSON.stringify({ after: { gatewayEnabled: true } }));
    assert.throws(() => selectFinalPass(f.home, process.getuid(), false, true), /B112_PRIOR_CONFIGURATION_UNVERIFIED/);
  }));
function presentTenseFixture(run) {
  deployedFixFixture(f => {
    const out = path.join(f.home, "Email-monitoring-deployed-fix-run-fixture");
    fs.mkdirSync(out, { mode: 0o700 });
    const fixMarker = path.join(f.home, "Email-monitoring-deployed-fix-seven.started");
    const fixEvidence = path.join(out, "B112_evidence.json");
    fs.writeFileSync(fixMarker, JSON.stringify({ out }), { mode: 0o600 });
    fs.writeFileSync(fixEvidence, JSON.stringify(f.prior), { mode: 0o600 });
    run({ ...f, fixMarker, fixEvidence });
  });
}
test("present-tense check preserves all FIVE prior runs without resetting any marker", () => presentTenseFixture(f => {
  const pass = selectFinalPass(f.home, process.getuid(), false, false, true);
  assert.equal(pass.id, "VERIFY_OPERATOR_REPORTED_PRESENT_TENSE_FIX");
  assert.equal(pass.marker, "Email-monitoring-present-tense-seven.started");
  assert.equal(pass.prefix, "Email-monitoring-present-tense-run-");
  assert.equal(pass.prior.preserved.length, 10);
  pass.assertUnchanged();
  fs.appendFileSync(f.fixEvidence, "\n");
  assert.throws(() => pass.assertUnchanged(), /B112_PRIOR_EVIDENCE_CHANGED/);
}));
test("present-tense check requires safe latest evidence", () => presentTenseFixture(f => {
  fs.chmodSync(f.fixEvidence, 0o644);
  assert.throws(() => selectFinalPass(f.home, process.getuid(), false, false, true), /B112_PRIOR_FILE_UNSAFE/);
  fs.unlinkSync(f.fixEvidence);
  assert.throws(() => selectFinalPass(f.home, process.getuid(), false, false, true));
}));
test("present-tense check uses the latest production snapshot", () => presentTenseFixture(f => {
  fs.writeFileSync(f.fixEvidence, JSON.stringify({ after: { gatewayEnabled: true } }));
  assert.throws(() => selectFinalPass(f.home, process.getuid(), false, false, true), /B112_PRIOR_CONFIGURATION_UNVERIFIED/);
}));
