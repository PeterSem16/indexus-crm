const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const vm = require("node:vm");
const release = require("./promote-mission-agent-funnel.cjs");
const renderer = require("./promote-complete-replit.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
const filename = "script/operator/promote-mission-agent-funnel.cjs";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const git = (args, raw = false) => {
  const value = cp.execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return raw ? value : value.trimEnd();
};
const baseGit = plan => (args, raw) => args.join(" ") === "rev-parse HEAD" ? plan.base : git(args, raw);

test("all four known production bases pin exact ancestry, patch bytes and reviewed scope", () => {
  assert.equal(release.PLANS.length, 4);
  for (const plan of release.PLANS) {
    assert.equal(release.validate(baseGit(plan), release.TARGET), plan);
    assert.equal(plan.files.some(path => /automation-engine|server\/routes.ts|server\/index.ts|schema.ts$/.test(path)), false);
    for (const [match, replacement, error] of [
      ["rev-list", "100", /ancestry/],
      ["--name-only", "server/automation-engine.ts", /scope/],
      ["--binary", "unreviewed patch", /patch/],
      [`${release.TARGET}:package.json`, "changed", /Dependencies/],
    ]) {
      assert.throws(() => release.validate((args, raw) =>
        args.includes(match) ? replacement : baseGit(plan)(args, raw), release.TARGET), error);
    }
  }
  assert.throws(() => release.validate(() => "a".repeat(40), release.TARGET), /approved base/);
  assert.throws(() => release.validate(() => release.TARGET, release.TARGET), /already present/);
  assert.throws(() => release.validate(baseGit(release.PLANS[0]), "a".repeat(40)), /Unreviewed/);
  assert.equal(hash(git(["show", `${release.TARGET}:script/operator/promote-complete-replit.cjs`], true)), release.RENDERER_HASH);
});

test("each rendered procedure preserves private data-disk backups, staged build and runtime-only rollback", () => {
  for (const plan of release.PLANS) {
    const body = release.render(template, renderer.render, plan);
    assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
    for (const marker of ["DATABASE_BACKUP", "VERIFY_APPLICATION_SOURCES", "VALIDATE_ASSETS"]) {
      const payload = body.split(`<<'${marker}'\n`)[1]?.split(`\n${marker}`)[0];
      assert.ok(payload, marker);
      assert.doesNotThrow(() => new vm.Script(payload));
    }
    for (const needle of [
      `BASE=${plan.base}`, `TARGET=${release.TARGET}`, "/dev/sdb1", "0:0:700", "pg_dump", "pg_restore",
      "dist.tar", "database.dump", "source.tar", "check_source", "pm2 restart indexus-crm",
      'git merge --ff-only "$TARGET"', 'git -C "$APP" reset --keep "$BASE"', ".mission-agent-funnel-",
    ]) assert.ok(body.includes(needle), needle);
    assert.ok(body.indexOf("PHASE=zostavenie") < body.indexOf("PHASE=zdroje"));
    assert.equal(body.includes("git reset --hard"), false);
    assert.equal(body.includes("git clean"), false);
    assert.doesNotMatch(body, /pg_restore\s+(?:--clean|-d|--dbname)/);
    const tests = body.match(/npx --no-install tsx --test ([^>\n]+)/)[1].trim();
    assert.deepEqual(tests.split(" "), release.TESTS);
    assert.doesNotMatch(tests, /\.db\.test|hospital-agreement-routes/);
  }
  assert.throws(() => release.render(template + "\n", renderer.render, release.PLANS[0]), /template changed/);
  assert.throws(() => release.render(template, renderer.render, { ...release.PLANS[0] }), /Unreviewed/);
});

test("mocked release tests cannot inherit the live database URL", () => {
  const body = release.render(template, renderer.render, release.PLANS[0]);
  const assignment = body.match(/(DATABASE_URL=\S+) npx --no-install tsx --test /)[1];
  assert.equal(assignment, "DATABASE_URL=postgresql://127.0.0.1:1/mission_funnel_unit");
  const result = cp.spawnSync("bash", ["-c", `${assignment} node -e 'process.stdout.write(process.env.DATABASE_URL)'`], {
    env: { ...process.env, DATABASE_URL: "postgresql://must-not-be-used.invalid/db" }, encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, assignment.slice("DATABASE_URL=".length));
});

test("file and stdin entry points reject missing or unpinned arguments", () => {
  for (const args of [[filename], ["-"], [filename, "--apply", "a".repeat(40)]]) {
    const result = cp.spawnSync(process.execPath, args, { input: fs.readFileSync(filename), encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Use --apply/);
  }
});

test("real stdin main reaches the reviewed shell but production execution is intercepted", () => {
  for (const plan of release.PLANS) {
    const calls = [], messages = [];
    const wrapped = {
      execFileSync(command, args, options) {
        assert.equal(command, "git");
        assert.equal(args[0], "-C");
        assert.equal(args[1], "/var/www/indexus-crm");
        return baseGit(plan)(args.slice(2), true);
      },
      spawnSync(command, args, options) {
        assert.equal(command, "bash");
        calls.push(args);
        if (args.join(" ") === "-n") return cp.spawnSync(command, args, options);
        assert.deepEqual([...args], ["-s", "--", "--apply"]);
        assert.ok(options.input.includes("PHASE=zaloha"));
        assert.ok(options.input.includes(`BASE=${plan.base}`));
        return { status: 0 };
      },
    };
    const fakeProcess = { argv: ["node", "-", "--apply", release.TARGET] };
    const fakeRequire = name => name === "node:child_process" ? wrapped : require(name);
    const context = {
      require: fakeRequire, module: { exports: {}, parent: null }, process: fakeProcess,
      console: { log: text => messages.push(text), error: text => { throw Error(text); } },
    };
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
    assert.equal(fakeProcess.exitCode, 0);
    assert.equal(calls.length, 2);
    assert.ok(messages.includes("PRIPRAVENE_VYDANIE=" + release.TARGET));
    assert.ok(messages.includes("POVODNA_VERZIA=" + plan.base));
  }
});
