const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { prepareIsolatedRoot } = require("./launch.cjs");
const helper = "script/ai-gateway-b4-pilot.cjs";
const source = "server/original.ts";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "c1-launch-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bundle = path.join(dir, "bundle"), app = path.join(dir, "app");
  function write(base, file, value) {
    const full = path.join(base, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, value);
  }
  write(app, source, "original CRM source");
  fs.mkdirSync(path.join(app, "data"));
  fs.mkdirSync(path.join(app, "node_modules"));
  write(app, ".env", "SYNTHETIC_TEST_ONLY=1\n");
  write(bundle, helper, "module.exports = { testOnly: true };\n");
  const sources = { [source]: hash("original CRM source"),
    [helper]: hash(fs.readFileSync(path.join(bundle, helper))) };
  const files = { [helper]: sources[helper] };
  for (const [file, content] of Object.entries({
    "plan.json": "{}",
    "runtime-sources.json": JSON.stringify(sources),
    "script/ai-gateway-c1/run.ts": "// mocked entry, never executed",
  })) {
    write(bundle, file, content);
    files[file] = hash(content);
  }
  const saveManifest = () => write(bundle, "manifest.json", JSON.stringify({ phase: "C1", files }));
  saveManifest();
  return { bundle, app, files, sources, write, saveManifest };
}

test("isolated preparation succeeds with helper absent from live app; no AI or live writes", t => {
  const f = fixture(t);
  const root = prepareIsolatedRoot(f.bundle, f.app);
  assert.equal(fs.existsSync(path.join(f.app, helper)), false);
  assert.equal(require(path.join(root, helper)).testOnly, true);
  assert.equal(fs.readFileSync(path.join(root, source), "utf8"), "original CRM source");
  assert.equal(fs.readFileSync(path.join(f.app, source), "utf8"), "original CRM source");
  assert.equal(fs.readlinkSync(path.join(root, ".env")), path.join(f.app, ".env"));
  assert.equal(fs.statSync(root).mode & 0o777, 0o700);
});
test("changed live CRM source remains blocked, not replaced by a bundle copy", t => {
  const f = fixture(t);
  f.write(f.app, source, "drift");
  assert.throws(() => prepareIsolatedRoot(f.bundle, f.app), /C1_LIVE_SOURCE_DIFFERS_FROM_REFERENCE/);
  assert.deepEqual(fs.readdirSync(path.join(f.app, "data")), []);
});
test("tampered bundled helper remains blocked before preparation", t => {
  const f = fixture(t);
  f.write(f.bundle, helper, "tampered");
  assert.throws(() => prepareIsolatedRoot(f.bundle, f.app), /C1_BUNDLE_HASH_MISMATCH/);
});
test("helper must match both bundle manifest and runtime source pin", t => {
  const f = fixture(t);
  f.sources[helper] = hash("different reference");
  const content = JSON.stringify(f.sources);
  f.write(f.bundle, "runtime-sources.json", content);
  f.files["runtime-sources.json"] = hash(content);
  f.saveManifest();
  assert.throws(() => prepareIsolatedRoot(f.bundle, f.app), /C1_BUNDLE_HELPER_HASH_MISMATCH/);
});
test("missing original CRM source cannot use a bundled substitute", t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.app, source));
  f.write(f.bundle, source, "original CRM source");
  assert.throws(() => prepareIsolatedRoot(f.bundle, f.app), { code: "ENOENT" });
});
