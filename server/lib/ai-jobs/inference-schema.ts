import { AI_MAINTENANCE_SCHEMA } from "./maintenance-schema";
/** Additive schema for every internally routed, text-compatible AI service. */
export const AI_INFERENCE_SCHEMA = `
${AI_MAINTENANCE_SCHEMA}
CREATE TABLE IF NOT EXISTS ai_inference_jobs (
  id uuid PRIMARY KEY,
  service text NOT NULL,
  model text NOT NULL,
  request jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  response jsonb,
  error_code text,
  error_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  http_status integer,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  locked_until timestamptz,
  worker_id uuid,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 1)
);
ALTER TABLE ai_inference_jobs ADD COLUMN IF NOT EXISTS error_meta jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS ai_inference_pending ON ai_inference_jobs(created_at,id) WHERE status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS ai_inference_single_processing ON ai_inference_jobs((true)) WHERE status='processing';
CREATE TABLE IF NOT EXISTS ai_inference_workers (
  id uuid PRIMARY KEY,
  heartbeat_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_inference_workers ADD COLUMN IF NOT EXISTS maintenance_protocol integer NOT NULL DEFAULT 0;
ALTER TABLE ai_inference_workers ADD COLUMN IF NOT EXISTS maintenance_version integer NOT NULL DEFAULT -1;
`;
