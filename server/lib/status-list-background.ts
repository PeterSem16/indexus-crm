import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { workflowSourceConfigSchema, type WorkflowAnswer } from "../../shared/status-list-workflow";
import { executeEvent, StatusListWorkflowError, workflowTransaction } from "./status-list-workflow";
import { evaluateOptionSources } from "./status-list-option-source";
import { lockCallbackTransition, assertCallbackConfigurationIndependent } from "./status-list-callback-transition";

// Explicit non-human principal; never borrow the configurator/representative's
// user identity. Legacy history/confirmation columns require a non-null string.
export const STATUS_LIST_SYSTEM_ACTOR = "system:mission-status-list";

export async function configureBackgroundSource(campaignId: string, questionId: string, raw: unknown | null) {
  const config = raw === null ? null : workflowSourceConfigSchema.parse(raw);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockCallbackTransition(client, campaignId, true);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-workflow-config:${campaignId}`]);
    const { rows } = await client.query(`SELECT q.*,i.confirmation_type,i.question_selection_mode
      FROM campaign_status_list_questions q JOIN campaign_status_list_items i ON i.id=q.item_id
      WHERE q.id=$1 AND i.campaign_id=$2`, [questionId, campaignId]);
    const q = rows[0];
    if (!q) throw new StatusListWorkflowError("question_not_found", 404);
    if (config) {
      const siblings = await client.query(`SELECT 1 FROM campaign_status_list_questions WHERE item_id=$1 AND logic_operator='ONE'`, [q.item_id]);
      if (q.confirmation_type === "auto" || q.question_selection_mode === "single" || siblings.rowCount ||
        !(config.source === "representative_assigned" ? ["yesno", "yes_no"] : ["text", "string"]).includes(q.field_type))
        throw new StatusListWorkflowError("invalid_source_question");
      await client.query(`INSERT INTO mission_status_list_sources(campaign_id,question_id,source)
        VALUES($1,$2,$3) ON CONFLICT(question_id) DO UPDATE SET
        revision=CASE WHEN mission_status_list_sources.source<>EXCLUDED.source THEN gen_random_uuid()::text ELSE mission_status_list_sources.revision END,
        source=EXCLUDED.source`, [campaignId, questionId, config.source]);
      await client.query("UPDATE campaign_status_list_questions SET is_hidden=$2,updated_at=now() WHERE id=$1", [questionId, config.hidden]);
    } else {
      await client.query("DELETE FROM mission_status_list_sources WHERE campaign_id=$1 AND question_id=$2", [campaignId, questionId]);
    }
    await assertCallbackConfigurationIndependent(client, campaignId);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function evaluateBackgroundContact(contactId: string) {
  return workflowTransaction(contactId, async client => {
    const events: Parameters<typeof executeEvent>[1][] = await evaluateOptionSources(client, contactId);
    const { rows: configs } = await client.query(`SELECT s.*,q.question_text,q.field_type,i.confirmation_type,i.question_selection_mode,
      EXISTS(SELECT 1 FROM campaign_status_list_questions x WHERE x.item_id=q.item_id AND x.logic_operator='ONE') AS exclusive
      FROM mission_status_list_sources s JOIN campaign_status_list_questions q ON q.id=s.question_id
      JOIN campaign_status_list_items i ON i.id=q.item_id AND i.campaign_id=s.campaign_id
      JOIN campaign_contacts cc ON cc.campaign_id=s.campaign_id WHERE cc.id=$1 ORDER BY s.question_id`, [contactId]);
    if (!configs.length) {
      for (const event of events) await executeEvent(client, event);
      return;
    }
    const { rows: contacts } = await client.query(`SELECT cc.*,
      CASE cc.contact_type WHEN 'clinic' THEN EXISTS(SELECT 1 FROM clinics WHERE id=cc.clinic_id)
      WHEN 'hospital' THEN EXISTS(SELECT 1 FROM hospitals WHERE id=cc.hospital_id) ELSE false END AS known
      FROM campaign_contacts cc WHERE cc.id=$1`, [contactId]);
    const contact = contacts[0];
    const assignments = contact.known ? (await client.query(contact.contact_type === "clinic"
      ? `SELECT user_id,assignment_type FROM clinic_representative_assignments WHERE clinic_id=$1 AND valid_to IS NULL AND valid_from<=now()`
      : `SELECT user_id,assignment_type FROM hospital_representative_assignments WHERE hospital_id=$1 AND valid_to IS NULL AND valid_from<=now()`,
    [contact.contact_type === "clinic" ? contact.clinic_id : contact.hospital_id])).rows : [];
    if (assignments.length > 1) throw new StatusListWorkflowError("ambiguous_representative");
    for (const config of configs) {
      // Later edits to the original question must not silently change its type
      // or introduce exclusive selections capable of overwriting source data.
      if (config.confirmation_type === "auto" || config.question_selection_mode === "single" || config.exclusive ||
        !(config.source === "representative_assigned" ? ["yesno", "yes_no"] : ["text", "string"]).includes(config.field_type))
        throw new StatusListWorkflowError("invalid_source_question");
      const value: WorkflowAnswer | null = !contact.known ? null : config.source === "representative_assigned"
        ? assignments.length ? "yes" : "no" : assignments[0]?.assignment_type ?? null;
      const old = (await client.query(`SELECT value,config_revision FROM mission_status_list_source_state
        WHERE campaign_contact_id=$1 AND question_id=$2`, [contactId, config.question_id])).rows[0];
      const baseline = !old || old.config_revision !== config.revision;
      if (!baseline && old.value === value) continue;
      const previous = (await client.query(`SELECT value FROM mission_status_list_answers
        WHERE campaign_contact_id=$1 AND question_id=$2`, [contactId, config.question_id])).rows[0]?.value ?? null;
      const revision = randomUUID();
      await client.query(`INSERT INTO mission_status_list_source_state(campaign_contact_id,question_id,config_revision,value)
        VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(campaign_contact_id,question_id)
        DO UPDATE SET config_revision=EXCLUDED.config_revision,value=EXCLUDED.value,updated_at=now()`,
      [contactId, config.question_id, config.revision, JSON.stringify(value)]);
      await client.query(`INSERT INTO mission_status_list_answers(campaign_contact_id,question_id,value,revision,updated_by)
        VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(campaign_contact_id,question_id)
        DO UPDATE SET value=EXCLUDED.value,revision=EXCLUDED.revision,updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [contactId, config.question_id, JSON.stringify(value), revision, STATUS_LIST_SYSTEM_ACTOR]);
      const transition = (await client.query(`INSERT INTO mission_status_list_transitions
        (campaign_id,campaign_contact_id,question_id,question_label,previous,value,baseline)
        VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) RETURNING id,created_at`,
      [contact.campaign_id, contactId, config.question_id, config.question_text, JSON.stringify(previous), JSON.stringify(value), baseline])).rows[0];
      // Unknown entity state is never interpreted as an actionable "no".
      if (!baseline && contact.known) events.push({
        campaignId: contact.campaign_id, campaignContactId: contactId, actorId: STATUS_LIST_SYSTEM_ACTOR,
        source: { kind: "question", id: config.question_id }, value,
        eventId: `transition:${transition.id}`, occurredAt: transition.created_at, trigger: "background_transition",
      });
    }
    // All source answers are committed with their effects; conditions observe the
    // same new source snapshot, not the ordering of question IDs.
    for (const event of events) await executeEvent(client, event);
  });
}

