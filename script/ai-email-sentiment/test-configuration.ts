import { createAIRouter } from "../../server/lib/ai/router";
import { createInternalAIAdapter } from "../../server/lib/ai/internal-adapter";
import { EMAIL_SENTIMENT_PROFILE } from "../../server/lib/ai/email-sentiment-profile";
import { GATEWAY_URL, DEFAULT_AI_SETTINGS } from "../../server/lib/ai/settings-policy";
import type { AIProviderAdapter } from "../../server/lib/ai/openai-adapter";

/** Isolated fixtures only: no environment reads, DB, real credentials or saved routes. */
export function createSentimentTestRouter(fetch: typeof globalThis.fetch, externalCall: () => never) {
  if (typeof fetch !== "function") throw new Error("synthetic_transport_required");
  const adapter = createInternalAIAdapter({
    readConfiguration: () => ({ enabled: true, production: true, replit: false,
      baseURL: GATEWAY_URL, token: "SYNTHETIC_SENTIMENT_NOT_A_CREDENTIAL" }),
    readSettings: () => ({ ...DEFAULT_AI_SETTINGS.gateway, timeoutMs: 120_000, maxRetries: 2,
      maxTokens: 8192, temperature: 1.5 }),
    fetch,
  });
  const openai: AIProviderAdapter = {
    id: "openai", isAvailable: () => true,
    createClient: externalCall, chatProbe: externalCall,
  };
  const router = createAIRouter({
    adapter: openai, adapters: [adapter], mode: "routed", revision: "synthetic-sentiment-test",
    overrides: { [EMAIL_SENTIMENT_PROFILE.service]: {
      provider: "internal", model: EMAIL_SENTIMENT_PROFILE.model, enabled: true,
    } },
    emit: () => {},
  });
  return { adapter, router };
}
