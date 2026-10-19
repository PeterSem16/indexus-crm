import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db";
import {
  answerIsEmpty, statusListWorkflowSchema, workflowConditionMatches,
  type StatusListWorkflow, type WorkflowRef, type WorkflowAnswer, type WorkflowCatalogItem,
} from "../../shared/status-list-workflow";

export class StatusListWorkflowError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
type Queryable = Pick<PoolClient, "query">;
export async function workflowCatalog(campaignId: string, client: Queryable = pool): Promise<WorkflowCatalogItem[]> {
  const { rows } = await client.query(`
    SELECT 'item' AS kind, i.id, i.label, 'checkbox' AS field_type, i.is_hidden AS hidden,
      i.confirmation_type <> 'auto' AS writable, p.label AS parent_label
    FROM campaign_status_list_items i LEFT JOIN campaign_status_list_items p ON p.id=i.parent_id
    WHERE i.campaign_id=$1
    UNION ALL
    SELECT 'question', q.id, q.question_text, COALESCE(q.field_type,'checkbox'), q.is_hidden,
      i.confirmation_type <> 'auto', i.label
    FROM campaign_status_list_questions q JOIN campaign_status_list_items i ON i.id=q.item_id
    WHERE i.campaign_id=$1`, [campaignId]);
  return rows.map(row => ({ kind: row.kind, id: row.id, label: row.label, fieldType: row.field_type,
    hidden: row.hidden, writable: row.writable, parentLabel: row.parent_label }));
}
export function validateWorkflowValue(item: WorkflowCatalogItem, value: unknown) {
  if (!item.writable) throw new StatusListWorkflowError("derived_answer");
  if (item.kind === "item" || ["checkbox", "radio"].includes(item.fieldType)) {
    if (value !== true) throw new StatusListWorkflowError("invalid_answer");
  } else if (item.fieldType === "yesno") {
    if (value !== "yes" && value !== "no") throw new StatusListWorkflowError("invalid_answer");
  } else if (["text", "textarea", "number", "date", "email", "phone"].includes(item.fieldType)) {
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
  if (!source.writable) throw new StatusListWorkflowError("derived_source_requires_background");
  if (rule.sourceValue !== undefined) validateWorkflowValue(source, rule.sourceValue);
  for (const condition of rule.conditions) if (condition.ref) find(condition.ref);
  for (const branch of [rule.thenActions, rule.elseActions]) {
    const targets = new Set<string>();
    for (const action of branch) {
      validateWorkflowValue(find(action.target), action.value);
      const key = `${action.target.kind}:${action.target.id}`;
      if (targets.has(key)) throw new StatusListWorkflowError("duplicate_target");
      targets.add(key);
    }
  }
  return rule;
}
export async function workflowTransaction<T>(campaignContactId: string, fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-workflow:${campaignContactId}`]);
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
      await client.query(`UPDATE mission_status_list_answers SET value='null'::jsonb,revision=$3,updated_by=$4,updated_at=now()
        WHERE campaign_contact_id=$1 AND question_id=$2`, [cc, sibling.id, randomUUID(), actorId]);
      cleared.push({ kind: "question", id: sibling.id, previous: sibling.value });
    }
    await client.query(`INSERT INTO mission_status_list_answers(campaign_contact_id,question_id,value,revision,updated_by)
      VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(campaign_contact_id,question_id)
      DO UPDATE SET value=EXCLUDED.value,revision=EXCLUDED.revision,updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [cc, target.id, JSON.stringify(value), randomUUID(), actorId]);
  } else {
    const siblings = await client.query(`
      SELECT s.status_list_item_id AS id FROM campaign_status_list_items i
      JOIN campaign_status_list_items p ON p.id=i.parent_id AND p.question_selection_mode='single'
      JOIN campaign_status_list_items sibling ON sibling.parent_id=p.id AND sibling.id<>i.id
      JOIN campaign_contact_status_list_state s ON s.status_list_item_id=sibling.id AND s.campaign_contact_id=$2
      WHERE i.id=$1 AND i.campaign_id=$3`, [target.id, cc, campaignId]);
    for (const sibling of siblings.rows) {
      await client.query("DELETE FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2", [cc, sibling.id]);
      cleared.push({ kind: "item", id: sibling.id, previous: true });
    }
    await client.query(`INSERT INTO campaign_contact_status_list_state(campaign_contact_id,status_list_item_id,confirmed_by_user_id)
      SELECT $1::text,$2::text,$3::text WHERE NOT EXISTS
      (SELECT 1 FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1::text AND status_list_item_id=$2::text)`,
    [cc, target.id, actorId]);
  }
  return cleared;
}
type WorkflowEvent = { campaignId: string; campaignContactId: string; actorId: string; source: WorkflowRef;
  value: WorkflowAnswer; eventId: string; occurredAt: Date };
