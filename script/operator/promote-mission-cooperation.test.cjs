const { test } = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const path = require("node:path");
const release = require("./promote-mission-cooperation.cjs");
const root = path.resolve(__dirname, "../..");
function git(args, raw = false) {
  if (args.join(" ") === "rev-parse HEAD") return release.BASE;
  const output = cp.execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return raw ? output : output.trimEnd();
}
test("only the reviewed base, tree, scope, patch and unchanged schema/dependencies are admitted", () => {
  assert.equal(release.validate(git, release.TARGET).paths.length, 10);
  assert.throws(() => release.validate(git, "wrong"));
  assert.throws(() => release.validate((args, raw) => args.join(" ") === "rev-parse HEAD" ? "wrong" : git(args, raw), release.TARGET));
  assert.throws(() => release.validate((args, raw) => args.includes("--binary") ? "modified" : git(args, raw), release.TARGET));
  assert.throws(() => release.validate((args, raw) => args.includes("--name-only") ? git(args, raw) + "\n.env" : git(args, raw), release.TARGET));
  assert.throws(() => release.validate((args, raw) => args[1] === release.TARGET + ":shared/schema.ts" ? "modified" : git(args, raw), release.TARGET));
});
test("isolated build, read-only unit tests and private runtime backup precede promotion", () => {
  const body = release.render(git, release.validate(git, release.TARGET));
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body }).status, 0);
  for (const required of ["/dev/sdb1", "STORE/backup/dist.tar", "0:0:700", "VERIFY_APPLICATION_SOURCES",
    "flock -n 9", "pm2 restart indexus-crm", "NASADENIE_OK", "POVODNA_VERZIA_OBNOVENA",
    ".mission-cooperation-", "cooperation_unit", "mission-cooperation-standalone.test.ts"])
    assert.ok(body.includes(required), required);
  assert.ok(body.indexOf("npm run build") < body.indexOf("PHASE=zdroje"));
  assert.ok(body.indexOf("tests.log") < body.indexOf("PHASE=zdroje"));
  assert.doesNotMatch(body, /pg_dump|pg_restore|reset --hard|git clean|npm install|npm ci|--test[^\n]*\.db\.test/);
  assert.throws(() => release.render(git, { ...release.validate(git, release.TARGET), paths: [".env"] }));
});
test("the real entry point fails closed on missing or wrong target, including stdin", () => {
  for (const args of [[], ["--apply", "wrong"]]) {
    const run = cp.spawnSync("node", [require.resolve("./promote-mission-cooperation.cjs"), ...args], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /STOP: Use --apply/);
  }
  const run = cp.spawnSync("node", ["-"], {
    input: require("node:fs").readFileSync(require.resolve("./promote-mission-cooperation.cjs")), encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /STOP: Use --apply/);
});
