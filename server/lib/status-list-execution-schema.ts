export const STATUS_LIST_EXECUTION_SCHEMA = `
ALTER TABLE campaign_contact_status_list_state ADD COLUMN IF NOT EXISTS execution_request_id varchar;
CREATE TABLE IF NOT EXISTS status_list_effect_receipts (
 campaign_contact_id varchar NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
 automation_id varchar NOT NULL,
 event_key varchar NOT NULL,
 actor_id varchar NOT NULL,
 status varchar NOT NULL CHECK(status IN ('running','succeeded','failed')),
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 PRIMARY KEY(campaign_contact_id,automation_id,event_key)
);
`;
export async function ensureStatusListExecutionSchema(db: { query: (sql: string) => Promise<unknown> }) {
  await db.query(STATUS_LIST_EXECUTION_SCHEMA);
}
