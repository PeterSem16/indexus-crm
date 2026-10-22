import type { PoolClient } from "pg";
import { pool } from "../db";
import { randomUUID, createHash } from "node:crypto";
import { automaticAdmission, automaticCondition, automaticConfigSchema, type AutomaticTrigger } from "../../shared/status-list-automatic";
import { statusListNativeActionIssues, statusListNativeActionType } from "../../shared/status-list-service-config";
import { loadStatusListHistoryFacts } from "./status-list-history";
import { executeStatusListNativeService } from "./status-list-native-service";
import { statusListExecutionMode } from "../../shared/status-list-execution-policy";
import type { WorkflowEvent } from "./status-list-workflow";

type Reader = Pick<PoolClient, "query">;
const system = "system:mission-status-list";
const canonical = (value: any): string => JSON.stringify(value, function (_key,item) {
  return item && !Array.isArray(item) && typeof item==="object"
    ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item;
});
const loadItem = async (client: Reader, campaignId: string, itemId: string) => (await client.query(`
  SELECT i.id,i.label,i.is_hidden AS "isHidden",i.confirmation_type AS "confirmationType",c.settings
  FROM campaign_status_list_items i JOIN campaigns c ON c.id=i.campaign_id
  WHERE i.campaign_id=$1 AND i.id=$2`, [campaignId,itemId])).rows[0];
const loadConfig = async (client: Reader, campaignId: string, itemId: string) => (await client.query(`
  SELECT trigger,enabled,revision FROM mission_status_list_automatic_configs WHERE campaign_id=$1 AND item_id=$2`,
  [campaignId,itemId])).rows[0] || { trigger: "agent_confirmation",enabled: false,revision: null };
const loadActions = async (client: Reader, campaignId: string, itemId: string) => (await client.query(`
  SELECT a.id,a.action_type AS "actionType",a.status_list_item_id AS "itemId",a.question_id AS "questionId",
    q.question_text AS "questionLabel",a.service_action_config AS "serviceActionConfig",
    a.service_action_owner_id AS "serviceActionOwnerId",a.condition_field AS "conditionField",
    a.condition_operator AS "conditionOperator",a.condition_value AS "conditionValue",a.condition_json AS "conditionJson",
    (u.id IS NOT NULL AND u.is_active IS NOT FALSE AND (u.role IN ('admin','superadmin','owner') OR
      (u.role='manager' AND cardinality(c.country_codes)>0 AND u.assigned_countries::text[] @> c.country_codes::text[]))) AS "ownerAuthorized"
  FROM campaign_status_list_automations a
  JOIN campaign_status_list_items i ON i.id=a.status_list_item_id AND i.campaign_id=$1
  JOIN campaigns c ON c.id=i.campaign_id
  LEFT JOIN users u ON u.id=a.service_action_owner_id
  LEFT JOIN campaign_status_list_questions q ON q.id=a.question_id AND q.item_id=i.id
  WHERE i.id=$2 ORDER BY a.sort_order,a.id`, [campaignId,itemId])).rows;

/** Reject definitions that the unattended evaluator would otherwise guess. */
export function automaticActionIssues(action: any) {
  const issues = statusListNativeActionIssues(action.actionType, action.serviceActionConfig);
  if(!statusListNativeActionType(action.actionType) || !action.serviceActionConfig) issues.push("unsupported_action");
  if (!action.serviceActionOwnerId) issues.push("owner_required");
  else if(action.ownerAuthorized===false || action.ownerAuthorized===null)issues.push("owner_not_authorized");
  const definition = action.conditionJson;
  if (definition) {
    let parsed: any;
    try { parsed = typeof definition === "string" ? JSON.parse(definition) : definition; }
    catch { issues.push("invalid_condition"); return issues; }
    if (!parsed || Object.keys(parsed).some(key => !["logic","rules"].includes(key)) ||
        !["AND","OR"].includes(parsed.logic) || !Array.isArray(parsed.rules) || !parsed.rules.length ||
        parsed.rules.some((rule: any) => !rule || !automaticField(rule.field) ||
          !["eq","neq","equals","not_equals"].includes(rule.op)))
      issues.push("invalid_condition");
  } else if (action.conditionField && action.conditionField !== "always" && !automaticField(action.conditionField))
    issues.push("invalid_condition");
  else if (action.conditionField && action.conditionField !== "always" &&
    !["eq","neq","equals","not_equals"].includes(action.conditionOperator || "eq"))
    issues.push("invalid_condition");
  return issues;
}
const automaticField = (field: string) => field === "answer" || field === "country" || field === "contact_country" ||
  (typeof field === "string" && field.startsWith("history.") &&
    (["history.outreach_attempted","history.call_attempted","history.call_answered","history.call_failed",
      "history.email_sent","history.sms_sent","history.email_reply","history.sms_reply",
      "history.message_delivered","history.reached"]).includes(field));

