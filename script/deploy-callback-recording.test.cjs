"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const cp = require("node:child_process");
const vm = require("node:vm");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "deploy-callback-recording.cjs"), "utf8");
const file = "client/src/pages/agent-workspace.tsx";

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "callback-deploy-test-"));
  const env = { ...process.env, DANGEROUSLY_ALLOW_GIT: "1" };
  const git = (...args) => cp.execFileSync("git", args, { cwd: root, env, encoding: "utf8" }).trim();
  try {
    git("init", "--quiet", "--initial-branch=main");
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "// large source fixture\n" + "x".repeat(2 * 1024 * 1024));
    git("add", "--", file);
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
      "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Fixture");
    const commit = git("rev-parse", "HEAD");
    function load(overrides = {}) {
      return vm.runInNewContext(
        source.replace('const root = "/var/www/indexus-crm";', `const root = ${JSON.stringify(root)};`)
          + "\n;({ filesStillMatch, extractSourceArchive });",
        {
          require(name) {
            if (name === "node:child_process") return { ...cp, ...overrides };
            return require(name);
          },
          module: {}, process: { argv: [] }, console,
          Buffer, setTimeout,
        },
      );
    }
    return run({ root, commit, load: overrides => load(overrides).filesStillMatch,
      loadArchive: overrides => load(overrides).extractSourceArchive, git });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("real Git source larger than 1 MiB passes unchanged-byte validation", () => fixture(({ commit, load }) => {
  assert.doesNotThrow(() => load()(commit, [file]));
}));

test("a changed large source still stops deployment", () => fixture(({ root, commit, load }) => {
  fs.appendFileSync(path.join(root, file), "\n// local change");
  assert.throws(() => load()(commit, [file]), /SOURCE_CHANGED/);
}));

test("a missing tracked source is not misclassified as an untracked conflict", () => fixture(({ root, commit, load }) => {
  fs.unlinkSync(path.join(root, file));
  assert.throws(() => load()(commit, [file]), /SOURCE_CHANGED/);
}));

test("a genuinely untracked file still stops deployment", () => fixture(({ root, commit, load }) => {
  const added = "client/src/pages/new-file.tsx";
  fs.writeFileSync(path.join(root, added), "// operator file");
  assert.throws(() => load()(commit, [added]), /UNTRACKED_CONFLICT/);
}));

test("a new release path absent from both old tree and working files is allowed", () => fixture(({ commit, load }) => {
  assert.doesNotThrow(() => load()(commit, ["client/src/pages/new-file.tsx"]));
}));

test("Git blob read failures remain explicit failures, never untracked conflicts", () => fixture(({ commit, load }) => {
  const check = load({
    execFileSync(bin, args, options) {
      if (bin === "git" && args[0] === "cat-file") throw new Error("isolated read failure");
      return cp.execFileSync(bin, args, options);
    },
  });
  assert.throws(() => check(commit, [file]), /GIT_BLOB_READ_FAILED/);
}));

test("Git tree lookup failures cannot be interpreted as missing files", () => fixture(({ commit, load }) => {
  const check = load({
    execFileSync(bin, args, options) {
      if (bin === "git" && args[0] === "ls-tree") throw new Error("isolated tree failure");
      return cp.execFileSync(bin, args, options);
    },
  });
  assert.throws(() => check(commit, [file]), /isolated tree failure/);
}));

test("real archive exceeding the former 250 MiB buffer limit is written and extracted without a Buffer", () =>
  fixture(({ root, loadArchive, git }) => {
    const asset = path.join(root, "large-archive-fixture.bin");
    fs.closeSync(fs.openSync(asset, "w"));
    const size = 251 * 1024 * 1024;
    fs.truncateSync(asset, size);
    git("add", "--", "large-archive-fixture.bin");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
      "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Large archive fixture");
    const commit = git("rev-parse", "HEAD");
    const backup = fs.mkdtempSync(path.join(os.tmpdir(), "callback-archive-backup-"));
    fs.chmodSync(backup, 0o700);
    const build = path.join(backup, "build");
    fs.mkdirSync(build);
    const calls = [];
    const extract = loadArchive({
      execFileSync(bin, args, options) {
        calls.push({ bin, args, options });
        assert.ok(!options?.input, "must not pass the archive through Node memory");
        return cp.execFileSync(bin, args, options);
      },
    });
    try {
      extract(commit, build, backup);
      assert.equal(fs.statSync(path.join(build, "large-archive-fixture.bin")).size, size);
      assert.equal(fs.readFileSync(path.join(build, file), "utf8"), fs.readFileSync(path.join(root, file), "utf8"));
      assert.ok(calls.find(call => call.bin === "git").args.some(arg => arg.startsWith("--output=")));
      assert.equal(fs.existsSync(path.join(backup, "source.tar")), false);
    } finally {
      fs.rmSync(backup, { recursive: true, force: true });
    }
  }));

test("archive creation failure stops before extraction", () => fixture(({ commit, root, loadArchive }) => {
  let extracted = false;
  const extract = loadArchive({
    execFileSync(bin) {
      if (bin === "git") throw new Error("isolated archive write failure");
      extracted = true;
    },
  });
  assert.throws(() => extract(commit, root, root), /isolated archive write failure/);
  assert.equal(extracted, false);
}));
