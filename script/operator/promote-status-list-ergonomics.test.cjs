const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), cp = require("node:child_process");
const helper = require("./promote-status-list-ergonomics.cjs");
const complete = require("./promote-complete-replit.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
function responses() {
  return {
    "rev-parse|HEAD": helper.BASE,
    [`rev-parse|${helper.TARGET}^`]: helper.PARENT,
    [`rev-parse|${helper.PARENT}^`]: helper.BASE,
    [`diff|--name-only|${helper.BASE}|${helper.TARGET}`]: helper.FILES.join("\n"),
    [`diff|--name-only|${helper.PARENT}|${helper.TARGET}`]: helper.UI_FILES.join("\n"),
  };
}
test("only the reported production baseline and reviewed frontend scopes are accepted", () => {
  const values = responses(), git = args => {
    assert.ok(Object.hasOwn(values, args.join("|"))); return values[args.join("|")];
  };
  helper.validate(git, helper.TARGET);
  assert.throws(() => helper.validate(git, "main"));
  for (const key of Object.keys(values)) {
    const old = values[key]; values[key] = "unexpected";
    assert.throws(() => helper.validate(git, helper.TARGET));
    values[key] = old;
  }
});
test("no backups, database access or backend writes/restarts; retain private staging and HTML rollback", () => {
  const body = helper.render(template, complete.render);
  assert.equal(cp.spawnSync("bash", ["-n"], {input:body}).status, 0);
  for (const marker of [
    "VERIFY_APPLICATION_SOURCES", "/dev/sdb1", "mount --bind", "EACCES", "CANARY",
    "NODE_ENV=production npx --no-install vite build", "VALIDATE_ASSETS", "cp -a --update=none",
    'OLD_HTML=$(base64 -w0 dist/public/index.html)', 'printf \'%s\' "$OLD_HTML" | base64 -d',
    helper.RUNTIME.backend, helper.RUNTIME.index, 'git merge --ff-only "$TARGET"',
    'reset --keep "$BASE"', '[[ "$(process_pid)" == "$PID" ]]',
    "BACKEND_BEZ_RESTARTU=$PID", "tsx --test client/src/i18n/automation-attachment-translations.test.ts",
  ]) assert.ok(body.includes(marker), marker);
  for (const forbidden of [
    "pg_dump", "pg_restore", "DATABASE_BACKUP", "backup/", "dist.tar", "previous-source.tar",
    "npm run build", "pm2 restart", "pm2 reload", ".index.cjs.next", "npm install", "npm ci",
    "db:push", "reset --hard", "git pull",
  ]) assert.ok(!body.includes(forbidden), forbidden);
  assert.ok(body.indexOf("RUNTIME_CHANGED=1") < body.indexOf('sudo mv -fT -- "$APP/dist/public/.index.next.html"'));
  assert.ok(body.indexOf("VALIDATE_ASSETS") < body.indexOf("PHASE=zdroje"));
  assert.throws(() => helper.render(template + "\n", complete.render));
});
test("HTML kept in memory round-trips exact bytes including final newlines", () => {
  const html = Buffer.from("<!doctype html>\r\n<html>Žiadne zmeny dát</html>\r\n\n");
  const shell = 'OLD_HTML=$(base64 -w0); printf \'%s\' "$OLD_HTML" | base64 -d';
  const result = cp.spawnSync("bash", ["-c", shell], {input:html});
  assert.equal(result.status, 0);
  assert.deepEqual(result.stdout, html);
});
test("real file entry reaches frontend promotion and refuses invalid args, with production calls blocked", () => {
  const os = require("node:os"), path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ergonomics-operator-test-"));
  try {
    const entry = path.join(dir, "operator.cjs"), guard = path.join(dir, "guard.cjs"), output = path.join(dir, "body.sh");
    fs.copyFileSync("script/operator/promote-status-list-ergonomics.cjs", entry);
    const values = responses();
    values[`show|${helper.TARGET}:script/operator/promote-complete-replit.cjs`] =
      fs.readFileSync("script/operator/promote-complete-replit.cjs", "utf8").trimEnd();
    values[`show|${helper.TARGET}:script/operator/promote-inbound-status-list.sh`] = template.trimEnd();
    fs.writeFileSync(guard, `
const cp=require("node:child_process"),fs=require("node:fs"),values=${JSON.stringify(values)},syntax=cp.spawnSync;
cp.execFileSync=(cmd,args)=>{
  if(cmd!=="git"||args[0]!=="-C"||args[1]!=="/var/www/indexus-crm")throw Error("Forbidden process");
  const key=args.slice(2).join("|");if(!Object.hasOwn(values,key))throw Error("Forbidden Git call");
  return values[key]+"\\n";
};
cp.spawnSync=(cmd,args,opts)=>{
  if(cmd==="bash"&&JSON.stringify(args)==='["-n"]')return syntax(cmd,args,opts);
  if(cmd!=="bash"||JSON.stringify(args)!=='["-s","--","--apply"]')throw Error("Forbidden process");
  fs.writeFileSync(${JSON.stringify(output)},opts.input);return {status:0};
};`);
    const result = cp.spawnSync(process.execPath, ["--require", guard, entry, "--apply", helper.TARGET], {encoding:"utf8"});
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /REZIM=IBA_FRONTEND_BEZ_ZALOHY_A_RESTARTU/);
    assert.equal(fs.readFileSync(output, "utf8"), helper.render(template, complete.render));
    const invalid = cp.spawnSync(process.execPath, [entry], {encoding:"utf8"});
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Use --apply/);
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});
