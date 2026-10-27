import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { evaluateHealthcare, healthcareLabels, healthcareReviewSchema, healthcarePolicySchema, healthcareStates, type HealthcareState, type HealthcareCall } from "../../shared/status-list-healthcare";
import { z } from "zod";
import { StatusListWorkflowError } from "./status-list-workflow";
import { createStatusListSourceTarget } from "./status-list-source-targets";
import type { HealthcareConditionFacts } from "../../shared/status-list-healthcare-conditions";

type Reader=Pick<PoolClient,"query">;
/** Canonical Mission/contact scope shared by regular rules and action conditions.
 * A missing, ambiguous, unsupported or paused source is not a negative state. */
export async function loadHealthcareConditionFacts(client:Reader,campaignId?:string|null,contactId?:string|null):Promise<HealthcareConditionFacts|null> {
  if(!campaignId || !contactId)return null;
  const sources=(await client.query(`SELECT s.group_id FROM mission_status_list_option_sources s
    JOIN campaign_contacts cc ON cc.campaign_id=s.campaign_id
    WHERE s.campaign_id=$1 AND cc.id=$2 AND cc.contact_type IN ('clinic','hospital')
      AND s.config->>'source'='healthcare_reachability' ORDER BY s.group_id LIMIT 2`,[campaignId,contactId])).rows;
  if(sources.length!==1)return null;
  const facts=await healthcareFacts(client,campaignId,contactId,sources[0].group_id);
  return facts.active && !facts.held ? {state:facts.state,failedAttempts:facts.failedAttempts} : null;
}
/** Definition-only install under the caller's manager-authorized transaction.
 * Existing contacts establish a baseline; no historic effects are replayed. */
