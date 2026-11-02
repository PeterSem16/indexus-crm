const { test } = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const release = require("./promote-mission-emails-no-backup.cjs");
const root = path.resolve(__dirname, "../..");
const git = args => cp.execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const source = git(["show", `${release.TARGET}:${release.LEGACY_PATH}`]);
const rendererSource = git(["show", `${release.TARGET}:script/operator/promote-complete-replit.cjs`]);
const renderer = new (require("node:module"))(path.join(__dirname, "promote-complete-replit.cjs"), module);
renderer.filename = path.join(__dirname, "promote-complete-replit.cjs");
renderer._compile(rendererSource, renderer.filename);
const template = git(["show", `${release.TARGET}:script/operator/promote-inbound-status-list.sh`]);
function fromBase(base) {
  return (args, raw = false) => {
    const result = args.join(" ") === "rev-parse HEAD" ? base : git(args);
    return raw ? result : result.trimEnd();
  };
}
test("every approved production baseline has exact scope, ancestry, dependencies and patch", () => {
  const lib = release.loadLegacy(source);
  for (const plan of release.PLANS) {
    const verified = lib.validate(fromBase(plan.base), release.TARGET);
    assert.equal(verified.fileCount, plan.fileCount);
    assert.ok(verified.files.includes("server/lib/mission-email-scheduler.ts"));
    assert.ok(verified.files.includes("server/lib/mission-email-schedule-routes.ts"));
    assert.throws(() => lib.validate((args, raw) => args[0] === "diff" && args.includes("--binary")
      ? "corrupt patch" : fromBase(plan.base)(args, raw), release.TARGET), /patch differs/);
    assert.throws(() => lib.validate((args, raw) => args.includes(`${release.TARGET}:package.json`)
      ? "wrong package" : fromBase(plan.base)(args, raw), release.TARGET), /Dependencies/);
  }
  assert.throws(() => release.loadLegacy(source + "\n"), /renderer differs/);
  assert.throws(() => lib.validate(() => "a".repeat(40), release.TARGET), /Unapproved/);
  assert.throws(() => lib.validate(() => release.TARGET, release.TARGET), /already/);
});
test("rendered release builds away from live files, never backs up or restores data, and tests emails without a real DB", () => {
  const lib = release.loadLegacy(source);
  for (const plan of release.PLANS) {
    const verified = lib.validate(fromBase(plan.base), release.TARGET);
    const body = lib.render(template, renderer.exports.render, verified);
    assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
    assert.doesNotMatch(body, /pg_dump|pg_restore|DATABASE_BACKUP|STORE\/backup|backup\/|tar -cpf|previous-source|restore_file/);
    assert.doesNotMatch(body, /git reset --hard|git clean|npm install|npm ci/);
    for (const value of ["/dev/sdb1", "flock -n 9", "VERIFY_APPLICATION_SOURCES", "git merge --ff-only",
      "wait_health", "pm2 restart indexus-crm", "NASADENIE_OK", ".mission-email-build-",
      "DATABASE_URL=postgresql://127.0.0.1:1/mission_funnel_unit", ...release.EXTRA_TESTS])
      assert.ok(body.includes(value), value);
    assert.ok(body.indexOf("PHASE=zostavenie") < body.indexOf("PHASE=zdroje"));
    assert.ok(body.indexOf("npm run build") < body.indexOf("PHASE=zdroje"));
  }
});
test("real operator entry accepts only explicit no-backup approval and intercepts all production execution", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mission-email-operator-"));
  const preload = path.join(temp, "intercept.cjs");
  fs.writeFileSync(preload, `
const cp=require("node:child_process"),assert=require("node:assert/strict");
const originalGit=cp.execFileSync,originalSpawn=cp.spawnSync;
cp.execFileSync=(command,args,options)=>{
 assert.equal(command,"git");assert.equal(args[1],"/var/www/indexus-crm");
 const query=args.slice(2);
 if(query.join(" ")==="rev-parse HEAD")return process.env.TEST_RELEASE_BASE;
 return originalGit("git",["-C",${JSON.stringify(root)},...query],options);
};
cp.spawnSync=(command,args,options)=>{
 assert.equal(command,"bash");
 if(args.join(" ")==="-n")return originalSpawn(command,args,options);
 assert.equal(args.join(" "),"-s -- --apply");
 assert.ok(options.input.includes("NASADENIE_OK"));
 assert.ok(options.input.includes(".mission-email-build-"));
 assert.ok(!/pg_dump|pg_restore|STORE\\/backup/.test(options.input));
 console.log("PRODUCTION_EXECUTION_INTERCEPTED");
 return {status:0};
};`, { mode: 0o600 });
  try {
    for (const plan of release.PLANS) {
      const result = cp.spawnSync(process.execPath, ["--require", preload, path.join(__dirname, "promote-mission-emails-no-backup.cjs"), "--apply-no-backup", release.TARGET], {
        encoding: "utf8", env: { ...process.env, TEST_RELEASE_BASE: plan.base },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /PRODUCTION_EXECUTION_INTERCEPTED/);
      assert.match(result.stdout, /BEZ_NOVEJ_ZALOHY_BEZ_AUTOMATICKEHO_NAVRATU_RUNTIME/);
    }
    const invalid = cp.spawnSync(process.execPath, [path.join(__dirname, "promote-mission-emails-no-backup.cjs"), "--apply", release.TARGET], { encoding: "utf8" });
    assert.equal(invalid.status, 1); assert.match(invalid.stderr, /--apply-no-backup/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
