const { test } = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const helper = require("./promote-mission-funnel-status-policy.cjs");
const git = (args, raw = false) => {
  const value = cp.execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return raw ? value : value.trimEnd();
};
const productionGit = (args, raw) => args.join(" ") === "rev-parse HEAD" ? helper.BASE : git(args, raw);
test("release is pinned to the diagnosed production source and excludes unrelated code", () => {
  const plan = helper.validate(productionGit, helper.TARGET);
  assert.equal(plan.paths.length, 10);
  assert.ok(plan.paths.includes("server/lib/mission-funnel.ts"));
  assert.ok(plan.paths.every(p => !/^(attached_assets|docs|\.agents)\//.test(p)));
  const changes = git(["diff", "--name-only", helper.PARENT, helper.TARGET]).split("\n");
  assert.equal(changes.length, 8);
  assert.ok(changes.every(p => /mission-(funnel|agent-funnel|cooperation-standalone|material-package-copy)/.test(p)));
  const productionEngine = git(["show", helper.BASE + ":server/lib/mission-funnel.ts"], true);
  assert.equal(crypto.createHash("sha256").update(productionEngine).digest("hex"),
    "93856ab8bf004fe01e2991d25808cc0cd906125e294a9b58cd3222f065903e8f");
});
test("changed production HEAD, target, source fingerprint or scope stops before rendering", () => {
  assert.throws(() => helper.validate(git, helper.TARGET), /HEAD/);
  assert.throws(() => helper.validate(productionGit, "0".repeat(40)), /target/);
  for (const altered of ["diff --name-only", "diff --binary"]) {
    const badGit = (args, raw) => args.join(" ").startsWith(altered)
      ? "changed-source\n" : productionGit(args, raw);
    assert.throws(() => helper.validate(badGit, helper.TARGET), /whitelist|fingerprint/);
  }
});
test("promotion builds away from live files, tests the exact target and retains safe rollback", () => {
  const body = helper.render(productionGit, helper.validate(productionGit, helper.TARGET));
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
  assert.match(body, /\/dev\/sdb1/);
  assert.match(body, /PHASE=zaloha/);
  assert.match(body, /backup\/dist\.tar/);
  assert.match(body, /PHASE=zostavenie/);
  assert.match(body, /npm run build/);
  assert.match(body, /DATABASE_URL=postgresql:\/\/127\.0\.0\.1:1\/funnel_policy_unit/);
  for (const file of helper.TESTS) assert.ok(body.includes(file));
  assert.doesNotMatch(body, /pg_dump|pg_restore|npm install|npm ci|reset --hard|git clean/);
  assert.ok(body.indexOf("npm run build") < body.indexOf("PHASE=zdroje"));
});
test("entry point refuses accidental invocation without the exact apply argument", () => {
  const result = cp.spawnSync(process.execPath, ["script/operator/promote-mission-funnel-status-policy.cjs"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Use --apply/);
});
