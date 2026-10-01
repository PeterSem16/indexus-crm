#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const BASE = "b59f6e006cc2073cbb5ae909555c304cf0030903";
const TODAY_BASE = "1060a63c3bc3f3613b81c6d5c16c78bb879d3275";
const TODAY_RELEASE = "a4ab0fe5852faca4e146c313269e9762169dbe25";
const MANIFEST_PATH = "script/today-tasks-manifest.json";
const DEFAULT_ROOT = "/var/www/indexus-crm";
const DEPLOY_NAME = "today-tasks-deploy";
const EXCLUDED_DIRS = new Set(["node_modules", ".git", "data", "uploads", "upload", "private-task-attachments"]);
const ROOT_SOURCE_DIRS = ["client", "server", "shared", "script", "scripts"];
const EXTRA_SOURCE_FILES = [".gitignore", "docs/releases/2026-10-01-completed.md"];
const ALLOWED_EXISTING_TASK_FILES = new Set([
  "client/src/components/nexus/nexus-signal-tasks.css",
  "script/test-omni-task-design-browser.cjs",
  "server/lib/task-source-entity.test.ts",
  "server/lib/task-source-entity.ts",
]);
const ROOT_BUILD_FILES = /^(?:package(?:-lock)?\.json|tsconfig(?:\.[^/]+)?\.json|vite\.config\.[^/]+|tailwind\.config\.[^/]+|postcss\.config\.[^/]+|components\.json)$/;

function fail(message) { throw new Error(message); }
function digest(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
function sha256File(file) { return digest(fs.readFileSync(file)); }
function validHash(value) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
function isSafeSourceFile(name) {
  const base = path.posix.basename(name.replace(/\\/g, "/"));
  return !/^\.env(?:\.|$)/i.test(base)
    && !/\.(?:gz|tgz|tar|zip|7z|rar|pem|key|p12|pfx|jks|keystore)$/i.test(base)
    && !/(?:^|[._-])(?:secret|credentials?)(?:[._-]|$)/i.test(base);
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd, encoding: options.binary ? null : "utf8",
    stdio: ["ignore", "pipe", "pipe"], maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
    env: options.env || process.env,
  });
  if (result.error) fail(`${command} could not run: ${result.error.message}`);
  if (result.status !== 0) {
    const details = options.suppressOutput ? "" : String(result.stderr || "").trim();
    fail(`${command} ${args.join(" ")} failed${details ? `: ${details}` : ""}`);
  }
  return result.stdout;
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
function safeRelative(name) {
  if (typeof name !== "string" || !name || name.includes("\\") || name.startsWith("/")
    || name.split("/").some((part) => !part || part === "." || part === "..")) {
    fail(`Unsafe manifest path: ${String(name)}`);
  }
  if (!EXTRA_SOURCE_FILES.includes(name)
    && !ROOT_SOURCE_DIRS.some((prefix) => name.startsWith(`${prefix}/`))) fail(`Manifest path outside allowed source roots: ${name}`);
  if (name.split("/").some((part) => EXCLUDED_DIRS.has(part) || /^\.env(?:\.|$)/i.test(part))) {
    fail(`Sensitive or generated manifest path refused: ${name}`);
  }
  if (!isSafeSourceFile(name)) fail(`Sensitive or archived manifest file refused: ${name}`);
  return name;
}
function parseArgs(args) {
  const options = { root: DEFAULT_ROOT, apply: false, release: null, healthUrl: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--prepare") options.apply = false;
    else if (["--root", "--release", "--health-url"].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
      if (arg === "--root") options.root = path.resolve(value);
      else if (arg === "--release") options.release = value;
      else options.healthUrl = value;
    } else if (arg === "--help" || arg === "-h") options.help = true;
    else fail(`Unknown option: ${arg}`);
  }
  if (!options.help && (!options.release || !/^[a-f0-9]{40}$/.test(options.release))) {
    fail("A full 40-character --release commit is required");
  }
  if (options.healthUrl) validateLocalUrl(options.healthUrl);
  return options;
}
function validateLocalUrl(value) {
  let url;
  try { url = new URL(value); } catch { fail("--health-url must be a local HTTP(S) URL"); }
  if (!["http:", "https:"].includes(url.protocol)
    || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
    || url.username || url.password) fail("--health-url must use loopback without embedded credentials");
  return url.toString();
}
function usage() {
  return [
    "Usage: node .local/releases/2026-10-01-corp-stage/script/deploy-today-tasks.cjs --release FULL40SHA [--prepare|--apply] [--root PATH] [--health-url LOOPBACK_URL]",
    "Default mode is prepare/build only; --apply takes a private custom-format pg_dump, performs guarded source+dist cutover, and restarts verified PM2 indexus-crm.",
    "Apply retains the private workspace (including prior dist) and DB backup; both paths are printed. DB dump is outside public with mode 0600; rollback never restores/removes database data.",
    "Never use git pull/reset/clean/stash, npm install, or db:push during this deployment.",
  ].join("\n");
}

