#!/usr/bin/env node
"use strict";
// Preparation only. Never changes live source, dist, configuration, DB schema or PM2.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const crypto = require("node:crypto"), cp = require("node:child_process");
const ROOT = "/var/www/indexus-crm", DATA = ROOT + "/data";
const BASE = "5d35161c258735f15ec71f7da8a25d97f7531ff1";
const TARGET = "52902d20b5bad42c60d543f365d33badae647f05";
const TREE = "294422da64d4f17cb9ee75d6f9f27ca88b3540fe";
const UID = 1001, EXPECTED_PID = 806258, EXPECTED_PARENT = 22545;
const BACKEND = "e078705eddd999079747038a2fad4dc8cd5e882bdce963e3648bf784e9d46f07";
const INDEX = "6d2a50b02d4cdce240866421ecc8e7d6bc75f6ce408630018db06cca4e5d6d7f";
const ALLOWED = new Set([
  "client/src/components/configurator/AISettingsTab.tsx",
  "client/src/i18n/ai-settings-translations.test.ts", "client/src/i18n/ai-settings-translations.ts",
  "client/src/i18n/translations.ts", "client/src/pages/configurator.tsx",
  "docs/ai-configurator-release.md", "docs/ai-gateway-contract-v1-proposal.md",
  "docs/ai-gateway-corpcrm01-preparation.md", "docs/ai-router-live-acceptance.md",
  "docs/ai-router-phase-1.md", "docs/ai-router-phase-2-internal.md",
  "ops/nginx/indexus-ai-gateway.location.conf", "package.json",
  "script/ai-router-live-check.ts", "script/check-ai-gateway-network.sh",
  "script/check-ai-gateway-network.test.cjs", "script/check-internal-ai-gateway.ts",
  "script/test-ai-router.sh", "script/test-ai-settings-ui.cjs", "script/tsconfig.ai-settings.json",
  "server/beratung-routes.ts", "server/config/ai-routing.ts", "server/inbound-routes.ts",
  "server/index.ts", "server/lib/ai-router-coverage.test.ts", "server/lib/ai-router.test.ts",
  "server/lib/ai-router.ts", "server/lib/ai-settings-bootstrap.ts",
  "server/lib/ai/admin-router.ts", "server/lib/ai/admin-runtime.ts",
  "server/lib/ai/internal-adapter.test.ts", "server/lib/ai/internal-adapter.ts",
  "server/lib/ai/internal-contract.ts", "server/lib/ai/legacy-request-fingerprints.json",
  "server/lib/ai/openai-adapter.ts", "server/lib/ai/router.ts", "server/lib/ai/service-catalog.ts",
  "server/lib/ai/settings-authorization.ts", "server/lib/ai/settings-check.ts",
  "server/lib/ai/settings-controller.ts", "server/lib/ai/settings-policy.ts",
  "server/lib/ai/settings-routes.db.test.ts", "server/lib/ai/settings-store.ts",
  "server/lib/ai/settings.test.ts", "server/lib/automation-analysis.ts",
  "server/lib/automation-routes.ts", "server/lib/beratung-email-service.ts",
  "server/lib/email-monitoring-service.ts", "server/lib/forwarded-call-reconciliation.ts",
  "server/lib/priority-city-ranking.ts", "server/lib/queue-engine.ts",
  "server/lib/region-suggestion.ts", "server/lib/representative-region-suggestions.ts",
  "server/lib/scraper-ai.ts", "server/lib/standing-recording-analysis.test.ts",
  "server/lib/standing-recording-analysis.ts", "server/lib/task-ai-checklist.ts",
  "server/lib/task-resolution-draft.ts", "server/lib/task-sentiment.ts",
  "server/lib/training-room-ws.ts", "server/lib/virtual-agent.ts",
  "server/routes.ts", "server/template-processor.ts", "shared/ai-settings.ts",
]);
const cleanEnv = () => ({ PATH: process.env.PATH, HOME: "/root", LANG: "C.UTF-8" });
function ensure(ok, code) { if (!ok) throw Error(code); }
function fileHash(file, algorithm = "sha256", prefix = "") {
  const h = crypto.createHash(algorithm).update(prefix), fd = fs.openSync(file, "r");
  try { const buffer = Buffer.alloc(1024 * 1024); let size;
    while ((size = fs.readSync(fd, buffer, 0, buffer.length, null))) h.update(buffer.subarray(0, size));
    return h.digest("hex");
  } finally { fs.closeSync(fd); }
}
function gitEntries(raw) {
  return raw.split("\0").filter(Boolean).map(line => {
    const tab = line.indexOf("\t"), [mode, type, sha] = line.slice(0, tab).split(" ");
    const name = line.slice(tab + 1);
    ensure(tab > 0 && type === "blob" && /^[a-f0-9]{40}$/.test(sha) &&
      ["100644", "100755", "120000"].includes(mode) && name && !path.isAbsolute(name) &&
      !name.split("/").includes(".."), "INVALID_GIT_TREE");
    return { mode, sha, name };
  });
}
function verifyFiles(root, entries, absent = []) {
  const canonical = fs.realpathSync(root);
  for (const e of entries) {
    const file = path.join(root, e.name), stat = fs.lstatSync(file);
    let actual;
    if (e.mode === "120000") {
      ensure(stat.isSymbolicLink(), "SOURCE_MODE_MISMATCH");
      const bytes = Buffer.from(fs.readlinkSync(file));
      actual = crypto.createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    } else {
      ensure(stat.isFile() && fs.realpathSync(file).startsWith(canonical + "/"), "UNSAFE_SOURCE");
      ensure((stat.mode & 0o111 ? "100755" : "100644") === e.mode, "SOURCE_MODE_MISMATCH");
      actual = fileHash(file, "sha1", `blob ${stat.size}\0`);
    }
    ensure(actual === e.sha, "SOURCE_BYTES_CHANGED");
  }
  for (const name of absent) {
    try { fs.lstatSync(path.join(root, name)); throw Error("UNTRACKED_SOURCE_COLLISION"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}
function databaseEnv(text, live = {}) {
  const line = text.split(/\r?\n/).find(l => l.startsWith("DATABASE_URL="));
  ensure(line, "DATABASE_CONFIGURATION_MISSING");
  let value = line.slice(13).trim();
  if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
  ensure(!live.DATABASE_URL || live.DATABASE_URL === value, "LIVE_DATABASE_CONFIGURATION_DIFFERS");
  const url = new URL(value);
  ensure(["postgres:", "postgresql:"].includes(url.protocol), "INVALID_DATABASE_CONFIGURATION");
  const env = { PGHOST: decodeURIComponent(url.hostname), PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGCONNECT_TIMEOUT: "10",
    PGPASSFILE: "/dev/null", PGAPPNAME: "indexus-ai-release-prepare" };
  const options = { sslmode: "PGSSLMODE", sslrootcert: "PGSSLROOTCERT", sslcert: "PGSSLCERT",
    sslkey: "PGSSLKEY", sslpassword: "PGSSLPASSWORD", channel_binding: "PGCHANNELBINDING",
    options: "PGOPTIONS", connect_timeout: "PGCONNECT_TIMEOUT", application_name: "PGAPPNAME" };
  for (const [key, val] of url.searchParams) {
    ensure(Object.hasOwn(options, key), "UNSUPPORTED_DATABASE_URL_OPTION");
    env[options[key]] = val;
  }
  ensure(env.PGHOST && env.PGUSER && env.PGDATABASE, "INCOMPLETE_DATABASE_CONFIGURATION");
  env.PGOPTIONS = (env.PGOPTIONS || "") + " -c default_transaction_read_only=on";
  return env;
}
function selectedEnvironment(raw) {
  const allowed = ["DATABASE_URL", "PORT", "INDEXUS_AI_GATEWAY_ENABLED"];
  return Object.fromEntries(raw.split("\0").filter(s => allowed.some(k => s.startsWith(k + "=")))
    .map(s => [s.slice(0, s.indexOf("=")), s.slice(s.indexOf("=") + 1)]));
}
function testGuardSource() {
  return 'const pg=require(require.resolve("pg",{paths:[process.cwd()]}));for(const cls of [pg.Pool,pg.Client])for(const k of ["connect","query"])cls.prototype[k]=function(){throw Error("PRODUCTION_DATABASE_ACCESS_BLOCKED_IN_TEST")};';
}
function artifactManifest(root, prefix = "") {
  return fs.readdirSync(path.join(root, prefix)).sort().flatMap(name => {
    const relative = prefix ? prefix + "/" + name : name, file = path.join(root, relative);
    const stat = fs.lstatSync(file);
    if (stat.isDirectory()) return artifactManifest(root, relative);
    ensure(stat.isFile(), "UNSAFE_BUILD_ARTIFACT");
    return [{ path: relative, bytes: stat.size, sha256: fileHash(file) }];
  });
}
function main(args = process.argv.slice(2)) {
  ensure(args.length === 1 && args[0] === "--prepare", "ONLY_PREPARE_IS_SUPPORTED");
  ensure(os.hostname().toUpperCase() === "CORPCRM01" && process.getuid() === 0, "ROOT_ON_CORPCRM01_REQUIRED");
  let phase = "identity", privateRoot, view, mounted = false;
  const baseEnv = cleanEnv();
  function run(bin, argv, options = {}) {
    try { return cp.execFileSync(bin, argv, { cwd: ROOT, env: baseEnv, encoding: "utf8",
      timeout: 60000, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...options }); }
    catch { throw Error("COMMAND_FAILED_" + bin.replace(/[^a-z0-9_-]/gi, "_")); }
  }
  const git = argv => run("git", ["--no-optional-locks", "-c", "safe.directory=" + ROOT,
    "-c", "core.fsmonitor=false", "-C", ROOT, ...argv]).trim();
  function mark(name) { phase = name; console.log("AI_PREPARE_PHASE=" + name); }
  function processProof() {
    const p = `/proc/${EXPECTED_PID}`;
    ensure(fs.statSync(p).uid === UID && fs.realpathSync(p + "/cwd") === ROOT, "LIVE_PROCESS_CHANGED");
    const stat = fs.readFileSync(p + "/stat", "utf8");
    ensure(Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]) === EXPECTED_PARENT, "PM2_PARENT_CHANGED");
    ensure(fs.statSync(`/proc/${EXPECTED_PARENT}`).uid === UID &&
      fs.readFileSync(`/proc/${EXPECTED_PARENT}/comm`, "utf8").startsWith("PM2"), "WRONG_PM2_DAEMON");
    return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
  }
  function logged(name, bin, argv, options = {}) {
    const fd = fs.openSync(path.join(privateRoot, name + ".log"), "wx", 0o600);
    try { run(bin, argv, { timeout: 30 * 60 * 1000, stdio: ["ignore", fd, fd], ...options }); }
    finally { fs.closeSync(fd); }
  }
  function health(port) {
    ensure(/^\d+$/.test(String(port)) && +port > 0 && +port < 65536, "INVALID_PORT");
    const base = "http://127.0.0.1:" + port;
    ensure(run("curl", ["-sS", "--max-time", "10", "-o", "/dev/null", "-w", "%{http_code}", base + "/"]) === "200", "APP_NOT_HEALTHY");
    ensure(run("curl", ["-sS", "--max-time", "10", "-o", "/dev/null", "-w", "%{http_code}", base + "/api/users"]) === "401", "AUTH_GATE_NOT_HEALTHY");
  }
  function appDenied(file) {
    const result = run("runuser", ["-u", "seman", "--", "node", "-e",
      'try{require("fs").readFileSync(process.argv[1]);process.stdout.write("READABLE")}catch(e){process.stdout.write(e.code||"UNKNOWN")}', file]);
    ensure(result === "EACCES", "PRIVATE_DISK_ACCESS_NOT_DENIED");
  }
  try {
    ensure(run("id", ["-u", "seman"]).trim() === String(UID), "WRONG_OPERATOR_UID");
    const started = processProof();
    const live = selectedEnvironment(fs.readFileSync(`/proc/${EXPECTED_PID}/environ`, "utf8"));
    ensure(live.INDEXUS_AI_GATEWAY_ENABLED !== "true", "INTERNAL_GATEWAY_MUST_REMAIN_DISABLED");
    const port = live.PORT || "5000";
    health(port);
    ensure(git(["rev-parse", "HEAD"]) === BASE, "PRODUCTION_HEAD_CHANGED");
    ensure(git(["rev-parse", TARGET + "^{tree}"]) === TREE, "WRONG_RELEASE_TREE");
    ensure(!git(["diff", "--cached", "--name-only"]), "STAGED_PRODUCTION_CHANGES");
    ensure(!git(["diff", "--name-only", BASE, "--", "client", "server", "shared",
      "script", "package.json", "package-lock.json"]), "DIRTY_PRODUCTION_SOURCES");
    const changed = git(["diff", "--name-only", BASE, TARGET]).split("\n").filter(Boolean);
    ensure(changed.length === ALLOWED.size && changed.every(p => ALLOWED.has(p)), "UNREVIEWED_RELEASE_SCOPE");
    const baseRows = gitEntries(git(["ls-tree", "-rz", BASE, "--", ...changed]));
    const baseNames = new Set(baseRows.map(e => e.name));
    const absent = changed.filter(p => !baseNames.has(p));
    verifyFiles(ROOT, baseRows, absent);
    ensure(fileHash(ROOT + "/dist/index.cjs") === BACKEND && fileHash(ROOT + "/dist/public/index.html") === INDEX,
      "LIVE_BUILD_CHANGED");
    const envFile = ROOT + "/.env";
    ensure(fs.lstatSync(envFile).isFile(), "ENV_FILE_MUST_BE_REGULAR");
    const pgEnv = { ...baseEnv, ...databaseEnv(fs.readFileSync(envFile, "utf8"), live) };
    const query = sql => run("psql", ["-X", "-w", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
      { env: pgEnv }).trim();
    mark("database_read_only_precheck");
    const db = JSON.parse(query("SELECT json_build_object('size',pg_database_size(current_database()),'schema',current_schema(),'has_ai',to_regclass('public.ai_router_configuration') IS NOT NULL)"));
    ensure(db.schema === "public" && Number.isSafeInteger(+db.size) && +db.size > 0, "DATABASE_SCHEMA_REVIEW_REQUIRED");
    ensure(!db.has_ai, "EXISTING_AI_CONFIGURATION_REQUIRES_REVIEW");
    mark("approved_private_disk");
    const mount = JSON.parse(run("findmnt", ["-b", "-J", "-T", DATA, "-o", "SOURCE,TARGET,AVAIL"])).filesystems[0];
    ensure(fs.realpathSync(String(mount.source).replace(/\[.*$/, "")) === "/dev/sdb1" && mount.target === DATA, "WRONG_BACKUP_DISK");
    const sourceBytes = git(["ls-tree", "-rl", TARGET]).split("\n").reduce((n, line) => n + (+line.split("\t")[0].trim().split(/\s+/)[3] || 0), 0);
    const distBytes = +run("du", ["-sb", ROOT + "/dist"]).split(/\s+/)[0];
    ensure(+mount.avail > 3 * sourceBytes + 3 * distBytes + 3 * +db.size + 2 ** 30, "INSUFFICIENT_PRIVATE_DISK_SPACE");
    privateRoot = fs.mkdtempSync(DATA + "/.ai-release-private-");
    fs.chmodSync(privateRoot, 0o700);
    ensure(fs.statSync(privateRoot).uid === 0 && (fs.statSync(privateRoot).mode & 0o777) === 0o700, "UNSAFE_PRIVATE_PARENT");
    fs.writeFileSync(privateRoot + "/privacy-canary.txt", crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
    appDenied(privateRoot + "/privacy-canary.txt");
    const response = run("curl", ["-sS", "--max-time", "10", "-o", privateRoot + "/canary-response", "-w", "%{http_code}",
      `http://127.0.0.1:${port}/data/${path.basename(privateRoot)}/privacy-canary.txt`]);
    ensure(["403", "404", "500"].includes(response) &&
      !fs.readFileSync(privateRoot + "/canary-response").includes(fs.readFileSync(privateRoot + "/privacy-canary.txt")), "HTTP_PRIVATE_STORAGE_NOT_PROVEN");
    health(port);
    mark("private_runtime_source_and_database_backup");
    logged("runtime-backup", "tar", ["--acls", "--xattrs", "-cpf", privateRoot + "/runtime.tar", "-C", ROOT, "dist", ".env"]);
    logged("runtime-archive-check", "tar", ["-tf", privateRoot + "/runtime.tar"]);
    logged("source-backup", "git", ["-c", "safe.directory=" + ROOT, "-C", ROOT, "archive",
      "--output=" + privateRoot + "/source-base.tar", BASE, "--", ...baseRows.map(e => e.name)]);
    logged("database-backup", "pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--no-password",
      "--file=" + privateRoot + "/database.dump"], { env: pgEnv });
    logged("database-dump-check", "pg_restore", ["--list", privateRoot + "/database.dump"]);
    mark("private_build_view");
    fs.mkdirSync(privateRoot + "/build", { mode: 0o700 });
    fs.chownSync(privateRoot + "/build", UID, +run("id", ["-g", "seman"]).trim());
    view = fs.mkdtempSync("/tmp/indexus-ai-build-view-");
    run("mount", ["--bind", privateRoot + "/build", view]); mounted = true;
    ensure(fs.statSync(view).dev === fs.statSync(DATA).dev &&
      fs.statSync(view).ino === fs.statSync(privateRoot + "/build").ino, "BUILD_NOT_ON_APPROVED_DISK");
    logged("source-archive", "git", ["-c", "safe.directory=" + ROOT, "-C", ROOT, "archive", "--output=" + view + "/source.tar", TARGET]);
    run("chown", [`${UID}:${run("id", ["-g", "seman"]).trim()}`, view + "/source.tar"]);
    logged("source-extract", "runuser", ["-u", "seman", "--", "tar", "-xf", view + "/source.tar", "-C", view]);
    fs.unlinkSync(view + "/source.tar");
    const targetRows = gitEntries(git(["ls-tree", "-rz", TARGET]));
    ensure(!targetRows.some(e => [".env", ".env.production", ".env.local"].includes(e.name)),
      "TRACKED_ENVIRONMENT_FILE_REQUIRES_REVIEW");
    verifyFiles(view, targetRows);
    for (const key of ["dependencies", "devDependencies", "optionalDependencies"]) {
      const current = JSON.parse(fs.readFileSync(ROOT + "/package.json", "utf8"));
      const next = JSON.parse(fs.readFileSync(view + "/package.json", "utf8"));
      ensure(JSON.stringify(current[key]) === JSON.stringify(next[key]), "DEPENDENCY_CHANGE_NOT_ALLOWED");
    }
    ensure(fileHash(ROOT + "/package-lock.json") === fileHash(view + "/package-lock.json"), "LOCKFILE_CHANGE_NOT_ALLOWED");
    fs.symlinkSync(ROOT + "/node_modules", view + "/node_modules");
    const testGuard = view + "/ai-release-test-guard.cjs";
    fs.writeFileSync(testGuard, testGuardSource(), { mode: 0o600 });
    fs.chownSync(testGuard, UID, +run("id", ["-g", "seman"]).trim());
    const operatorEnv = { PATH: baseEnv.PATH, HOME: "/home/seman", LANG: "C.UTF-8" };
    mark("pinned_build");
    logged("build", "runuser", ["-u", "seman", "--", "npm", "run", "build"], { cwd: view, env: operatorEnv });
    mark("ai_typecheck");
    logged("typecheck", "runuser", ["-u", "seman", "--", "./node_modules/.bin/tsc", "--noEmit", "-p", "script/tsconfig.ai-settings.json"],
      { cwd: view, env: operatorEnv });
    mark("database_blocked_regressions");
    const testEnv = { ...operatorEnv, NODE_ENV: "test", NODE_OPTIONS: "--require=" + testGuard,
      DATABASE_URL: "postgresql://ai_release_test:unused@127.0.0.1:1/ai_release_test" };
    logged("router-tests", "runuser", ["-u", "seman", "--", "bash", "script/test-ai-router.sh"], { cwd: view, env: testEnv });
    logged("settings-tests", "runuser", ["-u", "seman", "--", "./node_modules/.bin/tsx", "--test",
      "server/lib/ai/settings.test.ts", "client/src/i18n/ai-settings-translations.test.ts"], { cwd: view, env: testEnv });
    mark("unchanged_live_application");
    verifyFiles(view, targetRows); verifyFiles(ROOT, baseRows, absent);
    ensure(git(["rev-parse", "HEAD"]) === BASE && processProof() === started, "PRODUCTION_CHANGED_DURING_PREPARATION");
    ensure(fileHash(ROOT + "/dist/index.cjs") === BACKEND && fileHash(ROOT + "/dist/public/index.html") === INDEX, "LIVE_BUILD_CHANGED");
    health(port);
    ensure(fs.existsSync(view + "/dist/index.cjs") && fs.existsSync(view + "/dist/public/index.html"), "MISSING_CANDIDATE_BUILD");
    const artifacts = artifactManifest(view + "/dist");
    fs.writeFileSync(privateRoot + "/candidate-artifacts.json", JSON.stringify(artifacts, null, 2), { mode: 0o600 });
    const report = { status: "PREPARED_NOT_DEPLOYED", base: BASE, target: TARGET, tree: TREE,
      createdAt: new Date().toISOString(), pid: EXPECTED_PID, uid: UID, processStart: started, port,
      backup: privateRoot, changedPaths: changed,
      live: { backend: BACKEND, index: INDEX }, built: { backend: fileHash(view + "/dist/index.cjs"),
        index: fileHash(view + "/dist/public/index.html"), files: artifacts.length,
        manifestSha256: fileHash(privateRoot + "/candidate-artifacts.json") },
      backupChecksums: { runtimeTar: fileHash(privateRoot + "/runtime.tar"), sourceTar: fileHash(privateRoot + "/source-base.tar") },
      databaseDump: { sha256: fileHash(privateRoot + "/database.dump"), verified: true },
      build: "passed", aiTypecheck: "passed", databaseBlockedTests: "passed",
      startupOfCandidate: "not_attempted", internalAI: "not_enabled", gatewayToken: "not_transferred" };
    fs.writeFileSync(privateRoot + "/prepared.json", JSON.stringify(report, null, 2), { mode: 0o600 });
    fs.writeFileSync(privateRoot + "/BACKUP_VERIFIED", "Custom dump listed; runtime archive listed; originals retained.\n", { mode: 0o600 });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: "PREPARE_FAILED_NO_PROMOTION", phase,
      code: /^[A-Z0-9_]+$/.test(error.message || "") ? error.message : "PRIVATE_DETAILS_NOT_PRINTED",
      privateLogs: privateRoot || null, liveSourceAndBuildPromoted: false }));
    process.exitCode = 1;
  } finally {
    if (mounted) { try { run("umount", [view]); mounted = false; } catch { console.error("BUILD_VIEW_UNMOUNT_FAILED_REQUIRES_OPERATOR"); process.exitCode = 1; } }
    if (view && !mounted) { try { fs.rmdirSync(view); } catch {} }
  }
}
module.exports = { gitEntries, verifyFiles, databaseEnv, selectedEnvironment, fileHash, testGuardSource, artifactManifest, main, ALLOWED, BASE, TARGET, TREE };
if (require.main === module) {
  try { main(); } catch { console.error("AI_PREPARE_REFUSED_NO_OPERATION"); process.exitCode = 1; }
}
