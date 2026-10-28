const test = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const operator = require("./promote-pulse-runs-fix.cjs");
const oldOperator = require("./promote-status-list-ergonomics.cjs");
const complete = require("./promote-complete-replit.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
const target = "a".repeat(40);

function responses(base) {
  return {
    "rev-parse|HEAD": base,
    [`rev-parse|${target}^`]: operator.TOOLING_BASE,
    [`rev-parse|${operator.TOOLING_BASE}^`]: operator.PRODUCT_BASE,
    [`diff|--name-only|${operator.PRODUCT_BASE}|${target}`]: operator.ALL_FILES.join("\n"),
    [`diff|--name-only|${operator.TOOLING_BASE}|${target}`]: operator.RELEASE_FILES.join("\n"),
  };
}
test("production base, two-commit ancestry and exact source scope stay pinned", () => {
  for (const base of [operator.PRODUCT_BASE, operator.TOOLING_BASE]) {
    const values = responses(base);
    const git = args => values[args.join("|")] ?? "";
    assert.equal(operator.validate(git, target), base);
    assert.throws(() => operator.validate(git, "main"));
    for (const key of Object.keys(values)) {
      const previous = values[key]; values[key] = "unexpected";
      assert.throws(() => operator.validate(git, target), key);
      values[key] = previous;
    }
  }
});
test("only frontend changes; no backup, backend restart, database access, or overwrite of old assets", () => {
  for (const base of [operator.PRODUCT_BASE, operator.TOOLING_BASE]) {
    const body = operator.render(template, complete, oldOperator, base, target);
    assert.equal(cp.spawnSync("bash", ["-n"], { input: body }).status, 0);
    for (const marker of [
      "VERIFY_APPLICATION_SOURCES", "/dev/sdb1", "VALIDATE_ASSETS",
      "NODE_ENV=production npx --no-install vite build", 'OLD_HTML=$(base64 -w0 dist/public/index.html)',
      'printf \'%s\' "$OLD_HTML" | base64 -d', 'git merge --ff-only "$TARGET"',
      "BACKEND_BEZ_RESTARTU=$PID", "tsx --test client/src/i18n/automation-attachment-translations.test.ts",
    ]) assert.ok(body.includes(marker), marker);
    for (const forbidden of ["pg_dump", "pg_restore", "DATABASE_BACKUP", "pm2 restart", "npm run build",
      "backup/", "reset --hard", "git pull", "npm ci", "npm install"])
      assert.ok(!body.includes(forbidden), forbidden);
    assert.ok(body.includes(`BASE=${base}`));
    assert.ok(body.includes(`TARGET=${target}`));
  }
});
