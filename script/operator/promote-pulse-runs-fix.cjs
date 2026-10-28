#!/usr/bin/env node
// Frontend-only release, pinned to approved source scope. No DB/build backup or PM2 restart.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const PRODUCT_BASE = "ecdfd32e3aff4eb2cf5202abb42d7b346f9c64ab";
const TOOLING_BASE = "f63b031f57c93e3ff4f9c4527125f1aae5842e52";
const PRODUCT_FILES = [
  "client/src/components/status-list-batch-save-dialog.css",
  "client/src/components/status-list-batch-save-dialog.tsx",
  "client/src/components/status-list-batch-rules-preview.tsx",
  "client/src/components/status-list-unsaved-dialog.css",
  "client/src/components/status-list-unsaved-dialog.tsx",
  "client/src/i18n/automation-attachment-translations.test.ts",
  "client/src/i18n/translations.ts",
  "client/src/pages/agent-workspace.tsx",
  "client/test-fixtures/automation-eligibility.html",
  "client/test-fixtures/automation-eligibility.tsx",
  "client/test-fixtures/status-list-batch-save.tsx",
  "e2e/status-list-batch-save.node.test.ts",
].sort();
const TOOLING_FILES = [
  "script/operator/promote-status-list-ergonomics.cjs",
  "script/operator/promote-status-list-ergonomics.test.cjs",
];
const RELEASE_FILES = [
  ...PRODUCT_FILES, "script/operator/promote-pulse-runs-fix.cjs",
  "script/operator/promote-pulse-runs-fix.test.cjs",
].sort();
const ALL_FILES = [...RELEASE_FILES, ...TOOLING_FILES].sort();
function runGit(args) {
  return cp.execFileSync("git", ["-C", APP, ...args], {
    encoding: "utf8", maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}
function validate(git, target) {
  if (!/^[a-f0-9]{40}$/.test(target)) throw Error("Use the pinned release SHA");
  const head = git(["rev-parse", "HEAD"]);
  if (![PRODUCT_BASE, TOOLING_BASE].includes(head)) throw Error("Production HEAD changed; stop");
  if (git(["rev-parse", `${target}^`]) !== TOOLING_BASE ||
      git(["rev-parse", `${TOOLING_BASE}^`]) !== PRODUCT_BASE) throw Error("Release ancestry changed");
  for (const [base, expected] of [[PRODUCT_BASE, ALL_FILES], [TOOLING_BASE, RELEASE_FILES], [head, head === PRODUCT_BASE ? ALL_FILES : RELEASE_FILES]]) {
    const actual = git(["diff", "--name-only", base, target]).split("\n").filter(Boolean).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error("Unreviewed source scope");
  }
  return head;
}
function render(template, complete, previous, base, target) {
  if (![PRODUCT_BASE, TOOLING_BASE].includes(base)) throw Error("Unreviewed baseline");
  const body = previous.render(template,
    () => complete.render(template, { base, target, paths: base === PRODUCT_BASE ? ALL_FILES : RELEASE_FILES }, [base]));
  const oldIndexGuard = `[[ "$OLD_INDEX" == ${previous.RUNTIME.index} ]] || stop "Zivy frontend sa od kontroly zmenil"`;
  if (body.split(oldIndexGuard).length !== 2) throw Error("Live index guard anchor changed");
  const result = body.replace(oldIndexGuard, '# Live index is captured and rechecked, never replaced before the staged build passes.');
  for (const forbidden of ["pg_dump", "pg_restore", "DATABASE_BACKUP", "pm2 restart", "npm run build", "backup/"])
    if (result.includes(forbidden)) throw Error("Forbidden backup or backend operation");
  return result;
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply")
    throw Error("Use --apply <pinned-release-sha> as seman on CORPCRM01");
  const target = args[1];
  const base = validate(runGit, target);
  function load(path) {
    const filename = APP + "/script/operator/" + path + ".cjs";
    const moduleAtPath = new Module(filename, module);
    moduleAtPath.filename = filename;
    moduleAtPath.paths = Module._nodeModulePaths(APP + "/script/operator");
    moduleAtPath._compile(runGit(["show", `${target}:script/operator/${path}.cjs`]) + "\n", filename);
    return moduleAtPath.exports;
  }
  const template = runGit(["show", `${target}:script/operator/promote-inbound-status-list.sh`]) + "\n";
  const body = render(template, load("promote-complete-replit"), load("promote-status-list-ergonomics"), base, target);
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Invalid reviewed command");
  console.log(`PRIPRAVENE_VYDANIE=${target}`);
  console.log("REZIM=IBA_FRONTEND_BEZ_ZALOHY_A_RESTARTU");
  console.log("KONTROLA_POSTUPU_SHA256=" + crypto.createHash("sha256").update(body).digest("hex"));
  const result = cp.spawnSync("bash", ["-s", "--", "--apply"], { input: body, stdio: ["pipe", "inherit", "inherit"] });
  if (result.error) throw Error("Cannot start promotion");
  process.exitCode = result.status ?? 1;
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error("STOP: " + error.message.split("\n")[0]); process.exitCode = 1; }
}
module.exports = { PRODUCT_BASE, TOOLING_BASE, PRODUCT_FILES, TOOLING_FILES, RELEASE_FILES, ALL_FILES, validate, render };
