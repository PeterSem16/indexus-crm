#!/usr/bin/env node
// One explicitly approved, pinned release. No backup and no database restore.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const TARGET = "d1ca44bd1ddcf9996029c8b88cdc7a19938b6561";
const LEGACY_PATH = "script/operator/promote-mission-exports-no-backup.cjs";
const LEGACY_HASH = "28e5a7158e96a8cadcd874c45afe67e91767b845950f2c489eb192488841e980";
const PLANS = [
  { base: "82e76f45fbae8482f4c047787859b6f963e14c80", commits: 12, fileCount: 57, patchHash: "6c9bf90db3105841d7a462fa03f101d06d1478f07f0cefe24e2db95b7fe3e571" },
  { base: "0c6aed47d54c763159d3beaf1974d65212500119", commits: 7, fileCount: 50, patchHash: "256027b247e140f6635d484c2ad579e6e7c3b1f7e583ae1308e77314d4819219" },
  { base: "35d3a76cafd5e4dab9fae917267ce0d9d5ab7cec", commits: 6, fileCount: 48, patchHash: "f9ccff16710e9382b6e84c7989b848a4773bafd40db29542c953f4aeb7b2bc75" },
  { base: "ead18c105547d26f4ec1a0c389811311f6e8903b", commits: 5, fileCount: 46, patchHash: "f3f6a039c37e3bcbf22cfc210e59364231213484224586272c2c2aab0c7f4361" },
  { base: "eaa97de0b0b5c7a4791af62ef98c711f258020b8", commits: 4, fileCount: 38, patchHash: "8a0a52dc1c0209ba56a042f3ccda9b69c57ec861fa06772c54bd7bd6803c9a86" },
  { base: "2725b550929240b7c1449e681184c8dde0b954b7", commits: 3, fileCount: 36, patchHash: "2ad9bf9e62683ddb2e152ab122d8de2cd5e8c05e1ebaeaa3aabd6e28f2dc5f04" },
  { base: "c0e76a677dc3e497f358c2573b4ff09b0adca200", commits: 2, fileCount: 23, patchHash: "9fe4833d8fdec928cb5aa86c0cb5b733705045a57ae80ad1ec851cfa14610936" },
  { base: "6d88da124cd318f2c22ad6b342b3f5d6f47de7ff", commits: 1, fileCount: 21, patchHash: "78fd205c7be2a5c4650e79048fba19fc166efdfc85a0531f69f45ff6775713fe" },
];
const EXTRA_PATHS = [
  ".local/tsconfig-mission-email.json",
  "client/src/components/campaigns/MissionEmailSchedules.tsx",
  "client/src/components/campaigns/mission-email-schedule-translations.ts",
  "e2e/mission-email-schedules.spec.ts",
  "server/index.ts",
  "server/routes.ts",
  "server/scheduled-report-runner.ts",
  "shared/schema.ts",
  "server/lib/mission-email-content.test.ts",
  "server/lib/mission-email-content.ts",
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
];
const EXTRA_TESTS = [
  "shared/mission-email-schedule.test.ts",
  "server/lib/mission-email-content.test.ts",
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
