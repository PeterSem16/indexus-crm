const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const vm = require("node:vm");
const release = require("./promote-mission-reporting.cjs");
const renderer = require("./promote-complete-replit.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

test("pins the exact five published commits, source scope, dependency and schema parity", () => {
  const git = (args, raw = false) => {
    const result = cp.execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return raw ? result : result.trimEnd();
  };
  const fromBase = (args, raw) => args.join(" ") === "rev-parse HEAD" ? release.BASE : git(args, raw);
  assert.doesNotThrow(() => release.validate(fromBase, release.TARGET));
  assert.throws(() => release.validate(git, release.TARGET), /Production HEAD changed/);
  assert.throws(() => release.validate(fromBase, "a".repeat(40)), /Unreviewed/);
  assert.throws(() => release.validate((args, raw) =>
    args.includes("--binary") ? fromBase(args, raw) + "\n" : fromBase(args, raw), release.TARGET), /patch differs/);
  assert.equal(hash(git(["show", `${release.TARGET}:script/operator/promote-complete-replit.cjs`], true)), release.RENDERER_HASH);
});
test("reuses staged production build, private data-disk backup, health checks and runtime rollback", () => {
  const body = release.render(template, renderer.render);
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
  for (const marker of ["DATABASE_BACKUP", "VERIFY_APPLICATION_SOURCES", "VALIDATE_ASSETS"]) {
    const payload = body.split(`<<'${marker}'\n`)[1]?.split(`\n${marker}`)[0];
    assert.ok(payload, marker);
    assert.doesNotThrow(() => new vm.Script(payload));
  }
  assert.match(body, /findmnt.*\/dev\/sdb1/);
  assert.match(body, /0:0:700/);
  assert.match(body, /EACCES/);
  assert.match(body, /git archive --format=tar --output=/);
  assert.match(body, /cd "\$VIEW".*npm run build/);
  assert.match(body, /git merge --ff-only "\$TARGET"/);
  assert.match(body, /pm2 restart indexus-crm/);
  assert.match(body, /wait_health/);
  assert.match(body, /git.*reset --keep "\$BASE"/);
  assert.match(body, /cp -an/);
  assert.match(body, /pg_restore.*--list/);
  assert.doesNotMatch(body, /git clean|reset --hard|db:push|npm (?:ci|install)|pg_restore.*--clean/);
  assert.ok(body.indexOf("PHASE=zostavenie") < body.indexOf("PHASE=zdroje"));
  assert.ok(body.indexOf("PHASE=zaloha_databazy_a_konfiguracie") < body.indexOf("PHASE=zostavenie"));
  const tests = body.match(/npx --no-install tsx --test ([^\n]+)/)[1];
  for (const file of release.TESTS) assert.ok(tests.includes(file));
  assert.doesNotMatch(tests, /\.db\.test|hospital-agreement-routes/);
});
test("stdin entry point is self-contained and refuses accidental execution", () => {
  const bytes = fs.readFileSync("script/operator/promote-mission-reporting.cjs", "utf8");
  const result = cp.spawnSync(process.execPath, ["-"], { input: bytes, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Use --apply/);
  assert.ok(bytes.includes("renderer._compile(source, filename)"));
  assert.throws(() => release.render(template + "\n", renderer.render), /template changed/);
});
