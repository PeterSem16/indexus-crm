import { z } from "zod";
import { AI_SERVICES } from "./service-catalog";
import type { AIPersistedSettings, AIVerification } from "../../../shared/ai-settings";

export const GATEWAY_URL = "https://ai.cordbloodcenter.com/gateway/";
export const DEFAULT_AI_SETTINGS: AIPersistedSettings = {
  gateway: { baseURL: GATEWAY_URL, enabled: false, timeoutMs: 30000, maxRetries: 0,
    temperature: null, maxTokens: null },
  routes: {},
};
export class AISettingsError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
export function internalEligible(service: string) {
  // Current callers require images / strict schema; do not offer a nonworking switch.
  return Object.hasOwn(AI_SERVICES, service) && AI_SERVICES[service as keyof typeof AI_SERVICES] === "chat" &&
    !["collection.document", "geography.priority"].includes(service);
}
const gatewaySchema = z.object({
  baseURL: z.string().max(256).refine(value => {
    try { const url = new URL(value); return url.href === GATEWAY_URL || url.href + "/" === GATEWAY_URL; }
    catch { return false; }
  }).transform(() => GATEWAY_URL),
  enabled: z.boolean(), timeoutMs: z.number().int().min(5000).max(120000),
  maxRetries: z.number().int().min(0).max(2),
  temperature: z.number().min(0).max(2).nullable(),
  maxTokens: z.number().int().min(1).max(8192).nullable(),
}).strict();
const routeSchema = z.object({
  provider: z.enum(["openai", "internal"]),
  model: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/).nullable(),
  enabled: z.boolean(),
}).strict();
export function parseGateway(value: unknown) {
  const parsed = gatewaySchema.safeParse(value);
  if (!parsed.success) throw new AISettingsError("gateway_config_invalid");
  return parsed.data;
}
export function parseRoute(service: string, value: unknown) {
  const result = routeSchema.safeParse(value);
  if (!Object.hasOwn(AI_SERVICES, service) || !result.success) throw new AISettingsError("route_invalid");
  const route = result.data;
  if (route.provider === "internal" && (!internalEligible(service) ||
    route.model !== "indexus-document-audio:latest")) throw new AISettingsError("route_invalid");
  return route;
}
export function parseSettings(value: any): AIPersistedSettings {
  if (!value || typeof value !== "object" || !value.routes || Array.isArray(value.routes) ||
    Object.keys(value).some(key => !["gateway", "routes"].includes(key))) throw new AISettingsError("settings_invalid");
  const routes: AIPersistedSettings["routes"] = {};
  for (const [service, route] of Object.entries(value.routes)) routes[service] = parseRoute(service, route);
  return { gateway: parseGateway(value.gateway), routes };
}
export function assertVersion(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new AISettingsError("version_conflict", 409);
}
export function freshSmoke(check: AIVerification | null, version: number, now = Date.now()) {
  if (!check || check.kind !== "smoke" || check.state !== "ready" || check.settingsVersion !== version ||
    !check.textVerified || !check.jsonVerified) return false;
  const elapsed = now - Date.parse(check.checkedAt);
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 15 * 60_000 &&
    check.models.some(model => model.id === "indexus-document-audio:latest" &&
      model.outputFormats.includes("text") && model.outputFormats.includes("json_object"));
}
