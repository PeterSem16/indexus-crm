import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { saveWorkflowQuestions } from "./status-list-workflow";
import { ensureStatusListWorkflowSchema } from "./status-list-workflow-schema";

// Only this disposable schema is written; no public contacts or communications.
const schema = `answer_commit_${randomUUID().replaceAll("-", "")}`;
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
    CREATE TABLE campaigns(id varchar PRIMARY KEY);
    CREATE TABLE campaign_contacts(id varchar PRIMARY KEY,campaign_id varchar,contact_type text,customer_id varchar,
      hospital_id varchar,clinic_id varchar);
    CREATE TABLE customers(id varchar PRIMARY KEY,hospital_name text,clinic_id varchar);
    CREATE TABLE campaign_status_list_items(id varchar PRIMARY KEY,campaign_id varchar,label text,
      is_hidden boolean DEFAULT false,confirmation_type text DEFAULT 'manual',parent_id varchar,
      sort_order int DEFAULT 0,item_type text DEFAULT 'step',question_selection_mode text DEFAULT 'multiple');
    CREATE TABLE campaign_status_list_questions(id varchar PRIMARY KEY,item_id varchar,question_text text,
      field_type text DEFAULT 'checkbox',is_hidden boolean DEFAULT false,sort_order int DEFAULT 0,
      logic_operator text DEFAULT 'OR',group_name text);
    CREATE TABLE campaign_contact_status_list_state(id varchar PRIMARY KEY,campaign_contact_id varchar,
      status_list_item_id varchar);
    CREATE TABLE campaign_contact_history(campaign_contact_id varchar,user_id varchar,action text,metadata jsonb);
  `);
  await ensureStatusListWorkflowSchema(root);
  await root.query(`INSERT INTO campaigns VALUES('mission');
    INSERT INTO campaign_contacts(id,campaign_id) VALUES('contact','mission');
    INSERT INTO campaign_status_list_items(id,campaign_id,label) VALUES('step','mission','Step');
    INSERT INTO campaign_status_list_questions(id,item_id,question_text,logic_operator,group_name)
      VALUES('a','step','A','ONE','choice'),('b','step','B','ONE','choice'),('c','step','C','OR','other');`);
  const command = (changes: any[], requestId = randomUUID()) =>
    saveWorkflowQuestions({ campaignId: "mission", campaignContactId: "contact", actorId: "agent", requestId, changes }, connections);
  const values = async () => Object.fromEntries((await root.query(
    "SELECT question_id,value FROM mission_status_list_answers WHERE campaign_contact_id='contact'")).rows.map(r => [r.question_id, r.value]));
  const firstId = randomUUID();
  const first = await command([{ questionId: "a", expected: null, value: true }, { questionId: "c", expected: null, value: true }], firstId);
  assert.equal(first.length, 2);
  assert.deepEqual(await values(), { a: true, c: true });
  const actual = (await root.query("SELECT revision FROM mission_status_list_answers WHERE question_id='a'")).rows[0].revision;
  assert.equal(actual, `${firstId}:a`, "native service identity must match the persisted revision");
  const histories = (await root.query("SELECT count(*)::int AS n FROM campaign_contact_history")).rows[0].n;
  const repeated = await command([{ questionId: "a", expected: null, value: true }, { questionId: "c", expected: null, value: true }], firstId);
  assert.ok(repeated.every(event => event.repeated));
  assert.equal((await root.query("SELECT count(*)::int AS n FROM campaign_contact_history")).rows[0].n, histories);
  await assert.rejects(command([{ questionId: "a", expected: null, value: null }], firstId), /request_id_conflict/);
  await assert.rejects(command([{ questionId: "b", expected: null, value: true }]), /answer_group_conflict/);
  assert.deepEqual(await values(), { a: true, c: true }, "invalid ONE save is all-or-nothing");
  await assert.rejects(command([{ questionId: "a", expected: null, value: null }, { questionId: "b", expected: null, value: true }]), /answer_conflict/);
  await command([{ questionId: "a", expected: true, value: null }, { questionId: "b", expected: null, value: true }]);
  assert.deepEqual(await values(), { a: null, b: true, c: true });
  await assert.rejects(command([{ questionId: "c", expected: true, value: null }, { questionId: "foreign", expected: null, value: true }]), /question_not_writable/);
  assert.equal((await values()).c, true, "a rejected member cannot partially save another answer");
  await root.query("UPDATE campaign_status_list_questions SET is_hidden=true WHERE id='c'");
  await assert.rejects(command([{ questionId: "c", expected: true, value: null }]), /question_not_writable/);
  console.log("PASS isolated answer commit: final groups, sibling clears, stable retries, request conflicts, concurrent edits, atomic rejection and hidden-source protection");
} finally {
  await root.query("RESET search_path");
  await root.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  root.release();
  await pool.end();
}
