"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { RELEASE, HELPER_SHA256, parseArgs, deploy, validateGit } = require("./deploy-omni-task-hotfix.cjs");

const NEW_PATHS = [
  "script/test-omni-task-design-browser.cjs",
  "server/lib/task-source-entity.test.ts",
  "server/lib/task-source-entity.ts",
];

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "omni-hotfix-deploy-test-"));
}

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout || "";
}

function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function makeFixture() {
  const root = tempDir();
  const initial = new Map();
  for (const name of RELEASE.paths.filter((item) => !NEW_PATHS.includes(item))) {
    const content = name === "server/routes.ts"
      ? 'import { app } from "express";\nconst routeContext = "baseline";\n'
      : `baseline source for ${name}\n`;
    initial.set(name, content);
    write(root, name, content);
  }
  write(root, "package.json", '{"scripts":{"build":"fixture"}}\n');
  write(root, "tracked-unrelated.ts", "unrelated tracked source\n");
  write(root, ".env", "TOKEN=private-fixture\n");
  write(root, "data/customer-record.csv", "private customer fixture\n");
  write(root, "uploads/private-upload.bin", "private upload fixture\n");
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  fs.mkdirSync(path.join(root, "dist", "public", "assets"), { recursive: true });
  write(root, "dist/index.cjs", "old-server-bundle\n");
  write(root, "dist/public/index.html", '<script type="module" src="/assets/old-entry.js"></script>\n');
  write(root, "dist/public/assets/old-entry.js", "old asset retained for open browsers");
  write(root, "dist/public/assets/lazy-old.js", "old lazy chunk retained");

  git(root, "init", "-q");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture base");

  // Generate an authentic git-format patch from this dirty tree, including the
  // three source additions. The production CLI still validates its own pinned
  // release hash; this injects a fixture patch only for isolated temp repos.
  for (const name of RELEASE.paths.filter((item) => !NEW_PATHS.includes(item))) {
    write(root, name, `patched source for ${name}\n`);
  }
  for (const name of NEW_PATHS) write(root, name, `new reviewed source: ${name}\n`);
  git(root, "add", "-N", ...NEW_PATHS);
  const patch = git(root, "diff", "--binary", "--", ...RELEASE.paths);
  assert.ok(patch.includes("server/routes.ts"));
  git(root, "reset", "--quiet");
  for (const [name, content] of initial) write(root, name, content);
  for (const name of NEW_PATHS) fs.rmSync(path.join(root, name), { force: true });

  const release = {
    ...RELEASE,
    base: git(root, "rev-parse", "HEAD").trim(),
    commit: "fixture-release",
    tree: "fixture-tree",
    parent: "fixture-parent",
    patchBase: "fixture-patch-base",
  };
  const expectedHashes = {};
  for (const name of Object.keys(RELEASE.expectedHashes)) {
    expectedHashes[name] = name === "script/test-omni-task-design-browser.cjs"
      || name === "server/lib/task-source-entity.test.ts"
      || name === "server/lib/task-source-entity.ts"
      ? "missing"
      : hash(initial.get(name));
  }

  const restartCalls = [];
  const dependencies = {
    release,
    proof: { expectedHashes },
    validateGit: (_root, { patchFile }) => {
      fs.mkdirSync(path.dirname(patchFile), { recursive: true });
      fs.writeFileSync(patchFile, patch, { mode: 0o600 });
    },
    build: (stage) => {
      assert.equal(fs.readlinkSync(path.join(stage, "node_modules")), path.join(root, "node_modules"));
      assert.equal(fs.existsSync(path.join(stage, ".env")), false);
      assert.equal(fs.existsSync(path.join(stage, "data")), false);
      assert.equal(fs.existsSync(path.join(stage, "uploads")), false);
      fs.mkdirSync(path.join(stage, "dist", "public", "assets"), { recursive: true });
      write(stage, "dist/public/index.html", '<script type="module" src="/assets/new-entry.js"></script>\n');
      write(stage, "dist/public/assets/new-entry.js", "new entry asset");
      write(stage, "dist/index.cjs", "new-fullstack-server-bundle\n");
    },
    pm2List: () => [{
      name: "indexus-crm",
      pid: 7001,
      pm2_env: {
        status: "online",
        pm_cwd: root,
        pm_exec_path: path.join(root, "dist", "index.cjs"),
        env: { TOKEN: "do-not-log-this-secret" },
      },
    }],
    pm2Restart: (name) => restartCalls.push(name),
    status: (url) => (url.includes("/api/tasks/") ? "401" : "200"),
    healthTransport: {
      status: () => "200",
      body: () => fs.readFileSync(path.join(root, "dist", "public", "index.html"), "utf8"),
    },
    exchange: (first, second) => {
      const temporary = `${first}.test-swap`;
      fs.renameSync(first, temporary);
      fs.renameSync(second, first);
      fs.renameSync(temporary, second);
    },
  };
  return { root, release, expectedHashes, restartCalls, dependencies, patch, initial };
}

