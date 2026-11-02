#!/usr/bin/env node
// One explicitly approved, pinned release. No backup and no database restore.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const TARGET = "3e6529b6e63fa7c1e20870072de2562a54af5ba2";
const LEGACY_PATH = "script/operator/promote-mission-exports-no-backup.cjs";
const LEGACY_HASH = "28e5a7158e96a8cadcd874c45afe67e91767b845950f2c489eb192488841e980";
const PLANS = [
  { base: "82e76f45fbae8482f4c047787859b6f963e14c80", commits: 16, fileCount: 65, patchHash: "fbdee5a2d851b7ccc10d4aa61f8596f551718403b1970c6b4ebb475890d567d1" },
  { base: "0c6aed47d54c763159d3beaf1974d65212500119", commits: 11, fileCount: 58, patchHash: "66b037c8a9d0af85c06951bcc82493ae7e51930230148bf69b2f6c10103b5051" },
  { base: "35d3a76cafd5e4dab9fae917267ce0d9d5ab7cec", commits: 10, fileCount: 56, patchHash: "65ba8ffa41fdaed496132ef08c98242f4ee040bd3ef3951a3f5e07b65121b5a2" },
  { base: "ead18c105547d26f4ec1a0c389811311f6e8903b", commits: 9, fileCount: 54, patchHash: "def689c09293909d3e1123a918699c676e75721b16ba546c574e3d451b09a338" },
  { base: "eaa97de0b0b5c7a4791af62ef98c711f258020b8", commits: 8, fileCount: 46, patchHash: "aa6ee1dcb866c0ded04ab3c00f403d768bddf8601403aafd6cd2bbdf05ebae29" },
  { base: "2725b550929240b7c1449e681184c8dde0b954b7", commits: 7, fileCount: 44, patchHash: "3cb0bd01963d279244d6605c867049587eb22df00542bbdec5bd34bfb96105d7" },
  { base: "c0e76a677dc3e497f358c2573b4ff09b0adca200", commits: 6, fileCount: 32, patchHash: "c9826b33ce349cfa860ebd594389c48e52a784e68a336c674eb7eacaff76f160" },
  { base: "6d88da124cd318f2c22ad6b342b3f5d6f47de7ff", commits: 5, fileCount: 30, patchHash: "74e05e2e465b7104b96b8f30984c4f21bbfd7d598deffdde5b50af8886d06a9c" },
  { base: "d1ca44bd1ddcf9996029c8b88cdc7a19938b6561", commits: 4, fileCount: 20, patchHash: "0eb59c8eea48aee7705341fbedfa6427dad89a21e20dfcda456c6f82f37965fa" },
  { base: "79e0f6d0ba29ce9df4e77f165edb51d3242fd6f5", commits: 3, fileCount: 18, patchHash: "aa3eea1772ff26871252370aa2be8577723af64295c80a4a18f8ce475c3c7de6" },
  { base: "5859699c052cdfcf62d2686190cfc15b7e3096a1", commits: 2, fileCount: 13, patchHash: "23adcd7feb86890911584e27695cba253a423d8d2983aaf1efb282a8b5259957" },
  { base: "73a896ab60077c1d8afa8bfe4bb7c61d86bad5a0", commits: 1, fileCount: 11, patchHash: "63c2ee4cf80e06271bd608c41a293c252f508261032d1e412576ff78bc739a0e" },
];
const EXTRA_PATHS = [
  ".local/tsconfig-mission-email.json",
  "client/src/components/campaigns/MissionEmailSchedules.tsx",
  "client/src/components/campaigns/MissionEmailRecipientPicker.tsx",
  "client/src/components/campaigns/mission-email-extras-translations.ts",
  "client/src/components/campaigns/mission-email-panel-translations.ts",
  "client/src/components/campaigns/mission-email-schedule-translations.ts",
  "e2e/mission-email-schedules.spec.ts",
  "server/index.ts",
  "server/routes.ts",
  "server/scheduled-report-runner.ts",
  "shared/schema.ts",
  "server/lib/mission-email-content.test.ts",
  "server/lib/mission-email-content.ts",
  "server/lib/mission-email-excel.ts",
  "server/lib/mission-email-excel.test.ts",
  "server/lib/mission-email-sender.test.ts",
  "server/lib/mission-email-schedule-routes.test.ts",
  "server/lib/mission-email-schedule-routes.ts",
  "server/lib/mission-email-scheduler.test.ts",
  "server/lib/mission-email-scheduler.ts",
  "server/lib/mission-email-schema.ts",
  "server/lib/mission-report-sources.ts",
  "shared/mission-email-schedule.test.ts",
  "shared/mission-email-schedule.ts",
  LEGACY_PATH,
  "script/operator/promote-mission-exports-no-backup.test.cjs",
  "script/operator/promote-mission-emails-no-backup.cjs",
  "script/operator/promote-mission-emails-no-backup.test.cjs",
];
const EXTRA_TESTS = [
  "shared/mission-email-schedule.test.ts",
  "server/lib/mission-email-content.test.ts",
  "server/lib/mission-email-excel.test.ts",
  "server/lib/mission-email-sender.test.ts",
  "server/lib/mission-email-scheduler.test.ts",
  "server/lib/mission-email-schedule-routes.test.ts",
];
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
function once(source, before, after) {
  if (source.split(before).length !== 2) throw Error("Pinned email promotion anchor differs");
  return source.replace(before, () => after);
}
function loadLegacy(source) {
  if (hash(source) !== LEGACY_HASH) throw Error("Pinned no-backup renderer differs");
  let code = once(source, 'const TARGET = "c0e76a677dc3e497f358c2573b4ff09b0adca200";', `const TARGET = "${TARGET}";`);
  const plans = code.match(/^const PLANS = \[[\s\S]*?^\];/m)?.[0];
  if (!plans) throw Error("Pinned release plans missing");
  code = once(code, plans, `const PLANS = ${JSON.stringify(PLANS)};`);
  code = once(code, "const REVIEWED_PATHS = [", `const REVIEWED_PATHS = [${EXTRA_PATHS.map(JSON.stringify).join(",")},`);
  code = once(code, "const TESTS = [", `const TESTS = [${EXTRA_TESTS.map(JSON.stringify).join(",")},`);
  // The exact reviewed patch above includes only additive email schema changes.
  // Dependency guards remain intact; schema bytes are protected by the patch hash
  // and the renderer's complete physical-source verification before promotion.
  code = once(code, 'for (const file of ["package.json", "package-lock.json", "shared/schema.ts"])',
    'for (const file of ["package.json", "package-lock.json"])');
  code = once(code, '".mission-exports-build-"', '".mission-email-build-"');
  const filename = APP + "/script/operator/mission-email-release-runtime.cjs";
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(APP + "/script/operator");
  loaded._compile(code + "\nmodule.exports.main = main;\n", filename);
  return loaded.exports;
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply-no-backup" || args[1] !== TARGET)
    throw Error(`Use --apply-no-backup ${TARGET} as seman on CORPCRM01; no automatic runtime rollback`);
  const source = cp.execFileSync("git", ["-C", APP, "show", `${TARGET}:${LEGACY_PATH}`], {
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  });
  loadLegacy(source).main(args);
}
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error("STOP: " + error.message.split("\n")[0]); process.exitCode = 1; }
}
module.exports = { TARGET, LEGACY_PATH, LEGACY_HASH, PLANS, EXTRA_PATHS, EXTRA_TESTS, loadLegacy, main };
