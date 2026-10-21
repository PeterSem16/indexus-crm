import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { executeStatusListNativeService, executeStatusListQuestionNativeServices } from "./status-list-native-service";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA native_service_${randomUUID().replaceAll("-", "")}`);
  const schema = (await client.query(`SELECT nspname FROM pg_namespace
    WHERE nspname LIKE 'native_service_%' ORDER BY oid DESC LIMIT 1`)).rows[0].nspname;
  await client.query(`SET LOCAL search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE campaigns(id varchar,name text,country_codes text[],settings jsonb);
    CREATE TABLE campaign_contacts(id varchar,campaign_id varchar,contact_type text,clinic_id varchar,hospital_id varchar,collaborator_id varchar,customer_id varchar);
    CREATE TABLE campaign_status_list_items(id varchar,campaign_id varchar);
    CREATE TABLE campaign_status_list_automations(id varchar,status_list_item_id varchar,question_id varchar);
    CREATE TABLE mission_status_list_answers(campaign_contact_id varchar,question_id varchar,value jsonb,revision varchar);
    CREATE TABLE clinics(id varchar,name text,email text,phone text,country_code text);
    CREATE TABLE hospitals(LIKE clinics);
    CREATE TABLE collaborators(id varchar,first_name text,last_name text,email text,mobile text,country_code text);
    CREATE TABLE customers(id varchar,first_name text,last_name text,email text,phone text,country text);
    CREATE TABLE users(id varchar,role text,assigned_countries text[],is_active boolean);
    INSERT INTO campaigns VALUES('mission','Mission',ARRAY['SK'],'{"smsProvider":"smstools"}');
    INSERT INTO campaign_contacts VALUES('membership','mission','clinic','clinic',null,null,null);
    INSERT INTO campaign_status_list_items VALUES('item','mission');
    INSERT INTO campaign_status_list_automations VALUES('action','item',null);
    INSERT INTO clinics VALUES('clinic','Clinic','contact@example.test','+421900000000','SK');
    INSERT INTO users VALUES('manager','manager',ARRAY['SK'],true);
  `);
  const startup = readFileSync("server/index.ts", "utf8");
  const table = startup.match(/CREATE TABLE IF NOT EXISTS status_list_service_executions \([\s\S]*?\n      \);/)?.[0];
  assert.ok(table, "use the actual production startup migration");
  await client.query(table);
  // Adding nullable native fields must not invalidate previously approved callback fingerprints.
  await client.query(`ALTER TABLE campaign_status_list_automations ADD COLUMN service_action_config jsonb,
    ADD COLUMN service_action_owner_id varchar`);
  const hashes = (await client.query(`SELECT
    md5((to_jsonb(a)-'service_action_config'-'service_action_owner_id')::text) AS prior,
    md5((CASE WHEN coalesce(to_jsonb(a)->'service_action_config','null'::jsonb)='null'::jsonb
      THEN to_jsonb(a)-'service_action_config'-'service_action_owner_id' ELSE to_jsonb(a) END)::text) AS current
    FROM campaign_status_list_automations a`)).rows[0];
  assert.equal(hashes.current, hashes.prior);
  const action = { id: "action", actionType: "send_sms", serviceActionOwnerId: "manager",
    serviceActionConfig: { smsActionVersion: 2, to: ["+421900000000"], text: "Message", provider: "smstools" } };
  const input = { campaignId: "mission", campaignContactId: "membership", itemId: "item", userId: "agent", confirmationId: "confirmed" };
  let sends = 0;
  const deps = { query: (sql: string, params?: any[]) => client.query(sql, params),
    execute: async (_: any, config: any, context: any) => {
      sends++;
      assert.equal(config.text, "Message");
      assert.equal(context.contact.email, "contact@example.test");
      assert.equal(context.rule.createdByUserId, "manager");
      return { ok: true, output: { sentCount: 1 } };
    } };
  assert.equal((await executeStatusListNativeService(action, input, deps)).ok, true);
  assert.equal((await executeStatusListNativeService(action, input, deps)).duplicate, true);
  assert.equal(sends, 1);
  const [run] = (await client.query("SELECT * FROM status_list_service_executions")).rows;
  assert.equal(run.status, "succeeded");
  assert.equal(run.result.output.sentCount, 1);
  assert.equal((await executeStatusListNativeService(action, { ...input, campaignId: "foreign" }, deps)).ok, false);
  assert.equal(sends, 1);
  await client.query("UPDATE users SET is_active=false");
  assert.equal((await executeStatusListNativeService(action, { ...input, confirmationId: "new" }, deps)).ok, false);
  assert.equal(sends, 1);
  await client.query(`UPDATE users SET is_active=true;
    ALTER TABLE campaign_status_list_automations ADD COLUMN action_type varchar,
      ADD COLUMN condition_field varchar,ADD COLUMN condition_value varchar,
      ADD COLUMN condition_operator varchar,ADD COLUMN condition_json text,ADD COLUMN sort_order integer DEFAULT 0;
    CREATE TABLE campaign_status_list_questions(id varchar,item_id varchar);
    INSERT INTO campaign_status_list_questions VALUES('question','item');
    INSERT INTO mission_status_list_answers VALUES('membership','question','false'::jsonb,'answer-revision');`);
  await client.query(`UPDATE campaign_status_list_automations SET question_id='question',action_type='send_sms',
    service_action_config=$1,service_action_owner_id='manager',condition_field='answer',condition_value='false'`,
  [JSON.stringify(action.serviceActionConfig)]);
  const answerInput = { ...input, questionId: "question", confirmationId: "answer:answer-revision" };
  const answerResults = await executeStatusListQuestionNativeServices(answerInput, deps);
  assert.equal(answerResults.length, 1);
  assert.equal(answerResults[0].ok, true);
  assert.equal(sends, 2, "actual question query dispatches the persisted No answer");
  assert.equal((await executeStatusListQuestionNativeServices(answerInput, deps))[0].duplicate, true);
  assert.equal(sends, 2);
  await client.query(`UPDATE mission_status_list_answers SET revision='new-revision',value='true'::jsonb`);
  assert.equal((await executeStatusListQuestionNativeServices(answerInput, deps))[0].status, "answer_superseded");
  assert.equal(sends, 2);
  console.log("Native service PostgreSQL: actual startup schema and source joins, authorization, reservation/no replay, result persistence, stable callback fingerprints passed.");
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
