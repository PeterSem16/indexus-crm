const {test} = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const release = require("./promote-mission-proposal-review.cjs");
const root = require("node:path").resolve(__dirname,"../..");
function git(args,raw=false) {
  if(args.join(" ")==="rev-parse HEAD") return release.BASE;
  const value=cp.execFileSync("git",["-C",root,...args],{encoding:"utf8",maxBuffer:32*1024*1024});
  return raw?value:value.trimEnd();
}
test("exact published tree, dependency/schema parity and patch fingerprints are mandatory",()=>{
  const plan=release.validate(git,release.TARGET);
  assert.equal(plan.paths.length,25);
  assert.throws(()=>release.validate(git,"wrong"));
  assert.throws(()=>release.validate((q,r)=>q.join(" ")==="rev-parse HEAD"?"wrong":git(q,r),release.TARGET));
  assert.throws(()=>release.validate((q,r)=>q.includes("--binary")?"changed":git(q,r),release.TARGET));
  assert.throws(()=>release.validate((q,r)=>q[1]===release.TARGET+":shared/schema.ts"?"changed":git(q,r),release.TARGET));
});
test("the isolated build/tests precede promotion, with private runtime-only rollback and no DB operations",()=>{
  const body=release.render(git,release.validate(git,release.TARGET));
  assert.equal(cp.spawnSync("bash",["-n"],{input:body}).status,0);
  for(const part of ["/dev/sdb1","STORE/backup/dist.tar","0:0:700","VERIFY_APPLICATION_SOURCES",
    "flock -n 9","wait_health","pm2 restart indexus-crm","NASADENIE_OK",
    "POVODNA_VERZIA_OBNOVENA",".mission-proposal-review-","mission_proposal_unit"])
    assert.ok(body.includes(part),part);
  assert.ok(body.indexOf("npm run build")<body.indexOf("PHASE=zdroje"));
  assert.ok(body.indexOf("tests.log")<body.indexOf("PHASE=zdroje"));
  assert.doesNotMatch(body,/pg_dump|pg_restore|DATABASE_BACKUP|previous-source|npm install|npm ci|reset --hard|git clean|--test[^\n]*\.db\.test/);
  assert.throws(()=>release.render((q,r)=>q[1]?.endsWith("promote-complete-replit.cjs")?"changed":git(q,r),
    release.validate(git,release.TARGET)));
});
test("console entry points reject missing/incorrect targets rather than silently succeeding",()=>{
  for(const args of [[],["--apply","wrong"]]){
    const direct=cp.spawnSync("node",[require.resolve("./promote-mission-proposal-review.cjs"),...args],{encoding:"utf8"});
    assert.equal(direct.status,1);assert.match(direct.stderr,/STOP: Use --apply/);
  }
  const stdin=cp.spawnSync("node",["-"],{
    input:require("node:fs").readFileSync(require.resolve("./promote-mission-proposal-review.cjs")),encoding:"utf8"});
  assert.equal(stdin.status,1);assert.match(stdin.stderr,/STOP: Use --apply/);
});
