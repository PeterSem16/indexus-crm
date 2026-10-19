export const STATUS_LIST_WORKFLOW_SCHEMA = `
CREATE TABLE IF NOT EXISTS mission_status_list_rules (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
 campaign_id varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 definition jsonb NOT NULL,
 created_by varchar NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mission_status_list_rules_campaign ON mission_status_list_rules(campaign_id);
CREATE TABLE IF NOT EXISTS mission_status_list_answers (
 campaign_contact_id varchar NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
 question_id varchar NOT NULL REFERENCES campaign_status_list_questions(id) ON DELETE CASCADE,
 value jsonb NOT NULL,
 revision varchar NOT NULL DEFAULT gen_random_uuid()::text,
 updated_by varchar NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(campaign_contact_id, question_id)
);
CREATE TABLE IF NOT EXISTS mission_status_list_rule_runs (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
 rule_id varchar NOT NULL,
 rule_name text NOT NULL,
 campaign_id varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 campaign_contact_id varchar NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
 source_event varchar NOT NULL,
 actor_id varchar NOT NULL,
 branch varchar NOT NULL,
 results jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(rule_id, campaign_contact_id, source_event)
);
CREATE INDEX IF NOT EXISTS mission_status_list_runs_contact ON mission_status_list_rule_runs(campaign_contact_id, created_at);
CREATE TABLE IF NOT EXISTS mission_status_list_notes (
 campaign_contact_id varchar NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
 status_list_item_id varchar NOT NULL REFERENCES campaign_status_list_items(id) ON DELETE CASCADE,
 note text,
 updated_by varchar NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(campaign_contact_id, status_list_item_id)
);
`;
export async function ensureStatusListWorkflowSchema(pool: { query(sql: string): Promise<unknown> }) {
  await pool.query(STATUS_LIST_WORKFLOW_SCHEMA);
}
