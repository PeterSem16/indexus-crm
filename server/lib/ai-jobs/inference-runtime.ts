import type { AIService } from "../ai/service-catalog";
import type { createInferenceStore } from "./inference-store";
import { JobError } from "./policy";

type Store = ReturnType<typeof createInferenceStore>;
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Preserve the SDK contract. Only the worker, never this observer, calls AI. */
export function queuedInference(store: Store, service: AIService, model: string, body: unknown,
  options: { signal?: AbortSignal | null; waitMs?: number; pollMs?: number } = {}) {
  const received = (async () => {
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const job = await store.enqueue(service, model, body);
    const until = Date.now() + (options.waitMs ?? 15 * 60_000);
    for (;;) {
      // Cancelling a browser/observer must not cancel or resend durable work.
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const current = await store.get(job.id);
      if (!current) throw new JobError("job_not_found", 404);
      if (current.status === "failed") {
        const meta = current.error_meta ?? {};
        throw Object.assign(new JobError(meta.code ?? current.error_code ?? "provider_or_contract_error", meta.status ?? 502),
          { ...meta, error: meta });
      }
      if (current.status === "completed") {
        if (!current.response) throw new JobError("invalid_output", 502);
        return current.response;
      }
      if (Date.now() >= until) throw new JobError("async_wait_outcome_unknown", 504);
      await pause(options.pollMs ?? 500);
    }
  })();
  void received.catch(() => {});
  const response = (value: Awaited<typeof received>) => new Response(JSON.stringify(value.data), {
    status: value.status, headers: { "content-type": "application/json",
      ...(value.requestId ? { "x-request-id": value.requestId } : {}) },
  });
  const data = received.then(value => value.data);
  void data.catch(() => {});
  return {
    then: data.then.bind(data), catch: data.catch.bind(data), finally: data.finally.bind(data),
    asResponse: () => received.then(response),
    withResponse: () => received.then(value => ({ data: value.data, response: response(value),
      request_id: value.requestId })),
    [Symbol.toStringTag]: "Promise",
  };
}
