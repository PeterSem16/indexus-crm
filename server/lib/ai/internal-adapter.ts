import OpenAI from "openai";
import type { AIClientOptions, AIProviderAdapter } from "./openai-adapter";
import { aiAdminSnapshot } from "./admin-runtime";
import type { AIGatewaySettings } from "../../../shared/ai-settings";
import { INTERNAL_TEXT_MODELS, INTERNAL_RESPONSE_LIMIT, InternalAIError,
  validateInternalRequest, validateInternalDiscovery, validateInternalCompletion } from "./internal-contract";

export interface InternalAIConfiguration {
  enabled: boolean;
  production: boolean;
  replit: boolean;
  baseURL?: string;
  token?: string;
  serverAllowed?: boolean;
}
/** Only this adapter reads Gateway credentials. No host, port or secret is guessed. */
function environmentConfiguration(): InternalAIConfiguration {
  const settings = aiAdminSnapshot()?.value.gateway;
  const serverAllowed = process.env.INDEXUS_AI_GATEWAY_ENABLED === "true";
  return {
    enabled: serverAllowed && (settings?.enabled ?? true),
    serverAllowed,
    production: process.env.NODE_ENV === "production",
    replit: !!(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN),
    baseURL: settings?.baseURL ?? process.env.INDEXUS_AI_GATEWAY_BASE_URL,
    token: process.env.INDEXUS_AI_GATEWAY_TOKEN,
  };
}
function configuration(input: InternalAIConfiguration) {
  if (input.replit || !input.production) throw new InternalAIError("ai_internal_production_only", 503);
  if (!input.enabled) throw new InternalAIError("ai_internal_disabled", 503);
  if (!input.baseURL || !input.token?.trim()) throw new InternalAIError("ai_internal_configuration_missing", 503);
  let base: URL;
  try { base = new URL(input.baseURL); } catch { throw new InternalAIError("ai_internal_invalid_url", 503); }
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash ||
    ["8765", "8766", "8780", "11434"].includes(base.port) ||
    input.token !== input.token.trim() || /\s/.test(input.token))
    throw new InternalAIError("ai_internal_invalid_configuration", 503);
  base.pathname = base.pathname.replace(/\/+$/, "") + "/";
  return { base, token: input.token };
}
function abortError() { return new DOMException("AI request aborted", "AbortError"); }
async function readLimited(response: Response, limit: number, signal?: AbortSignal | null) {
  if (!response.body) return "";
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      if (signal?.aborted) throw abortError();
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new InternalAIError("ai_internal_response_too_large", 502);
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks).toString("utf8");
}
const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json" },
});

