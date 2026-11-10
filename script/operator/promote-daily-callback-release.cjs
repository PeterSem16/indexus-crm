#!/usr/bin/env node
"use strict";
// Operator-only release: immutable application commit plus this reviewed runner.
// No SSH, installation, approval rewrite, historical replay or database restore.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "126e2119235da6e10ce005a2b5e58cbc8469938d";
const APPLICATION = "1d05bfb077d65b1e42255a81d6840ebd659f5a1f";
const APPLICATION_TREE = "00c59cb110b3233d0add3b295884d6bd6e31712b";
const PATHS_HASH = "6a9836e5679c7d72badd8088ed0b19f7a03a3db7067a508c72b30337e970672b";
const RENDERER = "script/operator/promote-complete-replit.cjs";
const RENDERER_HASH = "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4";
const RUNTIME = {
  backend: "26b96c80cd27057763ebbfcece23e9371eaa5d907b002410d3b0f644e5843c6e",
  index: "d2d7029323cc049797f66c6fdfd92754f9ed7951bd9585d6f320b52757c9d452",
};
const TOOLS = [
  "script/operator/promote-daily-callback-release.cjs",
  "script/operator/promote-daily-callback-release.test.cjs",
];
const TESTS = [
  "shared/status-list-transition.test.ts",
  "server/lib/status-list-transition-inventory.test.ts",
  "client/src/lib/callback-request-identity.test.ts",
  "shared/bank-account.test.ts",
  "server/lib/region-suggestion.test.ts",
  "server/lib/mission-contact-loads.test.ts",
];
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Reviewed promotion anchor changed");
  return text.replace(before, () => after);
}
function validate(git, target) {
  if (!/^[a-f0-9]{40}$/.test(target) || git(["rev-parse", "HEAD"]) !== BASE)
    throw Error("Production HEAD changed; stop and review it");
  if (git(["rev-parse", `${target}^`]) !== APPLICATION ||
    git(["rev-parse", `${APPLICATION}^{tree}`]) !== APPLICATION_TREE)
    throw Error("Release is not the pinned application plus its operator tools");
  git(["merge-base", "--is-ancestor", BASE, APPLICATION]);
  const applicationPaths = git(["diff", "--name-only", BASE, APPLICATION]).split("\n").filter(Boolean).sort();
  if (hash(applicationPaths.join("\n") + "\n") !== PATHS_HASH)
    throw Error("Daily application whitelist differs");
  const toolPaths = git(["diff", "--name-only", APPLICATION, target]).split("\n").filter(Boolean).sort();
  if (JSON.stringify(toolPaths) !== JSON.stringify([...TOOLS].sort()))
    throw Error("Operator commit also changes application files");
  for (const name of ["package.json", "package-lock.json", "script/build.ts", "script/build-server.ts",
    "vite.config.ts", "tailwind.config.ts", "postcss.config.js", "tsconfig.json"]) {
    if (git(["rev-parse", `${BASE}:${name}`]) !== git(["rev-parse", `${target}:${name}`]))
      throw Error("Dependencies or build pipeline changed");
  }
  const paths = git(["diff", "--name-only", BASE, target]).split("\n").filter(Boolean).sort();
  if (JSON.stringify(paths) !== JSON.stringify([...applicationPaths, ...TOOLS].sort()))
    throw Error("Full release whitelist differs");
  if (git(["diff", "--name-only", "--diff-filter=D", BASE, target]))
    throw Error("This release must not delete files");
  return { base: BASE, target, paths };
}

// Capture only configuration, never contact contents. Read the verified live
// process's connection privately; values are never passed as CLI arguments.
const APPROVAL_CHECK = String.raw`
approval_check() {
  sudo node - "$APP" "$STORE/backup" "$1" "$2" <<'DAILY_APPROVAL'
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const [app,backup,pid,mode]=process.argv.slice(2);
const stable=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==="object"&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
async function run(){
  if(!/^[0-9]+$/.test(pid)||!["capture","verify"].includes(mode))throw Error("Invalid check");
  const connection=fs.readFileSync("/proc/"+pid+"/environ","utf8").split("\0")
    .find(x=>x.startsWith("DATABASE_URL="))?.slice(13) ||
    require(path.join(app,"node_modules/dotenv")).parse(fs.readFileSync(path.join(app,".env"))).DATABASE_URL;
  if(!connection)throw Error("Missing database configuration");
  const {Client}=require(path.join(app,"node_modules/pg"));
  const client=new Client({connectionString:connection,connectionTimeoutMillis:10000});
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='10s'");
    const mission="a65e7775-885c-4413-b2be-e63c92decd3d";
    const owners=(await client.query("SELECT * FROM mission_callback_ownership WHERE campaign_id=$1",[mission])).rows;
    const candidates=(await client.query("SELECT * FROM mission_callback_candidates WHERE campaign_id=$1 ORDER BY automation_id",[mission])).rows;
    if(owners.length!==1||owners[0].owner!=="compatible"||!owners[0].fingerprint||!candidates.length||
      candidates.some(c=>c.source_fingerprint!==owners[0].fingerprint))throw Error("Unexpected callback approval");
    const bytes=stable({owners,candidates}),file=path.join(backup,"callback-approvals.json");
    if(mode==="capture")fs.writeFileSync(file,bytes,{mode:0o600,flag:"wx"});
    else {
      if(bytes!==fs.readFileSync(file,"utf8"))throw Error("Callback approval changed");
      await client.query("SELECT bank_account_name,bank_account_number,bank_code,bank_account_iban FROM clinics LIMIT 0");
      await client.query("SELECT id FROM mission_contact_loads LIMIT 0");
      await client.query("SELECT id FROM representative_distribution_plans LIMIT 0");
      await client.query("SELECT id FROM representative_distribution_items LIMIT 0");
      console.log("CALLBACK_SCHVALENIA_NEZMENENE="+crypto.createHash("sha256").update(bytes).digest("hex"));
      console.log("DOPLNKOVA_SCHEMA_OK");
    }
    await client.query("COMMIT");
  } finally { await client.end(); }
}
run().catch(()=>{console.error("STOP: Read-only approval/schema check failed; private backup retained.");process.exitCode=1;});
DAILY_APPROVAL
}
`;

