import crypto from "node:crypto";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { createAIRouter } from "../../server/lib/ai/router";
import { createInternalAIAdapter, type InternalAIConfiguration } from "../../server/lib/ai/internal-adapter";
import type { AIProviderAdapter } from "../../server/lib/ai/openai-adapter";
import { EMAIL_SENTIMENT_PROFILE as profile } from "../../server/lib/ai/email-sentiment-profile";
import { GATEWAY_URL } from "../../server/lib/ai/settings-policy";

declare const SENTIMENT_ANALYZER_SOURCE: string;
export const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
export class PilotError extends Error {}
export function analyzerSource(): string {
  if (typeof SENTIMENT_ANALYZER_SOURCE !== "undefined") return SENTIMENT_ANALYZER_SOURCE;
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const { extract, RECIPES } = require(path.resolve("script/ai-gateway-c1/replay.cjs"));
  return extract(RECIPES["email.sentiment"]);
}
export interface Observation {
  path: string; status: number | null; durationMs: number; completionText?: string;
}
/** Existing adapter/configuration/native fetch. No URL rewrite, TLS agent, proxy or token loader. */
export function createGatewayPilot(dependencies: {
  fetch?: typeof fetch; readConfiguration?: () => InternalAIConfiguration;
} = {}) {
  let armed = false, inspected = false, active = false, attempts = 0, expiresAt = 0;
  const observations: Observation[] = [], secrets = new Set<string>();
  const redact = (text: string) => {
    for (const secret of secrets) {
      text = text.split(JSON.stringify(secret).slice(1, -1)).join("[REDACTED]");
      text = text.split(secret).join("[REDACTED]");
    }
    return text;
  };
  const nativeFetch = dependencies.fetch ?? globalThis.fetch;
  const observedFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const post = init?.method === "POST";
    if (!url.href.startsWith(GATEWAY_URL)) throw new PilotError("gateway_endpoint_changed");
    if (post && (!armed || Date.now() >= expiresAt || attempts >= 18))
      throw new PilotError("inference_not_authorized");
    if (post) attempts++;
    const bearer = new Headers(init?.headers).get("authorization")?.replace(/^Bearer /, "");
    if (bearer) secrets.add(bearer);
    const t0 = performance.now();
    const observation: Observation = { path: url.pathname, status: null, durationMs: 0 };
    observations.push(observation);
    try {
      // Deliberately forward original arguments unchanged to the same native mechanism.
      const response = await nativeFetch(input, init);
      observation.status = response.status;
      if (post && response.status === 200) {
        const copy = response.clone(), reader = copy.body?.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          if (reader) for (;;) {
            if (init?.signal?.aborted) throw new PilotError("request_aborted");
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.length;
            if (size > 2 * 1024 * 1024) throw new PilotError("response_too_large");
            chunks.push(chunk.value);
          }
          let text = Buffer.concat(chunks).toString("utf8");
          try { text = JSON.parse(text)?.choices?.[0]?.message?.content ?? text; } catch {}
          observation.completionText = redact(typeof text === "string" ? text : "");
        } catch (error) {
          // Both branches must be cancelled on failure; otherwise the unread
          // original tee could continue buffering after the SDK has returned.
          void response.body?.cancel().catch(() => {});
          throw error;
        } finally {
          // Do not wait for the other tee branch here; the existing adapter owns it.
          void reader?.cancel().catch(() => {});
        }
      }
      return response;
    } finally { observation.durationMs = Math.round(performance.now() - t0); }
  };
  const adapter = createInternalAIAdapter({ ...dependencies, fetch: observedFetch });
  const forbidden = () => { throw new PilotError("external_provider_forbidden"); };
  const external: AIProviderAdapter = { id: "openai", isAvailable: () => false,
    createClient: forbidden, chatProbe: forbidden };
  const router = createAIRouter({ adapter: external, adapters: [adapter], mode: "routed",
    revision: "isolated-existing-gateway-sentiment",
    overrides: { [profile.service]: { provider: "internal", model: profile.model, enabled: true } },
    emit: () => {} });
  let signal: AbortSignal | undefined;
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    isAIAvailable: () => router.available(profile.service),
    aiClient: () => {
      const sdk = router.client(profile.service);
      return { chat: { completions: { create: (body: any) =>
        sdk.chat.completions.create(body, { signal, maxRetries: 0 }) } } };
    },
  }, { codeGeneration: { strings: false, wasm: false } });
  const source = analyzerSource();
  new vm.Script(ts.transpileModule(source + "\nglobalThis.analyze = analyzeEmailContent;", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText).runInContext(context, { timeout: 1000 });
  return {
    observations, analyzerSha256: hash(source), baseURL: GATEWAY_URL,
    attempts: () => attempts,
    stringifySafe: (value: unknown) => JSON.stringify(value,
      (_key, value) => typeof value === "string" ? redact(value) : value),
    async inspect() {
      inspected = false;
      const result = await adapter.inspect({ service: profile.service, timeoutMs: 30_000 });
      inspected = result.models.some(model => model.id === profile.model && model.outputFormats.includes("json_object"));
      if (!inspected) throw new PilotError("sentiment_model_not_advertised");
      return result;
    },
    arm(deadline: number) {
      if (!inspected) throw new PilotError("successful_service_discovery_required");
      if (!Number.isFinite(deadline) || deadline <= Date.now()) throw new PilotError("valid_test_window_required");
      expiresAt = deadline; armed = true;
    },
    disarm() { armed = false; },
    async analyze(content: string, subject: string, abort?: AbortSignal): Promise<any> {
      if (!armed || active) throw new PilotError("inference_not_authorized_or_concurrent");
      active = true; signal = abort;
      try { return JSON.parse(JSON.stringify(await context.analyze(content, subject))); }
      finally { active = false; signal = undefined; }
    },
  };
}
