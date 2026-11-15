/**
 * Isolated C1 runner. It never imports the app server, router singleton or settings store.
 * Live mode runs ONLY on CORPCRM01 with existing runtime credentials and READ ONLY SQL.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { createInternalAIAdapter } from "../../server/lib/ai/internal-adapter";
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { BASE, preparedRow, executeAttempt, aggregateRow, csv, html } from "./evidence";
import { hash } from "./prepare.cjs";
import { snapshot, unchanged } from "../ai-gateway-b4-pilot.cjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const fail = (code: string): never => { throw new Error(code); };
export function validatePlan(plan: any, root = ROOT) {
  if (plan.phase !== "C1" || plan.policy?.gatewayEnabled !== false ||
      plan.policy.productionProvider !== "openai" || plan.policy.fallback !== false ||
      plan.policy.automaticMigration !== false || plan.policy.syntheticOnly !== true)
    fail("C1_PLAN_POLICY_INVALID");
  if (plan.services?.length !== 65 || new Set(plan.services.map((s: any) => s.id)).size !== 65 ||
      plan.services.some((s: any) => AI_SERVICES[s.id as keyof typeof AI_SERVICES] !== s.operation))
    fail("C1_CATALOG_MISMATCH");
  for (const [file, expected] of Object.entries(plan.sourceHashes || {})) {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep) || hash(fs.readFileSync(absolute)) !== expected)
      fail("C1_SOURCE_HASH_MISMATCH");
  }
  if (!Object.hasOwn(plan.sourceHashes || {}, "server/lib/ai/service-catalog.ts") ||
      !Object.hasOwn(plan.sourceHashes || {}, "server/lib/ai/internal-adapter.ts"))
    fail("C1_SOURCE_PINS_REQUIRED");
}

export function initialReport(plan: any) {
  return { phase: "C1", kind: "OFFLINE_PREPARATION_NOT_LIVE_EVIDENCE", generatedAtUtc: new Date().toISOString(),
    planSha256: hash(plan), sourceCommit: plan.sourceCommit, sourceReconciliation: plan.sourceReconciliation,
    productionSettingsChangedByRunner: false,
    productionState: "NOT_OBSERVED", before: null, after: null, finalVerified: false,
    error: null, rows: plan.services.map(preparedRow),
    limitations: [
      "No COMPATIBLE decisions without semantic and contract-coverage review.",
      "Documentation schemas are not substituted for application runtime validators.",
      "Four pure boundaries have dedicated replay; other services attempt original post-inference statements with IO blocked.",
      "Media fixtures and Audio API contract are still required; no guessed Audio endpoint is called.",
      "Static unsupported rows do not measure the local model.",
      "Three repetitions per supported call-site in live mode; sequential; zero SDK retries.",
      "Inference timing is HTTP wall time, including Gateway/backend overhead, not native model-generation telemetry.",
    ] };
}

export async function limitedText(response: Response, token: string) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) fail("C1_RAW_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    if (token && text.includes(token)) fail("C1_SECRET_ECHO");
    return text;
  } finally { await reader.cancel().catch(() => {}); }
}

export function captureTransport(token: string, transport: typeof fetch = fetch) {
  let pending: Promise<any> = Promise.resolve(null);
  return {
    reset() { pending = Promise.resolve(null); },
    result() { return pending; },
    fetch: (async (input: any, init: any) => {
      const start = performance.now();
      const response = await transport(input, init);
      if (new URL(String(input)).pathname === "/gateway/v1/chat/completions") {
        pending = limitedText(response.clone(), token)
          .then(body => ({ status: response.status, contentType: response.headers.get("content-type"),
            body, elapsedMs: performance.now() - start }))
          .catch((e: any) => ({ status: response.status, body: null,
            captureError: /^C1_[A-Z0-9_]+$/.test(e?.message) ? e.message : "C1_RAW_CAPTURE_FAILED",
            elapsedMs: performance.now() - start }));
      }
      return response;
    }) as typeof fetch,
  };
}

function writeReport(directory: string, report: any, token = "") {
  const serialized = JSON.stringify(report, null, 2);
  if (token && serialized.includes(token)) fail("C1_SECRET_ECHO");
  for (const [file, text] of [["evidence.json", serialized + "\n"], ["evidence.csv", csv(report)],
    ["evidence.html", html(report)]]) {
    const target = path.join(directory, file);
    const temporary = target + ".tmp";
    fs.writeFileSync(temporary, text, { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, target);
  }
}

export async function executeSuite(plan: any, report: any, dependencies: {
  readSnapshot: () => Promise<any>; persist: () => Promise<void>;
  client: any; capture: ReturnType<typeof captureTransport>; signal?: AbortSignal;
}) {
  const { readSnapshot, persist, client, capture, signal } = dependencies;
  let stopped: string | null = null;
  try {
    report.before = await readSnapshot();
    report.productionState = "OBSERVED_GATEWAY_OFF_65_OPENAI";
    // Even mocked callers must supply the same validated read-only snapshot contract.
    if (report.before.gatewayEnabled !== false || report.before.openai !== 65 ||
        report.before.internal !== 0 || report.before.modelOverrides !== 0)
      fail("C1_PRODUCTION_POLICY_MISMATCH");
    report.kind = "LIVE_ISOLATED_SYNTHETIC";
    for (let index = 0; index < plan.services.length; index++) {
      const service = plan.services[index], row = report.rows[index];
      if (row.status === "UNSUPPORTED") continue;
      if (stopped || signal?.aborted) {
        row.reason = stopped || "C1_INTERRUPTED"; row.owner = "INDEXUS_TEST_EXECUTION";
        continue;
      }
      for (const variant of service.variants) {
        if (!variant.request || variant.error) continue;
        for (let repeat = 1; repeat <= 3 && !stopped && !signal?.aborted; repeat++) {
          const attempt = await executeAttempt(service, variant, repeat, client, capture, signal);
          row.attempts.push(attempt);
          if (attempt.rawGatewayResponse?.captureError === "C1_SECRET_ECHO") {
            // Do not persist anything that might contain the echoed token.
            row.attempts.pop(); stopped = "C1_SECRET_ECHO"; break;
          }
          if (attempt.rawGatewayResponse?.captureError) attempt.failure = {
            code: attempt.rawGatewayResponse.captureError, owner: "INDEXUS_EVIDENCE_CAPTURE",
            responsibilityConfirmed: true, httpStatus: null,
          };
          const failure = attempt.failure;
          if (failure && (["ai_internal_transport_error", "C1_ABORT_OR_TIMEOUT"].includes(failure.code) ||
              [401, 403, 429].includes(failure.httpStatus))) stopped = failure.code;
          aggregateRow(row);
          await persist(); // Retain each completed attempt, including failures.
        }
      }
    }
    if (stopped || signal?.aborted) report.error = stopped || "C1_INTERRUPTED";
  } catch (error: any) {
    report.error = /^C1_[A-Z0-9_]+$/.test(error?.message) ? error.message :
      /^B4_[A-Z0-9_]+$/.test(error?.code) ? "C1_GUARD_" + error.code.slice(3) :
        "C1_CONFIGURATION_OR_HARNESS_ERROR";
  } finally {
    try {
      report.after = await readSnapshot();
      report.finalVerified = !!report.before && unchanged(report.before, report.after);
      if (!report.finalVerified) report.error ||= "C1_FINAL_CONFIGURATION_CHANGED";
    } catch { report.error ||= "C1_FINAL_CONFIGURATION_UNVERIFIED"; }
    report.finishedAtUtc = new Date().toISOString();
    await persist();
  }
  return report;
}

async function main() {
  const [mode, planFile, output, offlineReferenceRoot] = process.argv.slice(2);
  if (!["--offline", "--run-c1"].includes(mode) || !planFile ||
      (mode === "--offline" ? !output || ![5, 6].includes(process.argv.length) : !!output || process.argv.length !== 4))
    fail("Usage: run.ts --offline PLAN.json OUTPUT_DIRECTORY | --run-c1 PLAN.json");
  if (mode === "--run-c1" && (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN ||
      os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.platform !== "linux"))
    fail("C1_CORPCRM01_ONLY");
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  validatePlan(plan, mode === "--offline" && offlineReferenceRoot ? path.resolve(offlineReferenceRoot) : ROOT);
  const report: any = initialReport(plan);
  if (mode === "--offline") {
    fs.mkdirSync(output, { recursive: false, mode: 0o700 });
    writeReport(output, report);
    console.log("C1_OFFLINE_ONLY: " + output);
    return;
  }
  if (process.getuid?.() !== 1001) fail("C1_RUN_AS_SEMAN");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") fail("C1_TLS_VERIFICATION_REQUIRED");
  // Existing loader supplies credentials to this standalone process, never to the agent.
  const token = process.env.INDEXUS_AI_GATEWAY_TOKEN;
  if (!token || token.trim() !== token || /\s/.test(token)) fail("C1_EXISTING_RUNTIME_TOKEN_REQUIRED");
  if (![BASE, BASE.slice(0, -1)].includes(process.env.INDEXUS_AI_GATEWAY_BASE_URL || ""))
    fail("C1_GATEWAY_URL_MISMATCH");
  const directory = path.join(os.homedir(), ".indexus-c1");
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o077))
    fail("C1_OUTPUT_DIRECTORY_UNSAFE");
  // Same plan cannot accidentally launch hundreds of inferences twice.
  const marker = path.join(directory, report.planSha256 + ".started");
  fs.writeFileSync(marker, new Date().toISOString(), { flag: "wx", mode: 0o600 });
  const runDirectory = fs.mkdtempSync(path.join(directory, "run-"));
  const { Client } = await import("pg");
  const dotenv = await import("dotenv");
  const parsed = dotenv.parse(fs.readFileSync(path.join(ROOT, ".env")));
  if (parsed.DATABASE_URL && process.env.DATABASE_URL && parsed.DATABASE_URL !== process.env.DATABASE_URL)
    fail("C1_DATABASE_ENVIRONMENT_CONFLICT");
  const connectionString = process.env.DATABASE_URL || parsed.DATABASE_URL;
  if (!connectionString) fail("C1_DATABASE_CONFIGURATION_REQUIRED");
  const readSnapshot = async () => {
    const db = new Client({ connectionString, application_name: "indexus-c1-readonly",
      connectionTimeoutMillis: 8000, options: "-c default_transaction_read_only=on -c statement_timeout=8000" });
    try {
      await db.connect();
      await db.query("BEGIN READ ONLY");
      if ((await db.query("SHOW transaction_read_only")).rows[0]?.transaction_read_only !== "on")
        fail("C1_DATABASE_NOT_READ_ONLY");
      const result = await db.query("SELECT version,value FROM ai_router_configuration WHERE singleton=true");
      if (result.rows.length !== 1) fail("C1_SETTINGS_UNAVAILABLE");
      return snapshot(result.rows[0], Object.keys(AI_SERVICES));
    } finally {
      await db.query("ROLLBACK").catch(() => {});
      await db.end().catch(() => {});
    }
  };
  const capture = captureTransport(token);
  // Explicit dependency injection affects ONLY this test client's instance.
  // No process.env, DB setting, live router or PM2 switch is written/enabled.
  const adapter = createInternalAIAdapter({ readConfiguration: () => ({
    production: true, replit: false, enabled: true, serverAllowed: true, baseURL: BASE, token,
  }), fetch: capture.fetch });
  const client = adapter.createClient({ timeout: 120_000, maxRetries: 0 });
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.on("SIGINT", abort); process.on("SIGTERM", abort);
  console.log("C1_RESULTS " + runDirectory);
  try {
    await executeSuite(plan, report, { readSnapshot, client, capture, signal: controller.signal,
      persist: async () => writeReport(runDirectory, report, token) });
    console.log("C1_RESULTS " + runDirectory);
    // Measured transport success alone cannot make the phase accepted.
    process.exitCode = report.error ? 1 : 2;
  } finally {
    process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename))
  main().catch((error: any) => {
    console.error(/^C1_[A-Z0-9_]+$/.test(error?.message) ? error.message : "C1_LOCAL_ERROR");
    process.exitCode = 1;
  });
