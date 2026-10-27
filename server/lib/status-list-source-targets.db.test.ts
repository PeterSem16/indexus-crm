import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createStatusListSourceTarget } from "./status-list-source-targets";
import { workflowCatalog } from "./status-list-workflow";
import { createConfiguredBackgroundSource } from "./status-list-background";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development test only");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const schema = `source_target_${randomUUID().replaceAll("-", "")}`;
  await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema}`);
  await client.query(`
    CREATE TABLE campaign_status_list_items(
      id varchar PRIMARY KEY,campaign_id varchar,step_id text,label text,parent_id varchar,
      confirmation_type text,item_type text,question_selection_mode text,is_hidden boolean DEFAULT false,
      sort_order int,canonical_clinic_status_key text);
    CREATE TABLE campaign_status_list_questions(
      id varchar PRIMARY KEY,item_id varchar,question_text text,field_type text,is_hidden boolean,
      logic_operator text,sort_order int,group_name text,updated_at timestamptz DEFAULT now());
    CREATE TABLE mission_status_list_sources(question_id varchar PRIMARY KEY,source text,campaign_id varchar,
      show_information boolean DEFAULT false,revision varchar DEFAULT gen_random_uuid()::text,
      check_revision varchar DEFAULT gen_random_uuid()::text,check_config jsonb);
    CREATE TABLE mission_status_list_option_sources(group_id varchar,config jsonb,campaign_id varchar);
    CREATE TABLE campaigns(id varchar PRIMARY KEY,country_codes text[]);
    CREATE TABLE users(id varchar PRIMARY KEY,role text,assigned_countries text[],is_active boolean);
    CREATE TABLE campaign_status_list_automations(id varchar,status_list_item_id varchar,question_id varchar,
      action_type text,service_action_config jsonb,service_action_owner_id varchar,condition_field text,
      condition_operator text,condition_value text,condition_json text,sort_order int);
  `);
  const campaignId=randomUUID(),itemId=randomUUID();
  await client.query(`INSERT INTO campaign_status_list_items
    (id,campaign_id,step_id,label,confirmation_type,item_type,question_selection_mode,sort_order,canonical_clinic_status_key)
    VALUES($1,$2,'STEP','Original step','checkbox','step','multiple',0,'assignment_rep_unassigned')`,[itemId,campaignId]);
  const before=(await client.query("SELECT * FROM campaign_status_list_items WHERE id=$1",[itemId])).rows[0];
  await client.query("INSERT INTO campaigns VALUES($1,ARRAY['SK'])",[campaignId]);
  assert.equal((await workflowCatalog(campaignId,client)).find(row=>row.id===itemId)?.systemSourceEligible,true);
  const target=await createStatusListSourceTarget(client,campaignId,{
    source:"representative_assigned",parentId:itemId,label:"Coordinator check",
  });
  assert.equal(target.itemId,itemId);
  const question=(await client.query("SELECT * FROM campaign_status_list_questions WHERE id=$1",[target.questionId])).rows[0];
  assert.equal(question.item_id,itemId);
  assert.equal(question.field_type,"yes_no");
  assert.equal(question.is_hidden,true);
  assert.equal(question.logic_operator,"OR");
  assert.deepEqual((await client.query("SELECT * FROM campaign_status_list_items WHERE id=$1",[itemId])).rows[0],before);
  assert.equal((await client.query("SELECT count(*)::int AS count FROM mission_status_list_sources")).rows[0].count,0,
    "Creating the question must not enable a source or run actions");
  assert.equal((await workflowCatalog(campaignId,client)).find(row=>row.id===target.questionId)?.systemSourceEligible,true);
  for(const [confirmation,selection] of [["auto","multiple"],["checkbox","single"]]){
    await client.query("UPDATE campaign_status_list_items SET confirmation_type=$2,question_selection_mode=$3 WHERE id=$1",
      [itemId,confirmation,selection]);
    assert.equal((await workflowCatalog(campaignId,client)).find(row=>row.id===itemId)?.systemSourceEligible,false);
    await assert.rejects(()=>createStatusListSourceTarget(client,campaignId,{
      source:"representative_assigned",parentId:itemId,label:"Must not create",
    }),/incompatible_source_parent/);
  }
  await client.query("UPDATE campaign_status_list_items SET confirmation_type='checkbox',question_selection_mode='multiple' WHERE id=$1",[itemId]);
  const input={parentId:itemId,label:"Automatic coordinator check",config:{
    source:"representative_assigned",hidden:true,showInformation:true,
    check:{enabled:true,trigger:"pulse_open",behavior:"confirm"},
  }};
  const saved=await createConfiguredBackgroundSource(client,campaignId,input);
  const source=(await client.query("SELECT * FROM mission_status_list_sources WHERE question_id=$1",[saved.questionId])).rows[0];
  assert.deepEqual(source.check_config,input.config.check);
  assert.equal(source.show_information,true);
  assert.deepEqual((await client.query("SELECT * FROM campaign_status_list_items WHERE id=$1",[itemId])).rows[0],before);
  const questionCount=(await client.query("SELECT count(*)::int AS n FROM campaign_status_list_questions")).rows[0].n;
  await client.query("SAVEPOINT failed_creation");
  await client.query(`CREATE FUNCTION reject_source_save() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'test_save_failure'; END $$;
    CREATE TRIGGER reject_save BEFORE INSERT ON mission_status_list_sources
    FOR EACH ROW EXECUTE FUNCTION reject_source_save()`);
  await assert.rejects(()=>createConfiguredBackgroundSource(client,campaignId,input),/test_save_failure/);
  await client.query("ROLLBACK TO SAVEPOINT failed_creation");
  assert.equal((await client.query("SELECT count(*)::int AS n FROM campaign_status_list_questions")).rows[0].n,questionCount,
    "A failed configuration must not leave its newly-created hidden question behind");
  console.log("Source target DB: empty-step eligibility, atomic create+configure, rollback on save failure, canonical result preservation and incompatible-parent guards passed");
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
