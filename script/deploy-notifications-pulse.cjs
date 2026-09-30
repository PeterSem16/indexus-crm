#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const RELEASE = {
  base: "b59f6e006cc2073cbb5ae909555c304cf0030903",
  commit: "df54db18a0b6892c31f2838c882bfb050fa6d5c2",
  parent: "cd242676635d64f263367c6b43d61f1c2c489c0d",
  tree: "8441d22db904e47ddb654d51f26c6f59e5982d3e",
  patchSha256: "6ac4923d42affee63822726cb6ac4263d203e63f45f5a5e156d7cfab031a61de",
  paths: [
    "client/src/components/notification-center.tsx",
    "client/src/components/notification-focus.css",
    "client/src/hooks/use-my-open-tasks.ts",
    "client/src/hooks/use-notifications.ts",
    "client/src/lib/task-display.ts",
    "client/src/pages/agent-workspace.tsx",
    "client/src/i18n/translations.ts",
    "script/test-notification-center-browser.cjs",
  ],
  guardPaths: [
    "client/src/components/notification-center.tsx",
    "client/src/components/notification-focus.css",
    "client/src/hooks/use-my-open-tasks.ts",
    "client/src/hooks/use-notifications.ts",
    "client/src/i18n/translations.ts",
    "client/src/lib/task-display.ts",
    "client/src/pages/agent-workspace.tsx",
    "script/test-notification-center-browser.cjs",
    "client/src/lib/scheduled-queue-visible-groups.ts",
  ],
  preHashes: {
    "client/src/components/notification-center.tsx": "a233eee949f415a59ba4933a93bb9882da67b2f11444ab328d12c11567310cdb",
    "client/src/components/notification-focus.css": null,
    "client/src/hooks/use-my-open-tasks.ts": null,
    "client/src/hooks/use-notifications.ts": "501441c273208798cf5b09e5d7bc6d40acd6126d4b982fb8a09a66680a550080",
    "client/src/i18n/translations.ts": "003c1921007d0f8828ec317d75c120aa0466e7a406c29711fd70dc2051cbd6c0",
    "client/src/lib/task-display.ts": null,
    "client/src/pages/agent-workspace.tsx": "ed57fe80173941fe72d8cde0bc65ef09df608fcb1a8462f4ac737c9864c6d227",
    "script/test-notification-center-browser.cjs": null,
    "client/src/lib/scheduled-queue-visible-groups.ts": "6844c6b02695f86a926cec3b41a74168454686499de70675180e0b67a7062d85",
  },
  postHashes: {
    "client/src/components/notification-center.tsx": "803a54659ee79afbb1271eb95225a2e26d0191b2a8be168545e31e4cca5cf8df",
    "client/src/components/notification-focus.css": "95e6597d8bd2c399a9ec7fdd776eeefc12339d8565d9d4d90a6bcc12fd90540e",
    "client/src/hooks/use-my-open-tasks.ts": "6d68f54921fe6b7fc6594a545028b8850f206106b10800b4acc7370ae5c57e83",
    "client/src/hooks/use-notifications.ts": "8447ade1e48b5b255e8058c0ad09dba2a749b0ee84720a4c346e345db65d6105",
    "client/src/i18n/translations.ts": "31fca6722151ebf8a17952642302044c16a4ddde25b9c4a0ea0e4a78bd0c12cb",
    "client/src/lib/task-display.ts": "2d5586a900fb52f4aa5c549e280ece2209e3208d5d9e545c67c82ac71dfdf525",
    "client/src/pages/agent-workspace.tsx": "8e0aa282082aa6e9981576bbae29e853dc237a2e28c00fd9eacca2417feb5ced",
    "script/test-notification-center-browser.cjs": "230355f96ef07fdb425968874c9ae4db3fd49baced82ca6358b3b186b87dfe05",
    "client/src/lib/scheduled-queue-visible-groups.ts": "6844c6b02695f86a926cec3b41a74168454686499de70675180e0b67a7062d85",
  },
};

function fail(message) {
  throw new Error(message);
}

function redact(text) {
  return text.replace(/(https?:\/\/)[^/@\s]+@/gi, "$1[redacted]@")
    .replace(/((?:token|password|secret|authorization)[=:]\s*)[^\s&]+/gi, "$1[redacted]");
}

function sha256File(file) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

function assertNoSymlinkChain(target) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  const parts = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (stat.isSymbolicLink()) fail(`Symlink path component refused: ${current}`);
    if (current !== absolute && !stat.isDirectory()) fail(`Non-directory path component refused: ${current}`);
  }
  return absolute;
}