export async function installStatusListBackgroundTriggers() {
  for (const table of ["clinic_representative_assignments", "hospital_representative_assignments", "campaign_contacts", "mission_status_list_sources", "mission_status_list_option_sources"]) {
    // Fixed server-owned identifiers, never user input. CREATE OR REPLACE avoids
    // a DROP window and makes restarts safe on production without db:push.
    const events = table === "campaign_contacts" ? "INSERT OR DELETE OR UPDATE OF contact_type,clinic_id,hospital_id,campaign_id,assigned_to" : "INSERT OR UPDATE OR DELETE";
    await pool.query(`CREATE OR REPLACE TRIGGER mission_status_list_changed AFTER ${events} ON ${table}
      FOR EACH ROW EXECUTE FUNCTION mission_status_list_enqueue()`);
  }
  for (const table of ["call_logs", "communication_messages"]) {
    await pool.query(`CREATE OR REPLACE TRIGGER mission_status_list_communication_changed
      AFTER INSERT OR UPDATE OR DELETE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION mission_status_list_communication_changed()`);
  }
}

let recoveryCursor = "";
let nextRecoveryAt = 0;
export async function recoverStatusListBackground(client: Pick<PoolClient, "query"> = pool) {
  const contacts = (await client.query(`SELECT cc.id FROM campaign_contacts cc
    WHERE cc.id>$1 AND (EXISTS(SELECT 1 FROM mission_status_list_sources s WHERE s.campaign_id=cc.campaign_id)
      OR EXISTS(SELECT 1 FROM mission_status_list_option_sources s WHERE s.campaign_id=cc.campaign_id))
    ORDER BY cc.id LIMIT 50`, [recoveryCursor])).rows;
  for (const contact of contacts) {
    try { await evaluateBackgroundContact(contact.id); }
    catch (error) { console.error("[status-list-background]", error instanceof StatusListWorkflowError ? error.code : "recovery_failed"); }
  }
  recoveryCursor = contacts.length === 50 ? contacts.at(-1)!.id : "";
}
export async function runStatusListBackgroundBatch() {
  // Session-scoped leader lock held on one dedicated client across pool awaits.
  const leader = await pool.connect();
  let locked = false;
  try {
    locked = (await leader.query("SELECT pg_try_advisory_lock(hashtextextended('mission-background-worker',0)) AS locked")).rows[0].locked;
    if (!locked) return;
    const pending = (await leader.query("SELECT * FROM mission_status_list_dirty WHERE due_at<=now() ORDER BY due_at,kind,entity_id LIMIT 5")).rows;
    for (const job of pending) {
      const contacts = (await leader.query(`SELECT cc.id FROM campaign_contacts cc WHERE cc.id>$3 AND
        (EXISTS(SELECT 1 FROM mission_status_list_sources s WHERE s.campaign_id=cc.campaign_id)
          OR EXISTS(SELECT 1 FROM mission_status_list_option_sources s WHERE s.campaign_id=cc.campaign_id)) AND (
          ($1='clinic' AND cc.contact_type='clinic' AND cc.clinic_id=$2) OR
          ($1='hospital' AND cc.contact_type='hospital' AND cc.hospital_id=$2) OR
          ($1='mission' AND cc.campaign_id=$2) OR ($1='contact' AND cc.id=$2))
        ORDER BY cc.id LIMIT 25`, [job.kind, job.entity_id, job.cursor])).rows;
      try {
        for (const contact of contacts) await evaluateBackgroundContact(contact.id);
        if (contacts.length === 25) await leader.query(`UPDATE mission_status_list_dirty SET cursor=$4
          WHERE kind=$1 AND entity_id=$2 AND revision=$3`, [job.kind, job.entity_id, job.revision, contacts.at(-1)!.id]);
        else await leader.query("DELETE FROM mission_status_list_dirty WHERE kind=$1 AND entity_id=$2 AND revision=$3", [job.kind, job.entity_id, job.revision]);
      } catch (error) {
        await leader.query(`UPDATE mission_status_list_dirty SET due_at=now()+interval '30 seconds'
          WHERE kind=$1 AND entity_id=$2 AND revision=$3`, [job.kind, job.entity_id, job.revision]);
        console.error("[status-list-background]", error instanceof StatusListWorkflowError ? error.code : "evaluation_failed");
      }
    }
    if (Date.now() >= nextRecoveryAt) {
      // Bounded rotating scan also handles scheduled valid_from boundaries,
      // downtime and a missed/deleted dirty hint. No agent or HTTP GET required.
      await recoverStatusListBackground(leader);
      nextRecoveryAt = Date.now() + 30_000;
    }
  } finally {
    if (locked) await leader.query("SELECT pg_advisory_unlock(hashtextextended('mission-background-worker',0))");
    leader.release();
  }
}

export async function startStatusListBackgroundWorker() {
  await installStatusListBackgroundTriggers();
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runStatusListBackgroundBatch(); }
    catch { console.error("[status-list-background] worker_failed"); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 5000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
