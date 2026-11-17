"use strict";
const os = require("node:os");
const deploy = require("./deploy-email-monitoring-b112.cjs");
const { beforePromotion } = require("./deploy-email-monitoring-save.cjs");
const BASE = "7f6ed9045af4281911f762bbb6e166baf4f78280";
const TARGET = "1a4f4bd1e15170de103523bf437e30df7949ae16";
const FILES = Object.freeze([
  "server/index.ts", "shared/schema.ts",
  "server/lib/email-monitoring-record.ts", "server/lib/email-monitoring-store.ts",
  "server/lib/email-monitoring-record.test.ts", "server/lib/email-monitoring-store.db.test.ts",
]);
function releasePaths(actual) {
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...FILES].sort()))
    throw Error("B112_UNREVIEWED_RELEASE_PATHS");
}
function assertRouting(snapshot) {
  const state = snapshot?.state, gateway = state?.value?.gateway, routes = state?.value?.routes;
  if (!Number.isSafeInteger(state?.version) || state.version < 8 ||
      !Number.isSafeInteger(snapshot.auditCount) || gateway?.enabled !== true ||
      gateway.baseURL !== "https://ai.cordbloodcenter.com/gateway/" || gateway.timeoutMs !== 30000 ||
      gateway.maxRetries !== 0 || gateway.temperature !== null || gateway.maxTokens !== null ||
      !routes || Object.keys(routes).length !== 1 || routes["email.monitoring"]?.provider !== "internal" ||
      routes["email.monitoring"]?.model !== "indexus-email-monitoring:v1" ||
      routes["email.monitoring"]?.enabled !== true) throw Error("B112_INTERNAL_EMAIL_ROUTING_CHANGED");
}
async function verifyDeployment({ connectionString }, Client = require("/var/www/indexus-crm/node_modules/pg").Client) {
  const db = new Client({ connectionString, connectionTimeoutMillis: 8000,
    options: "-c default_transaction_read_only=on -c statement_timeout=8000" });
  try {
    await db.connect();
    await db.query("SELECT id,message_id,mailbox_email,owner_key,owner_user_id,result,created_at FROM email_monitoring_owner_results LIMIT 0");
    const result = await db.query(`SELECT contype,pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid='public.email_monitoring_owner_results'::regclass AND contype IN ('u','f')`);
    if (!result.rows.some(r => r.contype === "u" && r.definition === "UNIQUE (mailbox_email, message_id, owner_key)") ||
        !result.rows.some(r => r.contype === "f" &&
          /^FOREIGN KEY \(owner_user_id\) REFERENCES (?:public\.)?users\(id\) ON DELETE CASCADE$/.test(r.definition)))
      throw Error();
  } catch { throw Error("B112_OWNER_TABLE_NOT_READY"); }
  finally { await db.end(); }
}
function profile() {
  return { BASE, TARGET, FILES, releasePaths, assertRouting, frontend: false, beforePromotion, verifyDeployment,
    OLD_BACKEND: "b688de5bca6586ad4f365a8b73badbb1851d2562f392a64c2c8fcdafe8694288",
    OLD_INDEX: "cd943bdc4812fb604f880d5b2af61a0e422559d218f7854f48e7f89b956fd003",
    BUILD_CONFIG: "35df8bf9d4c1aad8cdff54df8108bbc964a853bbc29538ec0ec6e1b1a9b0d54f",
    resultOverrides: {
      status: "APPLIED_EMAIL_MONITORING_OWNER_FIX_ROUTING_UNCHANGED",
      gatewayEnabled: true, openaiServices: 64, internalServices: 1, routingUnchanged: true,
      productionActivation: "ALREADY_ACTIVE_ROUTING_UNCHANGED",
      databaseBackupValidated: true, databaseSchemaChange: "ONE_ADDITIVE_PRIVATE_OWNER_RESULTS_TABLE",
      legacyResultsUnchanged: true, historicalNotesRecovered: false,
      productionModelCalls: null, installerModelCalls: 0, runtimeModelCalls: "NOT_MEASURED",
      next: "Normal internal monitoring now stores separate results per authorized owner. Refresh the original email after normal polling.",
    },
  };
}
async function main(args = process.argv.slice(2)) {
  if (args.length !== 3 || args[0] !== "--apply" || args[1] !== TARGET || args[2] !== "--allow-restart" ||
      process.getuid?.() !== 0 || os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01")
    throw Error("B112_ROOT_AND_EXPLICIT_PINNED_RESTART_REQUIRED");
  await deploy.deploymentFor(profile())(args);
}
module.exports = { BASE, TARGET, FILES, releasePaths, assertRouting, verifyDeployment, profile, main };
if (require.main === module) main().catch(() => {
  console.error("B112_OWNER_DEPLOY_REFUSED_NO_OPERATION"); process.exitCode = 1;
});
