"use strict";
// Approved backend-only prompt correction. No provider changes, worker restart,
// dependency installation, database migration/restore or live inference test.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const http = require("node:http");
const { createRequire } = require("node:module");
const APP = "/var/www/indexus-crm", DATA = APP + "/data";
const BASE = "328527d5699f4a13a30b9e945bf1bf5f59cb9f42";
const FILES = {
  "server/routes.ts": "2cd627e620c352f197c1b5856b48dcbeed9fd49936f6b71982c5ea279948c100",
  "server/lib/ai/email-reply-perspective.test.cjs": "2e1a51323b90dd1f4b2a75f15f565bc767ed6adb4e6f43d43561fbcfe0067363",
};
const BLOBS = {
  "server/routes.ts": "ba4548301cbda19142e31faafa5f5a3647eddd07",
  "server/lib/ai/email-reply-perspective.test.cjs": "e66f8981842d34a2565bbda9300f2218b3118af3",
};
const OLD = "03e956745252f86f73378e349bf686474fe334c760e3273319dfc454b38de871";
const INDEX = "1e1768754e6b3c810017b9baa50617b56060c9b5d7c0e675bb37f5e6f7813d7f";
const WORKER = "6fc5c55a2669129f0442ff9fccdeef9b22262a89144e86e58002a2b71700bf37";
const LOADER = "/etc/indexus-ai-runtime/preload.cjs";
const LOADER_HASH = "33af3aaff20605583f9152fcad2abe61ec0cef4c4ebe771e43f0cf7d87aa0fac";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const fileHash = file => sha(fs.readFileSync(file));
const fail = code => { throw Object.assign(Error(code), { safeCode: code }); };
const clean = () => Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !key.startsWith("PG") && !["NODE_OPTIONS", "NODE_PATH", "DATABASE_URL"].includes(key)));
function run(bin, args, options = {}) {
  return cp.execFileSync(bin, args, { encoding: "utf8", timeout: 30000,
    maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], env: clean(), ...options });
}
function validateRelease(git, target) {
  if (!/^[a-f0-9]{40}$/.test(target) || git(["rev-parse", `${target}^`]) !== BASE)
    fail("release_parent_changed");
  if (git(["diff", "--name-only", BASE, target]).split("\n").filter(Boolean).sort().join("\n") !==
      Object.keys(FILES).sort().join("\n")) fail("release_scope_changed");
  // Never buffer source blobs through execFileSync: routes.ts exceeds 2 MiB.
  // Full SHA-256 validation follows disk extraction, before tests or bundling.
  for (const [file, blob] of Object.entries(BLOBS))
    if (git(["rev-parse", `${target}:${file}`]) !== blob) fail("release_file_changed");
}
function assertPreserved(readHash, backend) {
  for (const [file, hash] of [[APP + "/dist/index.cjs", backend],
    [APP + "/dist/public/index.html", INDEX], [APP + "/dist/ai-worker.cjs", WORKER], [LOADER, LOADER_HASH]])
    if (readHash(file) !== hash) fail("runtime_changed");
}
async function sequence(ops) {
  await ops.prepare();
  await ops.build();
  await ops.recheck();
  try { await ops.promote(); await ops.verify(); await ops.success(); }
  catch (error) {
    try { await ops.rollback(); } catch { error.rollbackFailed = true; }
    throw error;
  }
}
function httpStatus(relative) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: "127.0.0.1", port: 5000, path: relative,
      timeout: 6000 }, response => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
    request.on("timeout", () => request.destroy(Error("timeout"))); request.on("error", reject);
  });
}
async function main(args) {
  if (args.length !== 2 || args[0] !== "--apply" || !/^[a-f0-9]{40}$/.test(args[1]))
    fail("explicit_pinned_apply_required");
  if (process.getuid() !== 0 || os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01")
    fail("root_on_corpcrm01_required");
  const target = args[1], mounts = JSON.parse(run("findmnt",
    ["--json", "--target", DATA, "--output", "SOURCE,TARGET"])).filesystems;
  if (mounts?.length !== 1 || mounts[0].source !== "/dev/sdb1" || mounts[0].target !== DATA ||
      fs.realpathSync(DATA) !== DATA) fail("approved_data_mount_required");
  const lock = DATA + "/ai-services-deployment-lock";
  try { fs.mkdirSync(lock, { mode: 0o700 }); } catch { fail("deployment_lock_exists"); }
  let stage, db, phase = "preflight", changed = false, newHash, user, pm2, appPid, workerPid, configHash;
  const req = createRequire(APP + "/package.json");
  const git = commands => run("git", ["--no-optional-locks", "-c", `safe.directory=${APP}`,
    "-c", "core.hooksPath=/dev/null", "-C", APP, ...commands]).trimEnd();
  const asUser = (bin, commands) => run("runuser", ["-u", "seman", "--", bin, ...commands],
    { env: { ...clean(), HOME: user.home, PM2_HOME: user.home + "/.pm2" } });
  const gitUser = commands => asUser("git", ["-c", "core.hooksPath=/dev/null", "-C", APP, ...commands]);
  const setPhase = name => { phase = name; console.log("PHASE=" + name); };
  function processes(expectedApp) {
    const rows = JSON.parse(asUser(pm2, ["jlist"]));
    const app = rows.filter(p => p.name === "indexus-crm"), worker = rows.filter(p =>
      p.name === "indexus-ai-worker" || p.pm2_env?.pm_exec_path === APP + "/dist/ai-worker.cjs");
    if (app.length !== 1 || worker.length !== 1) fail("process_identity_changed");
    if (worker[0].name !== "indexus-ai-worker") fail("process_identity_changed");
    for (const [p, script] of [[app[0], "index.cjs"], [worker[0], "ai-worker.cjs"]]) {
      if (p.pm2_env.status !== "online" || p.pm2_env.pm_cwd !== APP || !(p.pid > 0) ||
          p.pm2_env.pm_exec_path !== APP + "/dist/" + script || p.pm2_env.exec_mode !== "fork_mode" ||
          !/^Uid:\s+1001\s/m.test(fs.readFileSync(`/proc/${p.pid}/status`, "utf8")) ||
          fs.readlinkSync(`/proc/${p.pid}/cwd`) !== APP) fail("process_identity_changed");
    }
    if (app[0].pm_id !== 4 || expectedApp && app[0].pid !== expectedApp ||
        workerPid && worker[0].pid !== workerPid) fail("process_changed");
    return { app: app[0].pid, worker: worker[0].pid };
  }
  async function settings() {
    const result = await db.query("SELECT value FROM ai_router_configuration WHERE singleton=true");
    if (result.rows.length !== 1) fail("settings_unavailable");
    return sha(JSON.stringify(result.rows[0].value));
  }
  async function healthy(wait, backend) {
    const deadline = Date.now() + (wait ? 180000 : 10000);
    let stable = 0, pid;
    do {
      try {
        pid = processes().app;
        assertPreserved(fileHash, backend);
        if (await httpStatus("/") !== 200 || await httpStatus("/api/configurator/ai") !== 401)
          fail("http_unhealthy");
        const r = await db.query("SELECT count(*)::int AS count FROM ai_inference_workers WHERE heartbeat_at > now()-interval '30 seconds'");
        if (Number(r.rows[0]?.count) !== 1) fail("worker_not_ready");
        if (++stable >= (wait ? 3 : 1)) return pid;
      } catch { stable = 0; }
      if (!wait) break;
      await new Promise(resolve => setTimeout(resolve, 2000));
    } while (Date.now() < deadline);
    fail("health_failed");
  }
  function atomic(from, hash) {
    const temp = APP + "/dist/index.cjs.email-reply-promotion";
    const fd = fs.openSync(temp, "wx", 0o644);
    try { fs.writeFileSync(fd, fs.readFileSync(from)); fs.fchownSync(fd, 1001, user.gid); }
    finally { fs.closeSync(fd); }
    if (fileHash(temp) !== hash) fail("backend_copy_invalid");
    fs.renameSync(temp, APP + "/dist/index.cjs");
  }
  try {
    await sequence({
      async prepare() {
        setPhase("process_identity");
        const passwd = run("getent", ["passwd", "seman"]).trim().split(":");
        if (passwd[2] !== "1001" || !/^\d+$/.test(passwd[3])) fail("user_changed");
        user = { home: passwd[5], gid: Number(passwd[3]) };
        if (fs.readFileSync(user.home + "/.pm2/pm2.pid", "utf8").trim() !== "22545" ||
            !/^Uid:\s+1001\s/m.test(fs.readFileSync("/proc/22545/status", "utf8"))) fail("pm2_daemon_changed");
        pm2 = asUser("sh", ["-c", "command -v pm2"]).trim();
        const live = processes(); appPid = live.app; workerPid = live.worker;
        if (git(["rev-parse", "HEAD"]) !== BASE || git(["status", "--porcelain", "--untracked-files=no"]))
          fail("production_sources_changed");
        setPhase("release_identity");
        validateRelease(git, target);
        setPhase("runtime_identity");
        for (const directory of [APP, APP + "/dist", APP + "/dist/public"])
          if (fs.realpathSync(directory) !== directory) fail("runtime_symlink_rejected");
        for (const file of ["index.cjs", "ai-worker.cjs", "public/index.html"])
          if (!fs.lstatSync(APP + "/dist/" + file).isFile()) fail("runtime_symlink_rejected");
        assertPreserved(fileHash, OLD);
        const inherited = Object.fromEntries(fs.readFileSync(`/proc/${appPid}/environ`, "utf8").split("\0")
          .filter(s => s.includes("=")).map(s => { const i = s.indexOf("="); return [s.slice(0, i), s.slice(i + 1)]; }));
        const env = fs.existsSync(APP + "/.env") ? req("dotenv").parse(fs.readFileSync(APP + "/.env")) : {};
        const connectionString = inherited.DATABASE_URL || env.DATABASE_URL;
        if (!connectionString) fail("database_configuration_missing");
        setPhase("settings_readiness");
        db = new (req("pg").Client)({ connectionString, connectionTimeoutMillis: 10000 });
        await db.connect(); await db.query("SET default_transaction_read_only=on");
        configHash = await settings(); await healthy(false, OLD);
        setPhase("private_backup");
        stage = fs.mkdtempSync(DATA + "/email-reply-fix-"); fs.chmodSync(stage, 0o700);
        fs.copyFileSync(APP + "/dist/index.cjs", stage + "/previous-index.cjs");
        fs.chmodSync(stage + "/previous-index.cjs", 0o600);
        if (fileHash(stage + "/previous-index.cjs") !== OLD) fail("backup_invalid");
        fs.writeFileSync(stage + "/release.json", JSON.stringify({ base: BASE, target, files: FILES,
          backend: OLD, index: INDEX, worker: WORKER, workerPid, configHash }), { mode: 0o600 });
      },
      async build() {
        setPhase("private_backend_build");
        const view = stage + "/build"; fs.mkdirSync(view, { mode: 0o700 });
        run("git", ["-c", `safe.directory=${APP}`, "-C", APP, "archive", "--format=tar", `--output=${stage}/source.tar`, target,
          "server", "shared", "client/src", "script/build.ts", "script/build-server.ts",
          "package.json", "package-lock.json", "tsconfig.json"]);
        run("tar", ["-xf", stage + "/source.tar", "-C", view], { timeout: 120000 });
        for (const [file, expected] of Object.entries(FILES))
          if (fileHash(view + "/" + file) !== expected) fail("extracted_source_changed");
        const modules = view + "/node_modules"; fs.mkdirSync(modules);
        for (const entry of fs.readdirSync(APP + "/node_modules", { withFileTypes: true })) {
          if (entry.name.startsWith(".")) continue;
          if (entry.name.startsWith("@")) {
            fs.mkdirSync(modules + "/" + entry.name);
            for (const name of fs.readdirSync(APP + "/node_modules/" + entry.name))
              fs.symlinkSync(APP + "/node_modules/" + entry.name + "/" + name, modules + "/" + entry.name + "/" + name);
          } else fs.symlinkSync(APP + "/node_modules/" + entry.name, modules + "/" + entry.name);
        }
        const tests = run(process.execPath, ["--test", "server/lib/ai/email-reply-perspective.test.cjs"],
          { cwd: view, timeout: 120000 });
        fs.writeFileSync(stage + "/tests.log", tests, { mode: 0o600 });
        const text = fs.readFileSync(view + "/script/build.ts", "utf8");
        const match = text.match(/const allowlist = (\[[\s\S]*?\]);/);
        if (!match) fail("build_configuration_changed");
        const allowlist = JSON.parse(match[1].replace(/,\s*\]/g, "]"));
        const pkg = JSON.parse(fs.readFileSync(view + "/package.json", "utf8"));
        const external = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]
          .filter(name => !allowlist.includes(name));
        await req("esbuild").build({ absWorkingDir: view, entryPoints: ["server/index.ts"],
          platform: "node", bundle: true, format: "cjs", outfile: "dist/index.cjs",
          define: { "process.env.NODE_ENV": '"production"' }, minify: true, external, logLevel: "silent" });
        run(process.execPath, ["--check", view + "/dist/index.cjs"]);
        newHash = fileHash(view + "/dist/index.cjs");
        if (newHash === OLD) fail("backend_not_changed");
      },
      async recheck() {
        setPhase("recheck");
        processes(appPid); assertPreserved(fileHash, OLD);
        if (git(["rev-parse", "HEAD"]) !== BASE || git(["status", "--porcelain", "--untracked-files=no"]) ||
            await settings() !== configHash) fail("production_changed_during_build");
      },
      async promote() {
        setPhase("promote"); changed = true;
        gitUser(["merge", "--ff-only", target]);
        atomic(stage + "/build/dist/index.cjs", newHash);
        asUser(pm2, ["restart", "4"]);
      },
      async verify() {
        setPhase("verify");
        const pid = await healthy(true, newHash);
        if (pid === appPid || await settings() !== configHash) fail("post_deploy_verification_failed");
      },
      async success() {
        console.log(JSON.stringify({ mode: "email_reply_prompt_deployed", target,
          backupDirectory: stage, workerPid, workerUnchanged: true, providersUnchanged: true,
          frontendUnchanged: true, liveModelTestPerformed: false }, null, 2));
      },
      async rollback() {
        setPhase("rollback");
        if (!changed) return;
        const head = git(["rev-parse", "HEAD"]);
        if (head !== target && head !== BASE) fail("rollback_source_conflict");
        if (head === target) {
          if (git(["status", "--porcelain", "--untracked-files=no"])) fail("rollback_source_conflict");
          gitUser(["reset", "--keep", BASE]);
        }
        const current = fileHash(APP + "/dist/index.cjs");
        if (current !== newHash && current !== OLD) fail("rollback_backend_conflict");
        atomic(stage + "/previous-index.cjs", OLD);
        asUser(pm2, ["restart", "4"]); await healthy(true, OLD);
      },
    });
  } catch (error) {
    console.log(JSON.stringify({ mode: "email_reply_promotion_stopped", phase,
      code: error.safeCode || (error.code === "ENOBUFS" ? "operator_output_limit_exceeded" : "operator_operation_failed"),
      nativeCode: typeof error.code === "string" && /^[A-Z_0-9]{1,40}$/.test(error.code) ? error.code : undefined,
      backupDirectory: stage || null,
      rollbackFailed: !!error.rollbackFailed, databaseRestored: false }, null, 2));
    process.exitCode = 1;
  } finally {
    if (db) await db.end().catch(() => {});
    fs.rmdirSync(lock);
  }
}
module.exports = { BASE, FILES, BLOBS, run, validateRelease, assertPreserved, sequence, main };
if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error("STOP: " + (error.safeCode || "preflight_failed")); process.exitCode = 1;
});
