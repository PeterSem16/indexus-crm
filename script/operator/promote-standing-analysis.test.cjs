const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cp = require("node:child_process");
const vm = require("node:vm");
const complete = require("./promote-complete-replit.cjs");
const helper = require("./promote-standing-analysis.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
const target = "a".repeat(40);

test("standing release preserves private staged build, DB backup, rollback and exact source/build pins", () => {
  const body = helper.renderStanding(template, target, complete.render);
  const result = cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  for (const marker of ["DATABASE_BACKUP", "VERIFY_APPLICATION_SOURCES"]) {
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
  assert.throws(() => complete.render(template, { base: helper.BASE, target, paths: helper.FILES }), /Unreviewed/);
  assert.throws(() => helper.renderStanding(template + "\n", target, complete.render), /template changed/);
});

function fixture() {
  const values = new Map([
    [["rev-parse", "HEAD"].join("|"), helper.BASE],
    [["rev-parse", `${target}^`].join("|"), helper.FIX],
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

test("the exact stdin entry loads pinned helpers and validates Bash before handing it to the operator", () => {
  const valid = fixture();
  valid.values.set(["show", `${target}:script/operator/promote-complete-replit.cjs`].join("|"),
    fs.readFileSync("script/operator/promote-complete-replit.cjs", "utf8").trimEnd());
  valid.values.set(["show", `${target}:script/operator/promote-inbound-status-list.sh`].join("|"), template.trimEnd());
  const mod = { exports: {} };
  const calls = [];
  const fakeCp = {
    execFileSync(command, args) {
      assert.equal(command, "git");
      assert.deepEqual(Array.from(args.slice(0, 2)), ["-C", "/var/www/indexus-crm"]);
      return valid.git(Array.from(args.slice(2)));
    },
    spawnSync(command, args, options) {
      assert.equal(command, "bash");
      calls.push(Array.from(args));
      if (args[0] === "-n") return cp.spawnSync(command, args, options);
      assert.deepEqual(Array.from(args), ["-s", "--", "--apply"]);
      assert.ok(options.input.includes(`TARGET=${target}`));
      assert.ok(options.input.includes(helper.OLD_BACKEND));
      return { status: 0 };
    },
  };
  const requirePinned = name => name === "node:child_process" ? fakeCp : require(name);
  requirePinned.main = mod;
  const processMock = { argv: ["node", "-", "--apply", target] };
  vm.runInNewContext(fs.readFileSync("script/operator/promote-standing-analysis.cjs", "utf8"), {
    module: mod, exports: mod.exports, require: requirePinned, process: processMock,
    console: { log() {}, error(message) { assert.fail(message); } },
  });
  assert.deepEqual(calls, [["-n"], ["-s", "--", "--apply"]]);
  assert.equal(processMock.exitCode, 0);
});