export async function createHealthcareSource(client:Reader,campaignId:string,actorId:string) {
  // Serialize installation with all Mission source configuration writes.
  // Retrying/double-clicking must never create another set of seven answers
  // and another callback automation.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`mission-workflow-config:${campaignId}`]);
  const existing=(await client.query(`SELECT s.group_id,s.config FROM mission_status_list_option_sources s
    JOIN campaign_status_list_items i ON i.id=s.group_id
    WHERE s.campaign_id=$1 AND s.config->>'source'='healthcare_reachability'
    ORDER BY i.sort_order,i.id LIMIT 1`,[campaignId])).rows[0];
  if(existing)return {...existing.config,groupId:existing.group_id};
  const target=await createStatusListSourceTarget(client,campaignId,{
    source:"healthcare_reachability",label:"Contacted healthcare provider — reachable at least once or always unreachable",options:healthcareLabels,
  });
  const config={source:"healthcare_reachability" as const,hidden:true,mapping:target.mapping!};
  await client.query(`INSERT INTO mission_status_list_option_sources(campaign_id,group_id,config)
    VALUES($1,$2,$3::jsonb)`,[campaignId,target.groupId,JSON.stringify(config)]);
  for(const itemId of Object.values(target.mapping!)) await client.query(`INSERT INTO mission_status_list_automatic_configs
    (campaign_id,item_id,trigger,enabled) VALUES($1,$2,'background_change',true)`,[campaignId,itemId]);
  await client.query(`INSERT INTO campaign_status_list_automations
    (status_list_item_id,action_type,service_action_config,service_action_owner_id,execution_policy,
     callback_offset_days,callback_time,callback_business_days_only,callback_existing_policy)
    VALUES($1,'set_callback','{}'::jsonb,$2,'automatic',6,'09:00',true,'keep_existing')`,
  [target.mapping!.unreached,actorId]);
  return {...config,groupId:target.groupId!};
}
export async function healthcareFacts(client:Reader, campaignId:string, contactId:string, groupId:string) {
  const source=(await client.query(`SELECT s.config,s.revision,i.label,i.is_hidden AS group_hidden FROM mission_status_list_option_sources s
    JOIN campaign_status_list_items i ON i.id=s.group_id WHERE s.campaign_id=$1 AND s.group_id=$2
    AND s.config->>'source'='healthcare_reachability'`,[campaignId,groupId])).rows[0];
  if(!source) throw new StatusListWorkflowError("source_not_found",404);
  const contact=(await client.query(`SELECT cc.contact_type,
    CASE cc.contact_type WHEN 'clinic' THEN jsonb_build_array(cl.phone,cl.phone2,cl.phone3)
      WHEN 'hospital' THEN jsonb_build_array(h.phone) ELSE '[]'::jsonb END AS phones
    FROM campaign_contacts cc LEFT JOIN clinics cl ON cc.contact_type='clinic' AND cl.id=cc.clinic_id
    LEFT JOIN hospitals h ON cc.contact_type='hospital' AND h.id=cc.hospital_id
    WHERE cc.id=$1 AND cc.campaign_id=$2`,[contactId,campaignId])).rows[0];
  if(!contact || !["clinic","hospital"].includes(contact.contact_type)) throw new StatusListWorkflowError("unsupported_contact_type",409);
  const rows=(await client.query(`SELECT id,sip_call_id,phone_number,status,started_at,answered_at,ended_at,
    duration_seconds,is_forwarded FROM call_logs WHERE campaign_id=$1 AND campaign_contact_id=$2 ORDER BY started_at,id`,
  [campaignId,contactId])).rows;
  const calls:HealthcareCall[]=rows.map(c=>({
    id:c.id,key:c.sip_call_id||c.id,at:new Date(c.ended_at||c.started_at).getTime(),ended:!!c.ended_at,
    answered:!c.is_forwarded && !!c.answered_at && ["answered","completed"].includes(c.status),
    talkSeconds:c.answered_at && c.ended_at ? Math.max(0,
      (new Date(c.ended_at).getTime()-new Date(c.answered_at).getTime())/1000) : 0,
    failed:["failed","no_answer","busy","cancelled"].includes(c.status) ||
      c.status==="completed" && !c.answered_at,
  }));
  const review=(await client.query(`SELECT state,substatus,proposed_contact,updated_at FROM mission_status_list_healthcare_reviews
    WHERE campaign_contact_id=$1 AND group_id=$2`,[contactId,groupId])).rows[0];
  const voicemails=(await client.query(`SELECT call_key FROM mission_status_list_healthcare_call_reviews
    WHERE campaign_contact_id=$1 AND group_id=$2 ORDER BY call_key`,[contactId,groupId])).rows.map(r=>r.call_key);
  const normalize=(s:unknown)=>String(s||"").replace(/\D/g,"").replace(/^00/,"");
  const numbers=Array.from(new Set<string>((contact.phones||[]).map(normalize).filter((s:string)=>s.length>=6))).sort();
  const counter=(await client.query(`SELECT phones,reset_at FROM mission_status_list_healthcare_counters
    WHERE campaign_contact_id=$1 AND group_id=$2`,[contactId,groupId])).rows[0];
  const phoneChanged=!!counter && JSON.stringify(counter.phones)!==JSON.stringify(numbers);
  const previous=(await client.query(`SELECT value FROM mission_status_list_option_source_state
    WHERE campaign_contact_id=$1 AND group_id=$2`,[contactId,groupId])).rows[0]?.value?.split(":")[0];
  const policy=healthcarePolicySchema.parse(source.config.policy||{});
  const issue=(await client.query(`SELECT * FROM (
    SELECT DISTINCT ON(phone_field) * FROM mission_phone_issues WHERE campaign_contact_id=$1 AND group_id=$2
    ORDER BY phone_field,created_at DESC,id DESC) current_issues
    ORDER BY CASE status WHEN 'reported' THEN 0 WHEN 'awaiting_verification' THEN 1 ELSE 2 END,created_at DESC LIMIT 1`,
  [contactId,groupId])).rows[0];
  const issueBoundary=issue ? new Date(issue.corrected_at || issue.created_at).getTime() : 0;
  const scopedCalls=issue ? calls.filter(call=>{
    const row=rows.find(r=>r.id===call.id);
    return normalize(row?.phone_number)===issue.current_number && new Date(row?.started_at || 0).getTime()>=issueBoundary;
  }) : calls;
  let result=evaluateHealthcare(scopedCalls,new Set(voicemails),{state:review?.state,at:review ? new Date(review.updated_at).getTime() : 0},
    policy,healthcareStates.includes(previous) ? previous as HealthcareState : undefined,
    phoneChanged ? Date.now() : counter?.reset_at ? new Date(counter.reset_at).getTime() : 0);
  if(issue) {
    const candidate=issue.status==="reported" ? issue.reason==="wrong_person" ? "wrong_number" : "not_working"
      : issue.status==="verified" && issue.verified_call_id ? "reachable" : "not_defined";
    const allowed=policy.enabled[candidate];
    result={...result,state:allowed ? candidate : result.state,held:!allowed,active:allowed};
  }
  const lastNumber=normalize(rows.find(r=>r.id===result.lastAttempt?.id)?.phone_number)||numbers[0];
  const hasAlternativePhone=numbers.some(n=>n!==lastNumber);
  const fingerprint=createHash("sha256").update(JSON.stringify({revision:source.revision,calls,review,voicemails,numbers,counter,previous,issue})).digest("hex");
  return {...result, groupId,label:source.label,config:{...source.config,policy,hidden:source.config.hidden!==false || source.group_hidden===true},revision:source.revision,fingerprint,
    counterPhones:numbers,phoneChanged,
    hasAlternativePhone,manualState:result.state===review?.state ? review.state : "automatic",proposedContact:review?.proposed_contact||"",
    phoneIssue:issue ? {id:issue.id,taskId:issue.task_id,status:issue.status} : null,
    substatus:result.state==="unreachable" ? review?.substatus||"five_failed_attempts" : null};
}

