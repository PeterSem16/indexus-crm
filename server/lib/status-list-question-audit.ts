import type { PoolClient } from "pg";
import { z } from "zod";
import { StatusListWorkflowError } from "./status-list-workflow";

type Reader = Pick<PoolClient, "query">;
export const questionNoteSchema = z.object({ note: z.string().max(10000).nullable() }).strict();

/** Read persisted provenance, never infer the author from the current agent. */
export async function readQuestionAudit(client: Reader, campaignId: string, contactId: string) {
  const answers = await client.query(`
    SELECT a.question_id,a.updated_at AS "answeredAt",u.full_name AS "answeredByName",
      CASE WHEN a.updated_by LIKE 'system:%' THEN 'system' ELSE 'user' END AS "actorKind"
    FROM mission_status_list_answers a
    JOIN campaign_status_list_questions q ON q.id=a.question_id
    JOIN campaign_status_list_items i ON i.id=q.item_id AND i.campaign_id=$2
    LEFT JOIN users u ON u.id=a.updated_by
    WHERE a.campaign_contact_id=$1 AND a.value<>'null'::jsonb`, [contactId, campaignId]);
  const notes = await client.query(`
    SELECT n.question_id,n.note,n.updated_at AS "updatedAt",u.full_name AS "updatedByName"
    FROM mission_status_list_question_notes n
    JOIN campaign_status_list_questions q ON q.id=n.question_id
    JOIN campaign_status_list_items i ON i.id=q.item_id AND i.campaign_id=$2
    LEFT JOIN users u ON u.id=n.updated_by
    WHERE n.campaign_contact_id=$1`, [contactId, campaignId]);
  const map = (rows: Record<string, unknown>[]) => Object.fromEntries(rows.map(({ question_id, ...rest }) => [String(question_id), rest]));
  return { answerMetadata: map(answers.rows), questionNotes: map(notes.rows) };
}

/** Caller owns transaction and authorization. A note is deliberately not an answer. */
export async function writeQuestionNote(client: Reader, input: {
  campaignId: string; contactId: string; questionId: string; actorId: string; note: string | null;
}) {
  const { campaignId, contactId, questionId, actorId, note } = input;
  const question = (await client.query(`
    SELECT q.question_text FROM campaign_status_list_questions q
    JOIN campaign_status_list_items i ON i.id=q.item_id
    JOIN campaign_contacts cc ON cc.campaign_id=i.campaign_id AND cc.id=$2
    WHERE q.id=$1 AND i.campaign_id=$3 FOR SHARE OF q,i,cc`,
  [questionId, contactId, campaignId])).rows[0];
  if (!question) throw new StatusListWorkflowError("question_not_found", 404);
  // Serialize note edits without taking the answer/automation admission path.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`question-note:${contactId}:${questionId}`]);
  const previous = (await client.query(`SELECT note FROM mission_status_list_question_notes
    WHERE campaign_contact_id=$1 AND question_id=$2`, [contactId, questionId])).rows[0];
  if (previous && previous.note === note) return;
  await client.query(`INSERT INTO mission_status_list_question_notes(campaign_contact_id,question_id,note,updated_by)
    VALUES($1,$2,$3,$4) ON CONFLICT(campaign_contact_id,question_id)
    DO UPDATE SET note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,updated_at=now()`,
  [contactId, questionId, note, actorId]);
  await client.query(`INSERT INTO campaign_contact_history(campaign_contact_id,user_id,action,metadata)
    VALUES($1,$2,'status_list_question_note_update',$3::jsonb)`, [contactId, actorId, JSON.stringify({
    campaignId, questionId, questionText: question.question_text, previousNote: previous?.note ?? null, note,
  })]);
}
