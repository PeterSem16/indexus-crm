#!/usr/bin/env node
// Run from pinned Git bytes through stdin; no helper installation is assumed.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "69da28d8d1b1ef1b35e12f686a3e1547c2496ff7";
const TARGET = "82e76f45fbae8482f4c047787859b6f963e14c80";
const PATCH_HASH = "b01394359c61c905dbcfa48161d079d4b41853db07f63011ccd22b8271317c9f";
const RENDERER_HASH = "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4";
const FILES = [
  "client/src/components/campaigns/CampaignAgentProductivity.tsx",
  "client/src/components/campaigns/CampaignClinicKPIs.tsx",
  "client/src/components/campaigns/CampaignCommunicationReview.tsx",
  "client/src/components/campaigns/CampaignDataQuality.tsx",
  "client/src/components/campaigns/CampaignHospitalPlan.tsx",
  "client/src/components/campaigns/CampaignKpiSnapshots.tsx",
  "client/src/components/campaigns/MissionFunnelChart.tsx",
  "client/src/components/campaigns/MissionFunnelReport.tsx",
  "client/src/components/campaigns/ReportingNavigation.tsx",
  "client/src/components/campaigns/mission-funnel-export.test.ts",
  "client/src/components/campaigns/mission-funnel-export.ts",
  "client/src/components/campaigns/mission-funnel-report.css",
  "client/src/components/campaigns/reporting-period.tsx",
  "client/src/components/campaigns/reporting.css",
  "client/src/components/campaigns/use-status-list-report.ts",
  "client/src/components/sip-phone.tsx",
  "client/src/components/tasks/task-create-controls.tsx",
  "client/src/i18n/mission-funnel-export-translations.ts",
  "client/src/i18n/mission-funnel-translations.test.ts",
  "client/src/i18n/mission-funnel-translations.ts",
  "client/src/i18n/reporting-translations.test.ts",
  "client/src/i18n/reporting-translations.ts",
  "client/src/i18n/translations.ts",
  "client/src/pages/campaign-detail.tsx",
  "client/test-fixtures/mission-funnel.html",
  "client/test-fixtures/mission-funnel.tsx",
  "client/test-fixtures/mission-reporting.html",
  "client/test-fixtures/mission-reporting.tsx",
  "e2e/mission-funnel.spec.ts",
  "e2e/mission-reporting.spec.ts",
  "server/lib/mission-funnel-routes.test.ts",
  "server/lib/mission-funnel-routes.ts",
  "server/lib/mission-funnel.test.ts",
  "server/lib/mission-funnel.ts",
  "server/lib/reporting-period-routes.test.ts",
  "server/routes.ts",
  "shared/mission-funnel.ts",
  "shared/reporting-period.test.ts",
  "shared/reporting-period.ts",
].sort();
const TESTS = [
  "shared/status-list-history-display.test.ts",
  "server/lib/status-list-history-display.test.ts",
  "shared/reporting-period.test.ts",
  "server/lib/mission-funnel.test.ts",
  "server/lib/mission-funnel-routes.test.ts",
  "server/lib/reporting-period-routes.test.ts",
  "client/src/components/campaigns/mission-funnel-export.test.ts",
  "client/src/i18n/mission-funnel-translations.test.ts",
  "client/src/i18n/reporting-translations.test.ts",
];
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
function validate(git, target) {
  if (target !== TARGET) throw Error("Unreviewed release target");
  if (git(["rev-parse", "HEAD"]) !== BASE) throw Error("Production HEAD changed; stop");
  git(["merge-base", "--is-ancestor", BASE, TARGET]);
  if (git(["rev-list", "--count", `${BASE}..${TARGET}`]) !== "5") throw Error("Release ancestry changed");
  const actual = git(["diff", "--name-only", BASE, TARGET]).split("\n").filter(Boolean).sort();
  if (JSON.stringify(actual) !== JSON.stringify(FILES)) throw Error("Release scope differs");
  for (const path of ["package.json", "package-lock.json", "shared/schema.ts"]) {
    if (git(["rev-parse", `${BASE}:${path}`]) !== git(["rev-parse", `${TARGET}:${path}`]))
      throw Error("Dependencies/schema changed: " + path);
  }
  const patch = git(["diff", "--binary", "--full-index", "--no-ext-diff", "--no-renames", BASE, TARGET], true);
  if (hash(patch) !== PATCH_HASH) throw Error("Reviewed release patch differs");
}
function render(template, renderer) {
  let body = renderer(template, { base: BASE, target: TARGET, paths: FILES }, [BASE]);
  const before = "npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts";
  if (body.split(before).length !== 2) throw Error("Reviewed test anchor changed");
  // Route fixtures inject their own database, but importing db.ts still needs
  // a URL. Never inherit the production connection for this test-only command.
  body = body.replace(before, () => `DATABASE_URL=postgresql://127.0.0.1:1/mission_funnel_unit npx --no-install tsx --test ${TESTS.join(" ")}`);
  if (body.split(".complete-replit-").length !== 2) throw Error("Reviewed storage anchor changed");
  return body.replace(".complete-replit-", ".mission-reporting-");
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply" || args[1] !== TARGET)
    throw Error(`Use --apply ${TARGET} as seman on CORPCRM01; application restart is included`);
  const git = (args, raw = false) => {
    const bytes = cp.execFileSync("git", ["-C", APP, ...args], {
      encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
    return raw ? bytes : bytes.trimEnd();
  };
  validate(git, args[1]);
  const source = git(["show", `${TARGET}:script/operator/promote-complete-replit.cjs`], true);
  if (hash(source) !== RENDERER_HASH) throw Error("Pinned promotion renderer differs");
  const filename = APP + "/script/operator/promote-complete-replit.cjs";
  const renderer = new Module(filename, module);
  renderer.filename = filename;
  renderer.paths = Module._nodeModulePaths(APP + "/script/operator");
  renderer._compile(source, filename);
  const body = render(git(["show", `${TARGET}:script/operator/promote-inbound-status-list.sh`], true), renderer.exports.render);
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Invalid generated procedure");
  console.log("PRIPRAVENE_VYDANIE=" + TARGET);
  console.log("POCET_COMMITOV=5");
  console.log("KONTROLA_POSTUPU_SHA256=" + hash(body));
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], { input: body, stdio: ["pipe", "inherit", "inherit"] });
  if (run.error) throw Error("Cannot start production procedure");
  process.exitCode = run.status ?? 1;
}
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error("STOP: " + error.message.split("\n")[0]); process.exitCode = 1; }
}
module.exports = { BASE, TARGET, FILES, TESTS, PATCH_HASH, RENDERER_HASH, validate, render };
