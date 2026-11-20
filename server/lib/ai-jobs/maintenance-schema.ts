/** Additive startup migration only. Workers never seed/reset this durable gate. */
export const AI_MAINTENANCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS ai_queue_maintenance (
  scope text PRIMARY KEY CHECK (scope = 'internal-gateway'),
  mode text NOT NULL CHECK (mode IN ('running','paused')),
  version integer NOT NULL CHECK (version >= 0),
  operation_id uuid,
  owner_id varchar,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (mode <> 'paused' OR (operation_id IS NOT NULL AND owner_id IS NOT NULL))
);
INSERT INTO ai_queue_maintenance(scope,mode,version)
  VALUES('internal-gateway','running',0) ON CONFLICT(scope) DO NOTHING;
CREATE TABLE IF NOT EXISTS ai_queue_maintenance_audit (
  id bigserial PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('pause','resume','takeover')),
  version integer NOT NULL UNIQUE,
  operation_id uuid NOT NULL,
  actor_id varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
