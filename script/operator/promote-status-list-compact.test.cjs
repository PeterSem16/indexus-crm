const test = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const release = require("./promote-status-list-compact.cjs");

// The API-published commit is not fetched locally; its verified tree is.
// This substitution exists only in this test, never in the operator.
function fixture(base) {
  return (args, raw = false) => {
    if (args.join(" ") === "rev-parse HEAD") return base;
    if (args.join(" ") === `rev-parse ${release.TARGET}^`) return release.PARENT;
    if (args[0] === "merge-base") {
      args = args.map(arg => arg === release.TARGET ? release.PARENT : arg);
    } else {
      args = args.map(arg => arg.replaceAll(release.TARGET, release.TREE));
    }
    const output = cp.execFileSync("git", args, {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    });
    return raw ? output : output.trimEnd();
  };
}
for (const base of Object.keys(release.BASES)) {
  test(`reviewed baseline ${base.slice(0, 8)} validates and renders safe shell`, () => {
    const git = fixture(base);
    const engine = release.loadEngine(git);
    const plan = engine.validate(git, release.TARGET);
    assert.equal(plan.base, base);
    assert.equal(engine.TREE, release.TREE);
    assert.ok(plan.paths.includes("client/src/components/status-list-phase-pipeline.css"));
    const body = engine.render(git, plan);
    assert.equal(cp.spawnSync("bash", ["-n"], { input: body }).status, 0);
    assert.match(body, /client\/src\/lib\/status-list-phase-progress\.test\.ts/);
    assert.match(body, /npm run build/);
    assert.match(body, /pm2 restart/);
    assert.match(body, /\/dev\/sdb1/);
    assert.doesNotMatch(body, /pg_dump|pg_restore|DATABASE_BACKUP|reset --hard|git clean|npm install|npm ci/);
  });
}
test("current phase release changes exactly the compact CSS and regression test", () => {
  const git = fixture(release.PARENT);
  const engine = release.loadEngine(git);
  assert.deepEqual(engine.validate(git, release.TARGET).paths, [
    "client/src/components/status-list-phase-pipeline.css",
    "client/src/lib/status-list-phase-progress.browser.test.mjs",
  ]);
});
test("unknown HEAD, changed source, target, whitelist, patch and parent stop", () => {
  assert.throws(() => release.loadEngine(fixture("unknown-head")), /Unexpected production HEAD/);
  assert.throws(() => release.loadEngine(() => "altered source"), /Reviewed promotion engine/);
  const git = fixture(release.PARENT);
  const engine = release.loadEngine(git);
  assert.throws(() => engine.validate(git, "wrong-target"));
  for (const flag of ["--name-only", "--binary"]) {
    const changed = (args, raw) => args[0] === "diff" && args.includes(flag) ? "altered" : git(args, raw);
    assert.throws(() => engine.validate(changed, release.TARGET));
  }
  assert.throws(() => engine.validate((args, raw) =>
    args.join(" ") === `rev-parse ${release.TARGET}^` ? "wrong-parent" : git(args, raw), release.TARGET));
});
test("piped operator runs argument validation and cannot silently succeed", () => {
  const run = cp.spawnSync(process.execPath, ["-"], {
    input: fs.readFileSync("script/operator/promote-status-list-compact.cjs", "utf8"),
    encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(`Use --apply ${release.TARGET}`));
});
