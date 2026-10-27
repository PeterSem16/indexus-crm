import type { Pool } from "pg";
import { CALLBACK_CONVERTER } from "./status-list-service";
import type { CallbackServiceStatus } from "../../shared/status-list-transition";
import { CALLBACK_DEFERRED_PREDICATE } from "./status-list-service-pending";
/** Current environment only. No recipients, contact identities, payloads,
 * callback notes, backup references or approval evidence leave this endpoint.
 */
export async function readCallbackServiceStatus(pool: Pool, campaignId: string): Promise<CallbackServiceStatus> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const group = (await client.query(`SELECT enrolled,owner,generation,fingerprint
      FROM mission_callback_groups WHERE campaign_id=$1`, [campaignId])).rows[0] ?? null;
    const counts = { pending: 0, blocked: 0, done: 0, deferred: 0 };
    for (const row of (await client.query(`SELECT state,count(*)::int AS n FROM mission_callback_service_events
      WHERE campaign_id=$1 GROUP BY state`, [campaignId])).rows)
      counts[row.state as keyof typeof counts] = row.n;
    counts.deferred = (await client.query(`SELECT count(*)::int AS n
      FROM mission_status_list_dirty d WHERE ${CALLBACK_DEFERRED_PREDICATE}`, [campaignId])).rows[0].n;
    const cutovers = (await client.query(`SELECT id,from_owner AS "fromOwner",to_owner AS "toOwner",
      generation,actor_id AS "actorId",created_at AS "createdAt",event_boundary AS "eventBoundary"
      FROM mission_callback_cutovers WHERE campaign_id=$1 ORDER BY id DESC LIMIT 20`, [campaignId])).rows;
    return { runtimeVersion: CALLBACK_CONVERTER, activationAllowed: false, group, counts, cutovers };
  } finally {
    try { await client.query("ROLLBACK"); } finally { client.release(); }
  }
}
