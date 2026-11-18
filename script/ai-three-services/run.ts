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
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { THREE_SERVICE_CANDIDATE_ROUTES, THREE_SERVICE_PROFILES } from "../../server/lib/ai/three-services-profile";
import { originalBoundaries, sha256 } from "./source";
import { acceptanceCorpus } from "./corpus";
import { acceptanceContract, latencyStats } from "./evaluate";

const require = createRequire(import.meta.url);
const { assertRuntime } = require("../ai-email-monitoring-b1/runtime.cjs") as {
  assertRuntime(env: NodeJS.ProcessEnv): void;
};
const { readProductionSnapshot } = require("../ai-email-monitoring-b1/b11-check.cjs") as {
  readProductionSnapshot(input: { Client: typeof Client; connectionString: string | undefined; catalog: string[] }): Promise<any>;
};
const ROOT = "/var/www/indexus-crm";
const BASE = "https://ai.cordbloodcenter.com/gateway/";
const fail = (code: string): never => { throw Error(code); };
export async function runAcceptance(options: {
  root: string; adapter: ReturnType<typeof createInternalAIAdapter>;
  readSnapshot: () => Promise<any>; save: (report: any) => void; signal?: AbortSignal;
}) {
  const source = originalBoundaries(options.root);
  const corpus = acceptanceCorpus();
  const denyCloud: any = { id: "openai", isAvailable: () => false,
    createClient() { throw Error("THREE_CLOUD_FALLBACK_FORBIDDEN"); },
    chatProbe() { throw Error("THREE_CLOUD_FALLBACK_FORBIDDEN"); } };
  const router = createAIRouter({ adapter: denyCloud, adapters: [options.adapter],
    overrides: THREE_SERVICE_CANDIDATE_ROUTES, mode: "routed", revision: "isolated-three-services", emit() {} });
  const report: any = {
    kind: "LIVE_ISOLATED_SYNTHETIC_THREE_SERVICES", startedAt: new Date().toISOString(),
    verdict: "NOT_READY", planned: corpus.length, sourceHashes: source.hashes,
    corpusHash: sha256(JSON.stringify(corpus)), productionActivation: false,
    originalPromptsAndParsers: true, openaiComparison: "NOT_EXECUTED",
    authenticatedUI: "NOT_VERIFIED", persistenceAndPermissions: "EXISTING_REGRESSIONS_REQUIRED",
    latencyScope: "Sequential original CRM prompt/router/HTTPS discovery/inference/parser; not GPU-only.",
    before: await options.readSnapshot(), after: null, results: [],
  };
  const sameSources = () => Object.entries(source.hashes).every(([file, hash]) =>
    sha256(fs.readFileSync(path.join(options.root, file), "utf8")) === hash);
  options.save(report);
  try {
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
    report.blocker = /^THREE_[A-Z_]+$/.test(error?.message) ? error.message : "THREE_RUN_ABORTED";
  } finally {
    try {
      report.after = await options.readSnapshot();
      report.productionUnchanged = report.before.fullConfigurationSha256 === report.after.fullConfigurationSha256 &&
        report.before.version === report.after.version;
    } catch { report.productionUnchanged = false; report.snapshotError = "THREE_FINAL_SNAPSHOT_UNAVAILABLE"; }
    report.sourcesUnchanged = sameSources();
    report.finishedAt = new Date().toISOString();
    report.summary = Object.fromEntries(Object.keys(THREE_SERVICE_PROFILES).map(service => {
      const rows = report.results.filter((r: any) => r.service === service);
      return [service, { planned: 27, evaluated: rows.length,
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

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--run-81") fail("THREE_EXPLICIT_RUN_AND_OUTPUT_REQUIRED");
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" ||
      process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN) fail("THREE_CORPCRM01_ONLY");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") fail("THREE_TLS_REQUIRED");
  assertRuntime(process.env); // Exact existing monitoring preload; no new credential handling.
  const output = path.resolve(process.argv[3]);
  const parent = fs.lstatSync(path.dirname(output));
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid?.() ||
      (parent.mode & 0o077)) fail("THREE_EXISTING_PRIVATE_OUTPUT_DIRECTORY_REQUIRED");
  // This fixed one-time marker blocks accidental second runs under a different output name.
  const marker = path.join(ROOT, "data", "internal-ai-three-services-81.started");
  const env = parse(fs.readFileSync(path.join(ROOT, ".env")));
  if (process.env.DATABASE_URL && env.DATABASE_URL && process.env.DATABASE_URL !== env.DATABASE_URL)
    fail("THREE_DATABASE_CONFIGURATION_CONFLICT");
  const connectionString = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!connectionString) fail("THREE_DATABASE_CONFIGURATION_REQUIRED");
  const snapshot = () => readProductionSnapshot({ Client, connectionString, catalog: Object.keys(AI_SERVICES) });
  // Check ONLY the three target routes; do not require monitoring to return to OpenAI.
  const db = new Client({ connectionString, connectionTimeoutMillis: 8000,
    options: "-c default_transaction_read_only=on -c statement_timeout=8000" });
  let gateway: any;
  try {
    await db.connect();
    const rows = await db.query("SELECT value FROM ai_router_configuration WHERE singleton=true");
    if (rows.rows.length !== 1) fail("THREE_CONFIGURATION_UNAVAILABLE");
    const value = rows.rows[0].value;
    gateway = value.gateway;
    if (gateway.baseURL !== BASE) fail("THREE_EXISTING_CANONICAL_GATEWAY_REQUIRED");
    for (const service of Object.keys(THREE_SERVICE_PROFILES)) {
      const route = value.routes[service];
      if (route && (route.provider !== "openai" || !route.enabled))
        fail("THREE_TARGET_MUST_REMAIN_OPENAI");
    }
  } finally { await db.end(); }
  const reservedOutput = fs.openSync(output, "wx", 0o600);
  fs.closeSync(reservedOutput);
  const fd = fs.openSync(marker, "wx", 0o600);
  fs.writeFileSync(fd, JSON.stringify({ startedAt: new Date().toISOString(), output }));
  fs.closeSync(fd);
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  const report = await runAcceptance({
    root: ROOT, readSnapshot: snapshot, signal: controller.signal,
    save: value => {
      const temporary = output + ".pending";
      fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
      fs.renameSync(temporary, output);
    },
    adapter: createInternalAIAdapter({
      readConfiguration: () => ({ enabled: true, production: true, replit: false,
        baseURL: process.env.INDEXUS_AI_GATEWAY_BASE_URL, token: process.env.INDEXUS_AI_GATEWAY_TOKEN }),
      // Instance-only no-retry policy; retain the existing effective summary deadline.
      readSettings: () => ({ ...gateway, maxRetries: 0 }),
    }),
  });
  console.log(JSON.stringify({ verdict: report.verdict, evaluated: report.results.length,
    productionUnchanged: report.productionUnchanged }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => { console.error("THREE_ACCEPTANCE_STOPPED_NOT_READY"); process.exitCode = 1; });
