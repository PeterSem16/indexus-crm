import type { AIRoutingOverrides } from "../lib/ai/service-catalog";

/**
 * Every service still uses OpenAI and its unchanged request model.
 * The prepared internal text adapter requires explicit production configuration
 * AND a separately reviewed per-service override with an explicit model.
 * No credentials, URLs, fallback, or database settings here.
 * Changes are reviewed/deployed source changes; the effective revision is audited.
 */
export const AI_ROUTING_REVISION = "phase-1";
export const AI_ROUTING_OVERRIDES: AIRoutingOverrides = Object.freeze({});
