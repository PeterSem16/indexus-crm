import { randomUUID } from "node:crypto";
import { jobFailure, type JobError } from "./policy";
import type { createJobStore, JobRow, JobSQL } from "./store";

export function createJobWorker(options: {
  store: ReturnType<typeof createJobStore>;
  timeoutMs: number;
  execute(job: JobRow, signal: AbortSignal): Promise<any>;
  apply(job: JobRow, result: any, tx: JobSQL): Promise<void>;
}) {
  const id = randomUUID();
  const leaseMs = options.timeoutMs + 60000;
  let stopping = false, running = false;
  return {
    stop() { stopping = true; },
    async tick(): Promise<boolean> {
      if (stopping || running) return false;
      running = true;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const job = await options.store.claim(`${id}:${randomUUID()}`, leaseMs);
        if (!job) return false;
        const controller = new AbortController();
        heartbeat = setInterval(() => {
          void options.store.heartbeat(job, leaseMs).then(ok => { if (!ok) controller.abort(); },
            () => controller.abort());
        }, 10000);
        try {
          // The deadline also bounds handlers and provider implementations which ignore abort.
          const deadline = new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              controller.abort();
              reject(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
            }, options.timeoutMs);
          });
          const result = await Promise.race([options.execute(job, controller.signal), deadline]);
          if (controller.signal.aborted) throw Object.assign(new Error("claim_lost"), { name: "AbortError" });
          await options.store.finish(job, result, tx => options.apply(job, result, tx));
        } catch (error) { await options.store.fail(job, jobFailure(error)); }
        return true;
      } finally {
        if (timeout) clearTimeout(timeout);
        if (heartbeat) clearInterval(heartbeat);
        running = false;
      }
    },
  };
}
