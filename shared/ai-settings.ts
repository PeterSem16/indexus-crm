/** Public, secret-free AI administration contract. */
export type AIProvider = "openai" | "internal";
export type AIServiceRoute = { provider: AIProvider; model: string | null; enabled: boolean };
export interface AIGatewaySettings {
  baseURL: string;
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  temperature: number | null;
  maxTokens: number | null;
}
export interface AIVerification {
  state: "checking" | "ready" | "failed" | "blocked";
  kind: "connectivity" | "smoke" | "openai";
  checkedAt: string;
  durationMs: number;
  settingsVersion: number;
  code?: string;
  textVerified: boolean;
  jsonVerified: boolean;
  models: { id: string; revision: string; outputFormats: string[];
    maxInputTokens: number | null; maxOutputTokens: number | null }[];
}
export interface AIPersistedSettings {
  gateway: AIGatewaySettings;
  routes: Record<string, AIServiceRoute>;
}
export interface AISettingsView {
  version: number;
  gateway: AIGatewaySettings;
  services: { id: string; operation: string; route: AIServiceRoute; internalEligible: boolean }[];
  runtime: { production: boolean; replit: boolean; serverAllowed: boolean;
    tokenConfigured: boolean; openaiConfigured: boolean; mode: "routed" | "legacy" };
  gatewayCheck: AIVerification | null;
  openaiCheck: AIVerification | null;
  audit: { id: string; actorId: string; action: string; version: number; createdAt: string }[];
}
