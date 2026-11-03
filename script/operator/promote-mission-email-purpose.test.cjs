const { test } = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const path = require("node:path");
const release = require("./promote-mission-email-purpose.cjs");
const root = path.resolve(__dirname, "../..");
function git(args, raw = false) {
  if (args.join(" ") === "rev-parse HEAD") return release.BASE;
  const output = cp.execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  return raw ? output : output.trimEnd();
}
test("reviewed base, target, exact tree, scope and patch are mandatory", () => {
  assert.ok(release.validate(git, release.TARGET).paths.length > 40);
  assert.throws(() => release.validate(git, "wrong"));
  for (const query of ["rev-parse HEAD", `rev-parse ${release.TARGET}^{tree}`]) {
    assert.throws(() => release.validate((args, raw) =>
      args.join(" ") === query ? "wrong" : git(args, raw), release.TARGET));
  }
  assert.throws(() => release.validate((args, raw) =>
    args.includes("--binary") ? "modified" : git(args, raw), release.TARGET));
  assert.throws(() => release.validate((args, raw) =>
    args.includes("--name-only") ? git(args, raw) + "\n.env" : git(args, raw), release.TARGET));
});
test("private staged build and offline tests precede source and runtime promotion", () => {
  const body = release.render(git, release.validate(git, release.TARGET));
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body }).status, 0);
  for (const required of ["/dev/sdb1", "STORE/backup/dist.tar", "0:0:700",
    "VERIFY_APPLICATION_SOURCES", "flock -n 9", "wait_health", "pm2 restart indexus-crm",
    "NASADENIE_OK", "POVODNA_VERZIA_OBNOVENA", "mission_email_unit", ".mission-email-purpose-"])
    assert.ok(body.includes(required), required);
  assert.ok(body.indexOf("npm run build") < body.indexOf("PHASE=zdroje"));
  assert.ok(body.indexOf("tests.log") < body.indexOf("PHASE=zdroje"));
  assert.doesNotMatch(body, /pg_dump|pg_restore|reset --hard|git clean|npm install|npm ci|--test[^\n]*\.db\.test/);
  assert.throws(() => release.render(git, { ...release.validate(git, release.TARGET), paths: [".env"] }));
});
test("startup schema addition is inert and no historical purpose is guessed", () => {
  const source = git(["show", release.TARGET + ":server/index.ts"], true);
  assert.match(source, /ADD COLUMN IF NOT EXISTS email_purpose varchar\(50\) NOT NULL DEFAULT 'unspecified'/);
  assert.doesNotMatch(source, /UPDATE message_templates SET email_purpose/);
});
test("real console entry rejects missing targets, including stdin invocation", () => {
  for (const args of [[], ["--apply", "wrong"]]) {
    const run = cp.spawnSync("node", [require.resolve("./promote-mission-email-purpose.cjs"), ...args], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /STOP: Use --apply/);
  }
  const run = cp.spawnSync("node", ["-"], {
    input: require("node:fs").readFileSync(require.resolve("./promote-mission-email-purpose.cjs")), encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /STOP: Use --apply/);
});
