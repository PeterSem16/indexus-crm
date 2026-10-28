#!/usr/bin/env node
// Pinned CORPCRM01 operator entry point; no network, installation or database
// mutation is performed by preparation. Promotion uses the reviewed procedure.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "28f59ce6b61fedca3965ded100dc4df349b45dac";
const FIX = "59a4c37c050d9069ad6956f6e11e63291c527d30";
const OLD_BACKEND = "70a7edde2f4653161a9994559b5297e043b0eda5fdb074b76f04d78315fc98b8";
const OLD_INDEX = "8a6f8beb3b4ae19a67f9d64e5c32281ba62b925639e2af8e1f92a3866c679187";
const APP_FILES = [
  "client/src/lib/call-analysis-view-state.test.ts",
  "client/src/lib/call-analysis-view-state.ts",
  "client/src/pages/transcript-search.tsx",
  "server/lib/queue-engine.ts",
  "server/lib/standing-recording-analysis-policy.ts",
  "server/lib/standing-recording-analysis.test.ts",
  "server/lib/standing-recording-analysis.ts",
  "server/lib/standing-recording-flow.test.ts",
  "server/routes.ts",
].sort();
const OPERATOR_FILES = [
  "script/operator/promote-complete-replit.cjs",
  "script/operator/promote-standing-analysis.cjs",
  "script/operator/promote-standing-analysis.test.cjs",
].sort();
const FILES = [...APP_FILES, ...OPERATOR_FILES].sort();
const TESTS = [
  "server/lib/standing-recording-analysis.test.ts",
  "server/lib/standing-recording-flow.test.ts",
  "server/lib/standing-recording-transitions.test.ts",
  "server/lib/forwarded-call-reconciliation.test.ts",
  "client/src/lib/call-analysis-view-state.test.ts",
].join(" ");
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Reviewed promotion anchor changed");
  return text.replace(before, () => after);
}
function renderStanding(template, target, renderer) {
  if (!/^[a-f0-9]{40}$/.test(target)) throw Error("Invalid pinned target");
  let body = renderer(template, { base: BASE, target, paths: FILES }, [BASE]);
  body = once(body,
    'OLD_INDEX=$(sha256sum dist/public/index.html | awk \'{print $1}\')',
    `OLD_INDEX=$(sha256sum dist/public/index.html | awk '{print $1}')
[[ "$OLD_BACKEND" == ${OLD_BACKEND} ]] || stop "Zivy backend sa od kontroly zmenil"
[[ "$OLD_INDEX" == ${OLD_INDEX} ]] || stop "Zivy frontend sa od kontroly zmenil"`);
  body = once(body,
    "tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    `tsx --test ${TESTS}`);
  body = once(body, ".complete-replit-", ".standing-analysis-");
  body = once(body, "  trap - EXIT ERR\n  set +e",
    `  trap - EXIT ERR
  set +e
  if [[ -n "$STORE" ]]; then
    printf 'PHASE=%s\\nEXIT=%s\\n' "$PHASE" "$rc" | sudo tee "$STORE/phase-result.txt" >/dev/null
    sudo chmod 600 "$STORE/phase-result.txt"
  fi`);
  // Keep no-clobber semantics; newer coreutils warns for cp -n.
  body = once(body, 'sudo cp -an "$VIEW/dist/public/." "$APP/dist/public/"',
    `if cp --update=none --version >/dev/null 2>&1; then
  sudo cp -a --update=none "$VIEW/dist/public/." "$APP/dist/public/"
else
  sudo cp -an "$VIEW/dist/public/." "$APP/dist/public/"
fi`);
  return body;
}
function validateRelease(git, target) {
  if (!/^[a-f0-9]{40}$/.test(target)) throw Error("Invalid release commit");
  if (git(["rev-parse", "HEAD"]) !== BASE) throw Error("Production HEAD changed; do not overwrite");
  if (git(["rev-parse", `${target}^`]) !== FIX || git(["rev-parse", `${FIX}^`]) !== BASE)
    throw Error("Unexpected release history");
  const paths = (from, to) => git(["diff", "--name-only", from, to]).split("\n").filter(Boolean).sort();
  for (const [from, to, expected] of [[BASE, FIX, APP_FILES], [FIX, target, OPERATOR_FILES], [BASE, target, FILES]]) {
    if (JSON.stringify(paths(from, to)) !== JSON.stringify(expected)) throw Error("Release scope differs");
  }
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply") throw Error("Use --apply PINNED_RELEASE_COMMIT as seman on CORPCRM01");
  const target = args[1];
  const git = a => cp.execFileSync("git", ["-C", APP, ...a], {
    encoding: "utf8", maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
  validateRelease(git, target);
  // Load the exact renderer in the reviewed release, not an older local copy.
  const filename = `${APP}/script/operator/promote-complete-replit.cjs`;
  const source = git(["show", `${target}:script/operator/promote-complete-replit.cjs`]) + "\n";
  const renderer = new Module(filename, module);
  renderer.filename = filename;
  renderer.paths = Module._nodeModulePaths(`${APP}/script/operator`);
  renderer._compile(source, filename);
  const template = git(["show", `${target}:script/operator/promote-inbound-status-list.sh`]) + "\n";
  const body = renderStanding(template, target, renderer.exports.render);
  const syntax = cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" });
  if (syntax.status !== 0) throw Error("Generated operator command is invalid");
  console.log(`PRIPRAVENE_VYDANIE=${target}`);
  console.log(`KONTROLA_POSTUPU_SHA256=${crypto.createHash("sha256").update(body).digest("hex")}`);
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], {
    input: body, stdio: ["pipe", "inherit", "inherit"],
  });
  if (run.error) throw Error("Cannot start promotion");
  process.exitCode = run.status ?? 1;
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`STOP: ${error.message.split("\n")[0]}`); process.exitCode = 1; }
}
module.exports = { renderStanding, validateRelease, BASE, FIX, FILES, APP_FILES, OPERATOR_FILES, OLD_BACKEND, OLD_INDEX };
