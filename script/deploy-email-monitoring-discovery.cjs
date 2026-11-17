"use strict";
// Operator-only discovery and model-picker correction. No inference or routing writes.
const os = require("node:os");
const deploy = require("./deploy-email-monitoring-b112.cjs");
const BASE = "742888533f9fbb802c7c619dee77c8b56dcb770d";
const TARGET = "d87b92b6ec748fa5195825d7de7dca2b98efb18f";
const ROOT = "/var/www/indexus-crm";
const FILES = Object.freeze([
  "client/src/components/configurator/AISettingsTab.tsx",
  "script/deploy-email-monitoring-b112.cjs",
  "script/deploy-email-monitoring-b112.test.cjs",
  "script/test-ai-settings-ui.cjs",
  "server/lib/ai/admin-email-discovery.test.ts",
  "server/lib/ai/internal-adapter.ts",
  "server/lib/ai/settings-check.ts",
]);
function assertRouting(snapshot) {
  const row = snapshot?.state, gateway = row?.value?.gateway;
  if (!Number.isSafeInteger(row?.version) || row.version < 6 ||
      gateway?.enabled !== true || gateway.baseURL !== "https://ai.cordbloodcenter.com/gateway/" ||
      gateway.timeoutMs !== 30000 || gateway.maxRetries !== 0 ||
      gateway.temperature !== null || gateway.maxTokens !== null ||
      !row.value.routes || Object.keys(row.value.routes).length !== 0 ||
      !Number.isSafeInteger(snapshot.auditCount))
    throw Error("B112_ROUTING_HOLD_CHANGED");
}
function releasePaths(actual) {
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...FILES].sort()))
    throw Error("B112_UNREVIEWED_RELEASE_PATHS");
}
function profile(read = deploy.fingerprint) {
  return { BASE, TARGET, FILES, assertRouting, releasePaths, frontend: true,
    // Capture the currently serving bytes once, then the shared installer
    // rechecks them before backup, build, promotion and guarded recovery.
    OLD_BACKEND: read(ROOT + "/dist/index.cjs").hash,
    OLD_INDEX: read(ROOT + "/dist/public/index.html").hash,
    BUILD_CONFIG: "35df8bf9d4c1aad8cdff54df8108bbc964a853bbc29538ec0ec6e1b1a9b0d54f",
    resultOverrides: {
      status: "APPLIED_EMAIL_MODEL_DISCOVERY_UI_ROUTING_UNCHANGED",
      gatewayEnabled: true, openaiServices: 65, internalServices: 0,
      productionActivation: "NOT_PERFORMED", routingUnchanged: true,
      emailModelInferenceCalls: 0, otherServiceInferenceGrantsChanged: false,
      next: "Refresh /configurator?tab=ai and run the existing Gateway smoke check. Do not rerun the seven-case suite.",
    },
  };
}
async function main(args = process.argv.slice(2)) {
  if (args.length !== 3 || args[0] !== "--apply" || args[1] !== TARGET || args[2] !== "--allow-restart" ||
      process.getuid?.() !== 0 || os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01")
    throw Error("B112_ROOT_AND_EXPLICIT_PINNED_RESTART_REQUIRED");
  // The helper must be the reviewed version, not an older live-checkout copy.
  if (typeof deploy.deploymentFor !== "function") throw Error("B112_REVIEWED_HELPER_REQUIRED");
  await deploy.deploymentFor(profile())(args);
}
module.exports = { BASE, TARGET, FILES, assertRouting, releasePaths, profile, main };
if (require.main === module) main().catch(() => {
  console.error("B112_DISCOVERY_DEPLOY_REFUSED_NO_OPERATION");
  process.exitCode = 1;
});
