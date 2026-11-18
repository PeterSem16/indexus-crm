// Offline preparation only: no production connection, SQL, restart, deploy or AI request.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");

const IMPLEMENTATION = "1e80ffa816ece4465c39b42a31ab7a7515dad59f";
const OWNED = {
  "server/lib/email-note-jobs-client.ts": "176b5aa1fdb7ecb7b9ae991966843566ed3e9867",
  "server/lib/email-note-jobs-schema.ts": "fb8365d3da407605937fce4980c284457671410f",
  "server/lib/email-note-jobs-service.ts": "f3156f1273d591ccd6de414b4ae0de0e21b5880c",
  "server/lib/email-note-jobs-routes.ts": "5632686e0b5638c1a66356e043085a0d8e9386ef",
  "server/lib/email-note-jobs-runtime.ts": "9e04e6f7da126a16bd130c35ee9491e9d3f8a2f2",
  "client/src/components/nexus/EmailNoteDraft.tsx": "7acfc52c89cc7a073b681387870f448a5afe5e35",
  "client/src/i18n/email-note-draft-copy.ts": "8c77eab30cd37e629986d7721c0303cd3f614c9b",
};
const HOOKS = ["client/src/i18n/translations.ts", "client/src/pages/email-client.tsx",
  "server/index.ts", "server/routes.ts", "shared/schema.ts"];
const PATCH_SHA256 = "8c46d28c600b65c9780215f71a29a1feef5ebebac818fb27d1a49089ec83696e";
const sha256 = data => crypto.createHash("sha256").update(data).digest("hex");
const blob = data => crypto.createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");

function verifyHookPatch(patch) {
  assert.equal(sha256(patch), PATCH_SHA256, "Shared hook patch must match the reviewed implementation");
  assert.deepEqual([...patch.matchAll(/^diff --git a\/(.+) b\/\1$/gm)].map(m => m[1]), HOOKS);
}
function prepare() {
  const evidenceDir = "generated-artifacts/email-notes-crm-ui";
  const reportPath = path.join(evidenceDir, "report.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.crm_integration, "PASS");
  assert.equal(report.ui, "PASS");
  assert.equal(report.production_changed, false);
  assert.equal(report.external_ai_calls, 0);
  const testedAt = fs.statSync(reportPath).mtimeMs;
  for (const [file, expected] of Object.entries(OWNED)) {
    assert.equal(blob(fs.readFileSync(file)), expected, `Unreviewed change in ${file}`);
    assert.ok(fs.statSync(file).mtimeMs <= testedAt, `Re-run acceptance after changing ${file}`);
  }
  let patch;
  try {
    patch = execFileSync("git", ["--no-optional-locks", "diff", "--no-ext-diff", "--no-textconv", "--no-color",
      `${IMPLEMENTATION}^`, IMPLEMENTATION, "--", ...HOOKS],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/^index [^\n]*\n/gm, "");
  } catch {
    // Verified GitHub commit API export is accepted when this workspace lacks
    // the historical Git object. Its exact bytes are pinned, never trusted blindly.
    patch = fs.readFileSync(path.join(evidenceDir, "shared-hooks.patch"), "utf8");
  }
  verifyHookPatch(patch);
  for (const file of HOOKS) {
    const source = fs.readFileSync(file, "utf8");
    const section = patch.split(`+++ b/${file}\n`)[1].split("\ndiff --git ")[0];
    for (const line of section.split("\n").filter(l => l.startsWith("+") && !l.startsWith("+++"))) {
      if (line.slice(1).trim()) assert.ok(source.includes(line.slice(1).trim()), `Missing tested integration in ${file}`);
    }
    assert.ok(fs.statSync(file).mtimeMs <= testedAt, `Re-run acceptance after changing ${file}`);
  }
  const out = path.resolve("generated-artifacts/email-notes-release");
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  assert.equal(fs.lstatSync(out).isSymbolicLink(), false);
  for (const file of Object.keys(OWNED)) {
    const dest = path.join(out, "feature-owned", file);
    fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
    fs.writeFileSync(dest, fs.readFileSync(file), { mode: 0o600 });
  }
  fs.writeFileSync(path.join(out, "shared-hooks.patch"), patch, { mode: 0o600 });
  const manifest = {
    readiness: "READY_FOR_APPROVED_FLAG_OFF_DEPLOYMENT",
    implementation_commit: IMPLEMENTATION, feature_owned_git_blobs: OWNED,
    shared_hooks: HOOKS, shared_hook_patch_sha256: PATCH_SHA256,
    required_flag: "INDEXUS_AI_EMAIL_NOTES_ENABLED=false",
    crm_integration: report.crm_integration, ui: report.ui,
    evidence_sha256: sha256(fs.readFileSync(reportPath)),
    promotion_performed: false, production_sql_performed: false, restart_performed: false,
    deployment_boundary: "Feature-owned files plus reviewed hook hunks only; never the entire workspace branch.",
    rollback: "Retain notes/audit tables; restore previous approved build with flag off. Restart only after explicit approval.",
  };
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  return manifest;
}
module.exports = { OWNED, HOOKS, PATCH_SHA256, verifyHookPatch, prepare };
if (require.main === module) {
  try { console.log(JSON.stringify(prepare(), null, 2)); }
  catch (error) { console.error("NOT_READY: " + error.message); process.exitCode = 1; }
}
