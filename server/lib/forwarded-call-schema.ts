/** Required before any queue handling; migration failures must abort startup. */
export async function ensureForwardedCallSchema(connection: {
  query(sql: string): Promise<unknown>;
}): Promise<void> {
  // One SQL batch is atomic in PostgreSQL. The transaction advisory lock also
  // serializes simultaneous PM2 worker startups without process-local state.
  await connection.query(`
    SELECT pg_advisory_xact_lock(hashtext('indexus:queue_forwarded_calls:schema'));
    CREATE TABLE IF NOT EXISTS queue_forwarded_calls (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      root_unique_id text NOT NULL,
      pbx_host text NOT NULL,
      pbx_ssh_port integer NOT NULL,
      inbound_call_log_id varchar NOT NULL REFERENCES inbound_call_logs(id),
      call_log_id varchar NOT NULL REFERENCES call_logs(id),
      transferred_at timestamp NOT NULL,
      status text NOT NULL DEFAULT 'forwarded',
      evidence jsonb,
      recording_authorized boolean NOT NULL DEFAULT false,
      recording_policy_snapshot jsonb,
      recording_name text NOT NULL,
      recording_path text NOT NULL,
      recording_state text NOT NULL DEFAULT 'off',
      user_id varchar NOT NULL,
      customer_id varchar,
      campaign_id varchar,
      caller_number text NOT NULL,
      last_error text,
      updated_at timestamp NOT NULL DEFAULT now()
    );
    -- Preserve unresolved legacy identities, never backfill from current PBX.
    ALTER TABLE queue_forwarded_calls ADD COLUMN IF NOT EXISTS pbx_host text;
    ALTER TABLE queue_forwarded_calls ADD COLUMN IF NOT EXISTS pbx_ssh_port integer;
    CREATE UNIQUE INDEX IF NOT EXISTS queue_forwarded_calls_root_unique
      ON queue_forwarded_calls(root_unique_id);
    CREATE INDEX IF NOT EXISTS queue_forwarded_calls_pending
      ON queue_forwarded_calls(status, recording_state);
    -- Reject a partial/incompatible existing table rather than accept handoffs.
    SELECT id, root_unique_id, pbx_host, pbx_ssh_port, inbound_call_log_id,
      call_log_id, transferred_at, status, evidence, recording_authorized,
      recording_policy_snapshot, recording_name, recording_path, recording_state,
      user_id, customer_id, campaign_id, caller_number, last_error, updated_at
    FROM queue_forwarded_calls LIMIT 0;
  `);
}