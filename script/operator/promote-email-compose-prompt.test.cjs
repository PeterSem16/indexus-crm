"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const vm = require("node:vm"), crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
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
for (const kind of ["badReceipt", "badSource", "insecureRoot", "missingBuild"]) {
  test("previous release evidence fails closed for " + kind, t => {
    assert.throws(evidence(t, { [kind]: true }), error =>
      error.safeCode === (kind === "missingBuild" ?
        "previous_release_evidence_unavailable" : "previous_release_evidence_invalid"));
  });
}
