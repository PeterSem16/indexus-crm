export const STATUS_LIST_WORKFLOW_SCHEMA = `
CREATE TABLE IF NOT EXISTS mission_status_list_automatic_configs (
 item_id varchar PRIMARY KEY REFERENCES campaign_status_list_items(id) ON DELETE CASCADE,
 campaign_id varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 trigger text NOT NULL CHECK(trigger IN ('agent_confirmation','card_open','background_change')),
 enabled boolean NOT NULL DEFAULT false,
 revision varchar NOT NULL DEFAULT gen_random_uuid()::text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mission_status_list_automatic_configs DROP CONSTRAINT IF EXISTS mission_status_list_automatic_configs_trigger_check;
ALTER TABLE mission_status_list_automatic_configs ADD COLUMN IF NOT EXISTS background_execution text NOT NULL DEFAULT 'mission';
ALTER TABLE mission_status_list_automatic_configs ADD CONSTRAINT mission_status_list_automatic_configs_trigger_check
 CHECK (trigger IN ('agent_confirmation','card_open','pulse_open','background_change'));
CREATE INDEX IF NOT EXISTS mission_status_list_automatic_configs_campaign ON mission_status_list_automatic_configs(campaign_id,trigger,enabled);
CREATE TABLE IF NOT EXISTS mission_status_list_automatic_states (
 campaign_contact_id varchar NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
 automation_id varchar NOT NULL REFERENCES campaign_status_list_automations(id) ON DELETE CASCADE,
 matched boolean NOT NULL,
 generation integer NOT NULL DEFAULT 0,
 definition_fingerprint text NOT NULL,
 evaluated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(campaign_contact_id,automation_id)
);
CREATE TABLE IF NOT EXISTS mission_status_list_automatic_events (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
 campaign_id varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 campaign_contact_id varchar NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
 automation_id varchar NOT NULL REFERENCES campaign_status_list_automations(id) ON DELETE CASCADE,
 item_id varchar NOT NULL REFERENCES campaign_status_list_items(id) ON DELETE CASCADE,
 trigger_key text NOT NULL,
 action_snapshot jsonb NOT NULL,
 event_context jsonb NOT NULL DEFAULT '{}'::jsonb,
 config_revision varchar NOT NULL,
 actor_id varchar NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('awaiting_batch','pending','running','succeeded','failed','superseded','indeterminate')),
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz,
 finished_at timestamptz,
 UNIQUE(campaign_contact_id,automation_id,trigger_key)
);
CREATE INDEX IF NOT EXISTS mission_status_list_automatic_events_pending ON mission_status_list_automatic_events(created_at) WHERE state='pending';
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
CREATE TABLE IF NOT EXISTS mission_status_list_question_notes (
 campaign_contact_id varchar NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
 question_id varchar NOT NULL REFERENCES campaign_status_list_questions(id) ON DELETE CASCADE,
 note text,
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
ALTER TABLE mission_status_list_rule_runs ADD COLUMN IF NOT EXISTS actor_kind text NOT NULL DEFAULT 'user';
CREATE TABLE IF NOT EXISTS mission_status_list_sources (
 question_id varchar PRIMARY KEY REFERENCES campaign_status_list_questions(id) ON DELETE CASCADE,
 campaign_id varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 source text NOT NULL CHECK(source IN ('representative_assigned','representative_assignment_type')),
 revision varchar NOT NULL DEFAULT gen_random_uuid()::text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mission_status_list_sources_campaign ON mission_status_list_sources(campaign_id);
CREATE TABLE IF NOT EXISTS mission_status_list_option_sources (
 group_id varchar PRIMARY KEY REFERENCES campaign_status_list_items(id) ON DELETE CASCADE,
 campaign_id varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 config jsonb NOT NULL,
 revision varchar NOT NULL DEFAULT gen_random_uuid()::text
);
CREATE INDEX IF NOT EXISTS mission_status_list_option_sources_campaign ON mission_status_list_option_sources(campaign_id);
CREATE TABLE IF NOT EXISTS mission_status_list_option_source_state (
 campaign_contact_id varchar NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
 group_id varchar NOT NULL REFERENCES mission_status_list_option_sources(group_id) ON DELETE CASCADE,
 config_revision varchar NOT NULL,
 value text NOT NULL,
 option_id varchar NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(campaign_contact_id,group_id)
);
CREATE TABLE IF NOT EXISTS mission_status_list_source_state (
 campaign_contact_id varchar NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
 question_id varchar NOT NULL REFERENCES mission_status_list_sources(question_id) ON DELETE CASCADE,
 config_revision varchar NOT NULL,
 value jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(campaign_contact_id,question_id)
);
CREATE TABLE IF NOT EXISTS mission_status_list_transitions (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
 campaign_id varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 campaign_contact_id varchar NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
 question_id varchar NOT NULL,
 question_label text NOT NULL,
 previous jsonb,
 value jsonb NOT NULL,
 baseline boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mission_status_list_transitions_contact ON mission_status_list_transitions(campaign_contact_id,created_at);
ALTER TABLE mission_status_list_transitions ADD COLUMN IF NOT EXISTS target_kind text NOT NULL DEFAULT 'question';
ALTER TABLE mission_status_list_transitions ADD COLUMN IF NOT EXISTS previous_label text;
ALTER TABLE mission_status_list_transitions ADD COLUMN IF NOT EXISTS value_label text;
CREATE TABLE IF NOT EXISTS mission_status_list_dirty (
 kind text NOT NULL,
 entity_id varchar NOT NULL,
 revision varchar NOT NULL DEFAULT gen_random_uuid()::text,
 cursor varchar NOT NULL DEFAULT '',
 due_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(kind,entity_id)
);
CREATE OR REPLACE FUNCTION mission_status_list_enqueue() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; k text; entity text;
BEGIN
 IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
 CASE TG_TABLE_NAME
  WHEN 'clinic_representative_assignments' THEN k:='clinic'; entity:=r.clinic_id;
  WHEN 'hospital_representative_assignments' THEN k:='hospital'; entity:=r.hospital_id;
  WHEN 'campaign_contacts' THEN k:='contact'; entity:=r.id;
  ELSE k:='mission'; entity:=r.campaign_id;
 END CASE;
 INSERT INTO mission_status_list_dirty(kind,entity_id) VALUES(k,entity)
 ON CONFLICT(kind,entity_id) DO UPDATE SET revision=gen_random_uuid()::text,cursor='',due_at=now();
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='clinic_representative_assignments' THEN
   IF OLD.clinic_id IS DISTINCT FROM NEW.clinic_id THEN
    INSERT INTO mission_status_list_dirty(kind,entity_id) VALUES('clinic',OLD.clinic_id)
    ON CONFLICT(kind,entity_id) DO UPDATE SET revision=gen_random_uuid()::text,cursor='',due_at=now();
   END IF;
  ELSIF TG_TABLE_NAME='hospital_representative_assignments' THEN
   IF OLD.hospital_id IS DISTINCT FROM NEW.hospital_id THEN
    INSERT INTO mission_status_list_dirty(kind,entity_id) VALUES('hospital',OLD.hospital_id)
    ON CONFLICT(kind,entity_id) DO UPDATE SET revision=gen_random_uuid()::text,cursor='',due_at=now();
   END IF;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE OR REPLACE FUNCTION mission_status_list_option_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id text;
BEGIN
 IF current_setting('indexus.status_list_source_writer',true)='on' OR pg_trigger_depth()>1 THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP='DELETE' THEN target_id:=OLD.status_list_item_id; ELSE target_id:=NEW.status_list_item_id; END IF;
 IF EXISTS(SELECT 1 FROM mission_status_list_option_sources s
  JOIN campaign_status_list_items i ON i.id=target_id
  WHERE s.group_id=i.id OR s.group_id=i.parent_id) THEN
  RAISE EXCEPTION 'derived_answer' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE OR REPLACE TRIGGER mission_status_list_option_guard
 BEFORE INSERT OR UPDATE OF status_list_item_id OR DELETE ON campaign_contact_status_list_state
 FOR EACH ROW EXECUTE FUNCTION mission_status_list_option_guard();
CREATE OR REPLACE FUNCTION mission_status_list_communication_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; old_mission text;
BEGIN
 IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
 IF r.campaign_id IS NOT NULL THEN
  INSERT INTO mission_status_list_dirty(kind,entity_id) VALUES('mission',r.campaign_id)
  ON CONFLICT(kind,entity_id) DO UPDATE SET revision=gen_random_uuid()::text,cursor='',due_at=now();
 END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.campaign_id IS DISTINCT FROM NEW.campaign_id AND OLD.campaign_id IS NOT NULL THEN
   INSERT INTO mission_status_list_dirty(kind,entity_id) VALUES('mission',OLD.campaign_id)
   ON CONFLICT(kind,entity_id) DO UPDATE SET revision=gen_random_uuid()::text,cursor='',due_at=now();
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
`;
export async function ensureStatusListWorkflowSchema(pool: { query(sql: string): Promise<unknown> }) {
  await pool.query(STATUS_LIST_WORKFLOW_SCHEMA);
}