function pathFingerprint(file) {
  assertNoSymlinkChain(file);
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile()) fail(`Expected regular file while snapshotting: ${file}`);
    return {
      hash: sha256File(file),
      mode: stat.mode & 0o7777,
      uid: stat.uid,
      gid: stat.gid,
    };
  } catch (error) {
    if (error.code === "ENOENT") return { hash: "missing" };
    throw error;
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"],
    maxBuffer: options.maxBuffer || 16 * 1024 * 1024,
    cwd: options.cwd,
    env: options.env || process.env,
  });
  if (result.error) fail(`${command} could not run: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = redact(`${result.stdout || ""}${result.stderr || ""}`.trim());
    fail(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout || "";
}

function runBuffer(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: options.maxBuffer || 16 * 1024 * 1024,
    cwd: options.cwd,
  });
  if (result.error || result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed: ${redact(result.error?.message || result.stderr?.toString().trim() || "unknown error")}`);
  }
  return result.stdout;
}

function parseArgs(args) {
  const options = { apply: false, root: "/var/www/indexus-crm", healthUrl: "http://127.0.0.1:5000/" };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--prepare") options.apply = false;
    else if (arg === "--root" || arg === "--health-url") {
      const value = args[++i];
      if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
      if (arg === "--root") options.root = path.resolve(value);
      else options.healthUrl = value;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }
  if (!options.help) {
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
    "Usage: node script/deploy-notifications-pulse.cjs [--prepare|--apply] [--root PATH] [--health-url URL]",
    "Default is --prepare: verifies, stages and builds without changing live source or assets.",
    "Use --apply only after reviewing the successful prepare report.",
    "Operator protocol: do not manually edit source/assets or run other deployments from lock acquisition through completion. The cooperative lock does not block other tools; concurrent external changes are detected where possible.",
    "On CORPCRM01, preserve terminal output with: node script/deploy-notifications-pulse.cjs --apply >/dev/tty 2>&1",
  ].join("\n");
}

function readManifest() {
  const expectedPaths = [...RELEASE.guardPaths].sort();
  if (JSON.stringify(expectedPaths) !== JSON.stringify(Object.keys(RELEASE.preHashes).sort())
    || JSON.stringify(expectedPaths) !== JSON.stringify(Object.keys(RELEASE.postHashes).sort())) {
    fail("Embedded release proof is incomplete");
  }
  for (const name of RELEASE.guardPaths) {
    const pre = RELEASE.preHashes[name];
    const post = RELEASE.postHashes[name];
    if (pre !== null && !/^[a-f0-9]{64}$/.test(pre)) fail(`Invalid embedded pre-hash for ${name}`);
    if (!/^[a-f0-9]{64}$/.test(post)) fail(`Invalid embedded post-hash for ${name}`);
  }
  return { expectedHashes: RELEASE.preHashes, postHashes: RELEASE.postHashes };
}

function assertHash(file, expected, label) {
  assertNoSymlinkChain(file);
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (expected === "missing" || expected === null) {
    if (stat) fail(`${label} expected ${file} to be absent`);
    return "missing";
  }
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) fail(`Required regular-file ${label} is missing: ${file}`);
  const actual = sha256File(file);
  if (actual !== expected) fail(`${label} hash mismatch for ${file}: expected ${expected}, got ${actual}`);
  return actual;
}

function fileHashIfPresent(file) {
  assertNoSymlinkChain(file);
  try {
    const stat = fs.lstatSync(file);
    if (stat.isFile()) return sha256File(file);
    if (stat.isSymbolicLink()) return `symlink:${fs.readlinkSync(file)}`;
    return "non-file";
  } catch (error) {
    if (error.code === "ENOENT") return "missing";
    throw error;
  }
}

function trackedSnapshot(root) {
  const names = run("git", ["ls-files", "-z"], { cwd: root })
    .split("\0").filter(Boolean);
  const snapshot = new Map();
  for (const name of names) {
    const absoluteFile = path.resolve(root, name);
    const relative = path.relative(root, absoluteFile);
    if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
      fail(`Tracked path escapes deployment root: ${name}`);
    }
    assertNoSymlinkChain(absoluteFile);
    if (!isSafeTrackedSource(name)) {
      snapshot.set(name, { hash: "excluded" });
      continue;
    }
    snapshot.set(name, pathFingerprint(absoluteFile));
  }
  snapshot.set("dist/index.cjs", pathFingerprint(path.join(root, "dist/index.cjs")));
  for (const name of RELEASE.guardPaths) snapshot.set(name, pathFingerprint(path.join(root, name)));
  return snapshot;
}

