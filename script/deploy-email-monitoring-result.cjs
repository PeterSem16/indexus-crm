"use strict";
// Explicit operator-only UI/data-projection fix. Never activates an AI provider.
const os = require("node:os");
const deploy = require("./deploy-email-monitoring-b112.cjs");
const BASE = "d87b92b6ec748fa5195825d7de7dca2b98efb18f";
const TARGET = "beba7f7a0057194b414a7bf3776ede74fc218302";
const FILES = Object.freeze([
  "shared/email-monitoring-detail.ts",
  "server/lib/email-monitoring-detail.ts",
  "server/lib/email-monitoring-detail.test.ts",
  "server/lib/email-monitoring-detail-route.test.ts",
  "server/routes.ts",
  "client/src/components/nexus/EmailMonitoringAnalysis.tsx",
  "client/src/components/nexus/nexus-types.ts",
  "client/src/i18n/email-monitoring-detail-translations.ts",
  "client/src/i18n/translations.ts",
  "client/src/pages/email-client.tsx",
  "script/test-email-monitoring-detail-ui.cjs",
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
function profile() {
  return { BASE, TARGET, FILES, assertRouting, releasePaths, frontend: true,
    OLD_BACKEND: "e9bbc844e91d63a2b0a97e791ddc314343f6f00c57eea0fcb2e9ff0c7923020f",
    OLD_INDEX: "75f64fb6b81cb7f58150f5ca19953348d527775b472613edfd1f1f11a17c7c4d",
    BUILD_CONFIG: "35df8bf9d4c1aad8cdff54df8108bbc964a853bbc29538ec0ec6e1b1a9b0d54f",
    resultOverrides: {
      status: "APPLIED_EMAIL_MONITORING_DETAIL_ROUTING_UNCHANGED",
      gatewayEnabled: true, openaiServices: 65, internalServices: 0,
      productionActivation: "NOT_PERFORMED", routingUnchanged: true,
      monitoringResultProjection: "READ_ONLY", installerModelCalls: 0,
      productionModelCalls: null, runtimeModelCalls: "NOT_MEASURED",
      next: "Refresh /email and inspect an already monitored message in its own mailbox. Keep AI routing unchanged.",
    },
  };
}
async function main(args = process.argv.slice(2)) {
  if (args.length !== 3 || args[0] !== "--apply" || args[1] !== TARGET || args[2] !== "--allow-restart" ||
      process.getuid?.() !== 0 || os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01")
    throw Error("B112_ROOT_AND_EXPLICIT_PINNED_RESTART_REQUIRED");
  if (typeof deploy.deploymentFor !== "function") throw Error("B112_REVIEWED_HELPER_REQUIRED");
  await deploy.deploymentFor(profile())(args);
}
module.exports = { BASE, TARGET, FILES, assertRouting, releasePaths, profile, main };
if (require.main === module) main().catch(() => {
  console.error("B112_RESULT_DEPLOY_REFUSED_NO_OPERATION"); process.exitCode = 1;
});
