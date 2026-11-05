const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const cp = require("node:child_process");
const vm = require("node:vm");
const crypto = require("node:crypto");
const release = require("./cleanup-approved-omni-backups.cjs");
const filename = "script/operator/cleanup-approved-omni-backups.cjs";
const original = fs.readFileSync(filename, "utf8");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
function fixture(mode = "ready") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "approved-backup-cleanup-test-"));
  const app = root + "/app", data = app + "/data", proc = root + "/proc";
  const store = data + "/.omni-accounts-20261105T150000Z-abc123";
  const oldBackend = sha("old-backend"), oldIndex = sha("old-index");
  const write = (name, content) => {
    fs.mkdirSync(path.dirname(name), { recursive: true });
    fs.writeFileSync(name, content);
  };
  write(app + "/dist/index.cjs", "new-backend");
  write(app + "/dist/public/index.html", "new-index");
  write(store + "/release.txt", ["1f24432815b6c6f6100ea48941750b0fa8636483",
    release.TARGET, "676516", oldBackend, oldIndex].join("\n") + "\n");
  for (const [name, bytes] of Object.entries({
    "backup/index.cjs": "old-backend", "backup/index.html": "old-index",
    "backup/dist.tar": "runtime", "backup/source.tar": "source", "backup/database.dump": "PGDMP",
    "build/dist/index.cjs": "new-backend", "build/dist/public/index.html": "new-index",
  })) write(store + "/" + name, bytes);
  fs.chmodSync(store, 0o700);
  for (const name of release.APPROVED) write(data + "/" + name + "/old.txt", "retired");
  for (const name of ["postgresql", "call-recordings", "agreements", ".indexus-operator-backups",
    ".automation-backup-keep", ".complete-replit-20261029T111611Z-t1bfCQ"])
    write(data + "/" + name + "/keep.txt", "do-not-remove");
  write(root + "/outside/keep.txt", "do-not-follow");
  fs.symlinkSync(root + "/outside", data + "/" + release.APPROVED[0] + "/symlink");
  write(proc + "/900001/cmdline", "node " + app + "/dist/index.cjs");
  write(proc + "/900001/maps", "");
  fs.mkdirSync(proc + "/900001/fd");
  fs.symlinkSync(app, proc + "/900001/cwd");
  fs.symlinkSync("/", proc + "/900001/root");
  fs.symlinkSync("/usr/bin/node", proc + "/900001/exe");
  write(proc + "/self/mountinfo", "1 0 8:1 / " + data + " rw - ext4 /dev/sdb1 rw\n");
  if (mode === "bind") fs.appendFileSync(proc + "/self/mountinfo",
    "2 1 8:1 /" + release.APPROVED[0] + "/build /tmp/other-view rw - ext4 /dev/sdb1 rw\n");
  if (mode === "nested-mount") fs.appendFileSync(proc + "/self/mountinfo",
    "3 1 8:9 / " + data + "/" + release.APPROVED[0] + "/nested rw - ext4 /dev/other rw\n");
  if (mode === "cwd") {
    fs.unlinkSync(proc + "/900001/root");
    fs.symlinkSync(data + "/" + release.APPROVED[0], proc + "/900001/root");
  }
  if (mode === "fd") fs.symlinkSync(data + "/" + release.APPROVED[0] + "/old.txt", proc + "/900001/fd/4");
  if (mode === "mapped") write(proc + "/900001/maps",
    "123-456 r--p 00000000 08:01 7 " + data + "/" + release.APPROVED[0] + "/old.txt\n");
  if (mode === "command") fs.appendFileSync(proc + "/900001/cmdline", "\0" + data + "/" + release.APPROVED[0] + "/worker.js");
  if (mode === "missing-dump") fs.unlinkSync(store + "/backup/database.dump");
  if (mode === "bad-runtime") write(store + "/build/dist/index.cjs", "wrong-build");
  if (mode === "symlink") {
    fs.rmSync(data + "/" + release.APPROVED[0], { recursive: true });
    fs.symlinkSync(root + "/outside", data + "/" + release.APPROVED[0]);
  }
  const logs = [], removed = [];
  let rmCount = 0, healthChecks = 0;
  const fileSystem = { ...fs,
    lstatSync: name => {
      const stat = fs.lstatSync(name);
      if (mode === "inode" && name === data + "/" + release.APPROVED[0] &&
          fs.readdirSync(data).some(entry => entry.startsWith(".approved-backup-cleanup-")))
        return Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, { ino: stat.ino + 1 });
      return name === store ? Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, { uid: 0 }) : stat;
    },
    readFileSync: (name, ...args) => {
      const result = fs.readFileSync(name, ...args);
      const holding = mode === "after-move" && name === proc + "/self/mountinfo" &&
        fs.readdirSync(data).find(entry => entry.startsWith(".approved-backup-cleanup-"));
      return holding ? result + "4 1 8:1 /" + holding + "/" + release.APPROVED[0] +
        "/build /tmp/late-view rw - ext4 /dev/sdb1 rw\n" : result;
    },
    statSync: name => {
      const stat = fs.statSync(name);
      return name === proc + "/900001" ? Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, { uid: 1001 }) : stat;
    },
    readlinkSync: name => {
      if (mode === "permission" && name === proc + "/900001/exe")
        throw Object.assign(Error("denied"), { code: "EACCES" });
      return fs.readlinkSync(name);
    },
  };
  const child = { execFileSync: (bin, args) => {
    if (bin === "git") return args.includes("rev-parse") ? (mode === "head" ? "wrong-head" : release.TARGET) : "";
    if (bin === "findmnt") return args.includes("FSROOT") ? "/" : mode === "device" ? "/dev/other" : "/dev/sdb1";
    if (bin === "curl") { healthChecks++; return mode === "health" || (mode === "late-health" && healthChecks > 2) ? "503" : args.at(-1).endsWith("mailbox-groups") ? "401" : "200"; }
    if (bin === "pg_restore") {
      if (mode === "invalid-dump") throw Error("private-provider-detail");
      return null; // stdout is intentionally ignored in the real command.
    }
    if (bin === "rm") {
      const target = args.at(-1);
      assert.ok(target.startsWith(data + "/.approved-backup-cleanup-"));
      assert.ok(release.APPROVED.includes(path.basename(target)));
      assert.ok(args.includes("--one-file-system"));
      if (mode === "partial-rm" && rmCount++ === 1) throw Error("private-provider-detail");
      cp.execFileSync("rm", args);
      removed.push(path.basename(target));
      return "";
    }
    throw Error("Unexpected child command: " + bin);
  } };
  let source = original;
  for (const [name, value] of [["APP", app], ["PROC", proc], ["OLD_BACKEND", oldBackend], ["OLD_INDEX", oldIndex]]) {
    const pattern = new RegExp(`const ${name} = \"[^\"]+\";`);
    assert.ok(pattern.test(source));
    source = source.replace(pattern, () => `const ${name} = ${JSON.stringify(value)};`);
  }
  const mod = { exports: {} };
  vm.runInNewContext(source, { module: mod, exports: mod.exports, __filename: filename,
    console: { log: value => logs.push(value), error: value => logs.push(value) },
    require: name => name === "node:fs" ? fileSystem : name === "node:child_process" ? child : require(name) });
  return { root, app, data, store, logs, removed, api: mod.exports, healthChecks: () => healthChecks,
    close: () => fs.rmSync(root, { recursive: true, force: true }) };
}
test("the whitelist contains exactly 18 distinct approved names and excludes live/newer data", () => {
  assert.equal(release.APPROVED.length, 18);
  assert.equal(new Set(release.APPROVED).size, 18);
  assert.ok(release.APPROVED.every(name => !name.includes("/") && !name.includes("..")));
  assert.ok(release.APPROVED.every(name => !/20261029|202611|omni-accounts|postgresql|automation/.test(name)));
});
test("successful sandbox cleanup deletes only approved paths, preserves symlink targets and is repeatable", () => {
  const f = fixture();
  try {
    f.api.cleanup("900001");
    assert.equal(f.removed.length, 18);
    assert.ok(f.logs.includes("CISTENIE_OK=18"));
    assert.ok(f.healthChecks() >= 6);
    for (const name of ["postgresql", "call-recordings", "agreements", ".indexus-operator-backups",
      ".automation-backup-keep", ".complete-replit-20261029T111611Z-t1bfCQ"])
      assert.equal(fs.readFileSync(f.data + "/" + name + "/keep.txt", "utf8"), "do-not-remove");
    assert.equal(fs.readFileSync(f.root + "/outside/keep.txt", "utf8"), "do-not-follow");
    assert.ok(fs.existsSync(f.store + "/backup/database.dump"));
    f.api.cleanup("900001");
    assert.equal(f.removed.length, 18);
    assert.ok(f.logs.some(line => line.startsWith("CISTENIE_OK=0")));
  } finally { f.close(); }
});
for (const mode of ["head", "health", "device", "bind", "nested-mount", "cwd", "fd", "mapped",
  "command", "permission", "missing-dump", "invalid-dump", "bad-runtime", "symlink", "inode", "after-move", "late-health"]) {
  test(`refuses ${mode} before deleting any directory`, () => {
    const f = fixture(mode);
    try {
      assert.throws(() => f.api.cleanup("900001"));
      assert.equal(f.removed.length, 0);
      assert.ok(fs.existsSync(f.data + "/" + release.APPROVED[1] + "/old.txt"));
      assert.ok(!fs.readdirSync(f.data).some(name => name.startsWith(".approved-backup-cleanup-")),
        "pre-deletion failures restore renamed directories");
      assert.ok(!f.logs.join("\n").includes("private-provider-detail"));
    } finally { f.close(); }
  });
}
test("failure after partial deletion stops, preserves undeleted directories privately and keeps new backup", () => {
  const f = fixture("partial-rm");
  try {
    assert.throws(() => f.api.cleanup("900001"));
    assert.equal(f.removed.length, 1);
    const holding = fs.readdirSync(f.data).find(name => name.startsWith(".approved-backup-cleanup-"));
    assert.ok(holding);
    assert.ok(fs.existsSync(f.data + "/" + holding + "/" + release.APPROVED[1] + "/old.txt"));
    assert.ok(fs.existsSync(f.store + "/backup/database.dump"));
    assert.ok(!f.logs.includes("CISTENIE_OK=18"));
    assert.throws(() => f.api.cleanup("900001"), /nedokoncene sukromne cistenie/);
    assert.equal(f.removed.length, 1, "retry cannot silently ignore a partial cleanup");
  } finally { f.close(); }
});
test("real CLI cannot silently succeed or run destructive actions without explicit arguments", () => {
  const result = cp.spawnSync(process.execPath, [filename], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Pouzi sudo node/);
});