function guardFingerprintSnapshot(root) {
  const snapshot = new Map();
  for (const name of RELEASE.guardPaths) {
    try {
      snapshot.set(name, pathFingerprint(path.join(root, name)));
    } catch (error) {
      console.error(`SOURCE_FINGERPRINT_UNAVAILABLE ${name}: ${error.message}`);
    }
  }
  return snapshot;
}

function isSafeTrackedSource(name) {
  const normalized = name.replace(/\\/g, "/");
  const base = path.posix.basename(normalized);
  return !/^\.env(?:\.|$)/i.test(base)
    && !/^(?:data|uploads?)(?:\/|$)/i.test(normalized)
    && !/\.(?:gz|tgz|tar|zip|7z|rar|pem|key|p12|pfx|jks|keystore)$/i.test(base)
    && !/(?:^|[._-])(?:secret|credentials?)(?:[._-]|$)/i.test(base);
}

function compareSnapshot(before, after, context) {
  if (before.size !== after.size || [...before.keys()].some((name) => !after.has(name))) {
    fail(`Tracked file set changed ${context}; refusing deployment`);
  }
  for (const [name, hash] of before) {
    if (JSON.stringify(after.get(name)) !== JSON.stringify(hash)) fail(`Concurrent or unexpected change to ${name} ${context}; refusing deployment`);
  }
}

function compareUntouchedSnapshot(before, after, changedPaths, context) {
  const changed = new Set(changedPaths);
  for (const name of after.keys()) {
    if (!before.has(name) && !changed.has(name)) {
      fail(`New tracked path appeared: ${name} ${context}; refusing deployment`);
    }
  }
  for (const [name, hash] of before) {
    if (!changed.has(name) && JSON.stringify(after.get(name)) !== JSON.stringify(hash)) {
      fail(`Concurrent or unexpected change to ${name} ${context}; refusing deployment`);
    }
  }
}

function comparePathMetadata(before, after, changedPaths, context) {
  for (const name of changedPaths) {
    const original = before.get(name);
    const current = after.get(name);
    if (original?.hash !== "missing"
      && (original.mode !== current?.mode || original.uid !== current?.uid || original.gid !== current?.gid)) {
      fail(`Mode/ownership changed for ${name} ${context}; refusing deployment`);
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
      ...(stat.isFile() ? { hash: sha256File(target) } : {}),
    };
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(target).sort()) {
        visit(path.join(target, name), path.posix.join(relative, name));
      }
    } else if (!stat.isFile()) {
      fail(`Unsupported filesystem object in public tree: ${target}`);
    }
  }
  visit(directory, ".");
  return JSON.stringify(entries);
}

function requirePublicSnapshot(directory, expected, context) {
  if (publicSnapshot(directory) !== expected) fail(`Public directory identity/content changed ${context}: ${directory}`);
}

function copyPath(source, destination) {
  const stat = fs.lstatSync(source);
  assertNoSymlinkChain(destination);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (stat.isSymbolicLink()) {
    fail(`Refusing to stage tracked symlink: ${source}`);
  } else if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true, mode: stat.mode & 0o777 });
    for (const entry of fs.readdirSync(source)) copyPath(path.join(source, entry), path.join(destination, entry));
    fs.chmodSync(destination, stat.mode & 0o777);
  } else if (stat.isFile()) {
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, stat.mode & 0o777);
  } else {
    fail(`Unsupported tracked filesystem object: ${source}`);
  }
}

function makeStage(root, stage, snapshot) {
  assertNoSymlinkChain(stage);
  fs.mkdirSync(stage, { recursive: true, mode: 0o700 });
  const tracked = Array.from(snapshot.keys()).filter((name) =>
    name !== "dist/index.cjs");
  for (const name of tracked) {
    const source = path.join(root, name);
    if (["missing", "excluded"].includes(snapshot.get(name)?.hash)) continue;
    copyPath(source, path.join(stage, name));
  }
  const modules = path.join(root, "node_modules");
  if (!fs.existsSync(modules)) fail("Live node_modules is absent; deployment must not install dependencies");
  fs.symlinkSync(modules, path.join(stage, "node_modules"), "dir");
}

