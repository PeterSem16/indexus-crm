type Queryable = { query: (text: string, values?: any[]) => Promise<any> };

/** Runtime migration: production does not run db:push. No historic replay. */
export async function ensureAutomationRetrySchema(pool: Queryable) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow_analysis_retries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id varchar NOT NULL, event_id varchar NOT NULL, requested_by varchar NOT NULL,
      request_id uuid NOT NULL, definition_hash text NOT NULL,
      status text NOT NULL DEFAULT 'analyzing',
      analysis jsonb, error_code text,
      created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
      UNIQUE(requested_by, request_id)
    );
    CREATE INDEX IF NOT EXISTS workflow_analysis_retries_source
      ON workflow_analysis_retries(rule_id,event_id,created_at);
    CREATE TABLE IF NOT EXISTS workflow_analysis_effects (
      rule_id varchar NOT NULL, source_key text NOT NULL, action_index integer NOT NULL,
      run_id varchar NOT NULL, status text NOT NULL DEFAULT 'started',
      created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
      PRIMARY KEY(rule_id,source_key,action_index)
    );
  `);
}
