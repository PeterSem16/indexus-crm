#!/usr/bin/env node
/* Backup-only operator helper for CORPCRM01. It never changes the application. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const ROOT = "/var/www/indexus-crm";
const HEAD = "b59f6e006cc2073cbb5ae909555c304cf0030903";
const PROCESS = "indexus-crm";
const SRC = ["client", "server", "shared", "script", "scripts", "e2e"];
const CONFIG = [".gitignore", "package.json", "package-lock.json", "tsconfig.json", "tsconfig.build.json",
  "vite.config.ts", "vite.config.js", "vite.config.mjs", "tailwind.config.ts", "postcss.config.js",
  "components.json", "drizzle.config.ts", "webpack.config.js", "rollup.config.js", "esbuild.config.js"];
const EXT = /\.(?:ts|tsx|js|jsx|cjs|mjs|css|scss|json|svg|sh|md)$/i;
const OMIT = ["data", "uploads", "attached_assets", "runtime", "server/data", "server/uploads", "artifacts", "design"];
const RUNTIME_LIST = "data, uploads, attached_assets, runtime, server/data, server/uploads, artifacts, design";
const HASH = b => crypto.createHash("sha256").update(b).digest("hex");
async function hashFile(file) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function buildFingerprint(root) {
  const rows = [];
  async function visit(dir, relative = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file, rel);
      else rows.push(`${rel}\0${entry.isSymbolicLink() ? HASH(fs.readlinkSync(file)) : await hashFile(file)}\n`);
    }
  }
  await visit(path.join(root, "dist"));
  return HASH(rows.join(""));
}

function approvedPath(p) {
  if (!p || p.includes("\\") || p.startsWith("/") || p.split("/").includes("..")) return false;
  if (/^(?:\.env(?:\.|$)|.*\/\.env(?:\.|$))/i.test(p) || /\.(?:pem|key|p12|pfx|crt|cer)$/i.test(p)) return false;
  if (/(?:^|\/)(?:node_modules|dist)(?:\/|$)/.test(p)) return false;
  if (OMIT.some(x => p === x || p.startsWith(`${x}/`))) return false;
  if (CONFIG.includes(p) || /^(?:tsconfig(?:\.[\w-]+)?\.json|(?:vite|tailwind|postcss|webpack|rollup|esbuild|drizzle)\.config\.[cm]?js|(?:vite|tailwind|drizzle)\.config\.ts)$/.test(p)) return true;
  return SRC.some(x => p.startsWith(`${x}/`)) && EXT.test(p);
}

function urlToPgEnv(connectionString) {
  const u = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(u.protocol)) throw new Error("DATABASE_URL must be PostgreSQL");
  const env = { PGHOST: u.hostname, PGPORT: u.port || "5432",
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)), PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password) };
  const map = { sslmode: "PGSSLMODE", sslcert: "PGSSLCERT", sslkey: "PGSSLKEY",
    sslrootcert: "PGSSLROOTCERT", sslcrl: "PGSSLCRL", gssencmode: "PGGSSENCMODE",
    connect_timeout: "PGCONNECT_TIMEOUT", application_name: "PGAPPNAME" };
  for (const [key, value] of u.searchParams) if (map[key]) env[map[key]] = value;
  if (!env.PGDATABASE || !env.PGUSER) throw new Error("DATABASE_URL must include database and user");
  return env;
}

function command(name, args, options = {}) {
  const r = execFileSync(name, args, { cwd: options.cwd, env: options.env || process.env,
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  return { stdout: r || "", stderr: "" };
}
function run(dep, name, args, options = {}) {
  try { return (dep.command || command)(name, args, options); }
  catch (e) { return { status: e.status ?? 1, stdout: e.stdout?.toString() || "", stderr: e.stderr?.toString() || "" }; }
}
function ok(dep, name, args, options) {
  const r = run(dep, name, args, options);
  if (r.status !== undefined && r.status !== 0) throw new Error("command failed");
  return r;
}
function git(dep, root, args) { return ok(dep, "git", args, { cwd: root }).stdout; }
function fingerprint(root, dep = {}) {
  const scope = [...SRC, ...CONFIG, "tsconfig.*.json", "*.config.*"];
  const changed = git(dep, root, ["diff", "HEAD", "--name-only", "-z", "--", ...scope]).split("\0").filter(Boolean);
  const untracked = git(dep, root, ["ls-files", "--others", "--exclude-standard", "-z", "--", ...scope]).split("\0").filter(Boolean);
  const paths = [...new Set([...changed, ...untracked])].filter(approvedPath).sort();
  const rows = paths.map(p => {
    const full = path.join(root, p);
    if (!fs.existsSync(full) && !fs.lstatSync(full, { throwIfNoEntry: false })) return { path: p, sha256: "missing" };
    const st = fs.lstatSync(full);
    if (st.isSymbolicLink()) return { path: p, sha256: HASH(fs.readlinkSync(full)) };
    return { path: p, sha256: st.isFile() ? HASH(fs.readFileSync(full)) : "missing" };
  });
  const aggregate = HASH(rows.map(r => `${r.path}\0${r.sha256}\n`).join(""));
  return { rows, aggregate };
}
function pgSize(env, deps) {
  if (deps.databaseSize) return deps.databaseSize(env);
  let pg;
  try { pg = require(path.join(ROOT, "node_modules/pg")); } catch { throw new Error("pg module unavailable"); }
  const Client = pg.Client;
  const mode = env.PGSSLMODE;
  const c = new Client(Object.keys(env).some(k => k.startsWith("PG")) ? {
    host: env.PGHOST, port: env.PGPORT, database: env.PGDATABASE, user: env.PGUSER, password: env.PGPASSWORD,
    ssl: mode && mode !== "disable" ? {
      rejectUnauthorized: mode === "verify-ca" || mode === "verify-full",
      ca: env.PGSSLROOTCERT && fs.readFileSync(env.PGSSLROOTCERT, "utf8"),
      cert: env.PGSSLCERT && fs.readFileSync(env.PGSSLCERT, "utf8"),
      key: env.PGSSLKEY && fs.readFileSync(env.PGSSLKEY, "utf8"),
    } : undefined,
  } : {});
  return c.connect().then(async () => {
    try { const q = await c.query("SELECT pg_database_size(current_database()) AS bytes"); return Number(q.rows[0].bytes); }
    finally { await c.end(); }
  });
}
function secureDir(dir, uid = process.getuid?.()) {
  const st = fs.lstatSync(dir);
  if (!st.isDirectory() || st.isSymbolicLink() || (uid !== undefined && st.uid !== uid) || (st.mode & 0o077))
    throw new Error("unsafe backup directory");
}
function writePrivate(file, data) { fs.writeFileSync(file, data, { mode: 0o600, flag: "wx" }); fs.chmodSync(file, 0o600); }
function currentEnv(pm2, root) {
  const rows = JSON.parse(pm2);
  const matches = rows.filter(x => x?.name === PROCESS);
  if (matches.length !== 1) throw new Error("PM2 process mismatch");
  const e = matches[0].pm2_env || {};
  if (e.status !== "online" || path.resolve(e.pm_cwd || "") !== root
    || path.resolve(e.pm_exec_path || "") !== path.join(root, "dist/index.cjs")) throw new Error("PM2 runtime mismatch");
  return e.env?.DATABASE_URL || e.DATABASE_URL || "";
}
function parseEnvFile(file, root = ROOT) {
  if (typeof require("node:util").parseEnv === "function") return require("node:util").parseEnv(fs.readFileSync(file, "utf8"));
  try { return require(require.resolve("dotenv", { paths: [root] })).parse(fs.readFileSync(file)); }
  catch { throw new Error("No supported .env parser is available"); }
}
function appDatabaseEnv(pm2, root) {
  const runtimeUrl = currentEnv(pm2, root);
  const envFile = path.join(root, ".env");
  const connection = runtimeUrl || (fs.existsSync(envFile) && parseEnvFile(envFile, root).DATABASE_URL);
  if (!connection) throw new Error("actual application database configuration unavailable");
  return urlToPgEnv(connection);
}
function cliOptions(args) {
  if (!args.length || args.includes("--help") || args.includes("-h")) return { help: true };
  if (args.length !== 1 || args[0] !== "--backup") throw new Error("Use --help or explicit --backup");
  return { backup: true };
}

async function createBackup(options = {}) {
  const root = path.resolve(options.root || ROOT), expected = options.expectedHead || HEAD, deps = options.dependencies || {};
  if (root !== ROOT && !options.testMode) throw new Error("production root mismatch");
  if (!options.testMode && os.userInfo().username !== "seman") throw new Error("must run as operator seman");
  const st = fs.lstatSync(root);
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error("unsafe production root");
  if (git(deps, root, ["rev-parse", "--show-toplevel"]).trim() !== root) throw new Error("git root mismatch");
  const head = git(deps, root, ["rev-parse", "HEAD"]).trim();
  if (head !== expected) throw new Error("expected HEAD mismatch");
  for (const tool of ["git", "tar", "gzip", "pg_dump", "pg_restore", "pm2", "du"]) ok(deps, "which", [tool]);
  const home = path.resolve(options.home || os.homedir()), backupRoot = path.join(home, "indexus-backups");
  const homeStat = fs.lstatSync(home);
  if (!homeStat.isDirectory() || homeStat.isSymbolicLink()
    || (process.getuid && homeStat.uid !== process.getuid())) throw new Error("unsafe operator home");
  if (!fs.existsSync(backupRoot)) fs.mkdirSync(backupRoot, { mode: 0o700 });
  secureDir(backupRoot);
  fs.chmodSync(backupRoot, 0o700);
  const stamp = new Date(options.now || Date.now()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dir = path.join(backupRoot, stamp);
  fs.mkdirSync(dir, { mode: 0o700 }); secureDir(dir);
  const log = (name, r) => writePrivate(path.join(dir, name), `${r.stdout || ""}${r.stderr || ""}`);
  try {
    const pm = ok(deps, "pm2", ["jlist"], { cwd: root, env: process.env });
    writePrivate(path.join(dir, "pm2-jlist.json"), pm.stdout);
    const dbEnv = appDatabaseEnv(pm.stdout, root);
    const pid = JSON.parse(pm.stdout).find(row => row.name === PROCESS).pid;
    const buildHash = await buildFingerprint(root);
    writePrivate(path.join(dir, "runtime-fingerprint.json"), JSON.stringify({ pid, buildHash }));
    const dbBytes = await pgSize(dbEnv, deps);
    const du = ok(deps, "du", ["-sb", ...OMIT.map(p => `--exclude=${path.join(root, p)}`), root]);
    const sourceBytes = Number(du.stdout.trim().split(/\s+/)[0]);
    const disk = fs.statfsSync(dir);
    const free = deps.availableSpace ? deps.availableSpace(dir) : disk.bavail * disk.bsize;
    if (!Number.isFinite(sourceBytes) || sourceBytes <= 0 || !Number.isFinite(dbBytes) || dbBytes <= 0
      || free < (sourceBytes + dbBytes) * 1.25 + 1024 * 1024 * 1024)
      throw new Error("insufficient backup space");
    const fp = fingerprint(root, deps);
    writePrivate(path.join(dir, "source-fingerprint.json"), JSON.stringify({ head, ...fp }, null, 2));
    const envFile = path.join(root, ".env");
    if (fs.existsSync(envFile)) {
      const real = fs.realpathSync(envFile), dest = path.join(dir, ".env.copy");
      fs.copyFileSync(real, dest); fs.chmodSync(dest, 0o600);
    }
    const archive = path.join(dir, "application.tar.gz");
    const excludes = OMIT.flatMap(x => [`--exclude=./${x}`, `--exclude=./${x}/**`]);
    const tr = run(deps, "tar", ["-czpf", archive, ...excludes, "-C", root, "."]);
    log("tar.log", tr);
    if (tr.status !== undefined && tr.status !== 0) throw new Error("archive failed");
    fs.chmodSync(archive, 0o600);
    const gt = run(deps, "gzip", ["-t", archive]); log("gzip.log", gt);
    if (gt.status !== undefined && gt.status !== 0) throw new Error("archive verification failed");
    const dump = path.join(dir, "database.dump");
    const dr = run(deps, "pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--no-password", "--file", dump], { cwd: root, env: { ...process.env, ...dbEnv } });
    log("pg_dump.log", dr);
    if (dr.status !== undefined && dr.status !== 0) throw new Error("database backup failed");
    fs.chmodSync(dump, 0o600);
    const restore = run(deps, "pg_restore", ["--list", dump], { env: { ...process.env, ...dbEnv } });
    log("pg_restore.log", restore);
    if ((restore.status !== undefined && restore.status !== 0) || !restore.stdout.trim()) throw new Error("database verification failed");
    const afterHead = git(deps, root, ["rev-parse", "HEAD"]).trim(), afterFp = fingerprint(root, deps);
    if (afterHead !== head || afterFp.aggregate !== fp.aggregate) throw new Error("source changed during backup");
    const afterPm = ok(deps, "pm2", ["jlist"], { cwd: root });
    if (JSON.stringify(appDatabaseEnv(afterPm.stdout, root)) !== JSON.stringify(dbEnv))
      throw new Error("application database configuration changed during backup");
    if (JSON.parse(afterPm.stdout).find(row => row.name === PROCESS).pid !== pid
      || await buildFingerprint(root) !== buildHash)
      throw new Error("application process or build changed during backup");
    if (fs.existsSync(envFile) !== fs.existsSync(path.join(dir, ".env.copy"))
      || (fs.existsSync(envFile) && await hashFile(envFile) !== await hashFile(path.join(dir, ".env.copy"))))
      throw new Error("application configuration changed during backup");
    const files = ["application.tar.gz", "database.dump", "pm2-jlist.json", "source-fingerprint.json", "runtime-fingerprint.json", ".env.copy"]
      .filter(f => fs.existsSync(path.join(dir, f)));
    const manifest = (await Promise.all(files.map(async f => `${await hashFile(path.join(dir, f))}  ${f}`))).join("\n") + "\n";
    writePrivate(path.join(dir, "SHA256SUMS"), manifest);
    for (const line of manifest.trim().split("\n")) {
      const [sum, file] = line.split(/\s{2}/);
      if (!sum || !file || await hashFile(path.join(dir, file)) !== sum) throw new Error("checksum verification failed");
    }
    writePrivate(path.join(dir, "SUCCESS"), `verified ${new Date().toISOString()}\n`);
    return { directory: dir, head, fingerprint: fp.aggregate, count: fp.rows.length, archive: true, database: true, success: true };
  } catch (e) {
    try { writePrivate(path.join(dir, "INCOMPLETE"), "Backup did not complete; no SUCCESS marker.\n"); } catch {}
    throw Object.assign(new Error("backup failed; private incomplete folder retained"), { directory: dir });
  }
}
function main(args = process.argv.slice(2), deps = {}) {
  const opts = cliOptions(args);
  if (opts.help) { console.log("BACKUP-ONLY: run as seman: node script/backup-consolidated-production.cjs --backup\nDefault/help performs no operation. Saves privately under ~/indexus-backups. Runtime uploads/data and artifacts/design are not included."); return Promise.resolve(null); }
  return createBackup({ ...(deps.options || {}), dependencies: deps }).then(result => {
    console.log(`SUCCESS=${result.success} HEAD=${result.head} FINGERPRINT=${result.fingerprint} COUNT=${result.count}`);
    console.log(`BACKUP=${result.directory} ARCHIVE=${result.archive} DATABASE=${result.database}`);
    console.log(`NOT_INCLUDED=${RUNTIME_LIST}`); return result;
  }).catch(e => { console.error("BACKUP FAILED; no application changes were made. Check the private backup folder/logs."); return Promise.reject(e); });
}

if (require.main === module) {
  main().catch(() => { process.exitCode = 1; });
}
module.exports = { approvedPath, fingerprint, urlToPgEnv, cliOptions, currentEnv, createBackup, main, hashFile, appDatabaseEnv, parseEnvFile };