export async function automaticOverview(client: Reader, campaignId: string, itemId: string) {
  const item = await loadItem(client,campaignId,itemId);
  if (!item) return null;
  const config = await loadConfig(client,campaignId,itemId);
  const actions = (await loadActions(client,campaignId,itemId)).map(action => ({
    id: action.id,actionType: action.actionType,questionLabel: action.questionLabel || null,
    issues: automaticActionIssues(action),
  }));
  return { item: { id:item.id,label:item.label,isHidden:item.isHidden,confirmationType:item.confirmationType },
    config,mode:statusListExecutionMode(item.settings),actions,
    supportedConditionFields: ["country","answer","history.outreach_attempted","history.call_attempted",
      "history.call_answered","history.call_failed","history.email_sent","history.sms_sent",
      "history.email_reply","history.sms_reply","history.message_delivered","history.reached"] };
}
export async function saveAutomaticConfig(campaignId: string,itemId: string,raw: unknown) {
  const payload = automaticConfigSchema.parse(raw);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`automatic:${campaignId}:${itemId}`]);
    const item = await loadItem(client,campaignId,itemId);
    if (!item) throw Error("item_not_found");
    const current = await loadConfig(client,campaignId,itemId);
    if (current.revision !== payload.expectedRevision) throw Error("config_changed");
    const actions = await loadActions(client,campaignId,itemId);
    const sourceOwner = await client.query(`SELECT 1 FROM mission_status_list_option_sources s
      JOIN campaign_status_list_items i ON i.id=$2 WHERE s.campaign_id=$1
      AND (s.group_id=i.id OR s.group_id=i.parent_id)
      UNION ALL SELECT 1 FROM mission_status_list_sources s
      JOIN campaign_status_list_questions q ON q.id=s.question_id
      WHERE s.campaign_id=$1 AND q.item_id=$2 LIMIT 1`,[campaignId,itemId]);
    if (payload.enabled) {
      if (!actions.length) throw Error("no_actions");
      if (sourceOwner.rowCount && payload.trigger !== "background_change")
        throw Error("use_system_source_rules");
      if (payload.trigger === "agent_confirmation" && (item.isHidden || item.confirmationType === "auto"))
        throw Error("agent_cannot_confirm");
      if (payload.trigger !== "agent_confirmation" && actions.some(action => automaticActionIssues(action).length))
        throw Error("unsupported_action");
      // A system-owned answer is not an agent confirmation.
      if (payload.trigger === "agent_confirmation" && (await client.query(`
        SELECT 1 FROM mission_status_list_option_sources s
        WHERE s.campaign_id=$1 AND (s.group_id=$2 OR s.group_id=$3) LIMIT 1`,
      [campaignId,itemId,(await client.query("SELECT parent_id FROM campaign_status_list_items WHERE id=$1",[itemId])).rows[0]?.parent_id])).rowCount)
        throw Error("agent_cannot_confirm");
    }
    const revision = current.revision === null || current.trigger !== payload.trigger || current.enabled !== payload.enabled
      ? randomUUID() : current.revision;
    await client.query(`INSERT INTO mission_status_list_automatic_configs(item_id,campaign_id,trigger,enabled,revision)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(item_id) DO UPDATE SET trigger=EXCLUDED.trigger,
      enabled=EXCLUDED.enabled,revision=EXCLUDED.revision,updated_at=now()`,
    [itemId,campaignId,payload.trigger,payload.enabled,revision]);
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function contactContext(client: Reader,campaignId: string,contactId: string) {
  return (await client.query(`SELECT cc.id,cc.campaign_id,cc.contact_type,
    CASE cc.contact_type WHEN 'clinic' THEN cl.country_code WHEN 'hospital' THEN h.country_code
    WHEN 'collaborator' THEN co.country_code ELSE cu.country END AS country,
    c.settings,c.country_codes FROM campaign_contacts cc JOIN campaigns c ON c.id=cc.campaign_id
    LEFT JOIN clinics cl ON cl.id=cc.clinic_id LEFT JOIN hospitals h ON h.id=cc.hospital_id
    LEFT JOIN collaborators co ON co.id=cc.collaborator_id LEFT JOIN customers cu ON cu.id=cc.customer_id
    WHERE cc.id=$1 AND cc.campaign_id=$2`,[contactId,campaignId])).rows[0];
}
/** Single reader for preview, card-open admission and background admission. */
export async function inspectAutomaticContact(client: Reader, campaignId: string,contactId: string,itemId: string,
  options: {enqueue?: boolean; trigger?: AutomaticTrigger; actorId?: string; batchCommit?: boolean;
    sourceEvent?: WorkflowEvent; initialState?: boolean; initialApproval?: string} = {}) {
  const item = await loadItem(client,campaignId,itemId);
  const contact = await contactContext(client,campaignId,contactId);
  if (!item || !contact) throw Error("contact_or_item_not_found");
  const countries=(contact.country_codes || []).map((code:string)=>code.toUpperCase());
  const country=contact.country?.toUpperCase() || (countries.length===1 ? countries[0] : null);
  const config = await loadConfig(client,campaignId,itemId);
  const mode = statusListExecutionMode(item.settings);
  const actions = await loadActions(client,campaignId,itemId);
  const facts = actions.some(action => JSON.stringify([action.conditionField,action.conditionJson]).includes("history."))
    ? await loadStatusListHistoryFacts(client,campaignId,contactId) : null;
  const answers = (await client.query(`SELECT question_id,value,revision FROM mission_status_list_answers
    WHERE campaign_contact_id=$1 AND question_id=ANY($2::varchar[])`,
  [contactId,actions.map(action => action.questionId).filter(Boolean)])).rows;
  const states = (await client.query(`SELECT automation_id,matched,generation,definition_fingerprint FROM mission_status_list_automatic_states
    WHERE campaign_contact_id=$1 AND automation_id=ANY($2::varchar[])`,
  [contactId,actions.map(action=>action.id)])).rows;
  const managed = (await client.query(`SELECT 'question' AS kind,s.question_id AS id FROM mission_status_list_sources s
    JOIN campaign_status_list_questions q ON q.id=s.question_id WHERE s.campaign_id=$1 AND q.item_id=$2
    UNION ALL SELECT 'item',i.id FROM mission_status_list_option_sources s
    JOIN campaign_status_list_items i ON i.parent_id=s.group_id OR i.id=s.group_id
    WHERE s.campaign_id=$1 AND i.id=$2`,[campaignId,itemId])).rows;
  const executions = (await client.query(`SELECT automation_id,trigger_key,state FROM mission_status_list_automatic_events
    WHERE campaign_contact_id=$1 AND automation_id=ANY($2::varchar[]) ORDER BY created_at DESC,id DESC`,
  [contactId,actions.map(action=>action.id)])).rows;
  // Initial processing is deliberately conservative: an earlier native attempt,
  // including an uncertain/failed one, must not be silently replayed.
  const nativeAttempts = options.initialState ? (await client.query(`SELECT automation_id,id,status
    FROM status_list_service_executions WHERE campaign_id=$1 AND campaign_contact_id=$2
    AND automation_id=ANY($3::varchar[]) ORDER BY id`,
  [campaignId,contactId,actions.map(action=>action.id)])).rows : [];
  const output: any[] = [];
  for (const action of actions) {
    const derived=managed.some(row=>row.kind==="question" ? row.id===action.questionId : !action.questionId);
    const sourceEvent=options.sourceEvent;
    const eventMatches=sourceEvent && (sourceEvent.source.kind==="question"
      ? action.questionId===sourceEvent.source.id : action.itemId===sourceEvent.source.id && !action.questionId);
    if (sourceEvent && !eventMatches) continue;
    const issues = automaticActionIssues(action);
    if(!country || (countries.length && !countries.includes(country)))issues.push("country_unresolved");
    const answer = action.questionId ? answers.find(row=>row.question_id===action.questionId)?.value : undefined;
    const evaluation = automaticCondition(action,facts,country,answer);
    const fingerprint=createHash("sha256").update(canonical([action,config.revision])).digest("hex");
    const old = states.find(row=>row.automation_id===action.id && row.definition_fingerprint===fingerprint);
    const nextGeneration = old ? Number(old.generation) + (!old.matched && evaluation.value === true ? 1 : 0) : 0;
    const key = options.initialState ? `initial:${action.id}` : sourceEvent ? `source:${sourceEvent.eventId}` :
      config.trigger === "card_open" ? `open:${action.id}` : `change:${fingerprint}:${nextGeneration}`;
    const prior = executions.find(row=>row.automation_id===action.id && (derived && !sourceEvent || row.trigger_key===key));
    let status = automaticAdmission({
      trigger:config.trigger,enabled:config.enabled,supported:issues.length===0,
      condition:evaluation.value,issue:evaluation.issue,previous:sourceEvent ? false : old?.matched,
      priorStatus: prior?.state==="awaiting_batch" ? "batch_deferred" : prior?.state==="running" ? "pending" : prior?.state,
      batch:mode==="batch" && !options.batchCommit,
    });
    if (derived && !sourceEvent && ["ready","background_baseline","waiting_transition","batch_deferred"].includes(status))
      status="waiting_transition";
    if (options.initialState) status=automaticAdmission({
      trigger:"card_open",enabled:config.enabled && config.trigger==="background_change",
      supported:issues.length===0,condition:evaluation.value,issue:evaluation.issue,
      priorStatus:executions.some(row=>row.automation_id===action.id) ||
        nativeAttempts.some(row=>row.automation_id===action.id) ? "already_executed" : undefined,
      batch:mode==="batch",
    });
    if (options.enqueue && config.enabled && config.trigger === options.trigger && (!derived || eventMatches || options.initialState)) {
      // A false/unknown condition is not consumed; it may become true later.
      if ((!derived || options.initialState) && config.trigger === "background_change" && !evaluation.issue && issues.length===0) {
        await client.query(`INSERT INTO mission_status_list_automatic_states(campaign_contact_id,automation_id,matched,generation,definition_fingerprint)
          VALUES($1,$2,$3,$4,$5) ON CONFLICT(campaign_contact_id,automation_id) DO UPDATE SET
          matched=EXCLUDED.matched,generation=EXCLUDED.generation,
          definition_fingerprint=EXCLUDED.definition_fingerprint,evaluated_at=now()`,
        [contactId,action.id,evaluation.value===true,nextGeneration,fingerprint]);
      }
      if (status==="ready" || status==="batch_deferred") {
        const inserted = await client.query(`INSERT INTO mission_status_list_automatic_events
          (campaign_id,campaign_contact_id,automation_id,item_id,trigger_key,action_snapshot,config_revision,actor_id,event_context,state)
          VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10)
          ON CONFLICT(campaign_contact_id,automation_id,trigger_key) DO NOTHING RETURNING id`,
        [campaignId,contactId,action.id,itemId,key,JSON.stringify(action),config.revision,
          options.actorId || system,JSON.stringify({
            sourceEventId:sourceEvent?.eventId,occurredAt:sourceEvent?.occurredAt,
            ...(options.initialState ? {initialState:true,approvalFingerprint:options.initialApproval} : {}),
            questionRevision:action.questionId ? answers.find(row=>row.question_id===action.questionId)?.revision ?? null : undefined,
          }),status==="batch_deferred" ? "awaiting_batch" : "pending"]);
        status = inserted.rowCount ? (status==="batch_deferred" ? "batch_deferred" : "pending") : "already_executed";
      }
    }
    output.push({id:action.id,actionType:action.actionType,questionLabel:action.questionLabel || null,
      condition:evaluation.value,status,issues});
  }
  return {readOnly:!options.enqueue,trigger:config.trigger,enabled:config.enabled,mode,
    baseline:config.trigger==="background_change" && output.some(action=>action.status==="background_baseline"),actions:output,
    ...(options.initialState ? {evidenceFingerprint:createHash("sha256").update(canonical({
      item,contact,config,actions,facts,
      answers:[...answers].sort((a,b)=>a.question_id.localeCompare(b.question_id)),
      states:[...states].sort((a,b)=>a.automation_id.localeCompare(b.automation_id)),
      managed:[...managed].sort((a,b)=>`${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`)),
      executions,nativeAttempts,
    })).digest("hex")} : {})};
}

