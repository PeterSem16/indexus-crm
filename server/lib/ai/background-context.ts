import { AsyncLocalStorage } from "node:async_hooks";
import { AI_JOB_SERVICES, type AIJobService } from "../../../shared/ai-jobs";
const context = new AsyncLocalStorage<{ service: AIJobService; timeoutMs: number }>();

/** Trusted process-local capability. Never accepted from request bodies or persisted prompts. */
export function withAIJobContext<T>(service: AIJobService, timeoutMs: number, action: () => Promise<T>): Promise<T> {
  if (!AI_JOB_SERVICES.includes(service) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000)
    throw new Error("invalid_background_context");
  return context.run({ service, timeoutMs }, action);
}
export function backgroundDeadline(service: string | undefined): number | undefined {
  const scope = context.getStore();
  return scope && scope.service === service ? scope.timeoutMs : undefined;
}
