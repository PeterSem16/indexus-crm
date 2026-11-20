"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const { main, BASE, TARGET, TREE, FILES, buildEnvironment, validateScope, assertMount,
  regular, sha } = require("./ai-maintenance-stage.cjs");

test("production release is an exact 18-file child of the operator-confirmed baseline", () => {
  const git = args => cp.execFileSync("git", args, { encoding: "utf8" }).trim();
  validateScope(git(["rev-parse", TARGET + "^"]), git(["rev-parse", TARGET + "^{tree}"]),
    git(["diff", "--name-only", BASE, TARGET]).split("\n"));
  assert.equal(FILES.length, 18);
  for (const [parent, tree, files] of [
    ["0".repeat(40), TREE, FILES], [BASE, "0".repeat(40), FILES],
    [BASE, TREE, FILES.slice(1)], [BASE, TREE, [...FILES, "server/routes.ts"]],
    [BASE, TREE, [...FILES, FILES[0]]],
  ]) assert.throws(() => validateScope(parent, tree, files), /scope_changed/);
});

test("no deployment, migration, test-inference or implicit preparation command exists", () => {
  for (const args of [[], ["--apply"], ["--deploy"], ["--prepare", "--restart"], ["--check"]])
    assert.throws(() => main(args), /usage_prepare_only/);
  const body = fs.readFileSync(require.resolve("./ai-maintenance-stage.cjs"), "utf8");
  assert(!/require\(["'](?:pg|pm2|openai)["']\)/.test(body));
  assert(!/run\(["'](?:pm2|systemctl|pg_dump|psql|npm|curl|wget)["']/.test(body));
  assert(!/git\(\[["'](?:reset|checkout|switch|merge|clean|fetch|pull)["']/.test(body));
});

test("build environment excludes credentials, inherited preloads and activation flags", () => {
  assert.deepEqual(buildEnvironment({
    PATH: "/usr/bin", HOME: "/root", LANG: "C", TZ: "UTC",
    DATABASE_URL: "forbidden", PGHOST: "forbidden", OPENAI_API_KEY: "forbidden",
    NODE_OPTIONS: "--require forbidden", NODE_PATH: "/forbidden",
    INDEXUS_AI_ROUTER_MODE: "routed", INDEXUS_AI_JOBS_ALLOW: "1", REPL_ID: "forbidden",
  }), { NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=3072",
    PATH: "/usr/bin", HOME: "/root", LANG: "C", TZ: "UTC" });
});

test("storage gate accepts only the designated data mount and physical device", () => {
  const target = "/var/www/indexus-crm/data";
  const canonical = x => x === "/dev/disk/by-label/data" ? "/dev/sdb1" : x;
  assert.doesNotThrow(() => assertMount([{ target, source: "/dev/sdb1" }], canonical));
  assert.doesNotThrow(() => assertMount([{ target, source: "/dev/disk/by-label/data" }], canonical));
  for (const mounts of [[], [{ target: "/", source: "/dev/sdb1" }],
    [{ target, source: "/dev/sda1" }], [{ target, source: "/dev/sdb1" }, { target, source: "/dev/sdb1" }]])
    assert.throws(() => assertMount(mounts, canonical), /approved_data_volume_required/);
});

test("source reads reject traversal, symlinks, directories and unreadable optional paths", () => {
  const parent = path.resolve("generated-artifacts/ai-maintenance-operator-tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "fixture-"));
  try {
    fs.writeFileSync(path.join(root, "source"), "verified\n");
    fs.mkdirSync(path.join(root, "directory"));
    fs.symlinkSync("source", path.join(root, "alias"));
    assert.equal(regular(root, "source").toString(), "verified\n");
    assert.equal(regular(root, "missing", true), null);
    assert.throws(() => regular(root, "missing"), /ENOENT/);
    assert.throws(() => regular(root, "directory", true), /source_not_regular/);
    assert.throws(() => regular(root, "alias", true), /source_symlink/);
    for (const p of ["../source", "/source", "directory/../source", "x\\source", ""])
      assert.throws(() => regular(root, p, true), /unsafe_path/);
  } finally { fs.rmSync(root, { recursive: true }); }
});

test("actual native CommonJS stdin wrapper verifies bytes before invoking the explicit entrypoint", () => {
  const source = fs.readFileSync(require.resolve("./ai-maintenance-stage.cjs"), "utf8");
  const wrapper = `
const fs=require("node:fs"),crypto=require("node:crypto"),Module=require("node:module");
const source=fs.readFileSync(0,"utf8");
if(crypto.createHash("sha256").update(source).digest("hex")!==process.argv[1])
  throw Error("operator_source_hash_mismatch");
const mod=new Module("verified-ai-maintenance-stage.cjs",module);
mod.filename="verified-ai-maintenance-stage.cjs";mod.paths=module.paths;
mod._compile(source,mod.filename);
try{mod.exports.main(["--unsupported"]);process.exitCode=2;}
catch(e){if(e.safeCode!=="usage_prepare_only")throw e;console.log("native_wrapper_guard_passed");}
`;
  const result = cp.spawnSync(process.execPath, ["--input-type=commonjs", "-e", wrapper, sha(source)],
    { input: source, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /native_wrapper_guard_passed/);
  const rejected = cp.spawnSync(process.execPath, ["--input-type=commonjs", "-e", wrapper, "0".repeat(64)],
    { input: source, encoding: "utf8" });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /operator_source_hash_mismatch/);
});
