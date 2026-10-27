const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const source=fs.readFileSync(path.join(__dirname,"promote-inbound-status-list.sh"),"utf8");
test("standalone script parses and refuses implicit deployment",()=>{
  assert.equal(spawnSync("bash",["-n"],{input:source,encoding:"utf8"}).status,0);
  const result=spawnSync("bash",[],{input:source,encoding:"utf8"});
  assert.equal(result.status,1);
  assert.match(result.stderr,/Pouzi --apply/);
  assert.doesNotMatch(result.stdout,/Zostavujem|NASADENIE_OK/);
});
test("explicit invocation on another host stops before any application write",()=>{
  const result=spawnSync("bash",["-s","--","--apply"],{input:source,encoding:"utf8"});
  assert.equal(result.status,1);
  assert.match(result.stderr,/Nespravny server/);
});
test("release gates precede source/runtime promotion and never follow latest main",()=>{
  const build=source.indexOf('npm run build > build.log');
  const sourceChange=source.indexOf('git merge --ff-only "$TARGET"');
  const runtimeChange=source.indexOf('RUNTIME_CHANGED=1');
  const indexChange=source.indexOf('PHASE=vstupna_stranka');
  assert.ok(build>0&&build<sourceChange&&sourceChange<runtimeChange&&runtimeChange<indexChange);
  assert.ok(source.indexOf('sha256sum -c artifact.sha256')<sourceChange);
  assert.ok(source.indexOf('node - "$VIEW/dist/public"')<sourceChange);
  assert.match(source,/TARGET=e0639bbc8e0cb741866f1f8189a23ae626e30cdd/);
  assert.match(source,/git diff --name-only "\$BASE" "\$TARGET"/);
  assert.match(source,/check_source "\$BASE"/);
  assert.doesNotMatch(source,/git pull|reset --hard|npm (?:ci|install)|pm2.*--update-env|pg_restore|dropdb/);
});
test("backups are private on the approved disk; bind view is cleaned and rollback preserves database",()=>{
  assert.match(source,/findmnt -n -o SOURCE -T "\$DATA".*\/dev\/sdb1/);
  assert.match(source,/sudo mktemp -d "\$DATA\/\.inbound-status-list/);
  assert.match(source,/stat -c '%u:%g:%a'.*0:0:700/);
  assert.match(source,/for account in "#\$APP_UID" www-data/);
  assert.match(source,/e\.code!=="EACCES"/);
  assert.match(source,/sudo mount --bind "\$STORE\/build" "\$VIEW"/);
  assert.match(source,/sudo umount -- "\$VIEW"/);
  assert.match(source,/restore_file "\$STORE\/backup\/index.cjs"/);
  assert.match(source,/restore_file "\$STORE\/backup\/index.html"/);
  assert.match(source,/git -C "\$APP" reset --keep "\$BASE"/);
});
const validator=source.match(/<<'VALIDATE_ASSETS'\n([\s\S]*?)\nVALIDATE_ASSETS/)[1];
function fixture(run){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"release-assets-"));
  const candidate=path.join(root,"candidate"),live=path.join(root,"live");
  fs.mkdirSync(candidate);fs.mkdirSync(live);
  try{run(candidate,live);}finally{fs.rmSync(root,{recursive:true,force:true});}
}
const validate=(candidate,live)=>spawnSync(process.execPath,["-",candidate,live],{input:validator,encoding:"utf8"});
test("real inline validator permits different entry HTML and retains old immutable assets",()=>fixture((c,l)=>{
  fs.writeFileSync(path.join(c,"index.html"),"new");
  fs.writeFileSync(path.join(l,"index.html"),"old");
  fs.writeFileSync(path.join(l,"old-hash.js"),"old lazy chunk");
  fs.writeFileSync(path.join(c,"new-hash.js"),"new lazy chunk");
  assert.equal(validate(c,l).status,0);
  assert.equal(fs.readFileSync(path.join(l,"old-hash.js"),"utf8"),"old lazy chunk");
}));
test("real inline validator rejects immutable collisions and live symlink escapes",()=>fixture((c,l)=>{
  fs.writeFileSync(path.join(c,"same.js"),"new");
  fs.writeFileSync(path.join(l,"same.js"),"different");
  assert.notEqual(validate(c,l).status,0);
  fs.unlinkSync(path.join(l,"same.js"));
  fs.symlinkSync(path.join(c,"same.js"),path.join(l,"same.js"));
  assert.notEqual(validate(c,l).status,0);
}));
test("real inline validator rejects candidate symlinks",()=>fixture((c,l)=>{
  fs.writeFileSync(path.join(l,"secret"),"outside");
  fs.symlinkSync(path.join(l,"secret"),path.join(c,"chunk.js"));
  assert.notEqual(validate(c,l).status,0);
}));
