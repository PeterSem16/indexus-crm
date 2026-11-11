const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const crypto = require("node:crypto"), { spawnSync } = require("node:child_process");
const helper = require("./prepare-ai-production.cjs");
const blob = bytes => crypto.createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
test("release scope includes all 64 reviewed files and no runtime or secret paths", () => {
  assert.equal(helper.ALLOWED.size, 64);
  assert(![...helper.ALLOWED].some(p => /^(data|uploads|dist|\.env)(\/|$)/.test(p)));
  assert.match(helper.TARGET, /^[a-f0-9]{40}$/); assert.match(helper.TREE, /^[a-f0-9]{40}$/);
});
test("Git parsing preserves NUL-delimited paths and rejects invalid objects", () => {
  assert.equal(helper.gitEntries(`100644 blob ${"a".repeat(40)}\tpath with spaces.ts\0`)[0].name, "path with spaces.ts");
  for (const value of ["bad", `160000 commit ${"a".repeat(40)}\tmodule\0`,
    `100644 blob ${"a".repeat(40)}\t../outside\0`]) assert.throws(() => helper.gitEntries(value));
});
test("source checks work above one MiB and distinguish a new path from a collision", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-prepare-"));
  try {
    const bytes = Buffer.alloc(3 * 1024 * 1024, "x"), file = path.join(root, "routes.ts");
    fs.writeFileSync(file, bytes);
    const entries = [{ mode: "100644", sha: blob(bytes), name: "routes.ts" }];
    helper.verifyFiles(root, entries, ["new.ts"]);
    fs.writeFileSync(path.join(root, "new.ts"), "collision");
    assert.throws(() => helper.verifyFiles(root, entries, ["new.ts"]), /UNTRACKED_SOURCE_COLLISION/);
    fs.appendFileSync(file, "changed");
    assert.throws(() => helper.verifyFiles(root, entries), /SOURCE_BYTES_CHANGED/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("source symlinks are hashed as links, not followed to their contents", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-prepare-"));
  try {
    fs.symlinkSync("/nonexistent/private/file", path.join(root, "link"));
    helper.verifyFiles(root, [{ mode: "120000", sha: blob(Buffer.from("/nonexistent/private/file")), name: "link" }]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("regular sources cannot escape through a parent symlink", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-prepare-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "ai-outside-"));
  try {
    fs.writeFileSync(path.join(outside, "source"), "outside");
    fs.symlinkSync(outside, path.join(root, "parent"));
    assert.throws(() => helper.verifyFiles(root, [{ mode: "100644", sha: blob(Buffer.from("outside")), name: "parent/source" }]), /UNSAFE_SOURCE/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }); }
});
test("DB credentials are scoped to child environment and read-only options win", () => {
  const result = helper.databaseEnv('OTHER=value\nDATABASE_URL="postgresql://user:hidden@localhost:5433/example?sslmode=require&options=-c%20default_transaction_read_only%3Doff"\n');
  assert.equal(result.PGHOST, "localhost"); assert.equal(result.PGPORT, "5433");
  assert.equal(result.PGPASSWORD, "hidden"); assert.equal(result.PGSSLMODE, "require");
  assert(result.PGOPTIONS.endsWith("-c default_transaction_read_only=on"));
  assert.equal(result.PGPASSFILE, "/dev/null");
});
test("ambiguous DB settings and unknown options are rejected without credential errors", () => {
  assert.throws(() => helper.databaseEnv(""), /DATABASE_CONFIGURATION_MISSING/);
  assert.throws(() => helper.databaseEnv("DATABASE_URL=postgresql://u:p@localhost/db", { DATABASE_URL: "different" }), /LIVE_DATABASE_CONFIGURATION_DIFFERS/);
  assert.throws(() => helper.databaseEnv("DATABASE_URL=postgresql://u:p@localhost/db?unknown=sensitive"), /UNSUPPORTED_DATABASE_URL_OPTION/);
});
test("only the three permitted runtime settings are selected; Gateway tokens are excluded", () => {
  const result = helper.selectedEnvironment("DATABASE_URL=fixture\0PORT=5000\0INDEXUS_AI_GATEWAY_TOKEN=fixture-secret\0INDEXUS_AI_GATEWAY_ENABLED=false\0");
  assert.deepEqual(Object.keys(result).sort(), ["DATABASE_URL", "INDEXUS_AI_GATEWAY_ENABLED", "PORT"]);
  assert(!JSON.stringify(result).includes("fixture-secret"));
});
test("no operation other than prepare is accepted, and the real CLI refuses this host", () => {
  assert.throws(() => helper.main(["--apply"]), /ONLY_PREPARE_IS_SUPPORTED/);
  const result = spawnSync(process.execPath, [path.join(__dirname, "prepare-ai-production.cjs"), "--prepare"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AI_PREPARE_REFUSED_NO_OPERATION/);
});
test("the test preload blocks pg Pool and Client connections and queries", () => {
  const context = { Pool: class {}, Client: class {} };
  require("node:vm").runInNewContext(helper.testGuardSource(), { require: Object.assign(() => context, { resolve: () => "pg" }), process: { cwd: () => "." } });
  for (const Class of [context.Pool, context.Client]) for (const method of ["query", "connect"])
    assert.throws(() => new Class()[method](), /PRODUCTION_DATABASE_ACCESS_BLOCKED_IN_TEST/);
});
test("all built chunks are fingerprinted and artifact symlinks are rejected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-artifacts-"));
  try {
    fs.mkdirSync(path.join(root, "public/assets"), { recursive: true });
    fs.writeFileSync(path.join(root, "index.cjs"), "backend");
    fs.writeFileSync(path.join(root, "public/assets/lazy.js"), "chunk");
    const files = helper.artifactManifest(root);
    assert.deepEqual(files.map(f => f.path), ["index.cjs", "public/assets/lazy.js"]);
    assert(files.every(f => /^[0-9a-f]{64}$/.test(f.sha256)));
    fs.symlinkSync("lazy.js", path.join(root, "public/assets/link.js"));
    assert.throws(() => helper.artifactManifest(root), /UNSAFE_BUILD_ARTIFACT/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
