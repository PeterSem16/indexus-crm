// The production DB is self-hosted; invoked by the existing startup migration.
// No data replacement, retention sweep, token or route update.
export const AI_JOBS_SCHEMA = `
CREATE TABLE IF NOT EXISTS ai_jobs (
  id uuid PRIMARY KEY,
  service text NOT NULL CHECK (service IN ('task.checklist','task.resolution','email.summary')),
  entity_type text NOT NULL CHECK (entity_type IN ('task','email')),
  entity_id text NOT NULL,
  owner_user_id varchar NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  priority integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  result jsonb,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 3),
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  locked_until timestamptz,
  worker_id text,
  idempotency_key text NOT NULL UNIQUE,
  input_fingerprint text NOT NULL,
  history jsonb NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS ai_jobs_ready ON ai_jobs(priority DESC,created_at,id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS ai_jobs_entity ON ai_jobs(service,entity_type,entity_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_jobs_owner ON ai_jobs(owner_user_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ai_jobs_single_processing ON ai_jobs((true)) WHERE status='processing';
ALTER TABLE task_ai_checklist_generations ADD COLUMN IF NOT EXISTS ai_job_id uuid;
`;