/** Baselines never arrive here: only committed, actual source transitions do. */
export async function queueAutomaticSourceEvent(client: Reader,event: WorkflowEvent) {
  if (event.trigger!=="background_transition") return;
  const items=(await client.query(`SELECT DISTINCT c.item_id FROM mission_status_list_automatic_configs c
    JOIN campaign_status_list_automations a ON a.status_list_item_id=c.item_id
    WHERE c.campaign_id=$1 AND c.enabled AND c.trigger='background_change'
    AND (($2='question' AND a.question_id=$3) OR ($2='item' AND c.item_id=$3 AND a.question_id IS NULL))
    ORDER BY c.item_id`,[event.campaignId,event.source.kind,event.source.id])).rows;
  for (const row of items) await inspectAutomaticContact(client,event.campaignId,event.campaignContactId,row.item_id,
    {enqueue:true,trigger:"background_change",sourceEvent:event});
}

/** Runs only after admission commits. One claim, never auto-retry ambiguous external effects. */
export async function runAutomaticEvents(deps: {
  connect:()=>Promise<PoolClient>;execute:typeof executeStatusListNativeService;
}={connect:()=>pool.connect(),execute:executeStatusListNativeService}) {
  const client=await deps.connect();
  let contactLock:string|undefined;
  try {
    const candidate=(await client.query(`SELECT campaign_contact_id FROM mission_status_list_automatic_events
      WHERE state='pending' ORDER BY created_at,id LIMIT 1`)).rows[0];
    if(!candidate)return;
    const key=`status-list-automatic:${candidate.campaign_contact_id}`;
    if(!(await client.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked",[key])).rows[0].locked)return;
    contactLock=key;
    await client.query("BEGIN");
    const row=(await client.query(`SELECT * FROM mission_status_list_automatic_events
      WHERE state='pending' AND campaign_contact_id=$1 ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`,
    [candidate.campaign_contact_id])).rows[0];
    if (!row) { await client.query("COMMIT"); return; }
    await client.query("UPDATE mission_status_list_automatic_events SET state='running',started_at=now() WHERE id=$1",[row.id]);
    await client.query("COMMIT");
    const config=await loadConfig(client,row.campaign_id,row.item_id);
    const snapshot=row.action_snapshot;
    const live=(await loadActions(client,row.campaign_id,row.item_id)).find(action=>action.id===row.automation_id);
    if (!config.enabled || config.revision!==row.config_revision || !live ||
      canonical(live)!==canonical(snapshot) || automaticActionIssues(live).length) {
      await client.query(`UPDATE mission_status_list_automatic_events SET state='superseded',finished_at=now(),
        result='{"reason":"config_or_action_changed"}'::jsonb WHERE id=$1`,[row.id]); return;
    }
    // A stable event id drives the executor's own durable reservation as well.
    let result:any;
    try {
      result=await deps.execute(snapshot,{
        campaignId:row.campaign_id,campaignContactId:row.campaign_contact_id,
        itemId:row.item_id,userId:row.actor_id,confirmationId:`automatic:${row.id}`,
        automaticEvent:{id:row.id,occurredAt:row.event_context?.occurredAt || row.created_at,
          questionRevision:row.event_context?.questionRevision},
      });
    } catch { result={ok:false,error:"execution_indeterminate",indeterminate:true}; }
    const status=result?.skipped ? "superseded" : result?.ok===true ? "succeeded" :
      result?.duplicate || result?.indeterminate ? "indeterminate" : "failed";
    await client.query(`UPDATE mission_status_list_automatic_events SET state=$2,result=$3::jsonb,finished_at=now()
      WHERE id=$1`,[row.id,status,JSON.stringify({ok:result?.ok===true,status:result?.status,
        error:result?.error,executionId:result?.executionId})]);
  } catch (error) { await client.query("ROLLBACK").catch(()=>{}); throw error; }
  finally {
    let released=false;
    if(contactLock) {
      try { await client.query("SELECT pg_advisory_unlock(hashtextextended($1,0))",[contactLock]); }
      catch { client.release(true);released=true; }
    }
    if(!released)client.release();
  }
}
let running=false;
export async function startAutomaticServiceWorker() {
  await pool.query(`UPDATE mission_status_list_automatic_events SET state='indeterminate',finished_at=now(),
    result='{"reason":"interrupted_after_claim"}'::jsonb WHERE state='running' AND started_at<now()-interval '10 minutes'`);
  const timer=setInterval(async()=> {
    if(running)return;running=true;
    try { for(let i=0;i<5;i++) await runAutomaticEvents(); }
    catch { console.error("[status-list-automatic] worker_failed"); }
    finally { running=false; }
  },5000);
  timer.unref();
  return()=>clearInterval(timer);
}
