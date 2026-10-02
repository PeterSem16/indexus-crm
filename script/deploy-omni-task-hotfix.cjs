#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const HELPER_SHA256 = "e08b9db17583560330c7d0b84c534d559239fc557623869e7a112e764366cf7a";
const helperPath = path.join(__dirname, "deploy-notifications-pulse.cjs");
if (crypto.createHash("sha256").update(fs.readFileSync(helperPath)).digest("hex") !== HELPER_SHA256) {
  throw new Error("Pinned notifications deployment helper hash mismatch; refusing deployment.");
}
const helpers = require(helperPath);

const RELEASE = Object.freeze({
  base: "b59f6e006cc2073cbb5ae909555c304cf0030903",
  commit: "4bcc611acd8b9a5ab6898c49f57686a57496a15e",
  parent: "1060a63c3bc3f3613b81c6d5c16c78bb879d3275",
  patchBase: "1060a63c3bc3f3613b81c6d5c16c78bb879d3275",
  tree: "468742743799bf6f58c83d798e0f0254d15120f6",
  patchSha256: "e182b8477820f1d7b83553dde622f0159a6d6645c1f5fb1ed33f3318a3942663",
  paths: [
    "client/src/components/nexus/nexus-sidebar.tsx",
    "client/src/components/nexus/nexus-signal-tasks.css",
    "client/src/pages/email-client.tsx",
    "script/test-omni-task-design-browser.cjs",
    "server/lib/task-source-entity.test.ts",
    "server/lib/task-source-entity.ts",
    "server/routes.ts",
  ],
  expectedHashes: {
    "client/src/components/nexus/nexus-sidebar.tsx": "10f369e67ef6caf54edb8153f8ca5be0c8e30a4daf047182e568d54f066d0d73",
    "client/src/components/nexus/nexus-signal-tasks.css": "ed7504274f3a24be25bad66a64dd4fbfc2258d4217b9ca4c5ce35410a6e702ca",
    "client/src/pages/email-client.tsx": "b6134d1b8b5b15db844afb32b44fce87a436469be86d1bd86171f35fcca1b630",
    "script/test-omni-task-design-browser.cjs": "missing",
    "server/lib/task-source-entity.test.ts": "missing",
    "server/lib/task-source-entity.ts": "missing",
    // routes.ts is intentionally unpinned: its dirty production version must
    // accept the exact reviewed patch with git apply --check, without 3-way.
  },
});

const PROCESS_NAME = "indexus-crm";
const LOCK_NAME = "notifications-pulse-deploy.lock";

function fail(message) {
  throw new Error(message);
}

function redact(text) {
  return String(text).replace(/(https?:\/\/)[^/@\s]+@/gi, "$1[redacted]@")
    .replace(/((?:token|password|secret|authorization)[=:]\s*)[^\s&]+/gi, "$1[redacted]");
}

