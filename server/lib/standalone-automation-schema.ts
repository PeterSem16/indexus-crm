import { ensureTaskMessageTemplates } from "./task-message-templates";
import { ensureAutomationEmailTemplates } from "./automation-email-templates";
import { ensureAutomationCallTemplates } from "./automation-call-templates";

/** Additive production bootstrap; no data rewrite, removal, or Status List cutover. */
export const STANDALONE_AUTOMATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS workflow_rules (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text, module text NOT NULL,
  country_code text, country_codes text[],
  enabled boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  trigger jsonb NOT NULL, conditions jsonb, actions jsonb NOT NULL,
  rate_limit_per_hour integer,
  consecutive_error_count integer NOT NULL DEFAULT 0,
  last_error_at timestamp, last_error_message text, disabled_reason text,
  auto_disable_threshold integer NOT NULL DEFAULT 5,
  created_by_user_id varchar,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE workflow_rules ADD COLUMN IF NOT EXISTS country_codes text[];
ALTER TABLE workflow_rules ADD COLUMN IF NOT EXISTS schedule_interval text;
ALTER TABLE workflow_rules ADD COLUMN IF NOT EXISTS schedule_next_due_at timestamptz;
CREATE TABLE IF NOT EXISTS workflow_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL, module text NOT NULL, entity_type text NOT NULL,
  entity_id varchar, event_type text NOT NULL,
  old_values jsonb, new_values jsonb, changed_fields text[],
  actor_user_id varchar, country_code text, causation_run_id varchar,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workflow_runs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id varchar NOT NULL, event_id varchar,
  status text NOT NULL DEFAULT 'pending', skipped_reason text,
  payload jsonb, action_results jsonb, error text, causation_chain text[],
  started_at timestamp NOT NULL DEFAULT now(), finished_at timestamp
);
CREATE TABLE IF NOT EXISTS workflow_action_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id varchar NOT NULL, action_index integer NOT NULL,
  action_type text NOT NULL, status text NOT NULL,
  output jsonb, error text, retry_count integer NOT NULL DEFAULT 0,
  executed_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS task_assignment_access (
  id integer PRIMARY KEY CHECK (id = 1), allowed_user_ids text[],
  updated_at timestamp NOT NULL DEFAULT now()
);
INSERT INTO task_assignment_access (id, allowed_user_ids)
  VALUES (1, NULL) ON CONFLICT (id) DO NOTHING;
-- Existing legacy tables must satisfy the actual runtime column contract too.
SELECT id, name, description, module, country_code, country_codes, enabled,
  is_system, trigger, conditions, actions, rate_limit_per_hour,
  consecutive_error_count, last_error_at, last_error_message, disabled_reason,
  auto_disable_threshold, created_by_user_id, created_at, updated_at,
  schedule_interval, schedule_next_due_at FROM workflow_rules LIMIT 0;
SELECT id, source, module, entity_type, entity_id, event_type, old_values,
  new_values, changed_fields, actor_user_id, country_code, causation_run_id,
  created_at FROM workflow_events LIMIT 0;
SELECT id, rule_id, event_id, status, skipped_reason, payload, action_results,
  error, causation_chain, started_at, finished_at FROM workflow_runs LIMIT 0;
SELECT id, run_id, action_index, action_type, status, output, error,
  retry_count, executed_at FROM workflow_action_log LIMIT 0;
SELECT id, allowed_user_ids, updated_at FROM task_assignment_access LIMIT 0;
`;

export async function ensureStandaloneAutomationSchema(pool: {
  query: (sql: string) => Promise<unknown>;
}) {
  // One simple-query batch is transactional in PostgreSQL: failed validation
  // does not leave half a bootstrap. Let the caller fail startup before routes.
  await pool.query(STANDALONE_AUTOMATION_SCHEMA);
  await ensureTaskMessageTemplates(pool);
  await ensureAutomationEmailTemplates(pool);
  await ensureAutomationCallTemplates(pool);
}