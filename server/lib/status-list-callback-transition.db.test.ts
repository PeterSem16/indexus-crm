import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { ensureCallbackTransitionSchema } from "./status-list-callback-transition-schema";
import { callbackReadiness, persistCallbackConfirmation, drainCallbackEvents, switchCallbackOwner, runDurableManualCallback } from "./status-list-callback-transition";
import { medicalPartnerAudit, MEDICAL_PARTNER_AUDIT_CAMPAIGN as mission } from "../../shared/status-list-transition-audit";

// All writes live in an isolated temporary schema. No production connection,
// original Mission, contacts, histories or public configuration are changed.
const schema = `callback_test_${randomUUID().replaceAll("-", "")}`;
const root = await pool.connect();
const connections = { async connect() {
  const client = await pool.connect();
  await client.query(`SET search_path TO "${schema}",public`);
  const release = client.release.bind(client);
  client.release = () => { void client.query("RESET search_path").then(() => release(), () => release(true)); };
  return client;
} };
try {
  await root.query(`CREATE SCHEMA "${schema}"`);
  await root.query(`SET search_path TO "${schema}",public`);
  await root.query(`
    CREATE TABLE campaigns(id varchar PRIMARY KEY,name text,country_codes text[] DEFAULT ARRAY['SK']);
    CREATE TABLE users(id varchar PRIMARY KEY,full_name text);
    CREATE TABLE campaign_status_list_items(id varchar PRIMARY KEY,campaign_id varchar,sort_order int,step_id text);
    CREATE TABLE campaign_status_list_questions(id varchar PRIMARY KEY,item_id varchar);
    CREATE TABLE campaign_dispositions(id varchar PRIMARY KEY,campaign_id varchar,code text,action_type text);
    CREATE TABLE campaign_status_list_automations(id varchar PRIMARY KEY,status_list_item_id varchar,sort_order int DEFAULT 0,
      action_type text,disposition_id varchar,question_id varchar,callback_offset_days int,callback_time text,
      callback_business_days_only boolean,callback_existing_policy text,condition_field text,condition_operator text,
      condition_value text,condition_json text,email_recipients text[] DEFAULT '{}');
    CREATE TABLE campaign_contacts(id varchar PRIMARY KEY,campaign_id varchar,contact_type text,clinic_id varchar,
      hospital_id varchar,collaborator_id varchar,customer_id varchar,status text,callback_date timestamptz,
      callback_status_list_item_id varchar,assigned_to varchar,updated_at timestamptz,disposition_code text,callback_note text);
    CREATE TABLE campaign_contact_status_list_state(id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      campaign_contact_id varchar,status_list_item_id varchar,confirmed_by_user_id text,confirmed_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now(),item_note text,note_updated_at timestamptz);
    CREATE TABLE campaign_contact_history(id varchar DEFAULT gen_random_uuid()::text,campaign_contact_id varchar,
      user_id varchar,action text,metadata jsonb);
    CREATE TABLE call_logs(contact_id varchar);
    CREATE TABLE mission_status_list_rules(id varchar,campaign_id varchar,definition jsonb);
    CREATE TABLE mission_status_list_sources(question_id varchar,campaign_id varchar);
    CREATE TABLE mission_status_list_option_sources(group_id varchar,campaign_id varchar);
  `);
  await ensureCallbackTransitionSchema(root);
  await root.query("INSERT INTO campaigns(id,name) VALUES($1,'Medical Partner Cooperation')", [mission]);
  await root.query("INSERT INTO users VALUES('agent','Agent')");
  const audit = medicalPartnerAudit(mission)!;
  for (const [index, a] of audit.actions.entries()) {
    await root.query(`INSERT INTO campaign_status_list_items VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [a.itemId, mission, index, a.stepCode]);
    if (a.dispositionId) await root.query("INSERT INTO campaign_dispositions VALUES($1,$2,$3,'callback') ON CONFLICT DO NOTHING",
      [a.dispositionId, mission, `CB${index}`]);
    await root.query(`INSERT INTO campaign_status_list_automations
      (id,status_list_item_id,sort_order,action_type,disposition_id,callback_offset_days,callback_time,
      callback_business_days_only,callback_existing_policy,condition_json) VALUES($1,$2,$3,$4,$5,$6,$7,true,'replace',$8)`,
    [a.id, a.itemId, index, a.type, a.dispositionId, a.callback?.days, a.callback?.time,
      a.condition.kind === "call_count" ? JSON.stringify({ logic: a.condition.logic,
        rules: a.condition.rules.map(r => ({ field: "call_count", op: r.op, value: String(r.value) })) }) : null]);
  }
  await root.query("INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id,status) VALUES('contact',$1,'clinic','clinic','pending')", [mission]);
  let readiness = await callbackReadiness(root, mission);
  assert.equal(readiness.ready, true, JSON.stringify(readiness.blockers));
  assert.equal(readiness.callbackCount, 8);
  assert.equal(readiness.owner, "legacy");
  assert.equal(Number((await root.query("SELECT count(*) FROM mission_callback_ownership")).rows[0].count), 0, "GET must not initialize/activate ownership");
  const action = audit.actions[0];
  const confirmation = { campaignId: mission, campaignContactId: "contact", itemId: action.itemId, actorId: "agent",
    manualDate: "2026-11-02T10:00:00.000Z", note: "note", itemNote: "confirmation", skipAutomations: false };
  const attempts = await Promise.allSettled([
    persistCallbackConfirmation(confirmation, connections), persistCallbackConfirmation(confirmation, connections),
  ]);
  assert.equal(attempts.filter(a => a.status === "fulfilled").length, 1, "concurrent confirms must not create two events");
  assert.equal(Number((await root.query("SELECT count(*) FROM mission_callback_events")).rows[0].count), 1);
  const before = await callbackReadiness(root, mission);
  assert.ok(before.blockers.includes("pending_events"));
  await assert.rejects(switchCallbackOwner(mission, "agent", { fingerprint: before.fingerprint, expectedOwner: "legacy",
    targetOwner: "compatible", backupConfirmed: true, missionNameConfirmation: before.missionName }, connections), /readiness_changed/);
  // Disconnect/rollback after taking the durable event: simulates the same DB
  // rollback boundary as a process dying before COMMIT.
  const interrupted = await connections.connect();
  interrupted.on("error", () => {}); // Expected fatal error from our own terminated test session.
  await interrupted.query("BEGIN");
  await interrupted.query("SELECT * FROM mission_callback_events WHERE status='pending' FOR UPDATE");
  await interrupted.query("UPDATE campaign_contacts SET callback_note='uncommitted' WHERE id='contact'");
  const interruptedPid = (await interrupted.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  await root.query("SELECT pg_terminate_backend($1)", [interruptedPid]);
  await assert.rejects(interrupted.query("SELECT 1"));
  interrupted.release();
  await Promise.all([drainCallbackEvents(undefined, connections), drainCallbackEvents(undefined, connections)]);
  await drainCallbackEvents(undefined, connections);
  const saved = (await root.query("SELECT * FROM campaign_contacts WHERE id='contact'")).rows[0];
  assert.equal(saved.callback_date.toISOString(), confirmation.manualDate);
  assert.equal(saved.assigned_to, "agent");
  assert.equal(saved.callback_note, "note");
  assert.equal(Number((await root.query("SELECT count(*) FROM campaign_contact_history")).rows[0].count), 1, "recovery/re-delivery must not duplicate history");
  readiness = await callbackReadiness(root, mission);
  const input = { fingerprint: readiness.fingerprint, expectedOwner: "legacy" as const, targetOwner: "compatible" as const,
    backupConfirmed: true as const, missionNameConfirmation: readiness.missionName };
  await assert.rejects(switchCallbackOwner(mission, "agent", { ...input, fingerprint: "0".repeat(64) }, connections), /readiness_changed/);
  await assert.rejects(switchCallbackOwner(mission, "agent", { ...input, missionNameConfirmation: "wrong" }, connections), /confirmation_required/);
  const switches = await Promise.allSettled([switchCallbackOwner(mission, "agent", input, connections),
    switchCallbackOwner(mission, "agent", input, connections)]);
  assert.equal(switches.filter(s => s.status === "fulfilled").length, 1);
  readiness = await callbackReadiness(root, mission);
  assert.equal(readiness.owner, "compatible");
  assert.equal(readiness.audit.length, 1);
  assert.equal(Number((await root.query("SELECT count(*) FROM campaign_contact_history")).rows[0].count), 1, "switch must not replay");
  // A live dependency edit invalidates approval even if legacy action IDs match.
  await root.query("INSERT INTO mission_status_list_sources VALUES('question',$1)", [mission]);
  assert.ok((await callbackReadiness(root, mission)).blockers.includes("background_dependency"));
  await assert.rejects(persistCallbackConfirmation({ ...confirmation, itemId: audit.actions[3].itemId }, connections), /legacy_config_changed/);
  await root.query("DELETE FROM mission_status_list_sources");
  // Two callbacks for the same contact must commit in event order across workers.
  await Promise.all([
    persistCallbackConfirmation({ ...confirmation, itemId: audit.actions[3].itemId, manualDate: "2026-11-03T09:00:00Z" }, connections),
    persistCallbackConfirmation({ ...confirmation, itemId: audit.actions[4].itemId, manualDate: "2026-11-04T09:00:00Z" }, connections),
  ]);
  const latestDate = (await root.query("SELECT payload->>'manualDate' AS date FROM mission_callback_events ORDER BY id DESC LIMIT 1")).rows[0].date;
  await Promise.all([drainCallbackEvents(undefined, connections), drainCallbackEvents(undefined, connections)]);
  await drainCallbackEvents(undefined, connections);
  assert.equal((await root.query("SELECT callback_date FROM campaign_contacts")).rows[0].callback_date.toISOString(), new Date(latestDate).toISOString());
  readiness = await callbackReadiness(root, mission);
  const manual = { campaignId: mission, campaignContactId: "contact", itemId: audit.actions[1].itemId,
    actorId: "agent", automationId: audit.actions[1].id, requestId: randomUUID(),
    manualDate: "2026-11-05T09:00:00.000Z", note: "manual" };
  assert.equal((await runDurableManualCallback(manual, connections))?.callbackDate, manual.manualDate);
  assert.equal((await runDurableManualCallback(manual, connections))?.callbackDate, manual.manualDate);
  assert.equal(Number((await root.query("SELECT count(*) FROM campaign_contact_history")).rows[0].count), 4,
    "manual request identity must survive retries and use reviewed compatible candidates");
  await persistCallbackConfirmation({ ...confirmation, itemId: audit.actions[1].itemId }, connections);
  await drainCallbackEvents(undefined, connections);
  assert.equal(Number((await root.query("SELECT count(*) FROM campaign_contact_history")).rows[0].count), 4,
    "automatic gt1 with zero calls is false although explicit run-now bypasses it");
  assert.equal(Number((await root.query("SELECT count(*) FROM mission_callback_candidates")).rows[0].count), 8);
  await switchCallbackOwner(mission, "agent", { ...input, fingerprint: readiness.fingerprint,
    expectedOwner: "compatible", targetOwner: "legacy" }, connections);
  assert.equal((await callbackReadiness(root, mission)).owner, "legacy");
  assert.equal(Number((await root.query("SELECT count(*) FROM campaign_contact_history")).rows[0].count), 4);
  // A history failure after the contact UPDATE must roll the contact back too.
  const next = audit.actions[7];
  await persistCallbackConfirmation({ ...confirmation, itemId: next.itemId, manualDate: "2026-11-06T09:00:00Z" }, connections);
  const pendingId = (await root.query("SELECT id FROM mission_callback_events WHERE status='pending'")).rows[0].id;
  await root.query(`ALTER TABLE campaign_contact_history ADD CONSTRAINT simulate_history_failure
    CHECK(metadata->>'callbackEventId' <> '${Number(pendingId)}')`);
  await assert.rejects(drainCallbackEvents(undefined, connections));
  assert.equal((await root.query("SELECT callback_date FROM campaign_contacts")).rows[0].callback_date.toISOString(), manual.manualDate);
  assert.equal((await root.query("SELECT status FROM mission_callback_events WHERE id=$1", [pendingId])).rows[0].status, "pending");
  await root.query("ALTER TABLE campaign_contact_history DROP CONSTRAINT simulate_history_failure");
  await drainCallbackEvents(undefined, connections);
  assert.equal(Number((await root.query("SELECT count(*) FROM campaign_contact_history")).rows[0].count), 5);
  // Keep-existing is a complete no-op, including timestamp, owner, note, source and history.
  await root.query("UPDATE campaign_status_list_automations SET callback_existing_policy='keep_existing' WHERE id=$1", [audit.actions[6].id]);
  const prior = (await root.query("SELECT * FROM campaign_contacts")).rows[0];
  await persistCallbackConfirmation({ ...confirmation, itemId: audit.actions[6].itemId, manualDate: "2026-12-01T09:00:00Z" }, connections);
  await drainCallbackEvents(undefined, connections);
  assert.deepEqual((await root.query("SELECT * FROM campaign_contacts")).rows[0], prior);
  assert.equal(Number((await root.query("SELECT count(*) FROM campaign_contact_history")).rows[0].count), 5);
  await root.query("UPDATE campaign_status_list_automations SET callback_offset_days=100 WHERE id=$1", [action.id]);
  assert.ok((await callbackReadiness(root, mission)).blockers.includes("legacy_config_changed"));
  console.log("Isolated PostgreSQL checks passed: atomic capture, concurrent confirmations/workers/reviewers, rollback recovery, live provenance/dependencies, no replay and safe ownership rollback.");
} finally {
  await root.query("RESET search_path");
  await root.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  root.release();
  await pool.end();
}
