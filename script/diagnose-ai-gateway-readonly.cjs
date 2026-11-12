#!/usr/bin/env node
"use strict";
// Operator inventory only. No application imports, PM2 CLI, Gateway calls,
// configuration writes, token-file reads, migrations, or service restarts.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const cp = require("node:child_process"), crypto = require("node:crypto");
const ROOT = "/var/www/indexus-crm", HOME = "/home/seman/.pm2";
const TOKEN = "/etc/indexus-ai/gateway-token", DATA = ROOT + "/data";
const BASE = "52902d20b5bad42c60d543f365d33badae647f05";
const BUILT = "f6183a3f0766eeb3446de366b9fac38c42f92817d0a9801cc402dc036957687d";
const KEYS = ["DATABASE_URL", "OPENAI_API_KEY", "NODE_OPTIONS", "NODE_ENV",
  "INDEXUS_AI_ROUTER_MODE", "INDEXUS_AI_GATEWAY_ENABLED", "INDEXUS_AI_GATEWAY_BASE_URL",
  "INDEXUS_AI_GATEWAY_TOKEN"];
const cleanEnv = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  HOME: "/root", LANG: "C.UTF-8" };
function ensure(ok, code) { if (!ok) throw Error(code); }
function errorCode(error) {
  return /^[A-Z][A-Z0-9_]{1,79}$/.test(error?.code || "") ? error.code :
    /^[A-Z][A-Z0-9_]{1,79}$/.test(error?.message || "") ? error.message : "CHECK_UNAVAILABLE";
}
function run(bin, args) {
  return cp.execFileSync(bin, args, { env: cleanEnv, encoding: "utf8",
    timeout: 12000, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function hash(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function noLinks(file) {
  let current = "/";
  for (const part of path.resolve(file).slice(1).split("/")) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    ensure(!stat?.isSymbolicLink(), "SYMLINK_REQUIRES_REVIEW");
  }
}
function read(file, limit = 8 * 1024 * 1024) {
  noLinks(file);
  ensure(fs.statSync(file).isFile() && fs.statSync(file).size <= limit, "FILE_REQUIRES_REVIEW");
  return fs.readFileSync(file, "utf8");
}
function metadata(file) {
  noLinks(file);
  const s = fs.statSync(file);
  const result = { uid: s.uid, gid: s.gid, mode: (s.mode & 0o7777).toString(8),
    directory: s.isDirectory() };
  try {
    const acl = run("getfacl", ["-cp", "--", file]);
    result.extendedACL = /^(?:default:|user:[^:]|group:[^:]|mask:)/m.test(acl);
  } catch { result.extendedACL = "unknown"; }
  return result;
}
function parseEnvironment(raw) {
  return Object.fromEntries(raw.split("\0").filter(Boolean).map(item => {
    const i = item.indexOf("="); return [item.slice(0, i), item.slice(i + 1)];
  }).filter(([key]) => KEYS.includes(key) || ["PM2_HOME", "pm_id"].includes(key)));
}
function environmentSummary(env) {
  return {
    openaiPresent: !!env.OPENAI_API_KEY, databasePresent: !!env.DATABASE_URL,
    gatewayTokenPresent: !!env.INDEXUS_AI_GATEWAY_TOKEN,
    routerMode: env.INDEXUS_AI_ROUTER_MODE === undefined ? "default_routed" :
      ["routed", "legacy"].includes(env.INDEXUS_AI_ROUTER_MODE) ? env.INDEXUS_AI_ROUTER_MODE : "other",
    gatewayEnabled: env.INDEXUS_AI_GATEWAY_ENABLED === "true",
    gatewayFlagRecognized: [undefined, "", "true", "false"].includes(env.INDEXUS_AI_GATEWAY_ENABLED),
    approvedGatewayURL: env.INDEXUS_AI_GATEWAY_BASE_URL === undefined ? null :
      env.INDEXUS_AI_GATEWAY_BASE_URL === "https://ai.cordbloodcenter.com/gateway/",
    nodeOptionsPresent: !!env.NODE_OPTIONS, production: env.NODE_ENV === "production",
  };
}
function equality(a, b, key) {
  return a[key] === undefined || b[key] === undefined ? null : a[key] === b[key];
}
function processInfo(pid) {
  const root = "/proc/" + pid, raw = fs.readFileSync(root + "/stat", "utf8");
  const fields = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
  return { pid: +pid, uid: fs.statSync(root).uid, parent: +fields[1], start: fields[19],
    cwd: fs.realpathSync(root + "/cwd"), executable: fs.realpathSync(root + "/exe") };
}
function routeSummary(value, ids) {
  ensure(value && typeof value === "object" && !Array.isArray(value) &&
    value.routes && typeof value.routes === "object" && !Array.isArray(value.routes), "INVALID_AI_SETTINGS");
  const routes = value.routes;
  const unknown = Object.keys(routes).filter(id => !ids.includes(id)).length;
  const services = ids.map(id => {
    const r = Object.hasOwn(routes, id) ? routes[id] : { provider: "openai", enabled: true, model: null };
    return { id, provider: ["openai", "internal"].includes(r?.provider) ? r.provider : "invalid",
      enabled: typeof r?.enabled === "boolean" ? r.enabled : null,
      modelOverride: r?.model != null };
  });
  return { gatewayEnabled: typeof value.gateway?.enabled === "boolean" ? value.gateway.enabled : null,
    explicitOverrides: Object.keys(routes).length, unknownServices: unknown,
    allServicesOpenAI: ids.length > 0 && unknown === 0 && services.every(s => s.provider === "openai"),
    allServicesEnabled: services.every(s => s.enabled === true),
    noModelOverrides: services.every(s => !s.modelOverride), services };
}
function safeUnit(raw) {
  const p = Object.fromEntries(raw.split("\n").map(line => {
    const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)];
  }));
  return { userIsSeman: p.User === "seman", enabled: p.UnitFileState === "enabled",
    active: p.ActiveState === "active", mainPID: /^\d+$/.test(p.MainPID) ? +p.MainPID : null,
    resurrectCommand: /\bpm2\b[^;\n]*\bresurrect\b/.test(p.ExecStart || ""),
    homeMatches: (p.Environment || "").includes("PM2_HOME=" + HOME),
    environmentFilesPresent: !!p.EnvironmentFiles,
    dropInsPresent: !!p.DropInPaths, fragmentPresent: !!p.FragmentPath,
    configurationFingerprint: hash(raw) };
}
async function main(args = process.argv.slice(2)) {
  ensure(args.length === 1 && args[0] === "--read-only", "READ_ONLY_ARGUMENT_REQUIRED");
  ensure(os.hostname().toUpperCase() === "CORPCRM01" && process.getuid() === 0, "ROOT_ON_CORPCRM01_REQUIRED");
  const report = { status: "READ_ONLY_INVENTORY", at: new Date().toISOString(),
    productionChanges: false, gatewayRequests: 0, tokenFileContentRead: false,
    restartPerformed: false, rebootVerified: false, sections: {} };
  const section = (name, fn) => {
    try { return report.sections[name] = fn(); }
    catch (e) { return report.sections[name] = { unavailable: errorCode(e) }; }
  };
  const uid = +run("id", ["-u", "seman"]), gid = +run("id", ["-g", "seman"]);
  const processes = [];
  for (const pid of fs.readdirSync("/proc").filter(p => /^\d+$/.test(p))) {
    try {
      const p = processInfo(pid);
      if (p.cwd === ROOT && p.uid === uid && /^node(?:js)?$/.test(path.basename(p.executable))) processes.push(p);
    } catch {}
  }
  report.sections.processes = processes;
  ensure(processes.length === 1, "EXPECTED_ONE_INDEXUS_NODE_PROCESS");
  const live = processes[0], env = parseEnvironment(fs.readFileSync("/proc/" + live.pid + "/environ", "utf8"));
  const daemon = processInfo(live.parent);
  section("pm2Daemon", () => ({
    ...daemon, uidMatches: daemon.uid === uid,
    commMatches: fs.readFileSync("/proc/" + daemon.pid + "/comm", "utf8").startsWith("PM2"),
    pidFileMatches: read(HOME + "/pm2.pid").trim() === String(daemon.pid),
  }));
  report.sections.initialProcessEnvironment = environmentSummary(env);
  report.sections.environmentEvidenceLimit =
    "/proc shows initial environment; dotenv/preload changes made after exec may not appear. Presence is not a live-provider test.";
  section("runtime", () => {
    const argv = fs.readFileSync("/proc/" + live.pid + "/cmdline", "utf8").split("\0").filter(Boolean);
    return { nodeVersion: run(live.executable, ["--version"]),
      builtinCommonJSPreload: run(live.executable, ["--require", "node:fs", "-e",
        "process.stdout.write(typeof require('node:fs').readFileSync==='function'?'supported':'unsupported')"]),
      commandLineHasPreload: argv.some(a => /^(?:--require(?:=|$)|-r$|--import(?:=|$))/.test(a)),
      commandLineHasEnvFile: argv.some(a => /^--env-file(?:=|$)/.test(a)),
      customLoaderTested: false, initialNodeOptionsPresent: !!env.NODE_OPTIONS,
      processCommandLineRedacted: true };
  });
  let dotenv = {};
  section("dotenv", () => {
    const bytes = read(ROOT + "/.env");
    const parser = require(ROOT + "/node_modules/dotenv");
    dotenv = parser.parse(bytes);
    return { metadata: metadata(ROOT + "/.env"), presence: environmentSummary(dotenv),
      openaiMatchesInitialProcess: equality(dotenv, env, "OPENAI_API_KEY"),
      databaseMatchesInitialProcess: equality(dotenv, env, "DATABASE_URL"),
      fileFingerprintSuppressed: true };
  });
  section("ecosystem", () => {
    const text = read(ROOT + "/ecosystem.config.cjs");
    // Never require/evaluate an operator-authored ecosystem file.
    return { metadata: metadata(ROOT + "/ecosystem.config.cjs"), fingerprint: hash(text),
      staticHintsOnly: true, mentionsIndexus: text.includes("indexus-crm"),
      mentionsDotenv: /dotenv|env_file|--env-file/.test(text),
      mentionsNodeArgs: /node_args|interpreter_args/.test(text),
      mentionsNodeOptions: text.includes("NODE_OPTIONS"), mentionsGateway: /INDEXUS_AI_GATEWAY_/.test(text),
      mentionsOpenAI: text.includes("OPENAI_API_KEY"), contentRedacted: true };
  });
  section("savedPM2", () => {
    const rows = JSON.parse(read(HOME + "/dump.pm2"));
    ensure(Array.isArray(rows), "INVALID_PM2_DUMP");
    const chosen = rows.filter(r => r.name === "indexus-crm");
    ensure(chosen.length === 1, "SAVED_INDEXUS_COUNT_MISMATCH");
    const r = chosen[0], saved = { ...r, ...(r.env || {}) };
    return { metadata: metadata(HOME + "/dump.pm2"), applicationCount: rows.length,
      savedIndexusCount: chosen.length, id: Number.isInteger(r.pm_id) ? r.pm_id : null,
      cwdMatches: r.pm_cwd === ROOT, scriptMatches: r.pm_exec_path === ROOT + "/dist/index.cjs",
      forkMode: r.exec_mode === "fork_mode", instances: Number.isInteger(+r.instances) ? +r.instances : null,
      nodeArgsPresent: !!r.node_args?.length, presence: environmentSummary(saved),
      openaiMatchesInitialProcess: equality(saved, env, "OPENAI_API_KEY"),
      openaiMatchesDotenv: equality(saved, dotenv, "OPENAI_API_KEY"),
      databaseMatchesInitialProcess: equality(saved, env, "DATABASE_URL"),
      savedStateMayBeStale: true };
  });
  section("automaticStart", () => safeUnit(run("systemctl", ["show", "pm2-seman.service", "--no-pager",
    "--property=User,UnitFileState,ActiveState,MainPID,ExecStart,Environment,EnvironmentFiles,FragmentPath,DropInPaths"])));
  section("startupFiles", () => {
    const files = ["/etc/systemd/system/pm2-seman.service", "/etc/systemd/system/pm2-seman.service.d",
      "/etc/rc.local", "/var/spool/cron/crontabs/seman"];
    return Object.fromEntries(files.map(file => {
      try { return [file, metadata(file)]; } catch { return [file, { missingOrUnavailable: true }]; }
    }));
  });
  section("tokenMetadataOnly", () => ({
    source: metadata(TOKEN), parent: metadata(path.dirname(TOKEN)),
    originalExpectedRoot0600: (() => { const s = fs.statSync(TOKEN); return s.uid === 0 && s.gid === 0 &&
      (s.mode & 0o7777) === 0o600 && s.isFile(); })(),
    proposedDirectoryExists: fs.existsSync("/etc/indexus-ai-runtime"),
    serviceUID: uid, servicePrimaryGID: gid,
    primaryGroupOtherAccounts: read("/etc/passwd").split("\n").filter(line => {
      const p = line.split(":"); return +p[3] === gid && +p[2] !== uid && p[0];
    }).length,
    supplementaryMembershipCount: read("/etc/group").split("\n").filter(line => {
      const p = line.split(":"); return +p[2] === gid;
    }).flatMap(line => line.split(":")[3]?.split(",").filter(n => n && n !== "seman") || []).length,
  }));
  section("backupStorage", () => {
    const m = JSON.parse(run("findmnt", ["-b", "-J", "-T", DATA, "-o", "SOURCE,TARGET,AVAIL,FSTYPE,OPTIONS"])).filesystems[0];
    const diskMatches = m.source === "/dev/sdb1" && m.target === DATA;
    const candidate = DATA + "/.ai-gateway-private";
    return { approvedDiskMounted: diskMatches, availableBytes: +m.avail,
      readWriteMount: String(m.options).split(",").includes("rw"), dataDirectory: metadata(DATA),
      futurePrivateBackupDirectory: candidate,
      existingCandidate: fs.existsSync(candidate) ? metadata(candidate) : null,
      privateBackupCreated: false, privacyAndCapacityMustBeRevalidatedBeforeAnyWrite: true };
  });
  section("applicationBaseline", () => {
    const head = run("runuser", ["-u", "seman", "--", "git", "--no-optional-locks", "-C", ROOT, "rev-parse", "HEAD"]);
    const backend = fs.readFileSync(ROOT + "/dist/index.cjs");
    return { head: /^[a-f0-9]{40}$/.test(head) ? head : "unrecognized", matchesApprovedHead: head === BASE,
      backendSHA256: hash(backend), matchesApprovedBackend: hash(backend) === BUILT,
      builtinDotenvHint: /dotenv\/config|dotenv\.config|dotenv\.configDotenv/.test(backend.toString("utf8")),
      staticRoutingSourceMatchesApproved: read(ROOT + "/server/config/ai-routing.ts")
        .includes("AI_ROUTING_OVERRIDES: AIRoutingOverrides = Object.freeze({})") };
  });
  let client;
  try {
    ensure(!env.DATABASE_URL || !dotenv.DATABASE_URL || env.DATABASE_URL === dotenv.DATABASE_URL,
      "DATABASE_SOURCES_DIFFER");
    const connectionString = env.DATABASE_URL || dotenv.DATABASE_URL;
    ensure(connectionString, "DATABASE_CONFIGURATION_MISSING");
    const { Client } = require(ROOT + "/node_modules/pg");
    const ids = [...read(ROOT + "/server/lib/ai/service-catalog.ts").matchAll(/^\s*"([a-z0-9_.]+)":\s*"/gm)].map(m => m[1]);
    ensure(ids.length > 0 && new Set(ids).size === ids.length, "SERVICE_CATALOG_UNAVAILABLE");
    client = new Client({ connectionString, connectionTimeoutMillis: 6000, query_timeout: 8000,
      application_name: "indexus-ai-readonly-inventory",
      options: "-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=1000" });
    client.on("error", () => {});
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const settings = await client.query("SELECT version,value FROM public.ai_router_configuration WHERE singleton=true");
    ensure(settings.rows.length === 1, "AI_CONFIGURATION_UNAVAILABLE");
    const row = settings.rows[0];
    report.sections.aiRouting = { version: row.version, catalogServices: ids.length,
      databaseSource: env.DATABASE_URL ? "initial_process_environment" : "dotenv_only_not_proven_live",
      ...routeSummary(row.value, ids), actualProviderCallsObserved: false,
      transactionReadOnly: (await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only === "on" };
  } catch (e) { report.sections.aiRouting = { unavailable: errorCode(e) }; }
  finally { if (client) { await client.query("ROLLBACK").catch(() => {}); await client.end().catch(() => {}); } }
  section("processIdentityAfter", () => {
    const after = processInfo(live.pid);
    return { unchanged: after.start === live.start && after.parent === live.parent && after.uid === live.uid };
  });
  report.result = "INVENTORY_ONLY_NOT_GATEWAY_READY";
  console.log(JSON.stringify(report, null, 2));
}
module.exports = { environmentSummary, parseEnvironment, equality, routeSummary, safeUnit, errorCode, main };
if (require.main === module || process.argv[1] === "-")
  main().catch(error => { console.error(JSON.stringify({ status: "READ_ONLY_INVENTORY_STOPPED",
    code: errorCode(error), productionChanges: false })); process.exitCode = 1; });
