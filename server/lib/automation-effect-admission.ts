type Client = {
  query: (text: string, values?: any[]) => Promise<{ rows: any[] }>;
  release: () => void;
};
type Pool = { connect: () => Promise<Client> };
export type AnalysisEffectInput = {
  ruleId: string; runId: string; sourceKey: string; entityId: string;
  eventType: string; eventId?: string; actionIndex: number; actions?: unknown[];
};

/** Task-body revisions are separate sources; messages/comments keep their
 * persisted identity even if ingress accidentally published a second event. */
export function analysisEffectSourceKey(event: { module: string; eventType: string; entityId: string | null; id: string }) {
  return JSON.stringify([event.module, event.eventType, event.entityId,
    ...(event.eventType === "task.body_received" ? [event.id] : [])]);
}

/** The slot is source+rule+position, NOT attempt or event ID. Changed definitions
 * cannot silently resend an already completed/ambiguous effect at that position.
 * A failed external request may already have been accepted: never reclaim it.
 */
export async function claimAnalysisEffect(pool: Pool, input: AnalysisEffectInput):
  Promise<"claimed" | "success" | "uncertain"> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      [`analysis-effect:${input.ruleId}:${input.sourceKey}`]);
    const existing = await client.query(`SELECT status FROM workflow_analysis_effects
      WHERE rule_id=$1 AND source_key=$2 AND action_index=$3`,
    [input.ruleId, input.sourceKey, input.actionIndex]);
    if (existing.rows.length) {
      await client.query("COMMIT");
      return existing.rows[0].status === "success" ? "success" : "uncertain";
    }
    // Reordered/edited actions must not move a completed email to a fresh slot.
    // Missing legacy definitions cannot establish that a remaining slot is safe.
    const changed = await client.query(`SELECT r.id FROM workflow_runs r JOIN workflow_events e ON e.id=r.event_id
      WHERE r.rule_id=$1 AND e.module='communication' AND e.entity_id=$2 AND e.event_type=$3 AND r.id<>$4
        AND ($5::varchar IS NULL OR e.id=$5)
        AND (EXISTS(SELECT 1 FROM workflow_action_log l WHERE l.run_id=r.id AND l.status<>'skipped')
          OR r.status IN ('running','success'))
        AND (CASE WHEN r.payload->>'branch'='else' THEN r.payload->'rule'->'trigger'->'noMatchActions'
          ELSE r.payload->'rule'->'actions' END) IS DISTINCT FROM $6::jsonb
      LIMIT 1`, [input.ruleId, input.entityId, input.eventType, input.runId,
      input.eventType === "task.body_received" ? input.eventId : null, JSON.stringify(input.actions || [])]);
    // Bridge legacy executions into the ledger without mutating their history.
    // Unfinished legacy runs have no durable before-send marker: fail closed.
    const legacy = await client.query(`SELECT
      CASE WHEN bool_and(l.status='success') AND count(l.id)>0 THEN 'success' ELSE 'uncertain' END AS status
      FROM workflow_runs r JOIN workflow_events e ON e.id=r.event_id
      LEFT JOIN workflow_action_log l ON l.run_id=r.id AND l.action_index=$5 AND l.status<>'skipped'
      WHERE r.rule_id=$1 AND e.module='communication' AND e.entity_id=$2 AND e.event_type=$3
        AND r.id<>$4 AND ($6::varchar IS NULL OR e.id=$6) AND (
          l.id IS NOT NULL OR (COALESCE(r.payload->>'effectAdmission','')<>'v1'
            AND (r.status IN ('running','success') OR
              (r.status='failed' AND r.payload IS NOT NULL AND r.finished_at IS NULL))))
      HAVING count(r.id)>0`,
    [input.ruleId, input.entityId, input.eventType, input.runId, input.actionIndex,
      input.eventType === "task.body_received" ? input.eventId : null]);
    const prior = changed.rows.length ? "uncertain" : legacy.rows[0]?.status;
    await client.query(`INSERT INTO workflow_analysis_effects
      (rule_id,source_key,action_index,run_id,status) VALUES($1,$2,$3,$4,$5)`,
    [input.ruleId, input.sourceKey, input.actionIndex, input.runId, prior || "started"]);
    await client.query("COMMIT");
    return prior || "claimed";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
