const { test } = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const release = require("./promote-mission-package-outcomes.cjs");
const root = path.resolve(__dirname, "../..");
function git(args, raw = false) {
  if (args.join(" ") === "rev-parse HEAD") return release.BASE;
  const output = cp.execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return raw ? output : output.trimEnd();
}
test("only the reviewed published base, target, tree, patch and source whitelist are admitted", () => {
  assert.equal(release.validate(git, release.TARGET).paths.length, 17);
  assert.throws(() => release.validate(git, "wrong"));
  for (const [match, replacement] of [
    ["rev-parse HEAD", "wrong"], ["rev-parse " + release.TARGET + "^{tree}", "wrong"],
    ["rev-parse " + release.TARGET + "^", "wrong"],
    ["rev-parse " + release.TARGET + ":shared/schema.ts", "wrong"],
    ["rev-parse " + release.TARGET + ":server/index.ts", "wrong"],
    ["rev-parse " + release.TARGET + ":package.json", "wrong"],
    ["rev-parse " + release.TARGET + ":package-lock.json", "wrong"],
  ]) assert.throws(() => release.validate((args, raw) =>
    args.join(" ") === match ? replacement : git(args, raw), release.TARGET));
  assert.throws(() => release.validate((args, raw) => args.includes("--binary") ? "modified" : git(args, raw), release.TARGET));
  assert.throws(() => release.validate((args, raw) => args.includes("--name-only")
    ? git(args, raw) + "\n.env" : git(args, raw), release.TARGET));
});
test("isolated build, offline tests, private backup and readiness gates precede promotion", () => {
  const plan = release.validate(git, release.TARGET), body = release.render(git, plan);
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body }).status, 0);
  for (const required of ["/dev/sdb1", "STORE/backup/dist.tar", "0:0:700", "VERIFY_APPLICATION_SOURCES",
    "flock -n 9", "pm2 restart indexus-crm", "NASADENIE_OK", "POVODNA_VERZIA_OBNOVENA",
    ".mission-package-outcomes-", "package_unit", ...release.TESTS])
    assert.ok(body.includes(required), required);
  assert.ok(body.indexOf("npm run build") < body.indexOf("PHASE=zdroje"));
  assert.ok(body.indexOf("tests.log") < body.indexOf("PHASE=zdroje"));
  assert.doesNotMatch(body, /pg_dump|pg_restore|reset --hard|git clean|npm install|npm ci|--test[^\n]*\.db\.test/);
  assert.throws(() => release.render(git, { ...plan, paths: [".env"] }));
  assert.throws(() => release.render((args, raw) => args.join(" ") === "show " + release.TARGET + ":script/operator/promote-complete-replit.cjs"
    ? "modified" : git(args, raw), plan));
});
test("file and stdin entry points reject missing or wrong arguments before touching production", () => {
  for (const args of [[], ["--apply", "wrong"]]) {
    const run = cp.spawnSync("node", [require.resolve("./promote-mission-package-outcomes.cjs"), ...args], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /STOP: Use --apply/);
    const stdin = cp.spawnSync("node", ["-", ...args], {
      input: fs.readFileSync(require.resolve("./promote-mission-package-outcomes.cjs")), encoding: "utf8",
    });
    assert.equal(stdin.status, 1);
    assert.match(stdin.stderr, /STOP: Use --apply/);
  }
});