export function createInternalAIAdapter(dependencies: {
  readConfiguration?: () => InternalAIConfiguration;
  readSettings?: () => AIGatewaySettings | undefined;
  fetch?: typeof fetch;
  allowedModels?: readonly string[];
} = {}) {
  const readConfiguration = dependencies.readConfiguration ?? environmentConfiguration;
  const transport = dependencies.fetch ?? globalThis.fetch;
  const allowed = dependencies.allowedModels ?? INTERNAL_TEXT_MODELS;
  type Configuration = ReturnType<typeof configuration>;
  async function request(config: Configuration, path: string, signal?: AbortSignal | null, body?: string) {
    if (signal?.aborted) throw abortError();
    let response: Response;
    try {
      response = await transport(new URL(path, config.base), {
        method: body === undefined ? "GET" : "POST", redirect: "error", signal,
        headers: { authorization: `Bearer ${config.token}`, accept: "application/json",
          ...(body !== undefined ? { "content-type": "application/json" } : {}) },
        ...(body !== undefined ? { body } : {}),
      });
    } catch {
      if (signal?.aborted) throw abortError();
      throw new InternalAIError("ai_internal_transport_error", 502);
    }
    if (!response.ok || response.status !== 200) {
      await response.body?.cancel().catch(() => {});
      throw new InternalAIError("ai_internal_http_error",
        response.status >= 400 && response.status <= 599 ? response.status : 502);
    }
    let text: string;
    try {
      text = await readLimited(response, path === "v1/chat/completions" ? INTERNAL_RESPONSE_LIMIT : 256 * 1024, signal);
    } catch (error) {
      if (signal?.aborted) throw abortError();
      if (error instanceof InternalAIError) throw error;
      throw new InternalAIError("ai_internal_transport_error", 502);
    }
    if (path === "health/ready") return null; // Only readiness status is contracted, not a JSON body.
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/json"))
      throw new InternalAIError("ai_internal_invalid_content_type", 502);
    try { return JSON.parse(text); } catch { throw new InternalAIError("ai_internal_invalid_json_response", 502); }
  }
  async function discover(config: Configuration, signal?: AbortSignal | null) {
    await request(config, "health/ready", signal);
    const models = await request(config, "v1/models", signal);
    const capabilities = await request(config, "indexus/v1/capabilities", signal);
    return validateInternalDiscovery(models, capabilities, allowed);
  }
  const adapter: AIProviderAdapter & {
    runtimeStatus(): { production: boolean; replit: boolean; serverAllowed: boolean; tokenConfigured: boolean };
    inspect(options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<{
      ready: true; apiVersion: "1"; models: ReturnType<typeof validateInternalDiscovery>;
    }>;
  } = {
    id: "internal",
    runtimeStatus() {
      const config = readConfiguration();
      return { production: config.production, replit: config.replit,
        serverAllowed: config.serverAllowed ?? config.enabled, tokenConfigured: !!config.token?.trim() };
    },
    isAvailable() {
      try { configuration(readConfiguration()); return true; } catch { return false; }
    },
    createClient(options: AIClientOptions) {
      const config = configuration(readConfiguration());
      const managed = dependencies.readSettings?.() ??
        (dependencies.readConfiguration ? undefined : aiAdminSnapshot()?.value.gateway);
      const sdk = new OpenAI({
        baseURL: new URL("v1", config.base).href, apiKey: config.token,
        timeout: managed?.timeoutMs ?? options.timeout ?? 30_000,
        maxRetries: managed?.maxRetries ?? options.maxRetries ?? 0,
        fetch: async (input, init) => {
          try {
            const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
            if (url.href !== new URL("v1/chat/completions", config.base).href ||
              init?.method !== "POST" || typeof init?.body !== "string")
              throw new InternalAIError("ai_internal_unsupported_operation", 422);
            const body = JSON.parse(init.body);
            const spec = validateInternalRequest(body, allowed);
            const models = await discover(config, init.signal);
            const model = models.find(model => model.id === spec.model);
            if (!model) throw new InternalAIError("ai_internal_model_unavailable", 503);
            if (!model.outputFormats.includes(spec.format))
              throw new InternalAIError("ai_internal_output_format_unavailable", 422);
            if (spec.maxTokens !== undefined && model.maxOutputTokens !== null && spec.maxTokens > model.maxOutputTokens)
              throw new InternalAIError("ai_internal_token_limit_exceeded", 422);
            const result = await request(config, "v1/chat/completions", init.signal, init.body);
            return jsonResponse(validateInternalCompletion(result, spec));
          } catch (error) {
            if (init?.signal?.aborted) throw abortError();
            const safe = error instanceof InternalAIError ? error : new InternalAIError("ai_internal_request_failed");
            return jsonResponse({ error: { message: safe.code, type: "internal_gateway_error", code: safe.code } }, safe.status);
          }
        },
      });
      const create = sdk.chat.completions.create.bind(sdk.chat.completions);
      sdk.chat.completions.create = ((body: unknown, options?: unknown) => {
        if (managed && body && typeof body === "object") body = { ...body,
          ...(managed.temperature !== null ? { temperature: managed.temperature } : {}),
          ...(managed.maxTokens !== null ? { max_tokens: managed.maxTokens } : {}),
        };
        // Synchronous capability rejection preserves the SDK APIPromise without wrapping it.
        validateInternalRequest(body, allowed);
        return create(body as any, options as any);
      }) as typeof sdk.chat.completions.create;
      return sdk;
    },
    chatProbe() { throw new InternalAIError("ai_internal_unsupported_operation", 422); },
    async inspect(options = {}) {
      const config = configuration(readConfiguration());
      const timeoutMs = options.timeoutMs ?? 15_000;
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000)
        throw new InternalAIError("ai_internal_invalid_timeout", 422);
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (options.signal?.aborted) abort();
      options.signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, timeoutMs);
      try {
        const models = await discover(config, controller.signal);
        if (!models.length) throw new InternalAIError("ai_internal_model_unavailable", 503);
        return { ready: true, apiVersion: "1", models };
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
      }
    },
  };
  return adapter;
}
export const internalAIAdapter = createInternalAIAdapter();
