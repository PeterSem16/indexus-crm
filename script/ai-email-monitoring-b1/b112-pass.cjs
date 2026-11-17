"use strict";
// A second, explicitly authorized run; never remove/reset the original marker.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
function fileSnapshot(file, uid) {
  let current = path.parse(path.resolve(file)).root;
  for (const segment of path.resolve(file).slice(current.length).split(path.sep)) {
    current = path.join(current, segment);
    if (fs.lstatSync(current).isSymbolicLink()) throw Error("B112_PRIOR_SYMLINK_REFUSED");
  }
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.uid !== uid || st.mode & 0o077 || st.size > 1024 * 1024)
    throw Error("B112_PRIOR_FILE_UNSAFE");
  const bytes = fs.readFileSync(file);
  return { file, sha256: hash(bytes), data: JSON.parse(bytes.toString("utf8")) };
}
function selectPass(home, gatewaySha, uid = process.getuid()) {
  if (!gatewaySha) return { id: "ORIGINAL_B112_SEVEN", marker: "B112-seven.started",
    prefix: "B112-run-", prior: null, assertUnchanged() {} };
  if (!/^[a-f0-9]{64}$/.test(gatewaySha) ||
      gatewaySha === "406d1adf3b415d5cf3efbbaf2b9bb7eb8ae545811b7def0db63475c7a8345b6b")
    throw Error("B112_NEW_GATEWAY_HASH_REQUIRED");
  const marker = fileSnapshot(path.join(home, "B112-seven.started"), uid);
  const out = marker.data.out;
  if (typeof out !== "string" || path.dirname(out) !== home || !/^B112-run-[\w-]+$/.test(path.basename(out)))
    throw Error("B112_PRIOR_OUTPUT_PATH_UNSAFE");
  const evidence = fileSnapshot(path.join(out, "B112_evidence.json"), uid);
  const old = evidence.data, first = old.rows?.[0]?.execution;
  if (old.verdict !== "NOT_READY" || old.inferenceAttempts !== 1 || old.complete !== false ||
      old.rows?.length !== 1 || old.candidateDeployed !== true ||
      old.error !== "B112_INTEGRATION_CASE_FAILED" || first?.error !== "B12_SEMANTIC_MISMATCH" ||
      first.result?.wantsToCancel !== true || first.result?.alertLevel !== "warning" ||
      old.after?.gatewayEnabled !== false || old.after?.openai !== 65 || old.after?.internal !== 0 ||
      !/^[a-f0-9]{64}$/.test(old.after?.fullConfigurationSha256 ?? ""))
    throw Error("B112_PRIOR_FAILURE_DIFFERS_REVIEW_REQUIRED");
  const prior = { markerFile: marker.file, markerSha256: marker.sha256,
    evidenceFile: evidence.file, evidenceSha256: evidence.sha256,
    verdict: old.verdict, inferenceAttempts: old.inferenceAttempts,
    fullConfigurationSha256: old.after.fullConfigurationSha256 };
  return { id: "EXPLICIT_B112_SYSTEM_GATEWAY", marker: "B112-explicit-system-seven.started",
    prefix: "B112-explicit-system-run-", gatewaySourceSha256OperatorAttested: gatewaySha, prior,
    assertUnchanged() {
      for (const original of [marker, evidence]) {
        if (fileSnapshot(original.file, uid).sha256 !== original.sha256)
          throw Error("B112_PRIOR_EVIDENCE_CHANGED");
      }
    } };
}
function selectFinalPass(home, uid = process.getuid(), repeat = false) {
  const originals = [];
  const runs = [
    ["B112-seven.started", "B112-run-"],
    ["B112-explicit-system-seven.started", "B112-explicit-system-run-"],
  ];
  if (repeat) runs.push(["Email-monitoring-final-seven.started", "Email-monitoring-final-run-"]);
  for (const [markerName, prefix] of runs) {
    const marker = fileSnapshot(path.join(home, markerName), uid);
    const out = marker.data.out;
    if (typeof out !== "string" || path.dirname(out) !== home ||
        !path.basename(out).startsWith(prefix) || !/^[\w-]+$/.test(path.basename(out)))
      throw Error("B112_PRIOR_OUTPUT_PATH_UNSAFE");
    const evidence = fileSnapshot(path.join(out, "B112_evidence.json"), uid);
    originals.push(marker, evidence);
  }
  const previous = originals[originals.length - 1].data;
  if (previous.after?.gatewayEnabled !== false || previous.after?.openai !== 65 ||
      previous.after?.internal !== 0 ||
      !/^[a-f0-9]{64}$/.test(previous.after?.fullConfigurationSha256 ?? ""))
    throw Error("B112_PRIOR_CONFIGURATION_UNVERIFIED");
  return {
    id: repeat ? "EXPLICITLY_AUTHORIZED_REPEAT_SAME_SEVEN" : "FINAL_CURRENT_MODEL_SEVEN",
    marker: repeat ? "Email-monitoring-repeat-seven.started" : "Email-monitoring-final-seven.started",
    prefix: repeat ? "Email-monitoring-repeat-run-" : "Email-monitoring-final-run-",
    prior: { fullConfigurationSha256: previous.after.fullConfigurationSha256,
      preserved: originals.map(({ file, sha256 }) => ({ file, sha256 })) },
    assertUnchanged() {
      for (const original of originals)
        if (fileSnapshot(original.file, uid).sha256 !== original.sha256)
          throw Error("B112_PRIOR_EVIDENCE_CHANGED");
    },
  };
}
module.exports = { selectPass, selectFinalPass };
