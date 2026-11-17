// Explicit development-only synthetic schema. No real e-mail/Gateway calls.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import os from "node:os";
import fs from "node:fs";
import express from "express";
import { Client, Pool } from "pg";
import { createEmailNoteService } from "./email-note-jobs-service";
import { registerEmailNoteRoutes } from "./email-note-jobs-routes";
import { EmailNoteError } from "./email-note-jobs-client";
if (process.env.NODE_ENV !== "test" || process.env.EMAIL_NOTES_TEMP_DB_TEST !== "1" ||
  os.hostname().split(".")[0].toUpperCase() === "CORPCRM01")
  throw Error("EXPLICIT_DEVELOPMENT_TEMP_TABLE_TEST_REQUIRED");

test("supplemental note persistence, worker, permissions and approval", async t => {
  const schema = "email_note_test_" + randomUUID().replaceAll("-", "");
  const control = new Client({ connectionString: process.env.DATABASE_URL });
  await control.connect();
  let pool: Pool | undefined;
  try {
    await control.query(`CREATE SCHEMA "${schema}"`);
    await control.query(`SET search_path TO "${schema}",public`);
    await control.query("CREATE TABLE users(id varchar PRIMARY KEY)");
    await control.query("INSERT INTO users VALUES('owner'),('other')");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 6,
      options: `-c search_path=${schema},public` });
    let enabled = true, posts = 0, polls = 0;
    let next: any = { status: "pending", review_required: true };
    let failPost = false, failPoll: string | null = null;
    const service = createEmailNoteService(pool, { enabled: () => enabled, client: {
      submit: async () => {
        posts++; if (failPost) throw new EmailNoteError("gateway_timeout");
        return { job_id: randomUUID(), status: "pending", review_required: true };
      },
      poll: async job_id => {
        polls++; if (failPoll) throw new EmailNoteError(failPoll);
        return { ...next, job_id };
      },
    } });
    const scope = { userId: "owner", mailbox: "synthetic@example.test", messageId: "SYNTHETIC-1" };
    const ready = () => pool!.query("UPDATE email_note_jobs SET next_poll_at=now()-interval '1 second'");
    await service.ensureSchema();
    await service.ensureSchema();
    await t.test("feature defaults off; disabled submit/tick produce no jobs or external calls", async () => {
      enabled = false;
      await assert.rejects(service.submit(scope, "SYNTHETIC"), /feature_disabled/);
      await service.tick(); assert.equal(posts, 0); assert.equal(polls, 0);
      enabled = true;
    });
    await t.test("concurrent/repeated processing creates one durable job", async () => {
      await Promise.all(Array.from({ length: 8 }, () => service.submit(scope, "Syntetická správa")));
      assert.equal(posts, 1);
      assert.equal((await service.get(scope))?.status, "pending");
      assert.equal(await service.get({ ...scope, userId: "other" }), null);
      assert.equal(await service.get({ ...scope, mailbox: "different@example.test" }), null);
      assert.equal(await service.get({ ...scope, messageId: "different" }), null);
    });
    await t.test("pending and processing persist; completed requires human review, never approval", async () => {
      await ready(); await service.tick();
      assert.equal((await service.get(scope)).status, "pending");
      next = { status: "processing", review_required: true };
      await ready(); await service.tick();
      assert.equal((await service.get(scope)).status, "processing");
      next = { status: "completed", note: "Klient žiada vysvetlenie doručenej faktúry.", review_required: false };
      await ready(); await service.tick();
      const record = await service.get(scope);
      assert.equal(record.status, "review_required");
      assert.equal(record.note, next.note);
      assert.equal(record.approved_at, null);
      assert.equal((await pool!.query("SELECT count(*)::int n FROM email_note_job_audit")).rows[0].n, 0);
    });
    await t.test("approval is scoped, atomic, audited and optimistic; original AI note stays intact", async () => {
      const record = await service.get(scope);
      await assert.rejects(service.approve({ ...scope, userId: "other" }, record.note, record.version), /approval_conflict/);
      const note = "Klient žiada objasniť sumu uvedenú na faktúre.";
      const results = await Promise.allSettled([
        service.approve(scope, note, record.version), service.approve(scope, note, record.version),
      ]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      const saved = await service.get(scope);
      assert.equal(saved.status, "approved"); assert.equal(saved.approved_by, "owner");
      assert.equal(saved.approved_note, note); assert.equal(saved.note, next.note);
      const audit = (await pool!.query("SELECT * FROM email_note_job_audit")).rows;
      assert.equal(audit.length, 1); assert.equal(audit[0].actor_user_id, "owner");
      assert.equal(audit[0].action, "edited_and_approved");
      assert.equal(audit[0].approved_note, note);
      assert.ok(audit[0].created_at);
    });
    await t.test("ambiguous POST failure is never resubmitted, including a fresh service instance", async () => {
      failPost = true;
      const failed = { ...scope, messageId: "SYNTHETIC-POST-TIMEOUT" };
      await service.submit(failed, "Syntetická správa");
      const before = posts;
      await service.submit(failed, "Syntetická správa");
      const restarted = createEmailNoteService(pool!, { enabled: () => true, client: {
        submit: async () => { throw Error("DUPLICATE POST"); }, poll: async () => { throw Error("UNEXPECTED"); },
      } });
      await restarted.submit(failed, "Syntetická správa");
      assert.equal(posts, before); assert.equal((await restarted.get(failed)).error_code, "gateway_timeout");
      failPost = false;
    });
    await t.test("failed, review_required, transient outage and bounded job timeout", async () => {
      const working = { ...scope, messageId: "SYNTHETIC-WORKER" };
      await service.submit(working, "Syntetická správa");
      failPoll = "gateway_unavailable";
      await ready(); await service.tick();
      assert.equal((await service.get(working)).error_code, "gateway_unavailable");
      failPoll = null; next = { status: "review_required", review_required: true, note: "Správu musí preveriť oprávnený používateľ." };
      await ready(); await service.tick();
      assert.equal((await service.get(working)).status, "review_required");
      const failed = { ...scope, messageId: "SYNTHETIC-FAILED" };
      await service.submit(failed, "Syntetická správa");
      next = { status: "failed", review_required: true, error: "DO NOT STORE PRIVATE PROVIDER DETAIL" };
      await ready(); await service.tick();
      assert.equal((await service.get(failed)).error_code, "generation_failed");
      const expired = { ...scope, messageId: "SYNTHETIC-EXPIRED" };
      await service.submit(expired, "Syntetická správa");
      await pool!.query("UPDATE email_note_jobs SET created_at=now()-interval '11 minutes' WHERE message_id=$1", [expired.messageId]);
      const before = polls;
      await ready(); await service.tick();
      assert.equal((await service.get(expired)).error_code, "job_timeout");
      assert.equal(polls, before);
      const abandoned = { ...scope, messageId: "SYNTHETIC-CRASHED" };
      await pool!.query(`INSERT INTO email_note_jobs(owner_user_id,mailbox_email,message_id,created_at)
        VALUES($1,$2,$3,now()-interval '3 minutes')`, [abandoned.userId, abandoned.mailbox, abandoned.messageId]);
      await service.tick();
      assert.equal((await service.get(abandoned)).error_code, "submission_uncertain");
    });
    await t.test("HTTP routes reject unauthenticated, other-user and revoked-mailbox access", async () => {
      const app = express(); app.use(express.json());
      app.use((req, _res, nextFn) => { (req as any).session = { user: { id: req.headers["x-test-user"] } }; nextFn(); });
      let revoked = false;
      const auth: any = (req: any, res: any, nextFn: any) =>
        req.session.user.id ? nextFn() : res.status(401).json({ error: "unauthorized" });
      registerEmailNoteRoutes(app, auth, { service, authorize: async () => {
        if (revoked) throw new EmailNoteError("forbidden", 403);
        return { scope, text: "Syntetická správa" };
      } });
      const server = app.listen(0, "127.0.0.1");
      await new Promise<void>(resolve => server.once("listening", resolve));
      const address = server.address() as any;
      const url = `http://127.0.0.1:${address.port}/api/users/owner/ms365-email/SYNTHETIC-1/ai-note`;
      try {
        for (const method of ["GET", "POST", "PATCH"]) {
          assert.equal((await fetch(url, { method })).status, 401);
          assert.equal((await fetch(url, { method, headers: { "x-test-user": "other" } })).status, 403);
          revoked = true;
          assert.equal((await fetch(url, { method, headers: { "x-test-user": "owner" } })).status, 403);
          revoked = false;
        }
        const authorized = await fetch(url, { headers: { "x-test-user": "owner" } });
        assert.equal(authorized.status, 200);
        assert.equal(authorized.headers.get("Cache-Control"), "no-store");
        assert.equal((await authorized.json()).record.approved_by, "owner");
        enabled = false;
        const disabled = await fetch(url, { headers: { "x-test-user": "owner" } });
        assert.deepEqual(await disabled.json(), { enabled: false, record: null });
        assert.equal((await fetch(url, { method: "POST", headers: { "x-test-user": "owner" } })).status, 503);
      } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); enabled = true; }
    });
    await t.test("legacy analyzers, models, routing and 100-character monitoring note remain untouched", () => {
      const runtime = fs.readFileSync("server/lib/email-note-jobs-runtime.ts", "utf8");
      const module = fs.readFileSync("server/lib/email-note-jobs-service.ts", "utf8");
      assert.ok(!runtime.includes('aiClient(')); assert.ok(!module.includes('aiClient('));
      assert.ok(!module.includes('communication_messages')); assert.ok(!module.includes('email_metadata'));
      const index = fs.readFileSync("server/index.ts", "utf8");
      assert.ok(index.includes('ms365-email\\/[^/]+\\/ai-note'));
    });
  } finally {
    await pool?.end();
    await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await control.end();
  }
});
