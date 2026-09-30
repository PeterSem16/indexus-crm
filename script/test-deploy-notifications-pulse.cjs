"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  RELEASE,
  parseArgs,
  readManifest,
  trackedSnapshot,
  compareSnapshot,
  verifyHttp,
  healthPreflight,
  validateGit,
  deploy,
  fileHashIfPresent,
  runBuffer,
  probeAtomicExchange,
  pathFingerprint,
  restorePatchedMetadata,
  restoreOwnedChanges,
} = require("./deploy-notifications-pulse.cjs");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pulse-deploy-test-"));
}

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

test("prepare is the default and apply is opt-in", () => {
  assert.equal(parseArgs([]).apply, false);
  assert.equal(parseArgs(["--prepare"]).apply, false);
  assert.equal(parseArgs(["--apply", "--root", "/tmp/example"]).apply, true);
  assert.equal(parseArgs(["--health-url", "http://localhost:5100/"]).healthUrl, "http://localhost:5100/");
  assert.throws(() => parseArgs(["--health-url", "https://example.com/"]), /localhost\/loopback/);
  assert.throws(() => parseArgs(["--skip-checks"]), /Unknown option/);
});

test("embedded proof is complete, standalone, and pins the release patch hash", () => {
  const proof = readManifest();
  assert.equal(proof.expectedHashes["client/src/pages/agent-workspace.tsx"], "ed57fe80173941fe72d8cde0bc65ef09df608fcb1a8462f4ac737c9864c6d227");
  assert.equal(proof.postHashes["client/src/pages/agent-workspace.tsx"], "8e0aa282082aa6e9981576bbae29e853dc237a2e28c00fd9eacca2417feb5ced");
  assert.equal(proof.expectedHashes["client/src/lib/scheduled-queue-visible-groups.ts"], proof.postHashes["client/src/lib/scheduled-queue-visible-groups.ts"]);
  assert.equal(proof.expectedHashes["client/src/pages/email-client.tsx"], "0313be0dfe1a35002b03214a2a562e9636005029e80f5062b6e2268526b867b9");
  assert.equal(proof.postHashes["client/src/pages/email-client.tsx"], "b6134d1b8b5b15db844afb32b44fce87a436469be86d1bd86171f35fcca1b630");
  assert.equal(proof.expectedHashes["client/src/components/nexus/nexus-sidebar.tsx"], "9d314ee83f5005658f1d1e54b41e0627e69a348b4cb778e47c4d795bb5ef8281");
  assert.equal(proof.postHashes["client/src/components/nexus/nexus-sidebar.tsx"], "10f369e67ef6caf54edb8153f8ca5be0c8e30a4daf047182e568d54f066d0d73");
  assert.equal(proof.expectedHashes["client/src/components/nexus/nexus-signal-tasks.css"], null);
  assert.equal(proof.postHashes["client/src/components/nexus/nexus-signal-tasks.css"], "ed7504274f3a24be25bad66a64dd4fbfc2258d4217b9ca4c5ce35410a6e702ca");
  assert.equal(RELEASE.paths.length, 11);
  assert.equal(RELEASE.guardPaths.length, 12);
  assert.equal(RELEASE.patchSha256, "b24ff6430c4e6ac23d58919be97f759b79dc94ac5cccb2f8a6cbeeebfece13a4");
});

