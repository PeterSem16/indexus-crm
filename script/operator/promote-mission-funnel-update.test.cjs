const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const vm = require("node:vm");
const release = require("./promote-mission-funnel-update.cjs");
const renderer = require("./promote-complete-replit.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const git = (args, raw = false) => {
  const bytes = cp.execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return raw ? bytes : bytes.trimEnd();
};
const fromBase = (args, raw) => args.join(" ") === "rev-parse HEAD" ? release.BASE : git(args, raw);

test("pins reviewed source scope, five commits and unchanged dependencies/schema", () => {
  assert.doesNotThrow(() => release.validate(fromBase, release.TARGET));
  assert.throws(() => release.validate(git, release.TARGET), /Production HEAD changed/);
  assert.throws(() => release.validate(fromBase, "a".repeat(40)), /Unreviewed/);
  for (const [match, replacement, error] of [
    ["rev-list", "6", /ancestry/],
    ["--name-only", "server/automation-engine.ts", /scope/],
    ["--binary", "unreviewed patch", /patch/],
    [`${release.TARGET}:package.json`, "changed", /Dependencies/],
  ]) {
    assert.throws(() => release.validate((args, raw) =>
      args.includes(match) ? replacement : fromBase(args, raw), release.TARGET), error);
  }
  assert.equal(hash(git(["show", `${release.TARGET}:script/operator/promote-complete-replit.cjs`], true)), release.RENDERER_HASH);
});

test("keeps proven private backup/build and rollback without reverting business data", () => {
  const body = release.render(template, renderer.render);
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
  for (const marker of ["DATABASE_BACKUP", "VERIFY_APPLICATION_SOURCES", "VALIDATE_ASSETS"]) {
    const payload = body.split(`<<'${marker}'\n`)[1]?.split(`\n${marker}`)[0];
    assert.ok(payload, marker);
    assert.doesNotThrow(() => new vm.Script(payload));
  }
  for (const pattern of [/findmnt.*\/dev\/sdb1/, /0:0:700/, /EACCES/, /pg_restore.*--list/,
    /git archive --format=tar --output=/, /cd "\$VIEW".*npm run build/, /git merge --ff-only "\$TARGET"/,
    /pm2 restart indexus-crm/, /wait_health/, /git.*reset --keep "\$BASE"/, /cp -an/]) assert.match(body, pattern);
  assert.doesNotMatch(body, /git clean|reset --hard|db:push|npm (?:ci|install)|pg_restore.*--clean/);
  assert.ok(body.indexOf("PHASE=zaloha_databazy_a_konfiguracie") < body.indexOf("PHASE=zostavenie"));
  assert.ok(body.indexOf("PHASE=zostavenie") < body.indexOf("PHASE=zdroje"));
  const tests = body.match(/npx --no-install tsx --test ([^\n]+)/)[1];
  for (const file of release.TESTS) assert.ok(tests.includes(file));
  assert.doesNotMatch(tests, /\.db\.test|hospital-agreement-routes/);
  assert.throws(() => release.render(template + "\n", renderer.render), /template changed/);
});

test("test database placeholder is command-local and cannot inherit production configuration", () => {
  const body = release.render(template, renderer.render);
  const assignment = body.match(/(DATABASE_URL=\S+) npx --no-install tsx --test /)[1];
  assert.equal(assignment, "DATABASE_URL=postgresql://127.0.0.1:1/mission_funnel_unit");
  for (const inherited of ["", "postgresql://inherited.invalid/never_use"]) {
    const probe = cp.spawnSync("bash", ["-c", `${assignment} node -e 'process.stdout.write(process.env.DATABASE_URL)'; printf '\\n%s' \"$DATABASE_URL\"`], {
      env: { ...process.env, DATABASE_URL: inherited }, encoding: "utf8",
    });
    assert.equal(probe.status, 0);
    assert.equal(probe.stdout, "postgresql://127.0.0.1:1/mission_funnel_unit\n" + inherited);
  }
});

test("real file and stdin entries fail explicitly without approved arguments", () => {
  const filename = "script/operator/promote-mission-funnel-update.cjs";
  for (const args of [[filename], ["-"]]) {
    const result = cp.spawnSync(process.execPath, args, {
      input: fs.readFileSync(filename), encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Use --apply/);
  }
});
