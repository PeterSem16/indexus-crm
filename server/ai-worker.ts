import { pool } from "./db";
import { createJobWorker } from "./lib/ai-jobs/worker";
import { aiJobStore, applyJob } from "./lib/ai-jobs/runtime";
import { executeJob } from "./lib/ai-jobs/handlers";
import { aiJobTimeout } from "./lib/ai-jobs/policy";
import { AISettingsStore } from "./lib/ai/settings-store";
import { installAIAdminReload } from "./lib/ai/admin-runtime";
import { assertJobSchema } from "./lib/ai-jobs/readiness";
import { createInferenceWorker } from "./lib/ai-jobs/inference-worker";
import { inferenceStore } from "./lib/ai-jobs/inference-live";
import { aiAdminSnapshot } from "./lib/ai/admin-runtime";
import { internalAIAdapter } from "./lib/ai/internal-adapter";

async function main() {
  if (!["--run", "--check"].includes(process.argv[2])) throw new Error("explicit_worker_start_required");
  // Do not create/seed configuration or migrate production from the worker.
  await assertJobSchema(pool);
  const settings = new AISettingsStore(pool);
  await settings.read();
  if (process.argv[2] === "--check") {
    console.info("[AI jobs] Schema and router configuration ready; worker not started");
    await pool.end(); return;
  }
  installAIAdminReload(async () => { await settings.read(); });
  const timeoutMs = aiJobTimeout();
  const worker = createJobWorker({ store: aiJobStore, timeoutMs,
    execute: (job, signal) => executeJob(pool, job, timeoutMs, signal), apply: applyJob });
  const inference = createInferenceWorker({ store: inferenceStore, timeoutMs,
    reload: async () => { await settings.read(); },
    settings: () => process.env.INDEXUS_AI_ROUTER_MODE === "legacy" ? undefined : aiAdminSnapshot()?.value,
    client: service => internalAIAdapter.createClient({ timeout: timeoutMs, maxRetries: 0 }, { service }) });
  await inference.heartbeat();
  const heartbeat = setInterval(() => { void inference.heartbeat().catch(() => {
    console.error("[AI jobs] Worker heartbeat unavailable");
  }); }, 10000);
  heartbeat.unref();
  let stopping = false;
  let stoppingInference: Promise<void> | undefined;
  let shutdown: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    stopping = true; worker.stop();
    clearInterval(heartbeat);
    stoppingInference = inference.stop().catch(() => {});
    shutdown = setTimeout(() => {
      console.error("[AI jobs] Shutdown deadline reached; lease recovery required");
      process.exit(1);
    }, timeoutMs + 30000);
    shutdown.unref();
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  console.info("[AI jobs] Worker ready; pilot concurrency=1");
  let preferInference = false;
  while (!stopping) {
    try {
      preferInference = !preferInference;
      const worked = preferInference ? await inference.tick() || await worker.tick()
        : await worker.tick() || await inference.tick();
      if (!worked) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    catch { console.error("[AI jobs] Worker database unavailable"); await new Promise(resolve => setTimeout(resolve, 2000)); }
  }
  await stoppingInference;
  await pool.end();
  if (shutdown) clearTimeout(shutdown);
}
main().catch(() => { console.error("[AI jobs] Worker startup failed"); process.exitCode = 1; void pool.end(); });
