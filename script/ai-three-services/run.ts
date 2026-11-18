/**
 * Isolated synthetic acceptance on CORPCRM01. Uses the SAME runtime preload,
 * router and HTTPS adapter as monitoring. No configuration or business writes.
 * No direct Ollama, separate API, worker, credential loader or cloud fallback.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { Client } from "pg";
import { parse } from "dotenv";
import { createInternalAIAdapter } from "../../server/lib/ai/internal-adapter";
import { createAIRouter } from "../../server/lib/ai/router";
import { THREE_SERVICE_CANDIDATE_ROUTES, THREE_SERVICE_PROFILES } from "../../server/lib/ai/three-services-profile";
import { originalBoundaries, sha256 } from "./source";
import { acceptanceCorpus } from "./corpus";
import { acceptanceContract, latencyStats } from "./evaluate";
import { configurationSnapshot, readCurrentSnapshot, reserveKnownPreInferenceRecovery, safeFailureCode } from "./run-safety";

const require = createRequire(import.meta.url);
const { assertRuntime } = require("../ai-email-monitoring-b1/runtime.cjs") as {
  assertRuntime(env: NodeJS.ProcessEnv): void;
};
const ROOT = "/var/www/indexus-crm";
const BASE = "https://ai.cordbloodcenter.com/gateway/";
const fail = (code: string): never => { throw Error(code); };
export async function runAcceptance(options: {
  root: string; adapter: ReturnType<typeof createInternalAIAdapter>;
  readSnapshot: () => Promise<any>; save: (report: any) => void; signal?: AbortSignal;
  initialSnapshot?: any; recovery?: unknown;
  profile?: "smoke-three" | "checklist-sk-retest";
}) {
  const source = originalBoundaries(options.root);
  const allCases = acceptanceCorpus();
  const checklistOnly = options.profile === "checklist-sk-retest";
  const corpus = checklistOnly
    ? allCases.filter(item => item.id === "task.checklist-SK-1")
    : options.profile === "smoke-three"
    ? Object.keys(THREE_SERVICE_PROFILES).map(service =>
      allCases.find(item => item.service === service && item.language === "SK" && item.scenario === "missing_document")!)
    : allCases;
  if (checklistOnly && corpus.length !== 1) fail("THREE_ORIGINAL_CHECKLIST_CASE_MISSING");
  const denyCloud: any = { id: "openai", isAvailable: () => false,
    createClient() { throw Error("THREE_CLOUD_FALLBACK_FORBIDDEN"); },
    chatProbe() { throw Error("THREE_CLOUD_FALLBACK_FORBIDDEN"); } };
  const router = createAIRouter({ adapter: denyCloud, adapters: [options.adapter],
    overrides: THREE_SERVICE_CANDIDATE_ROUTES, mode: "routed", revision: "isolated-three-services", emit() {} });
  const report: any = {
    kind: checklistOnly ? "LIVE_ISOLATED_CHECKLIST_SK_RETEST"
      : options.profile === "smoke-three" ? "LIVE_ISOLATED_SMOKE_THREE_SERVICES"
      : "LIVE_ISOLATED_SYNTHETIC_THREE_SERVICES", startedAt: new Date().toISOString(),
    languageCoverage: options.profile ? ["SK"] : ["SK", "CZ", "RO", "ENG", "DE", "IT", "HU"],
    verdict: "NOT_READY", planned: corpus.length, sourceHashes: source.hashes,
    corpusHash: sha256(JSON.stringify(corpus)), productionActivation: false,
    originalPromptsAndParsers: true, openaiComparison: "NOT_EXECUTED",
    authenticatedUI: "NOT_VERIFIED", persistenceAndPermissions: "EXISTING_REGRESSIONS_REQUIRED",
    latencyScope: "Sequential original CRM prompt/router/HTTPS discovery/inference/parser; not GPU-only.",
    before: options.initialSnapshot ?? null, after: null, results: [], recovery: options.recovery ?? null,
  };
  const sameSources = () => Object.entries(source.hashes).every(([file, hash]) =>
    sha256(fs.readFileSync(path.join(options.root, file), "utf8")) === hash);
  options.save(report);
  try {
    report.before ??= await options.readSnapshot();
    options.save(report);
    for (const item of corpus) {
      if (options.signal?.aborted) fail("THREE_INTERRUPTED_NO_AUTOMATIC_RETRY");
      if (!sameSources()) fail("THREE_SOURCE_CHANGED_DURING_RUN");
      const current = await options.readSnapshot();
      if (current.fullConfigurationSha256 !== report.before.fullConfigurationSha256 ||
        current.version !== report.before.version) fail("THREE_PRODUCTION_CONFIGURATION_CHANGED");
      const row: any = { ...item, model: THREE_SERVICE_PROFILES[item.service].model,
        status: "IN_PROGRESS", requestedAt: new Date().toISOString(), attempted: false,
        languageReview: item.noInference ? "NOT_APPLICABLE" : "REVIEW_REQUIRED",
        factualAndSecurityReview: item.noInference ? "NOT_APPLICABLE" : "REVIEW_REQUIRED",
        temperatureClass: "UNMEASURED_COLD_OR_WARM", modelRevision: null };
      report.results.push(row);
      // Persist BEFORE sending: an uncertain POST is never automatically retried.
      options.save(report);
      const started = performance.now();
      try {
        row.result = await source.execute(item.service, item.input, (service: any, clientOptions: any = {}) => {
          const client = router.client(service, clientOptions);
          return { chat: { completions: { create: async (body: any) => {
            row.attempted = true; row.originalRequest = body;
            row.gatewayRequest = { ...body, model: row.model };
            row.promptHash = sha256(JSON.stringify(body.messages));
            row.requestHash = sha256(JSON.stringify(row.gatewayRequest));
            options.save(report);
            let response: any;
            try {
              const completed = await client.chat.completions.create(body,
                { maxRetries: 0, signal: options.signal }).withResponse();
              response = completed.data;
              row.httpStatus = completed.response.status;
            } catch (error: any) {
              if (Number.isInteger(error?.status)) row.httpStatus = error.status;
              row.transportError = typeof error?.code === "string" && /^[a-zA-Z0-9_]+$/.test(error.code)
                ? error.code : "provider_or_timeout_error";
              throw error;
            }
            row.rawOutput = response.choices[0]?.message?.content;
            row.finishReason = response.choices[0]?.finish_reason;
            row.actualModel = response.model; row.responseId = response.id;
            return response;
          } } } };
        });
        const noInferenceOK = item.noInference && !row.attempted &&
          row.result?.errorCode === "no_completed_items";
        row.errors = item.noInference ? (noInferenceOK ? [] : ["no_inference_contract_failed"])
          : acceptanceContract(item.service, row.result);
        row.status = row.errors.length ? "FAIL" : item.noInference ? "PASS_NO_INFERENCE" : "REVIEW_REQUIRED";
      } catch (error: any) {
        // No vendor text, stack, credential or production data enters the report.
        row.status = "FAIL";
        row.errors = ["crm_or_gateway_error"];
        row.errorCode = typeof error?.code === "string" && /^[a-zA-Z0-9_]+$/.test(error.code)
          ? error.code : "provider_or_parser_error";
        if (Number.isInteger(error?.status)) row.httpStatus = error.status;
      } finally {
        row.elapsedMs = Math.round(performance.now() - started);
        row.finishedAt = new Date().toISOString();
        if (!item.noInference && THREE_SERVICE_PROFILES[item.service].timeoutMs != null && row.elapsedMs > 15_000) {
          row.status = "FAIL"; (row.errors ??= []).push("task_deadline_exceeded");
        }
        options.save(report);
      }
    }
  } catch (error: any) {
    report.blocker = safeFailureCode(error);
  } finally {
    try {
      report.after = await options.readSnapshot();
      report.productionUnchanged = !!report.before && report.before.fullConfigurationSha256 === report.after.fullConfigurationSha256 &&
        report.before.version === report.after.version;
    } catch { report.productionUnchanged = false; report.snapshotError = "THREE_FINAL_SNAPSHOT_UNAVAILABLE"; }
    try { report.sourcesUnchanged = sameSources(); }
    catch { report.sourcesUnchanged = false; }
    report.finishedAt = new Date().toISOString();
    report.summary = Object.fromEntries(Object.keys(THREE_SERVICE_PROFILES).map(service => {
      const rows = report.results.filter((r: any) => r.service === service);
      return [service, { planned: corpus.filter(item => item.service === service).length, evaluated: rows.length,
        fail: rows.filter((r: any) => r.status === "FAIL").length,
        reviewRequired: rows.filter((r: any) => r.status === "REVIEW_REQUIRED").length,
        noInference: rows.filter((r: any) => r.status === "PASS_NO_INFERENCE").length,
        latency: latencyStats(rows.filter((r: any) => r.attempted).map((r: any) => r.elapsedMs)) }];
    }));
    // HTML/JSON validity cannot certify language, factuality or the authenticated UI.
    report.verdict = "NOT_READY";
    options.save(report);
  }
  return report;
}

let startupStage = "arguments";
async function main() {
  const recoveryMode = process.argv[2] === "--recover-before-first-case";
  const smokeMode = process.argv[2] === "--smoke-three";
  const checklistFidelityMode = process.argv[2] === "--checklist-sk-fidelity-retest";
  const checklistContentMode = process.argv[2] === "--checklist-sk-content-retest";
  const checklistMode = process.argv[2] === "--checklist-sk-retest" || checklistContentMode || checklistFidelityMode;
  const planned = checklistMode ? 1 : smokeMode ? 3 : 81;
  if (process.argv.length !== 4 || (!recoveryMode && !smokeMode && !checklistMode && process.argv[2] !== "--run-81"))
    fail("THREE_EXPLICIT_RUN_AND_OUTPUT_REQUIRED");
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" ||
      process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN) fail("THREE_CORPCRM01_ONLY");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") fail("THREE_TLS_REQUIRED");
  startupStage = "existing_runtime";
  assertRuntime(process.env); // Exact existing monitoring preload; no new credential handling.
  startupStage = "output_permissions";
  const output = path.resolve(process.argv[3]);
  const parent = fs.lstatSync(path.dirname(output));
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid?.() ||
      (parent.mode & 0o077)) fail("THREE_EXISTING_PRIVATE_OUTPUT_DIRECTORY_REQUIRED");
  // This fixed one-time marker blocks accidental second runs under a different output name.
  const marker = path.join(ROOT, "data", checklistFidelityMode
    ? "internal-ai-task-checklist-sk-fidelity-retest.started" : checklistContentMode
    ? "internal-ai-task-checklist-sk-content-retest.started" : checklistMode
    ? "internal-ai-task-checklist-sk-language-retest.started" : smokeMode
    ? "internal-ai-three-services-smoke-after-discovery.started"
    : "internal-ai-three-services-81.started");
  startupStage = "database_configuration";
  const env = parse(fs.readFileSync(path.join(ROOT, ".env")));
  if (process.env.DATABASE_URL && env.DATABASE_URL && process.env.DATABASE_URL !== env.DATABASE_URL)
    fail("THREE_DATABASE_CONFIGURATION_CONFLICT");
  const connectionString = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!connectionString) fail("THREE_DATABASE_CONFIGURATION_REQUIRED");
  const snapshot = () => readCurrentSnapshot(connectionString);
  // Check ONLY the three target routes; do not require monitoring to return to OpenAI.
  const db = new Client({ connectionString, connectionTimeoutMillis: 8000,
    options: "-c default_transaction_read_only=on -c statement_timeout=8000" });
  let gateway: any, loadedSnapshot: any;
  startupStage = "read_only_configuration";
  try {
    await db.connect();
    const rows = await db.query("SELECT version,value FROM ai_router_configuration WHERE singleton=true");
    if (rows.rows.length !== 1) fail("THREE_CONFIGURATION_UNAVAILABLE");
    const value = rows.rows[0].value;
    loadedSnapshot = configurationSnapshot(rows.rows[0]);
    gateway = value.gateway;
    if (gateway.baseURL !== BASE) fail("THREE_EXISTING_CANONICAL_GATEWAY_REQUIRED");
    for (const service of Object.keys(THREE_SERVICE_PROFILES)) {
      const route = value.routes[service];
      if (route && (route.provider !== "openai" || !route.enabled))
        fail("THREE_TARGET_MUST_REMAIN_OPENAI");
    }
  } finally { await db.end().catch(() => {}); }
  startupStage = "original_crm_sources";
  originalBoundaries(ROOT);
  startupStage = "initial_configuration_snapshot";
  const initialSnapshot = await snapshot();
  if (loadedSnapshot.fullConfigurationSha256 !== initialSnapshot.fullConfigurationSha256 ||
      loadedSnapshot.version !== initialSnapshot.version) fail("THREE_PRODUCTION_CONFIGURATION_CHANGED");
  startupStage = recoveryMode ? "verified_pre_inference_recovery" : "reserve_first_run";
  let recovery: unknown;
  if (recoveryMode) recovery = reserveKnownPreInferenceRecovery(ROOT, output, process.getuid!());
  else {
    if (fs.existsSync(marker)) fail("THREE_RUN_ALREADY_RESERVED_NO_AUTOMATIC_RETRY");
    const reservedOutput = fs.openSync(output, "wx", 0o600);
    fs.closeSync(reservedOutput);
    const fd = fs.openSync(marker, "wx", 0o600);
    fs.writeFileSync(fd, JSON.stringify({ startedAt: new Date().toISOString(), output }));
    fs.closeSync(fd);
  }
  console.log("THREE_PREFLIGHT_OK_TARGETS_OPENAI_EXISTING_SERVICES_PRESERVED");
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  let lastCompleted = -1;
  const save = (value: any) => {
      const temporary = output + ".pending";
      fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
      fs.renameSync(temporary, output);
      const completed = value.results.filter((row: any) => row.status !== "IN_PROGRESS").length;
      if (completed !== lastCompleted) { console.log(`THREE_PROGRESS ${completed}/${planned}`); lastCompleted = completed; }
    };
  // Keep a useful receipt even if original-source binding fails after reservation.
  save({ kind: "THREE_RESERVED_BEFORE_FIRST_CASE", results: [], before: initialSnapshot, recovery: recovery ?? null });
  startupStage = "acceptance";
  const report = await runAcceptance({
    root: ROOT, readSnapshot: snapshot, initialSnapshot, recovery, signal: controller.signal, save,
    ...(checklistMode ? { profile: "checklist-sk-retest" as const }
      : smokeMode ? { profile: "smoke-three" as const } : {}),
    adapter: createInternalAIAdapter({
      readConfiguration: () => ({ enabled: true, production: true, replit: false,
        baseURL: process.env.INDEXUS_AI_GATEWAY_BASE_URL, token: process.env.INDEXUS_AI_GATEWAY_TOKEN }),
      // Instance-only no-retry policy; retain the existing effective summary deadline.
      readSettings: () => ({ ...gateway, maxRetries: 0 }),
    }),
  });
  if (smokeMode || checklistMode) for (const row of report.results) {
    console.log((checklistMode ? "CHECKLIST_SK_RESULT " : "THREE_SMOKE_RESULT ") + JSON.stringify({
      service: row.service, model: row.model, httpStatus: row.httpStatus ?? null,
      status: row.status, elapsedMs: row.elapsedMs, rawOutput: row.rawOutput ?? null,
      parsedResult: row.result ?? null, errors: row.errors ?? [],
      transportError: row.transportError ?? null,
    }));
  }
  console.log(JSON.stringify({ verdict: report.verdict, evaluated: report.results.length,
    productionUnchanged: report.productionUnchanged, report: output }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(error => {
    console.error(JSON.stringify({ event: "THREE_ACCEPTANCE_STOPPED_NOT_READY",
      stage: startupStage, code: safeFailureCode(error) }));
    process.exitCode = 1;
  });
