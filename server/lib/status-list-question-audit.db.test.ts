import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { STATUS_LIST_WORKFLOW_SCHEMA } from "./status-list-workflow-schema";
import { questionNoteSchema, readQuestionAudit, writeQuestionNote } from "./status-list-question-audit";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development test only");
const client = await pool.connect();
const schema = `sl_question_audit_${randomUUID().replaceAll("-", "")}`;
try {
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema},public`);
  await client.query(`
    CREATE TABLE users(id varchar PRIMARY KEY,full_name text);
    CREATE TABLE campaign_contacts(id varchar PRIMARY KEY,campaign_id varchar);
    CREATE TABLE campaign_status_list_items(id varchar PRIMARY KEY,campaign_id varchar);
    CREATE TABLE campaign_status_list_questions(id varchar PRIMARY KEY,item_id varchar,question_text text);
    CREATE TABLE mission_status_list_answers(campaign_contact_id varchar,question_id varchar,value jsonb,updated_at timestamptz,updated_by varchar);
    CREATE TABLE campaign_contact_history(campaign_contact_id varchar,user_id varchar,action text,metadata jsonb);
    INSERT INTO users VALUES('agent','Test Agent');
    INSERT INTO campaign_contacts VALUES('contact','mission'),('other-contact','other-mission');
    INSERT INTO campaign_status_list_items VALUES('step','mission'),('other-step','other-mission');
    INSERT INTO campaign_status_list_questions VALUES('q','step','Test question'),('system-q','step','Derived'),('other-q','other-step','Other');
    INSERT INTO mission_status_list_answers VALUES
      ('contact','q','false','2026-10-21T12:30:00Z','agent'),
      ('contact','system-q','true','2026-10-21T12:31:00Z','system:mission-status-list');
  `);
  const ddl = STATUS_LIST_WORKFLOW_SCHEMA.match(/CREATE TABLE IF NOT EXISTS mission_status_list_question_notes \([\s\S]*?\n\);/)?.[0];
  assert.ok(ddl);
  await client.query(ddl);
  await client.query(ddl); // startup idempotence
  const before = (await readQuestionAudit(client, "mission", "contact")).answerMetadata;
  assert.equal(before.q.answeredByName, "Test Agent");
  assert.equal(before.q.actorKind, "user");
  assert.equal(before["system-q"].actorKind, "system");
  assert.equal(before["system-q"].answeredByName, null);
  assert.ok(!questionNoteSchema.safeParse({}).success);
  assert.ok(!questionNoteSchema.safeParse({ note: "x".repeat(10001) }).success);
  assert.ok(!questionNoteSchema.safeParse({ note: "x", confirm: true }).success);
  const save = async (note: string | null, questionId = "q", contactId = "contact") => {
    await client.query("BEGIN");
    try {
      await writeQuestionNote(client, { campaignId: "mission", contactId, questionId, actorId: "agent", note });
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  };
  await save("Note without reconfirmation");
  let audit = await readQuestionAudit(client, "mission", "contact");
  assert.equal(audit.questionNotes.q.note, "Note without reconfirmation");
  assert.equal(audit.questionNotes.q.updatedByName, "Test Agent");
  assert.deepEqual(audit.answerMetadata, before, "note cannot modify answer provenance");
  await save("Note without reconfirmation");
  assert.equal((await client.query("SELECT count(*) FROM campaign_contact_history")).rows[0].count, "1");
  await save(null);
  audit = await readQuestionAudit(client, "mission", "contact");
  assert.equal(audit.questionNotes.q.note, null, "explicit clear persists");
  assert.deepEqual(audit.answerMetadata, before);
  assert.equal((await client.query("SELECT metadata->>'note' AS note FROM campaign_contact_history LIMIT 1")).rows[0].note, "Note without reconfirmation", "history preserves snapshot");
  await assert.rejects(() => save("wrong Mission", "other-q"), /question_not_found/);
  await assert.rejects(() => save("wrong contact", "q", "other-contact"), /question_not_found/);
  assert.deepEqual(await readQuestionAudit(client, "other-mission", "contact"), { answerMetadata: {}, questionNotes: {} });
  assert.equal((await client.query("SELECT count(*) FROM campaign_contact_history")).rows[0].count, "2");
  console.log("Question audit DB tests passed: provenance, false answer, system actor, independent notes, clear, history, Mission isolation.");
} finally {
  await client.query(`SET search_path TO public`);
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  client.release();
  await pool.end();
}
