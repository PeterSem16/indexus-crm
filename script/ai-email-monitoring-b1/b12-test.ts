/** Exact, single synthetic B1.2 integration through the real CRM router/adapter/parser. */
import { createAIRouter } from "../../server/lib/ai/router";
import { createInternalAIAdapter } from "../../server/lib/ai/internal-adapter";
import { parseEmailMonitoringAnalysis } from "../../server/lib/ai/email-monitoring-contract";
import { bindAnalyzer, analyzeSource } from "./source.cjs";
import { productionComparison } from "./b11-check.cjs";
export const B12 = Object.freeze({
  phase: "B1.2", endpoint: "https://ai.cordbloodcenter.com/gateway/v1/chat/completions",
  model: "indexus-email-monitoring:v1",
  input: "Prosím potvrďte prijatie správy. Ďakujem.",
  temperature: 0.1, max_tokens: 200, response_format: { type: "json_object" }, stream: false,
});
const fail = (code: string): never => { throw Error(code); };
const BASE = "https://ai.cordbloodcenter.com/gateway/";
async function capture(response: Response, token: string) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length; if (size > 2 * 1024 * 1024) fail("B12_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    if (text.includes(token)) fail("B12_SECRET_ECHO");
    return text;
  } finally { await reader.cancel().catch(() => {}); }
}
export async function executeB12(options: {
  token: string; source: ReturnType<typeof analyzeSource>; reference: any;
  readSnapshot: () => Promise<any>; claimOnce: () => void;
  fetch: typeof fetch; signal?: AbortSignal;
  pilotCase?: { id: string; input: string; expected: Readonly<Record<string, string | boolean>>; phase?: string };
  beforeInference?: () => void;
  requestTimeoutMs?: number;
}) {
  const timeoutMs = options.requestTimeoutMs ?? 30_000;
  if (![30_000, 120_000].includes(timeoutMs)) fail("B12_INVALID_TEST_TIMEOUT");
  const inputText = options.pilotCase?.input ?? B12.input;
  const expected = options.pilotCase?.expected ?? {
    wantsConsent: false, wantsToCancel: false, sentiment: "neutral", alertLevel: "none",
  };
  const phase = options.pilotCase?.phase ?? (options.pilotCase ? "B1.3" : B12.phase);
  const report: any = {
    phase, kind: "LIVE_ISOLATED_SINGLE_SYNTHETIC", request: { ...B12, phase, input: inputText },
    originalRequestSha256: options.source.requestSha256,
    startedAtUtc: new Date().toISOString(), before: null, after: null, production: null,
    inferenceAttempts: 0, cloudCalls: 0, transportTraces: [], httpStatus: null, usedModel: null,
    result: null, modelJson: null, modelContent: null, integrationProcessed: false, semanticChecks: [], error: null,
    productionSettingsWrites: 0, productionRecordWrites: 0, customerNotifications: 0,
    historicalModelInventory: options.pilotCase ? "UNVERIFIED_NON_BLOCKING_PER_B13" : "UNVERIFIED_NON_BLOCKING_PER_B12",
  };
  const abort = new AbortController();
  let abortSource: string | null = null;
  const forwardAbort = () => { abortSource = "CALLER_SIGNAL"; abort.abort(); };
  if (options.signal?.aborted) forwardAbort();
  options.signal?.addEventListener("abort", forwardAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const seen = new Set<string>();
  try {
    report.before = await options.readSnapshot();
    if (!productionComparison(options.reference, report.before, report.before).beforeMatchesOriginal)
      fail("B12_PRODUCTION_CHANGED_BEFORE_TEST");
    options.claimOnce();
    if (abort.signal.aborted) fail("B12_CALLER_ABORT");
    timer = setTimeout(() => { abortSource = "REQUEST_DEADLINE"; abort.abort(); }, timeoutMs);
    const adapter = createInternalAIAdapter({
      emailMonitoringTransport: "canonical-https",
      readConfiguration: () => ({ production: true, replit: false, enabled: true,
        baseURL: BASE, token: options.token }),
      fetch: (async (input: any, init: any) => {
        const url = String(input);
        const inference = url === B12.endpoint;
        if ((!inference && !["health/ready", "v1/models", "indexus/v1/capabilities"].some(p => url === BASE + p)) ||
          init.redirect !== "error" || init.method !== (inference ? "POST" : "GET"))
          fail("B12_UNEXPECTED_TRANSPORT");
        if (seen.has(url)) fail("B12_REPEATED_REQUEST_FORBIDDEN");
        seen.add(url);
        if (inference) {
          report.inferenceAttempts++;
          if (report.inferenceAttempts !== 1) fail("B12_MULTIPLE_INFERENCES_FORBIDDEN");
          const body = JSON.parse(init.body);
          if (body.model !== B12.model || body.temperature !== B12.temperature ||
            body.max_tokens !== B12.max_tokens || body.stream !== false ||
            body.response_format?.type !== "json_object" ||
            body.messages?.filter((m: any) => m.role === "user").length !== 1 ||
            body.messages.find((m: any) => m.role === "user").content !== inputText)
            fail("B12_WIRE_REQUEST_MISMATCH");
          options.beforeInference?.();
        }
        const transportStart = performance.now();
        let response: Response;
        try { response = await options.fetch(input, init); }
        catch (error: any) {
          report.transportTraces.push({ stage: inference ? "INFERENCE" : "DISCOVERY", status: null,
            route: new URL(url).pathname, elapsedMs: performance.now() - transportStart,
            failure: abort.signal.aborted ? "ABORTED" : "TRANSPORT_REJECTED" });
          throw error;
        }
        const trace: any = { stage: inference ? "INFERENCE" : "DISCOVERY", status: response.status,
          route: new URL(url).pathname, responseHeadersMs: performance.now() - transportStart };
        report.transportTraces.push(trace);
        if (!inference && response.status === 200 && url !== BASE + "health/ready") {
          const document = JSON.parse(await capture(response.clone(), options.token));
          const row = (url.endsWith("v1/models") ? document.data : document.models)
            ?.find((m: any) => m?.id === B12.model);
          // Retain only public, bounded catalog declarations. They do not prove Ollama routing.
          trace.modelDeclaration = row ? Object.fromEntries(
            ["id", "revision", "owned_by", "maxInputTokens", "maxOutputTokens",
              "ollamaModel", "ollamaDigest", "rulesVersion", "rulesSha256"].flatMap(key => {
              const value = row[key];
              return typeof value === "number" || typeof value === "string" && value.length <= 200
                ? [[key, value]] : [];
            })) : null;
        }
        if (inference) {
          report.httpStatus = response.status;
          const text = await capture(response.clone(), options.token);
          if (response.status === 200) {
            try {
              const envelope = JSON.parse(text);
              const model = envelope.model;
              report.usedModel = model === B12.model ? model : "UNEXPECTED_MODEL";
              const content = envelope.choices?.[0]?.message?.content;
              if (typeof content === "string") {
                if (content.length > 16384) fail("B12_MODEL_CONTENT_TOO_LARGE");
                report.modelContent = content;
                try { report.modelJson = JSON.parse(content); } catch {}
              }
            } catch { fail("B12_INVALID_GATEWAY_RESPONSE"); }
          }
        }
        return response;
      }) as typeof fetch,
    });
    const cloud: any = { id: "openai", isAvailable: () => false,
      createClient() { report.cloudCalls++; fail("B12_CLOUD_FALLBACK_FORBIDDEN"); },
      chatProbe() { report.cloudCalls++; fail("B12_CLOUD_FALLBACK_FORBIDDEN"); } };
    const router = createAIRouter({ adapter: cloud, adapters: [adapter], mode: "routed",
      overrides: { "email.monitoring": { provider: "internal", model: B12.model, enabled: true } },
      revision: "B12_ISOLATED_SINGLE_TEST_NOT_PRODUCTION_ROUTING", emit() {} });
    const client = router.client("email.monitoring", { timeout: timeoutMs, maxRetries: 0 });
    const analyze = bindAnalyzer(options.source, () => ({
      chat: { completions: { create: (body: any) => client.chat.completions.create(body, { signal: abort.signal }) } },
    }), parseEmailMonitoringAnalysis);
    report.result = await analyze(inputText);
    report.integrationProcessed = true;
    report.semanticChecks = Object.entries(expected).map(([field, expected]) =>
      ({ field, expected, actual: report.result[field], pass: report.result[field] === expected }));
    if (report.usedModel !== B12.model) fail("B12_MODEL_MISMATCH");
    if (report.httpStatus !== 200) fail("B12_HTTP_NOT_200");
    if (report.semanticChecks.some((s: any) => !s.pass)) fail("B12_SEMANTIC_MISMATCH");
  } catch (error: any) {
    report.errorIdentity = {
      name: ["AbortError", "TimeoutError", "APIConnectionTimeoutError", "APIConnectionError",
        "InternalServerError", "AuthenticationError", "RateLimitError", "Error"].includes(error?.name)
        ? error.name : "OTHER",
      status: Number.isInteger(error?.status) ? error.status : null,
      aborted: abort.signal.aborted,
    };
    report.error = /^B12_[A-Z0-9_]+$/.test(error?.message || "") ? error.message :
      /^ai_internal_[a-z_]+$/.test(error?.code || "") ? error.code :
      /^email_monitoring_[a-z_]+$/.test(error?.message || "") ? error.message :
      abort.signal.aborted ? "B12_ABORT_OR_TIMEOUT" : "B12_INTEGRATION_FAILED";
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener("abort", forwardAbort);
    try {
      report.after = await options.readSnapshot();
      if (report.before) report.production = productionComparison(options.reference, report.before, report.after);
      if (!report.production?.beforeMatchesOriginal || !report.production?.unchangedDuringCheck ||
        !report.production?.afterMatchesOriginal) report.error ||= "B12_PRODUCTION_CHANGED_OR_UNVERIFIED";
    } catch { report.error ||= "B12_FINAL_PRODUCTION_UNVERIFIED"; }
  }
  report.timeout = { requestMs: timeoutMs, abortSource, callerReason:
    options.signal?.aborted && ["SIGINT", "SIGTERM", "RUN_DEADLINE"].includes(options.signal.reason)
      ? options.signal.reason : options.signal?.aborted ? "OTHER_CALLER_ABORT" : null };
  report.finishedAtUtc = new Date().toISOString();
  report.verdict = !report.error && report.inferenceAttempts === 1 && report.cloudCalls === 0 &&
    report.httpStatus === 200 && report.usedModel === B12.model && report.integrationProcessed &&
    report.semanticChecks.length === Object.keys(expected).length && report.semanticChecks.length > 0 &&
    report.semanticChecks.every((s: any) => s.pass) ? "PASS" : "FAIL";
  if (JSON.stringify(report).includes(options.token)) fail("B12_SECRET_ECHO");
  return report;
}
