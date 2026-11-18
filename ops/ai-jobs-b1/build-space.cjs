"use strict";
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process");
const crypto=require("node:crypto"),policy=require("./policy.cjs");
const {DATA,validSpace}=require("./space-policy.cjs");
function canaryPassed(status,body,marker,denied,health) {
  return denied===true&&health===200&&[403,404,500].includes(status)&&!body.includes(marker);
}
function approvedMount(device,target) { return device==="/dev/sdb1"&&target===DATA; }
async function get(port,url) {
  const response=await fetch(`http://127.0.0.1:${port}${url}`,{redirect:"manual",signal:AbortSignal.timeout(5000)});
  let body="";
  for await(const bytes of response.body) {
    body+=Buffer.from(bytes).toString("utf8");
    policy.assert(Buffer.byteLength(body)<65536,"B1_HTTP_PROBE_TOO_LARGE");
  }
  return {status:response.status,body};
}
function command(args,phase,uid,execute=cp.spawnSync) {
  policy.assert(uid===undefined||(Number.isInteger(uid)&&uid>0),"B1_CANARY_UID_INVALID");
  const result=execute("sudo",["-n",...(uid===undefined?[]:["-u",`#${uid}`]),"--",...args],
    {encoding:"utf8",timeout:15000});
  policy.assert(!result.error&&result.status===0,`B1_SPACE_${phase}_FAILED`);
}
async function main() {
  policy.assert(os.hostname().split(".")[0].toUpperCase()==="CORPCRM01"&&process.getuid()===1001,
    "B1_AUTHORIZED_OPERATOR_REQUIRED");
  const mode=process.argv[2];
  policy.assert(["--prepare","--unmount"].includes(mode),"B1_EXPLICIT_MODE_REQUIRED");
  const root=path.join(os.homedir(),"INDEXUS-AI-B1"),file=path.join(root,"build-space.json");
  policy.readPrivate(root);
  if(mode==="--unmount") {
    const st=fs.lstatSync(file);
    policy.assert(st.isFile()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&(st.mode&0o077)===0,
      "B1_PRIVATE_SPACE_RECORD_REQUIRED");
    const state=JSON.parse(fs.readFileSync(file,"utf8"));
    policy.assert(validSpace(root,state)&&state.mounted===true,"B1_SPACE_RECORD_INVALID");
    policy.assert(!process.cwd().startsWith(state.source+"/")&&process.cwd()!==state.source,
      "B1_LEAVE_SOURCE_DIRECTORY_FIRST");
    command(["umount","--",state.source],"UNMOUNT");
    state.mounted=false;
    fs.writeFileSync(file,JSON.stringify(state)+"\n",{mode:0o600});
    console.log(JSON.stringify({unmounted:true,artifactsRetained:true,databaseUnchanged:true}));
    return;
  }
  policy.assert(!fs.existsSync(file)&&!fs.existsSync(path.join(root,"source")),"B1_SPACE_EXISTS_STOP");
  const readMount=column=>String(cp.execFileSync("findmnt",["-rn","-o",column,"-T",DATA],{encoding:"utf8"})).trim();
  policy.assert(approvedMount(readMount("SOURCE"),readMount("TARGET")),"B1_APPROVED_DATA_MOUNT_REQUIRED");
  const capacity=fs.statfsSync(DATA);
  policy.assert(capacity.bavail*capacity.bsize>2*1024**3,"B1_DATA_CAPACITY_REQUIRED");
  const baseline=JSON.parse(fs.readFileSync(path.join(root,"production-baseline.json"),"utf8"));
  policy.assert(Array.isArray(baseline.pids)&&baseline.pids.length>0,"B1_PRODUCTION_PID_EVIDENCE_REQUIRED");
  const uids=[...new Set(baseline.pids.map(pid=>{
    policy.assert(Number.isInteger(pid)&&pid>1,"B1_PRODUCTION_PID_INVALID");
    return fs.statSync(`/proc/${pid}`).uid;
  }))];
  policy.assert(uids.length===1&&uids[0]>0,"B1_NONROOT_PRODUCTION_UID_REQUIRED");
  const health=await get(baseline.port,"/login");
  policy.assert(health.status===200&&health.body.includes("INDEXUS"),"B1_PRODUCTION_HEALTH_REQUIRED");
  const state={version:1,source:path.join(root,"source"),parent:path.join(DATA,"INDEXUS-AI-B1-Build-"+crypto.randomUUID()),
    mounted:false,privacyVerified:false};
  fs.writeFileSync(file,JSON.stringify(state)+"\n",{flag:"wx",mode:0o600});
  try {
    command(["mkdir","-m","0700","--",state.parent],"PRIVATE_PARENT");
    command(["install","-d","-m","0700","-o","1001","-g","1001",path.join(state.parent,"source")],"PRIVATE_SOURCE");
    fs.mkdirSync(state.source,{mode:0o700});
    command(["mount","--bind","--",path.join(state.parent,"source"),state.source],"MOUNT");
    state.mounted=true;
    const source=fs.statSync(state.source),parent=fs.statSync(state.parent);
    policy.assert(source.dev===fs.statSync(DATA).dev&&parent.uid===0&&(parent.mode&0o777)===0o700,
      "B1_PRIVATE_DATA_VIEW_REQUIRED");
    const marker="INDEXUS_B1_PRIVATE_"+crypto.randomUUID(),name="B1-HTTP-CANARY.txt";
    fs.writeFileSync(path.join(state.source,name),marker,{flag:"wx",mode:0o600});
    const canary=path.join(state.parent,"source",name);
    const probe=`if(process.getuid()!==Number(process.argv[2]))process.exit(72);
      try{require("fs").readFileSync(process.argv[1]);process.exit(70)}
      catch(e){process.exit(e.code==="EACCES"?0:71)}`;
    command([process.execPath,"-e",probe,canary,String(uids[0])],"CANARY_EACCES",uids[0]);
    const response=await get(baseline.port,`/data/${path.basename(state.parent)}/source/${name}`);
    policy.assert(canaryPassed(response.status,response.body,marker,true,health.status),"B1_HTTP_PRIVACY_REQUIRED");
    Object.assign(state,{privacyVerified:true,sourceDevice:source.dev,sourceInode:source.ino});
    fs.writeFileSync(file,JSON.stringify(state)+"\n",{mode:0o600});
    console.log(JSON.stringify({privateDataView:true,httpCanaryStatus:response.status,
      nodeRead:"EACCES",workerStarted:false}));
  }catch(error) {
    if(state.mounted) {
      try { command(["umount","--",state.source],"ERROR_UNMOUNT");state.mounted=false; }
      catch { console.error("B1_SPACE_ERROR_UNMOUNT_FAILED"); }
    }
    fs.writeFileSync(file,JSON.stringify(state)+"\n",{mode:0o600});
    throw error;
  }
}
module.exports={canaryPassed,approvedMount,command};
if(require.main===module)main().catch(error=>{console.error(policy.safeError(error));process.exitCode=1;});
