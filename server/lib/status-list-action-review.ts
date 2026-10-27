import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { loadAutomaticActions, automaticActionIssues } from "./status-list-automatic";
import { healthcareActionValid } from "./status-list-healthcare";
import { taskTargetLabel } from "./status-list-confirmation-preview";
import { StatusListWorkflowError } from "./status-list-workflow";

type Reader=Pick<PoolClient,"query">;
const stable=(v:unknown)=>JSON.stringify(v,(_,x)=>x && typeof x==="object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])) : x);
export async function readActionReviews(client:Reader,campaignId:string,contactId:string,actorId:string) {
  const rows=(await client.query(`SELECT e.*,i.label,c.revision AS live_revision,c.enabled
    FROM mission_status_list_automatic_events e JOIN campaign_status_list_items i ON i.id=e.item_id
    JOIN mission_status_list_automatic_configs c ON c.item_id=e.item_id AND c.campaign_id=e.campaign_id
    WHERE e.campaign_id=$1 AND e.campaign_contact_id=$2 AND e.state='awaiting_review' ORDER BY e.created_at,e.id`,
  [campaignId,contactId])).rows;
  const result=[];
  for(const row of rows) {
    const action=(await loadAutomaticActions(client,campaignId,row.item_id)).find(a=>a.id===row.automation_id);
    if(!row.enabled || row.live_revision!==row.config_revision || !action || action.executionPolicy!=="review" ||
      stable(action)!==stable(row.action_snapshot) || automaticActionIssues(action).length ||
      !await healthcareActionValid(client,row,action)) continue;
    // Superseded source options must not remain approvable.
    if(row.event_context?.sourceEventId && !(await client.query(`SELECT 1 FROM mission_status_list_transitions t
      WHERE 'transition:'||t.id=$1 AND t.campaign_contact_id=$2 AND
        (t.target_kind='question' OR EXISTS(SELECT 1 FROM campaign_contact_status_list_state s
          WHERE s.campaign_contact_id=t.campaign_contact_id AND s.status_list_item_id=$3))`,
    [row.event_context.sourceEventId,contactId,row.item_id])).rowCount) continue;
    const config=action.serviceActionConfig||{};
    const callback=action.actionType==="set_callback" ? {
      days:action.callbackOffsetDays,time:action.callbackTime,businessDaysOnly:action.callbackBusinessDaysOnly!==false,
      date:(await import("./status-list-callback-compatible")).callbackInstant({callback:{
        days:action.callbackOffsetDays,time:action.callbackTime||"09:00",weekdaysOnly:action.callbackBusinessDaysOnly!==false,
        existing:action.callbackExistingPolicy||"keep_existing",
      }} as any,new Date(row.event_context?.occurredAt||row.created_at).toISOString()),
    } : null;
    result.push({id:row.id,label:row.label,actionType:action.actionType,title:config.title||config.subject||"",
      targetLabel:action.actionType==="assign_task" ? await taskTargetLabel(client,action,actorId) : null,
      content:String(config.text||config.message||config.body||config.description||config.taskText||"").replace(/<[^>]*>/g," ").slice(0,20000),
      recipients:action.actionType==="assign_task" ? "" : [config.to,config.userId,config.userIds?.join(", "),config.taskGroupId,config.targetRole].filter(Boolean).join(", "),
      callback,
      occurredAt:row.event_context?.occurredAt||row.created_at,
      fingerprint:createHash("sha256").update(stable({id:row.id,action,revision:row.live_revision,context:row.event_context})).digest("hex")});
  }
  return result;
}
export async function confirmActionReview(client:PoolClient,campaignId:string,contactId:string,actorId:string,eventId:string,fingerprint:string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`status-list-automatic:${contactId}`]);
  const review=(await readActionReviews(client,campaignId,contactId,actorId)).find(r=>r.id===eventId);
  if(!review || review.fingerprint!==fingerprint) throw new StatusListWorkflowError("preview_changed",409);
  const result=await client.query(`UPDATE mission_status_list_automatic_events SET state=
    CASE WHEN event_context->>'afterReviewState'='awaiting_batch' THEN 'awaiting_batch' ELSE 'pending' END,
    event_context=event_context||jsonb_build_object('reviewedBy',$4::text,'reviewedAt',clock_timestamp()),actor_id=$4
    WHERE id=$1 AND campaign_id=$2 AND campaign_contact_id=$3 AND state='awaiting_review' RETURNING id`,
  [eventId,campaignId,contactId,actorId]);
  if(!result.rowCount) throw new StatusListWorkflowError("preview_changed",409);
}
