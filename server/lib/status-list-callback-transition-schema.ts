export const CALLBACK_TRANSITION_SCHEMA = `
ALTER TABLE IF EXISTS campaign_contact_status_list_state ADD COLUMN IF NOT EXISTS execution_request_id varchar;
CREATE TABLE IF NOT EXISTS mission_callback_ownership (
 campaign_id varchar PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
 owner text NOT NULL CHECK(owner IN ('legacy','compatible')),
 fingerprint text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mission_callback_switches (
 id bigserial PRIMARY KEY,
 campaign_id varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 actor_id varchar NOT NULL,
 from_owner text NOT NULL,
 to_owner text NOT NULL,
 fingerprint text NOT NULL,
 backup_acknowledged boolean NOT NULL CHECK(backup_acknowledged),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mission_callback_candidates (
 campaign_id varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 automation_id varchar NOT NULL,
 definition jsonb NOT NULL,
 source_fingerprint text NOT NULL,
 reviewed_by varchar NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(campaign_id,automation_id)
);
CREATE TABLE IF NOT EXISTS mission_callback_events (
 id bigserial PRIMARY KEY,
 campaign_id varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 campaign_contact_id varchar NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
 confirmation_id varchar NOT NULL,
 automation_id varchar NOT NULL,
 item_id varchar NOT NULL,
 actor_id varchar NOT NULL,
 owner text NOT NULL CHECK(owner IN ('legacy','compatible')),
 payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done','failed')),
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE(confirmation_id,automation_id)
);
CREATE INDEX IF NOT EXISTS mission_callback_events_pending
 ON mission_callback_events(id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS mission_callback_events_scope
 ON mission_callback_events(campaign_id,status);
`;

export async function ensureCallbackTransitionSchema(pool: { query(sql: string): Promise<unknown> }) {
  await pool.query(CALLBACK_TRANSITION_SCHEMA);
}
