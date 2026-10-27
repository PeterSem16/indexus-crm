import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { STATUS_LIST_WORKFLOW_SCHEMA } from "./status-list-workflow-schema";
import { healthcareFacts, healthcareActionValid, saveHealthcareReview, createHealthcareSource, resetHealthcareCounter, loadHealthcareConditionFacts } from "./status-list-healthcare";
import { executeEvent } from "./status-list-workflow";
import { evaluateAutomationCondition } from "./condition-evaluator";
import { healthcarePolicySchema } from "../../shared/status-list-healthcare";
import { evaluateOptionSources } from "./status-list-option-source";
import { queueAutomaticSourceEvent, runAutomaticEvents } from "./status-list-automatic";
import { readActionReviews, confirmActionReview } from "./status-list-action-review";
import { reportTaskPhoneIssue, phoneIssueContext, verifyPhoneIssue, phoneIssueReader } from "./phone-issues";
import { publishPhoneIssueTransition } from "./phone-issue-routes";
import { drizzle } from "drizzle-orm/node-postgres";
if(process.env.NODE_ENV==="production"||process.env.REPLIT_DEPLOYMENT)throw Error("Development tests only");
const client=await pool.connect(),schema=`sl_healthcare_${randomUUID().replaceAll("-","")}`;
const mission=randomUUID(),contact=randomUUID(),clinic=randomUUID(),owner=randomUUID();
try {
  await client.query(`CREATE SCHEMA ${schema};SET search_path TO ${schema},public`);
  await client.query(`
    CREATE TABLE campaigns(id varchar PRIMARY KEY,name text,settings jsonb DEFAULT '{}',country_codes text[]);
    CREATE TABLE users(id varchar PRIMARY KEY,role text,is_active boolean,assigned_countries text[]);
    CREATE TABLE clinics(id varchar PRIMARY KEY,country_code text,phone text,phone2 text,phone3 text);
    CREATE TABLE hospitals(id varchar PRIMARY KEY,country_code text,phone text);
    CREATE TABLE collaborators(id varchar PRIMARY KEY,country_code text);
    CREATE TABLE customers(id varchar PRIMARY KEY,country text);
    CREATE TABLE campaign_contacts(id varchar PRIMARY KEY,campaign_id varchar,contact_type text,clinic_id varchar,
      hospital_id varchar,collaborator_id varchar,customer_id varchar,assigned_to varchar,status text,callback_date timestamptz,updated_at timestamptz);
    CREATE TABLE campaign_status_list_items(id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,campaign_id varchar,
      step_id text,label text,parent_id varchar,item_type text,confirmation_type text,question_selection_mode text,is_hidden boolean,
      sort_order int DEFAULT 0,tab text,updated_at timestamptz);
    CREATE TABLE campaign_status_list_questions(id varchar PRIMARY KEY,item_id varchar,question_text text,field_type text,
      is_hidden boolean,logic_operator text,sort_order int,group_name text);
    CREATE TABLE campaign_status_list_automations(id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,status_list_item_id varchar,
      question_id varchar,sort_order int DEFAULT 0,action_type text,service_action_config jsonb,service_action_owner_id varchar,
      callback_offset_days integer,callback_time text,callback_business_days_only boolean,callback_existing_policy text,
      condition_field text,condition_operator text,condition_value text,condition_json text);
    CREATE TABLE campaign_contact_status_list_state(id varchar DEFAULT gen_random_uuid()::text,campaign_contact_id varchar,status_list_item_id varchar,
      confirmed_by_user_id varchar,confirmed_at timestamptz DEFAULT now(),item_note text,note_updated_at timestamptz);
    CREATE TABLE call_logs(id varchar PRIMARY KEY,sip_call_id text,phone_number text,status text,started_at timestamptz,
      answered_at timestamptz,ended_at timestamptz,duration_seconds int,is_forwarded boolean,campaign_id varchar,campaign_contact_id varchar);
  `);
  await client.query(STATUS_LIST_WORKFLOW_SCHEMA);
  await client.query("INSERT INTO campaigns(id,name,country_codes) VALUES($1,'Healthcare test',ARRAY['SK'])",[mission]);
  await client.query("INSERT INTO users VALUES($1,'admin',true,ARRAY['SK'])",[owner]);
  await client.query("INSERT INTO clinics VALUES($1,'SK','+421900111222',null,null)",[clinic]);
  await client.query("INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id) VALUES($1,$2,'clinic',$3)",[contact,mission,clinic]);
  const installs=await Promise.all(Array.from({length:4},async()=>{
    const installer=await pool.connect();
    try {
      await installer.query(`SET search_path TO ${schema},public`);
      await installer.query("BEGIN");
      const result=await createHealthcareSource(installer,mission,owner);
      await installer.query("COMMIT");
      return result;
    }catch(error){await installer.query("ROLLBACK");throw error;}
    finally{await installer.query("SET search_path TO public");installer.release();}
  }));
  const target=installs[0];
  assert.equal(new Set(installs.map(source=>source.groupId)).size,1,"four simultaneous installations create ONE source");
  const group=target.groupId!,map=target.mapping!;
  const reused=await createHealthcareSource(client,mission,owner);
  assert.equal(reused.groupId,group,"repeated installation reuses existing source");
  assert.equal((await client.query(`SELECT count(*)::int n FROM mission_status_list_option_sources WHERE campaign_id=$1`,[mission])).rows[0].n,1);
  assert.equal((await client.query("SELECT count(*)::int n FROM campaign_status_list_items WHERE parent_id=$1",[group])).rows[0].n,7);
  const callback=(await client.query("SELECT * FROM campaign_status_list_automations WHERE action_type='set_callback'")).rows[0];
  assert.equal(callback.callback_offset_days,6);assert.equal(callback.callback_business_days_only,true);
  assert.equal(callback.execution_policy,"automatic");assert.equal(callback.callback_existing_policy,"keep_existing");
  assert.equal((await client.query("SELECT count(*)::int n FROM campaign_status_list_automations WHERE action_type='set_callback'")).rows[0].n,1);
  assert.equal((await healthcareFacts(client,mission,contact,group)).config.hidden,true);
  const action=randomUUID();
  await client.query(`INSERT INTO campaign_status_list_automations(id,status_list_item_id,action_type,service_action_owner_id,service_action_config,execution_policy)
    VALUES($1,$2,'notify_role',$3,$4::jsonb,'review')`,[action,map.unreached,owner,JSON.stringify({notificationActionVersion:2,title:"Review test",taskGroupId:"review-group"})]);
  const evaluate=async()=>{await client.query("BEGIN");try{
    const events=await evaluateOptionSources(client,contact);for(const e of events)await queueAutomaticSourceEvent(client,e);
    await client.query("COMMIT");return events;
  }catch(error){await client.query("ROLLBACK");throw error;}};
  assert.equal((await evaluate()).length,0,"first observation is baseline");
  const addCall=async(i:number,answered=false,forwarded=false)=>client.query(`INSERT INTO call_logs VALUES($1::varchar,$1::text,'+421900111222',$2,
    now()-interval '10 minutes'+$3*interval '10 seconds',CASE WHEN $4 THEN now()-interval '10 minutes'+$3*interval '10 seconds' END,
    now()-interval '10 minutes'+$3*interval '10 seconds'+interval '3 seconds',3,$5,$6,$7)`,
    [randomUUID(),answered?"completed":"no_answer",i,answered,forwarded,mission,contact]);
  await addCall(1);
  assert.equal((await evaluate()).length,1);
  assert.equal((await healthcareFacts(client,mission,contact,group)).state,"unreached");
  assert.equal((await client.query("SELECT state FROM mission_status_list_automatic_events WHERE automation_id=$1",[action])).rows[0].state,"awaiting_review");
  assert.equal((await evaluate()).length,0,"reopening does not duplicate");
  const reviews=await readActionReviews(client,mission,contact,owner);
  assert.equal(reviews.length,1);
  await assert.rejects(()=>confirmActionReview(client,mission,contact,owner,reviews[0].id,"a".repeat(64)));
  await confirmActionReview(client,mission,contact,owner,reviews[0].id,reviews[0].fingerprint);
  let executions=0,callbackExecutions=0,emailExecutions=0;
  const deps={connect:async()=>Object.assign(Object.create(client),{query:client.query.bind(client),release:()=>{}}),
    execute:async(a:any)=>{if(a.actionType==="set_callback")callbackExecutions++;else if(a.actionType==="send_email")emailExecutions++;else executions++;return {ok:true};}};
  await runAutomaticEvents(deps as any);await runAutomaticEvents(deps as any);await runAutomaticEvents(deps as any);
  assert.equal(executions,1,"reviewed action executes once");
  assert.equal(callbackExecutions,1,"automatic six-day callback executes once");
  await addCall(2);await evaluate();
  assert.equal((await readActionReviews(client,mission,contact,owner)).length,1,"next failed attempt has a new review");
  await addCall(3);await evaluate();
  assert.equal((await readActionReviews(client,mission,contact,owner)).length,1,"older attempt review is stale");
  const email=randomUUID();
  await client.query(`INSERT INTO campaign_status_list_automations(id,status_list_item_id,action_type,service_action_owner_id,service_action_config,execution_policy,condition_json)
    VALUES($1,$2,'send_email',$3,$4::jsonb,'automatic',$5)`,[email,map.unreachable,owner,JSON.stringify({
      emailActionVersion:2,senderMode:"system",to:"test@example.invalid",subject:"Five failed calls",body:"<p>Review contact</p>",
    }),JSON.stringify({logic:"AND",rules:[{field:"healthcare.state",op:"eq",value:"unreachable"},
      {field:"healthcare.failed_attempts",op:"gte",value:"5"}]})]);
  const ruleTarget=randomUUID(),ruleId=randomUUID();
  await client.query(`ALTER TABLE customers ADD COLUMN hospital_name text,ADD COLUMN clinic_id varchar`);
  await client.query(`INSERT INTO campaign_status_list_items
    (id,campaign_id,step_id,label,item_type,confirmation_type,question_selection_mode)
    VALUES($1,$2,'regular-target','Regular answer','step','checkbox','multiple')`,[ruleTarget,mission]);
  await client.query(`INSERT INTO mission_status_list_rules(id,campaign_id,created_by,definition) VALUES($1,$2,$3,$4::jsonb)`,[
    ruleId,mission,owner,JSON.stringify({name:"Five failures",enabled:true,source:{kind:"item",id:map.unreachable},sourceValue:true,
      trigger:"background_transition",logic:"and",conditions:[
        {field:"healthcare.state",op:"equals",value:"unreachable"},
        {field:"healthcare.failed_attempts",op:"gte",value:"5"},
      ],thenActions:[{type:"confirm_step",target:{kind:"item",id:ruleTarget}}],elseActions:[]}),
  ]);
  await addCall(4);await addCall(5);
  const fifthEvents=await evaluate();
  await client.query("BEGIN");
  try {for(const event of fifthEvents)await executeEvent(client,event);await client.query("COMMIT");}
  catch(error){await client.query("ROLLBACK");throw error;}
  assert.equal((await client.query("SELECT count(*)::int n FROM campaign_contact_status_list_state WHERE status_list_item_id=$1",[ruleTarget])).rows[0].n,1,
    "healthcare state and count can drive a regular answer through the rule engine");
  assert.equal((await client.query("SELECT count(*)::int n FROM mission_status_list_automatic_events WHERE automation_id=$1",[email])).rows[0].n,1,
    "the fifth failure enqueues one email action");
  const originalQuery=pool.query;
  try {
    pool.query=client.query.bind(client) as any;
    const ctx={campaignId:mission,campaignContactId:contact};
    assert.equal(await evaluateAutomationCondition({conditionJson:JSON.stringify({logic:"AND",rules:[
      {field:"healthcare.state",op:"eq",value:"unreachable"},{field:"healthcare.failed_attempts",op:"gte",value:"5"},
    ]})},ctx),true,"regular action conditions use the same healthcare facts");
    assert.equal(await evaluateAutomationCondition({conditionField:"healthcare.failed_attempts",conditionOperator:"gt",conditionValue:"5"},ctx),false);
    assert.equal(await evaluateAutomationCondition({conditionField:"healthcare.state",conditionOperator:"neq",conditionValue:"reachable"},{...ctx,campaignId:randomUUID()}),false,
      "another Mission never supplies healthcare facts");
    assert.equal(await evaluateAutomationCondition({conditionField:"healthcare.state",conditionOperator:"neq",conditionValue:"reachable"},{campaignId:mission}),false);
  }finally{pool.query=originalQuery;}
  await evaluate();
  assert.equal((await client.query("SELECT count(*)::int n FROM mission_status_list_automatic_events WHERE automation_id=$1",[email])).rows[0].n,1);
  // Each worker invocation claims only one event; older callback attempts are
  // ahead of the email in this fixture and must be drained as well.
  for(let i=0;i<6;i++)await runAutomaticEvents(deps as any);
  assert.equal(emailExecutions,1,"a conditional fifth-failure email executes once across worker retries");
  let fact=await healthcareFacts(client,mission,contact,group);
  assert.equal(fact.state,"unreachable");assert.equal(fact.substatus,"five_failed_attempts");
  assert.equal((await readActionReviews(client,mission,contact,owner)).length,0);
  const task={actionType:"assign_task"},row={campaign_id:mission,campaign_contact_id:contact,item_id:map.unreachable};
  assert.equal(await healthcareActionValid(client,row,task),true);
  await client.query("UPDATE clinics SET phone2='+421900333444' WHERE id=$1",[clinic]);
  assert.equal(await healthcareActionValid(client,row,task),false,"alternative phone prevents database task");
  await addCall(6,true,true);await evaluate();
  assert.notEqual((await healthcareFacts(client,mission,contact,group)).state,"reachable","forwarded caller Up is not proof");
  await addCall(7,true);await evaluate();
  fact=await healthcareFacts(client,mission,contact,group);assert.equal(fact.state,"reachable");
  await addCall(8);await evaluate();
  fact=await healthcareFacts(client,mission,contact,group);assert.equal(fact.state,"reachable","Reachable remains sticky");
  assert.equal((await loadHealthcareConditionFacts(client,mission,contact))?.state,"reachable");
  const original=(await client.query("SELECT phone FROM clinics WHERE id=$1",[clinic])).rows[0].phone;
  await saveHealthcareReview(client,mission,contact,group,owner,{
    expectedFingerprint:fact.fingerprint,state:"wrong_number",substatus:null,proposedContact:"",
  });
  fact=await healthcareFacts(client,mission,contact,group);
  await saveHealthcareReview(client,mission,contact,group,owner,{
    expectedFingerprint:fact.fingerprint,state:"wrong_number",substatus:null,proposedContact:"+421900555666",
  });
  fact=await healthcareFacts(client,mission,contact,group);assert.equal(fact.state,"wrong_number");
  assert.equal(fact.proposedContact,"+421900555666");
  assert.equal((await client.query("SELECT phone FROM clinics WHERE id=$1",[clinic])).rows[0].phone,original);
  await assert.rejects(()=>saveHealthcareReview(client,mission,contact,group,owner,{
    expectedFingerprint:"b".repeat(64),state:"automatic",substatus:null,proposedContact:"",
  }));
  // Use new call evidence so these checks do not depend on earlier sticky success.
  await client.query("DELETE FROM call_logs");
  await client.query("DELETE FROM mission_status_list_healthcare_reviews");
  await client.query("DELETE FROM mission_status_list_healthcare_counters");
  await client.query("DELETE FROM mission_status_list_option_source_state");
  await client.query("DELETE FROM mission_status_list_automatic_events");
  const custom=healthcarePolicySchema.parse({failedAttempts:2,minTalkSeconds:10});
  await client.query(`UPDATE mission_status_list_option_sources SET config=jsonb_set(config,'{policy}',$2::jsonb),
    revision=gen_random_uuid()::text WHERE group_id=$1`,[group,JSON.stringify(custom)]);
  await evaluate();
  const recentCall=async(talk:number|null)=>{
    const id=randomUUID();
    await client.query(`INSERT INTO call_logs(id,sip_call_id,phone_number,status,started_at,answered_at,ended_at,
      duration_seconds,is_forwarded,campaign_id,campaign_contact_id)
      VALUES($1::varchar,$1::text,$2,$3,clock_timestamp()-interval '20 seconds',
        CASE WHEN $4::int IS NOT NULL THEN clock_timestamp()-$4*interval '1 second' END,clock_timestamp(),$4,false,$5,$6)`,
    [id,original,talk===null?"no_answer":"completed",talk,mission,contact]);
    return id;
  };
  await recentCall(null);await evaluate();
  await recentCall(null);await evaluate();
  fact=await healthcareFacts(client,mission,contact,group);
  assert.equal(fact.failedAttempts,2);assert.equal(fact.state,"unreachable","custom threshold applies on server");
  await assert.rejects(()=>resetHealthcareCounter(client,mission,contact,group,owner,{expectedFingerprint:"b".repeat(64),reason:"Stale preview"}));
  await assert.rejects(()=>resetHealthcareCounter(client,mission,contact,group,owner,{expectedFingerprint:fact.fingerprint,reason:""}));
  await resetHealthcareCounter(client,mission,contact,group,owner,{expectedFingerprint:fact.fingerprint,reason:"Verified correction"});
  fact=await healthcareFacts(client,mission,contact,group);
  assert.equal(fact.failedAttempts,0);
  await recentCall(null);
  fact=await healthcareFacts(client,mission,contact,group);
  assert.equal(fact.failedAttempts,1,"only calls after reset count");
  await saveHealthcareReview(client,mission,contact,group,owner,{
    expectedFingerprint:fact.fingerprint,state:"long_term_absent",substatus:null,proposedContact:"",
  });
  assert.equal((await healthcareFacts(client,mission,contact,group)).failedAttempts,1,"absence preserves counter");
  await recentCall(12);
  fact=await healthcareFacts(client,mission,contact,group);
  assert.equal(fact.failedAttempts,0,"connection resets counter");assert.equal(fact.state,"reachable");
  // A true saved number correction resets at edit time, not at the next poll.
  await recentCall(null);
  assert.equal((await healthcareFacts(client,mission,contact,group)).failedAttempts,1);
  await client.query("UPDATE clinics SET phone='+421900123456' WHERE id=$1",[clinic]);
  assert.equal((await healthcareFacts(client,mission,contact,group)).failedAttempts,0);
  await recentCall(null);
  assert.equal((await healthcareFacts(client,mission,contact,group)).failedAttempts,1,"post-correction attempt survives delayed evaluation");
  await evaluate();
  assert.equal((await healthcareFacts(client,mission,contact,group)).failedAttempts,1);
  // Formatting-only changes are not corrections.
  await client.query("UPDATE clinics SET phone='+421 900 123 456' WHERE id=$1",[clinic]);
  assert.equal((await healthcareFacts(client,mission,contact,group)).failedAttempts,1);
  // Real task-origin evidence is independent of hidden agent-source controls.
  await client.query(`CREATE TABLE tasks(id varchar PRIMARY KEY,status text DEFAULT 'open')`);
  await client.query(`ALTER TABLE call_logs ADD COLUMN user_id text`);
  await client.query(`UPDATE mission_status_list_option_sources SET config=jsonb_set(config,'{policy}',$2::jsonb)
    WHERE group_id=$1`,[group,JSON.stringify(healthcarePolicySchema.parse({}))]);
  const report=async(reason="wrong_person",expectedNumber="+421900123456")=>{
    const taskId=randomUUID();
    return drizzle(client).transaction(async tx=>{
      const reader=phoneIssueReader(tx);
      await reader.query("INSERT INTO tasks(id) VALUES($1)",[taskId]);
      await reportTaskPhoneIssue(reader,{id:taskId},{missionId:mission,entityType:"clinic",entityId:clinic,actorId:owner,
        issue:{reason,phoneField:"phone",expectedNumber}});
      if(reason!=="verify") await publishPhoneIssueTransition(reader,contact);
      return taskId;
    });
  };
  const initialTasks=(await client.query("SELECT count(*)::int n FROM tasks")).rows[0].n;
  await assert.rejects(()=>report("wrong_person","+421000000000"),/phone_issue_stale/);
  assert.equal((await client.query("SELECT count(*)::int n FROM tasks")).rows[0].n,initialTasks,"a rejected report rolls back its task");
  const reportTask=await report();
  assert.equal((await healthcareFacts(client,mission,contact,group)).state,"wrong_number","a task reports Wrong number even with the source hidden");
  assert.equal((await healthcareFacts(client,mission,contact,group)).config.hidden,true);
  await assert.rejects(()=>report(),/phone_issue_already_reported/);
  assert.equal((await client.query("SELECT count(*)::int n FROM tasks")).rows[0].n,initialTasks+1,"retry cannot create a duplicate task");
  await recentCall(20);
  assert.equal((await healthcareFacts(client,mission,contact,group)).state,"wrong_number","technical connection cannot override reported wrong number");
  assert.equal(await healthcareActionValid(client,{...row,item_id:map.wrong_number},{actionType:"assign_task"}),false,
    "the source automation must not create a copy of the agent's existing task");
  await client.query("UPDATE tasks SET status='resolved' WHERE id=$1",[reportTask]);
  assert.equal((await healthcareFacts(client,mission,contact,group)).state,"wrong_number","resolving a task is not a phone correction");
  await client.query("UPDATE clinics SET phone2='+421900999888' WHERE id=$1",[clinic]);
  assert.equal((await healthcareFacts(client,mission,contact,group)).state,"wrong_number","editing another field cannot clear the report");
  await client.query("UPDATE clinics SET phone='+421 900 123 456' WHERE id=$1",[clinic]);
  assert.equal((await healthcareFacts(client,mission,contact,group)).state,"wrong_number","formatting is not correction");
  await client.query("UPDATE clinics SET phone='+421900777666' WHERE id=$1",[clinic]);
  assert.equal((await healthcareFacts(client,mission,contact,group)).state,"not_defined","the corrected number awaits human verification");
  assert.equal((await healthcareFacts(client,mission,contact,group)).failedAttempts,0);
  let context=await phoneIssueContext(client,mission,"clinic",clinic,owner);
  assert.equal(context.pendingVerification?.callId,null,"historic success cannot verify the corrected number");
  await client.query("UPDATE mission_phone_issues SET corrected_at=clock_timestamp()-interval '1 minute' WHERE task_id=$1",[reportTask]);
  const verifiedCall=randomUUID();
  await client.query(`INSERT INTO call_logs(id,sip_call_id,phone_number,status,started_at,answered_at,ended_at,duration_seconds,is_forwarded,campaign_id,campaign_contact_id,user_id)
    VALUES($1::varchar,$1::text,'+421900777666','completed',clock_timestamp()-interval '20 seconds',clock_timestamp()-interval '15 seconds',
    clock_timestamp()-interval '10 seconds',5,false,$2,$3,$4)`,[verifiedCall,mission,contact,owner]);
  assert.equal((await healthcareFacts(client,mission,contact,group)).state,"not_defined","even a new valid call requires explicit confirmation");
  assert.equal((await phoneIssueContext(client,mission,"clinic",clinic,"another-agent")).pendingVerification?.callId,null);
  context=await phoneIssueContext(client,mission,"clinic",clinic,owner);
  assert.equal(context.pendingVerification?.callId,verifiedCall);
  await assert.rejects(()=>phoneIssueContext(client,randomUUID(),"clinic",clinic,owner),/phone_issue_invalid/);
  await assert.rejects(()=>phoneIssueContext(client,mission,"hospital",clinic,owner),/phone_issue_invalid/);
  await client.query("UPDATE call_logs SET is_forwarded=true WHERE id=$1",[verifiedCall]);
  assert.equal((await phoneIssueContext(client,mission,"clinic",clinic,owner)).pendingVerification?.callId,null,"forwarding is not verification evidence");
  await client.query("UPDATE call_logs SET is_forwarded=false WHERE id=$1",[verifiedCall]);
  await client.query(`INSERT INTO mission_status_list_healthcare_call_reviews(campaign_contact_id,group_id,call_key,actor_id)
    VALUES($1,$2,$3,$4)`,[contact,group,verifiedCall,owner]);
  assert.equal((await phoneIssueContext(client,mission,"clinic",clinic,owner)).pendingVerification?.callId,null,"voicemail cannot verify a provider");
  await client.query("DELETE FROM mission_status_list_healthcare_call_reviews WHERE call_key=$1",[verifiedCall]);
  const verifyBody={issueId:context.pendingVerification!.issueId,callId:verifiedCall,expectedNumber:"+421900777666"};
  await assert.rejects(()=>verifyPhoneIssue(client,mission,"clinic",clinic,owner,{...verifyBody,callId:randomUUID()}),/phone_issue_stale/);
  await assert.rejects(()=>verifyPhoneIssue(client,mission,"clinic",clinic,owner,{...verifyBody,expectedNumber:"+421900000000"}),/phone_issue_stale/);
  await client.query("BEGIN");
  try {await verifyPhoneIssue(client,mission,"clinic",clinic,owner,verifyBody);await client.query("COMMIT");}
  catch(error){await client.query("ROLLBACK");throw error;}
  assert.equal((await healthcareFacts(client,mission,contact,group)).state,"reachable");
  assert.equal((await phoneIssueContext(client,mission,"clinic",clinic,owner)).pendingVerification,null);
  await assert.rejects(()=>verifyPhoneIssue(client,mission,"clinic",clinic,owner,verifyBody),/phone_issue_stale/);
  await report("not_working","+421900777666");
  assert.equal((await healthcareFacts(client,mission,contact,group)).state,"not_working");
  const issueCount=(await client.query("SELECT count(*)::int n FROM mission_phone_issues")).rows[0].n;
  await report("verify","+421900777666");
  assert.equal((await client.query("SELECT count(*)::int n FROM mission_phone_issues")).rows[0].n,issueCount,"verify-only request does not manufacture a state");
  assert.equal((await healthcareFacts(client,mission,contact,group)).state,"not_working");
  const disabled=healthcarePolicySchema.parse({enabled:{wrong_number:false,reachable:false}});
  await client.query(`UPDATE mission_status_list_option_sources SET config=jsonb_set(config,'{policy}',$2::jsonb),
    revision=gen_random_uuid()::text WHERE group_id=$1`,[group,JSON.stringify(disabled)]);
  fact=await healthcareFacts(client,mission,contact,group);
  await assert.rejects(()=>saveHealthcareReview(client,mission,contact,group,owner,{
    expectedFingerprint:fact.fingerprint,state:"wrong_number",substatus:null,proposedContact:"Proposed number",
  }));
  assert.equal(await healthcareActionValid(client,{...row,item_id:map.reachable},task),false,"disabled state blocks old queued actions");
  assert.equal((await client.query(`SELECT count(*)::int AS n FROM mission_status_list_healthcare_audit
    WHERE value->>'counterReset'='true'`)).rows[0].n>=2,true,"manual and correction resets are audited");
  console.log("Healthcare database: concurrent singleton creation, unified rule/action conditions, fifth-failure email once, baseline, transitions, review, stale attempts, alternate phones, sticky success and D-25 passed");
}finally {
  await client.query("ROLLBACK").catch(()=>{});
  await client.query("SET search_path TO public");
  await client.query(`DROP SCHEMA ${schema} CASCADE`);
  client.release();await pool.end();
}
