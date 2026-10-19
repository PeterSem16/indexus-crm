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
ALTER TABLE mission_status_list_rule_runs ADD COLUMN IF NOT EXISTS actor_kind text NOT NULL DEFAULT 'user';
CREATE TABLE IF NOT EXISTS mission_status_list_sources (
 question_id varchar PRIMARY KEY REFERENCES campaign_status_list_questions(id) ON DELETE CASCADE,
 campaign_id varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 source text NOT NULL CHECK(source IN ('representative_assigned','representative_assignment_type')),
 revision varchar NOT NULL DEFAULT gen_random_uuid()::text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mission_status_list_sources_campaign ON mission_status_list_sources(campaign_id);
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
`;
export async function ensureStatusListWorkflowSchema(pool: { query(sql: string): Promise<unknown> }) {
  await pool.query(STATUS_LIST_WORKFLOW_SCHEMA);
}
