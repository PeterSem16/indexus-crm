import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { StatusListWorkflowError } from "./status-list-workflow";

const text = z.string().trim().min(1).max(180);
const schema = z.object({
  source: z.enum(["representative_assigned", "representative_assignment_type", "reachability", "coordinator"]),
  label: text,
  parentId: z.string().uuid().optional(),
  options: z.record(text).optional(),
}).strict();

/** Creates only editor definitions. No answer, source, workflow or action is activated here. */
export async function createStatusListSourceTarget(client: Pick<PoolClient, "query">, campaignId: string, raw: unknown) {
  const body = schema.parse(raw);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-workflow-config:${campaignId}`]);
  const background = body.source.startsWith("representative_");
  const keys = body.source === "reachability" ? ["not_defined", "waiting", "unreachable", "reachable"] : ["unassigned", "assigned"];
  if (!background && (body.parentId || !body.options || Object.keys(body.options).length !== keys.length || keys.some(key => !body.options![key])))
    throw new StatusListWorkflowError("invalid_source_structure", 400);
  let parentId = body.parentId;
  if (parentId) {
    const parent = (await client.query(`SELECT i.id FROM campaign_status_list_items i
      WHERE i.id=$1 AND i.campaign_id=$2 AND i.confirmation_type<>'auto'
        AND i.question_selection_mode IS DISTINCT FROM 'single'
        AND NOT EXISTS(SELECT 1 FROM campaign_status_list_questions q WHERE q.item_id=i.id AND q.logic_operator='ONE')
      FOR UPDATE`, [parentId, campaignId])).rows[0];
    if (!parent) throw new StatusListWorkflowError("incompatible_source_parent", 409);
  } else {
    parentId = randomUUID();
    await client.query(`INSERT INTO campaign_status_list_items
      (id,campaign_id,step_id,label,confirmation_type,item_type,question_selection_mode,is_hidden,sort_order)
      VALUES($1,$2::varchar,$3,$4,'info','step',$5,$6,
        (SELECT COALESCE(max(sort_order),-1)+1 FROM campaign_status_list_items WHERE campaign_id=$2::varchar))`,
    [parentId, campaignId, `source-${parentId}`, body.label, background ? "multiple" : "single", !background]);
  }
  if (background) {
    const questionId = randomUUID();
    await client.query(`INSERT INTO campaign_status_list_questions
      (id,item_id,question_text,field_type,is_hidden,logic_operator,sort_order)
      VALUES($1,$2::varchar,$3,$4,true,'OR',
        (SELECT COALESCE(max(sort_order),-1)+1 FROM campaign_status_list_questions WHERE item_id=$2::varchar))`,
    [questionId, parentId, body.label, body.source === "representative_assigned" ? "yes_no" : "text"]);
    return { questionId, itemId: parentId };
  }
  const mapping: Record<string, string> = {};
  for (const [index, key] of keys.entries()) {
    const id = randomUUID();
    await client.query(`INSERT INTO campaign_status_list_items
      (id,campaign_id,step_id,label,parent_id,item_type,confirmation_type,sort_order)
      VALUES($1,$2,$3,$4,$5,'option','radio',$6)`,
    [id, campaignId, `source-${id}`, body.options![key], parentId, index]);
    mapping[key] = id;
  }
  return { groupId: parentId, mapping };
}
