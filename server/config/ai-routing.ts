import type { AIRoutingOverrides } from "../lib/ai/service-catalog";

/**
 * Phase 1: every registered service uses OpenAI and its unchanged request model.
 * No credentials, URLs, internal provider, fallback, or database settings here.
 * Changes are reviewed/deployed source changes; the effective revision is audited.
 */
export const AI_ROUTING_REVISION = "phase-1";
export const AI_ROUTING_OVERRIDES: AIRoutingOverrides = Object.freeze({});
