"use strict";
const os = require("node:os"), path = require("node:path");
const deploy = require("./deploy-email-monitoring-b112.cjs");
const BASE = "beba7f7a0057194b414a7bf3776ede74fc218302";
const TARGET = "7f6ed9045af4281911f762bbb6e166baf4f78280";
const FILES = Object.freeze([
  "server/lib/email-monitoring-record.ts",
  "server/lib/email-monitoring-record.test.ts",
  "server/lib/email-monitoring-store.ts",
  "server/lib/email-monitoring-store.db.test.ts",
  "server/lib/email-monitoring-service-flow.test.ts",
  "server/lib/email-monitoring-service.ts",
  "server/lib/email-monitoring-detail-route.test.ts",
  "server/routes.ts",
  "server/index.ts",
  "shared/schema.ts",
  "client/src/components/nexus/EmailMonitoringAnalysis.tsx",
  "client/src/i18n/email-monitoring-detail-translations.ts",
  "script/test-email-monitoring-detail-ui.cjs",
  "script/deploy-email-monitoring-b112.cjs",
]);
function assertRouting(snapshot) {
  const row = snapshot?.state, gateway = row?.value?.gateway;
  if (!Number.isSafeInteger(row?.version) || row.version < 6 || gateway?.enabled !== true ||
      gateway.baseURL !== "https://ai.cordbloodcenter.com/gateway/" || gateway.timeoutMs !== 30000 ||
      gateway.maxRetries !== 0 || gateway.temperature !== null || gateway.maxTokens !== null ||
      !row.value.routes || Object.keys(row.value.routes).length !== 0 ||
      !Number.isSafeInteger(snapshot.auditCount)) throw Error("B112_ROUTING_HOLD_CHANGED");
}
function releasePaths(actual) {
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...FILES].sort()))
    throw Error("B112_UNREVIEWED_RELEASE_PATHS");
}
function nativeDumpEnvironment(connectionString) {
  try {
    const url = new URL(connectionString), query = url.searchParams;
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw Error();
    const forwarded = {
      sslrootcert: "PGSSLROOTCERT", sslcert: "PGSSLCERT", sslkey: "PGSSLKEY",
      sslcrl: "PGSSLCRL", sslpassword: "PGSSLPASSWORD",
      ssl_min_protocol_version: "PGSSLMINPROTOCOLVERSION", ssl_max_protocol_version: "PGSSLMAXPROTOCOLVERSION",
      gssencmode: "PGGSSENCMODE", channel_binding: "PGCHANNELBINDING",
      target_session_attrs: "PGTARGETSESSIONATTRS",
      options: "PGOPTIONS", application_name: "PGAPPNAME",
    };
    const known = new Set(["host", "port", "user", "password", "dbname", "database", "sslmode", "ssl",
      "connect_timeout", ...Object.keys(forwarded)]);
    for (const [key] of query) if (!known.has(key) || query.getAll(key).length !== 1) throw Error();
    if (query.has("ssl") && !["true", "false", "1", "0"].includes(query.get("ssl"))) throw Error();
    // Reject conflicting identity selectors rather than interpreting them
    // differently from the application's driver and backing up another target.
    const identity = { host: url.hostname.replace(/^\[|\]$/g, ""), port: url.port,
      user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
      dbname: decodeURIComponent(url.pathname.slice(1)), database: decodeURIComponent(url.pathname.slice(1)) };
    for (const [key, value] of Object.entries(identity))
      if (value && query.has(key) && query.get(key) !== value) throw Error();
    const env = {
      PATH: process.env.PATH, HOME: "/root", LANG: "C.UTF-8", PGCONNECT_TIMEOUT: "8",
      PGHOST: query.get("host") ?? url.hostname.replace(/^\[|\]$/g, ""),
      PGPORT: query.get("port") ?? (url.port || "5432"),
      PGUSER: query.get("user") ?? decodeURIComponent(url.username),
      PGPASSWORD: query.get("password") ?? decodeURIComponent(url.password),
      PGDATABASE: query.get("dbname") ?? query.get("database") ?? decodeURIComponent(url.pathname.slice(1)),
      PGSSLMODE: query.get("sslmode") ?? (["true", "1"].includes(query.get("ssl")) ? "verify-full" : "disable"),
    };
    if (env.PGSSLMODE === "no-verify") env.PGSSLMODE = "require";
    if (!identity.database || !env.PGHOST || !env.PGUSER || !env.PGDATABASE || !/^\d+$/.test(env.PGPORT) ||
        +env.PGPORT < 1 || +env.PGPORT > 65535 ||
        !["disable", "allow", "prefer", "require", "verify-ca", "verify-full"].includes(env.PGSSLMODE))
      throw Error();
    for (const [parameter, key] of Object.entries(forwarded))
      if (query.has(parameter)) env[key] = query.get(parameter);
    return env;
  } catch {
    // Never include the URI, password or parser error in an operator-facing error.
    throw Error("B112_NATIVE_DATABASE_CONFIGURATION_INVALID");
  }
}
async function checkBackupSpace(privateRoot, connectionString) {
  const { Client } = require("/var/www/indexus-crm/node_modules/pg");
  const client = new Client({ connectionString, connectionTimeoutMillis: 8000,
    options: "-c default_transaction_read_only=on -c statement_timeout=8000" });
  try {
    await client.connect();
    const result = await client.query("SELECT pg_database_size(current_database())::text AS bytes");
    const bytes = Number(result.rows[0]?.bytes), disk = require("node:fs").statfsSync(privateRoot);
    if (!Number.isSafeInteger(bytes) || bytes < 1 || disk.bavail * disk.bsize < bytes * 2 + 2 * 1024 ** 3)
      throw Error("B112_DATABASE_BACKUP_DISK_LOW");
  } finally { await client.end(); }
}
async function beforePromotion({ privateRoot, run, connectionString, backupSafety = checkBackupSpace }) {
  const dumpEnv = nativeDumpEnvironment(connectionString);
  await backupSafety(privateRoot, connectionString);
  const file = path.join(privateRoot, "database-before-monitoring-column.dump");
  // The shared installer already required private root ownership, mode 0700,
  // /dev/sdb1, free space and the pinned live application's DB configuration.
  // Keep credentials out of arguments and console output. Never restore here.
  run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", file], {
    timeout: 300000, env: dumpEnv,
  });
  const listing = run("pg_restore", ["--list", file], { timeout: 60000 });
  if (!/TABLE DATA public email_metadata\s/.test(listing))
    throw Error("B112_DATABASE_BACKUP_NOT_VALIDATED");
}
function profile() {
  return { BASE, TARGET, FILES, assertRouting, releasePaths, frontend: true, beforePromotion,
    OLD_BACKEND: "cf3a3676a1306f6f524ddff8841d39416ec5edee8673339c7b58a6eb35310e22",
    OLD_INDEX: "a9a747bcc88049def4243cc4d48c07cd029fcbe824bd0c038b3f791d7ac096c4",
    BUILD_CONFIG: "35df8bf9d4c1aad8cdff54df8108bbc964a853bbc29538ec0ec6e1b1a9b0d54f",
    resultOverrides: {
      status: "APPLIED_EMAIL_MONITORING_SAVE_ROUTING_UNCHANGED",
      gatewayEnabled: true, openaiServices: 65, internalServices: 0,
      productionActivation: "NOT_PERFORMED", routingUnchanged: true,
      databaseBackupValidated: true, databaseSchemaChange: "ONE_NULLABLE_MAILBOX_MONITORING_COLUMN",
      productionModelCalls: null, installerModelCalls: 0, runtimeModelCalls: "NOT_MEASURED",
      historicalNotesRecovered: false,
      next: "Normal mailbox monitoring remains on OpenAI. The existing email detail now shows a saved result or an explicit no-result message.",
    },
  };
}
async function main(args = process.argv.slice(2)) {
  if (args.length !== 3 || args[0] !== "--apply" || args[1] !== TARGET || args[2] !== "--allow-restart" ||
      process.getuid?.() !== 0 || os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01")
    throw Error("B112_ROOT_AND_EXPLICIT_PINNED_RESTART_REQUIRED");
  await deploy.deploymentFor(profile())(args);
}
module.exports = { BASE, TARGET, FILES, assertRouting, releasePaths, profile, beforePromotion, nativeDumpEnvironment, main };
if (require.main === module) main().catch(() => {
  console.error("B112_SAVE_DEPLOY_REFUSED_NO_OPERATION"); process.exitCode = 1;
});
