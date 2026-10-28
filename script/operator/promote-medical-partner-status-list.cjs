#!/usr/bin/env node
// Pinned, operator-run promotion; reuse the reviewed private-backup/build/rollback procedure.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "031c98d4b391be5fbf0694af3fed035c2f516a72";
const CURRENT_RELEASE = "0421938aaa42c0a08c0421ecf1d970d61b7a077c";
const CURRENT_RUNTIME = {
  backend: "1396398dc18c26be0a2d6b03ae940613f784e95a37585908863497c20f9a0582",
  index: "a14944935e6bcb08a0848b86a4b5a60a73d82301399bb06e96c3c3c5343976ff",
};
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
function validateCurrentRelease(git, target) {
  if (target !== CURRENT_RELEASE) throw Error("Unreviewed current release");
  if (git(["rev-parse", "HEAD"]) !== target) throw Error("Production HEAD changed; stop");
  if (git(["rev-parse", `${target}^`]) !== BASE) throw Error("Unexpected release parent");
  const paths = git(["diff", "--name-only", BASE, target]).split("\n").filter(Boolean).sort();
  if (JSON.stringify(paths) !== JSON.stringify(FILES)) throw Error("Release scope differs");
}
function renderCurrentMedicalPartner(template, target, renderer) {
  if (target !== CURRENT_RELEASE) throw Error("Unreviewed current release");
  let body = renderMedicalPartner(template, target, renderer);
  const sourceCheck = 'check_source "$BASE"';
  if (body.split(sourceCheck).length !== 3) throw Error("Current-source check anchors changed");
  body = body.split(sourceCheck).join('check_source "$TARGET"');
  body = once(body, `PHASE=zdroje
SOURCE_CHANGED=1
git merge --ff-only "$TARGET"`, `PHASE=overenie_nezmeneneho_commitu`);
  body = once(body, `    if (( SOURCE_CHANGED )); then
      # The reviewed release is the only source transition. --keep refuses
      # conflicts and preserves unrelated/untracked operator and business files.
      if [[ "$(git -C "$APP" rev-parse HEAD)" == "$TARGET" ]]; then
        git -C "$APP" reset --keep "$BASE" || returned=0
      else
        echo "STOP: HEAD sa zmenil; zdroje automaticky nevraciam." >&2
        returned=0
      fi
    fi
`, "");
  body = once(body, "MOUNTED=0 SOURCE_CHANGED=0 RUNTIME_CHANGED=0", "MOUNTED=0 RUNTIME_CHANGED=0");
  body = once(body, 'echo "POVODNA_VERZIA_OBNOVENA=$BASE"', 'echo "POVODNY_RUNTIME_OBNOVENY=$TARGET"');
  body = once(body, 'git archive --format=tar --output="$VIEW/previous-source.tar" "$BASE"',
    'git archive --format=tar --output="$VIEW/previous-source.tar" "$TARGET"');
  body = once(body, `printf '%s\\n' "$BASE" "$TARGET" "$PID"`, `printf '%s\\n' "$TARGET" "$TARGET" "$PID"`);
  body = once(body, 'OLD_INDEX=$(sha256sum dist/public/index.html | awk \'{print $1}\')',
    `OLD_INDEX=$(sha256sum dist/public/index.html | awk '{print $1}')
[[ "$OLD_BACKEND" == ${CURRENT_RUNTIME.backend} ]] || stop "Zivy backend sa od kontroly zmenil"
[[ "$OLD_INDEX" == ${CURRENT_RUNTIME.index} ]] || stop "Zivy frontend sa od kontroly zmenil"`);
  body = once(body, "  trap - EXIT ERR\n  set +e", `  trap - EXIT ERR
  set +e
  if [[ -n "$STORE" ]]; then
    printf 'PHASE=%s\\nEXIT=%s\\n' "$PHASE" "$rc" | sudo tee "$STORE/phase-result.txt" >/dev/null
    sudo chmod 600 "$STORE/phase-result.txt"
  fi`);
  return body;
}
function main(args) {
  if (args.length !== 2 || !["--apply", "--complete-current"].includes(args[0]))
    throw Error("Use --apply or --complete-current PINNED_RELEASE_COMMIT as seman on CORPCRM01");
  const current = args[0] === "--complete-current";
  const target = args[1];
  const git = args => cp.execFileSync("git", ["-C", APP, ...args], {
    encoding: "utf8", maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
  if (current) validateCurrentRelease(git, target);
  else validateRelease(git, target);
  const filename = `${APP}/script/operator/promote-complete-replit.cjs`;
  const renderer = new Module(filename, module);
  renderer.filename = filename;
  renderer.paths = Module._nodeModulePaths(`${APP}/script/operator`);
  renderer._compile(git(["show", `${target}:script/operator/promote-complete-replit.cjs`]) + "\n", filename);
  const template = git(["show", `${target}:script/operator/promote-inbound-status-list.sh`]) + "\n";
  const body = (current ? renderCurrentMedicalPartner : renderMedicalPartner)(template, target, renderer.exports.render);
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Generated operator command is invalid");
  console.log(`PRIPRAVENE_VYDANIE=${target}`);
  if (current) console.log("REZIM=DOKONCENIE_AKTUALNEHO_COMMITU_BEZ_ZMENY_GIT_HEAD");
  console.log(`KONTROLA_POSTUPU_SHA256=${crypto.createHash("sha256").update(body).digest("hex")}`);
  const result = cp.spawnSync("bash", ["-s", "--", "--apply"], { input: body, stdio: ["pipe", "inherit", "inherit"] });
  if (result.error) throw Error("Cannot start promotion");
  process.exitCode = result.status ?? 1;
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`STOP: ${error.message.split("\n")[0]}`); process.exitCode = 1; }
}
module.exports = { BASE, FILES, TESTS, DATABASE_GUARD, renderMedicalPartner, validateRelease,
  CURRENT_RELEASE, CURRENT_RUNTIME, renderCurrentMedicalPartner, validateCurrentRelease };