/** Only called inside the contact workflow transaction. A saved phone correction
 * is a counter boundary; reads never mutate history or manufacture call events. */
export async function evaluateHealthcareFacts(client:Reader,campaignId:string,contactId:string,groupId:string) {
  const before=await healthcareFacts(client,campaignId,contactId,groupId);
  await client.query(`INSERT INTO mission_status_list_healthcare_counters(campaign_contact_id,group_id,phones)
    VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING`,[contactId,groupId,JSON.stringify(before.counterPhones)]);
  if(before.phoneChanged) {
    await client.query(`UPDATE mission_status_list_healthcare_counters SET phones=$3::jsonb,reset_at=clock_timestamp()
      WHERE campaign_contact_id=$1 AND group_id=$2`,[contactId,groupId,JSON.stringify(before.counterPhones)]);
    await client.query(`INSERT INTO mission_status_list_healthcare_audit(campaign_contact_id,group_id,actor_id,previous,value)
      VALUES($1,$2,'system:phone-correction',$3::jsonb,$4::jsonb)`,[contactId,groupId,
      JSON.stringify({failedAttempts:before.failedAttempts}),JSON.stringify({counterReset:true,reason:"phone_corrected"})]);
    // A corrected number is no longer the previously reviewed wrong/broken number.
    await client.query(`UPDATE mission_status_list_healthcare_reviews SET state='automatic',substatus=null,
      updated_at=clock_timestamp() WHERE campaign_contact_id=$1 AND group_id=$2 AND state IN ('wrong_number','not_working','unreachable')`,
    [contactId,groupId]);
  }
  return healthcareFacts(client,campaignId,contactId,groupId);
}

export const healthcareCounterResetSchema=z.object({
  expectedFingerprint:z.string().length(64),reason:z.string().trim().min(3).max(500),
}).strict();
export async function resetHealthcareCounter(client:Reader,campaignId:string,contactId:string,groupId:string,actorId:string,raw:unknown) {
  const body=healthcareCounterResetSchema.parse(raw);
  const before=await healthcareFacts(client,campaignId,contactId,groupId);
  if(before.fingerprint!==body.expectedFingerprint) throw new StatusListWorkflowError("preview_changed",409);
  await client.query(`INSERT INTO mission_status_list_healthcare_counters(campaign_contact_id,group_id,phones,reset_at)
    VALUES($1,$2,$3::jsonb,clock_timestamp()) ON CONFLICT(campaign_contact_id,group_id) DO UPDATE SET
    phones=EXCLUDED.phones,reset_at=EXCLUDED.reset_at`,[contactId,groupId,JSON.stringify(before.counterPhones)]);
  await client.query(`INSERT INTO mission_status_list_healthcare_audit(campaign_contact_id,group_id,actor_id,previous,value)
    VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`,[contactId,groupId,actorId,
    JSON.stringify({failedAttempts:before.failedAttempts}),JSON.stringify({counterReset:true,reason:body.reason})]);
  await client.query(`UPDATE mission_status_list_healthcare_reviews SET state='automatic',substatus=null,updated_at=clock_timestamp()
    WHERE campaign_contact_id=$1 AND group_id=$2 AND state='unreachable' AND substatus='five_failed_attempts'`,[contactId,groupId]);
}