function assertNoSymlinkChain(target) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) {
      if (error.code === "ENOENT") return absolute;
      throw error;
    }
    if (stat.isSymbolicLink()) fail(`Symlink path component refused: ${current}`);
    if (current !== absolute && !stat.isDirectory()) fail(`Non-directory path component refused: ${current}`);
  }
  return absolute;
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: options.encoding || "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    maxBuffer: options.maxBuffer || 32 * 1024 * 1024,
  });
  if (result.error) fail(`${commandName} could not run: ${redact(result.error.message)}`);
  if (result.status !== 0) {
    const detail = options.suppressOutput ? "" : redact(`${result.stdout || ""}${result.stderr || ""}`.trim());
    fail(`${commandName} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout || "";
}

function parseArgs(args) {
  const options = {
    apply: false,
    allowRestart: false,
    root: "/var/www/indexus-crm",
    healthUrl: "http://127.0.0.1:5000/",
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--prepare") options.apply = false;
    else if (arg === "--allow-restart") options.allowRestart = true;
    else if (arg === "--root" || arg === "--health-url") {
      const value = args[++i];
      if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
      if (arg === "--root") options.root = path.resolve(value);
      else options.healthUrl = value;
    } else if (arg === "--help" || arg === "-h") options.help = true;
    else fail(`Unknown option: ${arg}`);
  }
  if (!options.help) {
    if (options.apply && !options.allowRestart) fail("--apply requires explicit --allow-restart acknowledgement");
    let health;
    try { health = new URL(options.healthUrl); } catch { fail("--health-url must be a valid local HTTP(S) URL"); }
    if (!["http:", "https:"].includes(health.protocol)
      || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(health.hostname)
      || health.username || health.password) {
      fail("--health-url must use localhost/loopback without embedded credentials");
    }
  }
  return options;
}

function usage() {
  return [
    "Usage: node script/deploy-omni-task-hotfix.cjs [--prepare|--apply] [--allow-restart] [--root PATH] [--health-url URL]",
    "Default --prepare stages and builds only; it does not alter live source/assets/server or restart PM2.",
    "--apply is deliberately guarded and requires --allow-restart; it restages and rebuilds independently.",
    "Warning: restarting indexus-crm can interrupt active calls/sessions.",
    "No git pull/reset/stash/clean, npm install, database push, PM2 environment update, or unrelated process restart is performed.",
    "Use only after reviewing the prepare report and ensure no other deployment or manual source/assets edits are in progress.",
  ].join("\n");
}

function fileFingerprint(file) {
  assertNoSymlinkChain(file);
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) fail(`Expected regular file: ${file}`);
    return {
      hash: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
      mode: stat.mode & 0o7777,
      uid: stat.uid,
      gid: stat.gid,
    };
  } catch (error) {
    if (error.code === "ENOENT") return { hash: "missing" };
    throw error;
  }
}

function fileIdentityFingerprint(file) {
  const fingerprint = fileFingerprint(file);
  if (fingerprint.hash === "missing") return fingerprint;
  const stat = fs.lstatSync(file);
  return { ...fingerprint, dev: stat.dev, ino: stat.ino };
}

function contentFingerprint(fingerprint) {
  if (fingerprint.hash === "missing") return fingerprint;
  return {
    hash: fingerprint.hash,
    mode: fingerprint.mode,
    uid: fingerprint.uid,
    gid: fingerprint.gid,
  };
}

function unlinkIfIdentityMatches(file, expected) {
  if (JSON.stringify(fileIdentityFingerprint(file)) !== JSON.stringify(expected)) {
    fail(`Refusing to remove replacement path that changed concurrently: ${file}`);
  }
  fs.unlinkSync(file);
}

function checkExpectedSources(root, release) {
  for (const [name, expected] of Object.entries(release.expectedHashes || {})) {
    const actual = fileFingerprint(path.join(root, name)).hash;
    if (actual !== expected) fail(`Pre-deploy source hash mismatch for ${name}: expected ${expected}, got ${actual}`);
  }
  const routes = fileFingerprint(path.join(root, "server/routes.ts"));
  if (routes.hash === "missing") fail("Required server/routes.ts is absent");
}

function safeTrackedSource(name) {
  const normalized = name.replace(/\\/g, "/");
  const base = path.posix.basename(normalized);
  return !/^\.env(?:\.|$)/i.test(base)
    && !/^(?:data|uploads?)(?:\/|$)/i.test(normalized)
    && !/\.(?:gz|tgz|tar|zip|7z|rar|pem|key|p12|pfx|jks|keystore)$/i.test(base)
    && !/(?:^|[._-])(?:secret|credentials?)(?:[._-]|$)/i.test(base);
}

function copyTrackedPath(source, destination) {
  assertNoSymlinkChain(source);
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) fail(`Refusing tracked symlink: ${source}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true, mode: stat.mode & 0o777 });
    for (const name of fs.readdirSync(source)) copyTrackedPath(path.join(source, name), path.join(destination, name));
    fs.chmodSync(destination, stat.mode & 0o777);
  } else if (stat.isFile()) {
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, stat.mode & 0o777);
  } else fail(`Unsupported tracked filesystem object: ${source}`);
}

function makeStage(root, stage, snapshot) {
  assertNoSymlinkChain(stage);
  fs.mkdirSync(stage, { recursive: true, mode: 0o700 });
  for (const [name, fingerprint] of snapshot) {
    if (name === "dist/index.cjs" || fingerprint.hash === "missing" || fingerprint.hash === "excluded") continue;
    if (!safeTrackedSource(name)) continue;
    copyTrackedPath(path.join(root, name), path.join(stage, name));
  }
  const modules = path.join(root, "node_modules");
  if (!fs.existsSync(modules)) fail("Live node_modules is absent; deployment must not install dependencies");
  const moduleStat = fs.lstatSync(modules);
  if (!moduleStat.isDirectory() && !moduleStat.isSymbolicLink()) fail("Live node_modules is not a directory");
  fs.symlinkSync(modules, path.join(stage, "node_modules"), "dir");
}

function compareSnapshots(before, after, context) {
  helpers.compareSnapshot(before, after, context);
}

function compareUntouchedSnapshot(before, after, changedPaths, context) {
  const changed = new Set(changedPaths);
  for (const name of after.keys()) {
    if (!before.has(name) && !changed.has(name)) {
      fail(`New tracked path appeared: ${name} ${context}; refusing deployment`);
    }
  }
  for (const [name, fingerprint] of before) {
    if (!changed.has(name) && JSON.stringify(after.get(name)) !== JSON.stringify(fingerprint)) {
      fail(`Concurrent or unexpected change to ${name} ${context}; refusing deployment`);
    }
  }
}

