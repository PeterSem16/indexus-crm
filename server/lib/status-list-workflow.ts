import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { isStatusListHistoryField } from "../../shared/status-list-history";
import { loadStatusListHistoryFacts } from "./status-list-history";
import { pool } from "../db";
import {
  answerIsEmpty, statusListWorkflowSchema, workflowConditionMatches,
  isWorkflowNoteAction, workflowActionSupportsTarget,
  type WorkflowRef, type WorkflowAnswer, type WorkflowCatalogItem,
} from "../../shared/status-list-workflow";
import { preserveWorkflowNote, readWorkflowNotes, writeWorkflowNote } from "./status-list-workflow-notes";
import { callbackBarrier, hasCallbackAdmission } from "./status-list-service";
import { isHealthcareConditionField } from "../../shared/status-list-healthcare-conditions";
import { loadHealthcareConditionFacts } from "./status-list-healthcare";

export class StatusListWorkflowError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
type Queryable = Pick<PoolClient, "query">;
export async function workflowCatalog(campaignId: string, client: Queryable = pool): Promise<WorkflowCatalogItem[]> {
  const { rows } = await client.query(`
    SELECT 'item' AS kind, i.id, i.label, 'checkbox' AS field_type, i.is_hidden AS hidden,
      i.confirmation_type NOT IN ('auto','info') AS writable, p.label AS parent_label,
      i.parent_id, i.sort_order, i.item_type, i.confirmation_type,
      (i.confirmation_type<>'auto' AND i.question_selection_mode IS DISTINCT FROM 'single'
        AND NOT EXISTS(SELECT 1 FROM campaign_status_list_questions sibling WHERE sibling.item_id=i.id AND sibling.logic_operator='ONE')) AS system_source_eligible,
      (i.item_type='option' AND p.id IS NOT NULL AND p.question_selection_mode IS DISTINCT FROM 'single') AS multi_selectable
    FROM campaign_status_list_items i LEFT JOIN campaign_status_list_items p ON p.id=i.parent_id
    WHERE i.campaign_id=$1
    UNION ALL
    SELECT 'question', q.id, q.question_text, COALESCE(q.field_type,'checkbox'), q.is_hidden,
      i.confirmation_type <> 'auto', i.label, q.item_id, q.sort_order, 'question', NULL,
      (i.confirmation_type<>'auto' AND i.question_selection_mode IS DISTINCT FROM 'single'
        AND NOT EXISTS(SELECT 1 FROM campaign_status_list_questions sibling WHERE sibling.item_id=i.id AND sibling.logic_operator='ONE')),
      (q.field_type='checkbox' AND i.question_selection_mode IS DISTINCT FROM 'single' AND q.logic_operator<>'ONE'
        AND NOT EXISTS (SELECT 1 FROM campaign_status_list_questions sibling WHERE sibling.item_id=q.item_id
          AND COALESCE(sibling.group_name,'')=COALESCE(q.group_name,'') AND sibling.logic_operator='ONE'))
    FROM campaign_status_list_questions q JOIN campaign_status_list_items i ON i.id=q.item_id
    WHERE i.campaign_id=$1
    ORDER BY sort_order, kind, id`, [campaignId]);
  const sources = await client.query("SELECT question_id,source FROM mission_status_list_sources WHERE campaign_id=$1", [campaignId]);
  const optionSources = (await client.query(`SELECT s.group_id,s.config,i.is_hidden AS hidden
    FROM mission_status_list_option_sources s JOIN campaign_status_list_items i ON i.id=s.group_id WHERE s.campaign_id=$1`, [campaignId])).rows;
  return rows.map(row => {
    const owner = row.kind === "item" ? optionSources.find(s => s.group_id === row.id || s.group_id === row.parent_id) : undefined;
    return { kind: row.kind, id: row.id, label: row.label, fieldType: row.field_type,
    hidden: row.hidden, writable: row.writable, parentLabel: row.parent_label,
    parentId: row.parent_id || undefined, sortOrder: row.sort_order, itemType: row.item_type, confirmationType: row.confirmation_type, systemSourceEligible: row.system_source_eligible, multiSelectable: row.multi_selectable,
    ...(owner ? { writable: false, hidden: row.hidden || owner.hidden,
      ...(owner.group_id !== row.id ? { backgroundSource: owner.config.source } : {}) } : {}),
    ...(row.kind === "question" && sources.rows.some(s => s.question_id === row.id)
      ? { writable: false, backgroundSource: sources.rows.find(s => s.question_id === row.id)!.source } : {}) };
  });
}
export function validateWorkflowValue(item: WorkflowCatalogItem, value: unknown) {
  if (!item.writable) throw new StatusListWorkflowError("derived_answer");
  if (item.kind === "item" || ["checkbox", "radio"].includes(item.fieldType)) {
    if (value !== true) throw new StatusListWorkflowError("invalid_answer");
  } else if (["yesno", "yes_no"].includes(item.fieldType)) {
    if (value !== "yes" && value !== "no") throw new StatusListWorkflowError("invalid_answer");
  } else if (["text", "string", "textarea", "number", "date", "email", "phone"].includes(item.fieldType)) {
    if (typeof value !== "string" || !value.trim() || value.length > 4000)
      throw new StatusListWorkflowError("invalid_answer");
    if (item.fieldType === "number" && !Number.isFinite(Number(value)))
      throw new StatusListWorkflowError("invalid_answer");
    if (item.fieldType === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new StatusListWorkflowError("invalid_answer");
  } else throw new StatusListWorkflowError("unsupported_question_type");
}
export async function validateWorkflow(campaignId: string, raw: unknown, client: Queryable = pool) {
  const rule = statusListWorkflowSchema.parse(raw);
  const catalog = await workflowCatalog(campaignId, client);
  const find = (ref: WorkflowRef) => {
    const entry = catalog.find(item => item.kind === ref.kind && item.id === ref.id);
    if (!entry) throw new StatusListWorkflowError("reference_outside_mission");
    return entry;
  };
  const source = find(rule.source);
  if (rule.trigger === "background_transition" ? !source.backgroundSource : !source.writable)
    throw new StatusListWorkflowError("derived_source_requires_background");
  if (rule.sourceValue !== undefined) validateWorkflowValue({ ...source, writable: true }, rule.sourceValue);
  for (const condition of rule.conditions) if (condition.ref) find(condition.ref);
  if (rule.conditions.some(condition => isHealthcareConditionField(condition.field))) {
    const sources = (await client.query(`SELECT group_id FROM mission_status_list_option_sources
      WHERE campaign_id=$1 AND config->>'source'='healthcare_reachability' LIMIT 2`, [campaignId])).rows;
    if (sources.length !== 1) throw new StatusListWorkflowError("healthcare_source_unresolved");
  }
  for (const branch of [rule.thenActions, rule.elseActions]) {
    const targets = new Set<string>();
    for (const action of branch) {
      const target = find(action.target);
      if (!target.writable) throw new StatusListWorkflowError("derived_answer");
      if (!workflowActionSupportsTarget(action.type, target)) throw new StatusListWorkflowError("invalid_action_target");
      if (action.type === "set_answer") validateWorkflowValue(target, action.value);
      const key = `${action.target.kind}:${action.target.id}:${isWorkflowNoteAction(action.type) ? "note" : "answer"}`;
      if (targets.has(key)) throw new StatusListWorkflowError("duplicate_target");
      targets.add(key);
    }
  }
  return rule;
}
export async function workflowTransaction<T>(campaignContactId: string, fn: (client: PoolClient) => Promise<T>,
  connections: { connect(): Promise<PoolClient> } = pool) {
  const client = await connections.connect();
  try {
    await client.query("BEGIN");
    const mission = (await client.query("SELECT campaign_id FROM campaign_contacts WHERE id=$1", [campaignContactId])).rows[0];
    if (mission && !hasCallbackAdmission(mission.campaign_id))
      await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))", [callbackBarrier(mission.campaign_id)]);
    await client.query("SELECT set_config('indexus.callback_context',$1,true)", [JSON.stringify({ suppress: true, admitted: true })]);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-workflow:${campaignContactId}`]);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-callback-contact:${campaignContactId}`]);
    const contact = await client.query("SELECT id,campaign_id FROM campaign_contacts WHERE id=$1 FOR UPDATE", [campaignContactId]);
    if (contact.rows[0]) await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",
      [`mission-workflow-config:${contact.rows[0].campaign_id}`]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
