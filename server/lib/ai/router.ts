import { createHash, randomUUID } from "node:crypto";
import type OpenAI from "openai";
import { AI_SERVICES, type AIOperation, type AIRoute, type AIRoutingOverrides, type AIService } from "./service-catalog";
import type { AIClientOptions, AIProviderAdapter } from "./openai-adapter";

export type AIClient = {
  chat: { completions: Pick<OpenAI["chat"]["completions"], "create"> };
  responses: Pick<OpenAI["responses"], "create">;
  audio: {
    transcriptions: Pick<OpenAI["audio"]["transcriptions"], "create">;
    speech: Pick<OpenAI["audio"]["speech"], "create">;
  };
};
export type AIRouterMode = "routed" | "legacy";
export type AITechnicalEvent = Readonly<{
  event: "ai.configuration" | "ai.request";
  revision: string;
  mode: AIRouterMode;
  configurationHash: string;
  service?: AIService;
  operation?: AIOperation;
  provider?: "openai";
  requestId?: string;
  model?: string;
  outcome?: "ok" | "error";
  durationMs?: number;
  httpStatus?: number;
}>;
export class AIRoutingError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export function parseAIRouterMode(value: string | undefined): AIRouterMode {
  if (!value || value === "routed") return "routed";
  if (value === "legacy") return "legacy";
  throw new AIRoutingError("ai_router_invalid_mode");
}

const DEFAULT_ROUTE: AIRoute = Object.freeze({ provider: "openai", model: null, enabled: true });
const safeModel = (value: unknown): string | undefined =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(value) ? value : undefined;

export function validateAIRoutes(overrides: AIRoutingOverrides): Readonly<Partial<Record<AIService, AIRoute>>> {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides))
    throw new AIRoutingError("ai_router_invalid_configuration");
  const result: Partial<Record<AIService, AIRoute>> = {};
  for (const [service, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(AI_SERVICES, service) || !value || typeof value !== "object" ||
        Object.keys(value).some(key => !["provider", "model", "enabled"].includes(key)) ||
        value.provider !== "openai" || typeof value.enabled !== "boolean" ||
        (value.model !== null && !safeModel(value.model)))
      throw new AIRoutingError("ai_router_invalid_configuration");
    result[service as AIService] = Object.freeze({ ...value });
  }
  return Object.freeze(result);
}

export function createAIRouter(settings: {
  adapter: AIProviderAdapter;
  overrides: AIRoutingOverrides;
  revision: string;
  mode: AIRouterMode;
  emit: (event: AITechnicalEvent) => void;
}) {
  const mode = settings.mode;
  // Legacy mode ignores routing configuration entirely: an invalid override must not block rollback.
  const overrides = mode === "legacy" ? {} : validateAIRoutes(settings.overrides);
  const configurationHash = createHash("sha256")
    .update(JSON.stringify(Object.keys(AI_SERVICES).sort().map(service =>
      [service, AI_SERVICES[service as AIService], overrides[service as AIService] || DEFAULT_ROUTE])))
    .digest("hex");
  let initialized = false;
  const emit = (event: Omit<AITechnicalEvent, "revision" | "mode" | "configurationHash">) => {
    // Logging failures must never change call execution. Never pass provider errors/bodies/options here.
    try { settings.emit({ ...event, revision: settings.revision, mode, configurationHash }); } catch {}
  };
  const initialize = () => {
    if (!initialized) { initialized = true; emit({ event: "ai.configuration" }); }
  };
  const routeFor = (service: AIService, operation?: AIOperation): AIRoute => {
    initialize();
    if (!Object.hasOwn(AI_SERVICES, service)) throw new AIRoutingError("ai_router_unknown_service");
    if (operation && AI_SERVICES[service] !== operation) throw new AIRoutingError("ai_router_unsupported_operation");
    const route = overrides[service] || DEFAULT_ROUTE;
    if (!route.enabled) throw new AIRoutingError("ai_service_disabled");
    if (route.provider !== settings.adapter.id) throw new AIRoutingError("ai_provider_unavailable");
    return route;
  };
  const observe = (result: any, service: AIService, operation: AIOperation, model: unknown, started: number) => {
    const requestId = randomUUID();
    const done = (outcome: "ok" | "error", status?: unknown) => emit({
      event: "ai.request", service, operation, provider: "openai", requestId,
      model: safeModel(model), outcome, durationMs: Math.max(0, Date.now() - started),
      ...(typeof status === "number" && status >= 100 && status <= 599 ? { httpStatus: status } : {}),
    });
    // Observe HTTP headers without consuming the body, parsing twice, or replacing SDK APIPromise.
    // This preserves asResponse/withResponse, streaming, abort and all overloads.
    const observation = typeof result?.asResponse === "function" ? result.asResponse() : result;
    void Promise.resolve(observation).then(
      value => done(typeof value?.status === "number" && value.status >= 400 ? "error" : "ok", value?.status),
      error => done("error", error?.status),
    ).catch(() => {});
  };

  return {
    initialize,
    available(service: AIService) {
      try {
        routeFor(service);
        return settings.adapter.isAvailable();
      } catch (error) {
        if (error instanceof AIRoutingError && error.code === "ai_service_disabled") return false;
        throw error;
      }
    },
    client(service: AIService, options: AIClientOptions = {}): AIClient {
      initialize();
      let sdk: OpenAI | undefined;
      const getSDK = () => sdk ||= settings.adapter.createClient(options);
      // Rollback delegates straight to the original provider, without overrides or request telemetry.
      if (mode === "legacy") return getSDK();
      // A disabled globally-created client must not prevent unrelated services/server startup.
      if (!Object.hasOwn(AI_SERVICES, service)) throw new AIRoutingError("ai_router_unknown_service");
      const wrap = (operation: AIOperation, call: (client: OpenAI, args: any[]) => any) =>
        (...args: any[]) => {
          const route = routeFor(service, operation);
          const body = route.model === null ? args[0] : { ...args[0], model: route.model };
          const started = Date.now();
          try {
            const result = call(getSDK(), [body, ...args.slice(1)]);
            observe(result, service, operation, body?.model, started);
            return result;
          } catch (error) {
            emit({ event: "ai.request", service, operation, provider: "openai", requestId: randomUUID(),
              model: safeModel(body?.model), outcome: "error", durationMs: Math.max(0, Date.now() - started) });
            throw error;
          }
        };
      return {
        chat: { completions: { create: wrap("chat", (client, args) =>
          (client.chat.completions.create as Function).apply(client.chat.completions, args)) } },
        responses: { create: wrap("responses", (client, args) =>
          (client.responses.create as Function).apply(client.responses, args)) },
        audio: {
          transcriptions: { create: wrap("transcription", (client, args) =>
            (client.audio.transcriptions.create as Function).apply(client.audio.transcriptions, args)) },
          speech: { create: wrap("speech", (client, args) =>
            (client.audio.speech.create as Function).apply(client.audio.speech, args)) },
        },
      } as AIClient;
    },
    chatProbe(service: AIService, body: Record<string, unknown>): Promise<Response> {
      const route = routeFor(service, "chat_probe");
      const input = route.model === null ? body : { ...body, model: route.model };
      const result = settings.adapter.chatProbe(input);
      if (mode !== "legacy") observe(result, service, "chat_probe", input.model, Date.now());
      return result;
    },
  };
}