function publicSnapshot(directory) {
  assertNoSymlinkChain(directory);
  const root = fs.lstatSync(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) fail(`Expected real public directory: ${directory}`);
  const entries = {};
  function visit(target, relative) {
    assertNoSymlinkChain(target);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) fail(`Symlink in public tree refused: ${target}`);
    entries[relative || "."] = {
      kind: stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "other",
      dev: stat.dev,
      ino: stat.ino,
      mode: stat.mode & 0o777,
      uid: stat.uid,
      gid: stat.gid,
      ...(stat.isFile() ? { hash: crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex") } : {}),
    };
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(target).sort()) visit(path.join(target, name), path.posix.join(relative, name));
    } else if (!stat.isFile()) fail(`Unsupported filesystem object in public tree: ${target}`);
  }
  visit(directory, ".");
  return JSON.stringify(entries);
}

function publicReference(livePublic, relative, isDirectory) {
  let candidate = path.join(livePublic, relative);
  try { assertNoSymlinkChain(candidate); return fs.statSync(candidate); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (isDirectory) {
    candidate = path.dirname(candidate);
    while (candidate.startsWith(livePublic)) {
      try { assertNoSymlinkChain(candidate); return fs.statSync(candidate); } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (candidate === livePublic) break;
      candidate = path.dirname(candidate);
    }
  }
  const index = path.join(livePublic, "index.html");
  assertNoSymlinkChain(index);
  return fs.statSync(index);
}

function fixPublicPermissions(livePublic, stagePublic) {
  function walk(target) {
    assertNoSymlinkChain(target);
    const stat = fs.lstatSync(target);
    const reference = publicReference(livePublic, path.relative(stagePublic, target), stat.isDirectory());
    if (stat.isDirectory()) for (const name of fs.readdirSync(target)) walk(path.join(target, name));
    if (stat.isDirectory() && (reference.mode & 0o555) === 0) fail(`Staged public directory is not traversable: ${target}`);
    if (stat.isFile() && (reference.mode & 0o444) === 0) fail(`Staged public file is not readable: ${target}`);
    fs.chmodSync(target, reference.mode & 0o777);
    try { fs.chownSync(target, reference.uid, reference.gid); } catch (error) {
      const current = fs.statSync(target);
      if (error.code !== "EPERM" || current.uid !== reference.uid || current.gid !== reference.gid) throw error;
    }
    const current = fs.statSync(target);
    if (current.uid !== reference.uid || current.gid !== reference.gid
      || (current.mode & 0o444) !== (reference.mode & 0o444)) {
      fail(`Staged public readability/ownership differs from live public: ${target}`);
    }
  }
  walk(stagePublic);
}

function preserveOldAssets(livePublic, stagePublic) {
  const oldAssets = path.join(livePublic, "assets");
  const newAssets = path.join(stagePublic, "assets");
  if (!fs.existsSync(oldAssets)) return;
  fs.mkdirSync(newAssets, { recursive: true });
  function visit(from, to) {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) fail(`Symlink in old public assets refused: ${path.join(from, entry.name)}`);
      const source = path.join(from, entry.name);
      const destination = path.join(to, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destination, { recursive: true });
        visit(source, destination);
      } else if (entry.isFile() && !fs.existsSync(destination)) {
        fs.copyFileSync(source, destination);
        fs.chmodSync(destination, fs.statSync(source).mode & 0o777);
      }
    }
  }
  visit(oldAssets, newAssets);
}

function applyFileMetadata(file, metadata) {
  if (metadata) {
    try { fs.chownSync(file, metadata.uid, metadata.gid); } catch (error) {
      const stat = fs.statSync(file);
      if (error.code !== "EPERM" || stat.uid !== metadata.uid || stat.gid !== metadata.gid) throw error;
    }
    fs.chmodSync(file, metadata.mode);
  } else fs.chmodSync(file, 0o644);
}

function saveSources(root, backupDir, paths) {
  const metadata = {};
  for (const name of paths) {
    const source = path.join(root, name);
    const fingerprint = fileFingerprint(source);
    if (fingerprint.hash === "missing") {
      metadata[name] = null;
      continue;
    }
    metadata[name] = { mode: fingerprint.mode, uid: fingerprint.uid, gid: fingerprint.gid };
    const backup = path.join(backupDir, "source", name);
    fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 });
    fs.copyFileSync(source, backup);
    fs.chmodSync(backup, 0o600);
  }
  return metadata;
}

function preserveServerMetadata(file, metadata) {
  applyFileMetadata(file, metadata);
  const stat = fs.statSync(file);
  if (stat.uid !== metadata.uid || stat.gid !== metadata.gid || (stat.mode & 0o7777) !== metadata.mode) {
    fail(`Could not preserve dist/index.cjs metadata: ${file}`);
  }
}

function pm2List(dependencies = {}) {
  if (dependencies.pm2List) return dependencies.pm2List();
  const output = command("pm2", ["jlist"], { suppressOutput: true });
  try { return JSON.parse(output); } catch { fail("PM2 returned invalid process metadata; no process was restarted"); }
}

