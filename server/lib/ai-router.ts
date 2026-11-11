import { AI_ROUTING_OVERRIDES, AI_ROUTING_REVISION } from "../config/ai-routing";
import { createAIRouter, parseAIRouterMode } from "./ai/router";
import { openAIAdapter } from "./ai/openai-adapter";
import { internalAIAdapter } from "./ai/internal-adapter";

const router = createAIRouter({
  adapter: openAIAdapter,
  adapters: [internalAIAdapter],
  overrides: AI_ROUTING_OVERRIDES,
  revision: AI_ROUTING_REVISION,
  mode: parseAIRouterMode(process.env.INDEXUS_AI_ROUTER_MODE),
  emit: event => console.info("[AI Router]", JSON.stringify(event)),
});
export const aiClient = router.client;
export const isAIAvailable = router.available;
export const aiChatProbe = router.chatProbe;
export const initializeAIRouter = router.initialize;
