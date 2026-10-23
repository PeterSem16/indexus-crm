import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { insertCampaignStatusListQuestionSchema } from "../../shared/schema";
import { StatusListWorkflowError } from "./status-list-workflow";
import type { RequestHandler } from "express";
import { authorize } from "./status-list-workflow-routes";

export const authorizeStatusListQuestionWrite: RequestHandler = async (req,res,next) => {
  try { await authorize(req,true); next(); }
  catch (error) {
    const status = error instanceof StatusListWorkflowError ? error.status : 500;
    res.status(status).json({error:status === 500 ? "authorization_failed" : (error as StatusListWorkflowError).code});
  }
};

const columns: Record<string, string> = {
  questionText:"question_text",fieldType:"field_type",required:"required",sortOrder:"sort_order",
  icon:"icon",color:"color",description:"description",isHidden:"is_hidden",groupName:"group_name",
  logicOperator:"logic_operator",gotoQuestionId:"goto_question_id",noteEnabled:"note_enabled",previewActions:"preview_actions",
};
/** One parent-scoped transaction keeps all members of a named group consistent. */
export async function saveStatusListQuestionDefinition(pool: Pool, campaignId: string, itemId: string, questionId: string | null, raw: unknown) {
  const input = (questionId ? insertCampaignStatusListQuestionSchema.partial() : insertCampaignStatusListQuestionSchema)
    .parse({...(raw as object),itemId}) as Record<string, any>;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`mission-workflow-config:${campaignId}`]);
    const parent = await client.query("SELECT id FROM campaign_status_list_items WHERE id=$1 AND campaign_id=$2 FOR UPDATE",[itemId,campaignId]);
    if (!parent.rowCount) throw new StatusListWorkflowError("item_not_found",404);
    const current = questionId ? (await client.query("SELECT * FROM campaign_status_list_questions WHERE id=$1 AND item_id=$2 FOR UPDATE",[questionId,itemId])).rows[0] : null;
    if (questionId && !current) throw new StatusListWorkflowError("question_not_found",404);
    const groupName = (input.groupName !== undefined ? input.groupName : current?.group_name)?.trim() || null;
    let logic = input.logicOperator ?? current?.logic_operator ?? "OR";
    if (groupName && (!current || groupName !== current.group_name)) {
      const peer = (await client.query(`SELECT logic_operator FROM campaign_status_list_questions
        WHERE item_id=$1 AND group_name=$2 AND ($3::varchar IS NULL OR id<>$3)
        ORDER BY sort_order,id LIMIT 1`,[itemId,groupName,questionId])).rows[0];
      if (peer) logic = peer.logic_operator;
    }
    input.groupName = groupName; input.logicOperator = logic;
    const entries = Object.entries(input).filter(([key,value]) => key in columns && value !== undefined);
    const values = entries.map(([,value]) => value);
    const id = questionId || randomUUID();
    let row;
    if (questionId) row = (await client.query(`UPDATE campaign_status_list_questions SET
      ${entries.map(([key],i)=>`${columns[key]}=$${i+1}`).join(",")},updated_at=now()
      WHERE id=$${values.length+1} AND item_id=$${values.length+2} RETURNING *`,[...values,id,itemId])).rows[0];
    else row = (await client.query(`INSERT INTO campaign_status_list_questions
      (id,item_id,${entries.map(([key])=>columns[key]).join(",")})
      VALUES($1,$2,${values.map((_,i)=>`$${i+3}`).join(",")}) RETURNING *`,[id,itemId,...values])).rows[0];
    if (groupName) await client.query(`UPDATE campaign_status_list_questions SET logic_operator=$3,updated_at=now()
      WHERE item_id=$1 AND group_name=$2 AND logic_operator IS DISTINCT FROM $3`,[itemId,groupName,logic]);
    await client.query("COMMIT");
    return Object.fromEntries(Object.entries(row).map(([key,value]) => [key.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase()),value]));
  } catch (error) {await client.query("ROLLBACK");throw error;}
  finally {client.release();}
}