export async function saveHealthcareReview(client:PoolClient, campaignId:string, contactId:string, groupId:string, actorId:string, raw:unknown) {
  const body=healthcareReviewSchema.parse(raw);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`mission-workflow:${contactId}`]);
  const before=await healthcareFacts(client,campaignId,contactId,groupId);
  if(before.fingerprint!==body.expectedFingerprint) throw new StatusListWorkflowError("preview_changed",409);
  if(body.state!=="automatic" && !before.config.policy.enabled[body.state])
    throw new StatusListWorkflowError("healthcare_state_disabled",409);
  if(body.state==="unreachable" && !body.substatus) throw new StatusListWorkflowError("substatus_required",400);
  if(body.state==="unreachable" && body.substatus==="five_failed_attempts" && before.failedAttempts<before.config.policy.failedAttempts)
    throw new StatusListWorkflowError("insufficient_failed_attempts",400);
  if(body.voicemailCallId) {
    // Only the latest exact-call connection may be reviewed as voicemail.
    if(before.lastAttempt?.id!==body.voicemailCallId || !before.lastAttempt.answered)
      throw new StatusListWorkflowError("preview_changed",409);
    await client.query(`INSERT INTO mission_status_list_healthcare_call_reviews(campaign_contact_id,group_id,call_key,actor_id)
      VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[contactId,groupId,before.lastAttempt.key,actorId]);
  }
  await client.query(`INSERT INTO mission_status_list_healthcare_reviews(campaign_contact_id,group_id,state,substatus,proposed_contact,actor_id)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(campaign_contact_id,group_id) DO UPDATE SET
    state=EXCLUDED.state,substatus=EXCLUDED.substatus,proposed_contact=EXCLUDED.proposed_contact,
    actor_id=EXCLUDED.actor_id,updated_at=clock_timestamp()`,[contactId,groupId,body.state,body.substatus,body.proposedContact,actorId]);
  await client.query(`INSERT INTO mission_status_list_healthcare_audit(campaign_contact_id,group_id,actor_id,previous,value)
    VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`,[contactId,groupId,actorId,
    JSON.stringify({state:before.manualState,substatus:before.substatus,proposedContact:before.proposedContact}),
    JSON.stringify({state:body.state,substatus:body.substatus,proposedContact:body.proposedContact,voicemailCallId:body.voicemailCallId})]);
}

/** Shared by review and worker: stale source answers must not send effects. */
export async function healthcareActionValid(client:Reader, row:any, action:any) {
  const source=(await client.query(`SELECT group_id,to_jsonb(s)->'config' AS config FROM mission_status_list_option_sources s
    WHERE campaign_id=$1 AND to_jsonb(s)->'config'->>'source'='healthcare_reachability'`,[row.campaign_id])).rows
    .find(s=>Object.values(s.config.mapping).includes(row.item_id));
  if(!source) return true;
  const facts=await healthcareFacts(client,row.campaign_id,row.campaign_contact_id,source.group_id);
  if(!facts.active || facts.held || !facts.config.policy.enabled[facts.state]) return false;
  if(action.actionType==="assign_task" && facts.phoneIssue?.status==="reported"
    && ["wrong_number","not_working"].includes(facts.state)) return false;
  if(facts.config.mapping[facts.state]!==row.item_id) return false;
  if(facts.state==="unreached" && row.event_context?.sourceEventId) {
    const transition=(await client.query(`SELECT value FROM mission_status_list_transitions
      WHERE 'transition:'||id=$1 AND campaign_id=$2 AND campaign_contact_id=$3`,
    [row.event_context.sourceEventId,row.campaign_id,row.campaign_contact_id])).rows[0];
    if(transition?.value!==`unreached:${facts.lastAttempt?.key}`) return false;
  }
  return !(action.actionType==="assign_task" && ["unreachable","not_working"].includes(facts.state) && facts.hasAlternativePhone);
}