test("git validation fetches only the pinned commit and refuses head, tree, path, and patch mismatches", () => {
  const root = tempDir();
  const patchFile = path.join(root, "private", "release.patch");
  const calls = [];
  const outputs = {
    "rev-parse HEAD": RELEASE.base,
    [`show -s --format=%T ${RELEASE.commit}`]: RELEASE.tree,
    [`rev-parse ${RELEASE.commit}^`]: RELEASE.parent,
    [`diff --name-only ${RELEASE.patchBase} ${RELEASE.commit}`]: [...RELEASE.paths].sort().join("\n"),
  };
  const gitMock = (args, binary) => {
    const key = args.join(" ");
    calls.push(args);
    if (args[0] === "fetch") return "";
    if (args[0] === "diff" && binary) return Buffer.from("intentionally-not-the-release-patch");
    return outputs[key] || "";
  };
  assert.throws(() => validateGit(root, { patchFile }, {
    git: (args, binary) => args[0] === "rev-parse" && args[1] === "HEAD" ? "wrong-head" : gitMock(args, binary),
  }), /Unexpected live HEAD/);
  assert.equal(calls.length, 0);
  assert.throws(() => validateGit(root, { patchFile }, {
    git: (args, binary) => {
      if (args[0] === "show") return "wrong-tree";
      return gitMock(args, binary);
    },
  }), /release tree mismatch/);
  assert.deepEqual(calls.find((args) => args[0] === "fetch"), ["fetch", "--no-tags", "origin", RELEASE.commit]);
  assert.throws(() => validateGit(root, { patchFile }, {
    git: (args, binary) => {
      if (args[0] === "fetch") throw new Error("fetch denied");
      return gitMock(args, binary);
    },
  }), /fetch denied/);
  assert.throws(() => validateGit(root, { patchFile }, {
    git: (args, binary) => args[0] === "diff" && args[1] === "--name-only" ? "unexpected/source.ts" : gitMock(args, binary),
  }), /unexpected paths/);
  assert.throws(() => validateGit(root, { patchFile }, { git: gitMock }), /patch SHA-256 mismatch/);
  assert.deepEqual(
    calls.find((args) => args[0] === "diff" && args[1] === "--binary"),
    ["diff", "--binary", RELEASE.patchBase, RELEASE.commit, "--", ...RELEASE.paths],
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("combined release validation diffs the configured patch base across all 11 paths", () => {
  const root = tempDir();
  fs.mkdirSync(path.join(root, "private"));
  const patchFile = path.join(root, "private", "release.patch");
  const paths = [...new Set([
    ...RELEASE.paths,
    "client/src/pages/email-client.tsx",
    "client/src/components/nexus/nexus-sidebar.tsx",
    "client/src/components/nexus/nexus-signal-tasks.css",
  ])].sort();
  assert.equal(paths.length, 11);
  const patchBase = "cd242676635d64f263367c6b43d61f1c2c489c0d";
  const parent = "df54db18a0b6892c31f2838c882bfb050fa6d5c2";
  const patch = Buffer.from("combined reviewed patch bytes");
  const release = {
    ...RELEASE,
    commit: "combined-app-commit",
    parent,
    patchBase,
    tree: "a".repeat(40),
    paths,
    patchSha256: require("node:crypto").createHash("sha256").update(patch).digest("hex"),
  };
  const calls = [];
  const gitMock = (args, binary) => {
    calls.push({ args, binary });
    if (args[0] === "fetch") return "";
    if (args[0] === "rev-parse" && args[1] === "HEAD") return release.base;
    if (args[0] === "show") return release.tree;
    if (args[0] === "rev-parse" && args[1] === `${release.commit}^`) return parent;
    if (args[0] === "diff" && args[1] === "--name-only") return paths.join("\n");
    if (args[0] === "diff" && binary) return patch;
    throw new Error(`Unexpected git call: ${args.join(" ")}`);
  };

  validateGit(root, { patchFile, release }, { git: gitMock });
  assert.equal(fs.readFileSync(patchFile).toString(), patch.toString());
  assert.ok(calls.some(({ args }) => args[0] === "diff" && args[1] === "--name-only"
    && args[2] === patchBase && args[3] === release.commit));
  assert.ok(calls.some(({ args, binary }) => binary && args.join(" ") === [
    "diff", "--binary", patchBase, release.commit, "--", ...paths,
  ].join(" ")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("snapshot of a tiny git checkout tracks source but excludes secrets and customer data", () => {
  const root = tempDir();
  fs.writeFileSync(path.join(root, "source.js"), "tracked source");
  fs.mkdirSync(path.join(root, "client", "src", "data"), { recursive: true });
  fs.writeFileSync(path.join(root, "client", "src", "data", "cla-template.ts"), "export const template = 'source';");
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.writeFileSync(path.join(root, "data", "customers.csv"), "sensitive customer data");
  fs.writeFileSync(path.join(root, ".env"), "TOKEN=never-copy");
  fs.writeFileSync(path.join(root, "archive.tar.gz"), "customer archive");
  git(root, "init", "-q");
  git(root, "add", "source.js", "client/src/data/cla-template.ts");
  git(root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture");

  const snapshot = trackedSnapshot(root);
  assert.equal(snapshot.get("source.js")?.hash.length, 64);
  assert.equal(snapshot.get("client/src/data/cla-template.ts")?.hash.length, 64);
  assert.equal(snapshot.has(".env"), false);
  assert.equal(snapshot.has("data/customers.csv"), false);
  assert.equal(snapshot.has("archive.tar.gz"), false);
  assert.equal(snapshot.get("dist/index.cjs").hash, "missing");
  fs.writeFileSync(path.join(root, "source.js"), "concurrent edit");
  assert.throws(() => compareSnapshot(snapshot, trackedSnapshot(root), "in fixture"), /Concurrent or unexpected change/);
  fs.writeFileSync(path.join(root, "new-tracked.js"), "new tracked source");
  git(root, "add", "new-tracked.js");
  assert.throws(() => compareSnapshot(snapshot, trackedSnapshot(root), "after staging new path"), /file set changed/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("snapshot and guarded paths reject symlink ancestors", () => {
  const fixture = makeDeployFixture();
  const clientDir = path.join(fixture.root, "client");
  const moved = path.join(fixture.root, "client-real");
  fs.renameSync(clientDir, moved);
  fs.symlinkSync(moved, clientDir);
  assert.throws(() => trackedSnapshot(fixture.root), /Symlink path component refused/);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("root, public, and staging symlink paths fail closed", async (t) => {
  await t.test("root symlink", async () => {
    const fixture = makeDeployFixture();
    const alias = `${fixture.root}-alias`;
    fs.symlinkSync(fixture.root, alias, "dir");
    await assert.rejects(deploy({ root: alias, apply: false }, fixture.dependencies), /Symlink path component refused/);
    fs.rmSync(alias, { force: true });
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });
  await t.test("public symlink", async () => {
    const fixture = makeDeployFixture();
    const publicPath = path.join(fixture.root, "dist", "public");
    const moved = path.join(fixture.root, "dist", "public-real");
    fs.renameSync(publicPath, moved);
    fs.symlinkSync(moved, publicPath, "dir");
    await assert.rejects(deploy({ root: fixture.root, apply: false }, fixture.dependencies), /Symlink path component refused/);
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });
  await t.test("staging symlink", async () => {
    const fixture = makeDeployFixture();
    const external = tempDir();
    const deps = {
      ...fixture.dependencies,
      validateGit: (_root, { patchFile }) => {
        fs.mkdirSync(path.dirname(patchFile), { recursive: true });
        fs.writeFileSync(patchFile, "fixture patch");
        fs.symlinkSync(external, path.join(path.dirname(patchFile), "stage"), "dir");
      },
    };
    await assert.rejects(deploy({ root: fixture.root, apply: false }, deps), /Symlink path component refused/);
    assert.deepEqual(fs.readdirSync(external), []);
    fs.rmSync(fixture.root, { recursive: true, force: true });
    fs.rmSync(external, { recursive: true, force: true });
  });
});

test("an existing deployment lock refuses a second invocation without touching it", async () => {
  const fixture = makeDeployFixture();
  const lockPath = path.join(fixture.root, ".git", "notifications-pulse-deploy.lock");
  const owner = '{"pid":123,"owner":"fixture","invocation":"active"}\n';
  fs.writeFileSync(lockPath, owner, { mode: 0o600 });
  await assert.rejects(deploy({ root: fixture.root, apply: false }, fixture.dependencies), /Deployment lock exists/);
  assert.equal(fs.readFileSync(lockPath, "utf8"), owner);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("prepare probes atomic exchange and local health, and releases its own lock", async () => {
  const fixture = makeDeployFixture();
  const first = path.join(fixture.root, ".probe-a");
  const second = path.join(fixture.root, ".probe-b");
  fs.mkdirSync(first);
  fs.mkdirSync(second);
  assert.doesNotThrow(() => probeAtomicExchange(path.join(fixture.root, ".git"), first, second));
  fs.rmSync(first, { recursive: true, force: true });
  fs.rmSync(second, { recursive: true, force: true });
  let preflightCount = 0;
  const dependencies = { ...fixture.dependencies, healthPreflight: () => { preflightCount += 1; } };
  delete dependencies.exchange;
  await deploy({ root: fixture.root, apply: false, healthUrl: "fixture://" }, dependencies);
  assert.equal(preflightCount, 1);
  assert.equal(fs.existsSync(path.join(fixture.root, ".git", "notifications-pulse-deploy.lock")), false);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("text and binary subprocess capture have explicit bounded buffers", () => {
  assert.throws(() => runBuffer(process.execPath, ["-e", "process.stdout.write('x'.repeat(3 * 1024 * 1024))"], {
    maxBuffer: 2 * 1024 * 1024,
  }), /ENOBUFS/);
});

test("actual git apply permission reset is corrected before metadata gate and owned rollback", () => {
  const root = tempDir();
  const file = path.join(root, "source.js");
  const patchFile = path.join(root, "mode.patch");
  fs.writeFileSync(file, "before\n");
  git(root, "init", "-q");
  git(root, "add", "source.js");
  git(root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture");
  fs.chmodSync(file, 0o664);
  const original = fs.statSync(file);
  fs.writeFileSync(file, "after\n");
  const patch = spawnSync("git", ["diff", "--", "source.js"], { cwd: root, encoding: "utf8" });
  assert.equal(patch.status, 0, patch.stderr);
  fs.writeFileSync(patchFile, patch.stdout);
  fs.writeFileSync(file, "before\n");
  fs.chmodSync(file, 0o664);
  git(root, "apply", patchFile);
  assert.equal(fs.statSync(file).mode & 0o777, 0o644);

  const expectedPost = require("node:crypto").createHash("sha256").update("after\n").digest("hex");
  const patchSnapshot = new Map([["source.js", pathFingerprint(file)]]);
  const ownedSnapshot = new Map(patchSnapshot);
  restorePatchedMetadata(root, { "source.js": expectedPost }, {
    "source.js": { mode: original.mode & 0o7777, uid: original.uid, gid: original.gid },
  }, patchSnapshot, ownedSnapshot, ["source.js"]);
  assert.equal(fs.statSync(file).mode & 0o777, 0o664);
  assert.equal(fs.statSync(file).uid, original.uid);
  assert.equal(fs.statSync(file).gid, original.gid);
  assert.equal(ownedSnapshot.get("source.js").hash, expectedPost);
  assert.equal(ownedSnapshot.get("source.js").mode & 0o777, 0o664);
  const backupDir = path.join(root, "private-backup");
  fs.mkdirSync(path.join(backupDir, "source"), { recursive: true });
  fs.writeFileSync(path.join(backupDir, "source", "source.js"), "before\n", { mode: 0o600 });
  restoreOwnedChanges(root, backupDir, { "source.js": expectedPost }, {
    "source.js": { mode: original.mode & 0o7777, uid: original.uid, gid: original.gid },
  }, ownedSnapshot, ["source.js"]);
  assert.equal(fs.readFileSync(file, "utf8"), "before\n");
  assert.equal(fs.statSync(file).mode & 0o777, 0o664);
  fs.rmSync(root, { recursive: true, force: true });
});

test("local health preflight fails closed on an unhealthy server", () => {
  assert.throws(() => healthPreflight("http://localhost/", () => "503"), /preflight returned HTTP 503/);
});

test("post-cutover verification refuses a stale index and missing hashed assets", () => {
  const url = "http://localhost/";
  const expected = '<html><script type="module" src="/assets/new-entry.js"></script></html>';
  const stale = '<html><script type="module" src="/assets/old-entry.js"></script></html>';
  assert.throws(
    () => verifyHttp(url, expected, {
      status: (target) => target.endsWith("/assets/new-entry.js") ? "404" : "200",
      body: () => expected,
    }),
    /hashed entry asset returned HTTP 404/,
  );
  assert.throws(
    () => verifyHttp(url, expected, { status: () => "200", body: () => stale }),
    /does not serve the new frontend index/,
  );
});

function makeDeployFixture() {
  const root = tempDir();
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  fs.mkdirSync(path.join(root, "dist", "public", "assets"), { recursive: true });
  fs.writeFileSync(path.join(root, "dist", "index.cjs"), "backend-stays-byte-identical");
  fs.writeFileSync(path.join(root, "dist", "public", "index.html"), "old frontend");
  fs.writeFileSync(path.join(root, "dist", "public", "assets", "old.js"), "old lazy asset");
  fs.mkdirSync(path.join(root, "client"), { recursive: true });
  git(root, "init", "-q");

  const expectedHashes = {};
  const postHashes = {};
  for (const name of RELEASE.guardPaths) {
    const initial = RELEASE.preHashes[name] === null ? null : `original:${name}`;
    const target = RELEASE.paths.includes(name) ? `merged:${name}` : initial;
    if (initial !== null) {
      const file = path.join(root, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, initial);
      git(root, "add", name);
    }
    expectedHashes[name] = initial === null ? "missing" : require("node:crypto").createHash("sha256").update(initial).digest("hex");
    postHashes[name] = require("node:crypto").createHash("sha256").update(target).digest("hex");
  }
  git(root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture");
  const proof = { expectedHashes, postHashes };
  const writeMergedFiles = (directory) => {
    for (const name of RELEASE.paths) {
      const file = path.join(directory, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `merged:${name}`);
    }
  };
  const swap = (first, second) => {
    const temp = `${first}.fixture-swap`;
    fs.renameSync(first, temp);
    fs.renameSync(second, first);
    fs.renameSync(temp, second);
  };
  const dependencies = {
    proof,
    validateGit: (_root, { patchFile }) => {
      fs.mkdirSync(path.dirname(patchFile), { recursive: true });
      fs.writeFileSync(patchFile, "fixture patch", { mode: 0o600 });
    },
    applyStagePatch: (stage) => writeMergedFiles(stage),
    applyLivePatch: (live) => writeMergedFiles(live),
    build: (stage) => {
      const out = path.join(stage, "dist", "public");
      fs.mkdirSync(path.join(out, "assets"), { recursive: true });
      fs.writeFileSync(path.join(out, "index.html"), '<script type="module" src="/assets/new.js"></script>');
      fs.writeFileSync(path.join(out, "assets", "new.js"), "new entry");
    },
    healthPreflight: () => {},
    health: () => {},
    exchange: swap,
  };
  return { root, proof, dependencies, writeMergedFiles };
}

test("build failure leaves live source, frontend, backend, and git index unchanged", async () => {
  const fixture = makeDeployFixture();
  const source = path.join(fixture.root, RELEASE.paths[0]);
  const before = {
    source: fileHashIfPresent(source),
    frontend: fileHashIfPresent(path.join(fixture.root, "dist", "public", "index.html")),
    backend: fileHashIfPresent(path.join(fixture.root, "dist", "index.cjs")),
    index: fileHashIfPresent(path.join(fixture.root, ".git", "index")),
  };
  await assert.rejects(deploy({ root: fixture.root, apply: false }, {
    ...fixture.dependencies,
    build: () => { throw new Error("injected build failure"); },
  }), /injected build failure/);
  assert.deepEqual({
    source: fileHashIfPresent(source),
    frontend: fileHashIfPresent(path.join(fixture.root, "dist", "public", "index.html")),
    backend: fileHashIfPresent(path.join(fixture.root, "dist", "index.cjs")),
    index: fileHashIfPresent(path.join(fixture.root, ".git", "index")),
  }, before);
  assert.equal(fs.existsSync(path.join(fixture.root, ".git", "notifications-pulse-deploy.lock")), false);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("new served files inherit index.html read mode and ownership", async () => {
  const fixture = makeDeployFixture();
  const liveIndex = path.join(fixture.root, "dist", "public", "index.html");
  fs.chmodSync(liveIndex, 0o640);
  const indexStat = fs.statSync(liveIndex);
  const result = await deploy({ root: fixture.root, apply: false, healthUrl: "fixture://" }, fixture.dependencies);
  const builtAsset = path.join(result.stage, "dist", "public", "assets", "new.js");
  const assetStat = fs.statSync(builtAsset);
  assert.equal(assetStat.mode & 0o777, 0o640);
  assert.equal(assetStat.uid, indexStat.uid);
  assert.equal(assetStat.gid, indexStat.gid);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("health, cutover, and concurrent public replacement fail safely", async (t) => {
  for (const mode of ["health", "exchange", "external-public"]) {
    await t.test(mode, async () => {
      const fixture = makeDeployFixture();
      const sourcePath = path.join(fixture.root, RELEASE.paths[0]);
      const sourceBefore = fileHashIfPresent(sourcePath);
      const frontendBefore = fileHashIfPresent(path.join(fixture.root, "dist", "public", "index.html"));
      const backendBefore = fileHashIfPresent(path.join(fixture.root, "dist", "index.cjs"));
      const deps = { ...fixture.dependencies };
      if (mode === "health") deps.health = () => { throw new Error("injected health failure"); };
      else if (mode === "exchange") deps.exchange = () => { throw new Error("injected exchange failure"); };
      else deps.health = () => {
        const publicPath = path.join(fixture.root, "dist", "public");
        fs.renameSync(publicPath, path.join(fixture.root, "dist", "public-from-deployment"));
        fs.mkdirSync(publicPath);
        fs.writeFileSync(path.join(publicPath, "index.html"), "external replacement");
        throw new Error("injected health failure after external replacement");
      };
      await assert.rejects(deploy({ root: fixture.root, apply: true, healthUrl: "fixture://" }, deps), /injected (health|exchange) failure/);
      assert.equal(fileHashIfPresent(sourcePath), sourceBefore);
      if (mode === "external-public") {
        assert.equal(fs.readFileSync(path.join(fixture.root, "dist", "public", "index.html"), "utf8"), "external replacement");
        assert.equal(fs.existsSync(path.join(fixture.root, "dist", "public-from-deployment", "assets", "new.js")), true);
      } else {
        assert.equal(fileHashIfPresent(path.join(fixture.root, "dist", "public", "index.html")), frontendBefore);
      }
      assert.equal(fileHashIfPresent(path.join(fixture.root, "dist", "index.cjs")), backendBefore);
      fs.rmSync(fixture.root, { recursive: true, force: true });
    });
  }
});

test("public replacement before cutover is detected before source patching", async () => {
  const fixture = makeDeployFixture();
  const source = path.join(fixture.root, RELEASE.paths[0]);
  const sourceBefore = fileHashIfPresent(source);
  let preflightCalls = 0;
  await assert.rejects(deploy({ root: fixture.root, apply: true, healthUrl: "fixture://" }, {
    ...fixture.dependencies,
    healthPreflight: () => {
      preflightCalls += 1;
      if (preflightCalls === 2) {
        const publicPath = path.join(fixture.root, "dist", "public");
        fs.renameSync(publicPath, path.join(fixture.root, "dist", "public-before-cutover"));
        fs.mkdirSync(publicPath);
        fs.writeFileSync(path.join(publicPath, "index.html"), "external before cutover");
      }
    },
  }), /before targeted source patch/);
  assert.equal(fileHashIfPresent(source), sourceBefore);
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist", "public", "index.html"), "utf8"), "external before cutover");
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("concurrent source edits are detected and never overwritten; successful replay is refused", async (t) => {
  await t.test("concurrent edit", async () => {
    const fixture = makeDeployFixture();
    const sourcePath = path.join(fixture.root, RELEASE.paths[0]);
    const concurrent = "operator-hotfix-arrived-during-build";
    await assert.rejects(deploy({ root: fixture.root, apply: true, healthUrl: "fixture://" }, {
      ...fixture.dependencies,
      build: (stage) => {
        fixture.dependencies.build(stage);
        fs.writeFileSync(sourcePath, concurrent);
      },
    }), /unexpected change .*during staged build/);
    assert.equal(fs.readFileSync(sourcePath, "utf8"), concurrent);
    assert.equal(fs.readFileSync(path.join(fixture.root, "dist", "public", "index.html"), "utf8"), "old frontend");
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  await t.test("edit after final pre-patch hash gate", async () => {
    const fixture = makeDeployFixture();
    const sourcePath = path.join(fixture.root, RELEASE.paths[0]);
    const concurrent = "operator-edit-during-health-preflight";
    let preflightCalls = 0;
    await assert.rejects(deploy({ root: fixture.root, apply: true, healthUrl: "fixture://" }, {
      ...fixture.dependencies,
      healthPreflight: () => {
        preflightCalls += 1;
        if (preflightCalls === 2) fs.writeFileSync(sourcePath, concurrent);
      },
    }), /after health preflight before targeted source patch/);
    assert.equal(fs.readFileSync(sourcePath, "utf8"), concurrent);
    assert.equal(fs.readFileSync(path.join(fixture.root, "dist", "public", "index.html"), "utf8"), "old frontend");
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  await t.test("replay after successful deployment", async () => {
    const fixture = makeDeployFixture();
    await deploy({ root: fixture.root, apply: true, healthUrl: "fixture://" }, fixture.dependencies);
    await assert.rejects(deploy({ root: fixture.root, apply: true, healthUrl: "fixture://" }, fixture.dependencies), /pre-deploy source hash mismatch/);
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });
});