function loadManifest(root, release, git = (args, binary) => run("git", args, { cwd: root, binary })) {
  const raw = git(["show", `${release}:${MANIFEST_PATH}`], true);
  let manifest;
  try { manifest = JSON.parse(raw.toString("utf8")); } catch { fail("Release manifest is missing or invalid JSON"); }
  if (!manifest || manifest.base !== BASE
    || manifest.todayBase !== TODAY_BASE || manifest.todayRelease !== TODAY_RELEASE
    || !Array.isArray(manifest.files) || !Array.isArray(manifest.preservedGuards)) {
    fail("Manifest has invalid structure or unexpected base commit");
  }
  if (manifest.files.length !== 85) fail(`Manifest must enumerate the exact 85 reviewed task-change files (got ${manifest.files.length})`);
  if (manifest.preservedGuards.length !== 11) fail(`Manifest must contain all 11 preserved production-file guards (got ${manifest.preservedGuards.length})`);
  const names = new Set();
  for (const item of manifest.files) {
    if (!item || typeof item !== "object") fail("Invalid manifest file entry");
    safeRelative(item.path);
    if (names.has(item.path)) fail(`Duplicate manifest path: ${item.path}`);
    names.add(item.path);
    if (item.expectedSha256 !== null && !validHash(item.expectedSha256)) fail(`Invalid expected hash for ${item.path}`);
    if (!validHash(item.sha256) || typeof item.gitBlob !== "string" || !/^[a-f0-9]{40}$/.test(item.gitBlob)) {
      fail(`Invalid payload hashes for ${item.path}`);
    }
    if (item.allowExistingTaskFile !== undefined
      && (item.allowExistingTaskFile !== true || !ALLOWED_EXISTING_TASK_FILES.has(item.path))) {
      fail(`Existing-file permission is not allowed for ${item.path}`);
    }
  }
  const guardNames = new Set();
  for (const guard of manifest.preservedGuards) {
    if (!guard || typeof guard !== "object") fail("Invalid preserved guard entry");
    safeRelative(guard.path);
    if (guardNames.has(guard.path) || !validHash(guard.sha256)) fail(`Invalid/duplicate preserved guard: ${guard.path}`);
    guardNames.add(guard.path);
  }
  return manifest;
}

