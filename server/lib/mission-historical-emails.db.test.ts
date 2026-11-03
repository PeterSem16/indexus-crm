import { test, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { pool } from "../db";
import { registerMissionHistoricalEmailRoutes } from "./mission-historical-emails";
import { loadFunnelEmailEvidence } from "./mission-funnel-email-evidence";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { communicationMessages } from "../../shared/schema";
import { getTableColumns } from "drizzle-orm";

after(async () => { await pool.end(); });
const root = "/api/campaigns/mission/mission-funnel/historical-emails";
async function fixture(run: (f: {
  request: (suffix: string, body?: unknown, actor?: string) => Promise<Response>;
  client: any; preview: (overrides?: object) => Promise<any>;
}) => Promise<void>) {
  const client = await pool.connect();
  let server: ReturnType<express.Express["listen"]> | undefined;
  try {
    await client.query(`
      CREATE TEMP TABLE users(id text PRIMARY KEY,role text,role_id text,is_active boolean,
        assigned_countries text[],full_name text,username text);
      CREATE TEMP TABLE role_module_permissions(role_id text,module_key text,access text,can_edit boolean);
      CREATE TEMP TABLE campaigns(id text PRIMARY KEY,name text,country_codes text[]);
      CREATE TEMP TABLE clinics(id text PRIMARY KEY,name text,country_code text);
      CREATE TEMP TABLE campaign_contacts(id text PRIMARY KEY,clinic_id text,campaign_id text,contact_type text);
      CREATE TEMP TABLE communication_messages(id text PRIMARY KEY,customer_id text,user_id text,
        subject text,content text,recipient_email text,status text,campaign_id text,provider text,
        external_id text,metadata text,type text,direction text,sent_at timestamp,created_at timestamp,
        entity_type text,entity_id text,country_code text);
      CREATE TEMP TABLE campaign_contact_history(id text PRIMARY KEY,campaign_contact_id text,
        user_id text,action text,metadata jsonb);
      INSERT INTO users VALUES('admin','admin',NULL,true,ARRAY[]::text[],'Admin','admin'),
        ('delegate','user','editor',true,ARRAY['SK'],'Delegate','delegate'),
        ('agent','user',NULL,true,ARRAY['SK'],'Agent','agent');
      INSERT INTO role_module_permissions VALUES('editor','campaigns','visible',true);
      INSERT INTO campaigns VALUES('mission','Target Mission',ARRAY['SK']),('other','Other',ARRAY['SK']);
      INSERT INTO clinics VALUES('clinic','Clinic','SK');
      INSERT INTO campaign_contacts VALUES('contact','clinic','mission','clinic');
      INSERT INTO communication_messages
      SELECT 'message-'||i,'clinic','agent','No subject classification','<p>Original body</p>',
        'clinic@example.invalid','sent',NULL,NULL,NULL,
        '{"contactType":"clinic","sentVia":"ms365"}','email','outbound',
        CASE WHEN i=1 THEN NULL ELSE '2026-09-23 09:03:02.123456'::timestamp END,
        '2026-09-23 10:05:03.998123'::timestamp,NULL,NULL,'SK' FROM generate_series(1,2) i;
    `);
    const app = express();
    app.use(express.json());
    registerMissionHistoricalEmailRoutes(app, (_req, _res, next) => next(),
      { connect: async () => ({ query: client.query.bind(client), release() {} }) } as any,
      (req: any) => req.headers["x-actor"] || "admin");
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${root}`;
    const request = (suffix: string, body?: unknown, actor = "admin") => fetch(url + suffix, {
      method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", "x-actor": actor },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const preview = async (overrides = {}) => {
      const res = await request("/preview", { messageIds: ["message-1", "message-2"],
        purpose: "contract_proposal", reason: "Reviewed original sending record", ...overrides });
      assert.equal(res.status, 200, await res.clone().text());
      return res.json();
    };
    await run({ request, client, preview });
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    client.release(true);
  }
}
test("read-only preview; atomic attribution and idempotent retry preserve body, author and exact dates", async () => {
  await fixture(async ({ request, client, preview }) => {
    const original = (await client.query("SELECT to_jsonb(m) AS m FROM communication_messages m ORDER BY id")).rows;
    const p = await preview();
    assert.equal(p.rows.length, 2);
    assert.equal(p.unknownSendingTimes, 1);
    assert.equal(p.rows[0].sentAt, null);
    assert.equal(p.rows[0].recordedAt, "2026-09-23T10:05:03.998123Z");
    assert.equal(p.rows[1].sentAt, "2026-09-23T09:03:02.123456Z");
    assert.equal((await client.query("SELECT * FROM campaign_contact_history")).rows.length, 0);
    const apply = { reviewToken: p.reviewToken, approved: true };
    assert.deepEqual(await (await request("/apply", apply)).json(), { status: "applied", updates: 2 });
    assert.deepEqual(await (await request("/apply", apply)).json(), { status: "already_applied", updates: 0 });
    const actual = (await client.query("SELECT to_jsonb(m) AS m FROM communication_messages m ORDER BY id")).rows;
    assert.deepEqual(actual.map((r: any) => ({ ...r.m, campaign_id: null })), original.map((r: any) => r.m));
    const audits = (await client.query("SELECT * FROM campaign_contact_history ORDER BY metadata->>'messageId'")).rows;
    assert.equal(audits.length, 2);
    assert.ok(audits.every((a: any) => a.action === "mission_email_attribution" && a.user_id === "admin"));
    assert.equal(audits[0].metadata.originalSentAt, null);
    assert.equal(audits[0].metadata.sendingTimeKnown, false);
    assert.equal(audits[0].metadata.originalRecordedAt, "2026-09-23T10:05:03.998123Z");
    assert.equal(audits[1].metadata.originalSentAt, "2026-09-23T09:03:02.123456Z");
    assert.equal((await (await request("")).json()).rows.length, 0);
  });
});
test("real MS365 persistence shape: metadata-only To recipients survive search, preview, apply and retry", async () => {
  await fixture(async ({ client, request, preview }) => {
    // Match the actual /api/ms365/send-email-from-mailbox storage call: the
    // extra `recipients` property is not a Drizzle column and is not persisted.
    // Drizzle names all schema columns in INSERT, including DEFAULT columns.
    await client.query(`ALTER TABLE communication_messages ${Object.values(getTableColumns(communicationMessages))
      .map(column => `ADD COLUMN IF NOT EXISTS "${column.name}" ${column.getSQLType()}`).join(",")}`);
    await client.query(`ALTER TABLE communication_messages ALTER COLUMN direction SET DEFAULT 'outbound';
      ALTER TABLE communication_messages ALTER COLUMN created_at SET DEFAULT '2026-09-23 10:05:03.998123'::timestamp`);
    const toArray = ["original.clinic@example.invalid", "doctor@example.invalid"];
    const metadata = JSON.stringify({
      from: "sender@example.invalid", cc: "copy@example.invalid", isHtml: true,
      sentVia: "ms365", sharedMailbox: null, compositionDurationSeconds: 27,
      contactType: "clinic", recipientEmails: toArray, conversationId: "legacy-conversation",
    });
    const database = drizzle(client);
    await database.insert(communicationMessages).values({
      id: "legacy-ms365", customerId: "clinic", userId: "agent", type: "email",
      campaignId: null, subject: "Explicit review, not subject classification", content: "<p>Original legacy body</p>",
      status: "sent", recipients: toArray.join(", "), metadata,
    } as any).returning({ id: communicationMessages.id });
    const saved = (await client.query("SELECT to_jsonb(m) AS m FROM communication_messages m WHERE id='legacy-ms365'")).rows[0].m;
    assert.equal(saved.recipient_email, null);
    assert.equal(saved.sent_at, null);
    const search = await request("?q=doctor%40example.invalid");
    assert.equal(search.status, 200);
    const list = await search.json();
    assert.equal(list.rows.length, 1);
    assert.equal(list.rows[0].id, "legacy-ms365");
    assert.deepEqual(list.rows[0].recipientEmails, toArray);
    assert.equal(list.rows[0].recipientEmail, toArray.join(", "));
    assert.equal(list.rows[0].metadata, undefined);
    const p = await preview({ messageIds: ["legacy-ms365"] });
    assert.equal(p.rows[0].recipientEmail, toArray.join(", "));
    assert.deepEqual(p.rows[0].recipientEmails, toArray);
    assert.equal(p.rows[0].sentAt, null);
    assert.equal(p.unknownSendingTimes, 1);
    const body = { reviewToken: p.reviewToken, approved: true };
    assert.deepEqual(await (await request("/apply", body)).json(), { status: "applied", updates: 1 });
    assert.deepEqual(await (await request("/apply", body)).json(), { status: "already_applied", updates: 0 });
    const after = (await client.query("SELECT to_jsonb(m) AS m FROM communication_messages m WHERE id='legacy-ms365'")).rows[0].m;
    assert.deepEqual(after, { ...saved, campaign_id: "mission" });
    assert.equal((await client.query("SELECT count(*)::int AS n FROM campaign_contact_history")).rows[0].n, 1);
  });
});
test("recipient metadata is bounded and explicit; malformed, conflicting or changed recipients fail closed", async () => {
  for (const mutation of [
    `UPDATE communication_messages SET recipient_email=NULL,metadata='{"contactType":"clinic","sentVia":"ms365","recipientEmails":[]}'`,
    `UPDATE communication_messages SET recipient_email=NULL,metadata='{"contactType":"clinic","sentVia":"ms365","recipientEmails":"clinic@example.invalid"}'`,
    `UPDATE communication_messages SET recipient_email=NULL,metadata='{"contactType":"clinic","sentVia":"ms365","recipientEmails":["not an email"]}'`,
    `UPDATE communication_messages SET metadata='{"contactType":"clinic","sentVia":"ms365","recipientEmails":["different@example.invalid"]}'`,
    `UPDATE communication_messages SET recipient_email=NULL,provider='sendgrid',external_id='provider-id',
      metadata='{"contactType":"clinic","recipientEmails":["clinic@example.invalid"]}'`,
  ]) await fixture(async ({ client, request }) => {
    await client.query(mutation);
    assert.equal((await request("/preview", { messageIds: ["message-1"], purpose: "contract_proposal",
      reason: "Reviewed historical record" })).status, 409);
  });
  await fixture(async ({ client, request, preview }) => {
    await client.query(`UPDATE communication_messages SET recipient_email=NULL,
      metadata='{"contactType":"clinic","sentVia":"ms365","recipientEmails":["clinic@example.invalid"]}'`);
    const p = await preview();
    await client.query(`UPDATE communication_messages SET
      metadata='{"contactType":"clinic","sentVia":"ms365","recipientEmails":["changed@example.invalid"]}'
      WHERE id='message-1'`);
    assert.equal((await request("/apply", { reviewToken: p.reviewToken, approved: true })).status, 409);
    assert.equal((await client.query("SELECT * FROM campaign_contact_history")).rows.length, 0);
  });
});
test("fresh country/module permissions and token identity block unauthorized review", async () => {
  await fixture(async ({ request, client, preview }) => {
    assert.equal((await request("", undefined, "agent")).status, 403);
    assert.equal((await request("", undefined, "delegate")).status, 200);
    const p = await preview();
    assert.equal((await request("/apply", { reviewToken: p.reviewToken, approved: true }, "delegate")).status, 403);
    const delegate = await request("/preview", { messageIds: ["message-1"], purpose: "informational",
      reason: "Reviewed informational record" }, "delegate");
    assert.equal(delegate.status, 200);
    const d = await delegate.json();
    await client.query("UPDATE role_module_permissions SET can_edit=false");
    assert.equal((await request("/apply", { reviewToken: d.reviewToken, approved: true }, "delegate")).status, 403);
    await client.query("UPDATE role_module_permissions SET can_edit=true; UPDATE users SET assigned_countries=ARRAY['CZ'] WHERE id='delegate'");
    assert.equal((await request("/apply", { reviewToken: d.reviewToken, approved: true }, "delegate")).status, 403);
    await client.query("UPDATE users SET is_active=false WHERE id='admin'");
    assert.equal((await request("/apply", { reviewToken: p.reviewToken, approved: true })).status, 403);
  });
});
test("any changed body, date, sender, country, membership or pre-existing attribution stops the whole batch", async () => {
  for (const mutation of [
    "UPDATE communication_messages SET content='Changed' WHERE id='message-1'",
    "UPDATE communication_messages SET sent_at=now() WHERE id='message-1'",
    "UPDATE communication_messages SET user_id='admin' WHERE id='message-1'",
    "UPDATE clinics SET country_code='CZ'",
    "DELETE FROM campaign_contacts",
    "INSERT INTO campaign_contacts VALUES('duplicate','clinic','mission','clinic')",
    "UPDATE communication_messages SET campaign_id='other' WHERE id='message-1'",
    `INSERT INTO campaign_contact_history VALUES('conflict','contact','admin','mission_email_attribution',
      '{"messageId":"message-1","purpose":"informational"}')`,
  ]) await fixture(async ({ request, client, preview }) => {
    const p = await preview();
    await client.query(mutation);
    assert.equal((await request("/apply", { reviewToken: p.reviewToken, approved: true })).status, 409, mutation);
    assert.equal((await client.query("SELECT * FROM communication_messages WHERE campaign_id='mission'")).rows.length, 0);
  });
});
test("explicit approval, signed immutable preview, purpose and selection are mandatory", async () => {
  await fixture(async ({ request, preview }) => {
    const p = await preview();
    assert.equal((await request("/apply", { reviewToken: p.reviewToken, approved: false })).status, 400);
    assert.equal((await request("/apply", { reviewToken: p.reviewToken + "x", approved: true })).status, 409);
    assert.equal((await request("/apply", { reviewToken: p.reviewToken, approved: true, purpose: "informational" })).status, 400);
    for (const body of [
      { messageIds: [], purpose: "contract_proposal", reason: "Reason long enough" },
      { messageIds: ["message-1", "message-1"], purpose: "contract_proposal", reason: "Reason long enough" },
      { messageIds: ["message-1"], purpose: "guessed_subject", reason: "Reason long enough" },
      { messageIds: ["message-1"], purpose: "contract_proposal", reason: "" },
    ]) assert.equal((await request("/preview", body)).status, 400);
  });
});
test("expired previews cannot be applied, even by the original administrator", async () => {
  await fixture(async ({ request, preview }) => {
    const p = await preview();
    const originalNow = Date.now;
    try {
      Date.now = () => p.expiresAt + 1;
      assert.equal((await request("/apply", { reviewToken: p.reviewToken, approved: true })).status, 410);
    } finally { Date.now = originalNow; }
  });
});
test("audit insertion failure rolls back all messages; no confirmation or sending side effects", async () => {
  await fixture(async ({ request, client, preview }) => {
    const p = await preview();
    await client.query(`ALTER TABLE campaign_contact_history ADD CONSTRAINT reject_second
      CHECK (metadata->>'messageId' <> 'message-2')`);
    assert.equal((await request("/apply", { reviewToken: p.reviewToken, approved: true })).status, 500);
    assert.equal((await client.query("SELECT * FROM campaign_contact_history")).rows.length, 0);
    assert.equal((await client.query("SELECT * FROM communication_messages WHERE campaign_id IS NOT NULL")).rows.length, 0);
  });
});
test("rejects simulated/unproven sends, foreign identity and malformed metadata without subject heuristics", async () => {
  for (const mutation of [
    `UPDATE communication_messages SET metadata='{"contactType":"clinic","sentVia":"ms365","simulated":true}'`,
    `UPDATE communication_messages SET metadata='{"contactType":"clinic"}'`,
    `UPDATE communication_messages SET metadata='{"contactType":"clinic","sentVia":"ms365","campaignId":"other"}'`,
    `UPDATE communication_messages SET metadata='not-json'`,
    `UPDATE communication_messages SET entity_type='customer',entity_id='clinic'`,
    `UPDATE communication_messages SET status='failed'`,
  ]) await fixture(async ({ request, client }) => {
    await client.query(mutation);
    assert.equal((await request("/preview", { messageIds: ["message-1"], purpose: "contract_proposal",
      reason: "Reviewed historical record" })).status, 409);
  });
});
test("informational purpose is audited but not contract-proposal funnel evidence", async () => {
  await fixture(async ({ request, client, preview }) => {
    const p = await preview({ purpose: "informational", messageIds: ["message-1"] });
    assert.equal((await request("/apply", { reviewToken: p.reviewToken, approved: true })).status, 200);
    assert.equal((await client.query("SELECT metadata->>'purpose' AS purpose FROM campaign_contact_history")).rows[0].purpose, "informational");
    // Execute the review branch of the real loader against these records.
    const evidence = await loadFunnelEmailEvidence({ query: async (sql, args) => {
      const branch = sql.slice(sql.indexOf("SELECT 'review:'"));
      return client.query(branch, args!.slice(0, 2));
    } }, "mission", ["contact"], ["email-step"]);
    assert.deepEqual(evidence, []);
  });
});
test("independent concurrent requests serialize; retry cannot duplicate audit and competing reviews conflict", async () => {
  await fixture(async ({ client }) => {
    const schema = `email_review_${randomUUID().replaceAll("-", "")}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    let server: ReturnType<express.Express["listen"]> | undefined;
    try {
      for (const table of ["users", "role_module_permissions", "campaigns", "clinics",
        "campaign_contacts", "communication_messages", "campaign_contact_history"]) {
        await client.query(`CREATE TABLE "${schema}".${table} (LIKE pg_temp.${table} INCLUDING ALL);
          INSERT INTO "${schema}".${table} SELECT * FROM pg_temp.${table}`);
      }
      const app = express();
      app.use(express.json());
      registerMissionHistoricalEmailRoutes(app, (_req, _res, next) => next(), {
        connect: async () => {
          const c = await pool.connect();
          await c.query(`SET search_path TO "${schema}"`);
          return { query: c.query.bind(c), release() { c.release(true); } };
        },
      } as any, () => "admin");
      server = app.listen(0, "127.0.0.1");
      await new Promise<void>(resolve => server!.once("listening", resolve));
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${root}`;
      const post = (suffix: string, body: unknown) => fetch(url + suffix, { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const input = { messageIds: ["message-1"], purpose: "contract_proposal", reason: "Reviewed original sending record" };
      const p = await (await post("/preview", input)).json();
      const competing = await (await post("/preview", input)).json();
      const body = { reviewToken: p.reviewToken, approved: true };
      const responses = await Promise.all([post("/apply", body), post("/apply", body)]);
      assert.ok(responses.every(r => r.status === 200));
      const results = await Promise.all(responses.map(r => r.json()));
      assert.deepEqual(results.map(r => r.status).sort(), ["already_applied", "applied"]);
      assert.equal((await post("/apply", { reviewToken: competing.reviewToken, approved: true })).status, 409);
      assert.equal((await client.query(`SELECT count(*)::int AS n FROM "${schema}".campaign_contact_history`)).rows[0].n, 1);
    } finally {
      if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
      await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    }
  });
});
