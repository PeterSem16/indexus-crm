const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cp = require("node:child_process");
const vm = require("node:vm");
const path = require("node:path");
const os = require("node:os");
const complete = require("./promote-complete-replit.cjs");
const helper = require("./promote-standing-analysis.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
const target = "a".repeat(40);

test("standing release preserves private staged build, DB backup, rollback and exact source/build pins", () => {
  const body = helper.renderStanding(template, target, complete.render);
  const result = cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  for (const marker of ["DATABASE_BACKUP", "VERIFY_APPLICATION_SOURCES", "UNIT_TEST_DATABASE_GUARD"]) {
    const payload = body.split(`<<'${marker}'\n`)[1]?.split(`\n${marker}`)[0];
    assert.ok(payload);
    new vm.Script(payload);
  }
  for (const marker of [
    helper.OLD_BACKEND, helper.OLD_INDEX, "/dev/sdb1", "pg_restore", "mount --bind",
    "EACCES", "VALIDATE_ASSETS", "git merge --ff-only", 'reset --keep "$BASE"',
    "phase-result.txt", "pm2 restart indexus-crm", "standing-recording-analysis.test.ts",
    "call-analysis-view-state.test.ts", "VERIFY_APPLICATION_SOURCES",
  ]) assert.ok(body.includes(marker), marker);
  assert.ok(body.includes(`BASE=${helper.BASE}`));
  assert.ok(body.includes(`TARGET=${target}`));
  assert.ok(body.includes("cp -a --update=none"));
  assert.ok(!body.includes("hospital-agreement-routes.test.ts"));
  assert.ok(!body.includes("npm install"));
  assert.ok(!body.includes("db:push"));
  assert.ok(body.includes('NODE_OPTIONS="--require=$VIEW/.operator-unit-test-db-guard.cjs" npx --no-install tsx --test'));
  assert.ok(body.includes('cat "$VIEW/tests.log"'));
  assert.ok(!body.includes('tail -30 "$VIEW/tests.log"'));
  assert.throws(() => complete.render(template, { base: helper.BASE, target, paths: helper.FILES }), /Unreviewed/);
  assert.throws(() => helper.renderStanding(template + "\n", target, complete.render), /template changed/);
});

function fixture() {
  const values = new Map([
    [["rev-parse", "HEAD"].join("|"), helper.BASE],
    [["merge-base", helper.FIX, target].join("|"), helper.FIX],
    [["rev-parse", `${helper.FIX}^`].join("|"), helper.BASE],
    [["diff", "--name-only", helper.BASE, helper.FIX].join("|"), helper.APP_FILES.join("\n")],
    [["diff", "--name-only", helper.FIX, target].join("|"), helper.OPERATOR_FILES.join("\n")],
    [["diff", "--name-only", helper.BASE, target].join("|"), helper.FILES.join("\n")],
  ]);
  return { values, git: args => {
    const key = args.join("|");
    assert.ok(values.has(key), key);
    return values.get(key);
  } };
}
test("only the verified production base, exact application fix and operator-only descendant are accepted", () => {
  const valid = fixture();
  helper.validateRelease(valid.git, target);
  for (const key of valid.values.keys()) {
    const changed = fixture();
    changed.values.set(key, "unexpected");
    assert.throws(() => helper.validateRelease(changed.git, target));
  }
});

test("the real Node file entry loads pinned helpers and validates Bash before handing it to the operator", () => {
  const valid = fixture();
  valid.values.set(["show", `${target}:script/operator/promote-complete-replit.cjs`].join("|"),
    fs.readFileSync("script/operator/promote-complete-replit.cjs", "utf8").trimEnd());
  valid.values.set(["show", `${target}:script/operator/promote-inbound-status-list.sh`].join("|"), template.trimEnd());
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "operator-main-test-"));
  try {
    const preload = path.join(folder, "preload.cjs");
    fs.writeFileSync(preload, `
const assert = require("node:assert/strict"), cp = require("node:child_process");
const values = new Map(${JSON.stringify([...valid.values])});
const syntaxCheck = cp.spawnSync.bind(cp);
cp.execFileSync = (command, args) => {
  assert.equal(command, "git");
  assert.deepEqual(args.slice(0, 2), ["-C", "/var/www/indexus-crm"]);
  const key = args.slice(2).join("|");
  assert.ok(values.has(key), key);
  return values.get(key);
};
cp.spawnSync = (command, args, options) => {
  assert.equal(command, "bash");
  if (args.join("|") === "-n") return syntaxCheck(command, args, options);
  assert.deepEqual(args, ["-s", "--", "--apply"]);
  assert.ok(options.input.includes("TARGET=${target}"));
  assert.ok(options.input.includes("${helper.OLD_BACKEND}"));
  console.log("REAL_NODE_ENTRY_VERIFIED_NO_PRODUCTION_EXECUTION");
  return { status: 0 };
};
`);
    const runner = path.join(folder, "runner.cjs");
    fs.copyFileSync("script/operator/promote-standing-analysis.cjs", runner);
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    const result = cp.spawnSync(process.execPath, ["--require", preload, runner, "--apply", target],
      { encoding: "utf8", env, timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`PRIPRAVENE_VYDANIE=${target}`));
    assert.ok(result.stdout.includes("REAL_NODE_ENTRY_VERIFIED_NO_PRODUCTION_EXECUTION"));
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

test("all production-gated unit tests pass without credentials and every pg query/connect is blocked", () => {
  const folder = fs.mkdtempSync(path.join(process.cwd(), "generated-artifacts", "operator-db-isolation-"));
  try {
    const preload = path.join(folder, "guard.cjs");
    fs.writeFileSync(preload, helper.UNIT_TEST_DATABASE_GUARD);
    const env = { ...process.env, NODE_OPTIONS: `--require=${preload}` };
    delete env.DATABASE_URL;
    delete env.NODE_TEST_CONTEXT;
    const probe = cp.spawnSync(process.execPath, ["-e", `
const assert = require("node:assert/strict"), pg = require("pg");
assert.equal(process.env.DATABASE_URL, "postgresql://127.0.0.1:1/indexus_unit_test");
for (const Constructor of [pg.Pool, pg.Client]) {
  const instance = new Constructor();
  assert.throws(() => instance.connect(), /must not access a database/);
  assert.throws(() => instance.query("SELECT 1"), /must not access a database/);
}
`], { env, encoding: "utf8", timeout: 15000 });
    assert.equal(probe.status, 0, probe.stderr);
    const result = cp.spawnSync("npx", ["--no-install", "tsx", "--test", "--test-reporter=tap", ...helper.TESTS.split(" ")],
      { env, encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /(?:#|ℹ) tests 22/);
    assert.match(result.stdout, /(?:#|ℹ) fail 0/);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