function validatePm2(root, dependencies = {}, allowOffline = false) {
  const rows = pm2List(dependencies);
  const matches = rows.filter((row) => row?.name === PROCESS_NAME);
  if (matches.length !== 1) fail(`Expected exactly one PM2 process named ${PROCESS_NAME}; found ${matches.length}`);
  const row = matches[0];
  const metadata = row.pm2_env || {};
  const cwd = metadata.pm_cwd && path.resolve(metadata.pm_cwd);
  const script = metadata.pm_exec_path && path.resolve(metadata.pm_exec_path);
  if ((!allowOffline && metadata.status !== "online") || cwd !== path.resolve(root)
    || script !== path.resolve(root, "dist/index.cjs")) {
    fail(`PM2 ${PROCESS_NAME} must be online with the expected deployment cwd/script; refusing deployment`);
  }
  return { pid: row.pid, name: row.name };
}

function restartPm2(dependencies = {}) {
  if (dependencies.pm2Restart) return dependencies.pm2Restart(PROCESS_NAME);
  // Never request --update-env and never include PM2's environment in output.
  command("pm2", ["restart", PROCESS_NAME], { suppressOutput: true });
}

function validateGit(root, patchFile, release = RELEASE, git) {
  return helpers.validateGit(root, { patchFile, release }, git ? { git } : {});
}

function curlStatus(url) {
  return command("curl", [
    "--silent", "--show-error", "--output", "/dev/null", "--write-out", "%{http_code}",
    "--max-time", "8", url,
  ], { suppressOutput: true }).trim();
}

function basicHealth(url, dependencies = {}) {
  const status = (dependencies.status || curlStatus)(url);
  if (status !== "200") fail(`Local frontend health returned HTTP ${status}; expected 200`);
}

