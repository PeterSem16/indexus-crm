"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  BASE, TODAY_BASE, TODAY_RELEASE, parseArgs, safeRelative, loadManifest, validateReleaseDelta, verifyPreconditions,
  verifyManifestPayloads, snapshotSources, assertNoSymlinkChain, preserveOldAssets, privateTaskAttachmentDir,
  readDatabaseUrl, postgresEnvironment, deploy,
} = require("./deploy-today-tasks.cjs");

const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), "today-tasks-test-")); }
function write(root, name, contents) {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  return target;
}
function createFixtureBackup(root) {
  const target = path.join(root, "private-db-backup.dump");
  fs.writeFileSync(target, "private test backup", { mode: 0o600 });
  fs.chmodSync(target, 0o600);
  return target;
}

test("CLI requires full release SHA and is prepare-only by default", () => {
  assert.throws(() => parseArgs([]), /full 40-character --release/);
  assert.throws(() => parseArgs(["--release", "123"]), /full 40-character/);
  assert.equal(parseArgs(["--release", "a".repeat(40)]).apply, false);
  assert.equal(parseArgs(["--release", "a".repeat(40), "--apply"]).apply, true);
  assert.throws(() => parseArgs(["--release", "a".repeat(40), "--health-url", "https://example.org"]), /loopback/);
  assert.equal(parseArgs(["--help"]).help, true); // help remains independent of a release SHA
});

test("manifest path validation blocks traversal, non-source locations, and credentials", () => {
  assert.equal(safeRelative("client/src/tasks.tsx"), "client/src/tasks.tsx");
  for (const name of ["../.env", "client/../../tmp/file", "data/file.csv", "client/.env.local", "server/secret.key"]) {
    assert.throws(() => safeRelative(name), /Unsafe|outside allowed|Sensitive|Credential/);
  }
});

test("release manifest reads only the requested git payload and validates its contract", () => {
  const release = "c".repeat(40);
  const files = Array.from({ length: 85 }, (_, index) => ({
    path: `client/src/task-${index}.tsx`, expectedSha256: null,
    sha256: "a".repeat(64), gitBlob: "b".repeat(40),
  }));
  files[0].path = "client/src/components/nexus/nexus-signal-tasks.css";
  files[0].allowExistingTaskFile = true;
  const manifest = {
    base: BASE,
    todayBase: TODAY_BASE,
    todayRelease: TODAY_RELEASE,
    files,
    preservedGuards: files.slice(1, 12).map((item) => ({ path: item.path, sha256: "d".repeat(64) })),
  };
  const requests = [];
  const result = loadManifest("/fixture", release, (args) => {
    requests.push(args);
    return Buffer.from(JSON.stringify(manifest));
  });
  assert.equal(result.base, BASE);
  assert.deepEqual(requests, [["show", `${release}:script/today-tasks-manifest.json`]]);
  assert.throws(() => loadManifest("/fixture", release, () => Buffer.from(JSON.stringify({ ...manifest, base: "bad" }))), /invalid structure/);
  const invalidTaskPermission = structuredClone(manifest);
  invalidTaskPermission.files[1].allowExistingTaskFile = true;
  assert.throws(() => loadManifest("/fixture", release, () => Buffer.from(JSON.stringify(invalidTaskPermission))), /Existing-file permission is not allowed/);
});

test("release delta is pinned to the reviewed 85-file task commits, never the compatibility commit delta", () => {
  const names = Array.from({ length: 85 }, (_, index) => `client/src/task-${index}.tsx`).sort();
  const manifest = {
    todayBase: TODAY_BASE,
    todayRelease: TODAY_RELEASE,
    files: names.map((name) => ({ path: name })),
  };
  const calls = [];
  validateReleaseDelta("/unused", manifest, (args) => {
    calls.push(args);
    return `${names.join("\0")}\0`;
  });
  assert.deepEqual(calls, [["diff", "--name-only", "-z", TODAY_BASE, TODAY_RELEASE]]);
  assert.throws(() => validateReleaseDelta("/unused", manifest, () => `${names.join("\0")}\0extra\0`), /outside the exact manifest payload/);
  assert.throws(() => validateReleaseDelta("/unused", { ...manifest, todayRelease: "b".repeat(40) }, () => ""), /review-base\/release SHA/);
});

