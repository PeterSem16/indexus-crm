import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { loadStatusListHistoryFacts } from "./status-list-history";

// All data and SQL writes stay in this disposable schema.
const schema = `history_conditions_${randomUUID().replaceAll("-", "")}`;
const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE campaign_contacts(id text,campaign_id text,contact_type text,clinic_id text,hospital_id text,customer_id text,collaborator_id text);
    CREATE TABLE call_logs(id text,sip_call_id text,direction text,status text,answered_at timestamp,started_at timestamp,
      ended_at timestamp,duration_seconds integer,is_forwarded boolean,campaign_id text,campaign_contact_id text);
    CREATE TABLE communication_messages(id text,type text,direction text,status text,sent_at timestamp,created_at timestamp,
      campaign_id text,entity_type text,entity_id text,customer_id text,reply_to_sms_id text);
    INSERT INTO campaign_contacts VALUES ('cc1','m1','clinic','c1',NULL,NULL,NULL),
      ('cc2','m2','clinic','c1',NULL,NULL,NULL),('cc3','m1','hospital',NULL,'h1',NULL,NULL),
      ('cc4','m1','clinic',NULL,NULL,NULL,NULL);
    INSERT INTO call_logs(id,direction,status,started_at,campaign_id,campaign_contact_id)
      VALUES ('wrong-mission','outbound','no_answer',now(),'m2','cc2');
    INSERT INTO communication_messages(id,type,direction,status,campaign_id,entity_type,entity_id)
      VALUES ('other','email','outbound','sent','m2','clinic','c1'),
        ('unattributed','email','inbound','received',NULL,'clinic','c1'),
        ('other-entity','sms','outbound','delivered','m1','clinic','c2'),
        ('draft','sms','outbound','draft','m1','clinic','c1');`);
  assert.equal((await loadStatusListHistoryFacts(client, "m1", "cc1"))!["history.outreach_attempted"], false);
  assert.equal((await loadStatusListHistoryFacts(client, "m1", "cc1"))!["history.reached"], false);
  assert.equal(await loadStatusListHistoryFacts(client, "m2", "cc1"), null);
  assert.equal(await loadStatusListHistoryFacts(client, "m1", "cc4"), null);
  await client.query(`INSERT INTO call_logs(id,direction,status,started_at,campaign_id,campaign_contact_id)
    VALUES ('valid','outbound','no_answer',now(),'m1','cc1')`);
  assert.equal((await loadStatusListHistoryFacts(client, "m1", "cc1"))!["history.call_attempted"], true);
  assert.equal((await loadStatusListHistoryFacts(client, "m1", "cc3"))!["history.call_attempted"], false);
  await client.query(`INSERT INTO communication_messages(id,type,direction,status,campaign_id,entity_type,entity_id)
    VALUES ('hospital-sent','sms','outbound','sent','m1','hospital','h1')`);
  assert.equal((await loadStatusListHistoryFacts(client, "m1", "cc3"))!["history.sms_sent"], true);
  assert.equal((await loadStatusListHistoryFacts(client, "m1", "cc3"))!["history.reached"], false);
  await client.query(`INSERT INTO communication_messages(id,type,direction,status,reply_to_sms_id)
    VALUES ('reply','sms','inbound','received','hospital-sent')`);
  assert.equal((await loadStatusListHistoryFacts(client, "m1", "cc3"))!["history.sms_reply"], true);
  assert.equal((await loadStatusListHistoryFacts(client, "m1", "cc1"))!["history.sms_reply"], false);
  console.log("Status List history PostgreSQL: clinic/hospital, Mission/entity isolation, linked reply, missing identity passed");
} finally {
  await client.query("RESET search_path");
  await client.query(`DROP SCHEMA "${schema}" CASCADE`);
  client.release();
  await pool.end();
}
