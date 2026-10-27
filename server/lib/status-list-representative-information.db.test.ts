import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { readStatusListRepresentativeInformation } from "./status-list-representative-information";
import { workflowSourceConfigSchema } from "../../shared/status-list-workflow";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development fixtures only");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
const schema = `representative_info_${randomUUID().replaceAll("-", "")}`;
try {
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE users(id varchar PRIMARY KEY,full_name text);
    CREATE TABLE clinics(id varchar PRIMARY KEY);
    CREATE TABLE hospitals(id varchar PRIMARY KEY);
    CREATE TABLE campaign_contacts(id varchar PRIMARY KEY,campaign_id varchar,contact_type text,clinic_id varchar,hospital_id varchar,assigned_to varchar);
    CREATE TABLE campaign_status_list_items(id varchar PRIMARY KEY,campaign_id varchar,sort_order int);
    CREATE TABLE campaign_status_list_questions(id varchar PRIMARY KEY,item_id varchar,question_text text,sort_order int);
    CREATE TABLE mission_status_list_sources(question_id varchar,campaign_id varchar,source text,show_information boolean,check_config jsonb);
    CREATE TABLE clinic_representative_assignments(clinic_id varchar,user_id varchar,valid_from timestamptz,valid_to timestamptz);
    CREATE TABLE hospital_representative_assignments(hospital_id varchar,user_id varchar,valid_from timestamptz,valid_to timestamptz);
    INSERT INTO users VALUES('rep','Test Coordinator'),('agent','Mission Agent'),('old','Previous Coordinator');
    INSERT INTO clinics VALUES('clinic'),('none'),('ambiguous'),('future'),('expired');
    INSERT INTO hospitals VALUES('hospital');
    INSERT INTO campaign_contacts VALUES
      ('c','mission','clinic','clinic',NULL,'agent'),
      ('h','mission','hospital',NULL,'hospital','agent'),
      ('n','mission','clinic','none',NULL,'agent'),
      ('a','mission','clinic','ambiguous',NULL,'agent'),
      ('f','mission','clinic','future',NULL,'agent'),
      ('e','mission','clinic','expired',NULL,'agent'),
      ('d','mission','clinic','deleted',NULL,'agent'),
      ('unsupported','mission','customer',NULL,NULL,'agent'),
      ('foreign','other','clinic','clinic',NULL,'agent');
    INSERT INTO campaign_status_list_items VALUES('item','mission',0),('foreign-item','other',0);
    INSERT INTO campaign_status_list_questions VALUES('q','item','Coordinator check',0),('quiet','item','Existing source',1),('foreign-q','foreign-item','Other Mission',0);
    INSERT INTO mission_status_list_sources(question_id,campaign_id,source,show_information) VALUES
      ('q','mission','representative_assigned',true),
      ('quiet','mission','representative_assigned',false),
      ('foreign-q','other','representative_assigned',true);
    INSERT INTO clinic_representative_assignments VALUES
      ('clinic','rep',now()-interval '1 day',NULL),
      ('clinic','old',now()-interval '2 days',now()-interval '1 day'),
      ('ambiguous','rep',now()-interval '1 day',NULL),
      ('ambiguous','agent',now()-interval '1 day',NULL),
      ('future','rep',now()+interval '1 day',NULL),
      ('expired','old',now()-interval '2 days',now()-interval '1 day');
    INSERT INTO hospital_representative_assignments VALUES('hospital','rep',now()-interval '1 day',NULL);
  `);
  // All reads succeed in a read-only transaction: opening a record has no effects.
  await client.query("BEGIN READ ONLY");
  for (const contact of ["c", "h"]) {
    assert.deepEqual(await readStatusListRepresentativeInformation(client, "mission", contact), [{
      questionId: "q", label: "Coordinator check", state: "assigned", representativeName: "Test Coordinator",
    }]);
  }
  for (const contact of ["n", "f", "e"]) {
    assert.equal((await readStatusListRepresentativeInformation(client, "mission", contact))[0].state, "unassigned");
  }
  for (const contact of ["a", "d", "unsupported"]) {
    const [info] = await readStatusListRepresentativeInformation(client, "mission", contact);
    assert.equal(info.state, "unknown");
    assert.equal(info.representativeName, null);
  }
  assert.deepEqual(await readStatusListRepresentativeInformation(client, "mission", "foreign"), []);
  assert.deepEqual(await readStatusListRepresentativeInformation(client, "other", "c"), []);
  await client.query("COMMIT");
  await client.query("DELETE FROM clinic_representative_assignments WHERE clinic_id='clinic' AND valid_to IS NULL");
  assert.equal((await readStatusListRepresentativeInformation(client, "mission", "c"))[0].state, "unassigned", "Reads fresh assignment, not saved answer");
  await client.query("INSERT INTO clinic_representative_assignments VALUES('clinic','missing-user',now(),NULL)");
  assert.deepEqual((await readStatusListRepresentativeInformation(client, "mission", "c"))[0], {
    questionId: "q", label: "Coordinator check", state: "assigned", representativeName: null,
  }, "A missing name must not pretend no assignment");
  await client.query("UPDATE mission_status_list_sources SET show_information=false WHERE question_id='q'");
  assert.deepEqual(await readStatusListRepresentativeInformation(client, "mission", "c"), []);
  assert.equal(workflowSourceConfigSchema.safeParse({ source: "representative_assigned", hidden: true, showInformation: true }).success, true);
  assert.equal(workflowSourceConfigSchema.safeParse({ source: "representative_assignment_type", hidden: true, showInformation: true }).success, false);
  assert.equal(workflowSourceConfigSchema.safeParse({ source: "representative_assigned", hidden: true }).success, true, "Existing configs remain valid");
  console.log("Representative information: clinic/hospital, current/expired/future/ambiguous, scope, opt-in, read-only, schema passed");
} finally {
  await client.query("ROLLBACK");
  await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  client.release();
  await pool.end();
}
