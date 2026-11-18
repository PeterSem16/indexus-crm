"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {capture,compare}=require("./snapshot.cjs");
test("production evidence is read-only and never reads the secret Gateway file or outputs source credentials",()=>{
  const commands=[],reads=[];
  const result=capture({
    envText:"DATABASE_URL=postgresql://app:synthetic-password@localhost/indexus_crm\nPORT=5000",
    read:p=>{reads.push(p);assert(!p.endsWith("gateway.json"));
      assert.notEqual(p,"/var/www/indexus-crm/ops/ai-gateway/preload.cjs");
      return Buffer.from("synthetic-sensitive-bytes");},
    stat:()=>({ino:1,size:2,mtimeMs:3,ctimeMs:4,mode:0o640}),
    run:(cmd,args)=>{commands.push([cmd,args]);return cmd==="git"?"a".repeat(40):'LISTEN 0 511 *:5000 *:* users:(("node",pid=123,fd=1))';},
    admin:(port,db,sql)=>{assert(sql.includes("BEGIN READ ONLY"));assert.equal(db,"indexus_crm");
      if(sql.includes("to_regclass"))return "t";
      if(sql.includes("SELECT md5"))return "b".repeat(32);
      return JSON.stringify({dataAccess:false,sequenceAccess:false,definerAccess:false});},
  });
  assert.deepEqual(result.pids,[123]);assert(!JSON.stringify(result).includes("synthetic"));
  assert(reads.includes("/etc/indexus-ai-runtime/preload.cjs"));
  assert.match(result.files["/etc/indexus-ai-runtime/preload.cjs"],/^[a-f0-9]{64}$/);
  assert(commands.every(([cmd])=>cmd==="git"||cmd==="ss"));
  assert.equal(compare(result,result).productionBaselineMatched,true);
  assert.deepEqual(compare(result,{...result,settings:"changed"}).changed,["settings"]);
  assert.equal(compare({...result,pids:null},result).processContinuity,"unknown");
});
test("launcher loads only the installed runtime loader after environment cleanup, never its absent repository source",()=>{
  const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
  const source="/home/operator/INDEXUS-AI-B1/source",loaded=[];
  const env={NODE_OPTIONS:"untrusted-inherited-options",HOME:"/home/operator",PATH:"/usr/bin"};
  const processStub={env,argv:["node","launch.cjs","check"],getuid:()=>1001,cwd:()=>source};
  const policy=require("./policy.cjs");
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"launch.cjs"),"utf8"),{
    process:processStub,URL,
    console:{error:message=>assert.fail(message)},
    require:name=>{
      if(name==="node:fs")return {realpathSync:p=>p,lstatSync:()=>({
        isFile:()=>true,isSymbolicLink:()=>false,uid:1001,mode:0o600})};
      if(name==="node:path")return path;
      if(name==="node:os")return {hostname:()=>"CORPCRM01",homedir:()=>"/home/operator"};
      if(name==="./policy.cjs")return {...policy,readPrivate:()=>({
        host:"127.0.0.1",port:5432,user:"indexus_ai_b1",database:"indexus_ai_b1",password:"synthetic"})};
      if(name==="./space-policy.cjs")return {assertPrivateSpace:()=>{}};
      if(name==="./build-policy.cjs")return {verifyBuild:()=>({
        entry:source+"/dist/ai-b1.cjs",release:{commit:"a".repeat(40)}})};
      if(name==="/etc/indexus-ai-runtime/preload.cjs"){
        assert.equal(env.NODE_OPTIONS,undefined);
        assert.equal(new URL(env.DATABASE_URL).pathname,"/indexus_ai_b1");
        env.INDEXUS_AI_GATEWAY_ENABLED="true";env.INDEXUS_AI_ROUTER_MODE="routed";
        loaded.push(name);return;
      }
      assert.equal(name,source+"/dist/ai-b1.cjs");
      loaded.push(name);
    },
  });
  assert.equal(processStub.exitCode,undefined);
  assert.deepEqual(loaded,["/etc/indexus-ai-runtime/preload.cjs",source+"/dist/ai-b1.cjs"]);
});
