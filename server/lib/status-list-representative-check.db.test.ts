import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { evaluateRepresentativeChecks, representativeEventValid } from "./status-list-representative-check";
import { runAutomaticEvents } from "./status-list-automatic";
import { STATUS_LIST_WORKFLOW_SCHEMA } from "./status-list-workflow-schema";
import { representativeCheckSchema } from "../../shared/status-list-representative-check";

if (process.env.NODE_ENV==="production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development only");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
const client=await pool.connect();
const schema=`coordinator_check_${randomUUID().replaceAll("-","")}`;
try {
  await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  await client.query(`
    CREATE TABLE campaigns(id varchar PRIMARY KEY,settings jsonb,country_codes text[]);
    CREATE TABLE users(id varchar PRIMARY KEY,full_name text,role text,assigned_countries text[],is_active boolean);
    CREATE TABLE clinics(id varchar PRIMARY KEY,country_code varchar);
    CREATE TABLE hospitals(id varchar PRIMARY KEY,country_code varchar);
    CREATE TABLE campaign_contacts(id varchar PRIMARY KEY,campaign_id varchar,contact_type text,clinic_id varchar,hospital_id varchar);
    CREATE TABLE campaign_status_list_items(id varchar PRIMARY KEY,campaign_id varchar,label text,is_hidden boolean,confirmation_type text,parent_id varchar,sort_order int);
    CREATE TABLE campaign_status_list_questions(id varchar PRIMARY KEY,item_id varchar,question_text text,sort_order int);
    CREATE TABLE campaign_status_list_automations(id varchar PRIMARY KEY,status_list_item_id varchar,question_id varchar,
      action_type text,service_action_config jsonb,service_action_owner_id varchar,condition_field text,
      condition_operator text,condition_value text,condition_json text,sort_order int);
    CREATE TABLE clinic_representative_assignments(clinic_id varchar,user_id varchar,valid_from timestamptz,valid_to timestamptz);
    CREATE TABLE hospital_representative_assignments(hospital_id varchar,user_id varchar,valid_from timestamptz,valid_to timestamptz);
    CREATE TABLE mission_status_list_sources(question_id varchar PRIMARY KEY,campaign_id varchar,source text,show_information boolean,
      check_config jsonb,check_revision varchar);
    CREATE TABLE mission_status_list_representative_states(campaign_contact_id varchar,question_id varchar,state text,episode varchar,
      assignment_version text,actionable boolean,updated_at timestamptz DEFAULT now(),PRIMARY KEY(campaign_contact_id,question_id));
    INSERT INTO campaigns VALUES('mission','{}',ARRAY['SK']),('foreign','{}',ARRAY['CZ']);
    INSERT INTO users VALUES('owner','Coordinator','manager',ARRAY['SK'],true);
    INSERT INTO clinics VALUES('clinic','SK');
    INSERT INTO hospitals VALUES('hospital','SK');
    INSERT INTO campaign_contacts VALUES('c','mission','clinic','clinic',NULL),('h','mission','hospital',NULL,'hospital');
    INSERT INTO campaign_status_list_items VALUES('item','mission','Coordinator check',true,'info',NULL,0);
    INSERT INTO campaign_status_list_questions VALUES('q','item','Coordinator check',0);
    INSERT INTO campaign_status_list_automations VALUES('action','item','q','notify_role',
      '{"notificationActionVersion":2,"title":"Test","message":"Message","taskGroupId":"group"}','owner','answer','eq','no',NULL,0);
    INSERT INTO mission_status_list_sources VALUES('q','mission','representative_assigned',true,
      '{"enabled":true,"trigger":"pulse_open","behavior":"confirm"}','revision');
  `);
  await client.query(STATUS_LIST_WORKFLOW_SCHEMA.split("CREATE TABLE IF NOT EXISTS mission_status_list_rules")[0]);
  const evaluate=async(contact="c",extra:any={})=>{
    await client.query("BEGIN");
    try {
      const result=await evaluateRepresentativeChecks(client,"mission",contact,{trigger:"pulse_open",actorId:"agent",...extra});
      await client.query("COMMIT");return result;
    }catch(error){await client.query("ROLLBACK");throw error;}
  };
  const count=async()=>Number((await client.query("SELECT count(*) FROM mission_status_list_automatic_events")).rows[0].count);
  assert.equal((await evaluate("c",{trigger:"card_open"})).information.length,0);
  const plan=await evaluate();
  assert.equal(plan.information[0].state,"unassigned");
  assert.equal(plan.reviews.length,1);
  assert.equal(plan.reviews[0].preview.actions[0].condition,"matched");
  assert.equal(await count(),0,"Opening offers but does not execute");
  assert.equal((await evaluate()).reviews[0].fingerprint,plan.reviews[0].fingerprint,"Stable re-open plan");
  await client.query("INSERT INTO clinic_representative_assignments VALUES('clinic','owner',now(),NULL)");
  await assert.rejects(()=>evaluate("c",{confirm:{questionId:"q",fingerprint:plan.reviews[0].fingerprint}}),/preview_changed/);
  assert.equal(await count(),0);
  assert.equal((await evaluate()).information[0].representativeName,"Coordinator");
  await client.query("UPDATE clinic_representative_assignments SET valid_to=now()");
  const again=await evaluate();
  const confirmation={questionId:"q",fingerprint:again.reviews[0].fingerprint};
  await evaluate("c",{confirm:confirmation});
  await evaluate("c",{confirm:confirmation});
  assert.equal(await count(),1,"Double confirmation has one durable event");
  let sent=0;
  const run=()=>runAutomaticEvents({connect:async()=>({query:client.query.bind(client),release(){}} as any),
    execute:async()=>{sent++;return {ok:true};}});
  await run();await run();
  assert.equal(sent,1);
  assert.equal((await evaluate()).information[0].actionState,"done");
  assert.equal((await evaluate()).reviews.length,0);
  // Config edits and reopens don't reset the absence episode.
  await client.query(`UPDATE mission_status_list_sources SET check_revision='changed',
    check_config='{"enabled":true,"trigger":"pulse_open","behavior":"automatic"}'`);
  await evaluate();assert.equal(await count(),1);
  // A new known assignment period creates a new episode, even between evaluations.
  await client.query("INSERT INTO clinic_representative_assignments VALUES('clinic','owner',now()-interval '1 second',now())");
  await evaluate();assert.equal(await count(),2);
  await client.query("INSERT INTO clinic_representative_assignments VALUES('clinic','owner',now(),NULL)");
  await run();assert.equal(sent,1,"Assignment before worker execution cancels pending action");
  assert.equal((await client.query("SELECT state FROM mission_status_list_automatic_events ORDER BY created_at DESC LIMIT 1")).rows[0].state,"superseded");
  // Hospital and Batch follow the same path.
  await client.query(`UPDATE campaigns SET settings='{"statusListMode":"batch"}' WHERE id='mission'`);
  const hospital=await evaluate("h");
  assert.equal(hospital.information[0].batchDeferred,true);
  await run();assert.equal(sent,1,"Batch waits for Save");
  await client.query("UPDATE mission_status_list_automatic_events SET state='pending' WHERE state='awaiting_batch'");
  await run();assert.equal(sent,2);
  // Off means no display and no new event.
  await client.query(`UPDATE mission_status_list_sources SET check_config='{"enabled":false,"trigger":"pulse_open","behavior":"automatic"}'`);
  assert.deepEqual(await evaluate(),{information:[],reviews:[]});
  // Information-only never queues.
  await client.query(`UPDATE mission_status_list_sources SET check_config='{"enabled":true,"trigger":"pulse_open","behavior":"information"}'`);
  assert.equal((await evaluate("h")).information[0].actionState,undefined);
  // Background has a safe baseline, then reacts to a real assignment transition.
  await client.query("DELETE FROM mission_status_list_automatic_events;DELETE FROM mission_status_list_representative_states");
  await client.query(`UPDATE mission_status_list_sources SET check_config='{"enabled":true,"trigger":"background_change","behavior":"automatic"}'`);
  await evaluate("h",{trigger:"background_change"});await evaluate("h",{trigger:"background_change"});
  assert.equal(await count(),0);
  await client.query("INSERT INTO hospital_representative_assignments VALUES('hospital','owner',now(),NULL)");
  await evaluate("h",{trigger:"background_change"});
  await client.query("UPDATE hospital_representative_assignments SET valid_to=now()");
  await evaluate("h",{trigger:"background_change"});
  assert.equal(await count(),1);
  // YES is explicit opt-in, NO remains independent, and old unconditional actions
  // must never turn into assigned-representative effects.
  await client.query("DELETE FROM clinic_representative_assignments");
  await client.query("INSERT INTO clinic_representative_assignments VALUES('clinic','owner',now(),NULL)");
  await client.query(`INSERT INTO campaign_status_list_automations
    SELECT 'assigned-action',status_list_item_id,question_id,action_type,service_action_config,service_action_owner_id,
      'answer','eq','yes',NULL,1 FROM campaign_status_list_automations WHERE id='action';
    INSERT INTO campaign_status_list_automations
    SELECT 'legacy-always',status_list_item_id,question_id,action_type,service_action_config,service_action_owner_id,
      NULL,NULL,NULL,NULL,2 FROM campaign_status_list_automations WHERE id='action'`);
  await client.query(`UPDATE mission_status_list_sources SET check_config=
    '{"enabled":true,"trigger":"pulse_open","behavior":"automatic"}',check_revision='assigned-off'`);
  const beforeAssigned=await count();
  await evaluate();
  assert.equal(await count(),beforeAssigned,"Assigned actions remain off for existing configurations");
  await client.query(`UPDATE mission_status_list_sources SET check_config=
    '{"enabled":true,"trigger":"pulse_open","behavior":"automatic","assignedActions":true}',check_revision='assigned-on'`);
  await evaluate();
  assert.equal(await count(),beforeAssigned+1,"Only the explicit YES branch is queued for an assigned representative");
  const assignedEvent=(await client.query("SELECT * FROM mission_status_list_automatic_events WHERE automation_id='assigned-action'")).rows[0];
  assert.equal(assignedEvent.event_context.representativeCheck.state,"assigned");
  assert.equal(await representativeEventValid(client,assignedEvent),true);
  await evaluate();
  assert.equal(await count(),beforeAssigned+1,"Repeated opens do not duplicate the YES branch");
  await client.query("UPDATE clinic_representative_assignments SET valid_to=now()");
  assert.equal(await representativeEventValid(client,assignedEvent),false,"Queued YES action is rejected after assignment is removed");
  await evaluate();
  assert.equal((await client.query("SELECT count(*)::int AS n FROM mission_status_list_automatic_events WHERE automation_id='assigned-action'")).rows[0].n,1,
    "The NO branch never queues the YES action");
  // Initial assigned records must not be replayed by background polling.
  await client.query("DELETE FROM mission_status_list_representative_states WHERE campaign_contact_id='h'");
  await client.query("INSERT INTO hospital_representative_assignments VALUES('hospital','owner',now(),NULL)");
  await client.query(`UPDATE mission_status_list_sources SET check_config=
    '{"enabled":true,"trigger":"background_change","behavior":"automatic","assignedActions":true}',check_revision='assigned-background'`);
  const beforeBaseline=await count();
  await evaluate("h",{trigger:"background_change"});
  assert.equal(await count(),beforeBaseline,"First assigned background observation establishes a baseline only");
  await assert.rejects(async()=>{
    await client.query("BEGIN");
    try {await evaluateRepresentativeChecks(client,"foreign","c",{trigger:"pulse_open"});}
    finally {await client.query("ROLLBACK");}
  },/contact_not_found/);
  assert.equal(representativeCheckSchema.safeParse({enabled:true,trigger:"after_open",behavior:"automatic"}).success,false);
  await client.query("UPDATE campaign_status_list_automations SET execution_policy='review' WHERE id='assigned-action'");
  await client.query("INSERT INTO clinic_representative_assignments VALUES('clinic','owner',now(),NULL)");
  await client.query(`UPDATE mission_status_list_sources SET check_config=
    '{"enabled":true,"trigger":"pulse_open","behavior":"automatic","assignedActions":true}',check_revision='per-action-review'`);
  const beforeReview=await count(),perActionReview=await evaluate();
  assert.equal(await count(),beforeReview,"An individually reviewed action overrides source Automatic");
  assert.equal(perActionReview.information[0].actionState,"available");
  assert.equal(perActionReview.reviews.length,1);
  await evaluate("c",{confirm:{questionId:"q",fingerprint:perActionReview.reviews[0].fingerprint}});
  assert.equal(await count(),beforeReview+1);
  await client.query("UPDATE clinic_representative_assignments SET valid_to=now() WHERE valid_to IS NULL");
  await client.query("INSERT INTO clinic_representative_assignments VALUES('clinic','owner',now(),NULL)");
  await client.query("UPDATE campaign_status_list_automations SET execution_policy='automatic' WHERE id='assigned-action'");
  await client.query(`UPDATE mission_status_list_sources SET check_config=
    '{"enabled":true,"trigger":"pulse_open","behavior":"confirm","assignedActions":true}',check_revision='per-action-auto'`);
  const beforeAuto=await count(),perActionAuto=await evaluate();
  assert.equal(perActionAuto.reviews.length,0,"An explicitly automatic action overrides source Review");
  assert.equal(await count(),beforeAuto+1);
  console.log("Coordinator checks DB: opt-in, trigger, fresh clinic/hospital, confirmation/cancel, stale plan, durable dedup, worker validation, Batch, off, information, background baseline and scope passed");
}finally{
  await client.query("ROLLBACK");
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  client.release();await pool.end();
}
