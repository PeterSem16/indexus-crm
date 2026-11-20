import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import pg from "pg";
import { pool } from "../../db";
import { AI_JOBS_SCHEMA } from "./schema-migration";
import { createJobStore, insertJob } from "./store";
import { createJobWorker } from "./worker";
import { createInferenceStore } from "./inference-store";
import { queuedInference } from "./inference-runtime";
import { createMaintenanceStore, parseMaintenanceCommand } from "./maintenance-store";
import { registerMaintenanceRoutes } from "./maintenance-routes";

test("maintenance commands reject ambiguous, unconfirmed and extra inputs", () => {
  const valid = { action: "pause", expectedVersion: 0, operationId: null, confirm: true };
  assert.deepEqual(parseMaintenanceCommand(valid), valid);
  for (const patch of [{ confirm: false }, { expectedVersion: -1 }, { expectedVersion: 0.1 },
    { expectedVersion: "0" }, { expectedVersion: 2147483647 }, { action: ["pause"] },
    { action: "reset" }, { operationId: randomUUID() }, { extra: "ignored?" },
    { action: "resume", operationId: null }, { action: "takeover", operationId: "bad" }])
    assert.throws(() => parseMaintenanceCommand({ ...valid, ...patch }), /maintenance_invalid/);
});

test("durable maintenance fences both queues without stopping admission or existing work",
  { skip: !(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN)
    ? "Isolated development schema only; never run against production" : false }, async t => {
    const schema = "ai_maintenance_test_" + randomUUID().replaceAll("-", "");
    await pool.query(`CREATE SCHEMA ${schema}`);
    const db = new pg.Pool({ ...(pool as any).options, max: 8, options: `-c search_path=${schema}` });
    const jobs = createJobStore(db), inference = createInferenceStore(db);
    const maintenance = createMaintenanceStore(db);
    const workerId = randomUUID();
    const request = { messages: [{ role: "user", content: "Synthetic maintenance fixture" }] };
    const enqueueJob = (id: string) => insertJob(db, { service: "email.summary",
      entityType: "email", entityId: id, ownerId: "operator-a",
      payload: { synthetic: true }, inputFingerprint: id });
    const pause = async (owner = "operator-a") => {
      const state = await maintenance.read(owner);
      await maintenance.change(owner, { action: "pause", expectedVersion: state.version,
        operationId: null, confirm: true });
      return maintenance.read(owner);
    };
    let finishWork = () => {};
    let server: ReturnType<typeof createServer> | undefined;
    let work: Promise<boolean> | undefined;
    try {
      await db.query("CREATE TABLE task_ai_checklist_generations(task_id text PRIMARY KEY)");
      await db.query(AI_JOBS_SCHEMA);
      await db.query("CREATE TABLE applied(id uuid PRIMARY KEY)");
      await inference.heartbeat(workerId);
      let entered!: () => void;
      const executing = new Promise<void>(resolve => { entered = resolve; });
      const release = new Promise<void>(resolve => { finishWork = resolve; });
      const worker = createJobWorker({ store: jobs, timeoutMs: 10_000,
        execute: async () => { entered(); await release; return { synthetic: true }; },
        apply: (job, _result, tx) => tx.query("INSERT INTO applied VALUES($1)", [job.id]).then(() => {}),
      });
      await enqueueJob("already-claimed");
      work = worker.tick();
      await executing;
      let state = await pause();
      await t.test("pause commits behind prior claim, and active work stays owned", async () => {
        assert.equal(state.mode, "paused");
        assert.equal(state.queues.jobs.processing, 1);
        assert.equal(state.workers.confirmed, 0);
        await inference.heartbeat(workerId);
        assert.equal((await maintenance.read("operator-a")).workers.confirmed, 1);
      });
      const pending = await enqueueJob("new-while-paused");
      const pendingInference = await inference.enqueue("email.reply", "indexus-document-audio:latest", request);
      await t.test("both claim paths and multiple workers leave fresh work and attempts untouched", async () => {
        assert.equal(await inference.ready(), true);
        const results = await Promise.all([jobs.claim("new-process-a", 1000),
          createJobStore(db).claim("new-process-b", 1000), inference.claim(randomUUID(), 1000)]);
        assert.deepEqual(results, [null, null, undefined]);
        assert.equal((await jobs.get(pending.id))?.attempts, 0);
        const row = (await db.query("SELECT status,attempts FROM ai_inference_jobs WHERE id=$1",
          [pendingInference.id])).rows[0];
        assert.deepEqual(row, { status: "pending", attempts: 0 });
      });
      await t.test("already-claimed work completes once without cancelling or releasing the pause", async () => {
        finishWork();
        assert.equal(await work, true);
        assert.equal((await db.query("SELECT count(*)::int n FROM applied")).rows[0].n, 1);
        assert.equal((await maintenance.read("operator-a")).mode, "paused");
      });
      await t.test("observer timeout leaves durable work pending; no inference or automatic replay", async () => {
        await assert.rejects(queuedInference(inference, "email.reply", "indexus-document-audio:latest",
          request, { waitMs: 5, pollMs: 2 }).withResponse(), /async_wait_outcome_unknown/);
        assert.equal((await db.query(`SELECT count(*)::int n FROM ai_inference_jobs
          WHERE status='pending' AND attempts=0`)).rows[0].n, 2);
        assert.equal(await inference.claim(randomUUID(), 1000), undefined);
      });
      await t.test("startup migration and lost controller connection never reset a pause", async () => {
        await db.query(AI_JOBS_SCHEMA);
        const connection = await db.connect();
        await connection.query("SELECT 1");
        connection.release(true);
        state = await createMaintenanceStore(db).read("operator-a");
        assert.equal(state.mode, "paused");
        assert.equal(await jobs.claim("after-restart", 1000), null);
      });
      await t.test("legacy, dead, and unacknowledged workers never become complete pause evidence", async () => {
        await db.query("INSERT INTO ai_inference_workers(id) VALUES($1)", [randomUUID()]);
        state = await maintenance.read("operator-a");
        assert.equal(state.workers.unsupported, 1);
        assert.equal(state.gatewayDrain, "unverified");
        assert.equal(state.backendDrain, "unverified");
        await db.query("UPDATE ai_inference_workers SET heartbeat_at=now()-interval '31 seconds'");
        assert.equal(await inference.ready(), false);
        await assert.rejects(inference.enqueue("email.reply", "indexus-document-audio:latest", request),
          /async_worker_unavailable/);
        assert.equal((await maintenance.read("operator-a")).mode, "paused");
        await inference.heartbeat(workerId);
      });
      await t.test("takeover is explicit, stale versions conflict and replay cannot resume a new operation", async () => {
        state = await maintenance.read("operator-b");
        const command = { action: "resume" as const, expectedVersion: state.version,
          operationId: state.operationId, confirm: true as const };
        await assert.rejects(maintenance.change("operator-b", command), /maintenance_owner_required/);
        await maintenance.change("operator-b", { ...command, action: "takeover" });
        await assert.rejects(maintenance.change("operator-a", command), /maintenance_conflict/);
        state = await maintenance.read("operator-b");
        assert.equal(state.ownedByMe, true);
        const resume = { ...command, expectedVersion: state.version };
        await maintenance.change("operator-b", resume);
        await assert.rejects(maintenance.change("operator-b", resume), /maintenance_conflict/);
        assert.equal((await maintenance.read("operator-b")).mode, "running");
        assert.equal((await jobs.claim("resumed-worker", 1000))?.id, pending.id);
        await jobs.fail((await jobs.get(pending.id))!, "synthetic_stop");
        state = await pause("operator-b");
        await assert.rejects(maintenance.change("operator-b",
          { ...resume, expectedVersion: state.version }), /maintenance_conflict/);
      });
      await t.test("a concurrent pause has one owner and one audit event", async () => {
        state = await maintenance.read("operator-b");
        await maintenance.change("operator-b", { action: "resume", expectedVersion: state.version,
          operationId: state.operationId, confirm: true });
        state = await maintenance.read("operator-a");
        const command = { action: "pause" as const, expectedVersion: state.version,
          operationId: null, confirm: true as const };
        const results = await Promise.allSettled([maintenance.change("operator-a", command),
          maintenance.change("operator-b", command)]);
        assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
        const audit = (await maintenance.read("operator-a")).audit;
        assert.equal(audit.filter(a => a.version === state.version + 1).length, 1);
      });
      await t.test("real transaction ordering prevents claims that linearize after pause", async () => {
        const tx = await db.connect();
        try {
          await tx.query("BEGIN");
          await tx.query("SELECT pg_advisory_xact_lock(517,1)");
          assert.equal(await jobs.claim("lock-contention", 1000), null);
          assert.equal(await inference.claim(randomUUID(), 1000), undefined);
          await tx.query("COMMIT");
        } finally { tx.release(); }
        assert.equal(await jobs.claim("after-confirmation", 1000), null);
      });
      await t.test("HTTP ACL, origin, JSON shape and safe failure responses are enforced", async () => {
        const app = express();
        app.use(express.json());
        registerMaintenanceRoutes(app, (req, res, next) => {
          if (req.get("x-fixture-admin") !== "yes") { res.sendStatus(403); return; }
          (req as any).session = { user: { id: "operator-a" } }; next();
        }, maintenance);
        server = createServer(app);
        await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
        const base = `http://127.0.0.1:${(server.address() as any).port}/api/configurator/ai/maintenance`;
        assert.equal((await fetch(base)).status, 403);
        let response = await fetch(base, { headers: { "x-fixture-admin": "yes" } });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "no-store");
        const view = await response.json();
        assert(!JSON.stringify(view).includes("Synthetic maintenance fixture"));
        assert(!("owner_id" in view));
        for (const [origin, status] of [["https://foreign.invalid", 403], ["", 400]] as const) {
          response = await fetch(base, { method: "PUT", headers: { "x-fixture-admin": "yes",
            "content-type": "application/json", ...(origin ? { origin } : {}) },
          body: JSON.stringify({ invalid: true }) });
          assert.equal(response.status, status);
        }
      });
      await t.test("missing durable gate fails closed rather than treating absence as running", async () => {
        await db.query("DELETE FROM ai_queue_maintenance");
        await assert.rejects(jobs.claim("missing-gate", 1000), /maintenance_unavailable/);
        await assert.rejects(inference.claim(randomUUID(), 1000), /maintenance_unavailable/);
        await assert.rejects(inference.heartbeat(workerId), /maintenance_unavailable/);
      });
    } finally {
      finishWork();
      await work?.catch(() => {});
      if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
      await db.end();
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    }
  });
