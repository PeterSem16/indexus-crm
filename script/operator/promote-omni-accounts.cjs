#!/usr/bin/env node
// Pinned complete Omni release. Run only by the operator on CORPCRM01.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const { Module } = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "1f24432815b6c6f6100ea48941750b0fa8636483";
const TARGET = "ec7dd851c462e050c3430c6cce04ed679497e632";
const PARENT = "d732da992b68e96454a4be931710ccc56c0d6519";
const TREE = "97f1c118bbd99fe3532f765fff90a0b9155dc3b8";
const PATCH_HASH = "28840928cb84cb56217f0b68149974f5182fcdad8d9fbd000d56f0dc64ca7a0f";
const PATHS_HASH = "2a7b42c1e8be0e9bdff65e675cce0ecee854d4888dff00ab25d5c60ac814e554";
const RENDERER = "script/operator/promote-complete-replit.cjs";
const RENDERER_HASH = "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4";
const OLD_BACKEND = "4d8eb3185ccbd35804766fadd5c2c8e99f2a8603ade87e5994ef72319ef7eebb";
const OLD_INDEX = "eb2958a06270aad239559c103725bf0ee91259f64aaf60f9734c7a5ba38973ce";
const OLD_PID = 676516;
const TESTS = [
  "shared/omni-mailbox-groups.test.ts",
  "server/lib/omni-mailbox-group-routes.test.ts",
  "server/lib/omni-search-export.test.ts",
  "server/lib/omni-export-formats.test.ts",
  "server/lib/omni-export-signature.test.ts",
  "server/lib/omni-export-delivery-failures.test.ts",
  "client/src/lib/omni-mailbox-groups.test.ts",
  "client/src/lib/omni-export-search-context.test.ts",
];
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Reviewed promotion anchor changed");
  return text.replace(before, () => after);
}
function validate(git, target) {
  if (target !== TARGET || git(["rev-parse", "HEAD"]) !== BASE)
    throw Error("Unexpected target or production HEAD; return current state");
  if (git(["rev-parse", `${TARGET}^{tree}`]) !== TREE ||
      git(["rev-parse", `${TARGET}^`]) !== PARENT)
    throw Error("Pinned release tree or parent differs");
  git(["merge-base", "--is-ancestor", BASE, TARGET]);
  const paths = git(["diff", "--name-only", BASE, TARGET]).split("\n").filter(Boolean).sort();
  if (hash(paths.join("\n") + "\n") !== PATHS_HASH) throw Error("Release whitelist differs");
  for (const filename of ["package.json", "package-lock.json"])
    if (git(["rev-parse", `${BASE}:${filename}`]) !== git(["rev-parse", `${TARGET}:${filename}`]))
      throw Error("Installed dependencies differ");
  // The exact reviewed diff includes only the additive Omni groups table in
  // schema/startup; fingerprint all bytes rather than allowing arbitrary DDL.
  if (hash(git(["diff", "--binary", "--full-index", "--no-ext-diff", "--no-renames", BASE, TARGET], true)) !== PATCH_HASH)
    throw Error("Reviewed release patch differs");
  return { base: BASE, target: TARGET, paths };
}
const READINESS = String.raw`
PHASE=overenie_omni_databazy
sudo node - "$APP" "$NEW_PID" <<'VERIFY_OMNI_DATABASE'
const fs=require("node:fs"),path=require("node:path");
const [app,pid]=process.argv.slice(2);
async function verify(){
  if(!/^[1-9][0-9]*$/.test(pid))throw Error("Invalid process");
  const inherited=fs.readFileSync("/proc/"+pid+"/environ","utf8").split("\0")
    .find(value=>value.startsWith("DATABASE_URL="));
  const filename=path.join(app,".env");
  const parsed=fs.existsSync(filename)?require(path.join(app,"node_modules/dotenv")).parse(fs.readFileSync(filename)):{};
  const connection=inherited?inherited.slice("DATABASE_URL=".length):parsed.DATABASE_URL;
  if(!connection)throw Error("Missing database configuration");
  const {Client}=require(path.join(app,"node_modules/pg"));
  const client=new Client({connectionString:connection,connectionTimeoutMillis:5000,statement_timeout:5000});
  try{
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const result=await client.query("SELECT user_id, groups, revision, updated_at FROM nexus_omni_mailbox_groups LIMIT 0");
    const fields=result.fields.map(field=>[field.name,field.dataTypeID]);
    if(JSON.stringify(fields)!==JSON.stringify([["user_id",1043],["groups",3802],["revision",23],["updated_at",1184]]))
      throw Error("Incompatible Omni schema");
    await client.query("ROLLBACK");
  }finally{await client.end();}
  console.log("OMNI_DATABAZA_OK");
}
verify().catch(()=>{console.error("STOP: Omni database readiness failed; returning previous runtime, not restoring data.");process.exitCode=1;});
VERIFY_OMNI_DATABASE
[[ "$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/nexus/mailbox-groups)" == 401 ]] || stop "Omni API nema ocakavanu autentifikaciu"
`;
function render(git, plan) {
  if (plan.base !== BASE || plan.target !== TARGET ||
      hash(plan.paths.join("\n") + "\n") !== PATHS_HASH) throw Error("Invalid release plan");
  const source = git(["show", `${TARGET}:${RENDERER}`], true);
  if (hash(source) !== RENDERER_HASH) throw Error("Pinned promotion renderer differs");
  const filename = APP + "/" + RENDERER;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(APP + "/script/operator");
  loaded._compile(source, filename);
  let body = loaded.exports.render(
    git(["show", `${TARGET}:script/operator/promote-inbound-status-list.sh`], true), plan, [BASE]);
  body = once(body, ".complete-replit-", ".omni-accounts-");
  body = once(body,
    "for tool in git node npm npx sudo pm2 curl findmnt mountpoint flock tar sha256sum mount umount; do",
    "for tool in git node npm npx sudo pm2 curl findmnt mountpoint flock tar sha256sum mount umount pg_dump pg_restore; do");
  body = once(body, 'OLD_INDEX=$(sha256sum dist/public/index.html | awk \'{print $1}\')',
    `OLD_INDEX=$(sha256sum dist/public/index.html | awk '{print $1}')
[[ "$PID" == ${OLD_PID} && "$OLD_BACKEND" == ${OLD_BACKEND} && "$OLD_INDEX" == ${OLD_INDEX} ]] || stop "Zivy proces alebo build sa zmenil; vrat aktualny stav"`);
  body = once(body,
    "npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts",
    `NODE_ENV=test DATABASE_URL=postgresql://127.0.0.1:1/omni_deploy_test npx --no-install tsx --test --test-concurrency=2 ${TESTS.join(" ")}`);
  body = once(body,
    '{ tail -30 "$VIEW/tests.log"; stop "Testy zlyhali; nasadenie zastavene"; }',
    '{ grep -n -B 3 -A 30 \'^not ok\' "$VIEW/tests.log" || true; tail -30 "$VIEW/tests.log"; echo "TESTY_LOG=$STORE/build/tests.log" >&2; stop "Testy zlyhali; nasadenie zastavene"; }');
  body = once(body, 'cmp "$VIEW/dist/index.cjs" "$APP/dist/index.cjs"',
    'cmp "$VIEW/dist/index.cjs" "$APP/dist/index.cjs"\n' + READINESS);
  if (/reset --hard|git clean|npm install|npm ci|db:push|pg_restore[^]*?--clean/.test(body))
    throw Error("Unexpected destructive operation");
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
  const body = render(git, validate(git, TARGET));
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Invalid rendered deployment script");
  console.log("OMNI_ACCOUNTS_TARGET=" + TARGET);
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], {
    input: body, stdio: ["pipe", "inherit", "inherit"],
  });
  if (run.error) throw Error("Cannot start deployment");
  process.exitCode = run.status ?? 1;
}
module.exports = { BASE, TARGET, PARENT, TREE, PATCH_HASH, PATHS_HASH, OLD_BACKEND, OLD_INDEX, OLD_PID, TESTS, validate, render };
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`STOP: ${error.message.split("\n")[0]}`); process.exitCode = 1; }
}