async function readAnswers(client: Queryable, campaignContactId: string) {
  const questions = await client.query("SELECT question_id,value FROM mission_status_list_answers WHERE campaign_contact_id=$1", [campaignContactId]);
  const items = await client.query("SELECT status_list_item_id FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1", [campaignContactId]);
  const values = new Map<string, unknown>();
  for (const row of questions.rows) values.set(`question:${row.question_id}`, row.value);
  for (const row of items.rows) values.set(`item:${row.status_list_item_id}`, true);
  return values;
}
async function exclusiveAnswerExists(client: Queryable, campaignId: string, cc: string, target: WorkflowRef) {
  const query = target.kind === "question" ? `
    SELECT sibling.id FROM campaign_status_list_questions q
    JOIN campaign_status_list_items i ON i.id=q.item_id
    JOIN campaign_status_list_questions sibling ON sibling.item_id=q.item_id AND sibling.id<>q.id
    JOIN mission_status_list_answers a ON a.question_id=sibling.id AND a.campaign_contact_id=$2
    WHERE q.id=$1 AND i.campaign_id=$3 AND a.value <> 'null'::jsonb AND (
      i.question_selection_mode='single'
      OR (COALESCE(sibling.group_name,'')=COALESCE(q.group_name,'') AND
        (q.logic_operator='ONE' OR (q.field_type='radio' AND sibling.field_type='radio')))
      OR (q.logic_operator='ONE' AND NOT EXISTS (
        SELECT 1 FROM campaign_status_list_questions other
        WHERE other.item_id=q.item_id AND other.logic_operator<>'ONE'))) LIMIT 1`
    : `SELECT sibling.id FROM campaign_status_list_items i
      JOIN campaign_status_list_items p ON p.id=i.parent_id AND p.question_selection_mode='single'
      JOIN campaign_status_list_items sibling ON sibling.parent_id=p.id AND sibling.id<>i.id
      JOIN campaign_contact_status_list_state s ON s.status_list_item_id=sibling.id AND s.campaign_contact_id=$2
      WHERE i.id=$1 AND i.campaign_id=$3 LIMIT 1`;
  return !!(await client.query(query, [target.id, cc, campaignId])).rowCount;
}
async function setAnswer(client: PoolClient, input: {
  campaignId: string; campaignContactId: string; actorId: string; target: WorkflowRef; value: WorkflowAnswer;
  revision?: string;
}) {
  const { campaignContactId: cc, target, actorId, value, campaignId } = input;
  const cleared: { kind: string; id: string; previous: unknown }[] = [];
  if (target.kind === "question") {
    // Match the real question group's ONE/radio/step-single semantics, including hidden siblings.
    const siblings = await client.query(`
      SELECT sibling.id, a.value FROM campaign_status_list_questions q
      JOIN campaign_status_list_items i ON i.id=q.item_id
      JOIN campaign_status_list_questions sibling ON sibling.item_id=q.item_id AND sibling.id<>q.id
      JOIN mission_status_list_answers a ON a.question_id=sibling.id AND a.campaign_contact_id=$2
      WHERE q.id=$1 AND i.campaign_id=$3 AND a.value <> 'null'::jsonb AND (
        i.question_selection_mode='single'
        OR (COALESCE(sibling.group_name,'')=COALESCE(q.group_name,'') AND
          (q.logic_operator='ONE' OR (q.field_type='radio' AND sibling.field_type='radio')))
        OR (q.logic_operator='ONE' AND NOT EXISTS (
          SELECT 1 FROM campaign_status_list_questions other
          WHERE other.item_id=q.item_id AND other.logic_operator<>'ONE'))
      )`, [target.id, cc, campaignId]);
    for (const sibling of siblings.rows) {
      if ((await client.query("SELECT 1 FROM mission_status_list_sources WHERE question_id=$1", [sibling.id])).rowCount)
        throw new StatusListWorkflowError("derived_answer");
      await client.query(`UPDATE mission_status_list_answers SET value='null'::jsonb,revision=$3,updated_by=$4,updated_at=now()
        WHERE campaign_contact_id=$1 AND question_id=$2`, [cc, sibling.id, randomUUID(), actorId]);
      cleared.push({ kind: "question", id: sibling.id, previous: sibling.value });
    }
    await client.query(`INSERT INTO mission_status_list_answers(campaign_contact_id,question_id,value,revision,updated_by)
      VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(campaign_contact_id,question_id)
      DO UPDATE SET value=EXCLUDED.value,revision=EXCLUDED.revision,updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [cc, target.id, JSON.stringify(value), input.revision ?? randomUUID(), actorId]);
  } else {
    const siblings = await client.query(`
      SELECT s.status_list_item_id AS id FROM campaign_status_list_items i
      JOIN campaign_status_list_items p ON p.id=i.parent_id AND p.question_selection_mode='single'
      JOIN campaign_status_list_items sibling ON sibling.parent_id=p.id AND sibling.id<>i.id
      JOIN campaign_contact_status_list_state s ON s.status_list_item_id=sibling.id AND s.campaign_contact_id=$2
      WHERE i.id=$1 AND i.campaign_id=$3`, [target.id, cc, campaignId]);
    for (const sibling of siblings.rows) {
      await preserveWorkflowNote(client, cc, sibling.id);
      await client.query("DELETE FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2", [cc, sibling.id]);
      cleared.push({ kind: "item", id: sibling.id, previous: true });
    }
    await client.query(`INSERT INTO campaign_contact_status_list_state(campaign_contact_id,status_list_item_id,confirmed_by_user_id,item_note,note_updated_at)
      SELECT $1::text,$2::text,$3::text,
        (SELECT note FROM mission_status_list_notes WHERE campaign_contact_id=$1 AND status_list_item_id=$2),
        (SELECT updated_at FROM mission_status_list_notes WHERE campaign_contact_id=$1 AND status_list_item_id=$2)
      WHERE NOT EXISTS
      (SELECT 1 FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1::text AND status_list_item_id=$2::text)`,
    [cc, target.id, actorId]);
  }
  return cleared;
}
export type WorkflowEvent = { campaignId: string; campaignContactId: string; actorId: string; source: WorkflowRef;
  value: WorkflowAnswer | null; eventId: string; occurredAt: Date; trigger?: "background_transition";
  causation?: { rootEventId: string; parentRunId: string; depth: number; path: string[]; actorKind: "system" | "user" } };
type ChainContext = { queue: WorkflowEvent[]; writes: Set<string>; runs: number; lastRunId?: string };
const refKey = (ref: WorkflowRef) => `${ref.kind}:${ref.id}`;
const actorKind = (event: WorkflowEvent) => event.causation?.actorKind || (event.trigger === "background_transition" ? "system" : "user");
export async function executeEvent(client: PoolClient, event: WorkflowEvent) {
  const context: ChainContext = { queue: [event], writes: new Set([refKey(event.source)]), runs: 0 };
  while (context.queue.length) {
    const next = context.queue.shift()!;
    // Later sibling rules can supersede a queued answer. Never run an obsolete transition.
    if (next.causation && (await readAnswers(client, next.campaignContactId)).get(refKey(next.source)) !== next.value) continue;
    await executeSingleEvent(client, next, context);
  }
}
async function executeSingleEvent(client: PoolClient, event: WorkflowEvent, context: ChainContext) {
  // Only events that actually survive chain/cycle/supersession checks enter the
  // service dispatcher. Mere answer writes and source baselines remain inert.
  if (event.source.kind === "item") {
    await client.query("SELECT set_config('indexus.callback_context',$1,true)", [JSON.stringify({ suppress: false, admitted: true })]);
    await client.query(`SELECT mission_callback_enqueue(id) FROM campaign_contact_status_list_state
      WHERE campaign_contact_id=$1 AND status_list_item_id=$2`, [event.campaignContactId, event.source.id]);
    await client.query("SELECT set_config('indexus.callback_context',$1,true)", [JSON.stringify({ suppress: true, admitted: true })]);
  }
  const { rows: contacts } = await client.query(`SELECT cc.*,
    CASE WHEN cc.contact_type='customer' THEN NULLIF(c.hospital_name,'') ELSE cc.hospital_id END AS condition_hospital_id,
    CASE WHEN cc.contact_type='customer' THEN c.clinic_id ELSE cc.clinic_id END AS condition_clinic_id
    FROM campaign_contacts cc LEFT JOIN customers c ON c.id=cc.customer_id
    WHERE cc.id=$1 AND cc.campaign_id=$2`, [event.campaignContactId, event.campaignId]);
  if (!contacts[0]) throw new StatusListWorkflowError("contact_not_found", 404);
  const contact = contacts[0];
  // Evaluate all siblings against the event snapshot, not earlier rules' writes.
  const snapshot = await readAnswers(client, event.campaignContactId);
  const { rows: rules } = await client.query(`SELECT id,definition FROM mission_status_list_rules
    WHERE campaign_id=$1 AND updated_at <= $2 ORDER BY created_at,id`, [event.campaignId, event.occurredAt]);
  // Read once, on this transaction, only for rules relevant to this event.
  const needsHistory = rules.some(stored => {
    const rule = stored.definition;
    return rule.enabled && rule.source?.kind === event.source.kind && rule.source?.id === event.source.id &&
      rule.trigger === (event.trigger || "agent_confirmation") &&
      rule.conditions?.some((condition: any) => isStatusListHistoryField(condition.field));
  });
  const history = needsHistory ? await loadStatusListHistoryFacts(client, event.campaignId, event.campaignContactId) : null;
  for (const stored of rules) {
    const rule = statusListWorkflowSchema.parse(stored.definition);
    if (rule.trigger !== (event.trigger || "agent_confirmation")) continue;
    if (!rule.enabled || rule.source.kind !== event.source.kind || rule.source.id !== event.source.id) continue;
    if (rule.sourceValue !== undefined && rule.sourceValue !== event.value) continue;
    if (event.source.kind === "item" && event.trigger !== "background_transition" && !event.causation) {
      // Legacy confirmations lack a unique index. Concurrent requests can create
      // member-twin rows; they still represent one continuously confirmed state.
      const duplicate = await client.query(`SELECT r.id FROM mission_status_list_rule_runs r
        JOIN campaign_contact_status_list_state s ON r.source_event='confirmation:'||s.id
        WHERE r.rule_id=$1 AND r.campaign_contact_id=$2 AND s.campaign_contact_id=$2
          AND s.status_list_item_id=$3 LIMIT 1`, [stored.id, event.campaignContactId, event.source.id]);
      if (duplicate.rowCount) continue;
    }
    if (event.causation && context.runs >= 100) {
      if (context.lastRunId) await client.query(`UPDATE mission_status_list_rule_runs
        SET results=results || $2::jsonb WHERE id=$1`, [context.lastRunId,
        JSON.stringify([{ status: "skipped", reason: "chain_limit", chainStatus: "limit_reached", causation: event.causation }])]);
      context.queue.length = 0;
      break;
    }
    const claimed = await client.query(`INSERT INTO mission_status_list_rule_runs
      (rule_id,rule_name,campaign_id,campaign_contact_id,source_event,actor_id,actor_kind,branch,results)
      VALUES($1,$2,$3,$4,$5,$6,$7,'pending','[]') ON CONFLICT DO NOTHING RETURNING id`,
    [stored.id, rule.name, event.campaignId, event.campaignContactId, event.eventId, event.actorId,
      actorKind(event)]);
    if (!claimed.rowCount) continue;
    context.runs++;
    context.lastRunId = claimed.rows[0].id;
    let branch: "then" | "else" | "invalid" = "then";
    const results: any[] = [];
    let healthcare: Awaited<ReturnType<typeof loadHealthcareConditionFacts>> = null;
    try {
      await validateWorkflow(event.campaignId, stored.definition, client);
      if (rule.conditions.some(condition => isHealthcareConditionField(condition.field))) {
        healthcare = await loadHealthcareConditionFacts(client, event.campaignId, event.campaignContactId);
        if (!healthcare) throw new StatusListWorkflowError("healthcare_source_unresolved");
      }
      if (!history && rule.conditions.some(condition => isStatusListHistoryField(condition.field)))
        throw new StatusListWorkflowError("communication_history_unresolved");
    }
    catch (error) {
      branch = "invalid";
      results.push({ status: "invalid", reason: error instanceof StatusListWorkflowError ? error.code : "invalid_rule" });
    }
    if (branch !== "invalid") {
      const matches = rule.conditions.map(condition => {
        const value = isHealthcareConditionField(condition.field) ? healthcare : isStatusListHistoryField(condition.field) ? history?.[condition.field] : condition.field === "answer"
          ? snapshot.get(`${condition.ref!.kind}:${condition.ref!.id}`)
          : condition.field === "hospital_id" ? contact.condition_hospital_id
          : condition.field === "clinic_id" ? contact.condition_clinic_id
          : contact[condition.field];
        return workflowConditionMatches(condition, value);
      });
      const passed = !matches.length || (rule.logic === "and" ? matches.every(Boolean) : matches.some(Boolean));
      branch = passed ? "then" : "else";
      for (const action of passed ? rule.thenActions : rule.elseActions) {
        if (isWorkflowNoteAction(action.type)) {
          const noteKey = `${refKey(action.target)}:note`;
          if ((event.causation || rule.runTargetAutomations) && context.writes.has(noteKey)) {
            results.push({ type: action.type, target: action.target, status: "skipped", reason: "chain_conflict" });
            continue;
          }
          const previous = (await readWorkflowNotes(client, event.campaignContactId))[action.target.id] ?? null;
          const value = action.type === "clear_note" ? null : action.type === "append_note"
            ? [previous, "text" in action ? action.text : ""].filter(Boolean).join("\n")
            : "text" in action ? action.text : null;
          if (value && value.length > 16000) throw new StatusListWorkflowError("note_too_long");
          if (previous === value) results.push({ type: action.type, target: action.target, status: "skipped", reason: "unchanged", previous, value });
          else {
            await writeWorkflowNote(client, event.campaignContactId, action.target.id, event.actorId, value);
            context.writes.add(noteKey);
            results.push({ type: action.type, target: action.target, status: "changed", previous, value });
          }
          continue;
        }
        const key = refKey(action.target);
        const guarded = !!event.causation || !!rule.runTargetAutomations;
        if (guarded && context.writes.has(key)) {
          results.push({ type: action.type, target: action.target, status: "skipped", reason: "chain_conflict" });
          continue;
        }
        const current = (await readAnswers(client, event.campaignContactId)).get(`${action.target.kind}:${action.target.id}`);
        const value = action.type === "set_answer" ? action.value
          : ["confirm_step", "add_selection"].includes(action.type) ? true : null;
        const occupied = (action.type === "confirm_step" || (action.type === "set_answer" && action.mode === "if_empty")) && (!answerIsEmpty(current) ||
          await exclusiveAnswerExists(client, event.campaignId, event.campaignContactId, action.target));
        if (occupied || (current ?? null) === value) {
          results.push({ type: action.type, target: action.target, status: "skipped", reason: (current ?? null) === value ? "unchanged" : "not_empty", previous: current ?? null });
          continue;
        }
        let cleared: { kind: string; id: string; previous: unknown }[] = [];
        if (guarded) await client.query("SAVEPOINT status_list_chain_write");
        if (value === null) {
          if (action.target.kind === "item") {
            await preserveWorkflowNote(client, event.campaignContactId, action.target.id);
            await client.query("DELETE FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2", [event.campaignContactId, action.target.id]);
          } else await client.query(`UPDATE mission_status_list_answers SET value='null'::jsonb,revision=$3,updated_by=$4,updated_at=now()
            WHERE campaign_contact_id=$1 AND question_id=$2`, [event.campaignContactId, action.target.id, randomUUID(), event.actorId]);
        } else {
          cleared = await setAnswer(client, { ...event, target: action.target, value });
        }
        if (guarded && cleared.some(entry => context.writes.has(`${entry.kind}:${entry.id}`))) {
          await client.query("ROLLBACK TO SAVEPOINT status_list_chain_write");
          await client.query("RELEASE SAVEPOINT status_list_chain_write");
          results.push({ type: action.type, target: action.target, status: "skipped", reason: "chain_conflict" });
          continue;
        }
        if (guarded) await client.query("RELEASE SAVEPOINT status_list_chain_write");
        context.writes.add(key);
        cleared.forEach(entry => context.writes.add(`${entry.kind}:${entry.id}`));
        const result: any = { type: action.type, target: action.target, status: "changed", previous: current ?? null, value, cleared };
        if (rule.runTargetAutomations && value !== null) {
          const depth = (event.causation?.depth || 0) + 1;
          const path = event.causation?.path || [refKey(event.source)];
          if (path.includes(key)) result.chainStatus = "cycle_blocked";
          else if (depth > 10 || context.runs + context.queue.length >= 100) result.chainStatus = "limit_reached";
          else {
            result.chainStatus = "queued";
            const identity = action.target.kind === "item"
              ? (await client.query("SELECT id FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2 ORDER BY confirmed_at,id LIMIT 1", [event.campaignContactId, action.target.id])).rows[0]?.id
              : (await client.query("SELECT revision FROM mission_status_list_answers WHERE campaign_contact_id=$1 AND question_id=$2", [event.campaignContactId, action.target.id])).rows[0]?.revision;
            if (!identity) throw new StatusListWorkflowError("chain_identity_missing");
            context.queue.push({ campaignId: event.campaignId, campaignContactId: event.campaignContactId,
              actorId: event.actorId, source: action.target, value, occurredAt: event.occurredAt,
              eventId: `${action.target.kind === "item" ? "confirmation" : "answer"}:${identity}`,
              causation: { rootEventId: event.causation?.rootEventId || event.eventId,
                parentRunId: claimed.rows[0].id, depth, path: [...path, key], actorKind: actorKind(event) } });
          }
        }
        results.push(result);
      }
    }
    const catalog = await workflowCatalog(event.campaignId, client);
    const sourceLabel = catalog.find(entry => entry.kind === event.source.kind && entry.id === event.source.id)?.label;
    if (!results.length) results.push({ status: "skipped", reason: "no_actions" });
    const auditResults = results.map(result => ({
      ...result, source: event.source, sourceLabel,
      ...(event.causation ? { causation: event.causation } : {}),
      targetLabel: catalog.find(entry => entry.kind === result.target?.kind && entry.id === result.target?.id)?.label,
      ...(result.cleared ? { cleared: result.cleared.map((entry: WorkflowRef) => ({
        ...entry, label: catalog.find(item => item.kind === entry.kind && item.id === entry.id)?.label,
      })) } : {}),
    }));
    await client.query("UPDATE mission_status_list_rule_runs SET branch=$2,results=$3::jsonb WHERE id=$1",
      [claimed.rows[0].id, branch, JSON.stringify(auditResults)]);
    await client.query(`INSERT INTO campaign_contact_history(campaign_contact_id,user_id,action,metadata)
      VALUES($1,$2,'status_list_workflow',$3::jsonb)`, [event.campaignContactId, event.actorId,
      JSON.stringify({ campaignId: event.campaignId, ruleId: stored.id, ruleName: rule.name,
         runId: claimed.rows[0].id, source: event.source, branch, results, chained: !!event.causation,
         causation: event.causation, actorKind: actorKind(event) })]);
  }
}
export async function processStatusListItemWorkflow(input: {
  campaignId: string; campaignContactId: string; itemId: string; actorId: string; stateId: string;
}) {
  return workflowTransaction(input.campaignContactId, async client => {
    const state = await client.query(`SELECT id,confirmed_at,confirmed_by_user_id FROM campaign_contact_status_list_state
      WHERE id=$1 AND campaign_contact_id=$2 AND status_list_item_id=$3`, [input.stateId, input.campaignContactId, input.itemId]);
    if (!state.rows[0]) return;
    await executeEvent(client, { ...input, actorId: state.rows[0].confirmed_by_user_id,
      source: { kind: "item", id: input.itemId }, value: true,
      eventId: `confirmation:${input.stateId}`, occurredAt: state.rows[0].confirmed_at });
  });
}
export async function saveWorkflowQuestion(input: {
  campaignId: string; campaignContactId: string; actorId: string; questionId: string; value: WorkflowAnswer | null;
}) {
  return workflowTransaction(input.campaignContactId, async client => {
    if (!(await client.query("SELECT 1 FROM campaign_contacts WHERE id=$1 AND campaign_id=$2",
      [input.campaignContactId, input.campaignId])).rowCount)
      throw new StatusListWorkflowError("contact_not_found", 404);
    const catalog = await workflowCatalog(input.campaignId, client);
    const entry = catalog.find(item => item.kind === "question" && item.id === input.questionId);
    if (!entry) throw new StatusListWorkflowError("question_not_found", 404);
    if (!entry.writable) throw new StatusListWorkflowError("derived_answer");
    if (input.value !== null) validateWorkflowValue(entry, input.value);
    const contact = await client.query("SELECT id FROM campaign_contacts WHERE id=$1 AND campaign_id=$2 FOR UPDATE", [input.campaignContactId, input.campaignId]);
    if (!contact.rowCount) throw new StatusListWorkflowError("contact_not_found", 404);
    const before = (await readAnswers(client, input.campaignContactId)).get(`question:${input.questionId}`) ?? null;
    if (before === input.value) return;
    const revision = randomUUID();
    if (input.value === null) {
      await client.query(`UPDATE mission_status_list_answers SET value='null'::jsonb,revision=$3,updated_by=$4,updated_at=now()
        WHERE campaign_contact_id=$1 AND question_id=$2`, [input.campaignContactId, input.questionId, revision, input.actorId]);
    } else {
      await setAnswer(client, { ...input, revision, target: { kind: "question", id: input.questionId }, value: input.value });
    }
    await client.query(`INSERT INTO campaign_contact_history(campaign_contact_id,user_id,action,metadata)
      VALUES($1,$2,'status_list_answer',$3::jsonb)`, [input.campaignContactId, input.actorId,
      JSON.stringify({ campaignId: input.campaignId, questionId: input.questionId, previous: before, value: input.value })]);
    if (input.value !== null) {
      const now = await client.query("SELECT clock_timestamp() AS at");
      await executeEvent(client, { ...input, source: { kind: "question", id: input.questionId },
        value: input.value, eventId: `answer:${revision}`, occurredAt: now.rows[0].at });
      return { revision };
    }
  });
}

/** One user change (including radio siblings), or the final Batch answer draft.
 * Validate everything first, persist the complete snapshot, then evaluate rules.
 * Stable revisions bind native services to the same event across lost responses.
 */
export async function saveWorkflowQuestions(input: {
  campaignId: string; campaignContactId: string; actorId: string; requestId: string;
  changes: Array<{ questionId: string; expected: WorkflowAnswer | null; value: WorkflowAnswer | null }>;
}, connections: { connect(): Promise<PoolClient> } = pool) {
  return workflowTransaction(input.campaignContactId, async client => {
    if (!(await client.query("SELECT 1 FROM campaign_contacts WHERE id=$1 AND campaign_id=$2",
      [input.campaignContactId, input.campaignId])).rowCount)
      throw new StatusListWorkflowError("contact_not_found", 404);
    const catalog = await workflowCatalog(input.campaignId, client);
    const current = (await client.query(`SELECT question_id,value,revision,updated_by
      FROM mission_status_list_answers WHERE campaign_contact_id=$1`, [input.campaignContactId])).rows;
    const before = new Map(current.map(row => [row.question_id, row]));
    const seen = new Set<string>();
    for (const change of input.changes) {
      if (seen.has(change.questionId)) throw new StatusListWorkflowError("duplicate_question");
      seen.add(change.questionId);
      const entry = catalog.find(item => item.kind === "question" && item.id === change.questionId);
      if (!entry || entry.hidden || !entry.writable) throw new StatusListWorkflowError("question_not_writable");
      if (change.value !== null) validateWorkflowValue(entry, change.value);
      const previous = before.get(change.questionId);
      const ownRetry = previous?.revision === `${input.requestId}:${change.questionId}` && previous?.updated_by === input.actorId;
      if (ownRetry && previous.value !== change.value) throw new StatusListWorkflowError("request_id_conflict", 409);
      if (!ownRetry && (previous?.value ?? null) !== change.expected)
        throw new StatusListWorkflowError("answer_conflict", 409);
    }
    const final = new Map(current.map(row => [row.question_id, row.value]));
    input.changes.forEach(change => final.set(change.questionId, change.value));
    const groups = (await client.query(`SELECT q.id,q.item_id,q.group_name,q.logic_operator,q.field_type,
      i.question_selection_mode FROM campaign_status_list_questions q
      JOIN campaign_status_list_items i ON i.id=q.item_id WHERE i.campaign_id=$1`,
    [input.campaignId])).rows;
    for (const selected of groups.filter(row => final.get(row.id) != null)) {
      const siblings = groups.filter(row => row.item_id === selected.item_id && final.get(row.id) != null);
      const sameGroup = siblings.filter(row => (row.group_name || "") === (selected.group_name || ""));
      if ((selected.question_selection_mode === "single" && siblings.length > 1) ||
          (selected.logic_operator === "ONE" && sameGroup.length > 1) ||
          (selected.field_type === "radio" && sameGroup.filter(row => row.field_type === "radio").length > 1))
        throw new StatusListWorkflowError("answer_group_conflict", 409);
    }
    const events: Array<{ questionId: string; revision: string; value: WorkflowAnswer; repeated?: boolean }> = [];
    for (const change of input.changes) {
      const previous = before.get(change.questionId);
      const revision = `${input.requestId}:${change.questionId}`;
      if (previous?.revision === revision && previous?.updated_by === input.actorId) {
        if (change.value !== null) events.push({ questionId: change.questionId, revision, value: change.value, repeated: true });
        continue;
      }
      if ((previous?.value ?? null) === change.value) continue;
      await client.query(`INSERT INTO mission_status_list_answers(campaign_contact_id,question_id,value,revision,updated_by)
        VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(campaign_contact_id,question_id) DO UPDATE
        SET value=EXCLUDED.value,revision=EXCLUDED.revision,updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [input.campaignContactId, change.questionId, JSON.stringify(change.value), revision, input.actorId]);
      await client.query(`INSERT INTO campaign_contact_history(campaign_contact_id,user_id,action,metadata)
        VALUES($1,$2,'status_list_answer',$3::jsonb)`, [input.campaignContactId, input.actorId,
        JSON.stringify({ campaignId: input.campaignId, questionId: change.questionId,
          previous: previous?.value ?? null, value: change.value })]);
      if (change.value !== null) events.push({ questionId: change.questionId, revision, value: change.value });
    }
    const now = (await client.query("SELECT clock_timestamp() AS at")).rows[0].at;
    for (const event of events.filter(event => !event.repeated)) await executeEvent(client, {
      ...input, source: { kind: "question", id: event.questionId }, value: event.value,
      eventId: `answer:${event.revision}`, occurredAt: now,
    });
    return events;
  }, connections);
}
