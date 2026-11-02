const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cp = require("node:child_process");
const vm = require("node:vm");
const release = require("./promote-mission-exports-no-backup.cjs");
const renderer = require("./promote-complete-replit.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
const filename = "script/operator/promote-mission-exports-no-backup.cjs";
const git = (args, raw = false) => {
  const bytes = cp.execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return raw ? bytes : bytes.trimEnd();
};
const fromBase = base => (args, raw) => args.join(" ") === "rev-parse HEAD" ? base : git(args, raw);

test("six reviewed bases retain exact patch bytes, ancestry, scope, dependencies and schema", () => {
  assert.equal(release.PLANS.length, 6);
  for (const reviewed of release.PLANS) {
    const plan = release.validate(fromBase(reviewed.base), release.TARGET);
    assert.equal(plan.files.length, reviewed.fileCount);
    assert.equal(plan.files.some(file => /automation-engine|server\/routes.ts|server\/index.ts|schema.ts$/.test(file)), false);
    for (const [match, value, error] of [
      ["rev-list", "99", /ancestry/], ["--name-only", "server/automation-engine.ts", /scope/],
      ["--binary", "changed patch", /patch/], [`${release.TARGET}:package.json`, "changed", /Dependencies/],
    ]) assert.throws(() => release.validate((args, raw) => args.includes(match) ? value : fromBase(reviewed.base)(args, raw), release.TARGET), error);
  }
  assert.throws(() => release.validate(() => "a".repeat(40), release.TARGET), /Unapproved/);
  assert.throws(() => release.validate(() => release.TARGET, release.TARGET), /already/);
  assert.throws(() => release.validate(fromBase(release.PLANS[0].base), "a".repeat(40)), /Unreviewed/);
});

test("no-backup shell preserves private staged build, guards, old assets and health checks; no backup or DB restore", () => {
  for (const reviewed of release.PLANS) {
    const plan = release.validate(fromBase(reviewed.base), release.TARGET);
    const body = release.render(template, renderer.render, plan);
    assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
    assert.doesNotMatch(body, /pg_dump|pg_restore|DATABASE_BACKUP|STORE\/backup|backup\/|tar -cpf|previous-source|restore_file/);
    for (const needle of ["/dev/sdb1", "0:0:700", "flock -n 9", "check_source", "VERIFY_APPLICATION_SOURCES",
      'git merge --ff-only "$TARGET"', 'sudo cp -an "$VIEW/dist/public/."', "wait_health",
      "BEZ_ZALOHY", "RUNTIME_CHANGED", "git -C", "reset --keep", "pm2 restart indexus-crm",
      "SUKROMNY_BUILD_BEZ_ZALOHY", "NASADENIE_OK", ".mission-exports-build-"])
      assert.ok(body.includes(needle), needle);
    assert.ok(body.indexOf("PHASE=zostavenie") < body.indexOf("PHASE=zdroje"));
    assert.ok(body.includes('if (( RUNTIME_CHANGED )); then'));
    assert.doesNotMatch(body, /git reset --hard|git clean|npm install|npm ci/);
    const tests = body.match(/(DATABASE_URL=\S+) npx --no-install tsx --test ([^>\n]+)/);
    assert.equal(tests[1], "DATABASE_URL=postgresql://127.0.0.1:1/mission_funnel_unit");
    assert.deepEqual(tests[2].trim().split(" "), release.TESTS);
    for (const marker of ["VERIFY_APPLICATION_SOURCES", "VALIDATE_ASSETS"]) {
      const payload = body.split(`<<'${marker}'\n`)[1]?.split(`\n${marker}`)[0];
      assert.ok(payload);
      assert.doesNotThrow(() => new vm.Script(payload));
    }
  }
  assert.throws(() => release.render(template, renderer.render, { base: release.PLANS[0].base }), /Unvalidated/);
  const plan = release.validate(fromBase(release.PLANS[0].base), release.TARGET);
  assert.throws(() => release.render(template + "\n", renderer.render, plan), /template changed/);
});

test("file and stdin entry require explicit no-backup approval and pinned application target", () => {
  for (const args of [[filename], ["-"], [filename, "--apply", release.TARGET]]) {
    const result = cp.spawnSync(process.execPath, args, { input: fs.readFileSync(filename), encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Use --apply-no-backup/);
  }
});

test("real console main renders the pinned candidate; all production execution stays intercepted", () => {
  for (const reviewed of release.PLANS) {
    const calls = [], messages = [];
    const wrapped = {
      execFileSync(command, args) {
        assert.equal(command, "git");
        assert.equal(args[1], "/var/www/indexus-crm");
        return fromBase(reviewed.base)(args.slice(2), true);
      },
      spawnSync(command, args, options) {
        assert.equal(command, "bash");
        calls.push(args);
        if (args.join(" ") === "-n") return cp.spawnSync(command, args, options);
        assert.deepEqual([...args], ["-s", "--", "--apply"]);
        assert.doesNotMatch(options.input, /pg_dump|pg_restore|STORE\/backup|restore_file/);
        assert.ok(options.input.includes(`BASE=${reviewed.base}`));
        return { status: 0 };
      },
    };
    const fakeProcess = { argv: ["node", "-", "--apply-no-backup", release.TARGET] };
    const fakeRequire = name => name === "node:child_process" ? wrapped : require(name);
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
      require: fakeRequire, module: { exports: {}, parent: null }, process: fakeProcess,
      console: { log: message => messages.push(message), error: message => { throw Error(message); } },
    }, { filename });
    assert.equal(fakeProcess.exitCode, 0);
    assert.equal(calls.length, 2);
    assert.ok(messages.includes("BEZ_NOVEJ_ZALOHY_BEZ_AUTOMATICKEHO_NAVRATU_RUNTIME"));
    assert.ok(messages.includes("PRIPRAVENE_VYDANIE=" + release.TARGET));
  }
});
