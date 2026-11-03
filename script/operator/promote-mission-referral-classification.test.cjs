const { test } = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const release = require("./promote-mission-referral-classification.cjs");
const root = path.resolve(__dirname, "../..");
function git(args, raw = false) {
  if (args.join(" ") === "rev-parse HEAD") return release.BASE;
  const output = cp.execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  return raw ? output : output.trimEnd();
}
test("admits only the reviewed 31-file production transition, exact patch, tree and dependencies", () => {
  assert.equal(release.validate(git, release.TARGET).paths.length, 31);
  assert.throws(() => release.validate(git, "wrong"));
  for (const key of ["rev-parse HEAD", `rev-parse ${release.TARGET}^{tree}`,
    `rev-parse ${release.TARGET}^`, `rev-parse ${release.TARGET}:package.json`,
    `rev-parse ${release.TARGET}:package-lock.json`])
    assert.throws(() => release.validate((args, raw) => args.join(" ") === key ? "wrong" : git(args, raw), release.TARGET));
  for (const flag of ["--binary", "--name-only"])
    assert.throws(() => release.validate((args, raw) => args.includes(flag) ? "modified" : git(args, raw), release.TARGET));
});
test("retains private data-disk DB backup, isolated build, old assets and runtime-only rollback", () => {
  const plan = release.validate(git, release.TARGET), body = release.render(git, plan);
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body }).status, 0);
  for (const required of ['== /dev/sdb1', "0:0:700", "VERIFY_APPLICATION_SOURCES",
    'sudo -u "$account"', 'mount --bind', "pg_dump", "pg_restore", "--list",
    "ZALOHA_DATABAZY_OK", "DATABASE_BACKUP", "database.dump", "application.env",
    "npm run build", "artifact.sha256", "pm2 restart indexus-crm", "wait_health",
    "NASADENIE_OK=", "databazu neobnovujem", ...release.TESTS])
    assert.ok(body.includes(required), required);
  assert.ok(body.indexOf("PHASE=zaloha_databazy_a_konfiguracie") < body.indexOf("PHASE=zostavenie"));
  assert.ok(body.indexOf("npm run build") < body.indexOf("PHASE=zdroje"));
  assert.ok(body.indexOf("tests.log") < body.indexOf("PHASE=zdroje"));
  assert.doesNotMatch(body, /reset --hard|git clean|npm install|npm ci|--test[^\n]*\.db\.test/);
  assert.throws(() => release.render(git, { ...plan, paths: [".env"] }));
  assert.throws(() => release.render((args, raw) =>
    args.join(" ") === `show ${release.TARGET}:script/operator/promote-complete-replit.cjs` ? "modified" : git(args, raw), plan));
});
test("real Node file entry rejects bad pins before production calls and executes the valid-pin guard", () => {
  const filename = require.resolve("./promote-mission-referral-classification.cjs");
  for (const args of [[], ["--apply", "wrong"]]) {
    const run = cp.spawnSync("node", [filename, ...args], { encoding: "utf8" });
    assert.equal(run.status, 1); assert.match(run.stderr, /STOP: Use --apply/);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "classification-entry-"));
  try {
    const hook = path.join(tmp, "blocked.cjs");
    fs.writeFileSync(hook, 'require("node:child_process").execFileSync=()=>{throw Error("TEST_GIT_GUARD")};');
    const run = cp.spawnSync("node", ["--require", hook, filename, "--apply", release.TARGET], { encoding: "utf8" });
    assert.equal(run.status, 1); assert.match(run.stderr, /STOP: TEST_GIT_GUARD/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