test("real 85-file manifest accepts only the two reviewed non-source-root paths", () => {
  const raw = fs.readFileSync(path.join(__dirname, "today-tasks-manifest.json"));
  const manifest = loadManifest("/unused", "e".repeat(40), () => raw);
  assert.equal(manifest.files.length, 85);
  assert.ok(manifest.files.some((entry) => entry.path === ".gitignore"));
  assert.ok(manifest.files.some((entry) => entry.path === "docs/releases/2026-10-01-completed.md"));
  assert.throws(() => safeRelative("docs/releases/other.md"), /outside allowed/);
  const root = temp();
  write(root, ".gitignore", "ignored");
  write(root, "docs/releases/2026-10-01-completed.md", "release");
  const inventory = snapshotSources(root);
  assert.ok(inventory.has(".gitignore"));
  assert.equal(inventory.get("docs").kind, "directory");
  assert.equal(inventory.get("docs/releases").kind, "directory");
  assert.ok(inventory.has("docs/releases/2026-10-01-completed.md"));
  fs.rmSync(root, { recursive: true, force: true });
});

test("compatibility commit payloads are pinned and untouched guarded production files must be retained", () => {
  const payload = Buffer.from("today payload");
  const preserved = Buffer.from("merged production file");
  const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");
  const blob = (data) => crypto.createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
  const manifest = {
    files: [{ path: "client/src/task.ts", sha256: sha256(payload), gitBlob: blob(payload) }],
    preservedGuards: [{ path: "server/routes.ts", sha256: sha256(preserved) }],
  };
  const read = (args) => args[1].endsWith(":client/src/task.ts") ? payload : preserved;
  assert.equal(verifyManifestPayloads("/unused", "e".repeat(40), manifest, read).get("client/src/task.ts").toString(), payload.toString());
  assert.throws(
    () => verifyManifestPayloads("/unused", "e".repeat(40), manifest, (args) => args[1].endsWith(":client/src/task.ts") ? payload : Buffer.from("not merged")),
    /does not preserve guarded production file/,
  );
});

test("invalid guard fails closed before touching live sources", () => {
  const root = temp();
  const name = "client/src/task.css";
  write(root, name, "operator content");
  const manifest = {
    files: [{ path: name, expectedSha256: "0".repeat(64), sha256: "1".repeat(64), gitBlob: "2".repeat(40) }],
    preservedGuards: [],
  };
  assert.throws(() => verifyPreconditions(root, manifest), /Pre-deploy source hash mismatch/);
  assert.equal(fs.readFileSync(path.join(root, name), "utf8"), "operator content");
  fs.rmSync(root, { recursive: true, force: true });
});

