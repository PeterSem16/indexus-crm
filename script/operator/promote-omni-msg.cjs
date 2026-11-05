#!/usr/bin/env node
// Operator-run backend-only promotion. Target excludes this deployment helper.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const { Module } = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "9b849b8c5e02bcbb7689af98346ab3475e9032aa";
const PARENT = "221ccdd9ece351d287a04398ad263b122ac0d12b";
const TARGET = "412771e256501be47d8b8301fc3b0829eeec257c";
const TREE = "e19b4fc8ed02e52df73756c9cb852322a5fa99cd";
const RENDERER = "script/operator/promote-complete-replit.cjs";
const RENDERER_HASH = "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4";
const RUNTIME = {
  backend: "33621bdd92165f4cb328e067ee8f81d4fadeefebac805304854077a217f510cb",
  index: "16d4a28feb16aaf0e846c2975adcc062048ee4abf660d22517faaae52eb1bc13",
};
const FIX_FILES = [
  "server/lib/omni-export-formats.test.ts",
  "server/lib/omni-export-graph.ts",
  "server/lib/omni-export-inline-regression.test.ts",
].sort();
const PREVIOUS_TOOL_FILES = [
  ".agents/memory/MEMORY.md",
  ".agents/memory/export-cleanup-verification.md",
  ".agents/memory/msg-reader-dependency-parity.md",
  "script/operator/cleanup-approved-omni-backups.cjs",
  "script/operator/promote-omni-accounts.cjs",
  "script/operator/promote-omni-accounts.test.cjs",
].sort();
const TESTS = [
  "server/lib/omni-export-inline-regression.test.ts",
  "server/lib/omni-export-formats.test.ts",
  "server/lib/omni-export-delivery-failures.test.ts",
  "server/lib/omni-export-signature.test.ts",
  "server/lib/omni-search-export.test.ts",
];
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Reviewed deployment anchor changed");
  return text.replace(before, () => after);
}
function removeSection(text, start, end) {
  if (text.split(start).length !== 2 || text.split(end).length !== 2)
    throw Error("Reviewed deployment section changed");
  const begin = text.indexOf(start), finish = text.indexOf(end, begin);
  if (finish < begin) throw Error("Invalid deployment section");
  return once(text, text.slice(begin, finish + end.length), "");
}
function validate(git, target) {
  if (target !== TARGET || git(["rev-parse", `${TARGET}^{tree}`]) !== TREE ||
      git(["rev-parse", `${TARGET}^`]) !== PARENT) throw Error("Unreviewed MSG target");
  const base = git(["rev-parse", "HEAD"]);
  if (![BASE, PARENT].includes(base)) throw Error("Production HEAD changed; stop");
  git(["merge-base", "--is-ancestor", BASE, PARENT]);
  for (const [from, to, expected] of [
    [BASE, PARENT, PREVIOUS_TOOL_FILES], [PARENT, TARGET, FIX_FILES],
  ]) {
    const actual = git(["diff", "--name-only", from, to]).split("\n").filter(Boolean).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error("Release whitelist differs");
  }
  // No new startup migration, schema or dependency change is permitted.
  for (const path of ["server/index.ts", "shared/schema.ts", "package.json", "package-lock.json",
    "script/build-server.ts", RENDERER, "script/operator/promote-inbound-status-list.sh"])
    if (git(["rev-parse", `${BASE}:${path}`]) !== git(["rev-parse", `${TARGET}:${path}`]))
      throw Error("Unreviewed startup, schema, build or dependency change");
  return { base, target, paths: base === BASE ? [...PREVIOUS_TOOL_FILES, ...FIX_FILES].sort() : FIX_FILES };
}
function render(template, renderer, plan) {
  let body = renderer(template, plan, [plan.base]);
  body = once(body, ".complete-replit-", ".omni-msg-");
  body = removeSection(body, "\nPHASE=zaloha_databazy_a_konfiguracie\n", "\nDATABASE_BACKUP\n");
  body = once(body,
    'OLD_INDEX=$(sha256sum dist/public/index.html | awk \'{print $1}\')',
    `OLD_INDEX=$(sha256sum dist/public/index.html | awk '{print $1}')
[[ "$OLD_BACKEND" == ${RUNTIME.backend} && "$OLD_INDEX" == ${RUNTIME.index} ]] || stop "Zivy build sa zmenil; vrat aktualny stav"`);
  body = once(body, '  trap - EXIT ERR\n  set +e', `  trap - EXIT ERR
  set +e
  if [[ -n "$STORE" ]]; then
    printf 'PHASE=%s\\nEXIT=%s\\n' "$PHASE" "$rc" | sudo tee "$STORE/phase-result.txt" >/dev/null
    sudo chmod 600 "$STORE/phase-result.txt"
  fi`);
  body = once(body,
    '      restore_file "$STORE/backup/index.html" "$APP/dist/public/index.html" || returned=0\n', "");
  body = once(body, "Vraciam predchadzajuci backend a vstupnu stranku;", "Vraciam predchadzajuci backend;");
  body = once(body,
    'if [[ -f "$APP/.env" ]]; then ln -s "$APP/.env" "$VIEW/.env"; fi\n', "");
  // Exclude tracked runtime buckets and unrelated uploaded assets from staging.
  body = once(body, 'git archive --format=tar --output="$VIEW/source.tar" "$TARGET"',
    'git archive --format=tar --output="$VIEW/source.tar" "$TARGET" server shared client/src script/build-server.ts package.json package-lock.json tsconfig.json');
  body = once(body, "npm run build > build.log", "npx --no-install tsx script/build-server.ts > build.log");
  body = once(body,
    "npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    "NODE_ENV=test DATABASE_URL=postgresql://127.0.0.1:1/omni_deploy_test npx --no-install tsx --test --test-concurrency=2 " + TESTS.join(" "));
  body = once(body,
    '{ tail -30 "$VIEW/tests.log"; stop "Testy zlyhali; nasadenie zastavene"; }',
    '{ grep -n -B 3 -A 30 \'^not ok\' "$VIEW/tests.log" || true; tail -30 "$VIEW/tests.log"; echo "TESTY_LOG=$STORE/build/tests.log" >&2; stop "Testy zlyhali; nasadenie zastavene"; }');
  body = once(body, '[[ -s "$VIEW/dist/index.cjs" && -s "$VIEW/dist/public/index.html" ]]',
    '[[ -s "$VIEW/dist/index.cjs" ]]');
  body = removeSection(body, "# Validate the exact served tree before copying anything.", "\nVALIDATE_ASSETS\n");
  body = removeSection(body, "PHASE=staticke_subory\n", 'sudo cp -an "$VIEW/dist/public/." "$APP/dist/public/"\n');
  body = removeSection(body, "PHASE=vstupna_stranka\n",
    'sudo mv -fT -- "$APP/dist/public/.index.next.html" "$APP/dist/public/index.html"\n');
  body = once(body, 'cmp "$VIEW/dist/public/index.html" "$VIEW/served.html"',
    'cmp "$APP/dist/public/index.html" "$VIEW/served.html"\n[[ "$(sha256sum "$APP/dist/public/index.html" | awk \'{print $1}\')" == "$OLD_INDEX" ]] || stop "Frontend sa zmenil"');
  body = once(body, 'echo "Stare lazy-load subory zostali dostupne. Databaza sa neobnovovala."',
    'echo "REZIM=IBA_BACKEND; frontend zostal nezmeneny; databaza sa neobnovovala."');
  for (const forbidden of ["pg_dump", "pg_restore", "DATABASE_BACKUP", "npm run build",
    "npm install", "npm ci", "db:push", "reset --hard", "git clean", "cp -an",
    'install -o "$APP_UID" -g "$APP_GID" -m 644 "$VIEW/dist/public', 'restore_file "$STORE/backup/index.html"'])
    if (body.includes(forbidden)) throw Error("Forbidden operation in backend-only deployment");
  return body;
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply" || args[1] !== TARGET)
    throw Error("Use --apply " + TARGET + " as seman on CORPCRM01");
  const git = (args, raw = false) => {
    const result = cp.execFileSync("git", ["-C", APP, ...args], {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
    return raw ? result : result.trimEnd();
  };
  const plan = validate(git, TARGET);
  const source = git(["show", `${TARGET}:${RENDERER}`], true);
  if (hash(source) !== RENDERER_HASH) throw Error("Reviewed renderer changed");
  const loaded = new Module(APP + "/" + RENDERER, module);
  loaded.filename = APP + "/" + RENDERER;
  loaded.paths = Module._nodeModulePaths(APP + "/script/operator");
  loaded._compile(source, loaded.filename);
  const body = render(git(["show", `${TARGET}:script/operator/promote-inbound-status-list.sh`], true), loaded.exports.render, plan);
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Invalid generated command");
  console.log("OMNI_MSG_TARGET=" + TARGET);
  console.log("REZIM=IBA_BACKEND_BEZ_OBNOVY_DATABAZY");
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], { input: body, stdio: ["pipe", "inherit", "inherit"] });
  if (run.error) throw Error("Cannot start deployment");
  process.exitCode = run.status ?? 1;
}
module.exports = { BASE, PARENT, TARGET, TREE, RUNTIME, FIX_FILES, PREVIOUS_TOOL_FILES, TESTS, validate, render, once, removeSection };
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error("STOP: " + error.message.split("\n")[0]); process.exitCode = 1; }
}
