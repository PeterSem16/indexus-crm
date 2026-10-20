import type { PoolClient } from "pg";
import { pool } from "../db";
import {
  evaluateReachability, optionSourceConfigSchema,
  type CommunicationEvidence, type OptionSourceConfig,
} from "../../shared/status-list-option-source";
import { StatusListWorkflowError, type WorkflowEvent } from "./status-list-workflow";
import { preserveWorkflowNote } from "./status-list-workflow-notes";
import { isStatusListSourceGroup } from "../../shared/status-list-source-group";
import { lockCallbackTransition, assertCallbackConfigurationIndependent } from "./status-list-callback-transition";

const SYSTEM = "system:mission-status-list";
type Queryable = Pick<PoolClient, "query">;

export async function validateOptionSource(client: Queryable, campaignId: string, groupId: string, raw: unknown, validateUsers = true) {
  const config = optionSourceConfigSchema.parse(raw);
  const { rows } = await client.query(`SELECT id,parent_id,item_type,confirmation_type FROM campaign_status_list_items
    WHERE campaign_id=$1 AND (id=$2 OR parent_id=$2)`, [campaignId, groupId]);
  const parent = rows.find(row => row.id === groupId);
  const children = rows.filter(row => row.parent_id === groupId);
  const node = (row: any) => ({ itemType: row.item_type, confirmationType: row.confirmation_type });
  if (!isStatusListSourceGroup(parent && node(parent), children.map(node)))
    throw new StatusListWorkflowError("invalid_source_group");
  const ids = children.map(row => row.id);
  // A source owns the whole immediate option group. Nested questions/options
  // could otherwise leave contradictory manual answers under a derived state.
  if ((await client.query(`SELECT 1 FROM campaign_status_list_questions WHERE item_id=ANY($1::varchar[])
      UNION ALL SELECT 1 FROM campaign_status_list_items WHERE parent_id=ANY($2::varchar[]) LIMIT 1`,
    [[groupId, ...ids], ids])).rowCount) throw new StatusListWorkflowError("invalid_source_group");
  const mapped = [...Object.values(config.mapping), ...(config.source === "coordinator" ? config.users.map(u => u.optionId) : [])];
  if (mapped.some(id => !ids.includes(id))) throw new StatusListWorkflowError("reference_outside_group");
  if (validateUsers && config.source === "coordinator" && config.users.length) {
    const users = (await client.query(`SELECT user_id AS id FROM campaign_agents WHERE campaign_id=$1
      UNION SELECT assigned_to FROM campaign_contacts WHERE campaign_id=$1 AND assigned_to IS NOT NULL`, [campaignId])).rows;
    if (config.users.some(user => !users.some(row => row.id === user.userId))) throw new StatusListWorkflowError("coordinator_outside_mission");
  }
  // Never nest two source owners.
  if ((await client.query(`SELECT 1 FROM mission_status_list_option_sources
    WHERE campaign_id=$1 AND group_id<>$2 AND (group_id=ANY($3::varchar[]) OR group_id=$4) LIMIT 1`,
  [campaignId, groupId, ids, parent.parent_id])).rowCount) throw new StatusListWorkflowError("overlapping_sources");
  return config;
}

