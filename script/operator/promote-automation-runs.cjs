#!/usr/bin/env node
// Operator-only, pinned promotion of the registered attachment translations.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "0421938aaa42c0a08c0421ecf1d970d61b7a077c";
const PARENT = "d26bc26c89504d361d3548b70fbbe6a4fda41e12";
const TARGET = "4f191181c1c499b96feb70f2f268f7f36fc681fe";
const FILES = [
  "client/src/i18n/automation-attachment-translations.test.ts",
  "client/src/i18n/translations.ts",
  "e2e/automation-overview.spec.ts",
  "script/operator/promote-medical-partner-status-list.cjs",
  "script/operator/promote-medical-partner-status-list.test.cjs",
].sort();
const FIX_FILES = FILES.slice(0, 3);
const RUNTIME = {
  backend: "1396398dc18c26be0a2d6b03ae940613f784e95a37585908863497c20f9a0582",
  index: "a14944935e6bcb08a0848b86a4b5a60a73d82301399bb06e96c3c3c5343976ff",
};
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Reviewed promotion anchor changed");
  return text.replace(before, () => after);
}
function validate(git, target) {
  if (target !== TARGET) throw Error("Unreviewed target");
  if (git(["rev-parse", "HEAD"]) !== BASE) throw Error("Production HEAD changed; stop");
  if (git(["rev-parse", `${TARGET}^`]) !== PARENT ||
      git(["rev-parse", `${PARENT}^`]) !== BASE) throw Error("Release ancestry changed");
  for (const [base, expected] of [[BASE, FILES], [PARENT, FIX_FILES]]) {
    const actual = git(["diff", "--name-only", base, TARGET]).split("\n").filter(Boolean).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error("Release scope differs");
  }
}
function render(template, renderer) {
  let body = renderer(template, { base: BASE, target: TARGET, paths: FILES }, [BASE]);
  body = once(body,
    "tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    "tsx --test client/src/i18n/automation-attachment-translations.test.ts");
  body = once(body, 'tail -30 "$VIEW/tests.log"', 'cat "$VIEW/tests.log"');
  body = once(body, ".complete-replit-", ".automation-runs-");
  body = once(body, 'OLD_INDEX=$(sha256sum dist/public/index.html | awk \'{print $1}\')',
    `OLD_INDEX=$(sha256sum dist/public/index.html | awk '{print $1}')
[[ "$OLD_BACKEND" == ${RUNTIME.backend} ]] || stop "Zivy backend sa od kontroly zmenil"
[[ "$OLD_INDEX" == ${RUNTIME.index} ]] || stop "Zivy frontend sa od kontroly zmenil"`);
  body = once(body, 'sudo cp -an "$VIEW/dist/public/." "$APP/dist/public/"',
    `if cp --update=none --version >/dev/null 2>&1; then
  sudo cp -a --update=none "$VIEW/dist/public/." "$APP/dist/public/"
else
  sudo cp -an "$VIEW/dist/public/." "$APP/dist/public/"
fi`);
  body = once(body, "  trap - EXIT ERR\n  set +e", `  trap - EXIT ERR
  set +e
  if [[ -n "$STORE" ]]; then
    printf 'PHASE=%s\\nEXIT=%s\\n' "$PHASE" "$rc" | sudo tee "$STORE/phase-result.txt" >/dev/null
    sudo chmod 600 "$STORE/phase-result.txt"
  fi`);
  return body;
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply" || args[1] !== TARGET)
    throw Error("Use --apply " + TARGET + " as seman on CORPCRM01");
  const git = args => cp.execFileSync("git", ["-C", APP, ...args], {
    encoding: "utf8", maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
  validate(git, args[1]);
  const filename = APP + "/script/operator/promote-complete-replit.cjs";
  const renderer = new Module(filename, module);
  renderer.filename = filename;
  renderer.paths = Module._nodeModulePaths(APP + "/script/operator");
  renderer._compile(git(["show", `${TARGET}:script/operator/promote-complete-replit.cjs`]) + "\n", filename);
  const body = render(git(["show", `${TARGET}:script/operator/promote-inbound-status-list.sh`]) + "\n",
    renderer.exports.render);
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Invalid generated command");
  console.log(`PRIPRAVENE_VYDANIE=${TARGET}`);
  console.log("KONTROLA_POSTUPU_SHA256=" + crypto.createHash("sha256").update(body).digest("hex"));
  const result = cp.spawnSync("bash", ["-s", "--", "--apply"], { input: body, stdio: ["pipe", "inherit", "inherit"] });
  if (result.error) throw Error("Cannot start promotion");
  process.exitCode = result.status ?? 1;
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error("STOP: " + error.message.split("\n")[0]); process.exitCode = 1; }
}
module.exports = { BASE, PARENT, TARGET, FILES, FIX_FILES, RUNTIME, validate, render };
