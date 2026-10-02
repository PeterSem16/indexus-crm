#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const backup = require("./backup-consolidated-production.cjs");
const ROOT = "/var/www/indexus-crm", HOME = "/home/seman";
const HEAD = "b59f6e006cc2073cbb5ae909555c304cf0030903";
const BASE = "1060a63c3bc3f3613b81c6d5c16c78bb879d3275";
const BACKUP = "/home/seman/indexus-backups/20261002T114842Z";
const SOURCE_FP = "d0e1add5bcf9c38654376b342a543c42dce6924dde325e991a84723d7454aa9d";
const PROCESS = "indexus-crm";
const OMIT = ["data", "uploads", "attached_assets", "runtime", "server/data", "server/uploads",
  "artifacts", "design", "private-task-attachments", "mobile-app"];
const DOCS = new Set(["docs/releases/indexus-consolidation.md"]);
const approvedReleasePath = p => backup.approvedPath(p) || DOCS.has(p);
function sha(s) { return crypto.createHash("sha256").update(s).digest("hex"); }
function command(name, args, opts = {}) {
  const out = execFileSync(name, args, { cwd: opts.cwd, env: opts.env || process.env, encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  return { status: 0, stdout: out || "", stderr: "" };
}
function run(deps, name, args, opts) {
  try { return (deps.command || command)(name, args, opts); }
  catch (e) { return { status: e.status ?? 1, stdout: e.stdout?.toString() || "", stderr: e.stderr?.toString() || "" }; }
}
function must(deps, name, args, opts) {
  const r = run(deps, name, args, opts);
  if (r.status !== undefined && r.status !== 0) {
    const e = new Error(`${name} command failed`);
    e.nativeTool = name; e.nativeStatus = r.status;
    e.nativeStderr = String(r.stderr || "").slice(-8192);
    throw e;
  }
  return r.stdout;
}
function git(root, args, deps) { return must(deps, "git", args, { cwd: root }).trim(); }
function requireTools(root, deps, tools) {
  for (const tool of tools) {
    const r = run(deps, "bash", ["-c", 'command -v "$1" >/dev/null', "indexus-tool-check", tool], { cwd: root });
    if (r.status !== 0) throw new Error(`required deployment tool unavailable: ${tool}`);
  }
}
function privateDir(dir) {
  noSymlinkChain(dir);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700);
  const s = fs.lstatSync(dir);
  if (!s.isDirectory() || s.isSymbolicLink() || (process.getuid && s.uid !== process.getuid()) || (s.mode & 0o077))
    throw new Error("unsafe private operator directory");
}
function noSymlinkChain(target) {
  const full = path.resolve(target);
  let current = path.parse(full).root;
  for (const part of full.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error("unsafe symlink in deployment path");
  }
}
function writePrivate(file, data) { fs.writeFileSync(file, data, { mode: 0o600, flag: "w" }); fs.chmodSync(file, 0o600); }
function recordFailure(file, phase, error) {
  try {
    if (fs.lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error("unsafe diagnostic symlink");
    writePrivate(file, JSON.stringify({ phase, message: error.message,
      tool: error.nativeTool || "", status: error.nativeStatus ?? null,
      stderr: error.nativeStderr || "", healthFailure: error.healthFailure || "", timestamp: new Date().toISOString() }, null, 2));
    error.privateFailureLog = file;
  } catch { error.privateFailureLogWriteFailed = true; }
  error.failurePhase = phase;
}
function parseArgs(args) {
  const o = { prepare: false, apply: false, rollback: false, maintenance: false };
  if (!args.length || args.includes("--help") || args.includes("-h")) return { help: true };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--prepare") o.prepare = true;
    else if (a === "--apply") o.apply = true;
    else if (a === "--rollback") o.rollback = true;
    else if (a === "--maintenance-window") o.maintenance = true;
    else if (["--commit", "--manifest", "--backup", "--health-path"].includes(a) && args[i + 1])
      o[a === "--health-path" ? "health_path" : a.slice(2)] = args[++i];
    else throw new Error("invalid deployment arguments");
  }
  if ([o.prepare, o.apply, o.rollback].filter(Boolean).length !== 1) throw new Error("choose exactly one operation");
  if (o.prepare || o.apply) {
    if (!/^[a-f0-9]{40}$/.test(o.commit || "") || !o.manifest) throw new Error("--commit and --manifest are required");
  }
  if (o.prepare && !o.backup) o.backup = BACKUP;
  if (o.apply && (!o.maintenance || !o.health_path)) throw new Error("--apply requires --maintenance-window and --health-path");
  if (o.rollback && (!o.maintenance || !o.health_path)) throw new Error("--rollback requires --maintenance-window and --health-path");
  if (o.health_path && o.health_path !== "/api/users") throw new Error("health path must be the existing protected /api/users endpoint");
  return o;
}
function help() {
  return "No operation by default. --prepare --commit <40hex> --manifest <pinned.json> [--backup <verified-dir>]\n"
    + "--apply --commit <40hex> --manifest <pinned.json> --maintenance-window --health-path /api/users\n"
    + "--rollback --maintenance-window --health-path /api/users. /api/users must return JSON 401 Unauthorized and / must return 200; this is not a database health claim.";
}
function readManifest(file, commit) {
  noSymlinkChain(file);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || (process.getuid && stat.uid !== process.getuid()) || (stat.mode & 0o077)) throw new Error("unsafe pinned manifest");
  const m = JSON.parse(fs.readFileSync(file, "utf8"));
   if (m.base !== BASE || m.commit !== commit || !/^[a-f0-9]{40}$/.test(m.tree || "")
     || (m.parent !== undefined && !/^[a-f0-9]{40}$/.test(m.parent))
     || !Array.isArray(m.paths)
    || !m.paths.length || m.paths.some(p => !approvedReleasePath(p)) || new Set(m.paths).size !== m.paths.length) throw new Error("pinned reviewed manifest mismatch");
  return { base: m.base, parent: m.parent || BASE, commit: m.commit, tree: m.tree, paths: [...m.paths].sort() };
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
}
function pmConfigHash(row) {
  const e = row.pm2_env || {}, env = e.env || {}, direct = {};
  for (const [key, value] of Object.entries(e)) if (/^[A-Z][A-Z0-9_]*$/.test(key) && !(key in env)) direct[key] = value;
  return sha(JSON.stringify(stable({ env, direct })));
}
async function distFingerprint(root) {
  const rows = [];
  async function visit(dir, rel = "") {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const name = rel ? `${rel}/${e.name}` : e.name, file = path.join(dir, e.name);
      if (e.isDirectory()) await visit(file, name);
      else rows.push(`${name}\0${e.isSymbolicLink() ? sha(fs.readlinkSync(file)) : await backup.hashFile(file)}\n`);
    }
  }
  await visit(path.join(root, "dist"));
  return sha(rows.join(""));
}
async function verifyBackup(dir, deps = {}, liveRoot) {
  noSymlinkChain(dir);
  backup.secureDir ? backup.secureDir(dir) : (() => {
    const s = fs.lstatSync(dir);
    if (!s.isDirectory() || s.isSymbolicLink() || (process.getuid && s.uid !== process.getuid()) || (s.mode & 0o077))
      throw new Error("unsafe backup directory");
  })();
  for (const f of ["SUCCESS", "SHA256SUMS", "application.tar.gz", "source-fingerprint.json", "pm2-jlist.json", "runtime-fingerprint.json"])
    if (!fs.existsSync(path.join(dir, f))) throw new Error("verified backup incomplete");
  for (const f of ["SUCCESS", "SHA256SUMS"]) {
    const st = fs.lstatSync(path.join(dir, f));
    if (!st.isFile() || st.isSymbolicLink() || (process.getuid && st.uid !== process.getuid()) || (st.mode & 0o077))
      throw new Error("unsafe backup verification metadata");
  }
  if (!fs.readFileSync(path.join(dir, "SUCCESS"), "utf8").trim()) throw new Error("backup SUCCESS marker is empty");
  const sums = fs.readFileSync(path.join(dir, "SHA256SUMS"), "utf8").trim().split(/\n/);
  const listed = new Set();
  for (const line of sums) {
    const m = /^([a-f0-9]{64})  ([A-Za-z0-9._-]+)$/.exec(line);
    const file = m && path.join(dir, m[2]);
    if (!m || listed.has(m[2]) || !fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()
      || (fs.statSync(file).mode & 0o077) || await backup.hashFile(file) !== m[1])
      throw new Error("backup checksum verification failed");
    listed.add(m[2]);
  }
  if (["application.tar.gz", "source-fingerprint.json", "pm2-jlist.json", "runtime-fingerprint.json"].some(f => !listed.has(f)))
    throw new Error("backup checksum manifest incomplete");
  const sf = JSON.parse(fs.readFileSync(path.join(dir, "source-fingerprint.json"), "utf8"));
  if (sf.head !== HEAD || sf.aggregate !== SOURCE_FP || sf.rows?.length !== 93) throw new Error("backup source fingerprint mismatch");
  const tarList = must(deps, "tar", ["-tzf", path.join(dir, "application.tar.gz")]).split(/\n/).filter(Boolean);
  if (!tarList.length || tarList.some(p => p.startsWith("/") || p.split("/").includes(".."))) throw new Error("unsafe backup archive");
  const names = tarList.map(p => p.replace(/^\.\//, "").replace(/\/$/, "")).filter(Boolean);
  if (!names.includes(".git/HEAD") || !names.some(p => p === "node_modules" || p.startsWith("node_modules/")))
    throw new Error("backup archive lacks Git or application dependencies");
  if (["data", "uploads", "attached_assets", "runtime", "server/data", "server/uploads", "artifacts", "design"]
    .some(prefix => names.some(p => p === prefix || p.startsWith(`${prefix}/`)))) throw new Error("backup archive includes protected runtime files");
  if (liveRoot) {
    const runtime = JSON.parse(fs.readFileSync(path.join(dir, "runtime-fingerprint.json"), "utf8"));
    if (runtime.buildHash !== await distFingerprint(liveRoot)) throw new Error("backup serving-build fingerprint mismatch");
    const saved = JSON.parse(fs.readFileSync(path.join(dir, "pm2-jlist.json"), "utf8")).filter(r => r?.name === PROCESS);
    if (saved.length !== 1 || saved[0].pid !== runtime.pid || saved[0].pm2_env?.status !== "online"
      || path.resolve(saved[0].pm2_env?.pm_cwd || "") !== liveRoot
      || path.resolve(saved[0].pm2_env?.pm_exec_path || "") !== path.join(liveRoot, "dist/index.cjs"))
      throw new Error("backup PM2 snapshot mismatch");
    const live = pm2(deps, liveRoot);
    if (runtime.pid !== live.pid || pmConfigHash(saved[0]) !== live.configHash) throw new Error("backup PM2 environment mismatch");
    const env = path.join(liveRoot, ".env"), savedEnv = path.join(dir, ".env.copy");
    if (fs.existsSync(env) !== fs.existsSync(savedEnv)
      || (fs.existsSync(env) && await backup.hashFile(env) !== await backup.hashFile(savedEnv)))
      throw new Error("backup application configuration mismatch");
  }
  return { fingerprint: sf.aggregate, count: sf.rows.length, head: sf.head };
}
function pm2(deps, root, online = true) {
  const rows = deps.pm2List ? deps.pm2List() : JSON.parse(must(deps, "pm2", ["jlist"], { cwd: root }));
  const matching = rows.filter(r => r?.name === PROCESS);
  if (matching.length !== 1) throw new Error("PM2 process mismatch");
  const row = matching[0], e = row.pm2_env || {};
  if ((online && e.status !== "online") || path.resolve(e.pm_cwd || "") !== root
    || path.resolve(e.pm_exec_path || "") !== path.join(root, "dist/index.cjs")) throw new Error("PM2 runtime mismatch");
  let configured = e.env?.PORT || e.PORT;
  if (configured === undefined || configured === "") {
    const envFile = path.join(root, ".env");
    if (fs.existsSync(envFile)) {
      const parsed = deps.parseEnvFile ? deps.parseEnvFile(envFile) : backup.parseEnvFile(envFile, root);
      configured = parsed.PORT;
    }
  }
  const port = Number(configured === undefined || configured === "" ? "5000" : configured);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PM2 runtime port unavailable");
  return { pid: row.pid, port, configHash: pmConfigHash(row) };
}
function sourceFingerprint(root, deps = {}) { return deps.fingerprint ? deps.fingerprint(root) : backup.fingerprint(root, deps); }
function validateRelease(root, manifest, deps) {
  must(deps, "git", ["fetch", "origin", "main:refs/remotes/origin/main"], { cwd: root });
  const remote = git(root, ["rev-parse", "origin/main"], deps);
  if (remote !== manifest.commit) throw new Error("origin/main differs from pinned release commit");
  const tree = git(root, ["rev-parse", `${manifest.commit}^{tree}`], deps);
  if (tree !== manifest.tree) throw new Error("release tree differs from reviewed manifest");
  const parents = git(root, ["rev-list", "--parents", "-n", "1", manifest.commit], deps).split(/\s+/).slice(1);
  if (!parents.includes(manifest.parent || BASE)) throw new Error("release commit must directly include the pinned base/reviewed parent");
  for (const ancestor of [BASE, HEAD]) {
    const r = run(deps, "git", ["merge-base", "--is-ancestor", ancestor, manifest.commit], { cwd: root });
    if (r.status !== 0) throw new Error("release ancestry mismatch");
  }
  const paths = git(root, ["diff", "--name-only", "-z", BASE, manifest.commit], deps).split("\0").filter(Boolean).sort();
  if (JSON.stringify(paths) !== JSON.stringify(manifest.paths) || paths.some(p => !approvedReleasePath(p)))
    throw new Error("release path scope differs from reviewed manifest");
}
function checkHealth(port, route, deps) {
  if (route !== "/api/users") throw new Error("health check must use the existing protected /api/users endpoint");
  if (deps.health) {
    const r = deps.health(port, route);
    if (r.status !== 401 || !r.body || String(r.body.error || "").toLowerCase() !== "unauthorized" || r.rootStatus !== 200)
      throw new Error("API unauthorized response or frontend root check failed");
    return;
  }
  const raw = must(deps, "curl", ["--silent", "--show-error", "--max-time", "8", "--write-out", "\n%{http_code}",
    `http://127.0.0.1:${port}${route}`]);
  const i = raw.lastIndexOf("\n"), status = raw.slice(i + 1);
  let body;
  try { body = JSON.parse(raw.slice(0, i)); } catch { throw new Error("protected API did not return expected JSON"); }
  const rootStatus = must(deps, "curl", ["--silent", "--show-error", "--max-time", "8", "--output", "/dev/null",
    "--write-out", "%{http_code}", `http://127.0.0.1:${port}/`]);
  if (status !== "401" || String(body?.error || "").toLowerCase() !== "unauthorized" || rootStatus !== "200")
    throw new Error("API unauthorized response or frontend root check failed");
}
function healthDeclared(sourceRoot, route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declaration = new RegExp(`\\b(?:app|router)\\.(?:get|head)\\s*\\(\\s*["']${escaped}["']`);
  const walk = dir => {
    if (!fs.existsSync(dir)) return false;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (walk(p)) return true; }
      else if (/\.(?:[cm]?js|tsx?)$/i.test(e.name)) {
        const text = fs.readFileSync(p, "utf8");
        if (declaration.test(text)) return true;
      }
    }
    return false;
  };
  return ["server", "shared"].some(r => walk(path.join(sourceRoot, r)));
}
function waitForHealthAfterRestart(port, route, deps, runtimeReady = () => {}) {
  const now = deps.healthClock || Date.now;
  const timeout = deps.healthTimeoutMs ?? 60000;
  const delay = deps.healthRetryMs ?? 1000;
  const deadline = now() + timeout;
  for (;;) {
    try { checkHealth(port, route, deps); runtimeReady(); return; }
    catch (cause) {
      if (now() >= deadline) {
        const error = new Error("application health did not become ready after restart");
        for (const key of ["nativeTool", "nativeStatus", "nativeStderr"]) error[key] = cause[key];
        error.healthFailure = cause.message;
        throw error;
      }
      if (deps.healthWait) deps.healthWait(delay);
      else Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
    }
  }
}
function lockAt(home, deps) {
  const dir = path.join(home, ".indexus-consolidated-deploy");
  privateDir(dir);
  const file = path.join(dir, "LOCK");
  if (deps.acquireLock) { deps.acquireLock(file); return () => deps.releaseLock?.(file); }
  let fd;
  try { fd = fs.openSync(file, "wx", 0o600); fs.writeSync(fd, `${process.pid}\n`); }
  catch { throw new Error("another operator deployment holds the lock"); }
  fs.closeSync(fd); return () => { try { fs.unlinkSync(file); } catch {} };
}
function checkRoot(root, home) {
  noSymlinkChain(root); noSymlinkChain(home);
  const r = fs.lstatSync(root), h = fs.lstatSync(home);
  if (!r.isDirectory() || r.isSymbolicLink() || !h.isDirectory() || h.isSymbolicLink()) throw new Error("unsafe application/operator path");
}
function configSnapshot(root) {
  const files = [".env", "package.json", "package-lock.json", "ecosystem.config.js", "ecosystem.config.cjs"];
  return Object.fromEntries(files.map(f => {
    const p = path.join(root, f);
    return [f, fs.existsSync(p) ? crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") : "missing"];
  }));
}
function releasePaths(root, deps) {
  return sourceFingerprint(root, deps).rows.map(r => r.path);
}
function diskGuard(root, home, reserve = 1024 * 1024 * 1024) {
  for (const dir of [root, home]) {
    const s = fs.statfsSync(dir);
    if (s.bavail * s.bsize < reserve) throw new Error("insufficient deployment disk space");
  }
}
function preserveOldAssets(oldPublic, newPublic) {
  const from = path.join(oldPublic, "assets"), to = path.join(newPublic, "assets");
  if (!fs.existsSync(from)) return;
  const copyMissing = (src, dest) => {
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const a = path.join(src, e.name), b = path.join(dest, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        const made = !fs.existsSync(b);
        fs.mkdirSync(b, { recursive: true }); copyMissing(a, b);
        if (made) { const s = fs.statSync(a); fs.chownSync(b, s.uid, s.gid); fs.chmodSync(b, s.mode & 0o777); }
      } else if (e.isFile() && !fs.existsSync(b)) {
        fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b);
        const s = fs.statSync(a); fs.chownSync(b, s.uid, s.gid); fs.chmodSync(b, s.mode & 0o777);
      }
    }
  };
  const made = !fs.existsSync(to);
  fs.mkdirSync(to, { recursive: true }); copyMissing(from, to);
  if (made) { const s = fs.statSync(from); fs.chownSync(to, s.uid, s.gid); fs.chmodSync(to, s.mode & 0o777); }
}
async function prepare(options, deps = {}) {
  const root = path.resolve(deps.root || ROOT), home = path.resolve(deps.home || HOME);
  checkRoot(root, home);
  requireTools(root, deps, ["git", "tar", "rsync", "curl", "pm2", "npm"]);
  const stateDir = path.join(home, ".indexus-consolidated-deploy");
  privateDir(stateDir);
  const unlock = lockAt(home, deps);
  try {
    const manifest = readManifest(options.manifest, options.commit);
    const backupDir = path.resolve(options.backup), backupRoot = path.join(home, "indexus-backups");
    if (!backupDir.startsWith(`${backupRoot}${path.sep}`)) throw new Error("backup must be under private indexus-backups");
    const bk = await verifyBackup(backupDir, deps, root);
    if (git(root, ["rev-parse", "HEAD"], deps) !== HEAD) throw new Error("production HEAD mismatch");
    const fp = sourceFingerprint(root, deps);
    if (fp.aggregate !== SOURCE_FP || fp.rows.length !== 93) throw new Error("production source fingerprint mismatch");
    const runtime = pm2(deps, root);
    if (git(root, ["symbolic-ref", "--short", "HEAD"], deps) !== "main") throw new Error("production checkout is not on main");
    validateRelease(root, manifest, deps);
    diskGuard(root, home);
    const id = `${options.commit}-${Date.now()}-${crypto.randomUUID()}`, runDir = path.join(stateDir, id);
    privateDir(runDir);
    const stage = path.join(runDir, "stage");
    fs.mkdirSync(stage, { mode: 0o700 });
    if (deps.extractArchive) deps.extractArchive(options.commit, stage, root);
    else {
      fs.rmSync(stage, { recursive: true, force: true }); fs.mkdirSync(stage, { mode: 0o700 });
      must(deps, "bash", ["-c", `git archive ${options.commit} | tar -x -C ${JSON.stringify(stage)}`], { cwd: root });
    }
    const modules = path.join(root, "node_modules");
    if (!fs.statSync(modules).isDirectory() || fs.lstatSync(modules).isSymbolicLink()) throw new Error("unsafe production node_modules");
    fs.symlinkSync(modules, path.join(stage, "node_modules"), "dir");
    const log = path.join(runDir, "build.log");
    let build;
    if (deps.build) {
      build = deps.build(stage, { PATH: process.env.PATH || "/usr/bin:/bin", HOME: home, NODE_ENV: "production" });
      writePrivate(log, typeof build === "string" ? build : "");
    }
    else {
      try {
        const { spawnSync } = require("node:child_process");
        const r = spawnSync("npm", ["run", "build"], { cwd: stage,
          env: { PATH: process.env.PATH || "/usr/bin:/bin", HOME: home, NODE_ENV: "production" },
          encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
        writePrivate(log, `${r.stdout || ""}${r.stderr || ""}`);
        if (r.error || r.status !== 0) throw new Error("build command failed");
      } catch { throw new Error("staging build failed; private log retained"); }
    }
    if (!fs.existsSync(path.join(stage, "dist/index.cjs"))) throw new Error("staged build missing dist/index.cjs");
    const liveDist = path.join(root, "dist"), stageDist = path.join(stage, "dist");
    noSymlinkChain(liveDist);
    const distStat = fs.lstatSync(liveDist), fileProfile = fs.statSync(path.join(liveDist, "index.cjs"));
    if (!distStat.isDirectory() || distStat.isSymbolicLink()) throw new Error("unsafe live dist");
    const setProfile = (p, ref) => {
      const st = fs.lstatSync(p);
      if (!st.isDirectory() && !st.isFile()) throw new Error("unsupported staged dist entry");
      const refStat = ref && fs.existsSync(ref) && fs.lstatSync(ref).isFile() === st.isFile()
        ? fs.statSync(ref) : (st.isDirectory() ? distStat : fileProfile);
      fs.chownSync(p, refStat.uid, refStat.gid);
      if (st.isDirectory()) for (const n of fs.readdirSync(p)) setProfile(path.join(p, n), ref && path.join(ref, n));
      fs.chmodSync(p, refStat.mode & 0o777);
    };
    setProfile(stageDist, liveDist);
  if (options.health_path && !healthDeclared(stage, options.health_path))
      throw new Error("health path is not declared by staged application source");
    const metadata = { version: 1, commit: manifest.commit, tree: manifest.tree, paths: manifest.paths, runDir, stage,
      backup: backupDir, head: HEAD, parent: manifest.parent, fingerprint: bk.fingerprint, runtime, config: configSnapshot(root),
      preparedFingerprint: fp.aggregate, preparedPaths: fp.rows.map(r => r.path), healthPath: options.health_path || "",
      distHash: await distFingerprint(stage), created: Date.now() };
    writePrivate(path.join(runDir, "PREPARED.json"), JSON.stringify(metadata));
    writePrivate(path.join(stateDir, "CURRENT"), `${runDir}\n`);
    return { prepared: true, runDir, commit: manifest.commit, build: !!build };
  } catch (e) {
    recordFailure(path.join(stateDir, "ERROR_PREPARE.json"), "prepare", e);
    throw e;
  } finally { unlock(); }
}
async function preparedState(home) {
  const base = path.join(home, ".indexus-consolidated-deploy");
  noSymlinkChain(base);
  const baseStat = fs.lstatSync(base);
  if (!baseStat.isDirectory() || baseStat.isSymbolicLink() || (process.getuid && baseStat.uid !== process.getuid()) || (baseStat.mode & 0o077))
    throw new Error("unsafe prepared-state directory");
  const pointer = path.join(base, "CURRENT");
  noSymlinkChain(pointer);
  const pointerStat = fs.lstatSync(pointer);
  if (!pointerStat.isFile() || (process.getuid && pointerStat.uid !== process.getuid()) || (pointerStat.mode & 0o077))
    throw new Error("unsafe prepared-state pointer");
  const dir = fs.readFileSync(pointer, "utf8").trim();
  if (path.dirname(dir) !== base || path.resolve(dir) !== dir) throw new Error("invalid prepared-state pointer");
  noSymlinkChain(dir);
  const metadataFile = path.join(dir, "PREPARED.json"), metadataStat = fs.lstatSync(metadataFile);
  if (!metadataStat.isFile() || (process.getuid && metadataStat.uid !== process.getuid()) || (metadataStat.mode & 0o077))
    throw new Error("unsafe prepared metadata");
  const m = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
  const backupRoot = path.join(home, "indexus-backups");
  const backupRel = path.relative(backupRoot, m.backup);
  if (m.runDir !== dir || m.stage !== path.join(dir, "stage") || !backupRel || backupRel.startsWith("..") || path.isAbsolute(backupRel))
    throw new Error("prepared-state paths changed");
  noSymlinkChain(m.backup);
  if (!fs.existsSync(path.join(m.stage, "dist/index.cjs"))
    || fs.lstatSync(path.join(m.stage, "dist")).isSymbolicLink()
    || await distFingerprint(m.stage) !== m.distHash) throw new Error("prepared build changed or unavailable");
  return m;
}
async function apply(options, deps = {}) {
  const root = path.resolve(deps.root || ROOT), home = path.resolve(deps.home || HOME);
  checkRoot(root, home);
  requireTools(root, deps, ["git", "tar", "rsync", "curl", "pm2"]);
  const unlock = lockAt(home, deps);
  let state, activation = false, phase = "preflight";
  try {
    state = await preparedState(home);
    await verifyBackup(state.backup, deps, root);
    const manifest = readManifest(options.manifest, options.commit);
    if (state.commit !== options.commit || state.tree !== manifest.tree
      || (state.parent || BASE) !== manifest.parent
      || JSON.stringify(state.paths) !== JSON.stringify(manifest.paths)) throw new Error("prepared release mismatch");
    if (git(root, ["rev-parse", "HEAD"], deps) !== HEAD) throw new Error("production source HEAD changed after prepare");
    if (git(root, ["symbolic-ref", "--short", "HEAD"], deps) !== "main") throw new Error("production checkout is not on main");
    const fp = sourceFingerprint(root, deps);
    if (fp.aggregate !== state.preparedFingerprint || fp.rows.length !== 93) throw new Error("production source changed after prepare");
    if (JSON.stringify(configSnapshot(root)) !== JSON.stringify(state.config)) throw new Error("production configuration changed after prepare");
    const runPaths = releasePaths(root, deps);
    if (JSON.stringify(runPaths) !== JSON.stringify(state.preparedPaths)) throw new Error("approved dirty path list changed after prepare");
    const livePm = pm2(deps, root);
    if (livePm.pid !== state.runtime.pid || livePm.port !== state.runtime.port || livePm.configHash !== state.runtime.configHash)
      throw new Error("PM2 runtime changed after prepare");
    validateRelease(root, manifest, deps);
    diskGuard(root, home);
    checkHealth(livePm.port, options.health_path, deps);
    const dirty = runPaths;
    let stashRef = "";
    activation = true;
    phase = "stash_sources";
    if (dirty.length) {
      if (!dirty.every(backup.approvedPath)) throw new Error("unsafe dirty source path");
      must(deps, "git", ["stash", "push", "--include-untracked", "-m", `consolidated-deploy-${options.commit}`, "--", ...dirty], { cwd: root });
      stashRef = git(root, ["rev-parse", "refs/stash"], deps); writePrivate(path.join(state.runDir, "STASH.json"), JSON.stringify({ stashRef }));
    }
    phase = "pull_release";
    must(deps, "git", ["pull", "--ff-only", "origin", "main"], { cwd: root });
    if (git(root, ["rev-parse", "HEAD"], deps) !== options.commit || git(root, ["symbolic-ref", "--short", "HEAD"], deps) !== "main")
      throw new Error("pulled Git state differs from pinned main commit");
    phase = "prepare_serving_build";
    const newDist = path.join(root, `.dist-new-${crypto.randomUUID()}`);
    if (fs.existsSync(newDist)) throw new Error("unexpected staged dist collision");
    fs.cpSync(path.join(state.stage, "dist"), newDist, { recursive: true, preserveTimestamps: true });
    const evidence = path.join(root, `.deploy-evidence-${crypto.randomUUID()}`);
    privateDir(evidence);
    const oldDist = path.join(root, "dist");
    if (!healthDeclared(state.stage, options.health_path)) throw new Error("health path is not declared by staged application source");
    const previous = path.join(evidence, "dist");
    preserveOldAssets(path.join(oldDist, "public"), path.join(newDist, "public"));
    // Same-filesystem rename is used for each serving-tree transition.
    phase = "swap_build";
    if (deps.swapDist) deps.swapDist(newDist, oldDist, previous);
    else { fs.renameSync(oldDist, previous); fs.renameSync(newDist, oldDist); }
    writePrivate(path.join(state.runDir, "ACTIVATED.json"), JSON.stringify({ previous, stashRef }));
    phase = "restart";
    if (deps.pm2Restart) deps.pm2Restart(PROCESS);
    else must(deps, "pm2", ["restart", PROCESS], { cwd: root });
    const after = pm2(deps, root, false);
    phase = "post_restart_health";
    waitForHealthAfterRestart(after.port, options.health_path, deps, () => pm2(deps, root));
    return { applied: true, commit: options.commit, previousDist: previous, stashRef };
  } catch (e) {
    recordFailure(path.join(state?.runDir || path.join(home, ".indexus-consolidated-deploy"), "ERROR_DEPLOY.json"), phase, e);
    if (activation) {
      try { await rollbackInternal(state || await preparedState(home), root, deps, options.health_path); }
      catch (recoveryError) {
        const failure = new Error(`deployment failed at ${phase}; automatic rollback failed at ${recoveryError.failurePhase || "unknown"}; inspect private operator evidence`);
        failure.privateFailureLog = recoveryError.privateFailureLog || e.privateFailureLog;
        throw failure;
      }
       const failure = new Error("deployment failed; verified application rollback completed");
       failure.privateFailureLog = e.privateFailureLog;
       failure.privateFailureLogWriteFailed = e.privateFailureLogWriteFailed;
       throw failure;
    }
    throw e;
  } finally { unlock(); }
}
async function rollbackInternal(state, root, deps, healthPath = "/api/users") {
  requireTools(root, deps, ["git", "tar", "rsync", "curl", "pm2"]);
  let phase = "verify_backup", runDir;
  try {
  await verifyBackup(state.backup, deps);
  runDir = path.join(path.dirname(state.runDir), `rollback-${Date.now()}`);
  privateDir(runDir);
  phase = "capture_failed_release";
  if (fs.existsSync(path.join(root, "dist")))
    fs.cpSync(path.join(root, "dist"), path.join(runDir, "failed-dist"), { recursive: true });
  for (const rel of state.paths) {
    const from = path.join(root, rel);
    if (fs.existsSync(from) && fs.statSync(from).isFile()) {
      const to = path.join(runDir, "failed-source", rel);
      fs.mkdirSync(path.dirname(to), { recursive: true, mode: 0o700 });
      fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    }
  }
  const extract = path.join(runDir, "restore"); fs.mkdirSync(extract, { mode: 0o700 });
  phase = "extract_original";
  must(deps, "tar", ["-xzf", path.join(state.backup, "application.tar.gz"),
    "--exclude=./mobile-app", "--exclude=./mobile-app/**", "--exclude=private-task-attachments",
    "-C", extract], { cwd: root });
  for (const rel of [".git", "node_modules", "dist"]) {
    const p = path.join(extract, rel), s = fs.lstatSync(p);
    if (!s.isDirectory() || s.isSymbolicLink()) throw new Error(`verified backup ${rel} is not a real directory`);
  }
  if (git(extract, ["rev-parse", "HEAD"], deps) !== HEAD) throw new Error("backup archive Git HEAD mismatch");
  if (!healthDeclared(extract, healthPath)) throw new Error("rollback health path is not declared by verified backup source");
  const expected = JSON.parse(fs.readFileSync(path.join(state.backup, "source-fingerprint.json"), "utf8"));
  const restoredFp = sourceFingerprint(extract, deps);
  if (restoredFp.aggregate !== expected.aggregate) throw new Error("backup archive source fingerprint mismatch");
  const originalRuntime = JSON.parse(fs.readFileSync(path.join(state.backup, "runtime-fingerprint.json"), "utf8"));
  if (await distFingerprint(extract) !== originalRuntime.buildHash) throw new Error("backup archive build fingerprint mismatch");
  phase = "stop_process";
  if (deps.pm2Stop) deps.pm2Stop(PROCESS); else must(deps, "pm2", ["stop", PROCESS], { cwd: root });
  phase = "restore_files";
  const excludes = ["--exclude=private-task-attachments", ...[".env", ".env.*", ...OMIT].flatMap(p => [`--exclude=/${p}`, `--exclude=/${p}/**`])];
  must(deps, "rsync", ["-a", "--owner", "--group", "--delete", ...excludes, `${extract}/`, `${root}/`], { cwd: root });
  phase = "verify_restored_sources";
  if (git(root, ["rev-parse", "HEAD"], deps) !== HEAD || sourceFingerprint(root, deps).aggregate !== expected.aggregate)
    throw new Error("restored application source verification failed");
  if (await distFingerprint(root) !== originalRuntime.buildHash) throw new Error("restored serving build verification failed");
  phase = "restart";
  if (deps.pm2Restart) deps.pm2Restart(PROCESS);
  else must(deps, "pm2", ["restart", PROCESS], { cwd: root });
  phase = "post_restart_health";
  waitForHealthAfterRestart(pm2(deps, root, false).port, healthPath, deps, () => pm2(deps, root));
  } catch (e) {
    recordFailure(path.join(runDir || state.runDir, "ERROR_ROLLBACK.json"), phase, e);
    throw e;
  }
}
async function rollback(options, deps = {}) {
  const root = path.resolve(deps.root || ROOT), home = path.resolve(deps.home || HOME);
  checkRoot(root, home);
  const unlock = lockAt(home, deps);
  try {
    const state = await preparedState(home);
    await verifyBackup(state.backup, deps);
    await rollbackInternal(state, root, deps, options.health_path);
    return { rolledBack: true, head: HEAD };
  } finally { unlock(); }
}
async function main(args = process.argv.slice(2), deps = {}) {
  const options = parseArgs(args);
  if (options.help) { (deps.log || console.log)(help()); return null; }
  if (!deps.testMode && (os.userInfo().username !== "seman" || path.resolve(deps.root || ROOT) !== ROOT)) throw new Error("must run as seman on CORPCRM01");
  if (options.prepare) return prepare(options, deps);
  if (options.apply) return apply(options, deps);
  return rollback(options, deps);
}
if (require.main === module) main().then(r => { if (r) console.log(`DEPLOY_STATUS=${r.applied ? "APPLIED" : r.rolledBack ? "ROLLED_BACK" : "PREPARED"} COMMIT=${r.commit || r.head} PATH=${r.runDir || r.previousDist || ""}`); }).catch(e => { console.error(`DEPLOY FAILED: ${e.message}`); if (e.privateFailureLog) console.error(`DETAILS_PRIVATE=${e.privateFailureLog}`); if (e.privateFailureLogWriteFailed) console.error("PRIVATE_DIAGNOSTIC_WRITE_FAILED"); process.exitCode = 1; });
module.exports = { parseArgs, readManifest, verifyBackup, pm2, pmConfigHash, distFingerprint, validateRelease, checkHealth, waitForHealthAfterRestart, requireTools, healthDeclared, sourceFingerprint, prepare, apply, rollback, rollbackInternal, main };