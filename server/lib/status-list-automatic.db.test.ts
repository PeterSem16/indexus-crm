import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { STATUS_LIST_WORKFLOW_SCHEMA } from "./status-list-workflow-schema";
import { inspectAutomaticContact, queueAutomaticSourceEvent, automaticOverview, automaticActionIssues, runAutomaticEvents } from "./status-list-automatic";

if(process.env.NODE_ENV==="production" || process.env.REPLIT_DEPLOYMENT)throw Error("Development test only");
const client=await pool.connect();
const schema=`sl_automatic_test_${randomUUID().replaceAll("-","")}`;
const mission=randomUUID(),contact=randomUUID(),clinic=randomUUID(),item=randomUUID(),action=randomUUID(),question=randomUUID();
try {
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema},public`);
  await client.query(`
    CREATE TABLE campaigns(id varchar PRIMARY KEY,settings jsonb,country_codes text[]);
    CREATE TABLE users(id varchar PRIMARY KEY,role text,assigned_countries text[],is_active boolean);
    CREATE TABLE clinics(id varchar PRIMARY KEY,country_code varchar);
    CREATE TABLE hospitals(id varchar PRIMARY KEY,country_code varchar);
    CREATE TABLE collaborators(id varchar PRIMARY KEY,country_code varchar);
    CREATE TABLE customers(id varchar PRIMARY KEY,country varchar);
    CREATE TABLE campaign_contacts(id varchar PRIMARY KEY,campaign_id varchar,contact_type text,
      clinic_id varchar,hospital_id varchar,collaborator_id varchar,customer_id varchar);
    CREATE TABLE campaign_status_list_items(id varchar PRIMARY KEY,campaign_id varchar,label text,is_hidden boolean,
      confirmation_type text,parent_id varchar);
    CREATE TABLE campaign_status_list_questions(id varchar PRIMARY KEY,item_id varchar,question_text text);
    CREATE TABLE campaign_status_list_automations(id varchar PRIMARY KEY,status_list_item_id varchar,
      question_id varchar,action_type text,service_action_config jsonb,service_action_owner_id varchar,
      condition_field text,condition_operator text,condition_value text,condition_json text,sort_order integer DEFAULT 0);
    CREATE TABLE mission_status_list_answers(campaign_contact_id varchar,question_id varchar,value jsonb,revision varchar);
    CREATE TABLE mission_status_list_sources(campaign_id varchar,question_id varchar);
    CREATE TABLE mission_status_list_option_sources(campaign_id varchar,group_id varchar);
  `);
  await client.query(STATUS_LIST_WORKFLOW_SCHEMA.split("CREATE TABLE IF NOT EXISTS mission_status_list_rules")[0]);
  await client.query("INSERT INTO campaigns VALUES($1,'{}',ARRAY['SK','CZ'])",[mission]);
  await client.query("INSERT INTO users VALUES('owner','manager',ARRAY['SK','CZ'],true)");
  await client.query("INSERT INTO clinics VALUES($1,'SK')",[clinic]);
  await client.query("INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id) VALUES($1,$2,'clinic',$3)",[contact,mission,clinic]);
  await client.query("INSERT INTO campaign_status_list_items VALUES($1,$2,'Hidden auto',true,'auto',null)",[item,mission]);
  const config={notificationActionVersion:2,title:"Test",message:"Message",taskGroupId:"group"};
  await client.query(`INSERT INTO campaign_status_list_automations(id,status_list_item_id,action_type,
    service_action_config,service_action_owner_id) VALUES($1,$2,'notify_role',$3::jsonb,'owner')`,
  [action,item,JSON.stringify(config)]);
  await client.query(`INSERT INTO mission_status_list_automatic_configs(item_id,campaign_id,trigger,enabled)
    VALUES($1,$2,'card_open',true)`,[item,mission]);
  assert.equal((await automaticOverview(client,mission,item))?.item.isHidden,true);
  assert.ok(automaticActionIssues({actionType:"set_callback",serviceActionOwnerId:"owner"}).includes("unsupported_action"));
  const inspect=()=>inspectAutomaticContact(client,mission,contact,item);
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal((await inspect()).actions[0].status,"ready");
  await client.query("COMMIT");
  assert.equal((await client.query("SELECT count(*) FROM mission_status_list_automatic_events")).rows[0].count,"0","preview writes nothing");
  const admit=()=>inspectAutomaticContact(client,mission,contact,item,{enqueue:true,trigger:"card_open",actorId:"agent"});
  assert.equal((await admit()).actions[0].status,"pending");
  assert.equal((await admit()).actions[0].status,"pending");
  assert.equal((await client.query("SELECT count(*) FROM mission_status_list_automatic_events")).rows[0].count,"1");
  await client.query("UPDATE mission_status_list_automatic_events SET state='succeeded'");
  await client.query("UPDATE mission_status_list_automatic_configs SET revision=gen_random_uuid()::text");
  assert.equal((await admit()).actions[0].status,"already_executed","config changes don't replay card-open effects");
  await client.query("DELETE FROM mission_status_list_automatic_events");
  await client.query(`UPDATE mission_status_list_automatic_configs SET trigger='background_change'`);
  await client.query(`UPDATE campaign_status_list_automations SET condition_field='country',condition_value='CZ'`);
  const background=()=>inspectAutomaticContact(client,mission,contact,item,{enqueue:true,trigger:"background_change"});
  assert.equal((await background()).actions[0].status,"condition_false");
  await client.query("UPDATE clinics SET country_code='CZ'");
  assert.equal((await background()).actions[0].status,"pending","only false->true enqueues");
  assert.equal((await background()).actions[0].status,"pending","stable state never adds an event");
  assert.equal((await client.query("SELECT count(*) FROM mission_status_list_automatic_events")).rows[0].count,"1");
  await client.query("UPDATE campaign_status_list_automations SET condition_value='CZ',condition_operator='eq'");
  const changed=await background();
  assert.equal(changed.actions[0].status,"background_baseline","definition edit starts a new no-effect baseline");
  await client.query("UPDATE campaigns SET settings='{\"statusListMode\":\"batch\"}'");
  await client.query("UPDATE clinics SET country_code='SK'");
  await background();
  await client.query("UPDATE clinics SET country_code='CZ'");
  assert.equal((await background()).actions[0].status,"batch_deferred");
  assert.equal((await client.query("SELECT count(*) FROM mission_status_list_automatic_events WHERE state='awaiting_batch'")).rows[0].count,"1");
  await client.query("INSERT INTO campaign_status_list_questions VALUES($1,$2,'System answer')",[question,item]);
  await client.query("INSERT INTO mission_status_list_sources VALUES($1,$2)",[mission,question]);
  await client.query(`INSERT INTO mission_status_list_answers VALUES($1,$2,'"yes"','revision')`,[contact,question]);
  await client.query("UPDATE campaign_status_list_automations SET question_id=$1,condition_field='answer',condition_value='yes'",[question]);
  assert.equal((await background()).actions[0].status,"waiting_transition","derived question never runs on generic polling");
  const event={campaignId:mission,campaignContactId:contact,actorId:"system:mission-status-list",
    source:{kind:"question" as const,id:question},value:"yes" as const,eventId:"transition:test",occurredAt:new Date(),
    trigger:"background_transition" as const};
  await queueAutomaticSourceEvent(client,event);
  await queueAutomaticSourceEvent(client,event);
  const sourceRows=(await client.query("SELECT * FROM mission_status_list_automatic_events WHERE trigger_key='source:transition:test'")).rows;
  assert.equal(sourceRows.length,1,"source transition retries deduplicate");
  assert.equal(sourceRows[0].state,"awaiting_batch");
  assert.equal(sourceRows[0].event_context.questionRevision,"revision");
  await client.query("UPDATE campaigns SET settings='{}'");
  await queueAutomaticSourceEvent(client,{...event,eventId:"transition:next"});
  assert.equal((await client.query("SELECT state FROM mission_status_list_automatic_events WHERE trigger_key='source:transition:next'")).rows[0].state,"pending");
  await assert.rejects(()=>inspectAutomaticContact(client,randomUUID(),contact,item),/contact_or_item_not_found/);
  await client.query("DELETE FROM mission_status_list_automatic_events");
  await queueAutomaticSourceEvent(client,{...event,eventId:"transition:delivery"});
  let deliveries=0,inTransaction=false;
  const workerClient={
    query:async(sql:string,params?:any[])=>{
      if(sql==="BEGIN")inTransaction=true;
      const result=await client.query(sql,params);
      if(sql==="COMMIT" || sql==="ROLLBACK")inTransaction=false;
      return result;
    },
    release:()=>{},
  };
  const deps={connect:async()=>workerClient as any,execute:async (_action:any,input:any)=>{
    assert.equal(inTransaction,false,"external delivery is after COMMIT");
    assert.equal(input.automaticEvent.questionRevision,"revision");
    deliveries++;return {ok:true,executionId:"receipt"};
  }};
  await runAutomaticEvents(deps);
  await runAutomaticEvents(deps);
  assert.equal(deliveries,1,"worker never re-delivers a completed claim");
  assert.equal((await client.query("SELECT state FROM mission_status_list_automatic_events")).rows[0].state,"succeeded");
  await queueAutomaticSourceEvent(client,{...event,eventId:"transition:changed-config"});
  await client.query("UPDATE campaign_status_list_automations SET condition_value='no'");
  await runAutomaticEvents(deps);
  assert.equal(deliveries,1,"changed definitions supersede pending deliveries");
  assert.equal((await client.query("SELECT state FROM mission_status_list_automatic_events WHERE trigger_key='source:transition:changed-config'")).rows[0].state,"superseded");
  console.log("Status List automatic DB: read-only preview, hidden step, no replay, definition baselines, source subquestions, Batch and exact Mission passed.");
} finally {
  await client.query("ROLLBACK").catch(()=>{});
  await client.query("SET search_path TO public");
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  client.release();
  await pool.end();
}
