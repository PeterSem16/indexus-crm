import type { PoolClient } from "pg";
import { confirmationPreviewSchema, type ConfirmationPreview, type ConfirmationPreviewAction } from "../../shared/status-list-confirmation-preview";
import { statusListWorkflowSchema, workflowConditionMatches } from "../../shared/status-list-workflow";
import { isStatusListHistoryField } from "../../shared/status-list-history";
import { statusListExecutionMode } from "../../shared/status-list-execution-policy";
import { evaluateAutomationCondition } from "./condition-evaluator";
import { loadStatusListHistoryFacts } from "./status-list-history";
import { StatusListWorkflowError, workflowCatalog } from "./status-list-workflow";
import { statusListNativeActionIssues } from "../../shared/status-list-service-config";
import { statusListCallbackPrefill } from "../../shared/status-list-callback-calendar";
import { isEligibleScheduledCampaignCallback } from "../../shared/scheduled-callback";

export async function taskTargetLabel(client: Pick<PoolClient,"query">, action: any, actorId: string): Promise<string | undefined> {
  const config = action.serviceActionConfig;
  const saved = action.previewConfig || {};
  const targets: Array<{kind:string;id:string}> = Array.isArray(config?.recipients) ? config.recipients : [];
  if (!targets.length) {
    if (config?.taskGroupId || saved.task_group_id) targets.push({kind:"group",id:config?.taskGroupId || saved.task_group_id});
    else if (config?.targetRole || saved.target_role) targets.push({kind:"role",id:config?.targetRole || saved.target_role});
    else if (!config) targets.push({kind:"user",id:actorId});
  }
  const labels: string[] = [];
  for (const target of targets) {
    if (target.kind === "role") { labels.push(target.id.replace(/^role:/,"")); continue; }
    if (target.kind === "group") {
      const group = (await client.query("SELECT name FROM task_groups WHERE id=$1", [target.id])).rows[0];
      if (group?.name) labels.push(group.name);
    } else if (target.kind === "user") {
      const user = (await client.query(`SELECT COALESCE(NULLIF(to_jsonb(u)->>'full_name',''),to_jsonb(u)->>'username') AS name FROM users u WHERE id=$1`, [target.id])).rows[0];
      if (user?.name) labels.push(user.name);
    }
  }
  return labels.length ? [...new Set(labels)].join(" · ") : undefined;
}

