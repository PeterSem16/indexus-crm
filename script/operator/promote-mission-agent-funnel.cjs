#!/usr/bin/env node
// The helper is published separately from the pinned, reviewed application.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const TARGET = "eaa97de0b0b5c7a4791af62ef98c711f258020b8";
const RENDERER_HASH = "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4";
const FILES = [
  "client/src/components/campaigns/MissionAgentFunnel.tsx",
  "client/src/components/campaigns/MissionFunnelChart.tsx",
  "client/src/components/campaigns/MissionFunnelHelp.tsx",
  "client/src/components/campaigns/MissionFunnelMapping.tsx",
  "client/src/components/campaigns/MissionFunnelReport.tsx",
  "client/src/components/campaigns/mission-agent-funnel-export.test.ts",
  "client/src/components/campaigns/mission-agent-funnel-export.ts",
  "client/src/components/campaigns/mission-agent-funnel-translations.ts",
  "client/src/components/campaigns/mission-funnel-help-translations.ts",
  "client/src/components/campaigns/mission-funnel-help.test.ts",
  "client/src/i18n/mission-funnel-translations.test.ts",
  "client/src/i18n/mission-funnel-translations.ts",
  "client/test-fixtures/mission-funnel.tsx",
  "e2e/mission-agent-funnel.spec.ts",
  "e2e/mission-funnel.spec.ts",
  "script/operator/diagnose-medical-partner-funnel.sql",
  "script/operator/diagnose-medical-partner-funnel.test.cjs",
  "script/operator/promote-mission-funnel-update.cjs",
  "script/operator/promote-mission-funnel-update.test.cjs",
  "script/operator/promote-mission-reporting.cjs",
  "script/operator/promote-mission-reporting.test.cjs",
  "server/lib/mission-agent-funnel.test.ts",
  "server/lib/mission-agent-funnel.ts",
  "server/lib/mission-funnel-actors.ts",
  "server/lib/mission-funnel-routes.test.ts",
  "server/lib/mission-funnel-routes.ts",
  "server/lib/mission-funnel.test.ts",
  "server/lib/mission-funnel.ts",
  "shared/mission-funnel.ts",
].sort();
const priorUpdate = [
  "client/src/i18n/mission-funnel-translations.test.ts",
  "client/src/i18n/mission-funnel-translations.ts",
  "script/operator/diagnose-medical-partner-funnel.sql",
  "script/operator/diagnose-medical-partner-funnel.test.cjs",
  "script/operator/promote-mission-reporting.cjs",
  "script/operator/promote-mission-reporting.test.cjs",
  "server/lib/mission-funnel.test.ts",
];
const priorHelper = [
  "script/operator/promote-mission-funnel-update.cjs",
  "script/operator/promote-mission-funnel-update.test.cjs",
];
const priorManual = [
  "client/src/components/campaigns/MissionFunnelHelp.tsx",
  "client/src/components/campaigns/MissionFunnelMapping.tsx",
  "client/test-fixtures/mission-funnel.tsx",
];
const PLANS = [
  { base: "82e76f45fbae8482f4c047787859b6f963e14c80", commits: 8,
    patchHash: "71663ae01fa75122eedcafb4d542a00ad1c1946b226c9f3e15c8b0a7f2f3192b", exclude: [] },
  { base: "0c6aed47d54c763159d3beaf1974d65212500119", commits: 3,
    patchHash: "e1897bb3fc49db497f0ceb22dd3ddaf8243d15bd38480e97c618a17bbb4b8925", exclude: priorUpdate },
  { base: "35d3a76cafd5e4dab9fae917267ce0d9d5ab7cec", commits: 2,
    patchHash: "5ab888e7f3e43724d263c606fcab6dff6cd704fe1d593cb84f99ca47fdbac99c", exclude: [...priorUpdate, ...priorHelper] },
  { base: "ead18c105547d26f4ec1a0c389811311f6e8903b", commits: 1,
    patchHash: "df8acbd7d04ac167310897716eaf5b8a9f670b4163c4ff6860b4aeb8a984368b", exclude: [...priorUpdate, ...priorHelper, ...priorManual] },
].map(plan => ({ ...plan, files: FILES.filter(file => !plan.exclude.includes(file)) }));
const TESTS = [
  "shared/status-list-history-display.test.ts",
  "server/lib/status-list-history-display.test.ts",
  "shared/reporting-period.test.ts",
  "server/lib/mission-funnel.test.ts",
  "server/lib/mission-agent-funnel.test.ts",
  "server/lib/mission-funnel-routes.test.ts",
  "server/lib/reporting-period-routes.test.ts",
  "client/src/components/campaigns/mission-funnel-export.test.ts",
  "client/src/components/campaigns/mission-funnel-help.test.ts",
  "client/src/components/campaigns/mission-agent-funnel-export.test.ts",
  "client/src/i18n/mission-funnel-translations.test.ts",
  "client/src/i18n/reporting-translations.test.ts",
  "script/operator/diagnose-medical-partner-funnel.test.cjs",
];
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
function validate(git, target) {
  if (target !== TARGET) throw Error("Unreviewed release target");
  const base = git(["rev-parse", "HEAD"]);
  const plan = PLANS.find(entry => entry.base === base);
  if (!plan) throw Error(base === TARGET
    ? "Application target is already present; no automatic restart"
    : "Production HEAD is not an approved base; stop and inspect git rev-parse HEAD");
  git(["merge-base", "--is-ancestor", base, TARGET]);
  if (git(["rev-list", "--count", `${base}..${TARGET}`]) !== String(plan.commits))
    throw Error("Release ancestry changed");
  const actual = git(["diff", "--name-only", base, TARGET]).split("\n").filter(Boolean).sort();
  if (JSON.stringify(actual) !== JSON.stringify(plan.files)) throw Error("Release scope differs");
  for (const file of ["package.json", "package-lock.json", "shared/schema.ts"]) {
    if (git(["rev-parse", `${base}:${file}`]) !== git(["rev-parse", `${TARGET}:${file}`]))
      throw Error("Dependencies/schema changed: " + file);
  }
  if (hash(git(["diff", "--binary", "--full-index", "--no-ext-diff", "--no-renames", base, TARGET], true)) !== plan.patchHash)
    throw Error("Reviewed release patch differs");
  return plan;
}
function render(template, renderer, plan) {
  if (!PLANS.includes(plan)) throw Error("Unreviewed promotion plan");
  let body = renderer(template, { base: plan.base, target: TARGET, paths: plan.files }, [plan.base]);
  const before = "npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts";
  if (body.split(before).length !== 2) throw Error("Reviewed test anchor changed");
  body = body.replace(before, () => `DATABASE_URL=postgresql://127.0.0.1:1/mission_funnel_unit npx --no-install tsx --test ${TESTS.join(" ")}`);
  if (body.split(".complete-replit-").length !== 2) throw Error("Reviewed storage anchor changed");
  return body.replace(".complete-replit-", ".mission-agent-funnel-");
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
  const plan = validate(git, args[1]);
  const source = git(["show", `${TARGET}:script/operator/promote-complete-replit.cjs`], true);
  if (hash(source) !== RENDERER_HASH) throw Error("Pinned promotion renderer differs");
  const filename = APP + "/script/operator/promote-complete-replit.cjs";
  const renderer = new Module(filename, module);
  renderer.filename = filename;
  renderer.paths = Module._nodeModulePaths(APP + "/script/operator");
  renderer._compile(source, filename);
  const body = render(git(["show", `${TARGET}:script/operator/promote-inbound-status-list.sh`], true), renderer.exports.render, plan);
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Invalid generated procedure");
  console.log("PRIPRAVENE_VYDANIE=" + TARGET);
  console.log("POVODNA_VERZIA=" + plan.base);
  console.log("POCET_COMMITOV=" + plan.commits);
  console.log("KONTROLA_POSTUPU_SHA256=" + hash(body));
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], { input: body, stdio: ["pipe", "inherit", "inherit"] });
  if (run.error) throw Error("Cannot start production procedure");
  process.exitCode = run.status ?? 1;
}
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error("STOP: " + error.message.split("\n")[0]); process.exitCode = 1; }
}
module.exports = { TARGET, PLANS, FILES, TESTS, RENDERER_HASH, validate, render };
