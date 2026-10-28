import type { PoolClient } from "pg";
import {
  isStatusListInfoHeading,
  type StatusListConfirmationNode,
} from "../../shared/status-list-confirmation-kind";

/** Read the hierarchy in this Mission, including question-owning nodes. */
export async function isPersistedStatusListInfoHeading(
  client: Pick<PoolClient, "query">,
  campaignId: string,
  item: StatusListConfirmationNode,
): Promise<boolean> {
  if (item.confirmationType !== "info") return false;
  const { rows } = await client.query(`
    SELECT id,parent_id AS "parentId",item_type AS "itemType",confirmation_type AS "confirmationType"
    FROM campaign_status_list_items WHERE campaign_id=$1
    UNION ALL
    SELECT q.id,q.item_id,'question',NULL FROM campaign_status_list_questions q
    JOIN campaign_status_list_items i ON i.id=q.item_id WHERE i.campaign_id=$1`,
  [campaignId]);
  return isStatusListInfoHeading(item, rows);
}