function routeProbeUrl(healthUrl) {
  const base = new URL(healthUrl);
  base.pathname = `${base.pathname.replace(/\/?$/, "/")}api/tasks/__hotfix_probe__/source-entity`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

async function waitForPostRestartHealth(options, expectedIndex, dependencies) {
  const deadline = Date.now() + (dependencies.healthTimeoutMs || 90_000);
  let last = "not yet checked";
  while (Date.now() < deadline) {
    try {
      const transport = dependencies.healthTransport || {};
      helpers.verifyHttp(options.healthUrl, expectedIndex, {
        status: transport.status || curlStatus,
        body: transport.body || ((url) => command("curl", ["--fail", "--silent", "--show-error", "--max-time", "8", url], { suppressOutput: true })),
      });
      const status = (dependencies.status || curlStatus)(routeProbeUrl(options.healthUrl));
      if (status !== "401") fail(`Task source-entity route probe returned HTTP ${status}; expected unauthenticated 401`);
      return;
    } catch (error) {
      last = error.message;
      if (dependencies.healthTimeoutMs && dependencies.healthTimeoutMs < 1000) throw error;
      await new Promise((resolve) => setTimeout(resolve, dependencies.healthPollMs || 2000));
    }
  }
  fail(`Post-restart health did not become ready within the bounded wait: ${last}`);
}

function atomicExchange(first, second, dependencies) {
  if (dependencies.exchange) return dependencies.exchange(first, second);
  return helpers.atomicExchange(first, second);
}

function restoreServerIfOwned(liveServer, backupServer, original, deployed, dependencies) {
  const current = fileIdentityFingerprint(liveServer);
  if (JSON.stringify(current) !== JSON.stringify(deployed)) {
    console.error("ROLLBACK_SKIPPED backend: dist/index.cjs no longer matches this invocation; preserving external change.");
    return false;
  }
  if (fileFingerprint(backupServer).hash !== original.hash) {
    console.error("ROLLBACK_SKIPPED backend: private server backup changed; preserving live bundle.");
    return false;
  }
  const temp = `${liveServer}.restore-${process.pid}-${crypto.randomUUID()}`;
  assertNoSymlinkChain(temp);
  fs.copyFileSync(backupServer, temp);
  applyFileMetadata(temp, original);
  if (JSON.stringify(fileIdentityFingerprint(liveServer)) !== JSON.stringify(deployed)) {
    fs.unlinkSync(temp);
    console.error("ROLLBACK_SKIPPED backend: live bundle changed immediately before guarded restore.");
    return false;
  }
  atomicExchange(temp, liveServer, dependencies);
  const displaced = fileIdentityFingerprint(temp);
  if (JSON.stringify(displaced) !== JSON.stringify(deployed)) {
    const restored = fileFingerprint(liveServer);
    if (JSON.stringify(contentFingerprint(restored)) === JSON.stringify(contentFingerprint(original))
      && JSON.stringify(fileIdentityFingerprint(temp)) === JSON.stringify(displaced)) {
      atomicExchange(temp, liveServer, dependencies);
      if (JSON.stringify(fileIdentityFingerprint(liveServer)) === JSON.stringify(displaced)
        && JSON.stringify(contentFingerprint(fileFingerprint(temp))) === JSON.stringify(contentFingerprint(deployed))) {
        unlinkIfIdentityMatches(temp, deployed);
      }
    }
    console.error("ROLLBACK_SKIPPED backend: concurrent replacement detected; preserving external bundle.");
    return false;
  }
  unlinkIfIdentityMatches(temp, deployed);
  if (JSON.stringify(contentFingerprint(fileFingerprint(liveServer))) !== JSON.stringify(contentFingerprint(original))) {
    console.error("ROLLBACK_SKIPPED backend: restored bundle fingerprint differs; do not restart.");
    return false;
  }
  return true;
}

function restoreSourcesIfOwned(root, backupDir, paths, expectedPost, metadata, owned) {
  helpers.restoreOwnedChanges(root, backupDir, expectedPost, metadata, owned, paths);
  for (const name of paths) {
    const original = owned.original.get(name);
    if (JSON.stringify(fileFingerprint(path.join(root, name))) !== JSON.stringify(original)) {
      console.error(`ROLLBACK_SKIPPED source: ${name} did not restore to its original fingerprint.`);
      return false;
    }
  }
  return true;
}

function runBuild(stage, dependencies = {}) {
  if (dependencies.build) return dependencies.build(stage);
  const env = {
    PATH: process.env.PATH || "/usr/bin:/bin",
    HOME: process.env.HOME || "/tmp",
    NODE_ENV: "production",
  };
  command("npm", ["run", "build"], { cwd: stage, env, inherit: true });
}

async function deployLocked(options, dependencies, gitDir, root) {
  const release = dependencies.release || RELEASE;
  const proof = dependencies.proof || { expectedHashes: release.expectedHashes };
  const privateRoot = path.join(gitDir, "omni-task-hotfix-deploy");
  assertNoSymlinkChain(privateRoot);
  fs.mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
  fs.chmodSync(privateRoot, 0o700);
  const runId = `${Date.now()}-${process.pid}-${crypto.randomUUID()}`;
  const runDir = path.join(privateRoot, runId);
  fs.mkdirSync(runDir, { mode: 0o700 });
  const stage = path.join(runDir, "stage");
  const livePublic = path.join(root, "dist", "public");
  const liveServer = path.join(root, "dist", "index.cjs");
  const patchFile = path.join(runDir, "release.patch");
  const backupDir = path.join(runDir, "backup");
  const publicStage = path.join(stage, "dist", "public");
  const backupPublic = path.join(backupDir, "public");

  validatePm2(root, dependencies);
  checkExpectedSources(root, { ...release, expectedHashes: proof.expectedHashes });
  const snapshot = (dependencies.trackedSnapshot || helpers.trackedSnapshot)(root);
  const deploymentChangedPaths = [
    ...release.paths,
    "dist/index.cjs",
    ...[...snapshot.keys()].filter((name) => name === "dist/public" || name.startsWith("dist/public/")),
  ];
  const publicBefore = publicSnapshot(livePublic);
  const indexPath = path.join(gitDir, "index");
  const indexBefore = helpers.fileHashIfPresent(indexPath);
  const serverBefore = fileIdentityFingerprint(liveServer);
  if (serverBefore.hash === "missing") fail("Live dist/index.cjs is missing");

  if (dependencies.validateGit) dependencies.validateGit(root, { patchFile, release });
  else validateGit(root, patchFile, release, dependencies.git);
  makeStage(root, stage, snapshot);
  command("git", ["apply", "--check", "--whitespace=nowarn", patchFile], { cwd: stage });
  if (dependencies.applyStagePatch) dependencies.applyStagePatch(stage, patchFile);
  else command("git", ["apply", "--whitespace=nowarn", patchFile], { cwd: stage });
  const stageHashes = new Map();
  for (const name of release.paths) {
    const fingerprint = fileFingerprint(path.join(stage, name));
    if (fingerprint.hash === "missing") fail(`Reviewed patch did not produce required source: ${name}`);
    stageHashes.set(name, fingerprint.hash);
  }
  runBuild(stage, dependencies);
  if (!fs.existsSync(path.join(stage, "dist", "index.cjs"))) fail("Full build did not produce dist/index.cjs");
  if (!fs.existsSync(path.join(publicStage, "index.html"))) fail("Full build did not produce dist/public/index.html");
  preserveOldAssets(livePublic, publicStage);
  fixPublicPermissions(livePublic, publicStage);
  const builtServer = fileFingerprint(path.join(stage, "dist", "index.cjs"));
  const builtPublic = publicSnapshot(publicStage);
  const newIndex = fs.readFileSync(path.join(publicStage, "index.html"), "utf8");
  const serverMetadata = {
    mode: serverBefore.mode,
    uid: serverBefore.uid,
    gid: serverBefore.gid,
  };
  preserveServerMetadata(path.join(stage, "dist", "index.cjs"), serverMetadata);

  compareSnapshots(snapshot, (dependencies.trackedSnapshot || helpers.trackedSnapshot)(root), "during staged build");
  if (JSON.stringify(fileIdentityFingerprint(liveServer)) !== JSON.stringify(serverBefore)) {
    fail("Live dist/index.cjs changed during staged build");
  }
  if (helpers.fileHashIfPresent(indexPath) !== indexBefore) fail("Git index changed during staged build");
  if (publicSnapshot(livePublic) !== publicBefore) fail("Live public directory changed during staged build");
  if (!dependencies.exchange) helpers.probeAtomicExchange(runDir, livePublic, publicStage);
  basicHealth(options.healthUrl, dependencies);

  console.log(`PREPARE_OK release=${release.commit} tree=${release.tree} head=${release.base} paths=${release.paths.length} stage=${stage}`);
  if (!options.apply) {
    console.log("PREPARE_ONLY live source, public assets, server bundle, and PM2 process were not changed.");
    return { prepared: true, stage, runDir };
  }

  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(backupDir, "server"), { recursive: true, mode: 0o700 });
  const sourceMetadata = saveSources(root, backupDir, release.paths);
  const sourceOriginal = new Map(release.paths.map((name) => [name, fileFingerprint(path.join(root, name))]));
  const backupServer = path.join(backupDir, "server", "index.cjs");
  fs.copyFileSync(liveServer, backupServer);
  fs.chmodSync(backupServer, 0o600);
  if (fileFingerprint(backupServer).hash !== serverBefore.hash) fail("Private backend backup verification failed");

  // Final independent gates immediately before touching live files.
  validatePm2(root, dependencies);
  checkExpectedSources(root, { ...release, expectedHashes: proof.expectedHashes });
  compareSnapshots(snapshot, (dependencies.trackedSnapshot || helpers.trackedSnapshot)(root), "immediately before cutover");
  if (publicSnapshot(livePublic) !== publicBefore) fail("Live public directory changed before cutover");
  if (JSON.stringify(fileIdentityFingerprint(liveServer)) !== JSON.stringify(serverBefore)) fail("Live backend changed before cutover");
  if (helpers.fileHashIfPresent(indexPath) !== indexBefore) fail("Git index changed before cutover");
  // Re-run the no-3way context check on current live source immediately before cutover.
  command("git", ["apply", "--check", "--whitespace=nowarn", patchFile], { cwd: root });

  let publicExchanged = false;
  let serverReplaced = false;
  let sourcePatched = false;
  let sourceOwned;
  let serverDeployed;
  let restartAttempted = false;
  try {
    basicHealth(options.healthUrl, dependencies);
    compareSnapshots(snapshot, (dependencies.trackedSnapshot || helpers.trackedSnapshot)(root), "after health preflight");
    if (publicSnapshot(livePublic) !== publicBefore) fail("Live public directory changed after health preflight");
    sourcePatched = true;
    command("git", ["apply", "--whitespace=nowarn", patchFile], { cwd: root });
    const sourcePost = new Map();
    for (const name of release.paths) {
      const current = fileFingerprint(path.join(root, name));
      if (current.hash !== stageHashes.get(name)) fail(`Live patched source differs from reviewed stage: ${name}`);
      sourcePost.set(name, current.hash);
    }
    const patchFingerprints = new Map(release.paths.map((name) => [name, helpers.pathFingerprint(path.join(root, name))]));
    helpers.restorePatchedMetadata(root, Object.fromEntries(sourcePost), sourceMetadata, patchFingerprints, patchFingerprints, release.paths);
    sourceOwned = new Map(release.paths.map((name) => [name, fileFingerprint(path.join(root, name))]));
    const afterPatch = (dependencies.trackedSnapshot || helpers.trackedSnapshot)(root);
    const changed = new Set(release.paths);
    for (const [name, fingerprint] of afterPatch) {
      if (!snapshot.has(name) && !changed.has(name)) fail(`New tracked path appeared during targeted patch: ${name}`);
      if (snapshot.has(name) && !changed.has(name)
        && JSON.stringify(snapshot.get(name)) !== JSON.stringify(fingerprint)) {
        fail(`Concurrent or unexpected change to ${name} during targeted source patch`);
      }
    }
    if (helpers.fileHashIfPresent(indexPath) !== indexBefore) fail("Git index changed while applying targeted patch");
    if (publicSnapshot(livePublic) !== publicBefore) fail("Live public directory changed before public cutover");

    try {
      atomicExchange(publicStage, livePublic, dependencies);
      publicExchanged = true;
    } catch (error) {
      if (publicSnapshot(livePublic) === builtPublic && publicSnapshot(publicStage) === publicBefore) publicExchanged = true;
      throw error;
    }
    if (publicSnapshot(livePublic) !== builtPublic) fail("Public exchange did not install the staged tree");
    if (publicSnapshot(publicStage) !== publicBefore) fail("Old public tree changed during exchange");

    const newServerFile = path.join(stage, "dist", "index.cjs");
    const serverTemp = path.join(root, "dist", `.index.cjs.omni-${process.pid}-${crypto.randomUUID()}`);
    if (fs.statSync(path.dirname(liveServer)).dev !== fs.statSync(path.dirname(serverTemp)).dev) {
      fail("Backend atomic rename would cross filesystems");
    }
    assertNoSymlinkChain(serverTemp);
    fs.copyFileSync(newServerFile, serverTemp);
    applyFileMetadata(serverTemp, serverMetadata);
    if ((fs.statSync(serverTemp).mode & 0o444) === 0) fail(`Replacement server bundle is not readable: ${serverTemp}`);
    const replacementIdentity = fileIdentityFingerprint(serverTemp);
    if (JSON.stringify(fileIdentityFingerprint(liveServer)) !== JSON.stringify(serverBefore)) {
      unlinkIfIdentityMatches(serverTemp, replacementIdentity);
      fail("Backend dist/index.cjs changed immediately before guarded install");
    }
    try {
      atomicExchange(serverTemp, liveServer, dependencies);
    } catch (error) {
      const currentServer = fileIdentityFingerprint(liveServer);
      const displaced = fileIdentityFingerprint(serverTemp);
      if (JSON.stringify(currentServer) === JSON.stringify(replacementIdentity)
        && JSON.stringify(displaced) === JSON.stringify(serverBefore)) {
        serverReplaced = true;
        serverDeployed = currentServer;
      }
      throw error;
    }
    serverReplaced = true;
    serverDeployed = fileIdentityFingerprint(liveServer);
    if (serverDeployed.hash !== builtServer.hash) fail("Installed backend differs from the staged full build");
    const displacedServer = fileIdentityFingerprint(serverTemp);
    if (JSON.stringify(displacedServer) !== JSON.stringify(serverBefore)) {
      if (JSON.stringify(fileIdentityFingerprint(liveServer)) === JSON.stringify(serverDeployed)
        && JSON.stringify(fileIdentityFingerprint(serverTemp)) === JSON.stringify(displacedServer)) {
        atomicExchange(serverTemp, liveServer, dependencies);
        if (JSON.stringify(fileIdentityFingerprint(liveServer)) === JSON.stringify(displacedServer)
          && JSON.stringify(fileIdentityFingerprint(serverTemp)) === JSON.stringify(serverDeployed)) {
          unlinkIfIdentityMatches(serverTemp, serverDeployed);
        }
      }
      fail("Backend changed concurrently during guarded install; external bundle was preserved");
    }
    if (JSON.stringify(serverDeployed) !== JSON.stringify(replacementIdentity)) {
      fail("Staged backend identity changed during guarded install");
    }
    unlinkIfIdentityMatches(serverTemp, serverBefore);
    if (publicSnapshot(publicStage) !== publicBefore) fail("Old public tree changed before backup retention");
    fs.renameSync(publicStage, backupPublic);
    if (publicSnapshot(backupPublic) !== publicBefore) fail("Private old-public backup verification failed");
    if (helpers.fileHashIfPresent(indexPath) !== indexBefore) fail("Git index changed during cutover");
    validatePm2(root, dependencies);
    const beforeRestartSnapshot = (dependencies.trackedSnapshot || helpers.trackedSnapshot)(root);
    compareUntouchedSnapshot(snapshot, beforeRestartSnapshot, deploymentChangedPaths, "before PM2 restart");
    for (const name of release.paths) {
      if (fileFingerprint(path.join(root, name)).hash !== stageHashes.get(name)) {
        fail(`Targeted source changed before PM2 restart: ${name}`);
      }
    }
    restartAttempted = true;
    restartPm2(dependencies);
    await waitForPostRestartHealth(options, newIndex, dependencies);
    if (publicSnapshot(livePublic) !== builtPublic) fail("Live public tree changed during post-restart health verification");
    if (JSON.stringify(fileIdentityFingerprint(liveServer)) !== JSON.stringify(serverDeployed)) {
      fail("Live backend changed during post-restart health verification");
    }
    const finalSnapshot = (dependencies.trackedSnapshot || helpers.trackedSnapshot)(root);
    compareUntouchedSnapshot(snapshot, finalSnapshot, deploymentChangedPaths, "during post-restart verification");
    for (const name of release.paths) {
      const current = fileFingerprint(path.join(root, name));
      if (current.hash !== sourceOwned.get(name).hash) fail(`Targeted source changed after patch: ${name}`);
    }
    console.log(`APPLY_OK release=${release.commit} process=${PROCESS_NAME} backup=${backupDir}`);
    return { prepared: true, applied: true, stage, runDir, backupDir };
  } catch (error) {
    let publicRestored = !publicExchanged;
    let serverRestored = !serverReplaced;
    let sourcesRestored = !sourcePatched;
    if (publicExchanged) {
      try {
        const oldPublic = fs.existsSync(backupPublic) ? backupPublic : publicStage;
        if (publicSnapshot(livePublic) === builtPublic && publicSnapshot(oldPublic) === publicBefore) {
          atomicExchange(oldPublic, livePublic, dependencies);
          publicRestored = publicSnapshot(livePublic) === publicBefore;
        } else {
          console.error("ROLLBACK_SKIPPED public: a tree no longer matches the deployment fingerprints; preserving external changes.");
        }
      } catch (rollbackError) {
        console.error(`ROLLBACK_FAILED public: ${redact(rollbackError.message)}`);
      }
    }
    if (serverReplaced) {
      try {
        serverRestored = restoreServerIfOwned(liveServer, backupServer, serverBefore, serverDeployed, dependencies);
      } catch (rollbackError) {
        serverRestored = false;
        console.error(`ROLLBACK_FAILED backend: ${redact(rollbackError.message)}`);
      }
    }
    if (sourcePatched) {
      try {
        sourcesRestored = restoreSourcesIfOwned(
          root,
          backupDir,
          release.paths,
          Object.fromEntries(stageHashes),
          sourceMetadata,
          {
            get: (name) => sourceOwned?.get(name)
              || (fileFingerprint(path.join(root, name)).hash === stageHashes.get(name)
                ? fileFingerprint(path.join(root, name))
                : undefined),
            original: sourceOriginal,
          },
        );
      } catch (rollbackError) {
        sourcesRestored = false;
        console.error(`ROLLBACK_FAILED source: ${redact(rollbackError.message)}`);
      }
    }
    if (publicRestored && serverRestored && sourcesRestored && restartAttempted) {
      try {
        validatePm2(root, dependencies, true);
        restartPm2(dependencies);
        basicHealth(options.healthUrl, dependencies);
        console.error("ROLLBACK_OK original public/source/backend restored; prior PM2 process restarted.");
      } catch (rollbackError) {
        console.error(`ROLLBACK_RESTART_FAILED ${redact(rollbackError.message)}`);
      }
    } else if (publicRestored && serverRestored && sourcesRestored) {
      console.error("ROLLBACK_OK original public/source/backend restored; PM2 was not restarted because the new restart was not attempted.");
    } else {
      console.error("ROLLBACK_INCOMPLETE; PM2 was not restarted. Preserve all backups and reconcile external changes manually.");
    }
    throw error;
  }
}

