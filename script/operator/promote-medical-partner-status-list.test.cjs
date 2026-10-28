const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), cp = require("node:child_process");
const helper = require("./promote-medical-partner-status-list.cjs");
const complete = require("./promote-complete-replit.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
const target = "a".repeat(40);
test("operator procedure parses, preserves backups/rollback and never runs application tests against live data", () => {
  const body = helper.renderMedicalPartner(template, target, complete.render);
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
  for (const marker of ["VERIFY_APPLICATION_SOURCES", "DATABASE_BACKUP", "git merge --ff-only",
    'reset --keep "$BASE"', "/dev/sdb1", "pm2 restart indexus-crm", "npm run build",
    "UNIT_DATABASE_GUARD", helper.TESTS, "Operator unit tests must not access a database",
    "cp -a --update=none", 'cat "$VIEW/tests.log"']) assert.ok(body.includes(marker), marker);
  assert.ok(body.includes(`BASE=${helper.BASE}`));
  assert.ok(body.includes(`TARGET=${target}`));
  for (const forbidden of ["npm install", "npm ci", "db:push", "pg_restore --dbname", "git pull", "reset --hard",
    "UPDATE mission_callback", "DELETE FROM", "status-list-confirmation-preview.db.test.ts >"])
    assert.ok(!body.includes(forbidden), forbidden);
  assert.throws(() => helper.renderMedicalPartner(template + "\n", target, complete.render), /template changed/);
});
test("only the verified live parent and exact completed change whitelist are accepted", () => {
  const values = new Map([
    ["rev-parse|HEAD", helper.BASE],
    [`rev-parse|${target}^`, helper.BASE],
    [`diff|--name-only|${helper.BASE}|${target}`, helper.FILES.join("\n")],
  ]);
  const git = args => { const key = args.join("|"); assert.ok(values.has(key)); return values.get(key); };
  helper.validateRelease(git, target);
  for (const [key, original] of values) {
    values.set(key, "unexpected");
    assert.throws(() => helper.validateRelease(git, target));
    values.set(key, original);
  }
  assert.throws(() => helper.validateRelease(git, "main"), /Invalid pinned target/);
});
test("direct invocation without explicit apply stops before touching the server", () => {
  const result = cp.spawnSync(process.execPath, ["script/operator/promote-medical-partner-status-list.cjs"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Use --apply/);
  assert.doesNotMatch(result.stdout, /PRIPRAVENE|ZALOHA|NASADENIE/);
});
