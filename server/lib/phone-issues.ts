import { sql } from "drizzle-orm";
import { z } from "zod";
import { StatusListWorkflowError } from "./status-list-workflow";
import { healthcareFacts } from "./status-list-healthcare";
import { callbackBarrier } from "./status-list-service";

export type PhoneIssueReader = { query: (text: string, values?: any[]) => Promise<any> };
export const phoneDigits = (value: unknown) => String(value || "").replace(/\D/g, "").replace(/^00/, "");
export const phoneIssueSchema = z.object({
  reason: z.enum(["wrong_person", "not_working", "verify"]),
  phoneField: z.enum(["phone", "phone2", "phone3"]),
  expectedNumber: z.string().min(1).max(100),
}).strict();
export function phoneIssueReader(tx: any): PhoneIssueReader {
  return { query: async (text, values = []) => {
    const query = sql.empty();
    text.split(/(\$\d+)/g).forEach(part => {
      // sql interpolates arrays as SQL tuples; a Param preserves pg's native
      // array binding required by the shared workflow's ANY($n::varchar[]).
      if (/^\$\d+$/.test(part)) query.append(sql`${sql.param(values[Number(part.slice(1)) - 1])}`);
      else query.append(sql.raw(part));
    });
    return tx.execute(query);
  } };
}
const fail = (code = "phone_issue_invalid", status = 409): never => { throw new StatusListWorkflowError(code, status); };
async function lockPhoneIssueContact(reader: PhoneIssueReader, missionId: string, contactId: string) {
  // Same lock order and callback admission context as workflowTransaction.
  await reader.query("SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",[callbackBarrier(missionId)]);
  await reader.query("SELECT set_config('indexus.callback_context',$1,true)",[JSON.stringify({suppress:true,admitted:true})]);
  await reader.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`mission-workflow:${contactId}`]);
  await reader.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`mission-callback-contact:${contactId}`]);
  await reader.query("SELECT id FROM campaign_contacts WHERE id=$1 AND campaign_id=$2 FOR UPDATE",[contactId,missionId]);
  await reader.query("SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",[`mission-workflow-config:${missionId}`]);
}

export async function phoneIssueContact(reader: PhoneIssueReader, missionId: string, entityType: string, entityId: string) {
  if (!["clinic", "hospital"].includes(entityType) || !entityId) return fail();
  const rows = (await reader.query(`SELECT cc.id,cc.campaign_id,cc.contact_type,to_jsonb(e) entity
    FROM campaign_contacts cc JOIN ${entityType === "clinic" ? "clinics" : "hospitals"} e
      ON e.id=to_jsonb(cc)->>$3
    WHERE cc.campaign_id=$1 AND cc.contact_type=$4 AND e.id=$2`,
  [missionId, entityId, entityType === "clinic" ? "clinic_id" : "hospital_id", entityType])).rows;
  if (rows.length !== 1) return fail();
  return rows[0];
}
export async function phoneIssueSources(reader: PhoneIssueReader, missionId: string) {
  return (await reader.query(`SELECT group_id,config FROM mission_status_list_option_sources
    WHERE campaign_id=$1 AND config->>'source'='healthcare_reachability'`, [missionId])).rows;
}

export async function reportTaskPhoneIssue(reader: PhoneIssueReader, task: any, input: {
  missionId: string; entityType: string; entityId: string; actorId: string; issue: unknown;
}) {
  const parsed = phoneIssueSchema.safeParse(input.issue);
  if (!parsed.success) return fail();
  const issue = parsed.data;
  let contact = await phoneIssueContact(reader, input.missionId, input.entityType, input.entityId);
  await lockPhoneIssueContact(reader,input.missionId,contact.id);
  contact = await phoneIssueContact(reader, input.missionId, input.entityType, input.entityId);
  const number = phoneDigits(contact.entity[issue.phoneField]);
  if (number.length < 6 || number !== phoneDigits(issue.expectedNumber)) return fail("phone_issue_stale");
  if (issue.reason === "verify") return;
  const sources = await phoneIssueSources(reader, input.missionId);
  if (sources.length !== 1) return fail("phone_issue_no_source");
  const source = sources[0];
  const state = issue.reason === "wrong_person" ? "wrong_number" : "not_working";
  if (source.config.policy?.enabled?.[state] === false) return fail("healthcare_state_disabled");
  if ((await reader.query(`SELECT 1 FROM mission_phone_issues WHERE campaign_contact_id=$1
    AND phone_field=$2 AND reported_number=$3 AND status='reported'`, [contact.id, issue.phoneField, number])).rows.length)
    return fail("phone_issue_already_reported");
  // Establish only this source's inert baseline before storing the new evidence.
  const before = await healthcareFacts(reader as any, input.missionId, contact.id, source.group_id);
  await reader.query(`INSERT INTO mission_status_list_option_source_state(campaign_contact_id,group_id,value,option_id,config_revision)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(campaign_contact_id,group_id) DO NOTHING`,
  [contact.id, source.group_id, before.state, source.config.mapping[before.state], before.revision]);
  await reader.query(`INSERT INTO mission_phone_issues(task_id,campaign_id,campaign_contact_id,group_id,
    entity_type,entity_id,phone_field,reported_number,current_number,reason,actor_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10)`,
  [task.id, input.missionId, contact.id, source.group_id, input.entityType, input.entityId,
    issue.phoneField, number, issue.reason, input.actorId]);
  await reader.query(`INSERT INTO mission_status_list_healthcare_audit(campaign_contact_id,group_id,actor_id,previous,value)
    VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`, [contact.id, source.group_id, input.actorId,
    JSON.stringify({ state: before.state }), JSON.stringify({ state, taskId: task.id, reason: issue.reason, phoneField: issue.phoneField })]);
}

