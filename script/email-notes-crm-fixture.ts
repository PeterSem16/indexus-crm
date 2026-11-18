// Test process only. Never imported by CRM startup; never contacts Graph or Gateway.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import express from "express";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { createEmailNoteService } from "../server/lib/email-note-jobs-service";
import { registerEmailNoteRoutes } from "../server/lib/email-note-jobs-routes";
import { EmailNoteError } from "../server/lib/email-note-jobs-client";

export const syntheticNote = "Odosielateľ vysvetľuje, že e-mail je výhradne vymyslený testovací a žiada vysvetlenie postupu doručenia informačných materiálov.";
export const syntheticMailbox = "synthetic@example.test";

export async function startCrmFixture() {
  assert.equal(process.env.NODE_ENV, "test");
  assert.notEqual(os.hostname().split(".")[0].toUpperCase(), "CORPCRM01");
  const root = fs.realpathSync(process.env.EMAIL_NOTES_ACCEPTANCE_ROOT!);
  assert.ok(root.startsWith(path.resolve("generated-artifacts") + path.sep));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 6 });
  assert.match((await pool.query("SELECT current_database() AS name")).rows[0].name,
    /^indexus_email_notes_test_[a-z0-9_]+$/);
  assert.equal(fs.realpathSync((await pool.query("SHOW data_directory")).rows[0].data_directory),
    path.join(root, "pgdata"));
  await pool.query("CREATE TABLE users(id varchar PRIMARY KEY)");
  await pool.query("INSERT INTO users VALUES ('owner'),('other')");
  await pool.query(`CREATE TABLE acceptance_emails(
    id text PRIMARY KEY, owner_id text NOT NULL, mailbox text NOT NULL, subject text NOT NULL, body text NOT NULL)`);
  for (const id of ["one", "two"]) await pool.query(
    "INSERT INTO acceptance_emails VALUES($1,$2,$3,$4,$5)",
    [id, "owner", syntheticMailbox, `Syntetický e-mail ${id}`, "Vymyslený test: prosím o vysvetlenie doručenia informačných materiálov."]);
  let enabled = false, revoked = false;
  const submissions: { jobId: string; text: string }[] = [];
  const service = createEmailNoteService(pool, { enabled: () => enabled, client: {
    submit: async text => {
      const jobId = randomUUID(); submissions.push({ jobId, text });
      return { job_id: jobId, status: "pending" as const, review_required: true };
    },
    poll: async job_id => ({ job_id, status: "completed" as const, note: syntheticNote, review_required: false }),
  } });
  await service.ensureSchema();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = /notes_fixture_user=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    (req as any).session = { user: id === "owner" || id === "other" ? { id } : null };
    next();
  });
  registerEmailNoteRoutes(app, (req, res, next) =>
    (req.session as any)?.user ? next() : res.status(401).json({ error: "unauthorized" }), {
    service, authorize: async (req, readText) => {
      const id = (req.session as any).user.id;
      const mailbox = !req.query.mailbox || req.query.mailbox === "personal" ? syntheticMailbox : req.query.mailbox;
      const email = (await pool.query(
        "SELECT * FROM acceptance_emails WHERE id=$1 AND owner_id=$2 AND mailbox=$3",
        [req.params.emailId, id, mailbox])).rows[0];
      if (revoked || !email) throw new EmailNoteError("forbidden", 403);
      return { scope: { userId: id, mailbox: email.mailbox, messageId: email.id },
        text: readText ? `${email.subject}\n\n${email.body}` : undefined };
    },
  });
  const message = (row: any) => ({ id: row.id, subject: row.subject, isRead: true,
    body: { contentType: "text", content: row.body }, bodyPreview: row.body, hasAttachments: false,
    receivedDateTime: "2026-11-18T09:00:00Z", importance: "normal", attachments: [],
    from: { emailAddress: { name: "Synthetic Sender", address: "sender@example.test" } },
    toRecipients: [{ emailAddress: { name: "Test Operator", address: syntheticMailbox } }],
    ccRecipients: [], bccRecipients: [], replyTo: [] });
  // External dependencies only: isolated auth/Graph/other-module fixtures.
  // AI-note GET/POST/PATCH above are REAL CRM handlers backed by REAL PostgreSQL.
  app.use(async (req, res, next) => {
    const p = req.path;
    if (!p.startsWith("/api/")) return next();
    let data: any = [];
    const id = (req.session as any)?.user?.id;
    if (p === "/api/auth/me") data = { user: id ? { id, username: id, fullName: "Test Operator",
      email: syntheticMailbox, role: "admin", isActive: true, assignedCountries: ["SK"], language: "sk" } : null };
    else if (p.includes("ms365-available-mailboxes")) data = [
      { id: "personal", email: syntheticMailbox, displayName: "Test Operator", type: "personal", isDefault: true }];
    else if (p.includes("ms365-connection")) data = { connected: true, isConnected: true, email: syntheticMailbox };
    else if (p.includes("ms365-unread-counts")) data = { connected: true, totalUnread: 0,
      counts: [{ mailbox: "personal", unreadCount: 0 }] };
    else if (p.includes("ms365-folders")) data = { connected: true, inboxId: "inbox", folders: [
      { id: "inbox", displayName: "Doručená pošta", wellKnownName: "inbox", unreadItemCount: 0, totalItemCount: 2 }] };
    else if (p.includes("ms365-folder-messages")) data = { connected: true, totalCount: 2,
      emails: (await pool.query("SELECT * FROM acceptance_emails WHERE owner_id=$1 ORDER BY id", [id])).rows.map(message) };
    else if (/\/ms365-email\/[^/]+$/.test(p)) {
      const row = (await pool.query("SELECT * FROM acceptance_emails WHERE id=$1 AND owner_id=$2",
        [decodeURIComponent(p.split("/").at(-1)!), id])).rows[0];
      if (!row) return res.status(404).json({ error: "not_found" });
      data = message(row);
    } else if (p.endsWith("/read-status")) data = { success: true };
    else if (p === "/api/nexus/mailbox-groups") data = { groups: [], revision: 0 };
    else if (p === "/api/omni-sms/unread") data = { unread: 0 };
    else if (p === "/api/omni-sms/access") data = { isAdmin: false, grants: [], countries: [], gateways: [] };
    else if (p === "/api/tasks/assignment-options") data = { users: [], groups: [], canResolve: true };
    else if (p === "/api/task-settings/access") data = { canManage: false };
    else if (p === "/api/task-settings/users") data = { configured: false, users: [], allowedUserIds: [] };
    res.json(data);
  });
  const dist = path.resolve("generated-artifacts/email-notes-crm-ui/public");
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  return { base: `http://127.0.0.1:${(server.address() as any).port}`, pool, service, submissions,
    setEnabled: (value: boolean) => { enabled = value; }, setRevoked: (value: boolean) => { revoked = value; },
    scope: { userId: "owner", mailbox: syntheticMailbox, messageId: "one" },
    complete: async () => {
      await pool.query("UPDATE email_note_jobs SET next_poll_at=now()-interval '1 second'");
      await service.tick();
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await pool.end();
    },
  };
}
