#!/usr/bin/env node
// Reviewed referral + multi-step email classification release. Preserve history.
// Startup adds only nullable email_funnel_steps; back up DB, never restore it.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "7b9682e0405df2a504bd8b64cdfeb11b1509eec8";
const TARGET = "70668b15ae2ddace29946c6bb42d6bd2a80a3029";
const PARENT = "d0ed31153f2d712d60fa5f4a6f2a3d3a187a7ed1";
const TREE = "79e6f77b820d54074ba81ed64da5e29ea7566b37";
const PATCH_HASH = "2d29c1b88a8294a8486ddf631b7a1e59c3a47027bb2d0ab04818701de4f03ff9";
const PATHS_HASH = "faa8ad483a10317d4e280f4ce1f3dc0509df4cfbc64f99f1a15027f45b943736";
const RENDERER = "script/operator/promote-complete-replit.cjs";
const RENDERER_HASH = "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4";
const TESTS = [
  "shared/email-purpose.test.ts", "shared/email-funnel-classification.test.ts",
  "server/email-template-purpose-routes.test.ts",
  "server/lib/mission-email-context.test.ts",
  "server/lib/mission-agent-funnel.test.ts",
  "server/lib/mission-funnel-email-evidence.test.ts",
  "server/lib/mission-funnel-routes.test.ts", "server/lib/mission-funnel.test.ts",
  "client/src/components/campaigns/mission-funnel-export.test.ts",
  "client/src/components/campaigns/mission-funnel-help-translations.test.ts",
  "client/src/components/campaigns/mission-funnel-help.test.ts",
  "client/src/components/campaigns/mission-agent-funnel-export.test.ts",
  "client/src/i18n/mission-funnel-translations.test.ts",
  "client/src/pages/configurator-email-classification.test.ts",
];
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Reviewed promotion anchor changed");
  return text.replace(before, () => after);
}
function validate(git, target) {
  if (target !== TARGET || git(["rev-parse", "HEAD"]) !== BASE)
    throw Error("Unexpected target or production HEAD; stop");
  if (git(["rev-parse", `${TARGET}^{tree}`]) !== TREE ||
      git(["rev-parse", `${TARGET}^`]) !== PARENT)
    throw Error("Pinned release tree or parent differs");
  git(["merge-base", "--is-ancestor", BASE, TARGET]);
  const paths = git(["diff", "--name-only", BASE, TARGET]).split("\n").filter(Boolean).sort();
  if (hash(paths.join("\n") + "\n") !== PATHS_HASH) throw Error("Release source whitelist differs");
  for (const path of ["package.json", "package-lock.json"])
    if (git(["rev-parse", `${BASE}:${path}`]) !== git(["rev-parse", `${TARGET}:${path}`]))
      throw Error("Production dependencies changed");
  if (hash(git(["diff", "--binary", "--full-index", "--no-ext-diff", "--no-renames", BASE, TARGET], true)) !== PATCH_HASH)
    throw Error("Release patch fingerprint differs");
  return { base: BASE, target: TARGET, paths };
}
function render(git, plan) {
  if (plan.base !== BASE || plan.target !== TARGET ||
      hash(plan.paths.join("\n") + "\n") !== PATHS_HASH)
    throw Error("Invalid release plan");
  const source = git(["show", `${TARGET}:${RENDERER}`], true);
  if (hash(source) !== RENDERER_HASH) throw Error("Pinned renderer differs");
  const filename = APP + "/" + RENDERER;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(APP + "/script/operator");
  loaded._compile(source, filename);
  let body = loaded.exports.render(
    git(["show", `${TARGET}:script/operator/promote-inbound-status-list.sh`], true), plan, [BASE]);
  // Keep the reviewed private database/configuration/runtime backup intact.
  body = once(body, ".complete-replit-", ".mission-referral-classification-");
  body = once(body,
    "npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    `DATABASE_URL=postgresql://127.0.0.1:1/classification_unit npx --no-install tsx --test --test-concurrency=2 ${TESTS.join(" ")}`);
  if (/reset --hard|git clean|npm install|npm ci|pg_restore[^\n]*--(?:dbname|clean)/.test(body))
    throw Error("Unexpected destructive operation");
  return body;
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply" || args[1] !== TARGET)
    throw Error(`Use --apply ${TARGET} as seman on CORPCRM01`);
  const git = (args, raw = false) => {
    const output = cp.execFileSync("git", ["-C", APP, ...args], {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
    return raw ? output : output.trimEnd();
  };
  const body = render(git, validate(git, args[1]));
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Invalid rendered promotion script");
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], {
    input: body, stdio: ["pipe", "inherit", "inherit"], maxBuffer: 64 * 1024 * 1024,
  });
  if (run.error) throw Error("Cannot start promotion");
  process.exitCode = run.status ?? 1;
}
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`STOP: ${error.message.split("\n")[0]}`); process.exitCode = 1; }
}
module.exports = { BASE, TARGET, TREE, PARENT, PATCH_HASH, PATHS_HASH, TESTS, validate, render, main };
