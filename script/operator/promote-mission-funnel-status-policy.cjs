#!/usr/bin/env node
// Pinned, application-only correction. No status, mapping or database writes.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const { Module } = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "70668b15ae2ddace29946c6bb42d6bd2a80a3029";
const PARENT = "1765ca1cd26ca8200f163e9985eb0e2daa45eb15";
const TARGET = "714e05cf336e29759d57f7c91aff0f2c93a11602";
const TREE = "ec0ea48956c710f74a08e53b0a44aba8561b22af";
const PATCH_HASH = "38dbf6250329621858dd4a7b7f22bf83a38cd6560449b434a5f253dd0a2f76f5";
const PATHS_HASH = "6d19eb5d07c8bc7b48b496c286ff707afed4a44dc5ecc4187f8a743152c5e608";
const RENDERER = "script/operator/promote-complete-replit.cjs";
const RENDERER_HASH = "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4";
const TESTS = [
  "server/lib/mission-cooperation-standalone.test.ts",
  "server/lib/mission-funnel.test.ts",
  "server/lib/mission-funnel-routes.test.ts",
  "server/lib/mission-funnel-email-evidence.test.ts",
  "server/lib/mission-agent-funnel.test.ts",
  "client/src/components/campaigns/mission-funnel-export.test.ts",
  "client/src/components/campaigns/reviewed-email-export.test.ts",
  "client/src/i18n/mission-funnel-translations.test.ts",
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
  for (const path of ["package.json", "package-lock.json", "shared/schema.ts", "server/index.ts"])
    if (git(["rev-parse", `${BASE}:${path}`]) !== git(["rev-parse", `${TARGET}:${path}`]))
      throw Error("Dependencies or schema startup changed");
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
  // This release needs only a private runtime backup, not a database backup.
  const start = body.indexOf("PHASE=zaloha_databazy_a_konfiguracie\n");
  const end = body.indexOf("PHASE=zostavenie\n", start);
  if (start < 0 || end <= start) throw Error("Backup boundary changed");
  body = body.slice(0, start) + body.slice(end);
  body = once(body, ".complete-replit-", ".mission-funnel-status-policy-");
  body = once(body,
    "npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    `DATABASE_URL=postgresql://127.0.0.1:1/funnel_policy_unit npx --no-install tsx --test ${TESTS.join(" ")}`);
  if (/pg_dump|pg_restore|DATABASE_BACKUP|previous-source|reset --hard|git clean|npm install|npm ci/.test(body))
    throw Error("Unexpected destructive or database operation");
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
  console.log("FUNNEL_POLICY_TARGET=" + TARGET);
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], { input: body, stdio: ["pipe", "inherit", "inherit"] });
  if (run.error) throw Error("Cannot start promotion");
  process.exitCode = run.status ?? 1;
}
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`STOP: ${error.message.split("\n")[0]}`); process.exitCode = 1; }
}
module.exports = { BASE, PARENT, TARGET, TREE, PATCH_HASH, PATHS_HASH, TESTS, validate, render };
