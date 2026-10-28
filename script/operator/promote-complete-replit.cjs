#!/usr/bin/env node
// Reuse the reviewed, fail-closed CORPCRM01 promotion procedure. Each template
// transformation requires one exact anchor; a template change stops preparation.
const crypto = require("node:crypto");
const cp = require("node:child_process");
const APP = "/var/www/indexus-crm";
const PARENT = "cb8c778a4236c84d13e078ea14f4f725cae4757d";
const BASES = [
  "e0639bbc8e0cb741866f1f8189a23ae626e30cdd",
  "f099321be58dd1f1ff8d39a8d7bb0f7212d504cd",
  PARENT,
];
const TEMPLATE_HASH = "4673575d937530143f0a16fa65537b271b471c687c4feda6f0dbf100efd46b20";
const FILES = [
  "client/src/components/clinic-agreements-panel.tsx",
  "client/src/components/hospital-agreement-copy.test.ts",
  "client/src/components/hospital-agreement-copy.ts",
  "client/src/components/hospital-form-wizard.tsx",
  "client/src/pages/hospitals.tsx",
  "script/operator/promote-complete-replit.cjs",
  "script/operator/promote-complete-replit.test.cjs",
  "server/index.ts",
  "server/lib/clinic-agreement-routes.ts",
  "server/lib/hospital-agreement-contract.ts",
  "server/lib/hospital-agreement-routes.test.ts",
  "server/lib/provider-finder-store.ts",
  "shared/schema.ts",
].sort();

const DATABASE_BACKUP = String.raw`
PHASE=zaloha_databazy_a_konfiguracie
git archive --format=tar --output="$VIEW/previous-source.tar" "$BASE"
sudo mv -- "$VIEW/previous-source.tar" "$STORE/backup/source.tar"
sudo chmod 600 "$STORE/backup/source.tar"
sudo node - "$APP" "$STORE/backup" "$PID" <<'DATABASE_BACKUP'
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const [app,backup,pid]=process.argv.slice(2);
async function run(){
  if(!/^[0-9]+$/.test(pid))throw Error("Unverified process");
  const filename=path.join(app,".env");
  const parsed=fs.existsSync(filename)?require(path.join(app,"node_modules/dotenv")).parse(fs.readFileSync(filename)):{};
  const inherited=fs.readFileSync("/proc/"+pid+"/environ","utf8").split("\0")
    .find(s=>s.startsWith("DATABASE_URL="));
  const connection=inherited?inherited.slice("DATABASE_URL=".length):parsed.DATABASE_URL;
  if(!connection)throw Error("Missing database configuration");
  const u=new URL(connection);
  if(!["postgres:","postgresql:"].includes(u.protocol))throw Error("Unexpected database provider");
  const env={...process.env,PGHOST:u.hostname,PGPORT:u.port||"5432",
    PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGUSER:decodeURIComponent(u.username),
    PGPASSWORD:decodeURIComponent(u.password)};
  if(!env.PGDATABASE||!env.PGUSER)throw Error("Incomplete database configuration");
  const parameters={sslmode:"PGSSLMODE",sslcert:"PGSSLCERT",sslkey:"PGSSLKEY",
    sslrootcert:"PGSSLROOTCERT",sslcrl:"PGSSLCRL",gssencmode:"PGGSSENCMODE",
    connect_timeout:"PGCONNECT_TIMEOUT"};
  for(const [k,v] of u.searchParams)if(parameters[k])env[parameters[k]]=v;
  const {Client}=require(path.join(app,"node_modules/pg"));
  const client=new Client({connectionString:connection});
  let size;
  try{await client.connect();size=Number((await client.query(
    "SELECT pg_database_size(current_database()) AS size")).rows[0].size);}
  finally{await client.end();}
  const space=fs.statfsSync(backup);
  if(!Number.isFinite(size)||size<=0||space.bsize*space.bavail<size*2+10*1024**3)
    throw Error("Insufficient data-disk capacity for database backup and build");
  const log=fs.openSync(path.join(backup,"database-backup.log"),"wx",0o600);
  try{
    cp.execFileSync("pg_dump",["--format=custom","--no-owner","--no-acl","--no-password",
      "--file",path.join(backup,"database.dump")],{env,stdio:["ignore","ignore",log]});
    cp.execFileSync("pg_restore",["--list",path.join(backup,"database.dump")],
      {env,stdio:["ignore","ignore",log]});
  }finally{fs.closeSync(log);}
  const dump=path.join(backup,"database.dump");
  fs.chmodSync(dump,0o600);
  if(fs.statSync(dump).size===0)throw Error("Empty database backup");
  if(fs.existsSync(filename)){
    fs.copyFileSync(filename,path.join(backup,"application.env"));
    fs.chmodSync(path.join(backup,"application.env"),0o600);
  }
  console.log("ZALOHA_DATABAZY_OK");
}
run().catch(()=>{console.error("STOP: Database backup failed; live application unchanged. See private backup log.");process.exitCode=1;});
DATABASE_BACKUP
`;

