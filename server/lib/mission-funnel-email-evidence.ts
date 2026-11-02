export interface FunnelEmailEvidence {
  id: string; contactId: string; at: string | null; actorId?: string | null;
  /** Record creation is not a substitute for an unknown sending time. */
  recordedAt?: string | null;
}
type Queryable = { query(sql: string, params?: any[]): Promise<{ rows: any[] }> };
/** Successful, Mission-bound contact-email actions from the configured email
 * step are evidence of sending even if the agent did not tick "Sent".
 * A subject match, arbitrary email, failed action or current checkbox is not. */
export async function loadFunnelEmailEvidence(
  database: Queryable, missionId: string, contactIds: string[], emailItemIds: string[],
): Promise<FunnelEmailEvidence[]> {
  if (!emailItemIds.length || !contactIds.length) return [];
  const result = await database.query(`
    WITH email_sources AS (
      SELECT id FROM campaign_status_list_items WHERE campaign_id=$1 AND id=ANY($3::text[])
      UNION
      SELECT parent_id FROM campaign_status_list_items
        WHERE campaign_id=$1 AND id=ANY($3::text[]) AND parent_id IS NOT NULL
    )
    SELECT 'service:'||e.id AS id,e.campaign_contact_id AS "contactId",
      e.actor_id AS "actorId",e.finished_at AS at,NULL::timestamp AS "recordedAt"
    FROM status_list_service_executions e
    JOIN campaign_contacts cc ON cc.id=e.campaign_contact_id AND cc.campaign_id=$1
    JOIN campaign_status_list_automations a ON a.id=e.automation_id
    JOIN campaign_status_list_items i ON i.id=a.status_list_item_id AND i.campaign_id=$1
    WHERE e.campaign_id=$1 AND e.campaign_contact_id=ANY($2::text[])
      AND e.status='succeeded' AND e.result->>'ok'='true'
      AND COALESCE(e.result->>'skipped','false')='false'
      AND COALESCE(e.result#>>'{output,skipped}','false')='false'
      AND e.action_type IN ('send_contact_email','send_email_group')
      AND i.id IN (SELECT id FROM email_sources)
      AND e.finished_at IS NOT NULL
      AND COALESCE(e.result#>>'{output,sentCount}','0') ~ '^[1-9][0-9]*$'
      AND COALESCE(e.result#>>'{output,failedCount}','0')='0'
    UNION ALL
    SELECT 'action:'||h.id,h.campaign_contact_id,h.user_id,h.created_at,NULL::timestamp
    FROM campaign_contact_history h
    JOIN campaign_contacts cc ON cc.id=h.campaign_contact_id AND cc.campaign_id=$1
    JOIN campaign_status_list_items i ON i.id=h.metadata->>'statusListItemId' AND i.campaign_id=$1
    WHERE h.campaign_contact_id=ANY($2::text[]) AND h.action='status_list_action'
      AND h.metadata->>'actionType' IN ('send_contact_email','send_email_group')
      AND h.metadata->>'ok'='true'
      AND COALESCE(h.metadata->>'skipped','false')='false'
      AND COALESCE(h.metadata#>>'{output,skipped}','false')='false'
      AND i.id IN (SELECT id FROM email_sources)
      AND COALESCE(h.metadata#>>'{output,sentCount}','0') ~ '^[1-9][0-9]*$'
      AND COALESCE(h.metadata#>>'{output,failedCount}','0')='0'
    UNION ALL
    SELECT 'review:'||h.id,h.campaign_contact_id,m.user_id,m.sent_at,m.created_at
    FROM campaign_contact_history h
    JOIN campaign_contacts cc ON cc.id=h.campaign_contact_id AND cc.campaign_id=$1
    JOIN communication_messages m ON m.id=h.metadata->>'messageId'
      AND m.customer_id=cc.clinic_id AND m.campaign_id=$1
    WHERE h.campaign_contact_id=ANY($2::text[]) AND h.action='mission_email_attribution'
      AND h.metadata->>'purpose'='contract_proposal'
      AND m.type='email' AND m.direction='outbound'
      AND m.status IN ('sent','delivered','read')
  `, [missionId, contactIds, emailItemIds]);
  const iso = (value: unknown) => value == null ? null : value instanceof Date ? value.toISOString() : String(value);
  return result.rows.map(row => ({ ...row, at: iso(row.at),
    ...(row.recordedAt != null ? { recordedAt: iso(row.recordedAt) } : {}),
  })).sort((a, b) => (a.at ? Date.parse(a.at) : Infinity) - (b.at ? Date.parse(b.at) : Infinity) ||
    (a.recordedAt ? Date.parse(a.recordedAt) : Infinity) - (b.recordedAt ? Date.parse(b.recordedAt) : Infinity) ||
    a.id.localeCompare(b.id));
}
