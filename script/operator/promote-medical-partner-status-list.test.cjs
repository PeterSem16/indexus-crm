const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), cp = require("node:child_process");
const helper = require("./promote-medical-partner-status-list.cjs");
const complete = require("./promote-complete-replit.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
const target = "a".repeat(40);
test("operator procedure parses, preserves backups/rollback and never runs application tests against live data", () => {
  const body = helper.renderMedicalPartner(template, target, complete.render);
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
  for (const marker of ["VERIFY_APPLICATION_SOURCES", "DATABASE_BACKUP", "git merge --ff-only",
    'reset --keep "$BASE"', "/dev/sdb1", "pm2 restart indexus-crm", "npm run build",
    "UNIT_DATABASE_GUARD", helper.TESTS, "Operator unit tests must not access a database",
    "cp -a --update=none", 'cat "$VIEW/tests.log"']) assert.ok(body.includes(marker), marker);
  assert.ok(body.includes(`BASE=${helper.BASE}`));
  assert.ok(body.includes(`TARGET=${target}`));
  for (const forbidden of ["npm install", "npm ci", "db:push", "pg_restore --dbname", "git pull", "reset --hard",
    "UPDATE mission_callback", "DELETE FROM", "status-list-confirmation-preview.db.test.ts >"])
    assert.ok(!body.includes(forbidden), forbidden);
  assert.throws(() => helper.renderMedicalPartner(template + "\n", target, complete.render), /template changed/);
});
test("only the verified live parent and exact completed change whitelist are accepted", () => {
  const values = new Map([
    ["rev-parse|HEAD", helper.BASE],
    [`rev-parse|${target}^`, helper.BASE],
    [`diff|--name-only|${helper.BASE}|${target}`, helper.FILES.join("\n")],
  ]);
  const git = args => { const key = args.join("|"); assert.ok(values.has(key)); return values.get(key); };
  helper.validateRelease(git, target);
  for (const [key, original] of values) {
    values.set(key, "unexpected");
    assert.throws(() => helper.validateRelease(git, target));
    values.set(key, original);
  }
  assert.throws(() => helper.validateRelease(git, "main"), /Invalid pinned target/);
});
test("direct invocation without explicit apply stops before touching the server", () => {
  const result = cp.spawnSync(process.execPath, ["script/operator/promote-medical-partner-status-list.cjs"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Use --apply/);
  assert.doesNotMatch(result.stdout, /PRIPRAVENE|ZALOHA|NASADENIE/);
});
test("current-commit completion preserves provenance, private backups and runtime rollback without moving HEAD", () => {
  const body = helper.renderCurrentMedicalPartner(template, helper.CURRENT_RELEASE, complete.render);
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
  for (const marker of ['check_source "$TARGET"', "VERIFY_APPLICATION_SOURCES", "DATABASE_BACKUP",
    "/dev/sdb1", "UNIT_DATABASE_GUARD", helper.TESTS, "npm run build", "pm2 restart indexus-crm",
    "restore_file", helper.CURRENT_RUNTIME.backend, helper.CURRENT_RUNTIME.index,
    "POVODNY_RUNTIME_OBNOVENY=$TARGET", "phase-result.txt",
    'git archive --format=tar --output="$VIEW/previous-source.tar" "$TARGET"'])
    assert.ok(body.includes(marker), marker);
  assert.equal(body.split('check_source "$TARGET"').length - 1, 4);
  assert.ok(body.includes('git diff --name-only "$BASE" "$TARGET"'));
  assert.ok(body.includes('git merge-base --is-ancestor "$BASE" "$TARGET"'));
  for (const forbidden of ['check_source "$BASE"', "git reset", "git merge --ff-only",
    "SOURCE_CHANGED", "npm install", "db:push", "pg_restore --dbname"])
    assert.ok(!body.includes(forbidden), forbidden);
  assert.throws(() => helper.renderCurrentMedicalPartner(template, target, complete.render), /Unreviewed/);
});
test("current mode still requires the pinned release, parent and exact original change whitelist", () => {
  const release = helper.CURRENT_RELEASE;
  const values = new Map([
    ["rev-parse|HEAD", release],
    [`rev-parse|${release}^`, helper.BASE],
    [`diff|--name-only|${helper.BASE}|${release}`, helper.FILES.join("\n")],
  ]);
  const git = args => { assert.ok(values.has(args.join("|"))); return values.get(args.join("|")); };
  helper.validateCurrentRelease(git, release);
  assert.throws(() => helper.validateCurrentRelease(git, target), /Unreviewed/);
  assert.throws(() => helper.validateRelease(git, release), /Production HEAD changed/);
  for (const [key, original] of values) {
    values.set(key, "unexpected");
    assert.throws(() => helper.validateCurrentRelease(git, release));
    values.set(key, original);
  }
});
test("real Node file entry reaches current-mode promotion; all production side effects are intercepted", () => {
  const os = require("node:os"), path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexus-current-entry-"));
  try {
    const entry = path.join(dir, "operator.cjs"), preload = path.join(dir, "guard.cjs");
    const capture = path.join(dir, "procedure.sh");
    fs.copyFileSync("script/operator/promote-medical-partner-status-list.cjs", entry);
    const responses = {
      ["rev-parse|HEAD"]: helper.CURRENT_RELEASE,
      [`rev-parse|${helper.CURRENT_RELEASE}^`]: helper.BASE,
      [`diff|--name-only|${helper.BASE}|${helper.CURRENT_RELEASE}`]: helper.FILES.join("\n"),
      [`show|${helper.CURRENT_RELEASE}:script/operator/promote-complete-replit.cjs`]:
        fs.readFileSync("script/operator/promote-complete-replit.cjs", "utf8").trimEnd(),
      [`show|${helper.CURRENT_RELEASE}:script/operator/promote-inbound-status-list.sh`]: template.trimEnd(),
    };
    fs.writeFileSync(preload, `
const cp=require("node:child_process"),fs=require("node:fs"),responses=${JSON.stringify(responses)};
const syntax=cp.spawnSync;
cp.execFileSync=(cmd,args)=>{
  if(cmd!=="git"||args[0]!=="-C"||args[1]!=="/var/www/indexus-crm")throw Error("Unexpected command");
  const key=args.slice(2).join("|");
  if(!Object.hasOwn(responses,key))throw Error("Unexpected Git call: "+key);
  return responses[key]+"\\n";
};
cp.spawnSync=(cmd,args,opts)=>{
  if(cmd==="bash"&&args.length===1&&args[0]==="-n")return syntax(cmd,args,opts);
  if(cmd!=="bash"||JSON.stringify(args)!==JSON.stringify(["-s","--","--apply"]))throw Error("Unexpected subprocess");
  fs.writeFileSync(${JSON.stringify(capture)},opts.input);
  return {status:0};
};`);
    const result = cp.spawnSync(process.execPath, ["--require", preload, entry,
      "--complete-current", helper.CURRENT_RELEASE], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`PRIPRAVENE_VYDANIE=${helper.CURRENT_RELEASE}`));
    assert.match(result.stdout, /BEZ_ZMENY_GIT_HEAD/);
    assert.ok(fs.readFileSync(capture, "utf8").includes(`TARGET=${helper.CURRENT_RELEASE}`));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
