"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const vm = require("node:vm"), crypto = require("node:crypto");
const { spawnSync, execFileSync } = require("node:child_process");
const engine = require("./promote-email-reply-perspective.cjs");
const compose = require("./promote-email-compose-prompt.cjs");
const hash = s => crypto.createHash("sha256").update(s).digest("hex");
test("compose CLI rejects an unpinned command before reading production evidence", () => {
  const r = spawnSync(process.execPath, [__dirname + "/promote-email-compose-prompt.cjs", "--apply", "unreviewed"],
    { encoding: "utf8" });
  assert.equal(r.status, 1); assert.match(r.stderr, /explicit_pinned_apply_required/);
});
function evidence(t, change = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "compose-evidence-"));
  fs.chmodSync(root, 0o700); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = Object.fromEntries(Object.keys(engine.FILES).map(file => [file, "synthetic " + file]));
  const hashes = Object.fromEntries(Object.entries(files).map(([file, text]) => [file, hash(text)]));
  const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, { mode: 0o600 }); };
  for (const [file, text] of Object.entries(files)) write(root + "/build/" + file, text);
  write(root + "/previous-index.cjs", "pre-reply backend");
  write(root + "/build/dist/index.cjs", "verified reply backend");
  const receipt = { base: engine.BASE, target: compose.BASE, backend: hash("pre-reply backend"), files: hashes };
  if (change.badReceipt) receipt.target = "f".repeat(40);
  write(root + "/release.json", JSON.stringify(receipt));
  if (change.badSource) write(root + "/build/server/routes.ts", "unreviewed source");
  if (change.missingBuild) fs.unlinkSync(root + "/build/dist/index.cjs");
  if (change.archiveMode) {
    const git = args => execFileSync("git", ["-C", root, "-c", "core.hooksPath=/dev/null",
      "-c", "commit.gpgsign=false", "-c", "user.name=Synthetic",
      "-c", "user.email=synthetic@example.invalid", ...args], { stdio: "pipe" });
    git(["init", "-q"]); git(["add", "build/server"]); git(["commit", "-qm", "synthetic"]);
    git(["-c", "tar.umask=0002", "archive", "--format=tar", "--output=" + root + "/source.tar", "HEAD"]);
    execFileSync("tar", ["-xpf", root + "/source.tar", "-C", root]);
    assert.equal(fs.statSync(root + "/build/server/routes.ts").mode & 0o777, 0o664);
  }
  if (change.worldWritable) fs.chmodSync(root + "/build/server/routes.ts", 0o666);
  if (change.symlinkSource) {
    fs.renameSync(root + "/build/server/routes.ts", root + "/other-source.ts");
    fs.symlinkSync(root + "/other-source.ts", root + "/build/server/routes.ts");
  }
  const code = fs.readFileSync(__dirname + "/promote-email-compose-prompt.cjs", "utf8")
    .replace("03e956745252f86f73378e349bf686474fe334c760e3273319dfc454b38de871", hash("pre-reply backend"));
  const m = { exports: {} }, requireMock = name => name === "./promote-email-reply-perspective.cjs" ?
    { ...engine, FILES: hashes } : require(name);
  requireMock.main = {};
  vm.runInNewContext(code, { require: requireMock, module: m, process, console });
  const io = new Proxy(fs, { get(obj, key) {
    if (key === "lstatSync") return file => {
      const stat = fs.lstatSync(file);
      return { uid: 0, mode: file === root && change.insecureRoot ? 0o40777 : stat.mode,
        isDirectory: () => stat.isDirectory(), isFile: () => stat.isFile() };
    };
    return obj[key];
  } });
  return () => m.exports.resolveBaseline(root, io);
}
test("previous private release evidence resolves the deployed backend hash, not the old pre-reply hash", t => {
  assert.equal(evidence(t)(), hash("verified reply backend"));
});
test("native Git archive with root-style tar extraction accepts 0664 sources under private 0700 evidence", t => {
  assert.equal(evidence(t, { archiveMode: true })(), hash("verified reply backend"));
});
const failures = {
  badReceipt: "previous_release_receipt_identity_invalid",
  badSource: "previous_release_source_hash_invalid",
  insecureRoot: "previous_release_directory_invalid",
  missingBuild: "previous_release_evidence_unavailable",
  worldWritable: "previous_release_file_world_writable",
  symlinkSource: "previous_release_file_identity_invalid",
};
for (const [kind, expected] of Object.entries(failures)) {
  test("previous release evidence fails closed for " + kind, t => {
    assert.throws(evidence(t, { [kind]: true }), error => error.safeCode === expected);
  });
}
