import { createAIRouter } from "./router";
import { deferredAIRequest } from "./admin-runtime";
import type { AIClientOptions } from "./openai-adapter";
import type { AIService } from "./service-catalog";
import type { AIClient } from "./router";
import type { AIPersistedSettings } from "../../../shared/ai-settings";

export function createAdminAIRouter(settings: Parameters<typeof createAIRouter>[0], dependencies: {
  reload(): Promise<void>;
  snapshot(): { version: number; value: AIPersistedSettings } | null;
}) {
  let revision = settings.revision, router = createAIRouter(settings);
  function currentRouter() {
    const state = dependencies.snapshot();
    const next = settings.mode === "legacy" || !state ? settings.revision : `admin-${state.version}`;
    if (revision !== next) {
      revision = next;
      router = createAIRouter({ ...settings, overrides: state!.value.routes, revision });
    }
    return router;
  }
  return {
    client(service: AIService, options: AIClientOptions = {}): AIClient {
      if (settings.mode === "legacy") return router.client(service, options);
      let selected: typeof router | undefined, client: AIClient;
      const call = (operation: (client: AIClient) => any) => deferredAIRequest(async () => {
        // Read on EVERY admission, including clients created before an admin edit.
        // Across PM2 workers, no stale cached route can silently choose OpenAI.
        await dependencies.reload();
        const current = currentRouter();
        if (current !== selected) { selected = current; client = current.client(service, options); }
        return { request: operation(client) };
      });
      return {
        chat: { completions: { create: ((...args: any[]) => call(client =>
          (client.chat.completions.create as Function).apply(client.chat.completions, args))) as any } },
        responses: { create: ((...args: any[]) => call(client =>
          (client.responses.create as Function).apply(client.responses, args))) as any },
        audio: {
          transcriptions: { create: ((...args: any[]) => call(client =>
            (client.audio.transcriptions.create as Function).apply(client.audio.transcriptions, args))) as any },
          speech: { create: ((...args: any[]) => call(client =>
            (client.audio.speech.create as Function).apply(client.audio.speech, args))) as any },
        },
      };
    },
    available: (service: AIService) => currentRouter().available(service),
    async chatProbe(service: AIService, body: Record<string, unknown>) {
      if (settings.mode !== "legacy") await dependencies.reload();
      return currentRouter().chatProbe(service, body);
    },
    initialize: () => currentRouter().initialize(),
  };
}