async function executeEvent(client: PoolClient, event: WorkflowEvent) {
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
  for (const stored of rules) {
    const rule = statusListWorkflowSchema.parse(stored.definition);
    if (!rule.enabled || rule.source.kind !== event.source.kind || rule.source.id !== event.source.id) continue;
    if (rule.sourceValue !== undefined && rule.sourceValue !== event.value) continue;
    if (event.source.kind === "item") {
      // Legacy confirmations lack a unique index. Concurrent requests can create
      // member-twin rows; they still represent one continuously confirmed state.
      const duplicate = await client.query(`SELECT r.id FROM mission_status_list_rule_runs r
        JOIN campaign_contact_status_list_state s ON r.source_event='confirmation:'||s.id
        WHERE r.rule_id=$1 AND r.campaign_contact_id=$2 AND s.campaign_contact_id=$2
          AND s.status_list_item_id=$3 LIMIT 1`, [stored.id, event.campaignContactId, event.source.id]);
      if (duplicate.rowCount) continue;
    }
    const claimed = await client.query(`INSERT INTO mission_status_list_rule_runs
      (rule_id,rule_name,campaign_id,campaign_contact_id,source_event,actor_id,branch,results)
      VALUES($1,$2,$3,$4,$5,$6,'pending','[]') ON CONFLICT DO NOTHING RETURNING id`,
    [stored.id, rule.name, event.campaignId, event.campaignContactId, event.eventId, event.actorId]);
    if (!claimed.rowCount) continue;
    let branch: "then" | "else" | "invalid" = "then";
    const results: any[] = [];
    try { await validateWorkflow(event.campaignId, stored.definition, client); }
    catch (error) {
      branch = "invalid";
      results.push({ status: "invalid", reason: error instanceof StatusListWorkflowError ? error.code : "invalid_rule" });
    }
    if (branch !== "invalid") {
      const matches = rule.conditions.map(condition => {
        const value = condition.field === "answer"
          ? snapshot.get(`${condition.ref!.kind}:${condition.ref!.id}`)
          : condition.field === "hospital_id" ? contact.condition_hospital_id
          : condition.field === "clinic_id" ? contact.condition_clinic_id
          : contact[condition.field];
        return workflowConditionMatches(condition, value);
      });
      const passed = !matches.length || (rule.logic === "and" ? matches.every(Boolean) : matches.some(Boolean));
      branch = passed ? "then" : "else";
      for (const action of passed ? rule.thenActions : rule.elseActions) {
        const current = (await readAnswers(client, event.campaignContactId)).get(`${action.target.kind}:${action.target.id}`);
        const occupied = action.mode === "if_empty" && (!answerIsEmpty(current) ||
          await exclusiveAnswerExists(client, event.campaignId, event.campaignContactId, action.target));
        if (occupied || current === action.value) {
          results.push({ target: action.target, status: "skipped", reason: current === action.value ? "unchanged" : "not_empty", previous: current ?? null });
          continue;
        }
        const cleared = await setAnswer(client, { ...event, target: action.target, value: action.value });
        results.push({ target: action.target, status: "changed", previous: current ?? null, value: action.value, cleared });
      }
    }
    const catalog = await workflowCatalog(event.campaignId, client);
    const sourceLabel = catalog.find(entry => entry.kind === event.source.kind && entry.id === event.source.id)?.label;
    if (!results.length) results.push({ status: "skipped", reason: "no_actions" });
    const auditResults = results.map(result => ({
      ...result, source: event.source, sourceLabel,
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
        runId: claimed.rows[0].id, source: event.source, branch, results, chained: false })]);
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
      await setAnswer(client, { ...input, target: { kind: "question", id: input.questionId }, value: input.value });
    }
    await client.query(`INSERT INTO campaign_contact_history(campaign_contact_id,user_id,action,metadata)
      VALUES($1,$2,'status_list_answer',$3::jsonb)`, [input.campaignContactId, input.actorId,
      JSON.stringify({ campaignId: input.campaignId, questionId: input.questionId, previous: before, value: input.value })]);
    if (input.value !== null) {
      const now = await client.query("SELECT clock_timestamp() AS at");
      await executeEvent(client, { ...input, source: { kind: "question", id: input.questionId },
        value: input.value, eventId: `answer:${revision}`, occurredAt: now.rows[0].at });
    }
  });
}
