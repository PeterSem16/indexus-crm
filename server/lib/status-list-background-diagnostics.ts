import type { PoolClient } from "pg";

type Reader = Pick<PoolClient, "query">;

/** Configuration/transition evidence only. Never evaluate a source or execute an action. */
export async function readBackgroundDiagnostics(client: Reader, campaignId: string) {
  const groups = (await client.query(`
    SELECT s.group_id AS "groupId",i.label,s.config->>'source' AS source,
      i.is_hidden AS hidden,
      (SELECT count(*)::int FROM campaign_contacts cc WHERE cc.campaign_id=s.campaign_id) AS "totalContacts",
      (SELECT count(*)::int FROM mission_status_list_option_source_state x
        JOIN campaign_contacts cc ON cc.id=x.campaign_contact_id
        WHERE x.group_id=s.group_id AND cc.campaign_id=s.campaign_id) AS "evaluatedContacts",
      (SELECT count(*)::int FROM mission_status_list_option_source_state x
        JOIN campaign_contacts cc ON cc.id=x.campaign_contact_id
        WHERE x.group_id=s.group_id AND cc.campaign_id=s.campaign_id
          AND x.config_revision=s.revision) AS "currentRevisionContacts",
      (SELECT max(x.updated_at) FROM mission_status_list_option_source_state x
        JOIN campaign_contacts cc ON cc.id=x.campaign_contact_id
        WHERE x.group_id=s.group_id AND cc.campaign_id=s.campaign_id) AS "lastEvaluatedAt",
      coalesce((SELECT jsonb_agg(v) FROM (
        SELECT x.value,count(*)::int AS count FROM mission_status_list_option_source_state x
        JOIN campaign_contacts cc ON cc.id=x.campaign_contact_id
        WHERE x.group_id=s.group_id AND cc.campaign_id=s.campaign_id
          AND x.config_revision=s.revision GROUP BY x.value ORDER BY x.value
      ) v),'[]'::jsonb) AS states,
      coalesce((SELECT jsonb_agg(v) FROM (
        SELECT child.id AS "itemId",child.label,count(a.id)::int AS count
        FROM campaign_status_list_items child
        JOIN campaign_status_list_automations a ON a.status_list_item_id=child.id
        WHERE child.campaign_id=s.campaign_id AND (child.id=s.group_id OR child.parent_id=s.group_id)
        GROUP BY child.id,child.label ORDER BY child.id
      ) v),'[]'::jsonb) AS "legacyActions",
      coalesce((SELECT jsonb_agg(v) FROM (
        SELECT r.id,r.definition->>'name' AS name,
          coalesce((r.definition->>'enabled')::boolean,false) AS enabled,
          coalesce(r.definition->>'trigger','agent_confirmation') AS trigger,
          r.definition->'source'->>'id' AS "sourceId"
        FROM mission_status_list_rules r
        WHERE r.campaign_id=s.campaign_id AND r.definition->'source'->>'kind'='item'
          AND r.definition->'source'->>'id' IN (
            SELECT child.id FROM campaign_status_list_items child
            WHERE child.campaign_id=s.campaign_id AND (child.id=s.group_id OR child.parent_id=s.group_id))
        ORDER BY r.id
      ) v),'[]'::jsonb) AS rules,
      coalesce((SELECT jsonb_agg(v) FROM (
        SELECT t.id,t.created_at AS "occurredAt",t.baseline,
          t.previous_label AS "previousLabel",t.value_label AS "valueLabel"
        FROM mission_status_list_transitions t
        WHERE t.campaign_id=s.campaign_id AND t.question_id=s.group_id AND t.target_kind='item'
        ORDER BY t.created_at DESC,t.id DESC LIMIT 10
      ) v),'[]'::jsonb) AS transitions
    FROM mission_status_list_option_sources s
    JOIN campaign_status_list_items i ON i.id=s.group_id AND i.campaign_id=s.campaign_id
    WHERE s.campaign_id=$1 ORDER BY i.sort_order,i.id`, [campaignId])).rows;
  return { groups };
}

