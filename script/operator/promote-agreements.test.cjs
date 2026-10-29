const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const cp=require("node:child_process");
const vm=require("node:vm");
const op=require("./promote-agreements.cjs");
const complete=require("./promote-complete-replit.cjs");
const target="a".repeat(40);
const template=fs.readFileSync("script/operator/promote-inbound-status-list.sh","utf8");
function git(args){
  if(args.join(" ")==="rev-parse HEAD")return op.BASE;
  if(args.join(" ")===`rev-parse ${target}^`)return op.PRODUCT;
  if(args.join(" ")===`rev-parse ${op.PRODUCT}^`)return op.BASE;
  if(args[0]==="diff")return (args[3]===op.PRODUCT?op.PRODUCT_FILES:args[2]===op.PRODUCT?op.TOOL_FILES:op.FILES).join("\n");
  if(args[0]==="show")return fs.readFileSync(args[1].split(":").slice(1).join(":"),"utf8").trimEnd();
  throw Error("Unexpected git call");
}
test("release ancestry and exact scope reject unrelated work",()=>{
  op.validate(git,target);
  assert.throws(()=>op.validate(args=>args[1]==="HEAD"?"b".repeat(40):git(args),target),/HEAD changed/);
  assert.throws(()=>op.validate(args=>args[0]==="diff"?git(args)+"\nserver/lib/draft.ts":git(args),target),/Unreviewed/);
  assert.throws(()=>op.validate(git,"main"),/SHA required/);
  assert.throws(()=>op.validate(args=>args[1]===`${target}^`?op.BASE:git(args),target),/ancestry/);
});
test("private backup precedes build; DB tests and destructive DB rollback are absent",()=>{
  const body=op.render(template,complete,target);
  const syntax=cp.spawnSync("bash",["-n"],{input:body,encoding:"utf8"});
  assert.equal(syntax.status,0,syntax.stderr);
  assert.ok(body.indexOf("PHASE=zaloha_databazy_a_konfiguracie")<body.indexOf("PHASE=zostavenie"));
  for(const token of ["pg_dump","pg_restore","EACCES","/dev/sdb1","VERIFY_APPLICATION_SOURCES","git merge --ff-only","wait_health","git -C \"$APP\" reset --keep","client/src/i18n/agreement-workspace-translations.test.ts","WORD_PREVIEW_OK"])assert.ok(body.includes(token),token);
  assert.doesNotMatch(body,/db:push|DROP TABLE|pg_restore.*--clean|rm -rf/);
  const tests=body.match(/npx --no-install tsx --test ([^\n]+)/)[1];
  assert.doesNotMatch(tests,/agreement-workspace.test|agreement-routes.test|agreement-office-preview.test/);
  assert.match(body,/!key.startsWith\("PG"\)/);
  assert.match(body,/Unsupported database URL parameter/);
  assert.ok(body.indexOf("PHASE=overenie_word_konvertora")<body.indexOf("SOURCE_CHANGED=1\ngit merge"));
  for(const marker of ["DATABASE_BACKUP","VERIFY_APPLICATION_SOURCES","VERIFY_WORD_PREVIEW"]) {
    const js=body.split(`<<'${marker}'\n`)[1].split(`\n${marker}`)[0];
    assert.doesNotThrow(()=>new vm.Script(js));
  }
});
test("all helpers are hash-pinned and changed templates fail closed",()=>{
  for(const name of Object.keys(op.HELPERS))assert.equal(op.checkedHelper(name,fs.readFileSync(name,"utf8")),fs.readFileSync(name,"utf8"));
  assert.throws(()=>op.checkedHelper("script/operator/promote-complete-replit.cjs","modified"),/helper changed/);
  assert.throws(()=>op.render(template+"\n",complete,target),/template changed/);
});
test("real CLI help and missing approval cannot execute promotion",()=>{
  let run=cp.spawnSync(process.execPath,["script/operator/promote-agreements.cjs","--help"],{encoding:"utf8"});
  assert.equal(run.status,0);assert.match(run.stdout,/never restores the database/);
  run=cp.spawnSync(process.execPath,["script/operator/promote-agreements.cjs"],{encoding:"utf8"});
  assert.equal(run.status,1);assert.match(run.stderr,/Use --apply/);
});
test("exact CLI implementation renders once and invokes bash only after validation",()=>{
  const calls=[];
  op.main(["--apply",target],{git,spawnSync:(name,args,opts)=>{calls.push({name,args,opts});return{status:0};}});
  assert.equal(calls.length,2);
  assert.deepEqual(calls[0].args,["-n"]);
  assert.deepEqual(calls[1].args,["-s","--","--apply"]);
  assert.equal(calls[1].opts.cwd,"/var/www/indexus-crm");
  assert.equal(calls[0].opts.input,calls[1].opts.input);
});
