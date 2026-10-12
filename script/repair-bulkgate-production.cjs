#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createRequire } = require("node:module");

const ROOT = "/var/www/indexus-crm";
const HOME = "/home/seman";
const ORIGIN = "https://indexus.cordbloodcenter.com";
const BASE = "ed69cd1aeb375c355639be367f60fc25108b005f";
const RELEASE = "41d2cda41ae33470334beeb9ade04b58399b5778";
const FILES = [
  "server/lib/bulkgate.ts", "server/lib/bulkgate-webhook.test.ts",
  "server/lib/bulkgate-callback.ts", "server/lib/bulkgate-callback.test.ts",
  "server/routes.ts", "script/diagnose-bulkgate-inbound.cjs",
].sort();
const URL_FILE = `${HOME}/.config/indexus/bulkgate-webhook-url.txt`;
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
function fail(code) { throw Object.assign(new Error(code), { safeCode: code }); }
function command(name, args, options = {}) {
  return execFileSync(name, args, {
    cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"], ...options,
  });
}
const git = args => command("git", args).trim();
const gitBlob = (commit, file) => command("git", ["show", `${commit}:${file}`], { encoding: null });
function atomicWrite(file, bytes, mode = 0o600) {
  const temp = `${file}.bulkgate-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(temp, bytes, { mode, flag: "wx" });
    fs.renameSync(temp, file);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function replaceEnv(source, updates) {
  let result = source;
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=.*$`, "gm");
    const matches = result.match(regex) || [];
    if (matches.length > 1) fail("DUPLICATE_WEBHOOK_ENV_KEYS");
    const line = `${key}=${JSON.stringify(value)}`;
    result = matches.length ? result.replace(regex, () => line) : `${result.replace(/\s*$/, "")}\n${line}\n`;
  }
  return result;
}
function privateDir(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(directory).isSymbolicLink()) fail("PRIVATE_DIRECTORY_IS_SYMLINK");
  fs.chmodSync(directory, 0o700);
}
function processRow() {
  const rows = JSON.parse(command("pm2", ["jlist"]));
  const row = rows.find(item => item.name === "indexus-crm");
  if (!row) fail("PM2_APPLICATION_MISSING");
  return row;
}
function runtimeEnv(row) {
  const env = { ...process.env };
  for (const source of [row.pm2_env.env || {}, row.pm2_env]) {
    for (const [key, value] of Object.entries(source)) {
      if (/^[A-Z][A-Z0-9_]*$/.test(key) && ["string", "number", "boolean"].includes(typeof value)) env[key] = String(value);
    }
  }
  return env;
}
function sourceSnapshot(commit) {
  const entries = {};
  for (const file of FILES) {
    const tracked = Boolean(git(["ls-tree", commit, "--", file]));
    const absolute = path.join(ROOT, file);
    const exists = fs.existsSync(absolute);
    if (exists && (!tracked || fs.lstatSync(absolute).isSymbolicLink())) fail("SOURCE_FILE_CONFLICT");
    if (tracked && (!exists || sha(fs.readFileSync(absolute)) !== sha(gitBlob(commit, file)))) fail("SOURCE_HASH_MISMATCH");
    entries[file] = exists ? sha(fs.readFileSync(absolute)) : null;
  }
  return entries;
}
function requireSameSnapshot(before) {
  const now = sourceSnapshot(BASE);
  if (JSON.stringify(before) !== JSON.stringify(now) || git(["rev-parse", "HEAD"]) !== BASE) fail("SOURCE_CHANGED_DURING_BUILD");
}
async function callbackProbe(token) {
  // Nonexistent delivery-report ID: does not create a fake incoming SMS.
  const smsID = `indexus-auth-probe-${crypto.randomUUID()}`;
  const body = JSON.stringify({ status: "2", smsID, smsid: smsID, ...(token ? { token } : {}) });
  const response = await fetch(`${ORIGIN}/api/auth/bulkgate/callback`, {
    method: "POST", redirect: "error", headers: { "Content-Type": "application/json" },
    body, signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
async function waitForRoot(expectedHash) {
  for (let attempt = 0; attempt < 45; attempt++) {
    try {
      const response = await fetch(`${ORIGIN}/`, { redirect: "error", signal: AbortSignal.timeout(5000) });
      if (response.status === 200 && sha(Buffer.from(await response.text())) === expectedHash) return;
    } catch { /* Restart may briefly close connections. */ }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  fail("PUBLIC_CRM_HEALTH_FAILED");
}
function savePm2() {
  command("pm2", ["save"]);
  const pmHome = process.env.PM2_HOME || `${HOME}/.pm2`;
  if (!path.resolve(pmHome).startsWith(`${HOME}/`)) fail("UNEXPECTED_PM2_HOME");
  for (const name of ["dump.pm2", "dump.pm2.bak"]) {
    const file = path.join(pmHome, name);
    if (fs.existsSync(file)) fs.chmodSync(file, 0o600);
  }
}
async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || args[0] !== "--apply") fail("USE_EXPLICIT_APPLY_AFTER_RESTART_APPROVAL");
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" ||
      os.userInfo().username !== "seman" || process.cwd() !== ROOT) fail("WRONG_HOST_USER_OR_DIRECTORY");
  process.umask(0o077);
  const backups = `${HOME}/indexus-backups`;
  privateDir(backups);
  const lock = path.join(backups, ".bulkgate-repair-lock");
  fs.mkdirSync(lock, { mode: 0o700 });
  const run = path.join(backups, `bulkgate-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  let changed = false, sourceApplied = false, backendApplied = false, envApplied = false;
  let newEnvBytes, newBundleHash, oldBundle, oldEnv, oldEnvExists, oldRuntime, before, savedRow;
  const bundle = `${ROOT}/dist/index.cjs`, envFile = `${ROOT}/.env`;
  try {
    if (git(["symbolic-ref", "--short", "HEAD"]) !== "main" || git(["rev-parse", "HEAD"]) !== BASE) fail("PRODUCTION_BASE_CHANGED");
    if (git(["diff", "--cached", "--name-only"])) fail("EXISTING_STAGED_CHANGES");
    const actualFiles = git(["diff", "--name-only", BASE, RELEASE]).split("\n").filter(Boolean).sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(FILES)) fail("UNAPPROVED_RELEASE_PATHS");
    if (git(["diff", "--name-only", BASE, RELEASE, "--", "package.json", "package-lock.json", "shared/schema.ts"])) fail("DEPENDENCY_OR_SCHEMA_CHANGE");
    const archiveBytes = git(["ls-tree", "-r", "--long", RELEASE]).split("\n")
      .reduce((sum, line) => sum + (Number(line.trim().split(/\s+/)[3]) || 0), 0);
    const disk = fs.statfsSync(backups);
    if (disk.bavail * disk.bsize < archiveBytes * 2.2 + 128 * 1024 * 1024) fail("INSUFFICIENT_PRIVATE_STAGING_DISK_SPACE");
    before = sourceSnapshot(BASE);
    savedRow = processRow();
    oldRuntime = runtimeEnv(savedRow);
    if (savedRow.pm2_env.status !== "online" || oldRuntime.NODE_ENV !== "production") fail("PRODUCTION_PROCESS_NOT_ONLINE");
    if (path.resolve(savedRow.pm2_env.pm_exec_path || "") !== bundle ||
        path.resolve(savedRow.pm2_env.pm_cwd || "") !== ROOT) fail("UNEXPECTED_PROCESS_COMMAND");
    for (const file of [bundle, envFile]) if (fs.existsSync(file) && !fs.lstatSync(file).isFile()) fail("UNEXPECTED_LIVE_FILE_TYPE");
    oldBundle = fs.readFileSync(bundle);
    oldEnvExists = fs.existsSync(envFile);
    oldEnv = oldEnvExists ? fs.readFileSync(envFile) : Buffer.alloc(0);
    const indexHash = sha(fs.readFileSync(`${ROOT}/dist/public/index.html`));
    await waitForRoot(indexHash);
    privateDir(run);
    atomicWrite(`${run}/old-index.cjs`, oldBundle);
    atomicWrite(`${run}/old.env`, oldEnv);
    atomicWrite(`${run}/old-pm2.json`, JSON.stringify(savedRow));
    atomicWrite(`${run}/source-before.json`, JSON.stringify({ head: BASE, files: before, envExisted: oldEnvExists }));
    if (sha(fs.readFileSync(`${run}/old-index.cjs`)) !== sha(oldBundle) ||
        sha(fs.readFileSync(`${run}/old.env`)) !== sha(oldEnv)) fail("BACKUP_VERIFICATION_FAILED");
    console.log(`BACKUP_OK ${run}`);
    const stage = `${run}/stage`, archive = `${run}/release.tar`;
    privateDir(stage);
    // Write archives straight to private disk, never a buffered child-process pipe.
    command("git", ["archive", RELEASE, `--output=${archive}`]);
    command("tar", ["-xf", archive, "-C", stage]);
    fs.symlinkSync(`${ROOT}/node_modules`, `${stage}/node_modules`, "dir");
    const buildSource = fs.readFileSync(`${stage}/script/build.ts`, "utf8");
    const allowlistSource = buildSource.match(/const allowlist = \[([\s\S]*?)\];/);
    if (!allowlistSource) fail("BUILD_CONFIGURATION_CHANGED");
    const allowlist = [...allowlistSource[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
    const pkg = JSON.parse(fs.readFileSync(`${stage}/package.json`, "utf8"));
    const externals = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]
      .filter(dep => !allowlist.includes(dep));
    const esbuild = createRequire(`${ROOT}/package.json`)("esbuild");
    await esbuild.build({
      absWorkingDir: stage, entryPoints: ["server/index.ts"], platform: "node", bundle: true,
      format: "cjs", outfile: `${stage}/index.cjs`, define: { "process.env.NODE_ENV": '"production"' },
      minify: true, external: externals, logLevel: "silent",
    });
    const newBundle = fs.readFileSync(`${stage}/index.cjs`);
    if (!newBundle.includes(Buffer.from("bulkgate_callback_processing_failed"))) fail("CALLBACK_FIX_NOT_BUILT");
    newBundleHash = sha(newBundle);
    command(process.execPath, ["--check", `${stage}/index.cjs`]);
    requireSameSnapshot(before);
    if (sha(fs.readFileSync(bundle)) !== sha(oldBundle) ||
        (fs.existsSync(envFile) ? sha(fs.readFileSync(envFile)) : sha(Buffer.alloc(0))) !== sha(oldEnv)) fail("LIVE_FILES_CHANGED_DURING_BUILD");
    if (sha(fs.readFileSync(`${ROOT}/dist/public/index.html`)) !== indexHash) fail("FRONTEND_CHANGED_DURING_BUILD");
    // Keep an existing token; otherwise create a 256-bit secret only on this server.
    const token = oldRuntime.BULKGATE_WEBHOOK_TOKEN || crypto.randomBytes(32).toString("hex");
    if (token.length < 16 || /[\r\n]/.test(token)) fail("EXISTING_TOKEN_REQUIRES_MANUAL_REVIEW");
    const callbackUrl = new URL("/api/auth/bulkgate/callback", ORIGIN);
    callbackUrl.searchParams.set("token", token);
    const settings = { BULKGATE_WEBHOOK_TOKEN: token, BULKGATE_WEBHOOK_URL: callbackUrl.href };
    newEnvBytes = Buffer.from(replaceEnv(oldEnv.toString("utf8"), settings));
    const configDir = path.dirname(URL_FILE);
    privateDir(`${HOME}/.config`);
    privateDir(configDir);
    if (fs.existsSync(URL_FILE) && !fs.lstatSync(URL_FILE).isFile()) fail("UNEXPECTED_CALLBACK_URL_FILE");
    if (fs.existsSync(URL_FILE)) atomicWrite(`${run}/old-webhook-url.txt`, fs.readFileSync(URL_FILE));
    console.log("BUILD_OK backend only; frontend files, uploads and database data are not replaced.");
    // All source/hash/backup checks completed before live changes.
    changed = true;
    command("git", ["merge", "--ff-only", RELEASE]);
    sourceApplied = true;
    sourceSnapshot(RELEASE);
    atomicWrite(bundle, newBundle, 0o644);
    backendApplied = true;
    atomicWrite(envFile, newEnvBytes);
    envApplied = true;
    atomicWrite(URL_FILE, `${callbackUrl.href}\n`);
    command("pm2", ["restart", "indexus-crm", "--update-env"], { env: { ...oldRuntime, ...settings } });
    await waitForRoot(indexHash);
    const current = processRow();
    if (current.pm2_env.status !== "online" || runtimeEnv(current).BULKGATE_WEBHOOK_TOKEN !== token) fail("RUNTIME_TOKEN_NOT_ACTIVE");
    const rejected = await callbackProbe();
    if (rejected.status !== 403) fail("UNAUTHENTICATED_CALLBACK_NOT_REJECTED");
    const accepted = await callbackProbe(token);
    if (accepted.status !== 200 || accepted.data?.received !== true || accepted.data?.processed !== 1) fail("AUTHENTICATED_CALLBACK_NOT_ACCEPTED");
    savePm2();
    console.log(`REPAIR_OK HEAD=${RELEASE}`);
    console.log("PUBLIC_CRM=OK CALLBACK_AUTH=OK UNAUTHENTICATED_CALLBACK=403");
    console.log(`PRIVATE_CALLBACK_URL_FILE=${URL_FILE}`);
    console.log("REAL_BULKGATE_SMS=NOT_YET_VERIFIED; update the provider callback URL, then replay its failed SMS callback.");
  } catch (error) {
    console.error(`REPAIR_STOPPED ${error.safeCode || "BUILD_OR_COMMAND_FAILED"}`);
    if (changed) {
      try {
        // Never overwrite a second operator's intervening changes.
        if (sourceApplied) {
          if (git(["rev-parse", "HEAD"]) !== RELEASE) fail("SOURCE_ROLLBACK_GUARD_FAILED");
          sourceSnapshot(RELEASE);
        }
        if (backendApplied && sha(fs.readFileSync(bundle)) !== newBundleHash) fail("BACKEND_ROLLBACK_GUARD_FAILED");
        if (envApplied && sha(fs.readFileSync(envFile)) !== sha(newEnvBytes)) fail("ENV_ROLLBACK_GUARD_FAILED");
        if (backendApplied) atomicWrite(bundle, oldBundle, 0o644);
        if (envApplied) { if (oldEnvExists) atomicWrite(envFile, oldEnv); else fs.unlinkSync(envFile); }
        if (sourceApplied) {
          for (const file of FILES) {
            const target = path.join(ROOT, file);
            if (before[file]) atomicWrite(target, gitBlob(BASE, file), 0o644);
            else if (fs.existsSync(target)) fs.unlinkSync(target);
          }
          command("git", ["update-ref", "refs/heads/main", BASE, RELEASE]);
          command("git", ["read-tree", BASE]);
        }
        if (fs.existsSync(`${run}/old-webhook-url.txt`)) atomicWrite(URL_FILE, fs.readFileSync(`${run}/old-webhook-url.txt`));
        else if (fs.existsSync(URL_FILE)) fs.unlinkSync(URL_FILE);
        command("pm2", ["restart", "indexus-crm", "--update-env"], { env: {
          ...oldRuntime, BULKGATE_WEBHOOK_TOKEN: oldRuntime.BULKGATE_WEBHOOK_TOKEN || "",
          BULKGATE_WEBHOOK_URL: oldRuntime.BULKGATE_WEBHOOK_URL || "",
        } });
        savePm2();
        console.error(`GUARDED_ROLLBACK_OK backup=${run}`);
      } catch { console.error(`ROLLBACK_GUARD_STOPPED; private backup=${run}`); }
    } else if (fs.existsSync(run)) console.error(`LIVE_APPLICATION_UNCHANGED backup=${run}`);
    process.exitCode = 1;
  } finally {
    fs.rmdirSync(lock);
  }
}
if (require.main === module) main().catch(error => {
  console.error(`REPAIR_STOPPED ${error.safeCode || "PRECHECK_FAILED"}`);
  process.exitCode = 1;
});
module.exports = { replaceEnv, runtimeEnv, FILES, BASE, RELEASE, main };