function validateGit(root, release, dependencies = {}) {
  const git = (args, buffer = false) => dependencies.git
    ? dependencies.git(args, buffer)
    : buffer ? runBuffer("git", args, { cwd: root }) : run("git", args, { cwd: root });
  const head = git(["rev-parse", "HEAD"]).trim();
  if (head !== RELEASE.base) fail(`Unexpected live HEAD ${head}; required exact base ${RELEASE.base}`);
  git(["fetch", "--no-tags", "origin", RELEASE.commit]);
  const tree = git(["show", "-s", "--format=%T", RELEASE.commit]).trim();
  if (tree !== RELEASE.tree) fail(`Reviewed release tree mismatch: expected ${RELEASE.tree}, got ${tree}`);
  const parent = git(["rev-parse", `${RELEASE.commit}^`]).trim();
  if (parent !== RELEASE.parent) fail(`Reviewed release parent mismatch: expected ${RELEASE.parent}, got ${parent}`);
  const changed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", RELEASE.commit])
    .trim().split("\n").filter(Boolean).sort();
  if (JSON.stringify(changed) !== JSON.stringify([...RELEASE.paths].sort())) {
    fail(`Reviewed commit changed unexpected paths: ${changed.join(", ")}`);
  }
  const patch = git(["diff", "--binary", `${RELEASE.commit}^`, RELEASE.commit, "--", ...RELEASE.paths], true);
  const patchHash = crypto.createHash("sha256").update(patch).digest("hex");
  if (patchHash !== RELEASE.patchSha256) fail(`Reviewed release patch SHA-256 mismatch: expected ${RELEASE.patchSha256}, got ${patchHash}`);
  fs.writeFileSync(release.patchFile, patch, { mode: 0o600 });
  fs.chmodSync(release.patchFile, 0o600);
  if (!patch.length) fail("Reviewed release patch is empty");
}

function applyPatch(stage, patchFile) {
  run("git", ["apply", "--whitespace=nowarn", patchFile], { cwd: stage });
}

function preserveOldAssets(livePublic, stagePublic) {
  assertNoSymlinkChain(livePublic);
  assertNoSymlinkChain(stagePublic);
  const oldAssets = path.join(livePublic, "assets");
  const newAssets = path.join(stagePublic, "assets");
  if (!fs.existsSync(oldAssets)) return;
  fs.mkdirSync(newAssets, { recursive: true });
  function visit(from, to) {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const source = path.join(from, entry.name);
      const dest = path.join(to, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        visit(source, dest);
      } else if (entry.isFile() && !fs.existsSync(dest)) {
        fs.copyFileSync(source, dest);
        fs.chmodSync(dest, fs.statSync(source).mode & 0o777);
      }
    }
  }
  visit(oldAssets, newAssets);
}

