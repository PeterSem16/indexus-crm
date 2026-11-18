import assert from "node:assert/strict";
import test from "node:test";
import { queuedInference } from "./inference-runtime";
import { createInferenceWorker, inferenceFailureMeta } from "./inference-worker";
import { emailSentimentFailure } from "../ai/email-sentiment-contract";
import { aiJobEnabled } from "./policy";
import { aiAdminSnapshot, applyAIAdminSnapshot } from "../ai/admin-runtime";
import type { InferenceJob } from "./inference-store";

test("Configuration selects asynchronous tasks without a separate flag, and OpenAI/disabled/legacy remain unchanged", () => {
  const keys = ["AI_JOBS_TASK_CHECKLIST_ENABLED", "AI_JOBS_TASK_RESOLUTION_ENABLED",
    "AI_JOBS_EMAIL_SUMMARY_ENABLED", "INDEXUS_AI_ROUTER_MODE"];
  const before = keys.map(k => process.env[k]), saved = aiAdminSnapshot();
  try {
    keys.forEach(k => delete process.env[k]);
    for (const service of ["task.checklist", "task.resolution", "email.summary"] as const) {
      const value: any = { gateway: { enabled: true }, routes: {
        [service]: { provider: "internal", enabled: true, model: "indexus-document-audio:latest" } } };
      applyAIAdminSnapshot(1, value);
      assert.equal(aiJobEnabled(service), true);
      process.env[keys[["task.checklist", "task.resolution", "email.summary"].indexOf(service)]] = "false";
      assert.equal(aiJobEnabled(service), true);
      applyAIAdminSnapshot(2, { ...value, routes: { [service]: { ...value.routes[service], provider: "openai" } } });
      assert.equal(aiJobEnabled(service), false);
      applyAIAdminSnapshot(3, { ...value, routes: { [service]: { ...value.routes[service], enabled: false } } });
      assert.equal(aiJobEnabled(service), false);
      applyAIAdminSnapshot(4, value);
      process.env.INDEXUS_AI_ROUTER_MODE = "legacy";
      assert.equal(aiJobEnabled(service), false);
      delete process.env.INDEXUS_AI_ROUTER_MODE;
    }
  } finally {
    keys.forEach((k, i) => before[i] === undefined ? delete process.env[k] : process.env[k] = before[i]);
    if (saved) applyAIAdminSnapshot(saved.version, saved.value);
    else applyAIAdminSnapshot(0, { gateway: { enabled: false, baseURL: "", timeoutMs: 30000,
      maxRetries: 0, temperature: null, maxTokens: null }, routes: {} });
  }
});
test("closing an observer leaves its persisted job intact, without cancelling or sending inference", async () => {
  let enqueues = 0, reads = 0;
  const controller = new AbortController();
  const store: any = {
    enqueue: async () => { enqueues++; return { id: "persisted" }; },
    get: async () => { reads++; controller.abort(); return { id: "persisted", status: "pending" }; },
  };
  const request = queuedInference(store, "email.reply", "synthetic-model", {}, { signal: controller.signal, pollMs: 1 });
  await assert.rejects(Promise.resolve(request), { name: "AbortError" });
  assert.equal(enqueues, 1); assert.equal(reads, 1);
});
test("a timeout is one failed attempt, with no automatic retry or late result application", async () => {
  let failed = "", calls = 0, applied = 0, claimed = false, aborted = false;
  const job: Partial<InferenceJob> = { id: "synthetic", service: "email.reply", model: "synthetic-model", request: {} };
  const store: any = {
    heartbeat: async () => {}, offline: async () => {},
    claim: async () => { if (claimed) return; claimed = true; return job; },
    fail: async (_job: unknown, code: string) => { failed = code; },
    finish: async () => { applied++; },
  };
  const worker = createInferenceWorker({ store, timeoutMs: 1000, reload: async () => {},
    settings: () => ({ gateway: { enabled: true }, routes: {
      "email.reply": { provider: "internal", model: job.model, enabled: true } } } as any),
    client: () => ({ chat: { completions: { create: (_body: unknown, options: any) => {
      calls++;
      options.signal.addEventListener("abort", () => { aborted = true; });
      return { withResponse: () => new Promise(resolve => setTimeout(() => resolve({
        data: {}, response: new Response("{}") }), 1500)) };
    } } } } as any),
  });
  await worker.tick(); await new Promise(r => setTimeout(r, 600));
  assert.equal(failed, "timeout_outcome_unknown"); assert.equal(calls, 1);
  assert.equal(applied, 0); assert.equal(aborted, true); assert.equal(await worker.tick(), false);
});
test("manual review and transport status survive the queue without persisting provider text", async () => {
  const sensitive = "never-store-this-message";
  const meta = inferenceFailureMeta({ status: 422, code: "review_required", type: "review_required",
    message: sensitive, error: { reason_code: "possible_prompt_injection_affected_consent_classification",
      message: sensitive } });
  assert(!JSON.stringify(meta).includes(sensitive));
  const job = { id: "synthetic", status: "failed", error_code: "gateway_rejected", error_meta: meta };
  const store: any = { enqueue: async () => job, get: async () => job };
  try {
    await queuedInference(store, "email.sentiment", "synthetic", {});
    assert.fail("Expected manual review");
  } catch (error) {
    assert.deepEqual(emailSentimentFailure(error), { status: "review_required", code: "review_required",
      reason: "possible_prompt_injection_affected_consent_classification" });
  }
  const unavailable = inferenceFailureMeta({ status: 503, message: sensitive,
    error: { request_id: "safe-request-1", message: sensitive } });
  assert.deepEqual(emailSentimentFailure({ ...unavailable, error: unavailable }), {
    status: "failed", code: "email_sentiment_unavailable", httpStatus: 503, request_id: "safe-request-1" });
});
