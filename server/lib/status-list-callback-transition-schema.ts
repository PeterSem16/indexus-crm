export const CALLBACK_TRANSITION_SCHEMA = `
ALTER TABLE IF EXISTS campaign_contact_status_list_state ADD COLUMN IF NOT EXISTS execution_request_id varchar;
-- Earlier development of the approval-gated service used this journal name.
-- Preserve those receipts before creating the main branch's different journal.
-- Never reinterpret the same rows as the other executor's events.
DO $$
BEGIN
 IF to_regclass(current_schema()||'.mission_callback_events') IS NOT NULL
  AND (SELECT count(*)=6 FROM information_schema.columns WHERE table_schema=current_schema()
    AND table_name='mission_callback_events'
    AND column_name IN ('state','event_id','action_id','generation','owner','occurred_at'))
  AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema()
    AND table_name='mission_callback_events' AND column_name='status') THEN
  IF to_regclass(current_schema()||'.mission_callback_service_events') IS NOT NULL THEN
   -- Workflow startup may already have created an EMPTY target before this
   -- compatibility ensure. Retain that empty bootstrap table, never overwrite
   -- or merge two nonempty journals.
   LOCK TABLE mission_callback_service_events IN ACCESS EXCLUSIVE MODE;
   IF EXISTS(SELECT 1 FROM mission_callback_service_events LIMIT 1)
    OR to_regclass(current_schema()||'.mission_callback_service_events_empty_bootstrap') IS NOT NULL
    OR (SELECT count(*)<>6 FROM information_schema.columns WHERE table_schema=current_schema()
      AND table_name='mission_callback_service_events'
      AND column_name IN ('state','event_id','action_id','generation','owner','occurred_at'))
    OR EXISTS(SELECT 1 FROM pg_constraint WHERE contype='f'
      AND confrelid=to_regclass(current_schema()||'.mission_callback_service_events')) THEN
    RAISE EXCEPTION 'callback_journal_collision_requires_review';
   END IF;
   ALTER TABLE mission_callback_service_events RENAME TO mission_callback_service_events_empty_bootstrap;
   IF to_regclass(current_schema()||'.mission_callback_service_events_pending') IS NOT NULL THEN
    ALTER INDEX mission_callback_service_events_pending RENAME TO mission_callback_service_events_empty_bootstrap_pending;
   END IF;
  END IF;
  ALTER TABLE mission_callback_events RENAME TO mission_callback_service_events;
  IF to_regclass(current_schema()||'.mission_callback_events_pending') IS NOT NULL
   AND to_regclass(current_schema()||'.mission_callback_service_events_pending') IS NULL THEN
   ALTER INDEX mission_callback_events_pending RENAME TO mission_callback_service_events_pending;
  END IF;
 END IF;
END $$;
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