const VERIFY_ALL_SOURCES = String.raw`
  node - "$APP" "$expected_commit" <<'VERIFY_APPLICATION_SOURCES'
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const [app,commit]=process.argv.slice(2);
const raw=cp.execFileSync("git",["-C",app,"ls-tree","-rz",commit,"--",
  "client/src","server","shared","public","package.json","package-lock.json",
  "vite.config.ts","tsconfig.json","script/build.ts","script/build-server.ts"],
  {encoding:"utf8",maxBuffer:8*1024*1024});
for(const row of raw.split("\0").filter(Boolean)){
  const tab=row.indexOf("\t"),[mode,type,expected]=row.slice(0,tab).split(" "),name=row.slice(tab+1);
  if(type!=="blob"||name.startsWith("/")||name.split("/").includes(".."))throw Error("Invalid source entry");
  const filename=path.join(app,name),st=fs.lstatSync(filename);
  let bytes;
  if(mode==="120000"){if(!st.isSymbolicLink())throw Error("Source type changed: "+name);bytes=Buffer.from(fs.readlinkSync(filename));}
  else{if(!st.isFile()||st.isSymbolicLink())throw Error("Source type changed: "+name);bytes=fs.readFileSync(filename);}
  const actual=crypto.createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
  if(actual!==expected)throw Error("Application source differs: "+name);
}
VERIFY_APPLICATION_SOURCES
`;

function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Promotion template anchor changed");
  return text.replace(before, () => after);
}
function render(template, { base, target, paths }, approvedBases = BASES) {
  if (!approvedBases.includes(base) || !/^[a-f0-9]{40}$/.test(base) || !/^[a-f0-9]{40}$/.test(target)) throw Error("Unreviewed base/target");
  if (!paths.length || paths.some(p => !/^[a-zA-Z0-9_./-]+$/.test(p))) throw Error("Invalid release paths");
  if (crypto.createHash("sha256").update(template).digest("hex") !== TEMPLATE_HASH)
    throw Error("Reviewed promotion template changed");
  let result = once(template, "BASE=0364e2bb907f0c265fd69d5a31f5bb32b19ce115", `BASE=${base}`);
  result = once(result, "TARGET=e0639bbc8e0cb741866f1f8189a23ae626e30cdd", `TARGET=${target}`);
  result = once(result,
    '[[ "$(git rev-parse "$TARGET^")" == "$INBOUND" ]] || stop "Nespravny rodic spolocnej opravy"\n[[ "$(git rev-parse "$INBOUND^")" == "$BASE" ]] || stop "Nespravny povodny zaklad"',
    'git merge-base --is-ancestor "$BASE" "$TARGET" || stop "Nespravna historia vydania"');
  const expectedLine = result.split("\n").filter(line => line.startsWith("EXPECTED=$'"));
  if (expectedLine.length !== 1) throw Error("Missing scope gate");
  result = once(result, expectedLine[0], `EXPECTED=$'${[...paths].sort().join("\\n")}'`);
  result = once(result, '  done <<<"$EXPECTED"\n}', '  done <<<"$EXPECTED"\n' + VERIFY_ALL_SOURCES + "}");
  result = once(result, 'sudo chmod 600 "$STORE/release.txt" "$STORE/backup/dist.tar"',
    'sudo chmod 600 "$STORE/release.txt" "$STORE/backup/dist.tar"\n' + DATABASE_BACKUP);
  // Never execute the DB-backed hospital CRUD tests against a live database.
  result = once(result,
    "tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts",
    "tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts");
  result = once(result, ".inbound-status-list-", ".complete-replit-");
  return result;
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply" || !/^[a-f0-9]{40}$/.test(args[1]))
    throw Error("Use --apply PINNED_RELEASE_COMMIT on CORPCRM01 as seman");
  const target = args[1];
  const git = a => cp.execFileSync("git", ["-C", APP, ...a], {
    encoding: "utf8", maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const base = git(["rev-parse", "HEAD"]);
  if (!BASES.includes(base)) throw Error("Unexpected production HEAD; do not overwrite it");
  if (git(["rev-parse", `${target}^`]) !== PARENT) throw Error("Unexpected release parent");
  const delta = git(["diff", "--name-only", PARENT, target]).split("\n").filter(Boolean).sort();
  if (JSON.stringify(delta) !== JSON.stringify(FILES)) throw Error("Release scope differs");
  const template = cp.execFileSync("git", ["-C", APP, "show",
    `${target}:script/operator/promote-inbound-status-list.sh`], { encoding: "utf8", maxBuffer: 1024 * 1024 });
  const paths = git(["diff", "--name-only", base, target]).split("\n").filter(Boolean);
  const body = render(template, { base, target, paths });
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], {
    input: body, stdio: ["pipe", "inherit", "inherit"], maxBuffer: 1024 * 1024,
  });
  if (run.error) throw Error("Cannot start promotion");
  process.exitCode = run.status ?? 1;
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`STOP: ${error.message.split("\n")[0]}`); process.exitCode = 1; }
}
module.exports = { render, FILES, BASES, PARENT };
