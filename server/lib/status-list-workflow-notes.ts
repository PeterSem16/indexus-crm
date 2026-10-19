import type { PoolClient } from "pg";

type Queryable = Pick<PoolClient, "query">;

/** Independent notes win, including an explicit null (clear). Legacy notes
 * remain readable without a bulk migration of operational data. */
export async function readWorkflowNotes(client: Queryable, contactId: string) {
  const { rows } = await client.query(`
    SELECT status_list_item_id,note FROM mission_status_list_notes WHERE campaign_contact_id=$1
    UNION ALL
    SELECT DISTINCT ON (s.status_list_item_id) s.status_list_item_id,s.item_note AS note
    FROM campaign_contact_status_list_state s WHERE s.campaign_contact_id=$1 AND s.item_note IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM mission_status_list_notes n
        WHERE n.campaign_contact_id=$1 AND n.status_list_item_id=s.status_list_item_id)`, [contactId]);
  return Object.fromEntries(rows.map(row => [row.status_list_item_id, row.note])) as Record<string, string | null>;
}

export async function writeWorkflowNote(client: Queryable, contactId: string, itemId: string, actorId: string, note: string | null) {
  await client.query(`INSERT INTO mission_status_list_notes(campaign_contact_id,status_list_item_id,note,updated_by)
    VALUES($1,$2,$3,$4) ON CONFLICT(campaign_contact_id,status_list_item_id)
    DO UPDATE SET note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,updated_at=now()`, [contactId, itemId, note, actorId]);
  // Compatibility with the existing agent note editor, without inventing a
  // confirmation row when the step is unconfirmed.
  await client.query(`UPDATE campaign_contact_status_list_state SET item_note=$3,note_updated_at=now()
    WHERE campaign_contact_id=$1 AND status_list_item_id=$2`, [contactId, itemId, note]);
}

export async function preserveWorkflowNote(client: Queryable, contactId: string, itemId: string) {
  await client.query(`INSERT INTO mission_status_list_notes(campaign_contact_id,status_list_item_id,note,updated_by,updated_at)
    SELECT campaign_contact_id,status_list_item_id,item_note,confirmed_by_user_id,COALESCE(note_updated_at,confirmed_at)
    FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2 AND item_note IS NOT NULL
    ORDER BY COALESCE(note_updated_at,confirmed_at) DESC LIMIT 1
    ON CONFLICT(campaign_contact_id,status_list_item_id) DO NOTHING`, [contactId, itemId]);
}