export async function phoneIssueContext(reader: PhoneIssueReader, missionId: string, entityType: string, entityId: string, actorId: string) {
  const contact = await phoneIssueContact(reader, missionId, entityType, entityId);
  const phones = ["phone", "phone2", "phone3"].filter(field => phoneDigits(contact.entity[field]).length >= 6)
    .map(field => ({ field, number: contact.entity[field] }));
  const sources = await phoneIssueSources(reader, missionId);
  if(sources.length!==1) return {phones,sourceAvailable:false,pendingVerification:null};
  const issue = (await reader.query(`SELECT * FROM (
    SELECT DISTINCT ON(phone_field) * FROM mission_phone_issues WHERE campaign_contact_id=$1 AND group_id=$2
    ORDER BY phone_field,created_at DESC,id DESC) current_issues WHERE status IN ('reported','awaiting_verification')
    ORDER BY CASE status WHEN 'reported' THEN 0 ELSE 1 END,created_at DESC LIMIT 1`, [contact.id,sources[0].group_id])).rows[0];
  if (!issue || sources.length !== 1 || sources[0].group_id !== issue.group_id)
    return { phones, sourceAvailable: sources.length === 1, pendingVerification: null };
  const current = phoneDigits(contact.entity[issue.phone_field]);
  if (current !== issue.current_number) return { phones, sourceAvailable: true, pendingVerification: null };
  const facts = await healthcareFacts(reader as any, missionId, contact.id, issue.group_id);
  if (!facts.config.policy.enabled.reachable)
    return { phones, sourceAvailable: true, pendingVerification: { issueId: issue.id, phone: contact.entity[issue.phone_field], callId: null } };
  const call = (await reader.query(`SELECT id FROM call_logs WHERE campaign_id=$1 AND campaign_contact_id=$2 AND user_id=$3
    AND started_at>=$4 AND ended_at IS NOT NULL AND answered_at IS NOT NULL
    AND ended_at<=clock_timestamp() AND answered_at>=started_at AND ended_at>=answered_at
    AND NOT coalesce(is_forwarded,false) AND status IN ('answered','completed')
    AND extract(epoch FROM ended_at-answered_at)>=$5
    AND regexp_replace(regexp_replace(phone_number,'[^0-9]','','g'),'^00','')=$6
    AND NOT EXISTS(SELECT 1 FROM mission_status_list_healthcare_call_reviews r WHERE r.campaign_contact_id=$2
      AND r.group_id=$7 AND r.call_key=coalesce(nullif(call_logs.sip_call_id,''),call_logs.id::text))
    ORDER BY ended_at DESC LIMIT 1`,
  [missionId, contact.id, actorId, issue.corrected_at || issue.created_at, facts.config.policy.minTalkSeconds, current, issue.group_id])).rows[0];
  return { phones, sourceAvailable: true, pendingVerification: {
    issueId: issue.id, phone: contact.entity[issue.phone_field], callId: call?.id || null,
  } };
}

export async function verifyPhoneIssue(reader: PhoneIssueReader, missionId: string, entityType: string, entityId: string,
  actorId: string, body: any) {
  const contact = await phoneIssueContact(reader, missionId, entityType, entityId);
  await lockPhoneIssueContact(reader,missionId,contact.id);
  const context = await phoneIssueContext(reader, missionId, entityType, entityId, actorId);
  const pending = context.pendingVerification;
  if (!pending || !pending.callId || pending.issueId !== body.issueId || pending.callId !== body.callId
    || phoneDigits(pending.phone) !== phoneDigits(body.expectedNumber)) return fail("phone_issue_stale");
  await reader.query(`INSERT INTO mission_status_list_healthcare_audit(campaign_contact_id,group_id,actor_id,previous,value)
    SELECT campaign_contact_id,group_id,$1,jsonb_build_object('status',status),
      jsonb_build_object('state','reachable','verifiedCallId',$2::text,'taskId',task_id) FROM mission_phone_issues WHERE id=$3`,
  [actorId, pending.callId, pending.issueId]);
  await reader.query(`UPDATE mission_phone_issues SET status='verified',verified_at=clock_timestamp(),verified_call_id=$1
    WHERE id=$2 AND campaign_contact_id=$3`, [pending.callId, pending.issueId, contact.id]);
}
