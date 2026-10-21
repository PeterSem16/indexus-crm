import type { Pool } from "pg";
import { z } from "zod";

export const workflowConditionOptionsQuery = z.object({
  field: z.enum(["clinic_id", "hospital_id"]),
  q: z.string().trim().max(100).default(""),
  value: z.string().max(500).default(""),
});

/** Values must match executeSingleEvent's condition_* aliases, including
 * customer hospital names (which historically are names, not hospital IDs). */
export async function readWorkflowConditionOptions(
  client: Pick<Pool, "query">,
  campaignId: string,
  input: unknown,
) {
  const query = workflowConditionOptionsQuery.parse(input);
  const hospital = query.field === "hospital_id";
  const value = hospital
    ? "CASE WHEN cc.contact_type='customer' THEN NULLIF(c.hospital_name,'') ELSE cc.hospital_id END"
    : "CASE WHEN cc.contact_type='customer' THEN c.clinic_id ELSE cc.clinic_id END";
  const label = hospital
    ? "CASE WHEN cc.contact_type='customer' THEN NULLIF(c.hospital_name,'') ELSE h.name END"
    : "cl.name";
  const pattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
  const { rows } = await client.query(`
    WITH choices AS (
      SELECT DISTINCT ${value} AS value, COALESCE(${label}, ${value}) AS label
      FROM campaign_contacts cc
      LEFT JOIN customers c ON c.id=cc.customer_id
      LEFT JOIN clinics cl ON cl.id=(CASE WHEN cc.contact_type='customer' THEN c.clinic_id ELSE cc.clinic_id END)
      LEFT JOIN hospitals h ON h.id=cc.hospital_id
      WHERE cc.campaign_id=$1
    )
    SELECT value,label FROM choices
    WHERE value IS NOT NULL AND value<>''
      AND ($2='%%' OR value=$3 OR label ILIKE $2 OR value ILIKE $2)
    ORDER BY (value=$3) DESC, label, value LIMIT 51
  `, [campaignId, pattern, query.value]);
  return {
    options: rows.slice(0, 50).map(row => ({ value: String(row.value), label: String(row.label) })),
    truncated: rows.length > 50,
  };
}