/** Read-only plan. Never calls an executor, reserves an effect, or writes an answer. */
export async function previewStatusListConfirmation(client: Pick<PoolClient,"query">,
  campaignId: string, contactId: string, actorId: string, raw: unknown): Promise<ConfirmationPreview> {
  const { changes,manualActionIds } = confirmationPreviewSchema.parse(raw);
  const catalog = await workflowCatalog(campaignId,client);
  const contact = (await client.query(`SELECT cc.*,
    CASE WHEN cc.contact_type='customer' THEN NULLIF(c.hospital_name,'') ELSE cc.hospital_id END AS condition_hospital_id,
    CASE WHEN cc.contact_type='customer' THEN c.clinic_id ELSE cc.clinic_id END AS condition_clinic_id,
    CASE cc.contact_type WHEN 'clinic' THEN cl.country_code WHEN 'hospital' THEN h.country_code
      ELSE c.country END AS country, m.settings,m.country_codes
    FROM campaign_contacts cc JOIN campaigns m ON m.id=cc.campaign_id
    LEFT JOIN customers c ON c.id=cc.customer_id LEFT JOIN clinics cl ON cl.id=cc.clinic_id
    LEFT JOIN hospitals h ON h.id=cc.hospital_id WHERE cc.id=$1 AND cc.campaign_id=$2`,
  [contactId,campaignId])).rows[0];
  if (!contact) throw new StatusListWorkflowError("contact_not_found",404);
  const answers = (await client.query(`SELECT question_id,value FROM mission_status_list_answers WHERE campaign_contact_id=$1`,[contactId])).rows;
  const states = (await client.query(`SELECT status_list_item_id FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1`,[contactId])).rows;
  const snapshot = new Map<string,unknown>([
    ...answers.map(row => [`question:${row.question_id}`,row.value] as [string,unknown]),
    ...states.map(row => [`item:${row.status_list_item_id}`,true] as [string,unknown]),
  ]);
  const changedEvents=new Set(changes.filter(change=>change.value!=null &&
    !(change.kind==="item" && change.value===false) && snapshot.get(`${change.kind}:${change.id}`)!==change.value)
    .map(change=>`${change.kind}:${change.id}`));
  const events = changes.filter(change => {
    const definition = catalog.find(row => row.kind===change.kind && row.id===change.id);
    if (!definition || !definition.writable) throw new StatusListWorkflowError("invalid_source",409);
    return manualActionIds.length>0 || change.value != null &&
      !(change.kind==="item" && change.value===false) && snapshot.get(`${change.kind}:${change.id}`)!==change.value;
  });
  for (const change of changes) {
    if (change.value == null || change.value === false && change.kind==="item") snapshot.delete(`${change.kind}:${change.id}`);
    else snapshot.set(`${change.kind}:${change.id}`,change.value);
  }
  const actions: ConfirmationPreviewAction[] = [];
  const storedRules = (await client.query(`SELECT id,definition FROM mission_status_list_rules WHERE campaign_id=$1 ORDER BY created_at,id`,[campaignId])).rows;
  const history = storedRules.some(row => row.definition?.conditions?.some((condition:any) => isStatusListHistoryField(condition.field)))
    ? await loadStatusListHistoryFacts(client,campaignId,contactId) : null;
  for (const event of events) {
    const sourceLabel = catalog.find(row=>row.kind===event.kind && row.id===event.id)!.label;
    const legacy = (await client.query(`SELECT a.id,a.action_type AS "actionType",a.condition_field AS "conditionField",
      a.condition_value AS "conditionValue",a.condition_operator AS "conditionOperator",a.condition_json AS "conditionJson",
      a.service_action_config AS "serviceActionConfig",a.service_action_owner_id AS "serviceActionOwnerId",
       ac.trigger AS "automaticTrigger",ac.enabled AS "automaticEnabled",to_jsonb(a) AS "previewConfig"
      FROM campaign_status_list_automations a JOIN campaign_status_list_items i ON i.id=a.status_list_item_id
      LEFT JOIN mission_status_list_automatic_configs ac ON ac.item_id=i.id
      WHERE i.campaign_id=$1 AND (($2='item' AND i.id=$3 AND a.question_id IS NULL)
        OR ($2='question' AND a.question_id=$3)) ORDER BY a.sort_order,a.id`,[campaignId,event.kind,event.id])).rows;
    for (const action of legacy) {
      if(!changedEvents.has(`${event.kind}:${event.id}`) && !manualActionIds.includes(action.id))continue;
      // An automatic source is not an agent-confirmation event.
      if (action.automaticEnabled && action.automaticTrigger!=="agent_confirmation") continue;
      let condition: ConfirmationPreviewAction["condition"] = "unknown";
      if (action.serviceActionConfig && (statusListNativeActionIssues(action.actionType,action.serviceActionConfig).length || !action.serviceActionOwnerId))
        condition="blocked";
      else if (action.conditionField==="answer") {
        const normalized=(value:unknown)=>["yes","true","1"].includes(String(value))?"true":
          ["no","false","0"].includes(String(value))?"false":String(value??"");
        condition=normalized(event.value)===normalized(action.conditionValue)?"matched":"not_matched";
      } else {
        // Answer-dependent legacy conditions read persisted state; never pretend
        // they already saw this proposed answer snapshot.
        const serialized=JSON.stringify([action.conditionField,action.conditionJson]);
        if (/answer|field_changed_to/.test(serialized)) condition="unknown";
        else {
          try {
            condition=await evaluateAutomationCondition(action,{
              campaignId,campaignContactId:contactId,agentId:actorId,
              contactId: contact.contact_type==="clinic"?contact.clinic_id:contact.contact_type==="hospital"?contact.hospital_id:contact.customer_id,
              contactCountry:contact.country || (contact.country_codes?.length===1?contact.country_codes[0]:null),
            }) ? "matched":"not_matched";
          } catch { condition="unknown"; }
        }
      }
      const detail: Partial<ConfirmationPreviewAction> = {};
      if (["assign_task","create_task"].includes(action.actionType))
        detail.targetLabel = await taskTargetLabel(client,action,actorId);
      if (action.actionType === "set_callback" && !action.serviceActionConfig) {
        const saved = action.previewConfig || {};
        detail.callbackDate = statusListCallbackPrefill({
          callbackOffsetDays:saved.callback_offset_days,callbackTime:saved.callback_time,
          callbackBusinessDaysOnly:saved.callback_business_days_only,
        });
        if(saved.callback_existing_policy==="keep_existing" && isEligibleScheduledCampaignCallback(contact.status,contact.callback_date)) {
          detail.callbackDate=new Date(contact.callback_date).toISOString();
          detail.callbackNote=contact.callback_note || undefined;
          detail.keptExistingCallback=true;
        }
      }
      actions.push({id:action.id,sourceLabel,actionType:action.actionType,condition,...detail});
    }
    if(!changedEvents.has(`${event.kind}:${event.id}`))continue;
    for (const stored of storedRules) {
      const parsed=statusListWorkflowSchema.safeParse(stored.definition);
      if (!parsed.success) continue;
      const rule=parsed.data;
      if (!rule.enabled || rule.trigger!=="agent_confirmation" || rule.source.kind!==event.kind ||
        rule.source.id!==event.id || rule.sourceValue!==undefined && rule.sourceValue!==event.value) continue;
      const matches=rule.conditions.map(condition=>workflowConditionMatches(condition,
        isStatusListHistoryField(condition.field)?history?.[condition.field]:
          condition.field==="answer"?snapshot.get(`${condition.ref!.kind}:${condition.ref!.id}`):
          condition.field==="hospital_id"?contact.condition_hospital_id:
          condition.field==="clinic_id"?contact.condition_clinic_id:contact[condition.field]));
      const passed=!matches.length || (rule.logic==="and"?matches.every(Boolean):matches.some(Boolean));
      for (const [branch,definitions] of [["then",rule.thenActions],["else",rule.elseActions]] as const) {
        definitions.forEach((action,index)=>actions.push({
          id:`${stored.id}:${branch}:${index}`,sourceLabel,actionType:action.type,
          targetLabel:catalog.find(row=>row.kind===action.target.kind && row.id===action.target.id)?.label,
          condition:passed===(branch==="then")?"matched":"not_matched",branch,
          ...("value" in action?{value:action.value}:{}),
        }));
      }
    }
  }
  return {readOnly:true,mode:statusListExecutionMode(contact.settings),actions};
}