function servingReference(livePublic, relative, isDir) {
  const exact = path.join(livePublic, relative);
  try {
    assertNoSymlinkChain(exact);
    return fs.statSync(exact);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (isDir) {
    let parent = path.dirname(exact);
    while (parent.startsWith(livePublic)) {
      try {
        assertNoSymlinkChain(parent);
        return fs.statSync(parent);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (parent === livePublic) break;
      parent = path.dirname(parent);
    }
  } else {
    const index = path.join(livePublic, "index.html");
    assertNoSymlinkChain(index);
    return fs.statSync(index);
  }
  return fs.statSync(livePublic);
}

function applyServingPermissions(livePublic, stagePublic) {
  assertNoSymlinkChain(livePublic);
  assertNoSymlinkChain(stagePublic);
  function fix(target) {
    assertNoSymlinkChain(target);
    const stat = fs.lstatSync(target);
    const isDir = stat.isDirectory();
    const relative = path.relative(stagePublic, target);
    const referenceStat = servingReference(livePublic, relative, isDir);
    const mode = referenceStat.mode & 0o777;
    if (isDir) for (const child of fs.readdirSync(target)) fix(path.join(target, child));
    fs.chmodSync(target, mode);
    try {
      fs.chownSync(target, referenceStat.uid, referenceStat.gid);
    } catch (error) {
      const current = fs.statSync(target);
      if (error.code !== "EPERM" || current.uid !== referenceStat.uid || current.gid !== referenceStat.gid) throw error;
    }
  }
  fix(stagePublic);
}

function verifyReadabilityAgainstLive(livePublic, stagePublic) {
  assertNoSymlinkChain(livePublic);
  assertNoSymlinkChain(stagePublic);
  const check = (target) => {
    assertNoSymlinkChain(target);
    const stat = fs.statSync(target);
    const reference = servingReference(livePublic, path.relative(stagePublic, target), stat.isDirectory());
    if (stat.uid !== reference.uid || stat.gid !== reference.gid) fail(`Staged public ownership differs from live public: ${target}`);
    if ((stat.mode & 0o444) !== (reference.mode & 0o444)) fail(`Staged public read permissions differ from live public: ${target}`);
    if (stat.isDirectory()) for (const name of fs.readdirSync(target)) check(path.join(target, name));
  };
  check(stagePublic);
}

function frontendBuild(stage) {
  const bin = path.join(stage, "node_modules", ".bin", "vite");
  run(bin, ["build"], {
    cwd: stage,
    capture: false,
    env: {
      PATH: process.env.PATH || "/usr/bin:/bin",
      HOME: process.env.HOME || "/tmp",
      NODE_ENV: "production",
    },
  });
}

function currentIndexBundleNames(index) {
  const names = [...index.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map((match) => match[1]);
  return [...new Set(names.filter((name) => name.startsWith("/assets/")))];
}

function curlStatus(url) {
  return run("curl", ["--silent", "--show-error", "--output", "/dev/null", "--write-out", "%{http_code}", "--max-time", "20", url]).trim();
}

function verifyHttp(healthUrl, expectedIndex, transport = {}) {
  const getStatus = transport.status || curlStatus;
  const getBody = transport.body || ((url) => run("curl", ["--fail", "--silent", "--show-error", "--max-time", "20", url]));
  const status = getStatus(healthUrl);
  if (status !== "200") fail(`Health URL returned HTTP ${status}; expected 200`);
  const html = getBody(healthUrl);
  const bundles = currentIndexBundleNames(expectedIndex);
  if (!bundles.length) fail("Built index contains no hashed JavaScript/CSS asset references");
  if (!bundles.every((asset) => html.includes(asset))) fail("HTTP response does not serve the new frontend index entry assets");
  for (const asset of bundles) {
    const assetStatus = getStatus(new URL(asset, healthUrl).toString());
    if (assetStatus !== "200") fail(`New hashed entry asset returned HTTP ${assetStatus}: ${asset}`);
  }
}

function healthPreflight(healthUrl, getStatus = curlStatus) {
  const status = getStatus(healthUrl);
  if (status !== "200") fail(`Local health preflight returned HTTP ${status}; live files remain untouched`);
}

function copyRegularFile(source, destination) {
  assertNoSymlinkChain(source);
  assertNoSymlinkChain(destination);
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  fs.copyFileSync(source, destination);
  fs.chmodSync(destination, 0o600);
}

function ensurePrivateDir(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function atomicExchange(first, second) {
  assertNoSymlinkChain(first);
  assertNoSymlinkChain(second);
  const python = [
    "import ctypes, os, sys",
    "libc=ctypes.CDLL(None, use_errno=True)",
    "fn=getattr(libc, 'renameat2', None)",
    "if fn is None: raise SystemExit('renameat2 unavailable; refusing non-atomic cutover')",
    "fn.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]",
    "fn.restype=ctypes.c_int",
    "rc=fn(-100,os.fsencode(sys.argv[1]),-100,os.fsencode(sys.argv[2]),2)",
    "if rc: raise OSError(ctypes.get_errno(), os.strerror(ctypes.get_errno()))",
  ].join("\n");
  run("python3", ["-c", python, first, second]);
}

function probeAtomicExchange(runDir, livePublic, stagePublic) {
  if (!fs.statSync(livePublic).isDirectory() || !fs.statSync(stagePublic).isDirectory()) {
    fail("Live and staged public directories must both exist before cutover");
  }
  if (fs.statSync(livePublic).dev !== fs.statSync(stagePublic).dev) {
    fail("Private staging and live public directories are on different filesystems; atomic exchange is unavailable");
  }
  const first = path.join(runDir, ".exchange-probe-a");
  const second = path.join(runDir, ".exchange-probe-b");
  fs.mkdirSync(first, { mode: 0o700 });
  fs.mkdirSync(second, { mode: 0o700 });
  try {
    atomicExchange(first, second);
    atomicExchange(first, second);
  } finally {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  }
}

function backupSources(root, backupDir) {
  const metadata = {};
  for (const name of RELEASE.paths) {
    const source = path.join(root, name);
    if (!fs.existsSync(source)) {
      metadata[name] = null;
      continue;
    }
    const stat = fs.statSync(source);
    metadata[name] = { mode: stat.mode & 0o7777, uid: stat.uid, gid: stat.gid };
    copyRegularFile(source, path.join(backupDir, "source", name));
  }
  return metadata;
}

function applyFileMetadata(file, metadata) {
  assertNoSymlinkChain(file);
  let stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`Expected regular source file for metadata update: ${file}`);
  if (metadata) {
    try {
      fs.chownSync(file, metadata.uid, metadata.gid);
    } catch (error) {
      stat = fs.lstatSync(file);
      if (error.code !== "EPERM" || stat.uid !== metadata.uid || stat.gid !== metadata.gid) throw error;
    }
    fs.chmodSync(file, metadata.mode);
    stat = fs.lstatSync(file);
    if (stat.uid !== metadata.uid || stat.gid !== metadata.gid || (stat.mode & 0o7777) !== metadata.mode) {
      fail(`Could not restore source mode/ownership for ${file}`);
    }
    return;
  }
  // New source files are not served assets; use a conventional readable source mode without changing ownership.
  const uid = stat.uid;
  const gid = stat.gid;
  fs.chmodSync(file, 0o644);
  stat = fs.lstatSync(file);
  if (stat.uid !== uid || stat.gid !== gid) fail(`chmod unexpectedly changed source ownership for ${file}`);
}

function restorePatchedMetadata(root, expectedPost, originalMetadata, patchSnapshot, ownedSnapshot, paths = RELEASE.paths) {
  for (const name of paths) {
    const file = path.join(root, name);
    assertHash(file, expectedPost[name], "before restoring patched source metadata");
    const current = pathFingerprint(file);
    const patchFingerprint = patchSnapshot.get(name);
    if (!patchFingerprint || JSON.stringify(current) !== JSON.stringify(patchFingerprint)) {
      fail(`Source changed after targeted patch for ${name}; refusing metadata restoration`);
    }
    applyFileMetadata(file, originalMetadata[name]);
    assertHash(file, expectedPost[name], "after restoring patched source metadata");
    ownedSnapshot.set(name, pathFingerprint(file));
  }
}

function restoreOwnedChanges(root, backupDir, expectedPost, originalMetadata, ownedSnapshot, paths = RELEASE.paths) {
  for (const name of paths) {
    const live = path.join(root, name);
    try {
      const current = pathFingerprint(live);
      const owned = ownedSnapshot?.get(name);
      if (current.hash !== expectedPost[name] || !owned
        || current.mode !== owned.mode || current.uid !== owned.uid || current.gid !== owned.gid) {
        console.error(`SOURCE_RESTORE_SKIPPED ${name}: no longer matches this invocation's post-patch fingerprint.`);
        continue;
      }
    } catch (error) {
      console.error(`SOURCE_RESTORE_SKIPPED ${name}: ${error.message}`);
      continue;
    }
    if (originalMetadata[name] === null) {
      fs.unlinkSync(live);
      continue;
    }
    copyRegularFile(path.join(backupDir, "source", name), live);
    applyFileMetadata(live, originalMetadata[name]);
  }
}

async function deployLocked(options, dependencies, gitDir) {
  const root = options.root;
  const privateRoot = path.join(gitDir, "notifications-pulse-deploy");
  assertNoSymlinkChain(privateRoot);
  ensurePrivateDir(privateRoot);
  const runId = `${Date.now()}-${process.pid}`;
  const runDir = path.join(privateRoot, runId);
  ensurePrivateDir(runDir);
  const stage = path.join(runDir, "stage");
  const publicStage = path.join(stage, "dist", "public");
  const livePublic = path.join(root, "dist", "public");
  const liveServer = path.join(root, "dist", "index.cjs");
  assertNoSymlinkChain(stage);
  assertNoSymlinkChain(publicStage);
  assertNoSymlinkChain(livePublic);
  const beforePublicSnapshot = publicSnapshot(livePublic);

  const proof = dependencies.proof || readManifest();
  const indexPath = path.join(gitDir, "index");
  const indexHashBefore = fileHashIfPresent(indexPath);
  const patchFile = path.join(runDir, "release.patch");
  if (dependencies.validateGit) dependencies.validateGit(root, { patchFile });
  else validateGit(root, { patchFile });
  const snapshot = trackedSnapshot(root);
  for (const name of RELEASE.guardPaths) assertHash(path.join(root, name), proof.expectedHashes[name], "pre-deploy source");
  const initialServerHash = fileHashIfPresent(liveServer);

  makeStage(root, stage, snapshot);
  if (dependencies.applyStagePatch) dependencies.applyStagePatch(stage, patchFile);
  else applyPatch(stage, patchFile);
  for (const name of RELEASE.guardPaths) {
    assertHash(path.join(stage, name), proof.postHashes[name], "merged stage source");
  }
  const build = dependencies.build || frontendBuild;
  build(stage);
  assertNoSymlinkChain(publicStage);
  if (!fs.existsSync(path.join(publicStage, "index.html"))) fail("Frontend build did not produce dist/public/index.html");
  preserveOldAssets(livePublic, publicStage);
  applyServingPermissions(livePublic, publicStage);
  verifyReadabilityAgainstLive(livePublic, publicStage);
  const newIndex = fs.readFileSync(path.join(publicStage, "index.html"), "utf8");
  const stagedPublicSnapshot = publicSnapshot(publicStage);

  const afterBuild = trackedSnapshot(root);
  compareSnapshot(snapshot, afterBuild, "during staged build");
  if (fileHashIfPresent(liveServer) !== initialServerHash) fail("Backend dist/index.cjs changed; refusing frontend-only deployment");
  if (fileHashIfPresent(indexPath) !== indexHashBefore) fail("Git index changed during staging; refusing deployment");
  if (!dependencies.exchange) probeAtomicExchange(runDir, livePublic, publicStage);
  (dependencies.healthPreflight || healthPreflight)(options.healthUrl);
  console.log(`PREPARE_OK release=${RELEASE.commit} tree=${RELEASE.tree} paths=${RELEASE.paths.length} stage=${stage}`);
  if (!options.apply) {
    console.log("No live source or public assets were changed. Review this report, then rerun with --apply.");
    return { stage, runDir, prepared: true };
  }

  const backupDir = path.join(runDir, "backup");
  ensurePrivateDir(backupDir);
  const originalMetadata = backupSources(root, backupDir);
  for (const name of RELEASE.guardPaths) {
    assertHash(path.join(root, name), proof.expectedHashes[name], "live source before patch");
  }
  compareSnapshot(snapshot, trackedSnapshot(root), "immediately before cutover");
  let exchanged = false;
  let deployedPublicSnapshot;
  let ownedSnapshot;
  try {
    (dependencies.healthPreflight || healthPreflight)(options.healthUrl);
    compareSnapshot(snapshot, trackedSnapshot(root), "after health preflight before targeted source patch");
    requirePublicSnapshot(livePublic, beforePublicSnapshot, "before targeted source patch");
    if (dependencies.applyLivePatch) dependencies.applyLivePatch(root, path.join(runDir, "release.patch"));
    else run("git", ["apply", "--whitespace=nowarn", path.join(runDir, "release.patch")], { cwd: root });
    const patchSnapshot = guardFingerprintSnapshot(root);
    for (const name of RELEASE.guardPaths) assertHash(path.join(root, name), proof.postHashes[name], "live merged source");
    ownedSnapshot = new Map(patchSnapshot);
    restorePatchedMetadata(root, proof.postHashes, originalMetadata, patchSnapshot, ownedSnapshot);
    const afterPatchSnapshot = trackedSnapshot(root);
    compareUntouchedSnapshot(snapshot, afterPatchSnapshot, RELEASE.guardPaths, "during targeted source patch");
    comparePathMetadata(snapshot, afterPatchSnapshot, RELEASE.guardPaths, "during targeted source patch");
    if (fileHashIfPresent(indexPath) !== indexHashBefore) fail("Git index changed while applying the targeted release patch");
    if (fileHashIfPresent(liveServer) !== initialServerHash) fail("Backend dist/index.cjs changed during source patch");
    requirePublicSnapshot(livePublic, beforePublicSnapshot, "before public cutover");
    requirePublicSnapshot(publicStage, stagedPublicSnapshot, "before public cutover");
    if (dependencies.exchange) dependencies.exchange(publicStage, livePublic);
    else atomicExchange(publicStage, livePublic);
    exchanged = true;
    deployedPublicSnapshot = stagedPublicSnapshot;
    requirePublicSnapshot(livePublic, deployedPublicSnapshot, "immediately after exchange");
    requirePublicSnapshot(publicStage, beforePublicSnapshot, "after exchange (old public tree)");
    const checkHealth = dependencies.health || verifyHttp;
    await checkHealth(options.healthUrl, newIndex);
    if (fileHashIfPresent(liveServer) !== initialServerHash) fail("Backend dist/index.cjs changed during frontend cutover");
    if (fileHashIfPresent(indexPath) !== indexHashBefore) fail("Git index changed during frontend cutover");
    requirePublicSnapshot(livePublic, deployedPublicSnapshot, "during post-cutover verification");
    const finalSnapshot = trackedSnapshot(root);
    compareUntouchedSnapshot(snapshot, finalSnapshot, RELEASE.guardPaths, "during frontend cutover");
    comparePathMetadata(snapshot, finalSnapshot, RELEASE.guardPaths, "during frontend cutover");
    for (const name of RELEASE.guardPaths) {
      if (finalSnapshot.get(name)?.hash !== proof.postHashes[name]) fail(`Targeted live source changed after deployment: ${name}`);
    }
    console.log(`APPLY_OK release=${RELEASE.commit} health=${options.healthUrl} backup=${backupDir}`);
    return { stage, runDir, backupDir, prepared: true, applied: true };
  } catch (error) {
    if (exchanged) {
      try {
        if (publicSnapshot(livePublic) !== deployedPublicSnapshot) {
          console.error("ROLLBACK_SKIPPED public assets: live public tree changed after cutover; preserve external change and reconcile manually.");
        } else if (publicSnapshot(publicStage) !== beforePublicSnapshot) {
          console.error("ROLLBACK_SKIPPED public assets: previous public tree changed; preserve both trees for manual reconciliation.");
        } else if (dependencies.exchange) {
          dependencies.exchange(publicStage, livePublic);
        } else {
          atomicExchange(publicStage, livePublic);
        }
      } catch (rollbackError) {
        console.error(`ROLLBACK_SKIPPED public assets: ${rollbackError.message}; preserve current trees and reconcile manually.`);
      }
    }
    if (ownedSnapshot) {
      restoreOwnedChanges(root, backupDir, proof.postHashes, originalMetadata, ownedSnapshot);
      console.error(`GUARDED_SOURCE_RESTORE considered only files still matching this invocation's merged hashes; private backup retained at ${backupDir}`);
    } else {
      console.error(`SOURCE_RESTORE_NOT_NEEDED targeted source patch had not completed; private backup retained at ${backupDir}`);
    }
    throw error;
  }
}

async function deploy(options, dependencies = {}) {
  const root = path.resolve(options.root);
  assertNoSymlinkChain(root);
  if (!fs.statSync(root).isDirectory()) fail(`Deployment root is not a directory: ${root}`);
  const gitDir = run("git", ["rev-parse", "--absolute-git-dir"], { cwd: root }).trim();
  assertNoSymlinkChain(gitDir);
  const lockPath = path.join(gitDir, "notifications-pulse-deploy.lock");
  assertNoSymlinkChain(lockPath);
  const record = {
    pid: process.pid,
    uid: typeof process.getuid === "function" ? process.getuid() : null,
    owner: os.userInfo().username,
    invocation: crypto.randomUUID(),
    started: new Date().toISOString(),
  };
  const serialized = `${JSON.stringify(record)}\n`;
  let fd;
  let identity;
  let recordWritten = false;
  try {
    try {
      fd = fs.openSync(lockPath, "wx", 0o600);
    } catch (error) {
      if (error.code === "EEXIST") fail(`Deployment lock exists at ${lockPath}; inspect its owner/invocation and do not remove it while active.`);
      throw error;
    }
    identity = fs.fstatSync(fd);
    fs.fchmodSync(fd, 0o600);
    fs.writeFileSync(fd, serialized);
    fs.fsyncSync(fd);
    recordWritten = true;
    fs.closeSync(fd);
    fd = undefined;
    return await deployLocked({ ...options, root }, dependencies, gitDir);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (identity) {
      try {
        assertNoSymlinkChain(lockPath);
        const stat = fs.lstatSync(lockPath);
        if (stat.isSymbolicLink() || stat.dev !== identity.dev || stat.ino !== identity.ino) {
          console.error(`LOCK_CLEANUP_SKIPPED ${lockPath}: lock identity changed; inspect manually.`);
        } else if (!recordWritten || JSON.parse(fs.readFileSync(lockPath, "utf8")).invocation === record.invocation) {
          fs.unlinkSync(lockPath);
        } else {
          console.error(`LOCK_CLEANUP_SKIPPED ${lockPath}: lock identity changed; inspect manually.`);
        }
      } catch (error) {
        if (error.code !== "ENOENT") console.error(`LOCK_CLEANUP_ERROR ${lockPath}: ${error.message}`);
      }
    }
  }
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(usage());
    else {
      console.log(`START notifications-pulse deployment mode=${options.apply ? "apply" : "prepare"} root=${options.root}`);
      console.log("Operator protocol: no manual source/assets edits or other deployments until completion. The lock coordinates this script only; it cannot prevent external writers.");
      deploy(options).catch((error) => {
        console.error(`DEPLOY_FAILED ${error.message}`);
        process.exitCode = 1;
      });
    }
  } catch (error) {
    console.error(`DEPLOY_FAILED ${error.message}\n${usage()}`);
    process.exitCode = 1;
  }
}

module.exports = {
  RELEASE,
  parseArgs,
  readManifest,
  validateGit,
  runBuffer,
  pathFingerprint,
  restorePatchedMetadata,
  restoreOwnedChanges,
  fileHashIfPresent,
  trackedSnapshot,
  compareSnapshot,
  atomicExchange,
  probeAtomicExchange,
  verifyHttp,
  healthPreflight,
  deploy,
};