export async function configureOptionSource(campaignId: string, groupId: string, raw: unknown | null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockCallbackTransition(client, campaignId, true);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-workflow-config:${campaignId}`]);
    if (raw === null) {
      await client.query("DELETE FROM mission_status_list_option_sources WHERE campaign_id=$1 AND group_id=$2", [campaignId, groupId]);
    } else {
      const config = await validateOptionSource(client, campaignId, groupId, raw);
      // Visibility is presentation-only and does not reset the transition baseline.
      const { hidden, ...definition } = config;
      await client.query(`INSERT INTO mission_status_list_option_sources(campaign_id,group_id,config)
        VALUES($1,$2,$3::jsonb) ON CONFLICT(group_id) DO UPDATE SET
        revision=CASE WHEN (mission_status_list_option_sources.config-'hidden')<>(EXCLUDED.config-'hidden')
          THEN gen_random_uuid()::text ELSE mission_status_list_option_sources.revision END,config=EXCLUDED.config`,
      [campaignId, groupId, JSON.stringify({ ...definition, hidden })]);
      await client.query("UPDATE campaign_status_list_items SET is_hidden=$2,updated_at=now() WHERE id=$1", [groupId, hidden]);
    }
    await assertCallbackConfigurationIndependent(client, campaignId);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

/** Explicit manager action for upgrading an existing three-state group. */
export async function addWaitingOption(campaignId: string, groupId: string, label: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-workflow-config:${campaignId}`]);
    const group = (await client.query(`SELECT * FROM campaign_status_list_items
      WHERE id=$1 AND campaign_id=$2 AND confirmation_type<>'auto'`, [groupId, campaignId])).rows[0];
    const children = (await client.query(`SELECT id,item_type,confirmation_type,sort_order FROM campaign_status_list_items
      WHERE parent_id=$1 AND campaign_id=$2`, [groupId, campaignId])).rows;
    const node = (row: any) => ({ itemType: row.item_type, confirmationType: row.confirmation_type });
    if (children.length !== 3 || !isStatusListSourceGroup(group && node(group), children.map(node)))
      throw new StatusListWorkflowError("invalid_source_group");
    if ((await client.query(`SELECT 1 FROM campaign_status_list_questions WHERE item_id=ANY($1::varchar[])
      UNION ALL SELECT 1 FROM campaign_status_list_items WHERE parent_id=ANY($2::varchar[]) LIMIT 1`,
    [[groupId, ...children.map(child => child.id)], children.map(child => child.id)])).rowCount)
      throw new StatusListWorkflowError("invalid_source_group");
    if ((await client.query("SELECT 1 FROM mission_status_list_option_sources WHERE group_id=$1", [groupId])).rowCount)
      throw new StatusListWorkflowError("source_already_configured", 409);
    const row = (await client.query(`INSERT INTO campaign_status_list_items
       (campaign_id,parent_id,step_id,label,item_type,sort_order,tab,confirmation_type)
       VALUES($1,$2,$3,$4,$7,$5,$6,$8) RETURNING id`,
     [campaignId, groupId, `${group.step_id}-WAIT`, label, Math.max(...children.map(child => child.sort_order)) + 1,
       group.tab, children[0].item_type, children[0].item_type === "step" ? "radio" : "checkbox"])).rows[0];
    await client.query("COMMIT");
    return row;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function communicationEvidence(client: Queryable, contact: any, config: Extract<OptionSourceConfig, { source: "reachability" }>) {
  const evidence: CommunicationEvidence[] = [];
  if (config.policy.calls) {
    const calls = (await client.query(`SELECT id,sip_call_id,status,answered_at,started_at,ended_at,duration_seconds,is_forwarded FROM call_logs
      WHERE campaign_id=$1 AND campaign_contact_id=$2`, [contact.campaign_id, contact.id])).rows;
    for (const call of calls) {
      // Forwarded caller-channel Up is not proof the callee answered.
      const success = !call.is_forwarded && call.answered_at && ["answered", "completed"].includes(call.status) &&
        Number(call.duration_seconds) >= config.policy.minimumTalkSeconds;
      const failed = ["failed", "no_answer", "busy", "cancelled"].includes(call.status) ||
        (call.status === "completed" && !call.answered_at);
      if (success || failed) evidence.push({ id: `call:${call.sip_call_id || call.id}`, channel: "calls", kind: success ? "success" : "failure",
        at: new Date(success ? call.answered_at : call.ended_at || call.started_at).getTime() });
    }
  }
  if (config.policy.email || config.policy.sms) {
    const entityId = contact[`${contact.contact_type}_id`];
    // Never infer Mission membership from a phone/email address, owner, session,
    // or a nearby timestamp. Unattributed legacy communication is not evidence.
    const messages = (await client.query(`SELECT m.id,m.type,m.direction,m.status,m.sent_at,m.created_at
      FROM communication_messages m WHERE m.type IN ('email','sms') AND (
        (m.campaign_id=$1 AND ((m.entity_type=$2 AND m.entity_id=$3) OR
          ($2='customer' AND m.customer_id=$3 AND m.entity_type IS NULL)))
        OR (m.campaign_id IS NULL AND m.direction='inbound' AND EXISTS(
          SELECT 1 FROM communication_messages original WHERE original.id=m.reply_to_sms_id
          AND original.campaign_id=$1 AND original.direction='outbound'
          AND original.entity_type=$2 AND original.entity_id=$3)))`,
    [contact.campaign_id, contact.contact_type, entityId])).rows;
    for (const message of messages) {
      const inbound = message.direction === "inbound";
      if (!inbound && !["sent", "delivered", "failed"].includes(message.status)) continue;
      evidence.push({ id: `message:${message.id}`, channel: message.type,
        kind: inbound ? "success" : message.status === "failed" ? "failure" : "waiting",
        at: new Date(message.sent_at || message.created_at).getTime() });
    }
  }
  return evidence;
}

