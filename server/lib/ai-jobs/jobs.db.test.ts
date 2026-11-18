import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import pg from "pg";
import { pool } from "../../db";
import { AI_JOBS_SCHEMA } from "./schema-migration";
import { createAIJobRuntime } from "./runtime";
import { createJobStore, fingerprint, insertJob, type JobRow } from "./store";
import { createJobWorker } from "./worker";
import { registerAIJobRoutes } from "./routes";
import { validateJobSource } from "./context";
import { JobError } from "./policy";

test("isolated PostgreSQL AI queue: durable admission, HTTP ACL, worker fencing and atomic application",
  { skip: !(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN) ? "Development-only isolated schema; never run on production" : false },
  async t => {
    const schema = `ai_jobs_test_${randomUUID().replaceAll("-", "")}`;
    await pool.query(`CREATE SCHEMA ${schema}`);
    const sql = new pg.Pool({ ...(pool as any).options, max: 8, options: `-c search_path=${schema}` });
    const flags = ["AI_JOBS_TASK_CHECKLIST_ENABLED", "AI_JOBS_TASK_RESOLUTION_ENABLED", "AI_JOBS_EMAIL_SUMMARY_ENABLED"];
    const before = flags.map(k => process.env[k]);
    flags.forEach(k => process.env[k] = "true");
    let emailAllowed = true;
    const loadEmail = async (user: string, id: string, mailbox: unknown, language: unknown) => {
      if (!emailAllowed || user !== "owner" || !["personal@unit.invalid", "shared@unit.invalid"].includes(String(mailbox)))
        throw new JobError("forbidden", 403);
      const payload = { mailbox: String(mailbox), mailboxRef: String(mailbox), input: { emailSubject: "Synthetic request", emailBody: "Synthetic text", emailFrom: "Fixture", language: String(language) } };
      return { payload, hash: fingerprint(payload), ownerId: user };
    };
    const runtime = createAIJobRuntime(sql, loadEmail);
    const store = runtime.aiJobStore;
    const app = express();
    app.use(express.json());
    registerAIJobRoutes(app, (req, res, next) => {
      const id = req.get("x-test-user");
      if (!id) { res.sendStatus(401); return; }
      (req as any).session = { user: { id } }; next();
    }, {
      get: store.get, list: store.list, retry: runtime.retryJob,
      mailbox: async (_user, mailbox) => mailbox === "personal" ? "personal@unit.invalid" : mailbox.toLowerCase(),
      authorize: (job, user) => validateJobSource(sql, job, user, loadEmail),
      create: (user, input) => input.service === "email.summary"
        ? runtime.enqueueEmailJob(user, input.entityId, input.mailbox, input.locale ?? "sk")
        : runtime.enqueueTaskJob(input.service, input.entityId, user, input.locale),
    });
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const request = (url: string, user = "owner", body?: any) => fetch(base + url, {
      headers: { "x-test-user": user, "content-type": "application/json" },
      ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    });
    const newTask = async (id: string, country = "SK") => sql.query(`INSERT INTO tasks
      (id,title,description,status,country,created_by_user_id) VALUES($1,'Overiť podklady','Skontrolovať údaje žiadosti','pending',$2,'owner')`, [id, country]);
    const labels = ["Overiť prijaté podklady", "Skontrolovať údaje žiadosti", "Zaznamenať výsledok kontroly"];
    try {
      await sql.query(`
        CREATE TABLE users(id varchar PRIMARY KEY, role text, is_active boolean DEFAULT true, assigned_countries text[]);
        CREATE TABLE tasks(id varchar PRIMARY KEY,title text,description text,status text,country text,tags text[],
          related_entity_type text,created_by_user_id varchar,assigned_user_id varchar,request_recipients jsonb);
        CREATE TABLE task_group_members(group_id varchar,user_id varchar);
        CREATE TABLE task_checklist_items(id varchar DEFAULT gen_random_uuid() PRIMARY KEY,task_id varchar,
          position integer,label text,required boolean,done_at timestamp,done_by_user_id varchar,note text);
        CREATE TABLE task_ai_checklist_generations(task_id varchar PRIMARY KEY,status text DEFAULT 'idle',error_code text,
          attempt_count integer DEFAULT 0,attempt_token varchar,fingerprint text,generated_item_count integer DEFAULT 0,
          created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
        CREATE TABLE applied(id text PRIMARY KEY);
        INSERT INTO users VALUES('owner','user',true,ARRAY['SK']),('other','user',true,ARRAY['SK']),
          ('manager','manager',true,ARRAY['SK']),('group','user',true,ARRAY['SK']);
      `);
      await sql.query(AI_JOBS_SCHEMA);
      await sql.query(AI_JOBS_SCHEMA); // Idempotent startup migration.

      let checklist: JobRow;
      await t.test("HTTP 202 and concurrent duplicate clicks persist exactly one job before inference", async () => {
        await newTask("checklist");
        const responses = await Promise.all(Array.from({ length: 12 }, () =>
          request("/api/ai/jobs", "owner", { service: "task.checklist", entityType: "task", entityId: "checklist" })));
        assert(responses.every(r => r.status === 202));
        const bodies = await Promise.all(responses.map(r => r.json()));
        assert.equal(new Set(bodies.map(b => b.jobId)).size, 1);
        checklist = (await store.get(bodies[0].jobId))!;
        assert.equal(checklist.status, "pending"); assert.equal(checklist.attempts, 0);
        assert.equal((await sql.query("SELECT count(*)::int AS n FROM ai_jobs")).rows[0].n, 1);
        assert(!("payload" in bodies[0].job)); assert(!("owner_user_id" in bodies[0].job));
        assert.equal((await request("/api/ai/jobs", "owner", {
          service: "task.checklist", entityType: "task", entityId: "checklist", model: "injected",
        })).status, 400);
        assert.equal((await fetch(`${base}/api/ai/jobs/${checklist.id}`)).status, 401);
        assert.equal((await request(`/api/ai/jobs/${checklist.id}`, "other")).status, 403);
      });
      await t.test("two worker instances share one active slot; commit persists items and result together", async () => {
        await newTask("second");
        await runtime.enqueueTaskJob("task.checklist", "second", "owner");
        let started!: () => void, release!: () => void, calls = 0;
        const entered = new Promise<void>(r => started = r), blocked = new Promise<void>(r => release = r);
        const worker = createJobWorker({ store, timeoutMs: 120000,
          execute: async () => { calls++; started(); await blocked; return { steps: labels }; }, apply: runtime.applyJob });
        const other = createJobWorker({ store: createJobStore(sql), timeoutMs: 120000,
          execute: async () => { throw new Error("must not execute"); }, apply: runtime.applyJob });
        const running = worker.tick();
        await entered;
        assert.equal(await other.tick(), false); assert.equal(calls, 1);
        assert.equal((await sql.query("SELECT count(*)::int AS n FROM ai_jobs WHERE status='processing'")).rows[0].n, 1);
        release(); await running;
        const complete = (await store.get(checklist.id))!;
        assert.equal(complete.status, "completed"); assert.equal(complete.attempts, 1);
        assert.deepEqual(complete.result.steps, labels);
        const items = (await sql.query("SELECT label,required,done_at FROM task_checklist_items WHERE task_id='checklist' ORDER BY position")).rows;
        assert.deepEqual(items.map(i => i.label), labels); assert(items.every(i => !i.required && i.done_at === null));
        assert.equal(await worker.tick(), true); worker.stop(); assert.equal(await worker.tick(), false);
        const state = await runtime.queuedChecklistState("checklist", { readOnly: true, actorId: "owner" });
        assert(state && "job" in state);
        assert.equal(state.job.status, "completed");
      });
      await t.test("restart and lost lease never auto-resend an uncertain inference; stale worker cannot commit", async () => {
        await newTask("lost");
        const queued = await runtime.enqueueTaskJob("task.checklist", "lost", "owner");
        const old = (await store.claim("old-worker", 180000))!;
        assert.equal(old.id, queued.id);
        await sql.query("UPDATE ai_jobs SET locked_until=now()-interval '1 second' WHERE id=$1", [old.id]);
        assert.equal(await createJobStore(sql).claim("replacement", 180000), null);
        assert.equal((await store.get(old.id))!.error_code, "worker_lost_outcome_unknown");
        assert.equal(await store.finish(old, { steps: labels }, runtime.applyJob.bind(null, old, { steps: labels })), false);
        assert.equal((await sql.query("SELECT count(*)::int AS n FROM task_checklist_items WHERE task_id='lost'")).rows[0].n, 0);
        assert.equal((await runtime.enqueueTaskJob("task.checklist", "lost", "owner")).id, old.id);
        assert.equal((await store.get(old.id))!.status, "failed");
      });
      await t.test("manual retry rechecks access, keeps attempt history, and stops after three claims", async () => {
        const lost = (await store.list("owner", "task.checklist", "lost"))[0];
        assert.equal((await request(`/api/ai/jobs/${lost.id}/retry`, "other", {})).status, 403);
        for (let count = 2; count <= 3; count++) {
          assert.equal((await request(`/api/ai/jobs/${lost.id}/retry`, "owner", {})).status, 202);
          const claimed = (await store.claim(`retry-${count}`, 180000))!;
          assert.equal(claimed.attempts, count);
          await store.fail(claimed, "timeout_outcome_unknown");
        }
        assert.equal((await request(`/api/ai/jobs/${lost.id}/retry`, "owner", {})).status, 409);
        const history = (await sql.query("SELECT history FROM ai_jobs WHERE id=$1", [lost.id])).rows[0].history;
        assert.equal(history.filter((e: any) => e.event === "manual_retry").length, 2);
      });
      await t.test("application rollback, manual checklist and changed source cannot persist a late AI result", async () => {
        await newTask("manual");
        const job = await runtime.enqueueTaskJob("task.checklist", "manual", "owner");
        const claim = (await store.claim("rollback-worker", 180000))!;
        await assert.rejects(store.finish(claim, { steps: labels }, async tx => {
          await tx.query("INSERT INTO applied VALUES('partial')");
          throw new JobError("invalid_output");
        }));
        assert.equal((await sql.query("SELECT count(*)::int AS n FROM applied")).rows[0].n, 0);
        assert.equal((await store.get(job.id))!.status, "processing");
        await sql.query("INSERT INTO task_checklist_items(task_id,label,position) VALUES('manual','Manually recorded',0)");
        await sql.query("UPDATE task_ai_checklist_generations SET status='preserved',attempt_token=NULL WHERE task_id='manual'");
        await assert.rejects(store.finish(claim, { steps: labels }, tx => runtime.applyJob(claim, { steps: labels }, tx)), /stale_claim|preserved/);
        await store.fail(claim, "checklist_preserved");
        assert.equal((await sql.query("SELECT count(*)::int AS n FROM task_checklist_items WHERE task_id='manual'")).rows[0].n, 1);
        await newTask("changed");
        const changed = await runtime.enqueueTaskJob("task.checklist", "changed", "owner");
        await sql.query("UPDATE tasks SET title='Changed after enqueue' WHERE id='changed'");
        let providerCalls = 0;
        const worker = createJobWorker({ store, timeoutMs: 120000, execute: async j => {
          await validateJobSource(sql, j); providerCalls++; return { steps: labels };
        }, apply: runtime.applyJob });
        await worker.tick(); assert.equal(providerCalls, 0);
        assert.equal((await store.get(changed.id))!.error_code, "source_changed");
      });
      await t.test("private results, country/group revocation and deleted sources are checked on every read", async () => {
        await newTask("draft");
        await sql.query("INSERT INTO task_checklist_items(task_id,label,position,done_at) VALUES('draft','Verified evidence',0,now())");
        const draft = await runtime.enqueueTaskJob("task.resolution", "draft", "owner", "sk");
        process.env.AI_JOBS_TASK_RESOLUTION_ENABLED = "false";
        assert.equal((await runtime.drainingJob("owner", "task.resolution", "draft", "sk"))!.id, draft.id);
        await assert.rejects(runtime.enqueueTaskJob("task.resolution", "draft", "owner", "sk"), /async_service_disabled/);
        await assert.rejects(runtime.drainingJob("owner", "task.resolution", "other-record", "sk"), /async_service_draining/);
        process.env.AI_JOBS_TASK_RESOLUTION_ENABLED = "true";
        assert.equal((await request(`/api/ai/jobs/${draft.id}`, "manager")).status, 403);
        await sql.query("UPDATE users SET assigned_countries=ARRAY['HU'] WHERE id='owner'");
        assert.equal((await request(`/api/ai/jobs/${draft.id}`)).status, 403);
        await sql.query("UPDATE users SET assigned_countries=ARRAY['SK'] WHERE id='owner'");
        await sql.query("UPDATE tasks SET created_by_user_id=NULL,tags=ARRAY['group_id:fixture'] WHERE id='draft'");
        await sql.query("INSERT INTO task_group_members VALUES('fixture','owner')");
        assert.equal((await request(`/api/ai/jobs/${draft.id}`)).status, 200);
        await sql.query("DELETE FROM task_group_members WHERE user_id='owner'");
        assert.equal((await request(`/api/ai/jobs/${draft.id}`)).status, 403);
        await sql.query("DELETE FROM tasks WHERE id='draft'");
        assert.equal((await request(`/api/ai/jobs/${draft.id}`)).status, 404);
      });
      await t.test("email jobs bind owner, mailbox, message and language; personal listing excludes shared IDs", async () => {
        const personal = await runtime.enqueueEmailJob("owner", "same-graph-id", "personal@unit.invalid", "sk");
        const shared = await runtime.enqueueEmailJob("owner", "same-graph-id", "shared@unit.invalid", "sk");
        assert.notEqual(personal.id, shared.id);
        const listed = await request("/api/ai/jobs?service=email.summary&entityId=same-graph-id&mailbox=personal&locale=sk");
        assert.deepEqual((await listed.json()).jobs.map((j: any) => j.id), [personal.id]);
        assert.equal((await request(`/api/ai/jobs/${personal.id}`, "manager")).status, 403);
        emailAllowed = false;
        assert.equal((await request(`/api/ai/jobs/${personal.id}`)).status, 403);
        assert.deepEqual((await (await request("/api/ai/jobs?service=email.summary")).json()).jobs, []);
        assert.equal((await request(`/api/ai/jobs/${shared.id}/retry`, "owner", {})).status, 403);
      });
    } finally {
      server.closeAllConnections(); await new Promise<void>(r => server.close(() => r()));
      flags.forEach((k, i) => before[i] === undefined ? delete process.env[k] : process.env[k] = before[i]);
      await sql.end();
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      await pool.end();
    }
  });
