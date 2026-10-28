#!/usr/bin/env node
// Pinned, operator-run promotion; reuse the reviewed private-backup/build/rollback procedure.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "031c98d4b391be5fbf0694af3fed035c2f516a72";
const FILES = [
  "client/src/pages/agent-workspace.tsx",
  "e2e/status-list-legacy-choices.node.test.ts",
  "script/operator/promote-medical-partner-status-list.cjs",
  "script/operator/promote-medical-partner-status-list.test.cjs",
  "server/lib/status-list-confirmation-kind.test.ts",
  "server/lib/status-list-confirmation-kind.ts",
  "server/lib/status-list-confirmation-preview.db.test.ts",
  "server/lib/status-list-workflow.ts",
  "server/routes.ts",
  "shared/status-list-confirmation-kind.test.ts",
  "shared/status-list-confirmation-kind.ts",
].sort();
const TESTS = [
  "shared/status-list-confirmation-kind.test.ts",
  "server/lib/status-list-confirmation-kind.test.ts",
  "client/src/lib/status-list-execution-client.test.ts",
].join(" ");
const DATABASE_GUARD = `
const pg = require("pg");
process.env.DATABASE_URL="postgresql://127.0.0.1:1/indexus_unit_test";
function forbidden(){throw new Error("Operator unit tests must not access a database");}
for(const C of [pg.Pool,pg.Client]){C.prototype.connect=forbidden;C.prototype.query=forbidden;}
`;
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Reviewed promotion anchor changed");
  return text.replace(before, () => after);
}
function renderMedicalPartner(template, target, renderer) {
  let body = renderer(template, { base: BASE, target, paths: FILES }, [BASE]);
  body = once(body,
    "tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    `tsx --test ${TESTS}`);
  body = once(body, '(cd "$VIEW" && npx --no-install tsx --test',
    `cat > "$VIEW/.operator-unit-test-db-guard.cjs" <<'UNIT_DATABASE_GUARD'
${DATABASE_GUARD}
UNIT_DATABASE_GUARD
(cd "$VIEW" && NODE_OPTIONS="--require=$VIEW/.operator-unit-test-db-guard.cjs" npx --no-install tsx --test`);
  body = once(body, 'tail -30 "$VIEW/tests.log"', 'cat "$VIEW/tests.log"');
  body = once(body, ".complete-replit-", ".medical-partner-status-list-");
  body = once(body, 'sudo cp -an "$VIEW/dist/public/." "$APP/dist/public/"',
    `if cp --update=none --version >/dev/null 2>&1; then
  sudo cp -a --update=none "$VIEW/dist/public/." "$APP/dist/public/"
else
  sudo cp -an "$VIEW/dist/public/." "$APP/dist/public/"
fi`);
  return body;
}
function validateRelease(git, target) {
  if (!/^[a-f0-9]{40}$/.test(target)) throw Error("Invalid pinned target");
  if (git(["rev-parse", "HEAD"]) !== BASE) throw Error("Production HEAD changed; stop");
  if (git(["rev-parse", `${target}^`]) !== BASE) throw Error("Unexpected release parent");
  const paths = git(["diff", "--name-only", BASE, target]).split("\n").filter(Boolean).sort();
  if (JSON.stringify(paths) !== JSON.stringify(FILES)) throw Error("Release scope differs");
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply")
    throw Error("Use --apply PINNED_RELEASE_COMMIT as seman on CORPCRM01");
  const target = args[1];
  const git = args => cp.execFileSync("git", ["-C", APP, ...args], {
    encoding: "utf8", maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
  validateRelease(git, target);
  const filename = `${APP}/script/operator/promote-complete-replit.cjs`;
  const renderer = new Module(filename, module);
  renderer.filename = filename;
  renderer.paths = Module._nodeModulePaths(`${APP}/script/operator`);
  renderer._compile(git(["show", `${target}:script/operator/promote-complete-replit.cjs`]) + "\n", filename);
  const template = git(["show", `${target}:script/operator/promote-inbound-status-list.sh`]) + "\n";
  const body = renderMedicalPartner(template, target, renderer.exports.render);
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Generated operator command is invalid");
  console.log(`PRIPRAVENE_VYDANIE=${target}`);
  console.log(`KONTROLA_POSTUPU_SHA256=${crypto.createHash("sha256").update(body).digest("hex")}`);
  const result = cp.spawnSync("bash", ["-s", "--", "--apply"], { input: body, stdio: ["pipe", "inherit", "inherit"] });
  if (result.error) throw Error("Cannot start promotion");
  process.exitCode = result.status ?? 1;
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`STOP: ${error.message.split("\n")[0]}`); process.exitCode = 1; }
}
module.exports = { BASE, FILES, TESTS, DATABASE_GUARD, renderMedicalPartner, validateRelease };
