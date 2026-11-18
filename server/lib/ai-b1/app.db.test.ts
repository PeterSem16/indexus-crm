import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { get } from "node:http";
import pg from "pg";
import { createB1App } from "./app";
import { B1_SCHEMA } from "./schema";
import { AI_JOBS_SCHEMA } from "../ai-jobs/schema-migration";
import { createAIJobRuntime } from "../ai-jobs/runtime";
import { createJobWorker } from "../ai-jobs/worker";
import { LANGUAGES } from "../../../script/ai-three-services/corpus";
import { pool as defaultPool } from "../../db";

test("B1 launcher rejects Replit even with NODE_ENV=production", () => {
  const result = spawnSync(process.execPath, ["ops/ai-jobs-b1/launch.cjs", "web"],
    { env: { ...process.env, NODE_ENV: "production" }, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /B1_AUTHORIZED_OPERATOR_REQUIRED/);
});
test("isolated acceptance API authenticates, admits one original synthetic task and persists queue states (fixture, not live AI)",
  async () => {
    assert(process.env.REPLIT_DEV_DOMAIN || process.env.REPL_ID, "Development database only");
    const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const schema = "b1_test_" + randomUUID().replaceAll("-", "");
    const db = new pg.Pool({ connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema},public` });
    const oldFlag = process.env.AI_JOBS_TASK_CHECKLIST_ENABLED;
    process.env.AI_JOBS_TASK_CHECKLIST_ENABLED = "true";
    let server: ReturnType<ReturnType<typeof createB1App>["listen"]> | undefined;
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await db.query(B1_SCHEMA + AI_JOBS_SCHEMA);
      const app = createB1App(db, { uiPassword: "synthetic-b1-password", sessionSecret: randomUUID() }, "checklist");
      server = app.listen(0, "127.0.0.1");
      await new Promise<void>(resolve => server!.once("listening", resolve));
      const port = (server.address() as { port: number }).port, base = `http://127.0.0.1:${port}`;
      const req = (route: string, init: RequestInit = {}) => fetch(base + route, init);
      assert.equal((await req("/api/tasks")).status, 401);
      // Native fetch owns Host; use HTTP for the actual DNS-rebinding probe.
      const badHost = await new Promise<number | undefined>((resolve, reject) => {
        get(base + "/api/tasks", { headers: { Host: "public.example.test" } }, response => {
          response.resume(); resolve(response.statusCode);
        }).on("error", reject);
      });
      assert.equal(badHost, 403);
      assert.equal((await req("/api/auth/login", { method: "POST", headers: {
        "Content-Type": "application/json", Origin: "https://public.example.test" },
      body: JSON.stringify({ username: "b1-operator", password: "synthetic-b1-password" }) })).status, 403);
      const login = await req("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "b1-operator", password: "synthetic-b1-password" }) });
      assert.equal(login.status, 200);
      const cookie = login.headers.get("set-cookie")!.split(";")[0];
      assert(!JSON.stringify(await login.json()).includes("synthetic-b1-password"));
      const authed = (route: string, init: RequestInit = {}) =>
        req(route, { ...init, headers: { ...init.headers, Cookie: cookie, "Content-Type": "application/json" } });
      assert.equal((await authed("/api/tasks")).status, 200);
      for (const suffix of ["ms365-available-mailboxes", "email-tags", "email-tag-assignments",
        "email-signatures", "mailbox-colors", "chat-messages", "sharepoint/sites"])
        assert.deepEqual(await (await authed(`/api/users/b1-operator/${suffix}`)).json(), []);
      assert.deepEqual(await (await authed("/api/users/b1-operator/ms365-folders")).json(),
        { connected: false, folders: [], inboxId: null });
      const input = { title: LANGUAGES[0].titles[0], description: LANGUAGES[0].requests[0],
        country: "SK", assignedUserId: "b1-operator", customerId: "", attachments: [], tags: [] };
      const denied = await authed("/api/tasks", { method: "POST", body: JSON.stringify({ ...input, title: "not approved" }) });
      assert.equal(denied.status, 400);
      const created = await authed("/api/tasks", { method: "POST", body: JSON.stringify(input) });
      assert.equal(created.status, 202);
      const task = await created.json();
      assert.equal(task.id, "b1-checklist-sk-1"); assert.equal(task.job.status, "pending");
      const duplicate = await authed("/api/tasks", { method: "POST", body: JSON.stringify(input) });
      assert.equal((await duplicate.json()).jobId, task.jobId);
      assert.equal((await db.query("SELECT count(*)::integer AS count FROM ai_jobs")).rows[0].count, 1);
      assert.equal((await authed(`/api/tasks/${task.id}/resolution-draft`, { method: "POST", body: "{}" })).status, 409);
      assert.equal((await authed(`/api/ai/jobs/${task.jobId}/retry`, { method: "POST", body: "{}" })).status, 409);
      const runtime = createAIJobRuntime(db);
      const worker = createJobWorker({ store: runtime.aiJobStore, timeoutMs: 1000, apply: runtime.applyJob,
        execute: async () => {
          assert.equal((await runtime.aiJobStore.get(task.jobId))!.status, "processing");
          return { steps: ["Overiť chýbajúci dokument.", "Vyžiadať potvrdenie.", "Zaznamenať výsledok."] };
        } });
      await worker.tick();
      assert.equal((await runtime.aiJobStore.get(task.jobId))!.status, "completed");
      const rows = await (await authed(`/api/tasks/${task.id}/checklist`)).json();
      assert.equal(rows.length, 3); assert.equal(new Set(rows.map((r: any) => r.label)).size, 3);
      assert.equal((await (await authed(`/api/tasks/${task.id}/checklist/ai`)).json()).status, "generated");
    } finally {
      if (server) { server.closeAllConnections(); await new Promise(resolve => server!.close(resolve)); }
      await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
      if (oldFlag === undefined) delete process.env.AI_JOBS_TASK_CHECKLIST_ENABLED;
      else process.env.AI_JOBS_TASK_CHECKLIST_ENABLED = oldFlag;
      await defaultPool.end();
    }
  });
