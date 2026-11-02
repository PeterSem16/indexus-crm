const { test } = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const release = require("./promote-mission-history.cjs");
const root = path.resolve(__dirname, "../..");
function git(query, raw = false) {
  let value;
  if (query.join(" ") === "rev-parse HEAD") value = release.BASE;
  else if (query.join(" ") === `rev-parse ${release.TARGET}^{tree}`) value = release.TREE;
  else if (query.join(" ") === `rev-parse ${release.TARGET}^`) value = release.PARENT;
  else {
    // The locally validated Git tree is identical to the API-published commit;
    // no reconstruction of GitHub's author/committer headers is required.
    const args = query.map(arg => arg === release.TARGET ? release.TREE :
      arg.startsWith(release.TARGET + ":") ? release.TREE + arg.slice(release.TARGET.length) : arg);
    value = cp.execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  }
  return raw ? value : value.trimEnd();
}
test("pinned production source has exact reviewed scope, ancestry, schema and patch", () => {
  const plan = release.validate(git, release.TARGET);
  assert.equal(plan.paths.length, 20);
  assert.throws(() => release.validate((q, r) => q.join(" ") === "rev-parse HEAD" ? "wrong" : git(q, r), release.TARGET));
  assert.throws(() => release.validate((q, r) => q.includes("--binary") ? "changed patch" : git(q, r), release.TARGET));
  assert.throws(() => release.validate((q, r) => q.includes(`${release.TARGET}:shared/schema.ts`) ? "changed schema" : git(q, r), release.TARGET));
  assert.throws(() => release.validate(git, "other"));
});
test("procedure stages before live promotion and retains private runtime-only recovery on the data disk", () => {
  const body = release.render(git, release.validate(git, release.TARGET));
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body }).status, 0);
  for (const text of ["/dev/sdb1", "STORE/backup/dist.tar", "0:0:700", "VERIFY_APPLICATION_SOURCES",
    "flock -n 9", "wait_health", "pm2 restart indexus-crm", "NASADENIE_OK",
    "POVODNA_VERZIA_OBNOVENA", ".mission-history-", "mission_history_unit"])
    assert.ok(body.includes(text), text);
  assert.ok(body.indexOf("npm run build") < body.indexOf("PHASE=zdroje"));
  assert.ok(body.indexOf("tests.log") < body.indexOf("PHASE=zdroje"));
  assert.doesNotMatch(body, /pg_dump|pg_restore|DATABASE_BACKUP|previous-source|npm install|npm ci|git reset --hard|git clean/);
  assert.doesNotMatch(body, /--test[^\n]*\.db\.test/);
  assert.throws(() => release.render((q, r) => q[1]?.endsWith("promote-complete-replit.cjs") ? "changed" : git(q, r),
    release.validate(git, release.TARGET)));
});
test("real Node operator entry intercepts production execution and rejects accidental stdin-style no-ops", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mission-history-entry-"));
  const preload = path.join(temp, "intercept.cjs");
  fs.writeFileSync(preload, `
const cp=require("node:child_process"),assert=require("node:assert/strict");
const actual=cp.execFileSync,spawn=cp.spawnSync;
cp.execFileSync=(command,args,options)=>{
  assert.equal(command,"git");assert.equal(args[1],"/var/www/indexus-crm");
  const q=args.slice(2),target=${JSON.stringify(release.TARGET)},tree=${JSON.stringify(release.TREE)};
  if(q.join(" ")==="rev-parse HEAD")return ${JSON.stringify(release.BASE)};
  if(q.join(" ")==="rev-parse "+target+"^{tree}")return tree;
  if(q.join(" ")==="rev-parse "+target+"^")return ${JSON.stringify(release.PARENT)};
  return actual("git",["-C",${JSON.stringify(root)},...q.map(a=>a===target?tree:a.startsWith(target+":")?tree+a.slice(target.length):a)],options);
};
cp.spawnSync=(command,args,options)=>{
 assert.equal(command,"bash");
 if(args.join(" ")==="-n")return spawn(command,args,options);
 assert.equal(args.join(" "),"-s -- --apply");
 assert.ok(options.input.includes("NASADENIE_OK"));
 assert.ok(options.input.includes("STORE/backup/dist.tar"));
 console.log("PRODUCTION_EXECUTION_INTERCEPTED");return {status:0};
};`);
  try {
    const result = cp.spawnSync(process.execPath, ["--require", preload,
      path.join(__dirname, "promote-mission-history.cjs"), "--apply", release.TARGET], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PRODUCTION_EXECUTION_INTERCEPTED/);
    const invalid = cp.spawnSync(process.execPath, [path.join(__dirname, "promote-mission-history.cjs"), "--apply", "wrong"], { encoding: "utf8" });
    assert.equal(invalid.status, 1);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
