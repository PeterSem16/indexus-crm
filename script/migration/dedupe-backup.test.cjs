const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { createVerifiedBackup, safeBackupRoot } = require("./dedupe-backup.cjs");

async function fakeTools(t, { empty = false, corrupt = false, corruptFullRead = false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dedupe-tools-"));
  const log = path.join(dir, "argv.json");
  const tool = path.join(dir, "tool.cjs");
  await fs.writeFile(tool, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "--version") { console.log("fake-tool 1.0"); process.exit(0); }
if (process.env.FAKE_LOG) fs.writeFileSync(process.env.FAKE_LOG, JSON.stringify({ args, password: process.env.PGPASSWORD }));
if (args[0] === "--list") { if (${corrupt ? "true" : "false"}) process.exit(2); console.log("Format: CUSTOM"); process.exit(0); }
if (args.includes("--exit-on-error")) { if (${corruptFullRead ? "true" : "false"}) process.exit(3); process.exit(0); }
const file = args[args.indexOf("--file") + 1];
fs.writeFileSync(file, ${empty ? "Buffer.alloc(0)" : "Buffer.from('CUSTOM DATABASE DUMP')"});
`);
  await fs.chmod(tool, 0o700);
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return { tool, log };
}

test("creates a verified mode-restricted backup without putting password in argv", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dedupe-backups-"));
  await fs.chmod(root, 0o700);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fake = await fakeTools(t);
  const previousLog = process.env.FAKE_LOG;
  process.env.FAKE_LOG = fake.log;
  t.after(() => {
    if (previousLog === undefined) delete process.env.FAKE_LOG;
    else process.env.FAKE_LOG = previousLog;
  });
  const result = await createVerifiedBackup({
    backupRoot: root, pgDumpPath: fake.tool, pgRestorePath: fake.tool,
    password: "not-in-argv", host: "db.internal", port: 5432, database: "crm", user: "indexus",
    now: "2026-01-02T03:04:05.000Z",
  });
  const manifest = JSON.parse(await fs.readFile(result.manifestPath, "utf8"));
  const dumpStat = await fs.stat(result.dumpPath);
  const manifestStat = await fs.stat(result.manifestPath);
  const directoryStat = await fs.stat(result.directory);
  assert.equal(directoryStat.mode & 0o777, 0o700);
  assert.equal(dumpStat.mode & 0o777, 0o600);
  assert.equal(manifestStat.mode & 0o777, 0o600);
  assert.equal(manifest.dump.bytes, dumpStat.size);
  assert.equal(manifest.dump.sha256, crypto.createHash("sha256").update(await fs.readFile(result.dumpPath)).digest("hex"));
  assert.equal(manifest.db.database, "crm");
  assert.equal(manifest.verification.fullArchiveRead, true);
  assert.match(manifest.restoreCommandTemplate, /PGPASSWORD="\$PGPASSWORD"/);
  assert.doesNotMatch(JSON.stringify(manifest), /not-in-argv/);
  const invocation = JSON.parse(await fs.readFile(fake.log, "utf8"));
  assert(!invocation.args.join(" ").includes("not-in-argv"));
  assert.equal(invocation.password, "not-in-argv");
});

test("rejects relative and broad backup roots", () => {
  assert.throws(() => safeBackupRoot("relative/path"), /absolute/);
  assert.throws(() => safeBackupRoot("/tmp"), /unsafe/);
});

test("rejects a backup root readable by group or others", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dedupe-backups-open-"));
  await fs.chmod(root, 0o755);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await assert.rejects(
    createVerifiedBackup({ backupRoot: root, database: "crm" }),
    /group or others/
  );
});

test("rejects empty, corrupt TOC and corrupt data blocks", async (t) => {
  for (const config of [{ empty: true }, { corrupt: true }, { corruptFullRead: true }]) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "dedupe-backups-"));
    const fake = await fakeTools(t, config);
    await assert.rejects(
      createVerifiedBackup({ backupRoot: root, pgDumpPath: fake.tool, pgRestorePath: fake.tool, database: "crm" }),
      /empty|verification|full archive read/
    );
    await fs.rm(root, { recursive: true, force: true });
  }
});