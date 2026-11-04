const test = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const release = require("./promote-record-activity-state.cjs");
const git = (args, raw = false) => {
  if (args.join(" ") === "rev-parse HEAD") return "70668b15ae2ddace29946c6bb42d6bd2a80a3029";
  const output = cp.execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return raw ? output : output.trimEnd();
};
test("the exact production patch, parent, tree and source whitelist validate", () => {
  const engine = release.loadEngine(git);
  assert.equal(engine.TARGET, release.TARGET);
  assert.equal(engine.TESTS.length, 13);
  const plan = engine.validate(git, release.TARGET);
  assert.equal(plan.paths.length, 26);
  assert.ok(plan.paths.includes("server/lib/agreement-workspace.ts"));
  assert.ok(plan.paths.includes("client/src/components/record-activity-button.tsx"));
  assert.throws(() => engine.validate(git, "wrong-target"));
  assert.throws(() => engine.validate(args => args.join(" ") === "rev-parse HEAD" ? "unexpected-head" : git(args), release.TARGET));
});
test("promotion renders valid shell with isolated build and no database or dependency mutations", () => {
  const engine = release.loadEngine(git);
  const body = engine.render(git, engine.validate(git, release.TARGET));
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
  assert.ok(body.includes("server/lib/record-activity-state.test.ts"));
  assert.ok(body.includes("client/src/components/record-activity-display.test.ts"));
  assert.ok(body.includes("npm run build"));
  assert.doesNotMatch(body, /pg_dump|pg_restore|DATABASE_BACKUP|reset --hard|git clean|npm install|npm ci/);
});
test("a modified promotion engine cannot be loaded", () => {
  assert.throws(() => release.loadEngine(() => "changed source"), /Reviewed promotion engine differs/);
});
test("the already-promoted previous fix is also an explicitly fingerprinted safe baseline", () => {
  const alternative = (args, raw = false) => args.join(" ") === "rev-parse HEAD"
    ? "8bcf6241f1a4618ebc4ddc2061b51bba0504128a" : git(args, raw);
  const engine = release.loadEngine(alternative);
  const plan = engine.validate(alternative, release.TARGET);
  assert.equal(plan.base, "8bcf6241f1a4618ebc4ddc2061b51bba0504128a");
  assert.equal(plan.paths.length, 10);
  assert.equal(cp.spawnSync("bash", ["-n"], { input: engine.render(alternative, plan), encoding: "utf8" }).status, 0);
});
test("the operator's piped stdin command executes the argument guard instead of silently doing nothing", () => {
  const run = cp.spawnSync(process.execPath, ["-"], {
    input: fs.readFileSync("script/operator/promote-record-activity-state.cjs", "utf8"),
    encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(`Use --apply ${release.TARGET}`));
});