function gitBlobSha(buffer) {
  return crypto.createHash("sha1").update(`blob ${buffer.length}\0`).update(buffer).digest("hex");
}
function verifyManifestPayloads(root, release, manifest, git) {
  const payloads = new Map();
  for (const entry of manifest.files) {
    const bytes = git(["show", `${release}:${entry.path}`], true);
    if (digest(bytes) !== entry.sha256) fail(`Release payload SHA-256 mismatch: ${entry.path}`);
    if (gitBlobSha(bytes) !== entry.gitBlob) fail(`Release payload git blob mismatch: ${entry.path}`);
    payloads.set(entry.path, bytes);
  }
  const payloadNames = new Set(manifest.files.map((entry) => entry.path));
  for (const guard of manifest.preservedGuards) {
    if (payloadNames.has(guard.path)) continue;
    const bytes = git(["show", `${release}:${guard.path}`], true);
    if (digest(bytes) !== guard.sha256) fail(`Compatibility release does not preserve guarded production file: ${guard.path}`);
  }
  return payloads;
}
function gitInfo(root) {
  const top = run("git", ["rev-parse", "--show-toplevel"], { cwd: root }).trim();
  if (path.resolve(top) !== path.resolve(root)) fail(`Deployment root is not the exact git worktree root: ${top}`);
  const gitDirText = run("git", ["rev-parse", "--git-common-dir"], { cwd: root }).trim();
  const gitDir = path.resolve(root, gitDirText);
  assertNoSymlinkChain(gitDir);
  const head = run("git", ["rev-parse", "HEAD"], { cwd: root }).trim();
  if (head !== BASE) fail(`Unexpected live HEAD ${head}; required exact base ${BASE}`);
  return { gitDir, head };
}
function ensurePinnedRelease(root, release) {
  try {
    run("git", ["cat-file", "-e", `${release}^{commit}`], { cwd: root, suppressOutput: true });
    return;
  } catch { /* fetch the exact object below, never a moving branch */ }
  let remote;
  try { remote = run("git", ["remote", "get-url", "origin"], { cwd: root, suppressOutput: true }).trim(); } catch {
    fail("Pinned release commit is unavailable locally and origin could not be checked");
  }
  if (!/^https:\/\//i.test(remote)) fail("Pinned commit is unavailable; refusing a non-HTTPS fetch (SSH is not allowed)");
  run("git", ["fetch", "--no-tags", "origin", release], { cwd: root, suppressOutput: true });
  run("git", ["cat-file", "-e", `${release}^{commit}`], { cwd: root, suppressOutput: true });
}
function validateReleaseDelta(root, manifest, git = (args) => run("git", args, { cwd: root })) {
  if (manifest.todayBase !== TODAY_BASE || manifest.todayRelease !== TODAY_RELEASE) {
    fail("Manifest review-base/release SHA does not match the pinned today-task release");
  }
  const output = git(["diff", "--name-only", "-z", manifest.todayBase, manifest.todayRelease]);
  const changed = output.split("\0").filter(Boolean).sort();
  const expected = manifest.files.map((entry) => entry.path).sort();
  if (new Set(expected).size !== expected.length
    || JSON.stringify(changed) !== JSON.stringify(expected)) {
    fail("Reviewed today-task delta includes paths outside the exact manifest payload");
  }
}
function fileState(file) {
  assertNoSymlinkChain(file);
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) fail(`Expected regular file: ${file}`);
    return { hash: sha256File(file), mode: stat.mode & 0o7777, uid: stat.uid, gid: stat.gid };
  } catch (error) {
    if (error.code === "ENOENT") return { hash: "missing" };
    throw error;
  }
}
function snapshotSources(root) {
  const result = new Map();
  function visit(directory, relative) {
    assertNoSymlinkChain(directory);
    const dirStat = fs.lstatSync(directory);
    result.set(relative, {
      kind: "directory", mode: dirStat.mode & 0o7777, uid: dirStat.uid, gid: dirStat.gid,
    });
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const abs = path.join(root, rel);
      if (EXCLUDED_DIRS.has(entry.name) || /^\.env(?:\.|$)/i.test(entry.name)) continue;
      const stat = fs.lstatSync(abs);
      if (stat.isSymbolicLink()) fail(`Symlink in source tree refused: ${rel}`);
      if (stat.isDirectory()) visit(abs, rel);
      else if (stat.isFile() && isSafeSourceFile(rel)) result.set(rel, fileState(abs));
      else fail(`Unsupported object in source tree: ${rel}`);
    }
  }
  for (const dir of ROOT_SOURCE_DIRS) {
    const target = path.join(root, dir);
    if (fs.existsSync(target)) visit(target, dir);
  }
  for (const name of fs.readdirSync(root)) {
    if (ROOT_BUILD_FILES.test(name)) result.set(name, fileState(path.join(root, name)));
  }
  for (const name of EXTRA_SOURCE_FILES) {
    let parent = path.posix.dirname(name);
    const ancestors = [];
    while (parent !== ".") { ancestors.unshift(parent); parent = path.posix.dirname(parent); }
    for (const ancestor of ancestors) {
      const absolute = path.join(root, ancestor);
      assertNoSymlinkChain(absolute);
      if (fs.existsSync(absolute)) {
        const stat = fs.lstatSync(absolute);
        if (!stat.isDirectory()) fail(`Expected inventory directory: ${ancestor}`);
        result.set(ancestor, { kind: "directory", mode: stat.mode & 0o7777, uid: stat.uid, gid: stat.gid });
      }
    }
    const state = fileState(path.join(root, name));
    if (state.hash !== "missing") result.set(name, state);
  }
  return result;
}
function snapshotDist(dist) {
  const entries = new Map();
  function visit(target, rel) {
    assertNoSymlinkChain(target);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) fail(`Symlink in live dist refused: ${target}`);
    entries.set(rel || ".", {
      kind: stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "other",
      hash: stat.isFile() ? sha256File(target) : undefined,
      mode: stat.mode & 0o777, uid: stat.uid, gid: stat.gid, dev: stat.dev, ino: stat.ino,
    });
    if (stat.isDirectory()) for (const name of fs.readdirSync(target).sort()) visit(path.join(target, name), rel ? `${rel}/${name}` : name);
    else if (!stat.isFile()) fail(`Unsupported object in dist: ${target}`);
  }
  visit(dist, "");
  return entries;
}
function sameSnapshot(a, b, label) {
  if (a.size !== b.size) fail(`Concurrent source/dist inventory change ${label}`);
  for (const [key, value] of a) if (JSON.stringify(value) !== JSON.stringify(b.get(key))) fail(`Concurrent change to ${key} ${label}`);
}
function verifyPreconditions(root, manifest, baseline = snapshotSources(root)) {
  const guards = new Map(manifest.preservedGuards.map((g) => [g.path, g.sha256]));
  for (const item of manifest.files) {
    const current = fileState(path.join(root, item.path));
    const expected = item.expectedSha256;
    if (current.hash === "missing") {
      if (expected !== null) fail(`Required existing file is missing: ${item.path}`);
    } else if (expected !== null) {
      if (current.hash !== expected) fail(`Pre-deploy source hash mismatch: ${item.path}`);
    } else if (!item.allowExistingTaskFile || !ALLOWED_EXISTING_TASK_FILES.has(item.path)) {
      fail(`Expected new source file to be absent (or match its reviewed task-only permission): ${item.path}`);
    } else if (baseline.get(item.path)?.hash !== current.hash) {
      fail(`Allowed existing task-only file changed after its inventory snapshot: ${item.path}`);
    }
  }
  for (const [name, hash] of guards) {
    const current = fileState(path.join(root, name));
    if (current.hash !== hash) fail(`Preserved production guard hash mismatch: ${name}`);
  }
}
function cloneFile(source, destination, state) {
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o755 });
  fs.copyFileSync(source, destination);
  fs.chmodSync(destination, state.mode & 0o777);
}
function copySourceTree(root, stage, sourceSnapshot) {
  for (const [name, state] of sourceSnapshot) {
    if (state.kind === "directory") {
      const destination = path.join(stage, name);
      fs.mkdirSync(destination, { recursive: true, mode: state.mode & 0o777 });
      fs.chmodSync(destination, state.mode & 0o777);
      continue;
    }
    if (state.hash === "missing") continue;
    const source = path.join(root, name);
    const target = path.join(stage, name);
    assertNoSymlinkChain(source);
    cloneFile(source, target, state);
  }
  const modules = path.join(root, "node_modules");
  let modulesTarget = modules;
  const modulesStat = fs.lstatSync(modules);
  if (modulesStat.isSymbolicLink()) {
    modulesTarget = fs.realpathSync(modules);
    assertNoSymlinkChain(modulesTarget);
  } else assertNoSymlinkChain(modules);
  if (!fs.statSync(modulesTarget).isDirectory()) fail("Live node_modules is not a directory");
  fs.symlinkSync(modulesTarget, path.join(stage, "node_modules"), "dir");
}
function overlayStage(stage, manifest, payloads, sourceSnapshot) {
  for (const item of manifest.files) {
    const target = path.join(stage, item.path);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
    fs.writeFileSync(target, payloads.get(item.path), { mode: sourceSnapshot.get(item.path)?.mode & 0o777 || 0o644 });
  }
}
function build(stage) {
  const env = {
    PATH: process.env.PATH || "/usr/bin:/bin",
    HOME: process.env.HOME || os.tmpdir(),
    NODE_ENV: "production",
    CI: "true",
  };
  run("npm", ["run", "build", "--ignore-scripts"], { cwd: stage, env, suppressOutput: false });
}
function preserveOldAssets(livePublic, stagedPublic) {
  const from = path.join(livePublic, "assets");
  const to = path.join(stagedPublic, "assets");
  if (!fs.existsSync(from)) return;
  assertNoSymlinkChain(from);
  fs.mkdirSync(to, { recursive: true, mode: 0o755 });
  function walk(source, destination) {
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      const oldPath = path.join(source, entry.name);
      const newPath = path.join(destination, entry.name);
      const stat = fs.lstatSync(oldPath);
      if (stat.isSymbolicLink()) fail(`Symlink in existing hashed assets refused: ${oldPath}`);
      if (stat.isDirectory()) {
        if (!fs.existsSync(newPath)) fs.mkdirSync(newPath, { recursive: true, mode: stat.mode & 0o777 });
        else if (!fs.statSync(newPath).isDirectory()) continue;
        walk(oldPath, newPath);
      } else if (stat.isFile() && !fs.existsSync(newPath)) {
        fs.copyFileSync(oldPath, newPath);
        fs.chmodSync(newPath, stat.mode & 0o777);
      }
    }
  }
  walk(from, to);
}
function distReference(liveDist, relative, directory) {
  let candidate = path.join(liveDist, relative);
  while (true) {
    try {
      const stat = fs.statSync(candidate);
      if (!directory || stat.isDirectory()) return stat;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (!directory) return fs.statSync(path.join(liveDist, "public", "index.html"));
    if (candidate === liveDist) fail("Live dist directory reference is unavailable");
    candidate = path.dirname(candidate);
  }
}
function applyDistPermissions(liveDist, stagedDist) {
  function visit(target, rel) {
    const stat = fs.lstatSync(target);
    const ref = distReference(liveDist, rel, stat.isDirectory());
    for (const name of stat.isDirectory() ? fs.readdirSync(target) : []) visit(path.join(target, name), rel ? `${rel}/${name}` : name);
    fs.chmodSync(target, ref.mode & 0o777);
    try { fs.chownSync(target, ref.uid, ref.gid); } catch (error) {
      const now = fs.statSync(target);
      if (error.code !== "EPERM" || now.uid !== ref.uid || now.gid !== ref.gid) throw error;
    }
  }
  visit(stagedDist, "");
}
function verifyDistPermissions(liveDist, stagedDist) {
  function visit(target, rel) {
    assertNoSymlinkChain(target);
    const stat = fs.lstatSync(target);
    const reference = distReference(liveDist, rel, stat.isDirectory());
    if (stat.uid !== reference.uid || stat.gid !== reference.gid
      || (stat.mode & 0o777) !== (reference.mode & 0o777)) {
      fail(`Built dist ownership/mode is not readable like the live dist: ${target}`);
    }
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(target)) visit(path.join(target, name), rel ? `${rel}/${name}` : name);
    }
  }
  visit(stagedDist, "");
}
function assertBuiltIndex(stageDist) {
  const index = path.join(stageDist, "public", "index.html");
  assertNoSymlinkChain(index);
  if (!fs.statSync(index).isFile()) fail("Build did not produce dist/public/index.html");
  const html = fs.readFileSync(index, "utf8");
  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
    .map((m) => m[1]).filter((ref) => ref.startsWith("/assets/"));
  if (!refs.some((ref) => /\.js(?:[?#]|$)/.test(ref))) fail("Built index has no hashed JavaScript entry asset reference");
  for (const ref of refs) {
    const asset = path.join(stageDist, "public", ref.slice(1));
    assertNoSymlinkChain(asset);
    if (!fs.existsSync(asset) || !fs.statSync(asset).isFile()) fail(`Built index references missing asset: ${ref}`);
  }
  return html;
}
function healthUrl(options, appInfo) {
  if (options.healthUrl) return options.healthUrl;
  return `http://127.0.0.1:${appInfo.port || 5000}/`;
}
function privateTaskAttachmentDir(root, dataRoot = null) {
  // Match server/config/storage-paths.ts without reading .env or emitting PM2 env.
  const selectedDataRoot = dataRoot
    || (fs.existsSync(path.join(root, "data")) ? path.join(root, "data") : path.join(root, "uploads"));
  const absoluteDataRoot = path.isAbsolute(selectedDataRoot) ? selectedDataRoot : path.resolve(root, selectedDataRoot);
  const target = path.resolve(path.dirname(absoluteDataRoot), "private-task-attachments");
  const publicTree = path.resolve(root, "dist", "public");
  if (target === publicTree || target.startsWith(`${publicTree}${path.sep}`)) {
    fail("Private task-attachment storage resolves inside the public dist tree");
  }
  assertNoSymlinkChain(target);
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail("Private task-attachment path exists but is not a real directory");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return target;
}
function pm2Home() {
  return path.resolve(process.env.PM2_HOME || path.join(os.homedir(), ".pm2"));
}
function assertPm2Daemon() {
  const home = pm2Home();
  assertNoSymlinkChain(home);
  const pidFile = path.join(home, "pm2.pid");
  assertNoSymlinkChain(pidFile);
  let pid;
  try { pid = Number(fs.readFileSync(pidFile, "utf8").trim()); } catch {
    fail("Existing PM2 daemon could not be verified; refusing to invoke PM2");
  }
  if (!Number.isInteger(pid) || pid <= 1) fail("Existing PM2 daemon PID is invalid; refusing to invoke PM2");
  try { process.kill(pid, 0); } catch { fail("Existing PM2 daemon is not running; refusing to spawn another daemon"); }
  let command;
  try { command = fs.readFileSync(`/proc/${pid}/cmdline`).toString("utf8").replace(/\0/g, " "); } catch {
    fail("Existing PM2 daemon process could not be verified");
  }
  if (!/(?:pm2|Daemon\.js|God\.js|God Daemon)/i.test(command)) {
    fail("PM2 PID file does not identify a PM2 daemon; refusing to use that daemon socket");
  }
  return { home, pid };
}
function pm2AppInfo(root) {
  const daemon = assertPm2Daemon();
  let apps;
  try { apps = JSON.parse(run("pm2", ["jlist"], { cwd: root, suppressOutput: true })); } catch {
    fail("Existing PM2 daemon could not return its process list");
  }
  const after = assertPm2Daemon();
  if (after.pid !== daemon.pid || after.home !== daemon.home) fail("PM2 daemon identity changed during validation");
  if (!Array.isArray(apps)) fail("PM2 process list is malformed");
  const app = apps.find((entry) => entry.name === "indexus-crm");
  let env = app?.pm2_env || {};
  const safe = {
    name: app?.name,
    status: env.status,
    cwd: env.pm_cwd,
    execPath: env.pm_exec_path,
    port: Number(env.PORT ?? env.env?.PORT),
    dataRoot: typeof (env.DATA_ROOT ?? env.env?.DATA_ROOT) === "string" ? (env.DATA_ROOT ?? env.env?.DATA_ROOT) : null,
    databaseUrl: typeof (env.DATABASE_URL ?? env.env?.DATABASE_URL) === "string" ? (env.DATABASE_URL ?? env.env?.DATABASE_URL) : null,
  };
  for (const entry of apps) if (entry && typeof entry === "object") entry.pm2_env = undefined;
  apps.length = 0;
  env = null;
  const expectedScript = path.resolve(root, "dist/index.cjs");
  if (safe.name !== "indexus-crm" || safe.status !== "online"
    || path.resolve(safe.cwd || "") !== path.resolve(root)
    || path.resolve(safe.execPath || "") !== expectedScript) {
    fail("PM2 indexus-crm must be online with pm_cwd and pm_exec_path matching this deployment root");
  }
  if (safe.port && (!Number.isInteger(safe.port) || safe.port < 1 || safe.port > 65535)) fail("PM2 application PORT is invalid");
  return safe;
}
function readDatabaseUrl(root, appInfo) {
  if (appInfo.databaseUrl) return appInfo.databaseUrl;
  const envFile = path.join(root, ".env");
  assertNoSymlinkChain(envFile);
  let contents;
  try { contents = fs.readFileSync(envFile, "utf8"); } catch (error) {
    if (error.code === "ENOENT") fail("Production DATABASE_URL is unavailable from PM2 and .env");
    throw error;
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[1];
    if (value.startsWith('"')) {
      try { value = JSON.parse(value); } catch { fail("Could not safely parse DATABASE_URL from .env"); }
    } else if (value.startsWith("'")) {
      if (!value.endsWith("'")) fail("Could not safely parse DATABASE_URL from .env");
      value = value.slice(1, -1);
    } else value = value.replace(/\s+#.*$/, "").trim();
    if (value) return value;
  }
  fail("Production DATABASE_URL is unavailable from PM2 and .env");
}
function postgresEnvironment(databaseUrl) {
  let url;
  try { url = new URL(databaseUrl); } catch { fail("Production DATABASE_URL is invalid; database backup was not attempted"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname || url.pathname === "/") {
    fail("Production DATABASE_URL is not a supported PostgreSQL URL");
  }
  const env = {
    PATH: process.env.PATH || "/usr/bin:/bin",
    HOME: process.env.HOME || os.tmpdir(),
    PGHOST: decodeURIComponent(url.hostname.replace(/^\[|\]$/g, "")),
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
  };
  const password = decodeURIComponent(url.password);
  if (password) env.PGPASSWORD = password;
  const allowedOptions = {
    sslmode: "PGSSLMODE", sslcert: "PGSSLCERT", sslkey: "PGSSLKEY",
    sslrootcert: "PGSSLROOTCERT", application_name: "PGAPPNAME", connect_timeout: "PGCONNECT_TIMEOUT",
  };
  for (const [key, name] of Object.entries(allowedOptions)) {
    const value = url.searchParams.get(key);
    if (value) env[name] = value;
  }
  return env;
}
function backupProductionDatabase(root, databaseUrl, gitDir) {
  const backupDir = path.join(gitDir, ".indexus-tasks-db-backups");
  assertNoSymlinkChain(backupDir);
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(backupDir, 0o700);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(backupDir, `indexus-crm-before-today-tasks-${stamp}-${process.pid}.dump`);
  const env = postgresEnvironment(databaseUrl);
  let fd;
  try {
    fd = fs.openSync(file, "wx", 0o600);
    const result = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--no-privileges"], {
      cwd: root, env, encoding: null, stdio: ["ignore", fd, "ignore"], maxBuffer: 1024 * 1024,
    });
    if (result.error || result.status !== 0) fail("pg_dump failed");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.chmodSync(file, 0o600);
    const descriptor = fs.openSync(file, "r");
    const header = Buffer.alloc(5);
    fs.readSync(descriptor, header, 0, 5, 0);
    fs.closeSync(descriptor);
    if (header.toString("ascii") !== "PGDMP") fail("Database backup output failed custom-format validation");
    return file;
  } catch {
    if (fd !== null && fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* already closed */ }
    }
    try { fs.unlinkSync(file); } catch { /* incomplete backup cleanup only */ }
    fail("Production database backup failed; live source and dist were not changed (details suppressed)");
  }
}
function curlStatus(url) {
  return run("curl", ["--silent", "--show-error", "--output", "/dev/null", "--write-out", "%{http_code}", "--max-time", "20", url]).trim();
}
function checkHealth(url, html) {
  const status = curlStatus(url);
  if (status !== "200") fail(`Local health URL returned HTTP ${status}, expected 200`);
  const body = run("curl", ["--fail", "--silent", "--show-error", "--max-time", "20", url]);
  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
    .map((m) => m[1]).filter((ref) => ref.startsWith("/assets/"));
  if (!refs.length || !refs.every((ref) => body.includes(ref))) fail("HTTP response does not serve the newly built frontend index references");
  for (const ref of refs) if (curlStatus(new URL(ref, url).toString()) !== "200") fail(`Built hashed asset is not served: ${ref}`);
}
function pm2Restart(root) {
  const before = assertPm2Daemon();
  run("pm2", ["restart", "indexus-crm"], { suppressOutput: true });
  const after = assertPm2Daemon();
  if (before.pid !== after.pid || before.home !== after.home) fail("PM2 daemon identity changed during restart");
  pm2AppInfo(root);
}
function atomicExchange(first, second) {
  const code = [
    "import ctypes, os, sys",
    "libc=ctypes.CDLL(None,use_errno=True)",
    "fn=getattr(libc,'renameat2',None)",
    "if fn is None: raise SystemExit('renameat2 unavailable')",
    "fn.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]",
    "fn.restype=ctypes.c_int",
    "rc=fn(-100,os.fsencode(sys.argv[1]),-100,os.fsencode(sys.argv[2]),2)",
    "if rc: raise OSError(ctypes.get_errno(),os.strerror(ctypes.get_errno()))",
  ].join("\n");
  run("python3", ["-c", code, first, second]);
}
function lockAcquire(file) {
  assertNoSymlinkChain(file);
  const token = `${process.pid}:${crypto.randomUUID()}`;
  let fd;
  try { fd = fs.openSync(file, "wx", 0o600); } catch (error) {
    if (error.code === "EEXIST") fail(`Deployment lock exists: ${file}`);
    throw error;
  }
  fs.writeFileSync(fd, `${JSON.stringify({ token, pid: process.pid })}\n`);
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  return token;
}
function lockRelease(file, token) {
  try {
    const owner = JSON.parse(fs.readFileSync(file, "utf8"));
    if (owner.token === token) fs.unlinkSync(file);
  } catch { /* don't remove a lock that cannot be proven to be ours */ }
}
function backupState(source, backup, state) {
  if (state.hash === "missing") return null;
  fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 });
  fs.copyFileSync(source, backup);
  fs.chmodSync(backup, 0o600);
  return { mode: state.mode, uid: state.uid, gid: state.gid };
}
function writePayload(target, bytes, previous) {
  assertNoSymlinkChain(target);
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
  assertNoSymlinkChain(target);
  const tmp = `${target}.deploy-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(tmp, bytes, { mode: previous?.mode || 0o644, flag: "wx" });
    if (!previous) fs.chmodSync(tmp, 0o644);
    if (previous) {
      try { fs.chownSync(tmp, previous.uid, previous.gid); } catch (error) {
        const stat = fs.statSync(tmp);
        if (error.code !== "EPERM" || stat.uid !== previous.uid || stat.gid !== previous.gid) throw error;
      }
      fs.chmodSync(tmp, previous.mode);
    }
    fs.renameSync(tmp, target);
  } finally {
    try { fs.unlinkSync(tmp); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}
function restoreSources(root, entries, owned) {
  for (const [name, before] of entries) {
    const target = path.join(root, name);
    try {
      const current = fileState(target);
      if (!owned.has(name) || current.hash !== owned.get(name)) {
        console.error(`SOURCE_RESTORE_SKIPPED ${name}: current file is not owned by this invocation.`);
        continue;
      }
      if (before.hash === "missing") {
        fs.unlinkSync(target);
        let parent = path.dirname(target);
        while (parent !== root && parent.startsWith(`${root}${path.sep}`)) {
          const relative = path.relative(root, parent).split(path.sep).join("/");
          const original = owned.originalInventory?.get(relative) || entries.get(relative);
          if (original?.kind === "directory") break;
          try { fs.rmdirSync(parent); } catch (error) {
            if (error.code === "ENOENT") { parent = path.dirname(parent); continue; }
            if (error.code === "ENOTEMPTY" || error.code === "EEXIST") break;
            throw error;
          }
          parent = path.dirname(parent);
        }
      }
      else {
        const bytes = fs.readFileSync(path.join(owned.backupDir, name));
        writePayload(target, bytes, before);
      }
    } catch (error) { console.error(`SOURCE_RESTORE_SKIPPED ${name}: ${error.message}`); }
  }
}

async function deploy(options, dependencies = {}) {
  const root = assertNoSymlinkChain(options.root);
  if (!fs.statSync(root).isDirectory()) fail(`Deployment root is not a directory: ${root}`);
  const git = dependencies.git || ((args, binary) => run("git", args, { cwd: root, binary }));
  const info = dependencies.gitInfo ? dependencies.gitInfo(root) : gitInfo(root);
  const lockPath = path.join(info.gitDir, `${DEPLOY_NAME}.lock`);
  const token = lockAcquire(lockPath);
  let workDir;
  let databaseBackupPath = null;
  try {
    if (!dependencies.manifest) ensurePinnedRelease(root, options.release);
    const manifest = dependencies.manifest || loadManifest(root, options.release, git);
    if (!dependencies.manifest) validateReleaseDelta(root, manifest, git);
    const sourceBefore = snapshotSources(root);
    const rootMetadata = fs.lstatSync(root);
    verifyPreconditions(root, manifest, sourceBefore);
    const payloads = dependencies.payloads || verifyManifestPayloads(root, options.release, manifest, git);
    const dist = path.join(root, "dist");
    assertNoSymlinkChain(dist);
    if (!fs.statSync(dist).isDirectory()) fail("Live dist directory is missing");
    const distBefore = snapshotDist(dist);
    workDir = dependencies.workDir || fs.mkdtempSync(path.join(info.gitDir, ".indexus-tasks-stage-"));
    fs.chmodSync(workDir, 0o700);
    const stage = path.join(workDir, "source");
    fs.mkdirSync(stage, { mode: 0o700 });
    copySourceTree(root, stage, sourceBefore);
    overlayStage(stage, manifest, payloads, sourceBefore);
    const stageDist = path.join(stage, "dist");
    if (dependencies.build) await dependencies.build(stage);
    else build(stage);
    if (!fs.existsSync(stageDist) || !fs.statSync(stageDist).isDirectory()) fail("Build did not produce a dist directory");
    const indexHtml = assertBuiltIndex(stageDist);
    preserveOldAssets(path.join(dist, "public"), path.join(stageDist, "public"));
    applyDistPermissions(dist, stageDist);
    verifyDistPermissions(dist, stageDist);
    sameSnapshot(sourceBefore, snapshotSources(root), "during staged build");
    sameSnapshot(distBefore, snapshotDist(dist), "during staged build");
    verifyPreconditions(root, manifest, sourceBefore);
    if (!options.apply) {
      return { prepared: true, changed: manifest.files.map((f) => f.path) };
    }

    const appInfo = dependencies.pm2Info || pm2AppInfo(root);
    const url = healthUrl(options, appInfo);
    if ((dependencies.status || curlStatus)(url) !== "200") fail("Local health preflight failed; live files remain untouched");
    const attachmentsDir = (dependencies.privateTaskAttachmentDir || privateTaskAttachmentDir)(
      root, dependencies.dataRoot === undefined ? appInfo.dataRoot : dependencies.dataRoot,
    );
    // Upload middleware creates this directory on first use; never create it preemptively.
    if (!attachmentsDir || path.resolve(attachmentsDir) === path.resolve(path.join(root, "dist", "public"))) {
      fail("Invalid private task-attachment storage path");
    }
    sameSnapshot(sourceBefore, snapshotSources(root), "after health preflight");
    sameSnapshot(distBefore, snapshotDist(dist), "after health preflight");
    verifyPreconditions(root, manifest, sourceBefore);

    const backupDir = path.join(workDir, "backup");
    fs.mkdirSync(path.join(backupDir, "sources"), { recursive: true, mode: 0o700 });
    const beforeFiles = new Map();
    for (const entry of manifest.files) {
      const target = path.join(root, entry.path);
      const before = fileState(target);
      beforeFiles.set(entry.path, before);
      backupState(target, path.join(backupDir, "sources", entry.path), before);
    }
    const databaseUrl = dependencies.databaseUrl || readDatabaseUrl(root, appInfo);
    const databaseBackup = dependencies.backupDatabase
      ? await dependencies.backupDatabase(root, databaseUrl)
      : backupProductionDatabase(root, databaseUrl, info.gitDir);
    databaseBackupPath = databaseBackup;
    // Dumping can take time; repeat source, guard, and dist checks before the first live write.
    sameSnapshot(sourceBefore, snapshotSources(root), "during production database backup");
    sameSnapshot(distBefore, snapshotDist(dist), "during production database backup");
    verifyPreconditions(root, manifest, sourceBefore);
    const owned = new Map();
    owned.backupDir = path.join(backupDir, "sources");
    owned.originalInventory = sourceBefore;
    const expectedSources = new Map(sourceBefore);
    let distExchanged = false;
    let builtDistIdentity = null;
    let oldDistIdentity = null;
    let builtDistSnapshot = null;
    try {
      for (const entry of manifest.files) {
        const target = path.join(root, entry.path);
        if (fileState(target).hash !== beforeFiles.get(entry.path).hash) fail(`Source changed immediately before apply: ${entry.path}`);
        const ancestors = [];
        let parent = path.posix.dirname(entry.path);
        while (parent !== ".") { ancestors.unshift(parent); parent = path.posix.dirname(parent); }
        for (const ancestor of ancestors) {
          if (expectedSources.has(ancestor)) continue;
          const absolute = path.join(root, ancestor);
          assertNoSymlinkChain(absolute);
          if (fs.existsSync(absolute)) fail(`Concurrent directory appeared before payload write: ${ancestor}`);
          const parentName = path.posix.dirname(ancestor);
          const parentState = parentName === "." ? rootMetadata : expectedSources.get(parentName);
          const expectedGid = (parentState.mode & 0o2000) ? parentState.gid : process.getgid();
          fs.mkdirSync(absolute, { mode: 0o755 });
          fs.chmodSync(absolute, 0o755);
          expectedSources.set(ancestor, { kind: "directory", mode: 0o755, uid: process.getuid(), gid: expectedGid });
        }
        const previous = beforeFiles.get(entry.path);
        const parentName = path.posix.dirname(entry.path);
        const parentState = parentName === "." ? rootMetadata : expectedSources.get(parentName);
        const expectedFile = previous.hash === "missing"
          ? { hash: entry.sha256, mode: 0o644, uid: process.getuid(), gid: (parentState.mode & 0o2000) ? parentState.gid : process.getgid() }
          : { ...previous, hash: entry.sha256 };
        writePayload(target, payloads.get(entry.path), previous.hash === "missing" ? null : previous);
        owned.set(entry.path, entry.sha256);
        const written = fileState(target);
        if (JSON.stringify(written) !== JSON.stringify(expectedFile)) fail(`Payload content or metadata changed immediately after write: ${entry.path}`);
        expectedSources.set(entry.path, expectedFile);
        if (dependencies.afterSourceWrite) await dependencies.afterSourceWrite(entry.path, root);
      }
      sameSnapshot(expectedSources, snapshotSources(root), "after source overlay before dist cutover");
      sameSnapshot(distBefore, snapshotDist(dist), "before dist cutover");
      if (fs.statSync(dist).dev !== fs.statSync(stageDist).dev) fail("Private stage and live dist are on different filesystems");
      const builtStat = fs.statSync(stageDist);
      const originalStat = fs.statSync(dist);
      builtDistIdentity = { dev: builtStat.dev, ino: builtStat.ino };
      oldDistIdentity = { dev: originalStat.dev, ino: originalStat.ino };
      builtDistSnapshot = snapshotDist(stageDist);
      (dependencies.exchange || atomicExchange)(dist, stageDist);
      distExchanged = true;
      sameSnapshot(builtDistSnapshot, snapshotDist(dist), "immediately after dist cutover");
      if (dependencies.restart) await dependencies.restart();
      else pm2Restart(root);
      if (dependencies.health) await dependencies.health(url, indexHtml);
      else {
        const deadline = Date.now() + 120000;
        while (true) {
          try { checkHealth(url, indexHtml); break; }
          catch (error) {
            if (Date.now() >= deadline) throw error;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }
      return { applied: true, changed: manifest.files.map((f) => f.path), databaseBackup, workDir };
    } catch (error) {
      // Roll back only exact payload files still bearing this invocation's hash.
      restoreSources(root, beforeFiles, owned);
      if (distExchanged || builtDistIdentity) {
        try {
          const liveIdentity = fs.statSync(dist);
          const previousAtStage = fs.statSync(stageDist);
          const liveIsOurBuild = builtDistIdentity
            && liveIdentity.dev === builtDistIdentity.dev && liveIdentity.ino === builtDistIdentity.ino;
          const stageIsOriginal = oldDistIdentity
            && previousAtStage.dev === oldDistIdentity.dev && previousAtStage.ino === oldDistIdentity.ino;
          let liveContentIsOurs = false;
          if (liveIsOurBuild && builtDistSnapshot) {
            try { sameSnapshot(builtDistSnapshot, snapshotDist(dist), "while deciding dist rollback"); liveContentIsOurs = true; } catch { /* preserve concurrent dist changes */ }
          }
          if (liveIsOurBuild && stageIsOriginal && liveContentIsOurs) {
            (dependencies.exchange || atomicExchange)(dist, stageDist);
          } else console.error("DIST_RESTORE_SKIPPED: live dist identity changed after cutover.");
        } catch (rollbackError) { console.error(`DIST_RESTORE_FAILED: ${rollbackError.message}`); }
      }
      try { if (dependencies.restart) await dependencies.restart(); else pm2Restart(root); } catch (restartError) {
        console.error(`ROLLBACK_RESTART_FAILED: ${restartError.message}`);
      }
      throw error;
    }
  } catch (error) {
    if (options.apply && error && typeof error === "object") {
      if (workDir) error.workDir = workDir;
      if (databaseBackupPath) error.databaseBackup = databaseBackupPath;
    }
    throw error;
  } finally {
    lockRelease(lockPath, token);
    if (workDir && !options.apply && !dependencies.keepWorkDir) fs.rmSync(workDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(usage());
    else deploy(options).then((result) => {
      console.log(result.applied
        ? `Deployment applied and verified. Private production DB backup: ${result.databaseBackup}\nPrivate retained deployment workspace: ${result.workDir}`
        : "Prepare/build completed; live files were not changed.");
      console.log(`Files: ${result.changed.join(", ")}`);
    }).catch((error) => {
      console.error(`DEPLOY_FAILED: ${error.message}`);
      if (error.databaseBackup) console.error(`PRIVATE_DB_BACKUP_RETAINED: ${error.databaseBackup}`);
      if (error.workDir) console.error(`PRIVATE_WORKDIR_RETAINED: ${error.workDir}`);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(`DEPLOY_FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  BASE, TODAY_BASE, TODAY_RELEASE, MANIFEST_PATH, parseArgs, usage, safeRelative, loadManifest,
  validateReleaseDelta, verifyManifestPayloads, snapshotSources, snapshotDist, verifyPreconditions,
  assertNoSymlinkChain, preserveOldAssets,
  assertBuiltIndex, privateTaskAttachmentDir, readDatabaseUrl, postgresEnvironment,
  deploy, fileState, gitBlobSha,
};