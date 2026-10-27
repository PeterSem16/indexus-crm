import type { Pool } from "pg";
import { ANALYSIS_SOURCE_EVENTS, ANALYSIS_RESULT_TRIGGERS } from "../../shared/automation-analysis-triggers";

/** Database triggers cover every writer, including reviewed transitions and automatic pauses.
 * Baselines start NOW, never at a legacy rule's created_at. No backfill claims past knowledge.
 * An event binds once to the version visible when it is persisted, not on diagnostic reads.
 */
export async function ensureAutomationInputHistorySchema(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(33001942)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_rule_input_versions (
        id bigserial PRIMARY KEY,
        rule_id varchar NOT NULL REFERENCES workflow_rules(id) ON DELETE CASCADE,
        effective_at timestamp NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
        settings jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workflow_rule_input_versions_lookup
        ON workflow_rule_input_versions(rule_id, effective_at DESC, id DESC);
      CREATE TABLE IF NOT EXISTS workflow_event_input_versions (
        event_id varchar NOT NULL REFERENCES workflow_events(id) ON DELETE CASCADE,
        rule_id varchar NOT NULL REFERENCES workflow_rules(id) ON DELETE CASCADE,
        version_id bigint NOT NULL REFERENCES workflow_rule_input_versions(id) ON DELETE CASCADE,
        PRIMARY KEY(event_id, rule_id)
      );
    `);
    // Counts and a one-way definition fingerprint preserve change provenance without
    // duplicating sender addresses, mailbox identities, literal search text or IF values.
    await client.query(`
      CREATE OR REPLACE FUNCTION automation_input_settings(r workflow_rules) RETURNS jsonb
      LANGUAGE sql IMMUTABLE AS $$
        SELECT jsonb_build_object(
          'module', CASE WHEN r.module = 'communication' THEN 'communication' ELSE 'other' END,
          'enabled', r.enabled,
          'createdAt', to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'eventType', CASE WHEN r.trigger->>'eventType' = ANY(ARRAY[${["communication.received", ...ANALYSIS_SOURCE_EVENTS, ...ANALYSIS_RESULT_TRIGGERS.map(t => t.eventType)].map(s => `'${s}'`).join(",")}])
            THEN r.trigger->>'eventType' ELSE NULL END,
          'channels', COALESCE((SELECT jsonb_agg(c) FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(r.trigger->'analysis'->'channels') = 'array'
              THEN r.trigger->'analysis'->'channels' ELSE '[]'::jsonb END) c
            WHERE c IN ('email','sms','voice','task','chat')), '[]'::jsonb),
          'countries', CASE WHEN r.country_codes IS NULL AND r.country_code IS NULL THEN NULL
            ELSE to_jsonb(ARRAY(SELECT c FROM unnest(COALESCE(r.country_codes, ARRAY[r.country_code])) c
              WHERE c ~ '^[A-Z]{2}$')) END,
          'listenAfter', CASE WHEN r.trigger->>'listenAfter' ~ '^\\d{4}-\\d{2}-\\d{2}T[0-9:.]+(Z|[+-][0-9:]+)$' THEN r.trigger->>'listenAfter' ELSE NULL END,
          'reviewActivatedAt', CASE WHEN r.trigger->>'reviewActivatedAt' ~ '^\\d{4}-\\d{2}-\\d{2}T[0-9:.]+(Z|[+-][0-9:]+)$' THEN r.trigger->>'reviewActivatedAt' ELSE NULL END,
          'mailboxMode', CASE WHEN r.trigger->'analysis'->>'mailboxMode' = 'selected' THEN 'selected' ELSE 'all' END,
          'mailboxCount', CASE WHEN jsonb_typeof(r.trigger->'analysis'->'mailboxUserIds') = 'array'
            THEN jsonb_array_length(r.trigger->'analysis'->'mailboxUserIds') ELSE 0 END,
          'senderCount', CASE WHEN jsonb_typeof(r.trigger->'analysis'->'senderEmails') = 'array'
            THEN jsonb_array_length(r.trigger->'analysis'->'senderEmails') ELSE 0 END,
          'analyzeContent', r.trigger->'analysis'->'analyzeContent' = 'true'::jsonb,
          'analyzeAttachments', r.trigger->'analysis'->'analyzeAttachments' = 'true'::jsonb,
          'textSearch', jsonb_typeof(r.trigger->'analysis'->'textSearch') = 'object',
          'hasConditions', r.conditions IS NOT NULL AND r.conditions <> 'null'::jsonb,
          'fingerprint', encode(sha256(convert_to(jsonb_build_object(
            'module', r.module, 'enabled', r.enabled, 'trigger', r.trigger,
            'countries', r.country_codes, 'country', r.country_code,
            'conditions', r.conditions, 'author', r.created_by_user_id
          )::text, 'UTF8')), 'hex')
        )
      $$;
      CREATE OR REPLACE FUNCTION automation_capture_input_version() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE s jsonb;
      BEGIN
        s := automation_input_settings(NEW);
        IF TG_OP = 'UPDATE' THEN
          IF s IS NOT DISTINCT FROM automation_input_settings(OLD) THEN RETURN NEW; END IF;
        END IF;
        INSERT INTO workflow_rule_input_versions(rule_id, settings) VALUES (NEW.id, s);
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS automation_input_version ON workflow_rules;
      CREATE TRIGGER automation_input_version AFTER INSERT OR UPDATE ON workflow_rules
        FOR EACH ROW EXECUTE FUNCTION automation_capture_input_version();
      INSERT INTO workflow_rule_input_versions(rule_id, settings)
        SELECT r.id, automation_input_settings(r) FROM workflow_rules r
        WHERE NOT EXISTS (SELECT 1 FROM workflow_rule_input_versions v WHERE v.rule_id = r.id);
      CREATE OR REPLACE FUNCTION automation_bind_event_input_version() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.module = 'communication' AND NEW.event_type = ANY(ARRAY[${ANALYSIS_SOURCE_EVENTS.map(s => `'${s}'`).join(",")}]) THEN
          INSERT INTO workflow_event_input_versions(event_id, rule_id, version_id)
            SELECT NEW.id, r.id, v.id FROM workflow_rules r JOIN LATERAL (
              SELECT id, settings FROM workflow_rule_input_versions
              WHERE rule_id = r.id AND effective_at <= NEW.created_at
                AND NEW.created_at <= (clock_timestamp() AT TIME ZONE 'UTC')
              ORDER BY effective_at DESC, id DESC LIMIT 1
            ) v ON true WHERE v.settings->>'module' = 'communication'
            ON CONFLICT DO NOTHING;
        END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS automation_event_input_version ON workflow_events;
      CREATE TRIGGER automation_event_input_version AFTER INSERT ON workflow_events
        FOR EACH ROW EXECUTE FUNCTION automation_bind_event_input_version();
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
