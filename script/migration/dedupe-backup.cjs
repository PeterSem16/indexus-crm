#!/usr/bin/env node
/**
 * Create and verify the database backup required before dedupe apply.
 *
 * This helper deliberately uses pg_dump/pg_restore rather than a database
 * client library. Credentials are passed through the child-process
 * environment and never through argv or the manifest.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pipeline } = require("node:stream/promises");

const mode = (value) => {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error("mode must be an integer");
  return value;
};

function databaseConfig(options = {}) {
  let url;
  if (options.databaseUrl || process.env.DATABASE_URL) {
    url = new URL(options.databaseUrl || process.env.DATABASE_URL);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      throw new Error("DATABASE_URL must use postgres:// or postgresql://");
    }
  }
  return {
    host: options.host ?? process.env.PGHOST ?? (url && url.hostname) ?? "localhost",
    port: options.port ?? process.env.PGPORT ?? (url && url.port) ?? "5432",
    database: options.database ?? process.env.PGDATABASE ?? (url && decodeURIComponent(url.pathname.slice(1))),
    user: options.user ?? process.env.PGUSER ?? (url && decodeURIComponent(url.username)),
    password: options.password ?? process.env.PGPASSWORD ?? (url && decodeURIComponent(url.password)),
  };
}

function safeBackupRoot(root) {
  if (typeof root !== "string" || !path.isAbsolute(root) || root.includes("\0")) {
    throw new Error("backupRoot must be an absolute path");
  }
  const resolved = path.resolve(root);
  if (resolved === path.parse(resolved).root || resolved === "/tmp" || resolved === "/var") {
    throw new Error("backupRoot is too broad or unsafe");
  }
  return resolved;
}

function timestamp(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function run(command, args, { env, cwd, capture = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", capture ? "pipe" : "ignore", capture ? "pipe" : "ignore"],
    });
    let stdout = "", stderr = "";
    if (capture) {
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
    }
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function scrubError(text) {
  return String(text || "")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgres://[redacted]")
    .replace(/password\s*[=:]\s*\S+/gi, "password=[redacted]")
    .slice(0, 500);
}

function commandArgs(config, dumpPath) {
  const args = ["--format=custom", "--no-password", "--file", dumpPath];
  if (config.host) args.push("--host", String(config.host));
  if (config.port) args.push("--port", String(config.port));
  if (config.user) args.push("--username", String(config.user));
  if (config.database) args.push("--dbname", String(config.database));
  else throw new Error("PostgreSQL database is missing");
  return args;
}

function childEnv(config) {
  const env = { ...process.env };
  if (config.password !== undefined) env.PGPASSWORD = String(config.password);
  return env;
}

async function version(command, env) {
  const result = await run(command, ["--version"], { env });
  if (result.code !== 0) throw new Error(`${path.basename(command)} --version failed (${scrubError(result.stderr)})`);
  return result.stdout.trim() || result.stderr.trim();
}

async function createVerifiedBackup(options = {}) {
  const root = safeBackupRoot(options.backupRoot || process.env.DEDUPE_BACKUP_ROOT);
  await fsp.mkdir(root, { recursive: true, mode: 0o700 });
  const rootStat = await fsp.stat(root);
  if (!rootStat.isDirectory()) throw new Error("backupRoot is not a directory");
  if ((rootStat.mode & 0o077) !== 0) throw new Error("backupRoot must not be accessible by group or others");
  const config = databaseConfig(options);
  const pgDump = options.pgDumpPath || process.env.PG_DUMP_PATH || "pg_dump";
  const pgRestore = options.pgRestorePath || process.env.PG_RESTORE_PATH || "pg_restore";
  const now = options.now ? new Date(options.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("invalid backup timestamp");
  const directory = await fsp.mkdtemp(path.join(root, `${timestamp(now)}-`));
  await fsp.chmod(directory, 0o700);
  const dumpPath = path.join(directory, "database.dump");
  const manifestPath = path.join(directory, "manifest.json");
  const env = childEnv(config);
  try {
    const [pgDumpVersion, pgRestoreVersion] = await Promise.all([
      version(pgDump, env),
      version(pgRestore, env),
    ]);
    const dump = await run(pgDump, commandArgs(config, dumpPath), { env });
    if (dump.code !== 0) throw new Error(`pg_dump failed (${scrubError(dump.stderr)})`);
    const stat = await fsp.stat(dumpPath).catch(() => null);
    if (!stat || !stat.isFile() || stat.size <= 0) throw new Error("pg_dump produced an empty or missing dump");
    await fsp.chmod(dumpPath, 0o600);
    const verify = await run(pgRestore, ["--list", dumpPath], { env });
    if (verify.code !== 0 || !verify.stdout.trim()) {
      throw new Error(`pg_restore verification failed (${scrubError(verify.stderr)})`);
    }
    const fullRead = await run(pgRestore, ["--exit-on-error", "--file", "/dev/null", dumpPath], { env });
    if (fullRead.code !== 0) {
      throw new Error(`pg_restore full archive read failed (${scrubError(fullRead.stderr)})`);
    }
    const hash = crypto.createHash("sha256");
    await pipeline(fs.createReadStream(dumpPath), hash);
    const sha256 = hash.digest("hex");
    const manifest = {
      format: 1,
      createdAt: now.toISOString(),
      db: {
        host: config.host || null,
        port: String(config.port || ""),
        database: config.database,
        user: config.user || null,
      },
      dump: {
        file: "database.dump",
        bytes: stat.size,
        sha256,
      },
      tools: { pgDump: pgDumpVersion, pgRestore: pgRestoreVersion },
      verification: {
        method: "pg_restore --list plus full pg_restore --exit-on-error extraction to /dev/null",
        nonEmpty: true,
        fullArchiveRead: true,
        verifiedAt: new Date().toISOString(),
      },
      restoreCommandTemplate: 'PGPASSWORD="$PGPASSWORD" pg_restore --clean --if-exists --dbname "$PGDATABASE" "$BACKUP_DIR/database.dump"',
    };
    await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await fsp.chmod(manifestPath, 0o600);
    return { directory, dumpPath, manifestPath, manifest };
  } catch (error) {
    await fsp.rm(directory, { recursive: true, force: true });
    throw error;
  }
}

function cliOptions(argv) {
  const options = {};
  for (const arg of argv) {
    const match = arg.match(/^--(backup-dir|database|host|port|user|pg-dump|pg-restore)=(.*)$/);
    if (!match) throw new Error(`unknown argument: ${arg}`);
    const keys = { "backup-dir": "backupRoot", database: "database", host: "host", port: "port", user: "user", "pg-dump": "pgDumpPath", "pg-restore": "pgRestorePath" };
    options[keys[match[1]]] = match[2];
  }
  return options;
}

module.exports = { createVerifiedBackup, databaseConfig, safeBackupRoot, commandArgs };

if (require.main === module) {
  createVerifiedBackup(cliOptions(process.argv.slice(2)))
    .then((result) => console.log(JSON.stringify(result.manifest, null, 2)))
    .catch((error) => {
      console.error(`FATAL: ${error.message}`);
      process.exitCode = 1;
    });
}