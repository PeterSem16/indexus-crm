export async function ensureChatAnalysisOutboxSchema(pool: {
  query: (text: string) => Promise<unknown>;
}) {
  // No historical INSERT/SELECT backfill: only newly committed messages opt in.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_analysis_outbox (
      message_id varchar PRIMARY KEY REFERENCES chat_messages(id) ON DELETE CASCADE,
      country_code text,
      occurred_at timestamp NOT NULL,
      event_id varchar,
      attempts integer NOT NULL DEFAULT 0,
      next_attempt_at timestamp NOT NULL DEFAULT now(),
      completed_at timestamp
    );
    CREATE INDEX IF NOT EXISTS chat_analysis_outbox_pending
      ON chat_analysis_outbox(next_attempt_at) WHERE completed_at IS NULL;
  `);
}
