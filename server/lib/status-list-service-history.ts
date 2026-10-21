import type { PoolClient } from "pg";

type Reader = Pick<PoolClient, "query">;
/** Read-only projection. Never expose notes, recipients or raw event payloads.
 * Audit presence is not proof of delivery for older service executors. */
export async function readStatusListServiceHistory(client: Reader, campaignId: string, automationId?: string) {
  const { rows } = await client.query(`
    WITH recent AS (
      (SELECT 'service:' || h.id AS id, h.created_at AS at, h.user_id AS actor_id,
        h.metadata->>'automationId' AS automation_id, h.metadata->>'actionType' AS action_type,
        'recorded' AS state, NULL::text AS outcome,
        h.metadata->>'callbackDate' AS callback_date
       FROM campaign_contact_history h
       JOIN campaign_contacts cc ON cc.id=h.campaign_contact_id AND cc.campaign_id=$1
       WHERE h.action='status_list_action' AND h.metadata->>'automationId' IS NOT NULL
         AND NOT (h.metadata ? 'callbackEventId')
         AND ($2::text IS NULL OR h.metadata->>'automationId'=$2)
       ORDER BY h.created_at DESC,h.id DESC LIMIT 100)
      UNION ALL
       (SELECT 'callback:' || e.id, e.created_at, e.actor_id, e.automation_id,
        e.payload->'action'->>'type', e.status, e.result->>'status', e.result->>'callbackDate'
       FROM mission_callback_events e WHERE e.campaign_id=$1
         AND ($2::text IS NULL OR e.automation_id=$2)
        ORDER BY e.created_at DESC,e.id DESC LIMIT 100)
       UNION ALL
       (SELECT 'native:' || n.id,n.created_at,n.actor_id,n.automation_id,
         n.action_type,CASE WHEN n.status='succeeded' THEN 'done' ELSE n.status END,
         NULL::text,
         NULL::text
        FROM status_list_service_executions n WHERE n.campaign_id=$1
          AND ($2::text IS NULL OR n.automation_id=$2)
        ORDER BY n.created_at DESC,n.id DESC LIMIT 100)
    )
    SELECT r.id,r.at,r.automation_id AS "automationId",r.action_type AS "actionType",
      r.state,r.outcome,r.callback_date AS "callbackDate",u.full_name AS "actorName",
      i.label AS "itemLabel",q.question_text AS "questionLabel"
    FROM recent r LEFT JOIN users u ON u.id=r.actor_id
    LEFT JOIN campaign_status_list_automations a ON a.id=r.automation_id
    LEFT JOIN campaign_status_list_items i ON i.id=a.status_list_item_id AND i.campaign_id=$1
    LEFT JOIN campaign_status_list_questions q ON q.id=a.question_id AND q.item_id=i.id
    ORDER BY r.at DESC,r.id DESC LIMIT 100
  `, [campaignId, automationId || null]);
  return { events: rows };
}
