#!/usr/bin/env node
// Pinned code-only promotion; private runtime backup, never a database restore.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "3e6529b6e63fa7c1e20870072de2562a54af5ba2";
const TARGET = "16ed66823fbe4cd245c899e0e07c5f1e8a31cb19";
const TREE = "57018b863e10923414e8e3c14657103d71a0e6a8";
const PARENT = "52a5b3dc8e445c3705141c8226195f75d7085b1e";
const PATCH_HASH = "1746ff9b6f6b160fc6f57bdd285e9eba4cda24e93c5aff767a6cb94a0d981b29";
const RENDERER = "script/operator/promote-complete-replit.cjs";
const RENDERER_HASH = "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4";
const TEMPLATE = "script/operator/promote-inbound-status-list.sh";
const FILES = [
  ".local/tsconfig-mission-history.json",
  "client/src/pages/agent-workspace.tsx",
  "client/test-fixtures/mission-history.html",
  "client/test-fixtures/mission-history.tsx",
  "e2e/mission-history.spec.ts",
  "script/operator/attribute-mission-proposal-email.cjs",
  "script/operator/attribute-mission-proposal-email.test.cjs",
  "script/operator/promote-mission-emails-no-backup.cjs",
  "script/operator/promote-mission-emails-no-backup.test.cjs",
  "server/lib/contact-history-scope.test.ts",
  "server/lib/contact-history-scope.ts",
  "server/lib/mission-email-context.test.ts",
  "server/lib/mission-email-context.ts",
  "server/lib/mission-funnel-email-evidence.db.test.ts",
  "server/lib/mission-funnel-email-evidence.test.ts",
  "server/lib/mission-funnel-email-evidence.ts",
  "server/lib/mission-funnel-routes.ts",
  "server/lib/mission-funnel.ts",
  "server/routes.ts",
  "shared/status-list-history-display.ts",
].sort();
const TESTS = [
  "shared/status-list-history-display.test.ts",
  "server/lib/status-list-history-display.test.ts",
  "server/lib/mission-funnel.test.ts",
  "server/lib/mission-funnel-routes.test.ts",
  "server/lib/contact-history-scope.test.ts",
  "server/lib/mission-email-context.test.ts",
  "server/lib/mission-funnel-email-evidence.test.ts",
  "script/operator/attribute-mission-proposal-email.test.cjs",
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
      git(["rev-parse", `${PARENT}^`]) !== BASE)
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
  // No schema change: keep the private runtime backup/rollback, omit the
  // unrelated database/configuration dump. No business data is restored.
  const start = body.indexOf("PHASE=zaloha_databazy_a_konfiguracie\n");
  const end = body.indexOf("PHASE=zostavenie\n", start);
  if (start < 0 || end <= start) throw Error("Database-backup anchor changed");
  body = body.slice(0, start) + body.slice(end);
  body = once(body, ".complete-replit-", ".mission-history-");
  body = once(body,
    "npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    `DATABASE_URL=postgresql://127.0.0.1:1/mission_history_unit npx --no-install tsx --test ${TESTS.join(" ")}`);
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
    throw Error("Invalid promotion procedure");
  console.log("CIEL=" + TARGET);
  console.log("POSTUP_SHA256=" + hash(body));
  console.log("SUKROMNA_ZALOHA_RUNTIME_NA_DATOVOM_DISKU_BEZ_OBNOVY_DATABAZY");
  const result = cp.spawnSync("bash", ["-s", "--", "--apply"], { input: body, stdio: ["pipe", "inherit", "inherit"] });
  if (result.error) throw Error("Cannot start promotion");
  process.exitCode = result.status ?? 1;
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error("STOP: " + error.message.split("\n")[0]); process.exitCode = 1; }
}
module.exports = { BASE, TARGET, TREE, PARENT, FILES, PATCH_HASH, validate, render, main };
