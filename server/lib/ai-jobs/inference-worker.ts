import { randomUUID } from "node:crypto";
import { jobFailure, JobError } from "./policy";
import type { createInferenceStore, InferenceJob } from "./inference-store";
import type { AIPersistedSettings } from "../../../shared/ai-settings";
import type { AIClient } from "../ai/router";
import { withInternalWorkerContext } from "../ai/background-context";
import { emailSentimentReviewReason, emailSentimentRequestId } from "../ai/email-sentiment-contract";

export function inferenceFailureMeta(error: any) {
  const meta: NonNullable<InferenceJob["error_meta"]> = {};
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599) meta.status = error.status;
  if (error?.code === "review_required" && error?.type === "review_required") {
    meta.code = "review_required"; meta.type = "review_required";
    meta.reason_code = emailSentimentReviewReason(error.error);
  } else if (typeof error?.code === "string" && /^ai_internal_[a-z_]{1,64}$/.test(error.code)) {
    meta.code = error.code;
  }
  const requestId = emailSentimentRequestId(error?.request_id ?? error?.error?.request_id);
  if (requestId) meta.request_id = requestId;
  return meta;
}

export function createInferenceWorker(options: {
  store: ReturnType<typeof createInferenceStore>;
  reload(): Promise<void>;
  settings(): AIPersistedSettings | undefined;
  client: (service: InferenceJob["service"]) => AIClient;
  timeoutMs: number;
}) {
  const id = randomUUID();
  let running = false, stopped = false;
  let heartbeatWork: Promise<void> = Promise.resolve();
  return {
    heartbeat() {
      if (stopped) return Promise.resolve();
      heartbeatWork = heartbeatWork.catch(() => {}).then(async () => {
        if (!stopped) await options.store.heartbeat(id);
      });
      return heartbeatWork;
    },
    async stop() {
      stopped = true;
      await heartbeatWork.catch(() => {});
      await options.store.offline(id);
    },
    async tick() {
      if (running || stopped) return false;
      running = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const job = await options.store.claim(id, options.timeoutMs);
        if (!job) return false;
        try {
          await options.reload();
          const settings = options.settings(), route = settings?.routes[job.service];
          if (!settings?.gateway.enabled || !route?.enabled ||
            route.provider !== "internal" || route.model !== job.model)
            throw new JobError("source_route_changed", 409);
          const controller = new AbortController();
          const deadline = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort(); reject(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
            }, options.timeoutMs);
          });
          const work = withInternalWorkerContext(job.service, options.timeoutMs, async () => {
            const result = await options.client(job.service).chat.completions.create(job.request as any,
              { signal: controller.signal, maxRetries: 0, timeout: options.timeoutMs }).withResponse();
            const requestId = result.response.headers.get("x-request-id");
            return { data: result.data, status: result.response.status,
              requestId: requestId && /^[a-zA-Z0-9_.:-]{1,128}$/.test(requestId) ? requestId : null };
          });
          await options.store.finish(job, await Promise.race([work, deadline]));
        } catch (error) { await options.store.fail(job, jobFailure(error), inferenceFailureMeta(error)); }
        return true;
      } finally {
        if (timer) clearTimeout(timer);
        running = false;
      }
    },
  };
}
