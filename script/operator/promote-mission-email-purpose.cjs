#!/usr/bin/env node
// Reviewed CORPCRM01 code release. Startup adds only an inert template-purpose
// column; this tool never repairs historical evidence or sends messages.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "16ed66823fbe4cd245c899e0e07c5f1e8a31cb19";
const TARGET = "5820719e87ec2b298958f568e137b58a53758cc1";
const PARENT = "68b0653fce5d6ed51ec8b0866e21ab8406be7618";
const TREE = "555b256a5a615d2b68ef126808014830a77d386e";
const PATCH_HASH = "5070a83f10cdf917e3161d4efd1edb6f26528870a5cbd247f12262a195783c8a";
const PATHS_HASH = "f3e5c0c084b14c9489e0d6f199d0269f6e2bb8f178b824c8c39e193d3e95bb7e";
const RENDERER = "script/operator/promote-complete-replit.cjs";
const RENDERER_HASH = "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4";
const TESTS = [
  "shared/email-purpose.test.ts",
  "shared/reviewed-email-evidence.test.ts",
  "server/email-template-purpose-routes.test.ts",
  "server/lib/customer-email-handler.test.ts",
  "server/lib/mission-email-context.test.ts",
  "server/lib/ms365-send-evidence.test.ts",
  "server/mission-email-routes.test.ts",
  "server/lib/mission-funnel-email-evidence.test.ts",
  "server/lib/mission-funnel.test.ts",
  "server/lib/mission-funnel-routes.test.ts",
  "server/lib/status-list-history.test.ts",
  "client/src/i18n/mission-funnel-translations.test.ts",
  "client/src/lib/email-template-provenance.node.test.ts",
  "client/src/lib/customer-email-delivery.test.ts",
  "client/src/components/campaigns/mission-funnel-export.test.ts",
  "client/src/components/campaigns/reviewed-email-export.test.ts",
  "script/operator/review-mission-proposal-emails.test.cjs",
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
  const start = body.indexOf("PHASE=zaloha_databazy_a_konfiguracie\n");
  const end = body.indexOf("PHASE=zostavenie\n", start);
  if (start < 0 || end <= start) throw Error("Backup boundary changed");
  body = body.slice(0, start) + body.slice(end);
  body = once(body, ".complete-replit-", ".mission-email-purpose-");
  body = once(body,
    "npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    `DATABASE_URL=postgresql://127.0.0.1:1/mission_email_unit npx --no-install tsx --test ${TESTS.join(" ")}`);
  if (/pg_dump|pg_restore|DATABASE_BACKUP|previous-source|reset --hard|git clean|npm install|npm ci/.test(body))
    throw Error("Unexpected destructive or database-backup operation");
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
