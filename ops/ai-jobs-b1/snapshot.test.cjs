"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {capture,compare}=require("./snapshot.cjs");
test("production evidence is read-only and never reads the secret Gateway file or outputs source credentials",()=>{
  const commands=[];
  const result=capture({
    envText:"DATABASE_URL=postgresql://app:synthetic-password@localhost/indexus_crm\nPORT=5000",
    read:p=>{assert(!p.endsWith("gateway.json"));return Buffer.from("synthetic-sensitive-bytes");},
    stat:()=>({ino:1,size:2,mtimeMs:3,ctimeMs:4,mode:0o640}),
    run:(cmd,args)=>{commands.push([cmd,args]);return cmd==="git"?"a".repeat(40):'LISTEN 0 511 *:5000 *:* users:(("node",pid=123,fd=1))';},
    admin:(port,db,sql)=>{assert(sql.includes("BEGIN READ ONLY"));assert.equal(db,"indexus_crm");
      if(sql.includes("to_regclass"))return "t";
      if(sql.includes("SELECT md5"))return "b".repeat(32);
      return JSON.stringify({dataAccess:false,sequenceAccess:false,definerAccess:false});},
  });
  assert.deepEqual(result.pids,[123]);assert(!JSON.stringify(result).includes("synthetic"));
  assert(commands.every(([cmd])=>cmd==="git"||cmd==="ss"));
  assert.equal(compare(result,result).productionBaselineMatched,true);
  assert.deepEqual(compare(result,{...result,settings:"changed"}).changed,["settings"]);
  assert.equal(compare({...result,pids:null},result).processContinuity,"unknown");
});
