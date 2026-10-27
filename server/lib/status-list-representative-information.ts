import type { PoolClient } from "pg";
import type { StatusListRepresentativeInformation } from "../../shared/status-list-representative-information";

/** Reads current facility assignments without writing answers or executing rules.
 * Must be called after authorizing this exact Mission membership.
 * Unknown/ambiguous entities are deliberately never reported as unassigned.
 */
export async function readStatusListRepresentativeInformation(
  client: Pick<PoolClient, "query">, campaignId: string, contactId: string,
): Promise<StatusListRepresentativeInformation[]> {
  const { rows } = await client.query(`SELECT q.id AS question_id,q.question_text,
    CASE cc.contact_type
      WHEN 'clinic' THEN EXISTS(SELECT 1 FROM clinics WHERE id=cc.clinic_id)
      WHEN 'hospital' THEN EXISTS(SELECT 1 FROM hospitals WHERE id=cc.hospital_id)
      ELSE false END AS known,
    a.assignment_count,a.representative_name
    FROM campaign_contacts cc
    JOIN mission_status_list_sources s ON s.campaign_id=cc.campaign_id
      AND s.source='representative_assigned' AND s.show_information=true
      AND (s.check_config IS NULL OR s.check_config->>'enabled'='true')
    JOIN campaign_status_list_questions q ON q.id=s.question_id
    JOIN campaign_status_list_items i ON i.id=q.item_id AND i.campaign_id=cc.campaign_id
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS assignment_count,max(u.full_name) AS representative_name
      FROM (
        SELECT user_id FROM clinic_representative_assignments
          WHERE cc.contact_type='clinic' AND clinic_id=cc.clinic_id
            AND valid_to IS NULL AND valid_from<=now()
        UNION ALL
        SELECT user_id FROM hospital_representative_assignments
          WHERE cc.contact_type='hospital' AND hospital_id=cc.hospital_id
            AND valid_to IS NULL AND valid_from<=now()
      ) active LEFT JOIN users u ON u.id=active.user_id
    ) a ON true
    WHERE cc.campaign_id=$1 AND cc.id=$2
    ORDER BY i.sort_order,q.sort_order,q.id`, [campaignId, contactId]);
  return rows.map(row => ({
    questionId: row.question_id,
    label: row.question_text,
    state: !row.known || row.assignment_count > 1 ? "unknown" :
      row.assignment_count === 1 ? "assigned" : "unassigned",
    representativeName: row.known && row.assignment_count === 1 ? row.representative_name?.trim() || null : null,
  }));
}
