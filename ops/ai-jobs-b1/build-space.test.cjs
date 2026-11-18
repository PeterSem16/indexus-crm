"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
const {canaryPassed,approvedMount,command}=require("./build-space.cjs");
const {DATA,validSpace}=require("./space-policy.cjs");
test("B1 storage refuses another disk and inconclusive or readable HTTP canaries",()=>{
  assert(approvedMount("/dev/sdb1",DATA));
  assert(!approvedMount("/dev/sda1",DATA));assert(!approvedMount("/dev/sdb1","/tmp"));
  assert(canaryPassed(500,"permission denied","marker",true,200));
  for(const row of [[200,"marker","marker",true,200],[500,"error","marker",false,200],
    [500,"error","marker",true,500],[404,"marker","marker",true,200]])
    assert.equal(canaryPassed(...row),false);
  const state={version:1,source:"/private/source",parent:DATA+"/INDEXUS-AI-B1-Build-"+"a".repeat(36)};
  assert(validSpace("/private",state));assert(!validSpace("/other",state));
});
test("canary executes under the actual non-root UID, never by treating -u as a command",()=>{
  command(["/usr/bin/node","-e","fixture"],"CANARY",1001,(program,args)=>{
    assert.equal(program,"sudo");
    assert.deepEqual(args,["-n","-u","#1001","--","/usr/bin/node","-e","fixture"]);
    return {status:0};
  });
  assert.throws(()=>command(["node"],"CANARY",0,()=>({status:0})),/B1_CANARY_UID_INVALID/);
});
test("storage entry refuses an unauthorized host before any privileged operation",()=>{
  const result=spawnSync(process.execPath,["ops/ai-jobs-b1/build-space.cjs","--prepare"],
    {encoding:"utf8",env:{PATH:process.env.PATH}});
  assert.equal(result.status,1);assert.equal(result.stdout,"");
  assert.match(result.stderr,/B1_AUTHORIZED_OPERATOR_REQUIRED/);
});
