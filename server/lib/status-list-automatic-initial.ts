import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { inspectAutomaticContact } from "./status-list-automatic";
import { StatusListWorkflowError } from "./status-list-workflow";

type Reader = Pick<PoolClient, "query">;
export const initialScopeSchema = z.discriminatedUnion("scope", [
  z.object({scope:z.literal("mission")}).strict(),
  z.object({scope:z.literal("contact"),contactId:z.string().uuid()}).strict(),
]);
export type InitialScope = z.infer<typeof initialScopeSchema>;
const eligible = (status:string) => status==="ready" || status==="batch_deferred";

/** Full, bounded plan. Read-only callers run this in a repeatable-read snapshot. */
export async function previewAutomaticInitial(client:Reader,campaignId:string,itemId:string,
  scope:InitialScope,actorId:string) {
  const config=(await client.query(`SELECT trigger,enabled,revision FROM mission_status_list_automatic_configs
    WHERE campaign_id=$1 AND item_id=$2`,[campaignId,itemId])).rows[0];
  if(!config?.enabled || config.trigger!=="background_change")
    throw new StatusListWorkflowError("initial_config_inactive",409);
  const contacts=(await client.query(`SELECT cc.id,
    coalesce(CASE cc.contact_type WHEN 'clinic' THEN cl.name WHEN 'hospital' THEN h.name
      WHEN 'collaborator' THEN concat_ws(' ',co.first_name,co.last_name)
      ELSE concat_ws(' ',cu.first_name,cu.last_name) END,'—') AS label
    FROM campaign_contacts cc
    LEFT JOIN clinics cl ON cl.id=cc.clinic_id
    LEFT JOIN hospitals h ON h.id=cc.hospital_id
    LEFT JOIN collaborators co ON co.id=cc.collaborator_id
    LEFT JOIN customers cu ON cu.id=cc.customer_id
    WHERE cc.campaign_id=$1 AND ($2::varchar IS NULL OR cc.id=$2)
    ORDER BY cc.id LIMIT 501`,[campaignId,scope.scope==="contact" ? scope.contactId : null])).rows;
  if(contacts.length>500)throw new StatusListWorkflowError("scope_too_large",409);
  if(scope.scope==="contact" && !contacts.length)throw new StatusListWorkflowError("contact_not_found",404);
  const rows=[];
  const evidence=[];
  let mode:"immediate"|"batch"="immediate";
  for(const contact of contacts) {
    const result=await inspectAutomaticContact(client,campaignId,contact.id,itemId,{initialState:true});
    mode=result.mode;
    rows.push({id:contact.id,label:contact.label,actions:result.actions});
    evidence.push(result.evidenceFingerprint);
  }
  const summary={contacts:rows.length,
    readyContacts:rows.filter(row=>row.actions.some(action=>eligible(action.status))).length,
    readyActions:rows.reduce((n,row)=>n+row.actions.filter(action=>eligible(action.status)).length,0),
    skippedActions:rows.reduce((n,row)=>n+row.actions.filter(action=>!eligible(action.status)).length,0)};
  const fingerprint=createHash("sha256").update(JSON.stringify({
    campaignId,itemId,scope,actorId,config,contacts:rows,evidence,
  })).digest("hex");
  return {fingerprint,mode,contacts:rows,summary};
}

/** Caller owns the transaction; no effects run here, only durable admissions. */
export async function confirmAutomaticInitial(client:Reader,campaignId:string,itemId:string,
  scope:InitialScope,actorId:string,fingerprint:string) {
  // Same configuration lock as saving a trigger. Contact locks are sorted and
  // shared with background admission; a second confirmation cannot race it.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`automatic:${campaignId}:${itemId}`]);
  const ids=(await client.query(`SELECT id FROM campaign_contacts
    WHERE campaign_id=$1 AND ($2::varchar IS NULL OR id=$2) ORDER BY id LIMIT 501`,
  [campaignId,scope.scope==="contact" ? scope.contactId : null])).rows;
  if(ids.length>500)throw new StatusListWorkflowError("scope_too_large",409);
  for(const {id} of ids)
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`mission-workflow:${id}`]);
  const plan=await previewAutomaticInitial(client,campaignId,itemId,scope,actorId);
  if(plan.fingerprint!==fingerprint)throw new StatusListWorkflowError("preview_changed",409);
  if(!plan.summary.readyActions)throw new StatusListWorkflowError("nothing_to_process",409);
  let queued=0,deferred=0;
  for(const contact of plan.contacts) {
    const result=await inspectAutomaticContact(client,campaignId,contact.id,itemId,
      {initialState:true,initialApproval:fingerprint,enqueue:true,trigger:"background_change",actorId});
    queued+=result.actions.filter(action=>action.status==="pending").length;
    deferred+=result.actions.filter(action=>action.status==="batch_deferred").length;
  }
  if(queued+deferred!==plan.summary.readyActions)throw new StatusListWorkflowError("preview_changed",409);
  return {queued,deferred};
}
