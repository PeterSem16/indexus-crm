#!/usr/bin/env node
// Exact code-only release. No schema change, email send, or business-data restore.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "16ed66823fbe4cd245c899e0e07c5f1e8a31cb19";
const TARGET = "d6b2d801e13852fe9348d6dae47904c71d4d13e9";
const TREE = "15c090b99285c23408ca4fe91d9c8a41ab84f87f";
const PARENT = "ccddb6637666145761bc898be81b51da4459eaf0";
const PATCH_HASH = "38b35d8bd514ce187d043101eabfcbffd49d259ecfeeb6b2bfefd5b1aa879bba";
const RENDERER = "script/operator/promote-complete-replit.cjs";
const RENDERER_HASH = "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4";
const TEMPLATE = "script/operator/promote-inbound-status-list.sh";
const FILES = [
  "client/src/components/campaigns/MissionAgentFunnel.tsx",
  "client/src/components/campaigns/MissionFunnelMapping.tsx",
  "client/src/components/campaigns/MissionFunnelReport.tsx",
  "client/src/components/campaigns/MissionMaterialPackageMapping.tsx",
  "client/src/components/campaigns/mission-agent-funnel-export.ts",
  "client/src/components/campaigns/mission-funnel-export.ts",
  "client/src/components/campaigns/mission-funnel-help-translations.ts",
  "client/src/components/campaigns/mission-material-package-copy.ts",
  "client/src/components/campaigns/reviewed-email-export.test.ts",
  "e2e/mission-funnel.spec.ts",
  "script/operator/promote-mission-history.cjs",
  "script/operator/promote-mission-history.test.cjs",
  "script/operator/review-mission-proposal-emails.cjs",
  "script/operator/review-mission-proposal-emails.md",
  "script/operator/review-mission-proposal-emails.test.cjs",
  "server/lib/mission-funnel-email-evidence.db.test.ts",
  "server/lib/mission-funnel-email-evidence.test.ts",
  "server/lib/mission-funnel-email-evidence.ts",
  "server/lib/mission-funnel-routes.ts",
  "server/lib/mission-funnel.test.ts",
  "server/lib/mission-funnel.ts",
  "server/lib/review-mission-proposal-emails.db.test.ts",
  "shared/mission-funnel.ts",
  "shared/reviewed-email-evidence.test.ts",
  "shared/reviewed-email-evidence.ts",
].sort();
const TESTS = [
  "server/lib/mission-funnel.test.ts",
  "server/lib/mission-funnel-routes.test.ts",
  "server/lib/mission-funnel-email-evidence.test.ts",
  "shared/reviewed-email-evidence.test.ts",
  "client/src/components/campaigns/mission-funnel-export.test.ts",
  "client/src/components/campaigns/reviewed-email-export.test.ts",
  "script/operator/review-mission-proposal-emails.test.cjs",
];
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Reviewed promotion anchor changed");
  return text.replace(before, () => after);
}
function validate(git, target) {
  if (target !== TARGET || git(["rev-parse", "HEAD"]) !== BASE)
    throw Error("Unexpected target or production HEAD; stop");
  if (git(["rev-parse", `${TARGET}^{tree}`]) !== TREE ||
      git(["rev-parse", `${TARGET}^`]) !== PARENT ||
      git(["rev-parse", `${PARENT}^^`]) !== BASE)
    throw Error("Pinned release ancestry or tree differs");
  const files = git(["diff", "--name-only", BASE, TARGET]).split("\n").filter(Boolean).sort();
  if (JSON.stringify(files) !== JSON.stringify(FILES)) throw Error("Release scope differs");
  for (const file of ["package.json", "package-lock.json", "shared/schema.ts"])
    if (git(["rev-parse", `${BASE}:${file}`]) !== git(["rev-parse", `${TARGET}:${file}`]))
      throw Error("Dependencies/schema changed");
  if (hash(git(["diff", "--binary", "--full-index", "--no-ext-diff", "--no-renames", BASE, TARGET], true)) !== PATCH_HASH)
    throw Error("Release patch differs");
  return { base: BASE, target: TARGET, paths: files };
}
function render(git, plan) {
  if (plan.base !== BASE || plan.target !== TARGET || JSON.stringify(plan.paths) !== JSON.stringify(FILES))
    throw Error("Invalid release plan");
  const source = git(["show", `${TARGET}:${RENDERER}`], true);
  if (hash(source) !== RENDERER_HASH) throw Error("Pinned renderer differs");
  const filename = APP + "/" + RENDERER;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(APP + "/script/operator");
  loaded._compile(source, filename);
  let body = loaded.exports.render(git(["show", `${TARGET}:${TEMPLATE}`], true), plan, [BASE]);
  const start = body.indexOf("PHASE=zaloha_databazy_a_konfiguracie\n");
  const end = body.indexOf("PHASE=zostavenie\n", start);
  if (start < 0 || end <= start) throw Error("Database-backup anchor changed");
  body = body.slice(0, start) + body.slice(end);
  body = once(body, ".complete-replit-", ".mission-proposal-review-");
  body = once(body,
    "npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    `DATABASE_URL=postgresql://127.0.0.1:1/mission_proposal_unit npx --no-install tsx --test ${TESTS.join(" ")}`);
  if (/pg_dump|pg_restore|DATABASE_BACKUP|previous-source|reset --hard|git clean|npm install|npm ci/.test(body))
    throw Error("Unexpected destructive or database operation");
  return body;
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply" || args[1] !== TARGET)
    throw Error(`Use --apply ${TARGET} as seman on CORPCRM01`);
  const git = (args, raw = false) => {
    const bytes = cp.execFileSync("git", ["-C", APP, ...args], {
      encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
    return raw ? bytes : bytes.trimEnd();
  };
  const body = render(git, validate(git, args[1]));
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Invalid promotion script");
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], {
    input: body, stdio: ["pipe", "inherit", "inherit"], maxBuffer: 32 * 1024 * 1024,
  });
  if (run.error) throw Error("Cannot start promotion");
  process.exitCode = run.status ?? 1;
}
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`STOP: ${error.message.split("\n")[0]}`); process.exitCode = 1; }
}
module.exports = { BASE, TARGET, TREE, PARENT, PATCH_HASH, FILES, TESTS, validate, render, main };