function render(git, plan) {
  if (plan.base !== BASE || !/^[a-f0-9]{40}$/.test(plan.target) ||
    plan.paths.length !== 63 || !TOOLS.every(name => plan.paths.includes(name)) ||
    hash(plan.paths.filter(name => !TOOLS.includes(name)).sort().join("\n") + "\n") !== PATHS_HASH)
    throw Error("Invalid pinned release plan");
  const source = git(["show", `${APPLICATION}:${RENDERER}`], true);
  if (hash(source) !== RENDERER_HASH) throw Error("Pinned promotion renderer changed");
  const filename = `${APP}/${RENDERER}`, loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(`${APP}/script/operator`);
  loaded._compile(source, filename);
  let body = loaded.exports.render(
    git(["show", `${APPLICATION}:script/operator/promote-inbound-status-list.sh`], true), plan, [BASE]);
  body = once(body, ".complete-replit-", ".daily-callback-release-");
  body = once(body, 'OLD_INDEX=$(sha256sum dist/public/index.html | awk \'{print $1}\')',
    `OLD_INDEX=$(sha256sum dist/public/index.html | awk '{print $1}')
[[ "$OLD_BACKEND" == ${RUNTIME.backend} ]] || stop "Zivy backend sa zmenil od poslednej kontroly"
[[ "$OLD_INDEX" == ${RUNTIME.index} ]] || stop "Zivy frontend sa zmenil od poslednej kontroly"`);
  body = once(body,
    'e.pm_exec_path!=="/var/www/indexus-crm/dist/index.cjs"||!(p.pid>0))throw 0;',
    'e.pm_exec_path!=="/var/www/indexus-crm/dist/index.cjs"||' +
    '(e.watch&&(!Array.isArray(e.watch)||e.watch.length))||' +
    'Number(e.PORT||e.env?.PORT||5000)!==5000||!(p.pid>0))throw 0;');
  body = once(body, "for tool in git node npm npx sudo pm2 curl findmnt mountpoint flock tar sha256sum mount umount; do",
    "for tool in git node npm npx sudo pm2 curl findmnt mountpoint flock tar sha256sum mount umount pg_dump pg_restore ps stat du xargs; do");
  body = once(body, "PHASE=zostavenie\n",
    `${APPROVAL_CHECK}\nPHASE=ulozenie_callback_schvalenia\napproval_check "$PID" capture\nPHASE=zostavenie\n`);
  body = once(body,
    "npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    `NODE_ENV=test DATABASE_URL=postgresql://127.0.0.1:1/daily_release_unit npx --no-install tsx --test ${TESTS.join(" ")}`);
  body = once(body, "COMPLETED=1\n",
    'PHASE=overenie_schemy_a_schvaleni\napproval_check "$NEW_PID" verify\nCOMPLETED=1\n');
  body = once(body,
    '    echo "STOP: faza=$PHASE; sukromna zaloha=${STORE:-nevytvorena}" >&2',
    `    echo "STOP: faza=$PHASE; sukromna zaloha=\${STORE:-nevytvorena}" >&2
    if [[ -n "$STORE" ]]; then
      printf '%s\\n' "phase=$PHASE" "exit=$rc" | sudo tee "$STORE/failure.txt" >/dev/null
      sudo chmod 600 "$STORE/failure.txt"
    fi`);
  if (/npm install|npm ci|db:push|DROP TABLE|reset --hard|git clean|pg_restore[^\n]*--clean/.test(body))
    throw Error("Unexpected installation or destructive operation");
  return body;
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply" || !/^[a-f0-9]{40}$/.test(args[1]))
    throw Error("Use --apply PINNED_OPERATOR_COMMIT as seman on CORPCRM01");
  const git = (args, raw = false) => {
    const value = cp.execFileSync("git", ["-C", APP, ...args], {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
    return raw ? value : value.trimEnd();
  };
  const body = render(git, validate(git, args[1]));
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Rendered promotion script does not parse");
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], {
    input: body, stdio: ["pipe", "inherit", "inherit"],
  });
  if (run.error) throw Error("Cannot start promotion");
  process.exitCode = run.status ?? 1;
}
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`STOP: ${error.message.split("\n")[0]}`); process.exitCode = 1; }
}
module.exports = { BASE, APPLICATION, APPLICATION_TREE, PATHS_HASH, RUNTIME, TOOLS, TESTS, validate, render, main };