function options(fixture, overrides = {}) {
  return {
    root: fixture.root,
    healthUrl: "http://127.0.0.1:5000/",
    apply: false,
    allowRestart: false,
    ...overrides,
  };
}

test("pinned bootstrap helper and release input manifests are explicit", () => {
  assert.equal(HELPER_SHA256, "e08b9db17583560330c7d0b84c534d559239fc557623869e7a112e764366cf7a");
  assert.equal(RELEASE.base, "b59f6e006cc2073cbb5ae909555c304cf0030903");
  assert.equal(RELEASE.commit, "4bcc611acd8b9a5ab6898c49f57686a57496a15e");
  assert.equal(RELEASE.parent, "1060a63c3bc3f3613b81c6d5c16c78bb879d3275");
  assert.equal(RELEASE.tree, "468742743799bf6f58c83d798e0f0254d15120f6");
  assert.equal(RELEASE.patchSha256, "e182b8477820f1d7b83553dde622f0159a6d6645c1f5fb1ed33f3318a3942663");
  assert.equal(RELEASE.paths.length, 7);
  assert.equal(parseArgs([]).apply, false);
  assert.throws(() => parseArgs(["--apply"]), /--allow-restart/);
  assert.equal(parseArgs(["--apply", "--allow-restart"]).allowRestart, true);
  assert.throws(() => parseArgs(["--health-url", "https://example.com"]), /localhost\/loopback/);
});

