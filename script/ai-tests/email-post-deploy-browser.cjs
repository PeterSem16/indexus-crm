"use strict";
// Generates a browser-only test. Importing/running this generator performs no inference.
const { casesFor, LANGUAGES, SERVICES } = require("./email-language-matrix.cjs");
async function runEmailPostDeploy(cases) {
  if (["__indexusEmailPostDeployStarted", "__indexusLanguageTestStarted",
    "__solarisGatewayLogTestStarted", "__solarisENDEStarted", "__solarisNovelComposeStarted"]
    .some(key => window[key])) throw Error("TEST_ALREADY_STARTED_DO_NOT_REPEAT");
  window.__indexusEmailPostDeployStarted = true;
  const run = window.indexusEmailPostDeploy = {
    startedAt: new Date().toISOString(), status: "preflight", planned: cases.length,
    configurationVersion: null, maintenanceVersion: null, results: [], current: null,
    provenance: "End-to-end INDEXUS/Gateway; model output path requires Gateway evidence.",
  };
  const get = async url => {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (response.status !== 200) throw Error("READ_HTTP_" + response.status);
    return response.json();
  };
  let baseline;
  const check = async () => {
    const config = await get("/api/configurator/ai");
    const maintenance = await get("/api/configurator/ai/maintenance");
    const fingerprint = JSON.stringify({ version: config.version, gateway: config.gateway,
      services: config.services, maintenanceVersion: maintenance.version });
    if (baseline && fingerprint !== baseline) throw Error("SETTINGS_CHANGED_STOP");
    if (config.runtime?.mode !== "routed" || !config.runtime.production ||
        config.runtime.replit || !config.runtime.serverAllowed ||
        !config.gateway?.enabled || config.queue?.ready !== true)
      throw Error("PRODUCTION_INTERNAL_QUEUE_NOT_READY");
    if (maintenance.mode !== "running" || !Number.isSafeInteger(maintenance.version) ||
        !(maintenance.workers?.alive > 0) || maintenance.workers.unsupported !== 0 ||
        maintenance.workers.confirmed !== maintenance.workers.alive)
      throw Error("MAINTENANCE_OR_WORKER_NOT_READY");
    for (const id of [...new Set(cases.map(c => c.service))]) {
      const route = config.services?.find(s => s.id === id)?.route;
      if (!route?.enabled || route.provider !== "internal" || !route.model)
        throw Error("INTERNAL_SERVICE_REQUIRED_" + id);
    }
    if (!Number.isSafeInteger(config.version)) throw Error("CONFIG_VERSION_REQUIRED");
    baseline = fingerprint;
    run.configurationVersion = config.version; run.maintenanceVersion = maintenance.version;
    return config;
  };
  try {
    const { user } = await get("/api/auth/me");
    if (!user?.id) throw Error("PRODUCTION_LOGIN_REQUIRED");
    await check();
    run.status = "running";
    for (const item of cases) {
      const config = await check();
      const row = { case: run.results.length + 1, service: item.service, language: item.language,
        model: config.services.find(s => s.id === item.service).route.model,
        startedAt: new Date().toISOString(), finishedAt: null, status: "outcome_unknown",
        input: item.body, gatewayRequestId: null, gatewayOutputPath: null,
        languageAndMeaningVerified: false };
      run.current = row; run.results.push(row);
      const start = performance.now();
      // Exactly one POST. Never send, persist drafts, change routing, resume, or retry.
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/${item.endpoint}`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.body),
      });
      row.httpStatus = response.status;
      if (response.status !== 200) throw Error("INFERENCE_HTTP_" + response.status);
      const value = await response.json();
      if (typeof value[item.responseField] !== "string") throw Error("UNEXPECTED_RESULT_SHAPE");
      row.output = value[item.responseField];
      const paragraphs = (row.output.match(/<p(?:\s[^>]*)?>/gi) || []).length;
      row.formatOK = !!row.output.trim() && paragraphs > 0 && !row.output.includes("```") &&
        (item.service !== "email.compose" || paragraphs === 3);
      row.numericFactsOK = item.service !== "email.translation" ? null :
        /\b2026\b/.test(row.output) && /\b24\b/.test(row.output) && /\b10[:.]30\b/.test(row.output);
      row.seconds = Math.round((performance.now() - start) / 1000);
      row.finishedAt = new Date().toISOString(); row.status = "completed";
      run.current = null; console.log(JSON.stringify(row));
    }
    await check();
    run.status = "outputs_collected_review_pending";
  } catch (error) {
    run.status = "stopped_do_not_repeat";
    run.error = error instanceof Error ? error.message : "TEST_FAILED";
    if (run.current) run.current.observerStoppedAt = new Date().toISOString();
    console.error("STOP; DO NOT REPEAT:", run.error);
  } finally {
    run.finishedAt = new Date().toISOString();
    console.table(run.results.map(({ input, output, ...row }) => row));
    console.log("Export: copy(JSON.stringify(window.indexusEmailPostDeploy, null, 2))");
  }
  return run;
}
function browserScript() {
  return "(async () => {\nconst LANGUAGES = [\n" +
    LANGUAGES.map(l => "  " + JSON.stringify(l)).join(",\n") + "\n];\n" +
    "const SERVICES = " + JSON.stringify(SERVICES) + ";\n" +
    casesFor.toString() + "\nreturn (" + runEmailPostDeploy.toString() + ")(casesFor());\n" +
    "})().catch(e => console.error('STOP; DO NOT REPEAT:', e.message));\n";
}
module.exports = { runEmailPostDeploy, browserScript };
if (require.main === module) process.stdout.write(browserScript());
