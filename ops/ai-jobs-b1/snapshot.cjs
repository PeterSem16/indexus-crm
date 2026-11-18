"use strict";
// Read-only production evidence. No PM2 invocation or credential/environment dump.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const crypto=require("node:crypto"),cp=require("node:child_process");
const policy=require("./policy.cjs");
const {adminSQL,PRODUCTION_PRIVILEGES}=require("./prepare-db.cjs");
function capture({envText,admin=adminSQL,read=fs.readFileSync,stat=fs.statSync,run=cp.execFileSync}) {
  const target=policy.applicationTarget(envText),app=policy.APPLICATION;
  const head=()=>String(run("git",["-C",app,"rev-parse","HEAD"],{encoding:"utf8"})).trim();
  const source=head(),files={};
  for(const name of [".env","start.sh","package.json","package-lock.json","dist/index.cjs"])
    files[name]=crypto.createHash("sha256").update(read(path.join(app,name))).digest("hex");
  const loader="/etc/indexus-ai-runtime/preload.cjs";
  files[loader]=crypto.createHash("sha256").update(read(loader)).digest("hex");
  // The secret Gateway file is never read outside the approved runtime loader.
  const gateway=stat("/etc/indexus-ai-runtime/gateway.json");
  const gatewayMetadata={ino:gateway.ino,size:gateway.size,mtime:gateway.mtimeMs,ctime:gateway.ctimeMs,mode:gateway.mode};
  const settingsExist=admin(target.port,"indexus_crm",
    "BEGIN READ ONLY; SELECT to_regclass('public.ai_router_configuration') IS NOT NULL; ROLLBACK;")==="t";
  const settings=settingsExist?admin(target.port,"indexus_crm",`BEGIN READ ONLY;
    SELECT md5(json_build_object('version',version,'value',value)::text)
    FROM public.ai_router_configuration WHERE singleton=true; ROLLBACK;`):"not_present";
  policy.assert(settings==="not_present"||/^[a-f0-9]{32}$/.test(settings),"B1_SETTINGS_EVIDENCE_INVALID");
  const grants=JSON.parse(admin(target.port,"indexus_crm",PRODUCTION_PRIVILEGES));
  policy.assert(["dataAccess","sequenceAccess","definerAccess"].every(k=>grants[k]===false),
    "B1_PRODUCTION_PRIVILEGES_PRESENT_STOP");
  const portLine=envText.split(/\r?\n/).find(l=>/^PORT=/.test(l));
  const port=portLine?Number(portLine.slice(5).replace(/^(['"])(.*)\1$/,"$2")):5000;
  policy.assert(Number.isInteger(port)&&port>0&&port<=65535&&port!==15491,"B1_PRODUCTION_PORT_INVALID");
  let pids=null;
  try {
    const sockets=String(run("ss",["-ltnpH"],{encoding:"utf8"}));
    const found=sockets.split("\n").filter(l=>new RegExp(":"+port+"\\s").test(l))
      .flatMap(l=>[...l.matchAll(/pid=(\d+)/g)].map(m=>Number(m[1])));
    if(found.length)pids=[...new Set(found)].sort((a,b)=>a-b);
  }catch{/* Unknown process evidence must remain explicitly unknown. */}
  policy.assert(head()===source,"B1_PRODUCTION_SOURCE_MOVED_DURING_CAPTURE");
  return {version:1,source,files,gatewayMetadata,settings,pids,port,
    productionObjectPrivileges:false,runtimeAdmissionFlags:"not_inspected"};
}
function compare(before,after) {
  const changed=["source","files","gatewayMetadata","settings","port"]
    .filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]));
  if(before.pids&&after.pids&&JSON.stringify(before.pids)!==JSON.stringify(after.pids))changed.push("pids");
  return {productionBaselineMatched:changed.length===0,changed,
    processContinuity:before.pids&&after.pids?"compared":"unknown",
    runtimeAdmissionFlags:"not_inspected",productionObjectPrivileges:false};
}
function main() {
  policy.assert(os.hostname().split(".")[0].toUpperCase()==="CORPCRM01"&&process.getuid()===1001,
    "B1_AUTHORIZED_OPERATOR_REQUIRED");
  policy.assert(["--baseline","--compare"].includes(process.argv[2]),"B1_EXPLICIT_MODE_REQUIRED");
  const root=path.join(os.homedir(),"INDEXUS-AI-B1");
  policy.readPrivate(root);
  const file=path.join(root,"production-baseline.json");
  const baseline=process.argv[2]==="--baseline";
  policy.assert(baseline?!fs.existsSync(file):fs.existsSync(file),"B1_BASELINE_MODE_CONFLICT");
  if(!baseline) {
    const st=fs.lstatSync(file);
    policy.assert(st.isFile()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&(st.mode&0o077)===0,
      "B1_PRIVATE_BASELINE_REQUIRED");
  }
  const current=capture({envText:fs.readFileSync(path.join(policy.APPLICATION,".env"),"utf8")});
  if(baseline) {
    fs.writeFileSync(file,JSON.stringify(current)+"\n",{flag:"wx",mode:0o600});
    console.log(JSON.stringify({baselineWritten:true,productionHead:current.source,
      productionObjectPrivileges:false,processEvidence:current.pids?"recorded":"unknown",workerStarted:false}));
  } else {
    const result=compare(JSON.parse(fs.readFileSync(file,"utf8")),current);
    console.log(JSON.stringify(result));if(!result.productionBaselineMatched)process.exitCode=1;
  }
}
module.exports={capture,compare};
if(require.main===module)try{main();}catch(error){console.error(policy.safeError(error));process.exitCode=1;}
