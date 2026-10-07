type AdmissionClient = {
  query: (text: string, values?: any[]) => Promise<{ rows: any[] }>;
  release: () => void;
};
type AdmissionPool = { connect: () => Promise<AdmissionClient> };
type RunInput = {
  ruleId: string;
  eventId: string | null;
  payload: Record<string, unknown>;
  causationChain: string[];
};

/**
 * One short transaction reserves the run before ANY actions execute.
 * The transaction-scoped lock serializes all workers for this rule, including
 * other Node processes. No lock/connection is held while actions are running.
 */
export async function admitAutomationRun(pool: AdmissionPool, input: RunInput): Promise<{
  admitted: boolean; runId: string;
}> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('indexus:automation:quota:' || $1::text, 0))", [input.ruleId]);
    // Read the saved quota, not a stale event-dispatch snapshot. Protect it
    // from an edit until this very short admission transaction commits.
    const current = await client.query(
      "SELECT rate_limit_per_hour FROM workflow_rules WHERE id=$1 FOR SHARE", [input.ruleId],
    );
    if (!current.rows.length) throw new Error("Automation rule no longer exists");
    const limit = current.rows[0].rate_limit_per_hour;
    let admitted = true;
    if (limit != null && Number(limit) > 0) {
      const usage = await client.query(`SELECT count(*)::int AS used FROM workflow_runs
        WHERE rule_id=$1 AND status IN ('running','success','failed')
          AND started_at >= clock_timestamp() - interval '60 minutes'`, [input.ruleId]);
      admitted = usage.rows[0].used < Number(limit);
    }
    // Keep skipped events in history, but they never consume or extend quota.
    // Database time defines both the rolling window and the reserved start.
    const result = await client.query(`INSERT INTO workflow_runs
      (rule_id,event_id,status,skipped_reason,payload,causation_chain,started_at,finished_at)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::text[],clock_timestamp(),
        CASE WHEN $3='skipped' THEN clock_timestamp() ELSE NULL END) RETURNING id`,
      [input.ruleId, input.eventId, admitted ? "running" : "skipped", admitted ? null : "rate_limit",
        JSON.stringify(input.payload), input.causationChain]);
    if (!result.rows[0]?.id) throw new Error("Automation run reservation failed");
    await client.query("COMMIT");
    return { admitted, runId: result.rows[0].id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error; // Never silently bypass quota if the database/lock fails.
  } finally {
    client.release();
  }
}
