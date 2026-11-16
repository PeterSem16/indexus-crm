/**
 * Explicit, isolated B1 test only. No application startup, mailbox reads, event
 * publishing, settings writes, production route switch or real CRM message rows.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { parse as dotenvParse } from "dotenv";
import { createAIRouter } from "../../server/lib/ai/router";
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { createInternalAIAdapter } from "../../server/lib/ai/internal-adapter";
import { EMAIL_MONITORING_PROFILE as profile } from "../../server/lib/ai/email-monitoring-profile";
import { parseEmailMonitoringAnalysis } from "../../server/lib/ai/email-monitoring-contract";
import { snapshot, unchanged } from "../ai-gateway-b4-pilot.cjs";
import { diagnose, declarationsFrom, errorIdentity } from "../ai-gateway-c1/diagnostics.cjs";
import { analyzeSource, bindAnalyzer } from "./source.cjs";
import { B1_EMAIL_CASES } from "./corpus";
import { createTestTable, verifyPersistence } from "./persistence";
import { assertRuntime, classifyTarget } from "./runtime.cjs";
declare const B1_PREPARED_SOURCE: ReturnType<typeof analyzeSource>;
const ROOT = "/var/www/indexus-crm";
const hash = (v: any) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
const fail = (code: string): never => { throw Error(code); };
async function boundedBody(response: Response, token: string) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.length;
      if (bytes > 2 * 1024 * 1024) fail("B1_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    if (token && text.includes(token)) fail("B1_SECRET_ECHO");
    return text;
  } finally { await reader.cancel().catch(() => {}); }
}
function isolatedRouter(adapter: ReturnType<typeof createInternalAIAdapter>) {
  let cloudCalls = 0;
  // Cloud is deliberately unavailable. Any accidental fallback becomes a hard test failure.
  const openai: any = { id: "openai", isAvailable: () => false,
    createClient() { cloudCalls++; fail("B1_CLOUD_FALLBACK_FORBIDDEN"); },
    chatProbe() { cloudCalls++; fail("B1_CLOUD_FALLBACK_FORBIDDEN"); } };
  const router = createAIRouter({ adapter: openai, adapters: [adapter], mode: "routed",
    overrides: { "email.monitoring": { provider: "internal", model: profile.model, enabled: true } },
    revision: "B1_ISOLATED_NOT_PRODUCTION_ROUTING", emit() {} });
  return { router, cloudCalls: () => cloudCalls };
}
async function mockedFailures() {
  const results: { httpStatus: number; outcome: string; cloudCalls: number;
    network: string; productionWrites: number }[] = [];
  for (const status of [401, 500, 504]) {
    const adapter = createInternalAIAdapter({
      readConfiguration: () => ({ production: true, replit: false, enabled: true,
        baseURL: "https://ai.cordbloodcenter.com/gateway/", token: "SYNTHETIC_B1_TOKEN" }),
      fetch: async () => new Response(null, { status }),
    });
    const h = isolatedRouter(adapter);
    const analyze = bindAnalyzer(B1_PREPARED_SOURCE, h.router.client, parseEmailMonitoringAnalysis);
    let caught = false;
    try { await analyze("SYNTETICKÝ EMAIL — test bezpečného zlyhania."); }
    catch (error: any) { caught = error.status === status; }
    if (!caught || h.cloudCalls()) fail("B1_ERROR_HANDLING_FAILED");
    results.push({ httpStatus: status, outcome: "SAFE_REJECTION", cloudCalls: h.cloudCalls(),
      network: "MOCKED_NOT_SENT_TO_GATEWAY", productionWrites: 0 });
  }
  return results;
}
async function main() {
  if (process.argv.slice(2).join(" ") !== "--run-b1") fail("B1_ARGUMENTS_INVALID");
  // Before reading any secrets or opening network/SQL.
  if (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.platform !== "linux" ||
      os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01") fail("B1_CORPCRM01_ONLY");
  if (process.getuid?.() !== 1001) fail("B1_RUN_AS_SEMAN");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") fail("B1_TLS_VERIFICATION_REQUIRED");
  assertRuntime(process.env);
  const liveSource = analyzeSource(path.join(ROOT, "server/lib/email-monitoring-service.ts"));
  if (liveSource.requestSha256 !== B1_PREPARED_SOURCE.requestSha256) fail("B1_ORIGINAL_REQUEST_CHANGED");
  const env = dotenvParse(fs.readFileSync(path.join(ROOT, ".env")));
  for (const key of ["DATABASE_URL", "INDEXUS_AI_GATEWAY_TOKEN"])
    if (process.env[key] && env[key] && process.env[key] !== env[key]) fail("B1_RUNTIME_ENV_CONFLICT");
  const token: string = process.env.INDEXUS_AI_GATEWAY_TOKEN || fail("B1_EXISTING_TOKEN_REQUIRED");
  const connectionString = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!token || /\s/.test(token)) fail("B1_EXISTING_TOKEN_REQUIRED");
  if (!connectionString) fail("B1_DATABASE_CONFIGURATION_REQUIRED");
  const parent = path.join(os.homedir(), ".indexus-email-monitoring-b1");
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { mode: 0o700 });
  const st = fs.lstatSync(parent);
  if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== process.getuid?.() || (st.mode & 0o077))
    fail("B1_OUTPUT_DIRECTORY_UNSAFE");
  const identity = hash({ profile, corpus: B1_EMAIL_CASES, request: B1_PREPARED_SOURCE.requestSha256 });
  try {
    fs.writeFileSync(path.join(parent, identity + ".started"), new Date().toISOString(), { flag: "wx", mode: 0o600 });
  } catch (error: any) {
    if (error.code === "EEXIST") fail("B1_RUN_ALREADY_STARTED");
    fail("B1_MARKER_WRITE_FAILED");
  }
  const out = fs.mkdtempSync(path.join(parent, "run-"));
  const report: any = { phase: "B1_EMAIL_MONITORING", kind: "LIVE_ISOLATED_SYNTHETIC",
    startedAtUtc: new Date().toISOString(), profile, preparedAnalyzerSha256: B1_PREPARED_SOURCE.sourceSha256,
    originalRequestSha256: B1_PREPARED_SOURCE.requestSha256, unchangedOriginalRequestVerified: true,
    runtime: "ISOLATED_PREPARED_BUNDLE_NOT_DEPLOYED_CRM", before: null, after: null, finalVerified: false,
    productionSettingsWrites: 0, productionMessageWrites: 0, actualMailboxReads: 0,
    attempts: [], mockedFailures: [], error: null,
    limitations: ["Temporary PostgreSQL tables verify the actual field mapper and metadata merge, not customer linkage or mailbox ingestion.",
      "Model semantic scores cover only the supplied synthetic corpus.",
      "HTTP on the exact approved private IP is unencrypted. The exception is scoped to this service/model.",
      "This test neither enables Gateway nor installs/activates a production route."] };
  const persist = () => {
    const text = JSON.stringify(report, null, 2);
    if (text.includes(token)) fail("B1_SECRET_ECHO");
    const file = path.join(out, "evidence.json");
    fs.writeFileSync(file + ".tmp", text + "\n", { mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
  };
  const readSnapshot = async () => {
    const db = new Client({ connectionString, application_name: "indexus-email-b1-snapshot",
      connectionTimeoutMillis: 8000, options: "-c default_transaction_read_only=on -c statement_timeout=8000" });
    try {
      await db.connect(); await db.query("BEGIN READ ONLY");
      if ((await db.query("SHOW transaction_read_only")).rows[0]?.transaction_read_only !== "on")
        fail("B1_DATABASE_NOT_READ_ONLY");
      const result = await db.query("SELECT version,value FROM ai_router_configuration WHERE singleton=true");
      if (result.rows.length !== 1) fail("B1_SETTINGS_UNAVAILABLE");
      return snapshot(result.rows[0], Object.keys(AI_SERVICES));
    } finally { await db.query("ROLLBACK").catch(() => {}); await db.end(); }
  };
  const db = new Client({ connectionString, application_name: "indexus-email-b1-temp-only", connectionTimeoutMillis: 8000 });
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.on("SIGINT", abort); process.on("SIGTERM", abort);
  try {
    report.before = await readSnapshot();
    report.mockedFailures = await mockedFailures();
    await db.connect(); await db.query("BEGIN");
    await db.query("SET LOCAL statement_timeout = '8s'");
    await createTestTable(db);
    for (const item of B1_EMAIL_CASES) {
      if (controller.signal.aborted) { report.error = "B1_CALLER_ABORT"; break; }
      const attempt: any = { id: item.id, input: item.content, expected: item.expected,
        request: null, modelOutput: null, adapterOutput: null, parser: null,
        modelDeclarations: null, requestedMaxTokens: 200, declaredMaxOutputTokens: null,
        transportTraces: [], persistence: null, semanticChecks: [], failure: null };
      let fatal: string | null = null, caught: any, localDeadline = false;
      const perAttempt = new AbortController();
      const forwardAbort = () => perAttempt.abort();
      if (controller.signal.aborted) forwardAbort();
      else controller.signal.addEventListener("abort", forwardAbort, { once: true });
      const timer = setTimeout(() => { localDeadline = true; perAttempt.abort(); }, 30_000);
      const start = performance.now();
      const adapter = createInternalAIAdapter({
        // Instance-only test configuration. Does not touch env, DB, global singleton or PM2.
        readConfiguration: () => ({ enabled: true, production: true, replit: false, token,
          baseURL: "https://ai.cordbloodcenter.com/gateway/" }),
        fetch: (async (input: any, init: any) => {
          const url = new URL(String(input));
          const stage = classifyTarget(url.href);
          if (init.redirect !== "error" || init.method !== (stage === "INFERENCE" ? "POST" : "GET"))
            fail("B1_UNEXPECTED_TRANSPORT_OPTIONS");
          if (stage === "INFERENCE") attempt.request = JSON.parse(init.body);
          let response: Response;
          try { response = await fetch(input, init); }
          catch (error) {
             attempt.transportTraces.push({ stage, transportError: errorIdentity(error), aborted: !!init.signal?.aborted });
            throw error;
          }
          attempt.transportTraces.push({ stage, status: response.status });
          let text;
          try { text = await boundedBody(response.clone(), token); }
          catch (error: any) {
            fatal = /^B1_[A-Z0-9_]+$/.test(error?.message) ? error.message : "B1_CAPTURE_FAILED";
            throw Error(fatal!);
          }
          if (response.ok && url.pathname.endsWith("/indexus/v1/capabilities")) {
            try { attempt.modelDeclarations = declarationsFrom(JSON.parse(text)); } catch {}
          }
          if (stage === "INFERENCE") {
            try { attempt.modelOutput = JSON.parse(text).choices?.[0]?.message?.content ?? null; } catch {}
          }
          return response;
        }) as typeof fetch,
      });
      const h = isolatedRouter(adapter);
      const client = h.router.client("email.monitoring", { timeout: 30000, maxRetries: 0 });
      const analyze = bindAnalyzer(B1_PREPARED_SOURCE, () => ({
        chat: { completions: { create: async (body: any) => {
          const output = await client.chat.completions.create(body, { signal: perAttempt.signal });
          attempt.adapterOutput = output;
          return output;
        } } },
      }), parseEmailMonitoringAnalysis);
      try {
        const parsed = await analyze(item.content);
        attempt.parser = { state: "ACCEPTED", value: parsed };
        attempt.semanticChecks = Object.entries(item.expected).map(([field, expected]) =>
          ({ field, expected, actual: parsed[field], pass: parsed[field] === expected }));
        attempt.persistence = await verifyPersistence(db, item.id, parsed);
      } catch (error: any) {
        caught = error;
        attempt.failure = /^ai_internal_[a-z_]+$/.test(error?.code || "") ? error.code :
          /^email_monitoring_[a-z_]+$/.test(error?.message || "") ? error.message :
          localDeadline ? "B1_LOCAL_DEADLINE" : controller.signal.aborted ? "B1_CALLER_ABORT" : "B1_TEST_FAILED";
        attempt.safeErrorIdentity = errorIdentity(error);
      } finally {
        clearTimeout(timer); controller.signal.removeEventListener("abort", forwardAbort);
        attempt.elapsedMs = performance.now() - start;
      }
      attempt.declaredMaxOutputTokens = attempt.modelDeclarations?.models?.find((m: any) => m.id === profile.model)?.maxOutputTokens ?? null;
      attempt.diagnostic = diagnose({ error: caught, signal: perAttempt.signal,
        localReason: localDeadline ? "C11_LOCAL_DEADLINE" : null, traces: attempt.transportTraces });
      attempt.cloudCalls = h.cloudCalls();
      if (fatal === "B1_SECRET_ECHO") { report.error = fatal; break; }
      report.attempts.push(attempt);
      persist();
      if (fatal || attempt.cloudCalls || attempt.failure) {
        report.error = fatal || attempt.failure || "B1_CLOUD_FALLBACK_FORBIDDEN"; break;
      }
    }
  } catch (error: any) {
    report.error = /^B[14]_[A-Z0-9_]+$/.test(error?.message || "") ? error.message : "B1_PREFLIGHT_OR_TEST_FAILED";
  } finally {
    await db.query("ROLLBACK").catch(() => {}); await db.end().catch(() => {});
    process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort);
    try {
      report.after = await readSnapshot();
      report.finalVerified = !!report.before && unchanged(report.before, report.after);
      if (!report.finalVerified) report.error ||= "B1_CONFIGURATION_CHANGED_OR_UNVERIFIED";
    } catch { report.error ||= "B1_FINAL_CONFIGURATION_UNVERIFIED"; }
    report.finishedAtUtc = new Date().toISOString();
    report.passed = !report.error && report.finalVerified && report.attempts.length === B1_EMAIL_CASES.length &&
      report.attempts.every((a: any) => a.persistence && a.semanticChecks.every((s: any) => s.pass));
    persist();
  }
  console.log("B1_RESULTS " + path.join(out, "evidence.json"));
  console.log(JSON.stringify({ passed: report.passed, error: report.error,
    attempts: report.attempts.length, finalVerified: report.finalVerified,
    gatewayEnabled: report.after?.gatewayEnabled ?? null, openai: report.after?.openai ?? null,
    semanticFailures: report.attempts.flatMap((a: any) => a.semanticChecks.filter((s: any) => !s.pass)
      .map((s: any) => ({ case: a.id, field: s.field }))) }, null, 2));
  process.exitCode = report.passed ? 0 : 2;
}
main().catch((error: any) => {
  console.error(/^B1_[A-Z0-9_]+$/.test(error?.message || "") ? error.message : "B1_LOCAL_SETUP_FAILED");
  process.exitCode = 1;
});
