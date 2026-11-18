"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const policy = require("./policy.cjs");
const { prepare, adminSQL, diagnose } = require("./prepare-db.cjs");
const envText = "DATABASE_URL='postgresql://app:synthetic@127.0.0.1:5543/indexus_crm'\n";
const freshRole = { owner: policy.DATABASE, memberships: 0,
  login:false,superuser:false,createdb:false,createrole:false,replication:false,bypass:false,inherit:false,passwordSet:false };
test("target parsing returns no source credentials and refuses remote or wrong databases", () => {
  assert.deepEqual(policy.applicationTarget(envText), { host:"127.0.0.1",port:5543 });
  for (const text of ["", envText.replace("127.0.0.1","external.invalid"), envText.replace("/indexus_crm","/postgres"),
    envText.replace("postgresql:","https:")]) assert.throws(() => policy.applicationTarget(text), /B1_/);
});
test("SCRAM verifier agrees with an independently derived client key and does not contain plaintext", () => {
  const password="synthetic-password", salt=Buffer.alloc(16,7), verifier=policy.scram(password,salt);
  const salted=crypto.pbkdf2Sync(password,salt,4096,32,"sha256");
  const client=crypto.createHmac("sha256",salted).update("Client Key").digest();
  assert.equal(verifier.split("$")[2].split(":")[0],crypto.createHash("sha256").update(client).digest("base64"));
  assert(!verifier.includes(password));
});
test("administrator calls send SQL over stdin, not arguments, and redact failures", () => {
  const secret="synthetic-not-a-real-password";
  assert.equal(adminSQL(5543,"postgres",secret,(command,args,options) => {
    assert.equal(command,"sudo"); assert(args.includes("-n")); assert(!args.join(" ").includes(secret));
    assert(options.input.includes(secret)); return { status:0,stdout:"{}\n" };
  }),"{}");
  assert.throws(() => adminSQL(5543,"postgres",secret,()=>({status:1,stderr:secret})),error=>
    error.message==="B1_ADMIN_OPERATION_FAILED" && !error.message.includes(secret));
});
test("diagnostic reports phase and SQLSTATE without exposing SQL, credentials or raw stderr", () => {
  const root=path.join(os.tmpdir(),"b1-nonexistent-"+crypto.randomUUID());
  for(const failure of [
    {stderr:"sudo: a password is required; sensitive-verifier",kind:"sudo_authentication_required",state:null},
    {stderr:"psql:<stdin>:9: ERROR:  42809\nsensitive-verifier",kind:"sql_failed",state:"42809"},
  ]){
    let calls=0;
    const result=diagnose({root,envText,admin:(port,db,sql)=>{
      calls++;
      assert(sql.includes("BEGIN READ ONLY")); assert(!sql.includes("ALTER ROLE"));
      if(calls===1)return JSON.stringify({admin:true,port});
      return adminSQL(port,db,sql,()=>({status:1,stderr:failure.stderr}));
    }});
    assert.equal(result.ok,false); assert.equal(result.phases[1].phase,"testRole");
    assert.equal(result.phases[1].kind,failure.kind);assert.equal(result.phases[1].sqlstate,failure.state);
    assert.equal(result.privateConfigExists,false);assert(!JSON.stringify(result).includes("sensitive"));
    assert.equal(fs.existsSync(root),false);assert.equal(calls,2);
  }
});
test("read-only diagnostics preserve an existing private configuration without reading or replacing it", () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"b1-diag-"));
  const file=path.join(root,"private.json");fs.writeFileSync(file,"do-not-read-or-rotate",{mode:0o600});
  try {
    const result=diagnose({root,envText,admin:()=>JSON.stringify({checked:true})});
    assert.equal(result.ok,true);assert.equal(result.phases.length,4);assert.equal(result.privateConfigExists,true);
    assert.equal(fs.readFileSync(file,"utf8"),"do-not-read-or-rotate");
    assert(!JSON.stringify(result).includes("do-not-read"));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("private credentials, target marker and no re-run rotation", async () => {
  const root=path.join(fs.mkdtempSync(path.join(os.tmpdir(),"b1-policy-")),"private");
  let nonce, alter=0, prodReads=0;
  class Client {
    constructor(config){ assert.equal(config.user,policy.DATABASE);assert.equal(config.port,5543); }
    on(){} async connect(){} async end(){}
    async query(sql,args) {
      if(sql.includes("INSERT INTO public.b1_environment")) nonce=args[0];
      if(sql.includes('current_database()')) return {rows:[{database:policy.DATABASE,user:policy.DATABASE,
        rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,rolinherit:false,membership:false}]};
      if(sql.includes("SELECT nonce")) return {rows:[{nonce}]};
      return {rows:[]};
    }
  }
  const admin=(port,database,sql)=>{
    if(sql.includes("ALTER ROLE")){alter++;assert(sql.includes("SCRAM-SHA-256$"));return "";}
    if(database==="indexus_crm"){prodReads++;assert(!/\b(UPDATE|DELETE|INSERT|ALTER)\s/i.test(sql.replaceAll(/'[^']*'/g,"''")));
      return JSON.stringify({dataAccess:false,sequenceAccess:false,definerAccess:false});}
    return JSON.stringify(sql.includes("'objects'")?{objects:0}:freshRole);
  };
  try {
    assert.equal((await prepare({root,envText,Client,admin})).workerStarted,false);
    const config=policy.readPrivate(root);assert.equal(config.nonce,nonce);assert.equal(alter,1);assert.equal(prodReads,1);
    assert.equal(fs.statSync(path.join(root,"private.json")).mode & 0o777,0o600);
    await assert.rejects(prepare({root,envText,Client,admin}),/B1_CONFIG_EXISTS/);assert.equal(alter,1);
  } finally {fs.rmSync(path.dirname(root),{recursive:true,force:true});}
});
test("unsafe privilege, role or existing data stops before creating credentials or enabling login", async () => {
  for(const mode of ["role","grant","data"]) {
    const root=path.join(fs.mkdtempSync(path.join(os.tmpdir(),"b1-deny-")),"private");
    let mutations=0;
    try {
      await assert.rejects(prepare({root,envText,Client:class{},admin:(port,db,sql)=>{
        if(sql.includes("ALTER ROLE")){mutations++;return "";}
        if(db==="indexus_crm") return JSON.stringify({dataAccess:mode==="grant",sequenceAccess:false,definerAccess:false});
        return JSON.stringify(sql.includes("'objects'")?{objects:mode==="data"?1:0}:
          {...freshRole,superuser:mode==="role"});
      }}),/B1_/);
      assert.equal(mutations,0);assert.equal(fs.existsSync(path.join(root,"private.json")),false);
    } finally {fs.rmSync(path.dirname(root),{recursive:true,force:true});}
  }
});
test("symlink and world-readable configuration cannot become a test environment", () => {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),"b1-path-"));
  try {
    const absent=path.join(base,"absent");
    assert.throws(()=>policy.readPrivate(absent));
    assert.equal(fs.existsSync(absent),false);
    const root=path.join(base,"root");fs.mkdirSync(root,{mode:0o700});
    const link=path.join(base,"link");fs.symlinkSync(root,link);
    assert.throws(()=>policy.privateDirectory(link),/B1_PRIVATE_DIRECTORY/);
    fs.writeFileSync(path.join(root,"private.json"),"{}",{mode:0o644});
    // Creation modes are masked by the operator's umask (077 in our runbook).
    // Explicitly make this negative fixture unsafe before testing the guard.
    fs.chmodSync(path.join(root,"private.json"),0o644);
    assert.throws(()=>policy.readPrivate(root),/B1_PRIVATE_CONFIG/);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});
test("database guard rejects production, elevated role and a missing/mismatched marker", async () => {
  const safe={database:policy.DATABASE,user:policy.DATABASE,rolsuper:false,rolcreatedb:false,rolcreaterole:false,
    rolreplication:false,rolbypassrls:false,rolinherit:false,membership:false};
  for(const patch of [{database:"indexus_crm"},{rolsuper:true},{membership:true},{rolinherit:true}]) {
    await assert.rejects(policy.assertDatabase({query:async()=>({rows:[{...safe,...patch}]})},{nonce:"unit"}),/B1_/);
  }
  await assert.rejects(policy.assertDatabase({query:async sql=>({rows:[sql.includes("current_database")?safe:{nonce:"other"}]})},
    {nonce:"unit"}),/B1_DATABASE_MARKER/);
});