/** Writes all group answers before any rules run, under the contact transaction. */
export async function evaluateOptionSources(client: PoolClient, contactId: string): Promise<WorkflowEvent[]> {
  const sources = (await client.query(`SELECT s.*,i.label FROM mission_status_list_option_sources s
    JOIN campaign_contacts cc ON cc.campaign_id=s.campaign_id JOIN campaign_status_list_items i ON i.id=s.group_id
    WHERE cc.id=$1 ORDER BY s.group_id`, [contactId])).rows;
  if (!sources.length) return [];
  const contact = (await client.query("SELECT * FROM campaign_contacts WHERE id=$1", [contactId])).rows[0];
  const events: WorkflowEvent[] = [];
  await client.query("SELECT set_config('indexus.status_list_source_writer','on',true)");
  for (const source of sources) {
    const config = await validateOptionSource(client, contact.campaign_id, source.group_id, source.config, false);
    const at = (await client.query("SELECT clock_timestamp() AS at")).rows[0].at;
    const value = config.source === "coordinator"
      ? contact.assigned_to || "unassigned"
      : evaluateReachability(await communicationEvidence(client, contact, config), config.policy, new Date(at).getTime());
    const selected = config.source === "coordinator"
      ? (contact.assigned_to ? config.users.find(user => user.userId === contact.assigned_to)?.optionId || config.mapping.assigned : config.mapping.unassigned)
      : config.mapping[value as keyof typeof config.mapping];
    const old = (await client.query(`SELECT * FROM mission_status_list_option_source_state
      WHERE campaign_contact_id=$1 AND group_id=$2`, [contactId, source.group_id])).rows[0];
    const baseline = !old || old.config_revision !== source.revision;
    if (!baseline && old.value === value && old.option_id === selected) continue;
    const previous = (await client.query(`SELECT s.status_list_item_id FROM campaign_contact_status_list_state s
      JOIN campaign_status_list_items i ON i.id=s.status_list_item_id
      WHERE s.campaign_contact_id=$1 AND i.parent_id=$2 ORDER BY s.status_list_item_id`, [contactId, source.group_id])).rows;
    for (const row of previous) {
      await preserveWorkflowNote(client, contactId, row.status_list_item_id);
      if (row.status_list_item_id !== selected) await client.query(`DELETE FROM campaign_contact_status_list_state
        WHERE campaign_contact_id=$1 AND status_list_item_id=$2`, [contactId, row.status_list_item_id]);
    }
    await client.query(`INSERT INTO campaign_contact_status_list_state
      (campaign_contact_id,status_list_item_id,confirmed_by_user_id,item_note,note_updated_at)
      SELECT $1,$2,$3,n.note,n.updated_at FROM (SELECT 1) dummy
      LEFT JOIN mission_status_list_notes n ON n.campaign_contact_id=$1 AND n.status_list_item_id=$2
      WHERE NOT EXISTS(SELECT 1 FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2)`,
    [contactId, selected, SYSTEM]);
    await client.query(`INSERT INTO mission_status_list_option_source_state(campaign_contact_id,group_id,config_revision,value,option_id)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(campaign_contact_id,group_id) DO UPDATE SET
      config_revision=EXCLUDED.config_revision,value=EXCLUDED.value,option_id=EXCLUDED.option_id,updated_at=now()`,
    [contactId, source.group_id, source.revision, value, selected]);
    const labels = (await client.query("SELECT id,label FROM campaign_status_list_items WHERE id=ANY($1::varchar[])",
      [[selected, ...(old ? [old.option_id] : [])]])).rows;
    const previousLabel = labels.find(row => row.id === old?.option_id)?.label ?? null;
    const valueLabel = labels.find(row => row.id === selected)?.label ?? null;
    const transition = (await client.query(`INSERT INTO mission_status_list_transitions
      (campaign_id,campaign_contact_id,question_id,question_label,previous,value,baseline,target_kind,previous_label,value_label)
      VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,'item',$8,$9) RETURNING id,created_at`,
    [contact.campaign_id, contactId, source.group_id, source.label, JSON.stringify(old?.value ?? null),
      JSON.stringify(value), baseline, previousLabel, valueLabel])).rows[0];
    await client.query(`INSERT INTO campaign_contact_history(campaign_contact_id,user_id,action,metadata)
      VALUES($1,$2,'status_list_background',$3::jsonb)`, [contactId, SYSTEM, JSON.stringify({
      campaignId: contact.campaign_id, source: config.source, groupId: source.group_id,
      previous: old?.value ?? null, value, optionId: selected, baseline, actorKind: "system",
    })]);
    if (!baseline && old.option_id !== selected) events.push({
      campaignId: contact.campaign_id, campaignContactId: contactId, actorId: SYSTEM,
      source: { kind: "item", id: selected }, value: true, eventId: `transition:${transition.id}`,
      occurredAt: transition.created_at, trigger: "background_transition",
    });
  }
  await client.query("SELECT set_config('indexus.status_list_source_writer','off',true)");
  return events;
}
