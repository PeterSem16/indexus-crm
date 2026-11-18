import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { pool } from "../../db";
import { AI_JOBS_SCHEMA } from "./schema-migration";
import { createInferenceStore } from "./inference-store";
import { createInferenceWorker } from "./inference-worker";
import { queuedInference } from "./inference-runtime";
import { createAdminAIRouter } from "../ai/admin-router";
import { AI_SERVICES, type AIService } from "../ai/service-catalog";
import { internalEligible } from "../ai/settings-policy";
import type { AIPersistedSettings } from "../../../shared/ai-settings";
import { createJobStore, insertJob, jobTransaction } from "./store";
import { createInternalAIAdapter } from "../ai/internal-adapter";

const sdkRequest = (data: unknown) => {
  const promise = Promise.resolve(data);
  return Object.assign(promise, { withResponse: async () => ({ data,
    response: new Response(JSON.stringify(data), { status: 200, headers: { "x-request-id": "synthetic-request" } }) }) });
};
test("Configuration routes every switchable service through a real durable queue",
  { skip: !(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN) ? "Isolated development database only" : false },
  async t => {
    const schema = "ai_inference_test_" + randomUUID().replaceAll("-", "");
    await pool.query(`CREATE SCHEMA ${schema}`);
    const db = new pg.Pool({ ...(pool as any).options, max: 8, options: `-c search_path=${schema}` });
    const store = createInferenceStore(db);
    const model = "indexus-document-audio:latest";
    let version = 1, directOpenAI = 0, directInternal = 0, executions = 0;
    let settings: AIPersistedSettings = {
      gateway: { enabled: true, baseURL: "https://ai.cordbloodcenter.com/gateway/",
        timeoutMs: 30000, maxRetries: 0, temperature: null, maxTokens: null }, routes: {},
    };
    const adapter = (id: "openai" | "internal"): any => ({
      id, isAvailable: () => true,
      createClient: () => ({ chat: { completions: { create: () => {
        if (id === "openai") directOpenAI++; else directInternal++;
        return sdkRequest({ provider: id });
      } } } }),
    });
    const router = createAdminAIRouter({ adapter: adapter("openai"), adapters: [adapter("internal")],
      overrides: {}, mode: "routed", revision: "test", emit: () => {} }, {
      reload: async () => {}, snapshot: () => ({ version, value: settings }),
      enqueue: (service, selected, body, opts) => queuedInference(store, service, selected, body,
        { signal: opts?.signal, pollMs: 2, waitMs: 2000 }),
    });
    const worker = createInferenceWorker({ store, timeoutMs: 1000,
      reload: async () => {}, settings: () => settings,
      client: service => createInternalAIAdapter({
        readConfiguration: () => ({ production: true, replit: false, enabled: true,
          baseURL: "https://synthetic.invalid/gateway/", token: "synthetic-test-token-only" }),
        fetch: async (url, init) => {
          const path = new URL(String(url)).pathname;
          assert.equal((init?.headers as any).authorization, "Bearer synthetic-test-token-only");
          if (path.endsWith("/health/ready")) return new Response(null, { status: 200 });
          if (path.endsWith("/v1/models"))
            return Response.json({ object: "list", data: [{ id: model }] });
          if (path.endsWith("/indexus/v1/capabilities"))
            return Response.json({ apiVersion: "1", models: [{ id: model, revision: "synthetic",
              operations: ["chat.completions"], inputModalities: ["text"], streaming: false,
              outputFormats: ["text", "json_object"], maxInputTokens: 8192, maxOutputTokens: 8192 }] });
          assert(path.endsWith("/v1/chat/completions"));
          const body = JSON.parse(String(init?.body));
          executions++;
          assert.equal(body.model, settings.routes[service].model);
          assert.equal(body.messages[0].content, "Synthetic request");
          return Response.json({ id: "synthetic", object: "chat.completion", model: body.model,
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant",
              content: "Synthetic result: " + service } }] });
        },
      }).createClient({ timeout: 1000, maxRetries: 0 }, { service }),
    });
    const body = { model: "original-model", messages: [{ role: "user", content: "Synthetic request" }] };
    const pending = async () => {
      for (let i = 0; i < 500; i++) {
        if ((await db.query("SELECT 1 FROM ai_inference_jobs WHERE status='pending' LIMIT 1")).rows.length) return;
        await new Promise(r => setTimeout(r, 2));
      }
      assert.fail("Request was not queued");
    };
    const runOne = async () => {
      for (let i = 0; i < 500; i++) {
        if (await worker.tick()) return true;
        await new Promise(r => setTimeout(r, 2));
      }
      assert.fail("Worker did not claim the queued request");
    };
    try {
      await db.query("CREATE TABLE task_ai_checklist_generations(task_id text PRIMARY KEY)");
      await db.query(AI_JOBS_SCHEMA);
      await db.query(AI_JOBS_SCHEMA);
      await t.test("offline admission is explicit and never falls back to OpenAI", async () => {
        settings.routes["email.reply"] = { provider: "internal", enabled: true, model };
        version++;
        await assert.rejects(router.client("email.reply").chat.completions.create(body),
          /async_worker_unavailable/);
        assert.equal(directOpenAI, 0); assert.equal(directInternal, 0);
        assert.equal((await db.query("SELECT count(*)::int AS n FROM ai_inference_jobs")).rows[0].n, 0);
      });
      await worker.heartbeat();
      const services = (Object.keys(AI_SERVICES) as AIService[]).filter(internalEligible);
      for (const service of services) await t.test(service + ": UI route → pending → worker → original result", async () => {
        settings.routes[service] = { provider: "internal", enabled: true, model };
        version++;
        const request = router.client(service).chat.completions.create(body);
        const received = request.withResponse();
        await pending();
        const saved = (await db.query("SELECT * FROM ai_inference_jobs WHERE status='pending'")).rows;
        assert.equal(saved.length, 1);
        assert.deepEqual(saved[0].request, { ...body, model });
        assert.equal(await runOne(), true);
        const result = await received;
        assert.equal(result.response.status, 200);
        assert.equal(result.response.headers.get("x-request-id"), null, "unknown upstream ID is not invented");
        assert.equal((result.data as any).choices[0].message.content, "Synthetic result: " + service);
        const done = (await db.query("SELECT * FROM ai_inference_jobs WHERE id=$1", [saved[0].id])).rows[0];
        assert.equal(done.status, "completed"); assert.equal(done.attempts, 1);
        assert.equal(await worker.tick(), false);
      });
      await t.test("one shared execution slot also excludes the original task queue", async () => {
        const first = await store.enqueue("email.reply", model, body);
        const claimed = (await store.claim(randomUUID(), 1000))!;
        assert.equal(claimed.id, first.id);
        const tasks = createJobStore(db);
        await jobTransaction(db, tx => insertJob(tx, { service: "task.checklist", entityType: "task",
          entityId: "synthetic-task", ownerId: "synthetic-owner", payload: {}, inputFingerprint: "synthetic" }));
        assert.equal(await tasks.claim("synthetic-worker", 10000), null);
        await store.fail(claimed, "synthetic_failure");
        const task = (await tasks.claim("synthetic-worker", 10000))!;
        assert(task);
        await store.enqueue("email.reply", model, body);
        assert.equal(await store.claim(randomUUID(), 1000), undefined);
        await db.query("UPDATE ai_jobs SET status='failed',worker_id=null,locked_until=null WHERE id=$1", [task.id]);
        assert.equal(await runOne(), true);
      });
      await t.test("switching to OpenAI before execution fails the queued internal request without fallback", async () => {
        const request = router.client("email.reply").chat.completions.create(body);
        const result = Promise.resolve(request);
        void result.catch(() => {});
        await pending();
        const before = executions;
        settings.routes["email.reply"] = { provider: "openai", enabled: true, model: null }; version++;
        await runOne();
        await assert.rejects(result, /source_route_changed/);
        assert.equal(executions, before); assert.equal(directOpenAI, 0);
      });
      await t.test("an already-created client immediately follows the saved provider on its next request", async () => {
        const client = router.client("email.reply");
        assert.deepEqual(await client.chat.completions.create(body), { provider: "openai" });
        assert.equal(directOpenAI, 1);
        settings.routes["email.reply"] = { provider: "internal", enabled: true, model }; version++;
        const result = client.chat.completions.create(body).asResponse();
        await pending(); await runOne();
        assert.equal((await result).status, 200);
        assert.equal(directOpenAI, 1); assert.equal(directInternal, 0);
      });
      await t.test("expired processing is failed, retained and never automatically sent again", async () => {
        const job = await store.enqueue("email.reply", model, body);
        const claimed = (await store.claim(randomUUID(), 1000))!;
        await db.query("UPDATE ai_inference_jobs SET locked_until=now()-interval '1 second' WHERE id=$1", [job.id]);
        const before = executions;
        assert.equal(await worker.tick(), false);
        assert.equal((await store.get(job.id))!.error_code, "worker_lost_outcome_unknown");
        await assert.rejects(store.finish(claimed, { data: {}, status: 200, requestId: null }), /worker_claim_lost/);
        assert.equal(executions, before);
      });
      await t.test("queue status contains counts, never requests or responses", async () => {
        const status = await store.status();
        assert.equal(status.ready, true);
        assert.equal(status.counts.completed, services.length + 2);
        assert(!JSON.stringify(status).includes("Synthetic"));
      });
      console.info(`Verified all ${services.length} internally switchable services through PostgreSQL and worker execution`);
    } finally {
      await worker.stop(); await db.end();
      await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end();
    }
  });
