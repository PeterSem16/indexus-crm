import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { STATUS_LIST_WORKFLOW_SCHEMA } from "./status-list-workflow-schema";
import { previewStatusListConfirmation } from "./status-list-confirmation-preview";

if(process.env.NODE_ENV==="production" || process.env.REPLIT_DEPLOYMENT)throw Error("Development test only");
const client=await pool.connect();
const schema=`sl_recap_test_${randomUUID().replaceAll("-","")}`;
const campaign=randomUUID(),contact=randomUUID(),step=randomUUID(),heading=randomUUID(),question=randomUUID(),target=randomUUID();
try {
  await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema},public;`);
  await client.query(`
    CREATE TABLE campaigns(id varchar PRIMARY KEY,settings jsonb,country_codes text[]);
    CREATE TABLE users(id varchar PRIMARY KEY);
    CREATE TABLE customers(id varchar PRIMARY KEY,country text,hospital_name text,clinic_id varchar);
    CREATE TABLE clinics(id varchar PRIMARY KEY,country_code text);
    CREATE TABLE hospitals(id varchar PRIMARY KEY,country_code text);
    CREATE TABLE campaign_contacts(id varchar PRIMARY KEY,campaign_id varchar,customer_id varchar,
      clinic_id varchar,hospital_id varchar,contact_type text,status text);
    CREATE TABLE campaign_status_list_items(id varchar PRIMARY KEY,campaign_id varchar,label text,
      confirmation_type text,is_hidden boolean DEFAULT false,parent_id varchar,sort_order integer DEFAULT 0,
      item_type text DEFAULT 'step',question_selection_mode text DEFAULT 'multiple');
    CREATE TABLE campaign_status_list_questions(id varchar PRIMARY KEY,item_id varchar,question_text text,
      field_type text DEFAULT 'checkbox',is_hidden boolean DEFAULT false,logic_operator text DEFAULT 'OR',
      group_name text,sort_order integer DEFAULT 0);
    CREATE TABLE campaign_status_list_automations(id varchar PRIMARY KEY,status_list_item_id varchar,
      question_id varchar,action_type text,condition_field text,condition_value text,condition_operator text,
      condition_json text,service_action_config jsonb,service_action_owner_id varchar,sort_order integer DEFAULT 0);
    CREATE TABLE campaign_contact_status_list_state(id varchar PRIMARY KEY,campaign_contact_id varchar,status_list_item_id varchar);
  `);
  await client.query(STATUS_LIST_WORKFLOW_SCHEMA);
  await client.query("INSERT INTO users(id) VALUES('agent')");
  await client.query(`INSERT INTO campaigns VALUES($1,'{"statusListMode":"batch"}','{SK}');`,[campaign]);
  await client.query("INSERT INTO campaign_contacts(id,campaign_id,contact_type) VALUES($1,$2,'customer')",[contact,campaign]);
  for(const [id,label,type] of [[step,"Question","checkbox"],[heading,"Heading","info"],[target,"Target","checkbox"]])
    await client.query("INSERT INTO campaign_status_list_items(id,campaign_id,label,confirmation_type) VALUES($1,$2,$3,$4)",[id,campaign,label,type]);
  await client.query("INSERT INTO campaign_status_list_questions(id,item_id,question_text,field_type) VALUES($1,$2,'Choice','yes_no')",[question,step]);
  const yesAction=randomUUID(),noAction=randomUUID(),rootAction=randomUUID();
  for(const [id,qId,field,value] of [[yesAction,question,"answer","yes"],[noAction,question,"answer","no"],[rootAction,null,"always",null]])
    await client.query(`INSERT INTO campaign_status_list_automations(id,status_list_item_id,question_id,action_type,condition_field,condition_value)
      VALUES($1,$2,$3,'assign_task',$4,$5)`,[id,step,qId,field,value]);
  const rule={name:"Choice branch",enabled:true,trigger:"agent_confirmation",source:{kind:"question",id:question},
    logic:"and",conditions:[{field:"answer",ref:{kind:"question",id:question},op:"equals",value:"yes"}],
    thenActions:[{type:"confirm_step",target:{kind:"item",id:target}}],
    elseActions:[{type:"unconfirm_step",target:{kind:"item",id:target}}]};
  await client.query("INSERT INTO mission_status_list_rules(campaign_id,definition,created_by) VALUES($1,$2::jsonb,'agent')",[campaign,JSON.stringify(rule)]);
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const plan=await previewStatusListConfirmation(client,campaign,contact,"agent",{changes:[{kind:"question",id:question,value:"yes"}]});
  assert.equal(plan.readOnly,true);
  assert.equal(plan.mode,"batch");
  assert.equal(plan.actions.find(action=>action.id===yesAction)?.condition,"matched");
  assert.equal(plan.actions.find(action=>action.id===noAction)?.condition,"not_matched");
  assert.equal(plan.actions.find(action=>action.branch==="then")?.condition,"matched");
  assert.equal(plan.actions.find(action=>action.branch==="else")?.condition,"not_matched");
  assert.equal(plan.actions.find(action=>action.branch==="then")?.targetLabel,"Target");
  const root=await previewStatusListConfirmation(client,campaign,contact,"agent",{changes:[{kind:"item",id:step,value:true}]});
  assert.deepEqual(root.actions.map(action=>action.id),[rootAction],"parent recap must not include every child service");
  const no=await previewStatusListConfirmation(client,campaign,contact,"agent",{changes:[{kind:"question",id:question,value:"no"}]});
  assert.equal(no.actions.find(action=>action.branch==="else")?.condition,"matched");
  assert.equal(no.actions.find(action=>action.id===noAction)?.condition,"matched");
  await assert.rejects(()=>previewStatusListConfirmation(client,campaign,contact,"agent",{changes:[{kind:"item",id:heading,value:true}]}),/invalid_source/);
  await assert.rejects(()=>previewStatusListConfirmation(client,randomUUID(),contact,"agent",{changes:[{kind:"item",id:step,value:true}]}),/contact_not_found/);
  for(const table of ["mission_status_list_answers","mission_status_list_rule_runs","campaign_contact_status_list_state","mission_status_list_automatic_events"])
    assert.equal(Number((await client.query(`SELECT count(*) FROM ${table}`)).rows[0].count),0,`preview must not write ${table}`);
  await client.query("COMMIT");
  await client.query(`INSERT INTO mission_status_list_answers(campaign_contact_id,question_id,value,updated_by)
    VALUES($1,$2,'"yes"'::jsonb,'agent')`,[contact,question]);
  await client.query("BEGIN READ ONLY");
  const manual=await previewStatusListConfirmation(client,campaign,contact,"agent",{
    changes:[{kind:"question",id:question,value:"yes"}],manualActionIds:[yesAction]});
  assert.deepEqual(manual.actions.map(action=>action.id),[yesAction],"manual run must not imply sibling rules execute");
  assert.equal((await previewStatusListConfirmation(client,campaign,contact,"agent",{
    changes:[{kind:"question",id:question,value:"yes"}]})).actions.length,0,"unchanged answer has no repeated confirmation actions");
  await client.query("COMMIT");
  console.log("Confirmation recap DB: real read-only transaction, future answer snapshot, THEN/ELSE, exact Mission, heading rejection and zero queued/executed actions passed.");
} finally {
  await client.query("ROLLBACK").catch(()=>{});
  await client.query("SET search_path TO public");
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  client.release();await pool.end();
}
