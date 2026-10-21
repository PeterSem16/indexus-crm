import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { readStatusListServiceHistory } from "./status-list-service-history";

const client = await pool.connect();
const schema = `service_history_test_${randomUUID().replaceAll("-", "")}`;
try {
  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE users(id text,full_name text);
    CREATE TABLE campaign_contacts(id text,campaign_id text);
    CREATE TABLE campaign_contact_history(id text,created_at timestamptz,user_id text,
      campaign_contact_id text,action text,metadata jsonb);
    CREATE TABLE campaign_status_list_items(id text,campaign_id text,label text);
    CREATE TABLE campaign_status_list_questions(id text,item_id text,question_text text);
    CREATE TABLE campaign_status_list_automations(id text,status_list_item_id text,question_id text);
    CREATE TABLE mission_callback_events(id int,created_at timestamptz,actor_id text,
      campaign_id text,automation_id text,payload jsonb,status text,result jsonb);
    INSERT INTO users VALUES('agent','Agent');
    INSERT INTO campaign_contacts VALUES('contact','mission'),('foreign','other-mission');
    INSERT INTO campaign_status_list_items VALUES('step','mission','Contact result');
    INSERT INTO campaign_status_list_questions VALUES('answer','step','Call later');
    INSERT INTO campaign_status_list_automations VALUES('callback','step','answer'),('email','step',null);
    INSERT INTO campaign_contact_history VALUES
      ('email','2026-10-21T09:00:00Z','agent','contact','status_list_action',
        '{"automationId":"email","actionType":"send_contact_email","recipient":"private@example.invalid","note":"PRIVATE"}'),
      ('duplicate','2026-10-21T10:00:00Z','agent','contact','status_list_action',
        '{"automationId":"callback","actionType":"set_callback","callbackEventId":"1"}'),
      ('foreign','2026-10-21T11:00:00Z','agent','foreign','status_list_action',
        '{"automationId":"email","actionType":"send_contact_email"}');
    INSERT INTO mission_callback_events VALUES
      (1,'2026-10-21T10:00:00Z','agent','mission','callback','{"action":{"type":"set_callback"},"note":"PRIVATE"}',
        'done','{"status":"kept_existing","callbackDate":"2026-10-28T08:00:00Z"}'),
      (2,'2026-10-21T11:00:00Z','agent','other-mission','callback','{"action":{"type":"set_callback"}}','pending',null);
  `);
  const all = await readStatusListServiceHistory(client, "mission");
  assert.equal(all.events.length, 2);
  assert.equal(all.events[0].id, "callback:1");
  assert.equal(all.events[0].outcome, "kept_existing");
  assert.equal(all.events[0].questionLabel, "Call later");
  assert.equal(all.events[1].state, "recorded", "legacy history is not delivery proof");
  assert.ok(!JSON.stringify(all).includes("PRIVATE"));
  assert.ok(!JSON.stringify(all).includes("private@example"));
  assert.ok(!JSON.stringify(all).includes("foreign"));
  const filtered = await readStatusListServiceHistory(client, "mission", "email");
  assert.equal(filtered.events.length, 1);
  assert.equal(filtered.events[0].automationId, "email");
  assert.equal((await readStatusListServiceHistory(client, "mission", "absent")).events.length, 0);
  await client.query("INSERT INTO mission_callback_events SELECT n,'2026-10-22T10:00:00Z'::timestamptz,'agent','mission','callback','{}','pending',null FROM generate_series(3,120) n");
  assert.equal((await readStatusListServiceHistory(client, "mission")).events.length, 100);
  console.log("Service history: Mission/action scope, privacy projection, callback deduplication, honest legacy state and limit passed.");
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