test("pinned git release validator rejects head, tree, parent, path and patch-proof mismatches", () => {
  const root = tempDir();
  const patchFile = path.join(root, "private", "reviewed.patch");
  const patch = Buffer.from("fixture pinned patch bytes");
  const release = {
    ...RELEASE,
    base: "required-base",
    commit: "pinned-release",
    parent: "required-parent",
    patchBase: "patch-base",
    tree: "required-tree",
    patchSha256: hash(patch),
  };
  const outputs = {
    "rev-parse HEAD": release.base,
    [`show -s --format=%T ${release.commit}`]: release.tree,
    [`rev-parse ${release.commit}^`]: release.parent,
    [`diff --name-only ${release.patchBase} ${release.commit}`]: [...release.paths].sort().join("\n"),
  };
  const mockGit = (changes = {}) => (args, binary) => {
    const key = args.join(" ");
    if (args[0] === "fetch") return "";
    if (args[0] === "diff" && binary) return changes.patch || patch;
    if (key === "rev-parse HEAD") return changes.head || outputs[key];
    if (key === `show -s --format=%T ${release.commit}`) return changes.tree || outputs[key];
    if (key === `rev-parse ${release.commit}^`) return changes.parent || outputs[key];
    if (args[0] === "diff" && args[1] === "--name-only") return changes.paths || outputs[key];
    throw new Error(`Unexpected git validation call: ${key}`);
  };
  fs.mkdirSync(path.dirname(patchFile), { recursive: true });
  validateGit(root, patchFile, release, mockGit());
  assert.equal(fs.readFileSync(patchFile).compare(patch), 0);
  assert.throws(() => validateGit(root, patchFile, release, mockGit({ head: "wrong-head" })), /Unexpected live HEAD/);
  assert.throws(() => validateGit(root, patchFile, release, mockGit({ tree: "wrong-tree" })), /tree mismatch/);
  assert.throws(() => validateGit(root, patchFile, release, mockGit({ parent: "wrong-parent" })), /parent mismatch/);
  assert.throws(() => validateGit(root, patchFile, release, mockGit({ paths: "unexpected.ts" })), /unexpected paths/);
  assert.throws(() => validateGit(root, patchFile, release, mockGit({ patch: Buffer.from("other patch") })), /patch SHA-256 mismatch/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("prepare builds from current tracked source privately and leaves dirty tree, public/server, data and index untouched", async () => {
  const fixture = makeFixture();
  const indexBefore = fs.readFileSync(path.join(fixture.root, ".git", "index"));
  const backendBefore = fs.readFileSync(path.join(fixture.root, "dist", "index.cjs"), "utf8");
  const publicBefore = fs.readFileSync(path.join(fixture.root, "dist", "public", "index.html"), "utf8");
  const result = await deploy(options(fixture), fixture.dependencies);
  assert.equal(result.prepared, true);
  assert.equal(fs.readFileSync(path.join(fixture.root, ".git", "index")).compare(indexBefore), 0);
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist", "index.cjs"), "utf8"), backendBefore);
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist", "public", "index.html"), "utf8"), publicBefore);
  assert.equal(fs.readFileSync(path.join(fixture.root, ".env"), "utf8"), "TOKEN=private-fixture\n");
  assert.equal(fs.readFileSync(path.join(fixture.root, "data/customer-record.csv"), "utf8"), "private customer fixture\n");
  assert.equal(fs.readFileSync(path.join(fixture.root, "uploads/private-upload.bin"), "utf8"), "private upload fixture\n");
  assert.deepEqual(fixture.restartCalls, []);
  assert.ok(fs.existsSync(path.join(result.stage, "dist", "index.cjs")));
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("apply requires restart acknowledgement and rolls out only targeted source, public tree, and backend bundle", async () => {
  const fixture = makeFixture();
  const indexBefore = fs.readFileSync(path.join(fixture.root, ".git", "index"));
  await assert.rejects(deploy(options(fixture, { apply: true }), fixture.dependencies), /--allow-restart/);
  assert.deepEqual(fixture.restartCalls, []);
  const result = await deploy(options(fixture, { apply: true, allowRestart: true }), fixture.dependencies);
  assert.equal(result.applied, true);
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist", "index.cjs"), "utf8"), "new-fullstack-server-bundle\n");
  assert.match(fs.readFileSync(path.join(fixture.root, "dist", "public", "index.html"), "utf8"), /new-entry\.js/);
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist", "public", "assets", "old-entry.js"), "utf8"), "old asset retained for open browsers");
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist", "public", "assets", "lazy-old.js"), "utf8"), "old lazy chunk retained");
  assert.equal(fs.readFileSync(path.join(result.backupDir, "server", "index.cjs"), "utf8"), "old-server-bundle\n");
  assert.equal(fs.readFileSync(path.join(result.backupDir, "public", "index.html"), "utf8"), '<script type="module" src="/assets/old-entry.js"></script>\n');
  assert.equal(fs.readFileSync(path.join(result.backupDir, "source", "server/routes.ts"), "utf8"), fixture.initial.get("server/routes.ts"));
  assert.equal(fs.readFileSync(path.join(fixture.root, ".env"), "utf8"), "TOKEN=private-fixture\n");
  assert.equal(fs.readFileSync(path.join(fixture.root, "data/customer-record.csv"), "utf8"), "private customer fixture\n");
  assert.equal(fs.readFileSync(path.join(fixture.root, "uploads/private-upload.bin"), "utf8"), "private upload fixture\n");
  assert.deepEqual(fixture.restartCalls, ["indexus-crm"]);
  assert.equal(fs.readFileSync(path.join(fixture.root, ".git", "index")).compare(indexBefore), 0);
  for (const name of RELEASE.paths) {
    const expected = NEW_PATHS.includes(name) ? `new reviewed source: ${name}\n` : `patched source for ${name}\n`;
    assert.equal(fs.readFileSync(path.join(fixture.root, name), "utf8"), expected);
  }
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("unknown client prehash and dirty routes context mismatch fail before cutover", async (t) => {
  await t.test("unknown client source", async () => {
    const fixture = makeFixture();
    const bad = { ...fixture.dependencies, proof: { expectedHashes: { ...fixture.expectedHashes,
      "client/src/pages/email-client.tsx": "0".repeat(64),
    } } };
    await assert.rejects(deploy(options(fixture), bad), /Pre-deploy source hash mismatch/);
    assert.deepEqual(fixture.restartCalls, []);
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });
  await t.test("route hunk no longer applies", async () => {
    const fixture = makeFixture();
    fs.writeFileSync(path.join(fixture.root, "server/routes.ts"), 'import { app } from "express";\nconst routeContext = "operator changed the hunk";\n');
    await assert.rejects(deploy(options(fixture), fixture.dependencies), /git apply .*failed/);
    assert.deepEqual(fixture.restartCalls, []);
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });
});

test("concurrent tracked source, backend, and public writes during build reject staging without overwrite", async (t) => {
  for (const target of ["tracked", "backend", "public"]) {
    await t.test(target, async () => {
      const fixture = makeFixture();
      const originalBuild = fixture.dependencies.build;
      fixture.dependencies.build = (stage) => {
        originalBuild(stage);
        if (target === "tracked") fs.writeFileSync(path.join(fixture.root, "tracked-unrelated.ts"), "external tracked write\n");
        if (target === "backend") fs.writeFileSync(path.join(fixture.root, "dist/index.cjs"), "external backend write\n");
        if (target === "public") fs.writeFileSync(path.join(fixture.root, "dist/public/index.html"), "external public write\n");
      };
      await assert.rejects(deploy(options(fixture), fixture.dependencies), /Concurrent or unexpected change|backend changed|public directory changed/);
      if (target === "tracked") assert.equal(fs.readFileSync(path.join(fixture.root, "tracked-unrelated.ts"), "utf8"), "external tracked write\n");
      if (target === "backend") assert.equal(fs.readFileSync(path.join(fixture.root, "dist/index.cjs"), "utf8"), "external backend write\n");
      if (target === "public") assert.equal(fs.readFileSync(path.join(fixture.root, "dist/public/index.html"), "utf8"), "external public write\n");
      assert.deepEqual(fixture.restartCalls, []);
      fs.rmSync(fixture.root, { recursive: true, force: true });
    });
  }
});

test("public read permissions are inherited and unreadable legacy assets fail closed", async (t) => {
  await t.test("permission inheritance", async () => {
    const fixture = makeFixture();
    fs.chmodSync(path.join(fixture.root, "dist/public/index.html"), 0o640);
    const result = await deploy(options(fixture), fixture.dependencies);
    assert.equal(fs.statSync(path.join(result.stage, "dist/public/index.html")).mode & 0o777, 0o640);
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });
  await t.test("unreadable live entry", async () => {
    const fixture = makeFixture();
    fs.chmodSync(path.join(fixture.root, "dist/public/index.html"), 0o000);
    await assert.rejects(deploy(options(fixture), fixture.dependencies), /not readable|EACCES/);
    assert.deepEqual(fixture.restartCalls, []);
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });
});

test("external backend writer during atomic public exchange is preserved and never restarted over", async () => {
  const fixture = makeFixture();
  const normalExchange = fixture.dependencies.exchange;
  let injected = false;
  fixture.dependencies.exchange = (first, second) => {
    normalExchange(first, second);
    if (!injected && fs.statSync(first).isDirectory()) {
      injected = true;
      fs.writeFileSync(path.join(fixture.root, "dist/index.cjs"), "external backend writer during cutover\n");
    }
  };
  await assert.rejects(
    deploy(options(fixture, { apply: true, allowRestart: true }), fixture.dependencies),
    /Backend dist\/index\.cjs changed immediately before guarded install/,
  );
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist/index.cjs"), "utf8"), "external backend writer during cutover\n");
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist/public/index.html"), "utf8"), '<script type="module" src="/assets/old-entry.js"></script>\n');
  assert.deepEqual(fixture.restartCalls, []);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("backend exchange displaced-fingerprint guard restores an exact-window external writer", async () => {
  const fixture = makeFixture();
  const normalExchange = fixture.dependencies.exchange;
  let injected = false;
  fixture.dependencies.exchange = (first, second) => {
    const fileExchange = fs.lstatSync(first).isFile();
    if (fileExchange && !injected) {
      injected = true;
      fs.writeFileSync(second, "external backend writer inside atomic exchange window\n");
    }
    normalExchange(first, second);
  };
  await assert.rejects(
    deploy(options(fixture, { apply: true, allowRestart: true }), fixture.dependencies),
    /Backend changed concurrently during guarded install/,
  );
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist/index.cjs"), "utf8"), "external backend writer inside atomic exchange window\n");
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist/public/index.html"), "utf8"), '<script type="module" src="/assets/old-entry.js"></script>\n');
  assert.deepEqual(fixture.restartCalls, []);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("failed health restores owned source/public/backend, restarts old bundle only after restoration", async () => {
  const fixture = makeFixture();
  fixture.dependencies.status = (url) => (url.includes("/api/tasks/") ? "503" : "200");
  fixture.dependencies.healthTimeoutMs = 1;
  await assert.rejects(
    deploy(options(fixture, { apply: true, allowRestart: true }), fixture.dependencies),
    /Task source-entity route probe returned HTTP 503/,
  );
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist/index.cjs"), "utf8"), "old-server-bundle\n");
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist/public/index.html"), "utf8"), '<script type="module" src="/assets/old-entry.js"></script>\n');
  for (const [name, content] of fixture.initial) assert.equal(fs.readFileSync(path.join(fixture.root, name), "utf8"), content);
  for (const name of NEW_PATHS) assert.equal(fs.existsSync(path.join(fixture.root, name)), false);
  assert.deepEqual(fixture.restartCalls, ["indexus-crm", "indexus-crm"]);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("rollback preserves external writer and does not restart when restoration is incomplete", async () => {
  const fixture = makeFixture();
  let wrote = false;
  fixture.dependencies.status = (url) => {
    if (url.includes("/api/tasks/") && !wrote) {
      wrote = true;
      fs.writeFileSync(path.join(fixture.root, "server/routes.ts"), "external operator writer during health check\n");
    }
    return url.includes("/api/tasks/") ? "503" : "200";
  };
  fixture.dependencies.healthTimeoutMs = 1;
  await assert.rejects(
    deploy(options(fixture, { apply: true, allowRestart: true }), fixture.dependencies),
    /Task source-entity route probe returned HTTP 503/,
  );
  assert.equal(fs.readFileSync(path.join(fixture.root, "server/routes.ts"), "utf8"), "external operator writer during health check\n");
  assert.equal(fs.readFileSync(path.join(fixture.root, "dist/index.cjs"), "utf8"), "old-server-bundle\n");
  assert.deepEqual(fixture.restartCalls, ["indexus-crm"]);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("PM2 process identity and online-state checks fail closed", () => {
  const fixture = makeFixture();
  const { validatePm2 } = require("./deploy-omni-task-hotfix.cjs");
  assert.throws(() => validatePm2(fixture.root, {
    pm2List: () => [{ name: "indexus-crm", pm2_env: { status: "online", pm_cwd: "/wrong", pm_exec_path: "/wrong/index.cjs" } }],
  }), /expected deployment cwd\/script/);
  assert.throws(() => validatePm2(fixture.root, {
    pm2List: () => [{ name: "indexus-crm", pm2_env: { status: "stopped", pm_cwd: fixture.root,
      pm_exec_path: path.join(fixture.root, "dist/index.cjs") } }],
  }), /must be online/);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});