async function deploy(options, dependencies = {}) {
  if (options.apply && !options.allowRestart) fail("--apply requires explicit --allow-restart acknowledgement");
  const root = path.resolve(options.root);
  assertNoSymlinkChain(root);
  if (!fs.statSync(root).isDirectory()) fail(`Deployment root is not a directory: ${root}`);
  const gitDir = command("git", ["rev-parse", "--absolute-git-dir"], { cwd: root }).trim();
  assertNoSymlinkChain(gitDir);
  const lockPath = path.join(gitDir, LOCK_NAME);
  assertNoSymlinkChain(lockPath);
  const lockRecord = {
    pid: process.pid,
    uid: typeof process.getuid === "function" ? process.getuid() : null,
    owner: os.userInfo().username,
    invocation: crypto.randomUUID(),
    started: new Date().toISOString(),
  };
  let fd;
  let identity;
  let wroteRecord = false;
  try {
    try { fd = fs.openSync(lockPath, "wx", 0o600); } catch (error) {
      if (error.code === "EEXIST") fail(`Deployment lock exists at ${lockPath}; inspect its owner before proceeding.`);
      throw error;
    }
    identity = fs.fstatSync(fd);
    fs.fchmodSync(fd, 0o600);
    fs.writeFileSync(fd, `${JSON.stringify(lockRecord)}\n`);
    fs.fsyncSync(fd);
    wroteRecord = true;
    fs.closeSync(fd);
    fd = undefined;
    return await deployLocked(options, dependencies, gitDir, root);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (identity) {
      try {
        assertNoSymlinkChain(lockPath);
        const stat = fs.lstatSync(lockPath);
        if (stat.isSymbolicLink() || stat.dev !== identity.dev || stat.ino !== identity.ino) {
          console.error("LOCK_CLEANUP_SKIPPED lock identity changed; inspect manually.");
        } else if (!wroteRecord || JSON.parse(fs.readFileSync(lockPath, "utf8")).invocation === lockRecord.invocation) {
          fs.unlinkSync(lockPath);
        } else console.error("LOCK_CLEANUP_SKIPPED lock invocation changed; inspect manually.");
      } catch (error) {
        if (error.code !== "ENOENT") console.error(`LOCK_CLEANUP_ERROR ${redact(error.message)}`);
      }
    }
  }
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(usage());
    else {
      console.log(`START omni-task deployment mode=${options.apply ? "apply" : "prepare"} root=${options.root}`);
      if (options.apply) console.log("WARNING: PM2 restart may interrupt active calls/sessions.");
      deploy(options).catch((error) => {
        console.error(`DEPLOY_FAILED ${redact(error.message)}`);
        process.exitCode = 1;
      });
    }
  } catch (error) {
    console.error(`DEPLOY_FAILED ${redact(error.message)}\n${usage()}`);
    process.exitCode = 1;
  }
}

module.exports = {
  RELEASE,
  HELPER_SHA256,
  parseArgs,
  validatePm2,
  validateGit,
  publicSnapshot,
  deploy,
};