test("existing task-only file is guarded by its initial inventory snapshot, not a production static guard", () => {
  const root = temp();
  const name = "client/src/components/nexus/nexus-signal-tasks.css";
  write(root, name, "known today-only file");
  const manifest = {
    files: [{ path: name, expectedSha256: null, allowExistingTaskFile: true, sha256: "1".repeat(64), gitBlob: "2".repeat(40) }],
    preservedGuards: [],
  };
  const baseline = snapshotSources(root);
  assert.doesNotThrow(() => verifyPreconditions(root, manifest, baseline));
  fs.writeFileSync(path.join(root, name), "operator edit");
  assert.throws(() => verifyPreconditions(root, manifest, baseline), /changed after its inventory snapshot/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("symlink ancestry is rejected without following or modifying its target", () => {
  const root = temp();
  const outside = temp();
  write(outside, "victim", "untouched");
  fs.symlinkSync(outside, path.join(root, "linked"));
  assert.throws(() => assertNoSymlinkChain(path.join(root, "linked", "victim")), /Symlink path component refused/);
  assert.equal(fs.readFileSync(path.join(outside, "victim"), "utf8"), "untouched");
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

test("existing hashed public assets missing from the build are preserved", () => {
  const root = temp();
  const oldPublic = path.join(root, "old");
  const newPublic = path.join(root, "new");
  write(oldPublic, "assets/old-hashed.js", "old");
  write(oldPublic, "assets/nested/chunk.css", "old css");
  write(newPublic, "assets/new.js", "new");
  preserveOldAssets(oldPublic, newPublic);
  assert.equal(fs.readFileSync(path.join(newPublic, "assets/old-hashed.js"), "utf8"), "old");
  assert.equal(fs.readFileSync(path.join(newPublic, "assets/nested/chunk.css"), "utf8"), "old css");
  assert.equal(fs.readFileSync(path.join(newPublic, "assets/new.js"), "utf8"), "new");
  fs.rmSync(root, { recursive: true, force: true });
});

test("private attachment storage is confirmed outside the public tree without creating it", () => {
  const root = temp();
  fs.mkdirSync(path.join(root, "data"));
  const target = privateTaskAttachmentDir(root, path.join(root, "data"));
  assert.equal(target, path.join(root, "private-task-attachments"));
  assert.equal(fs.existsSync(target), false, "route upload middleware creates it only when necessary");
  assert.throws(
    () => privateTaskAttachmentDir(root, path.join(root, "dist", "public", "data")),
    /inside the public dist tree/,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("database URL resolution parses only the DATABASE_URL entry and keeps credentials out of args", () => {
  const root = temp();
  write(root, ".env", "OTHER=value\nDATABASE_URL='postgresql://agent:p%40ss@db.example:5544/crm?sslmode=require'\n");
  const url = readDatabaseUrl(root, { databaseUrl: null });
  assert.equal(url, "postgresql://agent:p%40ss@db.example:5544/crm?sslmode=require");
  const env = postgresEnvironment(url);
  assert.equal(env.PGHOST, "db.example");
  assert.equal(env.PGPORT, "5544");
  assert.equal(env.PGDATABASE, "crm");
  assert.equal(env.PGUSER, "agent");
  assert.equal(env.PGPASSWORD, "p@ss");
  assert.equal(env.PGSSLMODE, "require");
  assert.equal(Object.hasOwn(env, "DATABASE_URL"), false);
  fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = temp();
  fs.mkdirSync(path.join(root, ".git"));
  fs.mkdirSync(path.join(root, "node_modules"));
  write(root, "package.json", '{"scripts":{"build":"fixture"}}\n');
  write(root, "client/src/task.css", "old payload");
  write(root, "dist/index.cjs", "backend");
  write(root, "dist/public/index.html", "old index");
  write(root, "dist/public/assets/previous.js", "old asset");
  const old = "old payload";
  const payload = "new task css";
  const file = {
    path: "client/src/task.css", expectedSha256: sha(old), sha256: sha(payload),
    gitBlob: "a".repeat(40),
  };
  const manifest = { base: BASE, files: [file], preservedGuards: [] };
  const payloads = new Map([[file.path, Buffer.from(payload)]]);
  const gitInfo = () => ({ gitDir: path.join(root, ".git") });
  const build = async (stage) => {
    const dist = path.join(stage, "dist");
    write(stage, "dist/index.cjs", "built backend");
    write(stage, "dist/public/index.html", '<script type="module" src="/assets/new-entry.js"></script>');
    write(stage, "dist/public/assets/new-entry.js", "built asset");
    write(stage, "dist/public/assets/new/nested/chunk.js", "nested asset");
  };
  const options = { root, release: "c".repeat(40), apply: true, healthUrl: "http://127.0.0.1:5000/" };
  return { root, options, manifest, payloads, gitInfo, build };
}

test("successful selective apply swaps dist, preserves old assets, restarts, and releases lock", async () => {
  const f = fixture();
  let restartCount = 0;
  let healthCount = 0;
  const result = await deploy(f.options, {
    manifest: f.manifest, payloads: f.payloads, gitInfo: f.gitInfo, build: f.build,
    pm2Info: { port: 5000, dataRoot: null }, databaseUrl: "postgres://fixture@localhost/db",
    backupDatabase: async () => createFixtureBackup(f.root),
    status: () => "200",
    restart: () => { restartCount += 1; },
    health: () => { healthCount += 1; },
  });
  assert.equal(result.applied, true);
  assert.equal(fs.readFileSync(path.join(f.root, "client/src/task.css"), "utf8"), "new task css");
  assert.equal(fs.readFileSync(path.join(f.root, "dist/public/assets/previous.js"), "utf8"), "old asset");
  assert.equal(fs.readFileSync(path.join(f.root, "dist/public/assets/new-entry.js"), "utf8"), "built asset");
  assert.equal(fs.readFileSync(path.join(f.root, "dist/index.cjs"), "utf8"), "built backend");
  assert.equal(fs.statSync(path.join(f.root, "dist/public/assets/new")).mode & 0o777, 0o755);
  assert.equal(fs.statSync(path.join(f.root, "dist/public/assets/new/nested")).mode & 0o777, 0o755);
  assert.equal(fs.existsSync(result.workDir), true, "private workspace is retained after a successful apply");
  assert.equal(fs.readFileSync(path.join(result.workDir, "source/dist/index.cjs"), "utf8"), "backend", "workspace retains old dist for rollback");
  assert.equal((fs.statSync(result.databaseBackup).mode & 0o777), 0o600);
  assert.equal(restartCount, 1);
  assert.equal(healthCount, 1);
  assert.equal(fs.existsSync(path.join(f.root, ".git/today-tasks-deploy.lock")), false);
  fs.rmSync(result.workDir, { recursive: true, force: true });
  fs.rmSync(f.root, { recursive: true, force: true });
});

test("health failure restores only owned sources and dist, then restarts old service", async () => {
  const f = fixture();
  const beforeDistInode = fs.statSync(path.join(f.root, "dist")).ino;
  let restartCount = 0;
  let failure;
  try { await deploy(f.options, {
    manifest: f.manifest, payloads: f.payloads, gitInfo: f.gitInfo, build: f.build,
    pm2Info: { port: 5000, dataRoot: null }, databaseUrl: "postgres://fixture@localhost/db",
    backupDatabase: async () => createFixtureBackup(f.root),
    status: () => "200", restart: () => { restartCount += 1; },
    health: () => { throw new Error("injected health failure"); },
  }); } catch (error) { failure = error; }
  assert.match(failure.message, /injected health failure/);
  assert.equal(fs.existsSync(failure.workDir), true, "private workspace is retained after apply failure");
  assert.equal(fs.statSync(path.join(f.root, "private-db-backup.dump")).mode & 0o777, 0o600, "DB backup survives rollback");
  assert.equal(fs.readFileSync(path.join(f.root, "client/src/task.css"), "utf8"), "old payload");
  assert.equal(fs.readFileSync(path.join(f.root, "dist/index.cjs"), "utf8"), "backend");
  assert.equal(fs.statSync(path.join(f.root, "dist")).ino, beforeDistInode);
  assert.equal(restartCount, 2, "restart new app and restore old app");
  fs.rmSync(failure.workDir, { recursive: true, force: true });
  fs.rmSync(f.root, { recursive: true, force: true });
});

test("partially completed dist exchange is detected and restored in failure order", async () => {
  const f = fixture();
  const order = [];
  let exchangeCalls = 0;
  const exchange = (first, second) => {
    exchangeCalls += 1;
    const tempPath = `${first}.fixture-swap`;
    fs.renameSync(first, tempPath);
    fs.renameSync(second, first);
    fs.renameSync(tempPath, second);
    if (exchangeCalls === 1) throw new Error("injected post-exchange failure");
  };
  let failure;
  try { await deploy(f.options, {
    manifest: f.manifest, payloads: f.payloads, gitInfo: f.gitInfo, build: f.build,
    pm2Info: { port: 5000, dataRoot: null }, databaseUrl: "postgres://fixture@localhost/db",
    backupDatabase: async () => createFixtureBackup(f.root),
    status: () => "200", exchange,
    restart: () => { order.push("restart"); },
  }); } catch (error) { failure = error; }
  assert.match(failure.message, /injected post-exchange failure/);
  assert.equal(fs.existsSync(failure.workDir), true);
  assert.deepEqual(order, ["restart"], "old backend is restarted after restoring source and dist");
  assert.equal(exchangeCalls, 2, "exchange rollback follows the partially successful exchange");
  assert.equal(fs.readFileSync(path.join(f.root, "client/src/task.css"), "utf8"), "old payload");
  assert.equal(fs.readFileSync(path.join(f.root, "dist/index.cjs"), "utf8"), "backend");
  fs.rmSync(failure.workDir, { recursive: true, force: true });
  fs.rmSync(f.root, { recursive: true, force: true });
});

test("prepare build detects concurrent source edits and leaves them untouched", async () => {
  const f = fixture();
  const concurrent = "external edit";
  await assert.rejects(deploy({ ...f.options, apply: false }, {
    manifest: f.manifest, payloads: f.payloads, gitInfo: f.gitInfo,
    build: async (stage) => {
      await f.build(stage);
      fs.writeFileSync(path.join(f.root, "client/src/task.css"), concurrent);
    },
  }), /Concurrent change .*during staged build/);
  assert.equal(fs.readFileSync(path.join(f.root, "client/src/task.css"), "utf8"), concurrent);
  assert.equal(fs.readFileSync(path.join(f.root, "dist/index.cjs"), "utf8"), "backend");
  fs.rmSync(f.root, { recursive: true, force: true });
});

test("prepare copies nested source data but excludes root runtime data", async () => {
  const f = fixture();
  write(f.root, "client/src/data/cla-template.ts", "export const template = {};");
  write(f.root, "data/private.txt", "runtime data");
  await deploy({ ...f.options, apply: false }, {
    manifest: f.manifest, payloads: f.payloads, gitInfo: f.gitInfo,
    build: async (stage) => {
      assert.equal(fs.readFileSync(path.join(stage, "client/src/data/cla-template.ts"), "utf8"), "export const template = {};");
      assert.equal(fs.existsSync(path.join(stage, "data")), false);
      await f.build(stage);
    },
  });
  fs.rmSync(f.root, { recursive: true, force: true });
});

test("source overlay final inventory gate preserves edits to untouched and already-written sources", async (t) => {
  for (const kind of ["untouched", "payload"]) {
    await t.test(kind, async () => {
      const f = fixture();
      const target = kind === "payload" ? "client/src/task.css" : "client/src/untouched.ts";
      if (kind === "untouched") write(f.root, target, "original untouched");
      let failure;
      try {
        await deploy(f.options, {
          manifest: f.manifest, payloads: f.payloads, gitInfo: f.gitInfo, build: f.build,
          pm2Info: { port: 5000, dataRoot: null }, databaseUrl: "postgres://fixture@localhost/db",
          backupDatabase: async () => createFixtureBackup(f.root), status: () => "200",
          restart: () => {}, health: () => {},
          afterSourceWrite: () => { write(f.root, target, "external edit during overlay"); },
        });
      } catch (error) { failure = error; }
      assert.match(failure.message, /after source overlay before dist cutover/);
      assert.equal(fs.readFileSync(path.join(f.root, target), "utf8"), "external edit during overlay");
      assert.equal(fs.readFileSync(path.join(f.root, "dist/index.cjs"), "utf8"), "backend");
      fs.rmSync(failure.workDir, { recursive: true, force: true });
      fs.rmSync(f.root, { recursive: true, force: true });
    });
  }
});