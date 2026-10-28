const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), cp = require("node:child_process");
const helper = require("./promote-automation-runs.cjs");
const complete = require("./promote-complete-replit.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
function responses() {
  return {
    "rev-parse|HEAD": helper.BASE,
    [`rev-parse|${helper.TARGET}^`]: helper.PARENT,
    [`rev-parse|${helper.PARENT}^`]: helper.BASE,
    [`diff|--name-only|${helper.BASE}|${helper.TARGET}`]: helper.FILES.join("\n"),
    [`diff|--name-only|${helper.PARENT}|${helper.TARGET}`]: helper.FIX_FILES.join("\n"),
  };
}
test("pins ancestry, live HEAD and both scopes, rejecting every changed gate", () => {
  const values = responses(), git = args => {
    assert.ok(Object.hasOwn(values, args.join("|")));
    return values[args.join("|")];
  };
  helper.validate(git, helper.TARGET);
  assert.throws(() => helper.validate(git, "main"));
  for (const key of Object.keys(values)) {
    const old = values[key]; values[key] = "changed";
    assert.throws(() => helper.validate(git, helper.TARGET));
    values[key] = old;
  }
});
test("retains reviewed private backup, staged build, rollback and read-only tests", () => {
  const body = helper.render(template, complete.render);
  assert.equal(cp.spawnSync("bash", ["-n"], {input:body}).status, 0);
  for (const marker of ["DATABASE_BACKUP", "VERIFY_APPLICATION_SOURCES", "/dev/sdb1",
    "npm run build", 'git merge --ff-only "$TARGET"', 'reset --keep "$BASE"',
    "restore_file", "pm2 restart indexus-crm", "VALIDATE_ASSETS", "cp -a --update=none",
    helper.RUNTIME.backend, helper.RUNTIME.index, "phase-result.txt",
    "tsx --test client/src/i18n/automation-attachment-translations.test.ts"])
    assert.ok(body.includes(marker), marker);
  for (const forbidden of ["npm install", "npm ci", "db:push", "git pull", "reset --hard",
    "pg_restore --dbname", "hospital-agreement-copy.test.ts", ".db.test.ts"])
    assert.ok(!body.includes(forbidden), forbidden);
  assert.throws(() => helper.render(template + "\n", complete.render));
});
test("real file entry invokes promotion, with all production subprocesses intercepted", () => {
  const os = require("node:os"), path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "runs-operator-test-"));
  try {
    const entry = path.join(dir, "operator.cjs"), guard = path.join(dir, "guard.cjs"), output = path.join(dir, "body.sh");
    fs.copyFileSync("script/operator/promote-automation-runs.cjs", entry);
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
    assert.match(result.stdout, /PRIPRAVENE_VYDANIE=/);
    assert.equal(fs.readFileSync(output, "utf8"), helper.render(template, complete.render));
    const invalid = cp.spawnSync(process.execPath, [entry], {encoding:"utf8"});
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Use --apply/);
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});
