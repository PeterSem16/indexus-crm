#!/usr/bin/env node
// Pinned frontend-only promotion. No database/build backup and no backend restart.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "4f191181c1c499b96feb70f2f268f7f36fc681fe";
const PARENT = "d731eccc0c30fe71d7630679aef93846ac53c2ed";
const TARGET = "ecdfd32e3aff4eb2cf5202abb42d7b346f9c64ab";
const UI_FILES = [
  "client/src/components/status-list-action-recap.css",
  "client/src/components/status-list-batch-save-dialog.css",
  "client/src/components/status-list-batch-save-dialog.tsx",
  "e2e/status-list-batch-save.node.test.ts",
].sort();
const FILES = [...UI_FILES, "script/operator/promote-automation-runs.cjs",
  "script/operator/promote-automation-runs.test.cjs"].sort();
const RUNTIME = {
  backend: "1396398dc18c26be0a2d6b03ae940613f784e95a37585908863497c20f9a0582",
  index: "91103a350d34597461320e3b08a9f86a51f2e7457779988477cd20e966eefa4a",
};
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Reviewed frontend promotion anchor changed");
  return text.replace(before, () => after);
}
function range(text, start, end, replacement) {
  if (text.split(start).length !== 2 || text.split(end).length !== 2)
    throw Error("Reviewed frontend promotion range changed");
  const a = text.indexOf(start), b = text.indexOf(end, a);
  if (b < a) throw Error("Invalid promotion range");
  return text.slice(0, a) + replacement + text.slice(b);
}
function validate(git, target) {
  if (target !== TARGET) throw Error("Unreviewed target");
  if (git(["rev-parse", "HEAD"]) !== BASE) throw Error("Production HEAD changed; stop");
  if (git(["rev-parse", `${TARGET}^`]) !== PARENT ||
      git(["rev-parse", `${PARENT}^`]) !== BASE) throw Error("Release ancestry changed");
  for (const [base, expected] of [[BASE, FILES], [PARENT, UI_FILES]]) {
    const paths = git(["diff", "--name-only", base, TARGET]).split("\n").filter(Boolean).sort();
    if (JSON.stringify(paths) !== JSON.stringify(expected)) throw Error("Release scope differs");
  }
}
function render(template, renderer) {
  let body = renderer(template, { base: BASE, target: TARGET, paths: FILES }, [BASE]);
  body = range(body, "PHASE=zaloha\n", "PHASE=zostavenie\n", "");
  body = once(body, '      restore_file "$STORE/backup/index.cjs" "$APP/dist/index.cjs" || returned=0\n', "");
  body = once(body, '      restore_file "$STORE/backup/index.html" "$APP/dist/public/index.html" || returned=0',
    `      printf '%s' "$OLD_HTML" | base64 -d | sudo tee "$APP/dist/public/.index.operator-return.html" >/dev/null &&
        sudo chown "$APP_UID:$APP_GID" "$APP/dist/public/.index.operator-return.html" &&
        sudo chmod 644 "$APP/dist/public/.index.operator-return.html" &&
        sudo mv -fT "$APP/dist/public/.index.operator-return.html" "$APP/dist/public/index.html" || returned=0`);
  body = once(body, '      pm2 restart indexus-crm >/dev/null || returned=0\n      wait_health || returned=0',
    '      [[ "$(process_pid)" == "$PID" ]] || returned=0\n      health || returned=0');
  body = once(body, '      echo "Vraciam predchadzajuci backend a vstupnu stranku; databazu neobnovujem." >&2',
    '      echo "Vraciam iba vstupne HTML z pamate; backend a databaza bez zmeny." >&2');
  body = range(body, "restore_file() {\n", "cleanup() {\n", "");
  body = range(body, "PHASE=backend\n", "PHASE=vstupna_stranka\n", 'NEW_PID=$PID\n');
  body = once(body, 'sudo mv -fT -- "$APP/dist/public/.index.next.html" "$APP/dist/public/index.html"',
    'RUNTIME_CHANGED=1\nsudo mv -fT -- "$APP/dist/public/.index.next.html" "$APP/dist/public/index.html"');
  body = once(body, 'OLD_INDEX=$(sha256sum dist/public/index.html | awk \'{print $1}\')',
    `OLD_INDEX=$(sha256sum dist/public/index.html | awk '{print $1}')
[[ "$OLD_BACKEND" == ${RUNTIME.backend} ]] || stop "Zivy backend sa od kontroly zmenil"
[[ "$OLD_INDEX" == ${RUNTIME.index} ]] || stop "Zivy frontend sa od kontroly zmenil"
OLD_HTML=$(base64 -w0 dist/public/index.html)
[[ "$(printf '%s' "$OLD_HTML" | base64 -d | sha256sum | awk '{print $1}')" == "$OLD_INDEX" ]] || stop "Neuplne povodne HTML v pamati"`);
  body = once(body, "npm run build > build.log", "NODE_ENV=production npx --no-install vite build > build.log");
  body = once(body,
    "tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    "tsx --test client/src/i18n/automation-attachment-translations.test.ts");
  body = once(body, '[[ -s "$VIEW/dist/index.cjs" && -s "$VIEW/dist/public/index.html" ]]',
    '[[ -s "$VIEW/dist/public/index.html" && -d "$VIEW/dist/public/assets" ]]');
  body = once(body, 'tail -30 "$VIEW/tests.log"', 'cat "$VIEW/tests.log"');
  body = once(body, ".complete-replit-", ".status-list-ui-stage-");
  body = once(body, 'sudo install -d -o root -g root -m 700 "$STORE/backup"\n', "");
  body = once(body, 'sudo cp -an "$VIEW/dist/public/." "$APP/dist/public/"',
    `if cp --update=none --version >/dev/null 2>&1; then
  sudo cp -a --update=none "$VIEW/dist/public/." "$APP/dist/public/"
else
  sudo cp -an "$VIEW/dist/public/." "$APP/dist/public/"
fi`);
  body = once(body, 'echo "Zostavujem presny ciel $TARGET mimo ziveho dist. Zaloha: $STORE"',
    'echo "Zostavujem frontend $TARGET mimo ziveho dist. Bez zalohy databazy a buildu."');
  body = once(body, 'echo "STOP: faza=$PHASE; sukromna zaloha=${STORE:-nevytvorena}" >&2',
    'echo "STOP: faza=$PHASE; sukromny build=${STORE:-nevytvoreny}" >&2');
  body = once(body, 'echo "SUKROMNA_ZALOHA_A_BUILD=$STORE"', 'echo "SUKROMNY_BUILD=$STORE"\necho "BACKEND_BEZ_RESTARTU=$PID"');
  body = once(body, '[[ "${1:-}" == --apply && $# == 1 ]] || stop "Pouzi --apply; vykona sa aj restart aplikacie."',
    '[[ "${1:-}" == --apply && $# == 1 ]] || stop "Pouzi --apply; iba frontend bez zalohy a restartu."');
  body = once(body, "for tool in git node npm npx sudo pm2 curl findmnt mountpoint flock tar sha256sum mount umount;",
    "for tool in git node npm npx sudo pm2 curl findmnt mountpoint flock tar sha256sum mount umount base64;");
  body = once(body, '[[ "$(process_pid)" == "$NEW_PID" ]] || stop "Novy backend nie je stabilny"',
    `[[ "$(process_pid)" == "$PID" ]] || stop "Backend PID sa zmenil"
[[ "$(sha256sum dist/index.cjs | awk '{print $1}')" == "$OLD_BACKEND" ]] || stop "Backend bundle sa zmenil"`);
  if (/pg_dump|pg_restore|DATABASE_BACKUP|pm2 restart|backup\/|dist\.tar|npm run build/.test(body))
    throw Error("Forbidden backup or backend operation survived");
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
module.exports = { BASE, PARENT, TARGET, FILES, UI_FILES, RUNTIME, validate, render };
