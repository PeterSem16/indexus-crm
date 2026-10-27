import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { CALLBACK_TRANSITION_SCHEMA } from "./status-list-callback-transition-schema";

if (process.env.NODE_ENV === "production") throw new Error("Development-only schema test");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
const schema = `callback_journal_test_${randomUUID().replace(/-/g, "")}`;
try {
  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}"`);
  await client.query(`CREATE TABLE campaigns(id varchar PRIMARY KEY);
    CREATE TABLE campaign_contacts(id varchar PRIMARY KEY);
    CREATE TABLE mission_callback_events(id bigserial PRIMARY KEY,campaign_id varchar,
      campaign_contact_id varchar,event_id text,action_id varchar,owner text,generation int,
      actor_id varchar,occurred_at timestamptz,payload jsonb,state text,result jsonb,attempts int);
    CREATE INDEX mission_callback_events_pending ON mission_callback_events(id) WHERE state='pending';
    INSERT INTO mission_callback_events(campaign_id,event_id,action_id,owner,generation,occurred_at,payload,state,result)
      VALUES('mission','confirmation:receipt','action','service',2,'2026-10-21T08:00Z','{"note":"fixture"}',
        'done','{"status":"changed"}')`);
  const before = (await client.query("SELECT to_jsonb(e) AS row FROM mission_callback_events e")).rows;
  // Match startup order when workflow ensure has created an empty target first.
  await client.query(`CREATE TABLE mission_callback_service_events (LIKE mission_callback_events INCLUDING ALL);
    CREATE INDEX mission_callback_service_events_pending ON mission_callback_service_events(id) WHERE state='pending'`);
  await client.query(CALLBACK_TRANSITION_SCHEMA);
  await client.query(CALLBACK_TRANSITION_SCHEMA);
  assert.deepEqual((await client.query("SELECT to_jsonb(e) AS row FROM mission_callback_service_events e")).rows, before);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM mission_callback_events WHERE status='pending'")).rows[0].n, 0);
  const index = (await client.query(`SELECT tablename FROM pg_indexes WHERE schemaname=$1
    AND indexname='mission_callback_service_events_pending'`, [schema])).rows[0];
  assert.equal(index.tablename, "mission_callback_service_events");
  assert.equal((await client.query("SELECT count(*)::int AS n FROM mission_callback_service_events_empty_bootstrap")).rows[0].n, 0);

  // Unknown dual journals must fail closed, not be merged or overwritten.
  await client.query("SAVEPOINT conflict_case");
  await client.query("DROP TABLE mission_callback_events");
  await client.query("CREATE TABLE mission_callback_events (LIKE mission_callback_service_events INCLUDING ALL)");
  await assert.rejects(() => client.query(CALLBACK_TRANSITION_SCHEMA), /callback_journal_collision_requires_review/);
  await client.query("ROLLBACK TO SAVEPOINT conflict_case");
  assert.deepEqual((await client.query("SELECT to_jsonb(e) AS row FROM mission_callback_service_events e")).rows, before);
  console.log("Callback journal schema: existing receipts preserved, distinct journals/indexes, idempotence and ambiguous dual-journal rejection passed.");
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
