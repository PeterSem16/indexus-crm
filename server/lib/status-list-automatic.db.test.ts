import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { STATUS_LIST_WORKFLOW_SCHEMA } from "./status-list-workflow-schema";
import { inspectAutomaticContact, queueAutomaticSourceEvent, automaticOverview, automaticActionIssues, runAutomaticEvents, saveAutomaticConfig } from "./status-list-automatic";
import { previewAutomaticInitial, confirmAutomaticInitial, initialScopeSchema } from "./status-list-automatic-initial";

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
  assert.ok(automaticActionIssues({actionType:"set_callback",serviceActionOwnerId:"owner"}).includes("invalid_callback"));
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
  await client.query("UPDATE campaign_status_list_items SET confirmation_type='info' WHERE id=$1",[item]);
  assert.equal((await background()).actions[0].status,"disabled","Informational containers still cannot run actions from generic polling");
  await queueAutomaticSourceEvent(client,event);
  await queueAutomaticSourceEvent(client,event);
  const sourceRows=(await client.query("SELECT * FROM mission_status_list_automatic_events WHERE trigger_key='source:transition:test'")).rows;
  await client.query("UPDATE campaign_status_list_items SET confirmation_type='checkbox' WHERE id=$1",[item]);
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
  // A separate, explicit initial-state plan never changes normal baseline policy.
  await client.query(`ALTER TABLE clinics ADD COLUMN name text;
    ALTER TABLE hospitals ADD COLUMN name text;
    ALTER TABLE collaborators ADD COLUMN first_name text,ADD COLUMN last_name text;
    ALTER TABLE customers ADD COLUMN first_name text,ADD COLUMN last_name text;
    CREATE TABLE status_list_service_executions(id varchar PRIMARY KEY,campaign_id varchar,
      campaign_contact_id varchar,automation_id varchar,status text);
    DELETE FROM mission_status_list_automatic_events;
    DELETE FROM mission_status_list_automatic_states;
    UPDATE campaigns SET settings='{}';
    UPDATE clinics SET country_code='SK',name='Synthetic clinic';
    UPDATE campaign_status_list_automations SET question_id=NULL,condition_field='country',
      condition_value='SK',condition_operator='eq';`);
  const scope={scope:"contact" as const,contactId:contact};
  const plan=()=>previewAutomaticInitial(client,mission,item,scope,"admin");
  const commit=async(fingerprint:string)=>{
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    try{
      const result=await confirmAutomaticInitial(client,mission,item,scope,"admin",fingerprint);
      await client.query("COMMIT");return result;
    }catch(error){await client.query("ROLLBACK");throw error;}
  };
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const first=await plan();
  await client.query("COMMIT");
  assert.equal(first.summary.readyActions,1,"currently true is eligible for explicit initial processing");
  assert.equal(first.contacts[0].label,"Synthetic clinic");
  assert.equal((await client.query("SELECT count(*) FROM mission_status_list_automatic_events")).rows[0].count,"0");
  assert.equal((await client.query("SELECT count(*) FROM mission_status_list_automatic_states")).rows[0].count,"0");
  assert.equal((await background()).actions[0].status,"background_baseline","ordinary background remains no-effect");
  await assert.rejects(()=>commit(first.fingerprint),/preview_changed/,"changed evidence needs a fresh preview");
  const fresh=await plan();
  assert.equal(fresh.summary.readyActions,1,"existing true baseline is explicitly processable");
  assert.notEqual((await previewAutomaticInitial(client,mission,item,scope,"other-admin")).fingerprint,fresh.fingerprint);
  await client.query("UPDATE campaign_status_list_automations SET service_action_config=jsonb_set(service_action_config,'{title}','\"Changed\"')");
  await assert.rejects(()=>commit(fresh.fingerprint),/preview_changed/);
  const changedPlan=await plan();
  assert.deepEqual(await commit(changedPlan.fingerprint),{queued:1,deferred:0});
  await assert.rejects(()=>commit(changedPlan.fingerprint),/preview_changed/,"a repeated confirmation cannot replay");
  assert.equal((await plan()).summary.readyActions,0);
  assert.equal((await client.query("SELECT count(*) FROM mission_status_list_automatic_events")).rows[0].count,"1");
  await background();
  assert.equal((await client.query("SELECT count(*) FROM mission_status_list_automatic_events")).rows[0].count,"1","polling after initial processing cannot duplicate it");
  let initialDeliveries=0;
  const initialDeps={connect:deps.connect,execute:async(_action:any,input:any)=>{
    assert.equal(inTransaction,false);
    assert.equal(input.userId,"admin");
    initialDeliveries++;return {ok:true,executionId:"initial-receipt"};
  }};
  await runAutomaticEvents(initialDeps);
  await runAutomaticEvents(initialDeps);
  assert.equal(initialDeliveries,1);
  await client.query("UPDATE clinics SET country_code='CZ'");
  await background();
  await client.query("UPDATE clinics SET country_code='SK'");
  await background();
  assert.equal((await client.query("SELECT count(*) FROM mission_status_list_automatic_events")).rows[0].count,"2","future false->true still runs");
  await client.query("DELETE FROM mission_status_list_automatic_events");
  await client.query(`INSERT INTO status_list_service_executions VALUES('old-attempt',$1,$2,$3,'failed')`,[mission,contact,action]);
  assert.equal((await plan()).summary.readyActions,0,"even failed native attempts are not replayed");
  await client.query("DELETE FROM status_list_service_executions");
  await client.query("UPDATE campaigns SET settings='{\"statusListMode\":\"batch\"}'");
  await client.query("UPDATE campaign_status_list_automations SET question_id=$1,condition_field='answer',condition_value='yes'",[question]);
  const derivedPlan=await plan();
  assert.equal(derivedPlan.summary.readyActions,1,"system-owned answer can be explicitly initialized");
  assert.equal(derivedPlan.mode,"batch");
  assert.deepEqual(await commit(derivedPlan.fingerprint),{queued:0,deferred:1});
  await runAutomaticEvents(initialDeps);
  assert.equal(initialDeliveries,1,"Batch waits for the original Save flow");
  assert.equal((await plan()).summary.readyActions,0,"awaiting Batch is not admitted twice");
  await client.query("DELETE FROM mission_status_list_automatic_events");
  const otherContact=randomUUID();
  await client.query("INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id) VALUES($1,$2,'clinic',$3)",[otherContact,mission,clinic]);
  assert.equal((await previewAutomaticInitial(client,mission,item,{scope:"mission"},"admin")).summary.contacts,2);
  await assert.rejects(()=>previewAutomaticInitial(client,randomUUID(),item,scope,"admin"),/initial_config_inactive/);
  await assert.rejects(()=>previewAutomaticInitial(client,mission,item,{scope:"contact",contactId:randomUUID()},"admin"),/contact_not_found/);
  assert.throws(()=>initialScopeSchema.parse({scope:"contact"}));
  assert.throws(()=>initialScopeSchema.parse({scope:"mission",contactId:contact}));
  await client.query("INSERT INTO campaign_contacts(id,campaign_id) SELECT gen_random_uuid()::text,$1 FROM generate_series(1,500)",[mission]);
  await assert.rejects(()=>previewAutomaticInitial(client,mission,item,{scope:"mission"},"admin"),/scope_too_large/);
  await client.query("UPDATE mission_status_list_automatic_configs SET enabled=false");
  await assert.rejects(()=>plan(),/initial_config_inactive/);
  console.log("Initial-state DB: read-only bounded plans, stale/actor evidence, current true baseline, once-only worker, future transitions, native-attempt guard, system answers and Batch passed.");
  await client.query("DELETE FROM mission_status_list_automatic_events");
  await client.query("DELETE FROM mission_status_list_automatic_states");
  await client.query("DELETE FROM mission_status_list_sources");
  await client.query("UPDATE campaign_status_list_automations SET question_id=NULL,condition_field='always',condition_value=NULL");
  await client.query("UPDATE mission_status_list_automatic_configs SET trigger='pulse_open',enabled=true,background_execution='mission',revision=gen_random_uuid()::text");
  const pulse=await inspectAutomaticContact(client,mission,contact,item,{enqueue:true,trigger:"pulse_open",actorId:"agent"});
  assert.equal(pulse.actions[0].status,"batch_deferred","Pulse open respects Batch by default");
  await client.query("DELETE FROM mission_status_list_automatic_events");
  await client.query("UPDATE mission_status_list_automatic_configs SET trigger='background_change',background_execution='unattended',revision=gen_random_uuid()::text");
  assert.equal((await inspectAutomaticContact(client,mission,contact,item,{enqueue:true,trigger:"background_change"})).actions[0].status,"background_baseline");
  await client.query("UPDATE mission_status_list_automatic_states SET matched=false");
  const unattended=await inspectAutomaticContact(client,mission,contact,item,{enqueue:true,trigger:"background_change"});
  assert.equal(unattended.actions[0].status,"pending","explicit unattended background work does not wait for Batch save");
  assert.equal((await inspectAutomaticContact(client,mission,contact,item,{enqueue:true,trigger:"background_change"})).actions[0].status,"pending","repeat does not create another reservation");
  assert.equal(Number((await client.query("SELECT count(*) FROM mission_status_list_automatic_events")).rows[0].count),1);
  console.log("Status List automatic DB: Pulse-open scope, unattended Batch override, safe baseline and durable deduplication passed.");
  // The editor must distinguish a derived information answer from a plain heading.
  const derivedItem=randomUUID(),derivedQuestion=randomUUID(),heading=randomUUID(),option=randomUUID();
  await client.query(`INSERT INTO campaign_status_list_items(id,campaign_id,label,is_hidden,confirmation_type,parent_id)
    VALUES($1,$4,'Derived info',true,'info',null),($2,$4,'Plain heading',false,'info',null),
      ($3,$4,'Derived option',true,'info',$2)`,[derivedItem,heading,option,mission]);
  await client.query("INSERT INTO campaign_status_list_questions VALUES($1,$2,'System source')",[derivedQuestion,derivedItem]);
  await client.query(`INSERT INTO mission_status_list_sources(question_id,campaign_id)
    VALUES($1,$2)`,[derivedQuestion,mission]);
  await client.query(`INSERT INTO mission_status_list_option_sources(group_id,campaign_id)
    VALUES($1,$2)`,[heading,mission]);
  for(const sourceItem of [derivedItem,option]) await client.query(`INSERT INTO campaign_status_list_automations
    (id,status_list_item_id,action_type,service_action_config,service_action_owner_id)
    VALUES($1,$2,'notify_role',$3::jsonb,'owner')`,[randomUUID(),sourceItem,JSON.stringify(config)]);
  assert.equal((await automaticOverview(client,mission,derivedItem))?.item.systemSourceAnswer,true);
  assert.equal((await automaticOverview(client,mission,option))?.item.systemSourceAnswer,true);
  assert.equal((await automaticOverview(client,mission,heading))?.item.systemSourceAnswer,false);
  assert.equal((await automaticOverview(client,mission,derivedItem))?.config.trigger,"background_change");
  const pendingBefore=(await client.query("SELECT count(*)::int n FROM mission_status_list_automatic_events")).rows[0].n;
  const originalConnect=pool.connect;
  try {
    pool.connect=(async()=>Object.assign(Object.create(client),{query:client.query.bind(client),release:()=>{}})) as any;
    const payload={trigger:"background_change",enabled:true,backgroundExecution:"mission",expectedRevision:null,acknowledged:true};
    await saveAutomaticConfig(mission,derivedItem,payload);
    const saved=(await automaticOverview(client,mission,derivedItem))!.config;
    assert.equal(saved.enabled,true,"derived info can activate its background trigger");
    await saveAutomaticConfig(mission,derivedItem,{...payload,expectedRevision:saved.revision});
    assert.equal((await automaticOverview(client,mission,derivedItem))?.config.revision,saved.revision,
      "saving an unchanged trigger is idempotent and preserves its revision");
    await saveAutomaticConfig(mission,option,payload);
    await assert.rejects(()=>saveAutomaticConfig(mission,heading,payload),/agent_cannot_confirm/);
    await assert.rejects(()=>saveAutomaticConfig(mission,derivedItem,{...payload,trigger:"card_open",expectedRevision:saved.revision}),/agent_cannot_confirm/);
    assert.equal((await client.query("SELECT count(*)::int n FROM mission_status_list_automatic_events")).rows[0].n,pendingBefore,
      "activation and repeated saving never enqueue communication");
  }finally{pool.connect=originalConnect;}
  console.log("Automatic trigger saving: derived answers activate, headings stay blocked, unchanged saves preserve revision and enqueue no actions.");
} finally {
  await client.query("ROLLBACK").catch(()=>{});
  await client.query("SET search_path TO public");
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  client.release();
  await pool.end();
}
