import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { medicalPartnerAudit, MEDICAL_PARTNER_AUDIT_CAMPAIGN, EXCLUDED_MEDICAL_PARTNER_EMAIL } from "../../shared/status-list-transition-audit";
import type { CallbackOwner, CallbackTransitionReadiness } from "../../shared/status-list-callback-transition";
import { readTransitionInventory } from "./status-list-transition-inventory";
import { callbackDecision, type CallbackEnvelope } from "./status-list-callback-compatible";

type Client = Pick<PoolClient, "query">;
type Connections = Pick<typeof pool, "connect">;
export class CallbackTransitionError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
const lockKey = (campaignId: string) => `mission-callback-owner:${campaignId}`;
export async function lockCallbackTransition(client: Client, campaignId: string, exclusive = false) {
  await client.query(`SELECT pg_advisory_xact_lock${exclusive ? "" : "_shared"}(hashtextextended($1,0))`, [lockKey(campaignId)]);
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value, (_key, item) =>
  item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)).digest("hex");

/** Every evidence item comes from this server's DB in the current transaction.
 * Uploaded/operator-provided files and historical sample hashes cannot approve a switch. */
export async function callbackReadiness(client: Client, campaignId: string): Promise<CallbackTransitionReadiness> {
  const mission = (await client.query("SELECT name FROM campaigns WHERE id=$1", [campaignId])).rows[0];
  if (!mission) throw new CallbackTransitionError("mission_not_found", 404);
  const base: CallbackTransitionReadiness = { campaignId, missionName: mission.name, fingerprint: "",
    capturedAt: new Date().toISOString(), owner: "legacy", supported: campaignId === MEDICAL_PARTNER_AUDIT_CAMPAIGN,
    ready: false, blockers: [], callbackCount: 0, pendingCount: 0, failedCount: 0, legacyOnlyCount: 0, audit: [] };
  if (!base.supported) return { ...base, blockers: ["unsupported_mission"] };
  const inventory = await readTransitionInventory(client, campaignId, { withinTransaction: true });
  const rows = inventory.actions;
  const expected = medicalPartnerAudit(campaignId)!.actions;
  const expectedCallbacks = expected.filter(a => a.callback);
  const callbacks = rows.filter(a => a.callback);
  const blockers = new Set<string>();
  if (!callbacks.length) blockers.add("no_callbacks");
  if (rows.length !== expected.length || rows.some(a => !expected.some(e => e.id === a.id)))
    blockers.add("untracked_actions");
  for (const e of expected) {
    const a = rows.find(a => a.id === e.id);
    if (!a || a.type !== e.type || a.itemId !== e.itemId ||
      JSON.stringify(a.condition) !== JSON.stringify(e.condition)) blockers.add("legacy_config_changed");
  }
  for (const e of expectedCallbacks) {
    const a = rows.find(a => a.id === e.id);
    if (!a || a.type !== e.type || a.itemId !== e.itemId || a.dispositionId !== e.dispositionId ||
      JSON.stringify(a.condition) !== JSON.stringify(e.condition) ||
      JSON.stringify(a.callback && { ...a.callback, time: a.callback.time || "09:00" }) !== JSON.stringify(e.callback))
      blockers.add("legacy_config_changed");
    if (a?.issues.length || !a?.callback) blockers.add("callback_config_unsupported");
  }
  const references = (await client.query(`SELECT a.id,d.code,d.action_type,d.campaign_id,
      a.email_recipients,a.question_id
    FROM campaign_status_list_automations a JOIN campaign_status_list_items i ON i.id=a.status_list_item_id
    LEFT JOIN campaign_dispositions d ON d.id=a.disposition_id
    WHERE i.campaign_id=$1 ORDER BY a.id`, [campaignId])).rows;
  const email = references.find(r => r.id === EXCLUDED_MEDICAL_PARTNER_EMAIL.id);
  if (!email || !Array.isArray(email.email_recipients) || email.email_recipients.length ||
    rows.find(a => a.id === email.id)?.type !== "send_email_group") blockers.add("legacy_config_changed");
  for (const a of callbacks) {
    const ref = references.find(r => r.id === a.id);
    if (!ref || ref.question_id || (a.type === "set_contact_status" &&
      (!ref.code || ref.action_type !== "callback" || ref.campaign_id !== campaignId)))
      blockers.add("unsupported_references");
  }
  // Unknown/configured sources are not assumed independent merely because they
  // are not shown in the old action list.
  const dependencies = (await client.query(`SELECT
    (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]') FROM mission_status_list_rules r
      WHERE r.campaign_id=$1) AS rules,
    (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.question_id),'[]') FROM mission_status_list_sources s
      WHERE s.campaign_id=$1) AS sources,
    (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.group_id),'[]') FROM mission_status_list_option_sources s
      WHERE s.campaign_id=$1) AS option_sources,
    current_database() AS database_identity,current_schema() AS schema_identity,
    inet_server_addr()::text AS server_identity`, [campaignId])).rows[0];
  if (dependencies.rules.some((r: any) => r.definition?.enabled !== false)) blockers.add("internal_workflow_dependency");
  if (dependencies.sources.length || dependencies.option_sources.length) blockers.add("background_dependency");
  const counts = (await client.query(`SELECT
    count(*) FILTER(WHERE status='pending')::int AS pending,
    count(*) FILTER(WHERE status='failed')::int AS failed FROM mission_callback_events WHERE campaign_id=$1`, [campaignId])).rows[0];
  if (counts.pending) blockers.add("pending_events");
  if (counts.failed) blockers.add("failed_events");
  const ownership = (await client.query("SELECT owner FROM mission_callback_ownership WHERE campaign_id=$1", [campaignId])).rows[0];
  const audit = (await client.query(`SELECT s.created_at AS at,s.from_owner AS "from",s.to_owner AS "to",
      u.full_name AS "actorName" FROM mission_callback_switches s LEFT JOIN users u ON u.id=s.actor_id
      WHERE s.campaign_id=$1 ORDER BY s.id DESC LIMIT 20`, [campaignId])).rows;
  return { ...base, fingerprint: hash({ inventory: inventory.fingerprint, references, dependencies }),
    owner: ownership?.owner || "legacy", ready: !blockers.size, blockers: [...blockers],
    callbackCount: callbacks.length, pendingCount: counts.pending, failedCount: counts.failed,
    legacyOnlyCount: rows.length - callbacks.length,
    audit: audit.map(row => ({ ...row, at: new Date(row.at).toISOString() })) };
}

export async function readCallbackReadiness(campaignId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='10s'");
    return await callbackReadiness(client, campaignId);
  } finally {
    try { await client.query("ROLLBACK"); }
    finally { client.release(); }
  }
}

export async function switchCallbackOwner(campaignId: string, actorId: string, input: {
  fingerprint: string; expectedOwner: CallbackOwner; targetOwner: CallbackOwner;
  backupConfirmed: true; missionNameConfirmation: string;
}, connections: Connections = pool) {
  const client = await connections.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='3s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    await lockCallbackTransition(client, campaignId, true);
    // Existing editors need not know our advisory key: table locks prevent a
    // concurrent edit between the final live comparison and ownership commit.
    await client.query(`LOCK TABLE campaigns,campaign_status_list_items,campaign_status_list_questions,
      campaign_status_list_automations,campaign_dispositions,mission_status_list_rules,
      mission_status_list_sources,mission_status_list_option_sources IN SHARE MODE`);
    const current = await callbackReadiness(client, campaignId);
    if (!current.ready || current.fingerprint !== input.fingerprint || current.owner !== input.expectedOwner)
      throw new CallbackTransitionError("readiness_changed");
    if (input.backupConfirmed !== true || input.missionNameConfirmation !== current.missionName ||
      input.targetOwner === current.owner) throw new CallbackTransitionError("confirmation_required", 400);
    if (input.targetOwner === "compatible") {
      const inventory = await readTransitionInventory(client, campaignId, { withinTransaction: true });
      for (const action of inventory.actions.filter(a => a.callback)) {
        const disposition = action.type === "set_contact_status" ? (await client.query(
          "SELECT code FROM campaign_dispositions WHERE id=$1 AND campaign_id=$2", [action.dispositionId, campaignId])).rows[0] : null;
        await client.query(`INSERT INTO mission_callback_candidates
          (campaign_id,automation_id,definition,source_fingerprint,reviewed_by) VALUES($1,$2,$3::jsonb,$4,$5)
          ON CONFLICT(campaign_id,automation_id) DO UPDATE SET definition=EXCLUDED.definition,
          source_fingerprint=EXCLUDED.source_fingerprint,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=now()`,
        [campaignId, action.id, JSON.stringify({ action, dispositionCode: disposition?.code || null }), current.fingerprint, actorId]);
      }
    }
    await client.query(`INSERT INTO mission_callback_ownership(campaign_id,owner,fingerprint)
      VALUES($1,$2,$3) ON CONFLICT(campaign_id) DO UPDATE SET owner=EXCLUDED.owner,
      fingerprint=EXCLUDED.fingerprint,changed_at=now()`, [campaignId, input.targetOwner, current.fingerprint]);
    await client.query(`INSERT INTO mission_callback_switches
      (campaign_id,actor_id,from_owner,to_owner,fingerprint,backup_acknowledged) VALUES($1,$2,$3,$4,$5,true)`,
    [campaignId, actorId, current.owner, input.targetOwner, current.fingerprint]);
    await client.query("COMMIT");
    return { ok: true, owner: input.targetOwner };
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (["55P03", "57014", "40P01"].includes(error?.code)) throw new CallbackTransitionError("readiness_changed");
    throw error;
  } finally { client.release(); }
}

/** Called inside the SAME transaction as a new user confirmation. No historical
 * confirmations are scanned, replayed or backfilled. Unsupported rules stay legacy. */
export async function enqueueCallbackConfirmation(client: Client, input: {
  campaignId: string; campaignContactId: string; confirmationId: string; itemId: string; actorId: string;
  manualDate: string | null; note: string | null; selectedAutomationId?: string; manualExecution?: boolean;
}) {
  if (input.campaignId !== MEDICAL_PARTNER_AUDIT_CAMPAIGN) return;
  await lockCallbackTransition(client, input.campaignId);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [`mission-callback-contact:${input.campaignContactId}`]);
  const ownership = (await client.query("SELECT owner,fingerprint FROM mission_callback_ownership WHERE campaign_id=$1", [input.campaignId])).rows[0];
  const inventory = await readTransitionInventory(client, input.campaignId, { withinTransaction: true });
  // A changed source must not silently execute as an approved compatible rule.
  if (ownership?.owner === "compatible") {
    const current = await callbackReadiness(client, input.campaignId);
    if (current.fingerprint !== ownership.fingerprint || current.blockers.some(b => b !== "pending_events"))
      throw new CallbackTransitionError("legacy_config_changed");
  }
  const supported = inventory.actions.filter(a => a.itemId === input.itemId && a.callback && !a.issues.length && !a.excluded &&
    (!input.selectedAutomationId || a.id === input.selectedAutomationId));
  if (!supported.length) return;
  const { rows: contacts } = await client.query(`SELECT CASE contact_type
    WHEN 'clinic' THEN coalesce(clinic_id,customer_id) WHEN 'hospital' THEN coalesce(hospital_id,customer_id)
    WHEN 'collaborator' THEN coalesce(collaborator_id,customer_id) ELSE customer_id END AS entity_id
    FROM campaign_contacts WHERE id=$1 AND campaign_id=$2`, [input.campaignContactId, input.campaignId]);
  if (!contacts.length) throw new CallbackTransitionError("contact_not_found", 404);
  const callCount = contacts[0].entity_id ? Number((await client.query("SELECT count(*)::int AS count FROM call_logs WHERE contact_id=$1",
    [contacts[0].entity_id])).rows[0].count) : null;
  const at = (await client.query("SELECT clock_timestamp() AS at")).rows[0].at;
  for (const action of supported) {
    const disposition = action.type === "set_contact_status" ? (await client.query(
      "SELECT code FROM campaign_dispositions WHERE id=$1 AND campaign_id=$2", [action.dispositionId, input.campaignId])).rows[0] : null;
    let definition = { action, dispositionCode: disposition?.code || null };
    if (ownership?.owner === "compatible") {
      const candidate = (await client.query(`SELECT definition FROM mission_callback_candidates
        WHERE campaign_id=$1 AND automation_id=$2 AND source_fingerprint=$3`,
      [input.campaignId, action.id, ownership.fingerprint])).rows[0];
      if (!candidate || hash(candidate.definition) !== hash(definition))
        throw new CallbackTransitionError("legacy_config_changed");
      definition = candidate.definition;
    }
    const payload: CallbackEnvelope = { ...definition, callCount, now: new Date(at).toISOString(),
      manualDate: input.manualDate, note: input.note };
    // Existing explicit "run now" bypasses the automatic condition; it is a
    // separate user intent, not a fabricated confirmation/replayed old event.
    if (input.manualExecution) payload.action = { ...payload.action, condition: { kind: "always" } };
    await client.query(`INSERT INTO mission_callback_events(campaign_id,campaign_contact_id,confirmation_id,
      automation_id,item_id,actor_id,owner,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      ON CONFLICT(confirmation_id,automation_id) DO NOTHING`,
    [input.campaignId, input.campaignContactId, input.confirmationId, action.id, input.itemId,
      input.actorId, ownership?.owner || "legacy", JSON.stringify(payload)]);
  }
}

export async function persistCallbackConfirmation(input: {
  campaignId: string; campaignContactId: string; itemId: string; actorId: string;
  manualDate: string | null; note: string | null; itemNote: string | null; skipAutomations: boolean;
}, connections: Connections = pool) {
  const client = await connections.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='15s'");
    await lockCallbackTransition(client, input.campaignId);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      [`mission-confirmation:${input.campaignContactId}:${input.itemId}`]);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      [`mission-callback-contact:${input.campaignContactId}`]);
    const existing = await client.query(`SELECT id FROM campaign_contact_status_list_state
      WHERE campaign_contact_id=$1 AND status_list_item_id=$2`, [input.campaignContactId, input.itemId]);
    if (existing.rowCount) throw new CallbackTransitionError("confirmation_already_exists");
    const inserted = (await client.query(`INSERT INTO campaign_contact_status_list_state
      (campaign_contact_id,status_list_item_id,confirmed_by_user_id,item_note)
      VALUES($1,$2,$3,$4) RETURNING id,campaign_contact_id AS "campaignContactId",
      status_list_item_id AS "statusListItemId",confirmed_by_user_id AS "confirmedByUserId",
      confirmed_at AS "confirmedAt",created_at AS "createdAt",item_note AS "itemNote",note_updated_at AS "noteUpdatedAt"`,
    [input.campaignContactId, input.itemId, input.actorId, input.itemNote])).rows[0];
    if (!input.skipAutomations) await enqueueCallbackConfirmation(client, { ...input, confirmationId: inserted.id });
    await client.query("COMMIT");
    return inserted;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function recordedCallbackActions(confirmationId: string): Promise<Set<string>> {
  const rows = (await pool.query("SELECT automation_id FROM mission_callback_events WHERE confirmation_id=$1", [confirmationId])).rows;
  return new Set(rows.map(row => row.automation_id));
}

export async function runDurableManualCallback(input: {
  campaignId: string; campaignContactId: string; itemId: string; actorId: string;
  automationId: string; requestId: string; manualDate: string | null; note: string | null;
}, connections: Connections = pool) {
  if (input.campaignId !== MEDICAL_PARTNER_AUDIT_CAMPAIGN) return null;
  const identity = `manual:${input.campaignContactId}:${input.actorId}:${input.requestId}`;
  const client = await connections.connect();
  let recorded = false;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='15s'");
    await enqueueCallbackConfirmation(client, { ...input, confirmationId: identity,
      selectedAutomationId: input.automationId, manualExecution: true });
    recorded = !!(await client.query(`SELECT id FROM mission_callback_events
      WHERE confirmation_id=$1 AND automation_id=$2`, [identity, input.automationId])).rowCount;
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  if (!recorded) return null;
  await drainCallbackEvents(input.campaignContactId, connections);
  const read = await connections.connect();
  try {
    const event = (await read.query("SELECT status,result FROM mission_callback_events WHERE confirmation_id=$1 AND automation_id=$2",
      [identity, input.automationId])).rows[0];
    if (event.status !== "done") throw new CallbackTransitionError("callback_pending");
    return { ok: true, ...{
      callbackDate: event.result.callbackDate, keptExisting: event.result.status === "kept_existing",
    } };
  } finally { read.release(); }
}

/** Contact write + idempotency claim + history + completion are ONE PostgreSQL
 * transaction. Worker death before commit rolls all four back; after commit,
 * re-delivery finds done. No "in progress" lease to lose on process death. */
export async function drainCallbackEvents(campaignContactId?: string, connections: Connections = pool): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const client = await connections.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout='10s'");
      // Same lock order as capture: Mission -> contact -> event. The contact
      // lock covers INSERT/COMMIT as well as processing: sequence IDs alone
      // do not guarantee commit order across concurrent confirmations.
      await lockCallbackTransition(client, MEDICAL_PARTNER_AUDIT_CAMPAIGN);
      const next = (await client.query(`SELECT campaign_contact_id FROM mission_callback_events
        WHERE status='pending' AND ($1::varchar IS NULL OR campaign_contact_id=$1)
        ORDER BY id LIMIT 1`, [campaignContactId || null])).rows[0];
      if (!next) { await client.query("COMMIT"); return; }
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`mission-callback-contact:${next.campaign_contact_id}`]);
      const event = (await client.query(`SELECT * FROM mission_callback_events
        WHERE status='pending' AND campaign_contact_id=$1 ORDER BY id LIMIT 1 FOR UPDATE`,
      [next.campaign_contact_id])).rows[0];
      if (!event) { await client.query("COMMIT"); continue; }
      const contact = (await client.query("SELECT status,callback_date FROM campaign_contacts WHERE id=$1 AND campaign_id=$2 FOR UPDATE",
        [event.campaign_contact_id, event.campaign_id])).rows[0];
      if (!contact) throw new Error("callback_contact_missing");
      const payload = event.payload as CallbackEnvelope;
      const decision = callbackDecision(payload, contact);
      if (decision.status === "callback") {
        await client.query(`UPDATE campaign_contacts SET status='callback_scheduled',callback_date=$3,
          callback_status_list_item_id=$4,assigned_to=$5,updated_at=now(),
          disposition_code=CASE WHEN $6::boolean THEN $7::text ELSE disposition_code END,
          callback_note=CASE WHEN $8::text IS NOT NULL AND btrim($8)<>'' THEN btrim($8) ELSE callback_note END
          WHERE id=$1 AND campaign_id=$2`,
        [event.campaign_contact_id, event.campaign_id, decision.callbackDate, event.item_id,
          event.actor_id, payload.action.type === "set_contact_status", payload.dispositionCode, payload.note]);
        await client.query(`INSERT INTO campaign_contact_history(campaign_contact_id,user_id,action,metadata)
          VALUES($1,$2,'status_list_action',$3::jsonb)`,
        [event.campaign_contact_id, event.actor_id, JSON.stringify({ actionType: payload.action.type,
          automationId: event.automation_id, campaignId: event.campaign_id, callbackDate: decision.callbackDate,
          callbackNote: payload.note?.trim() || null, dispositionCode: payload.dispositionCode,
          status: "callback_scheduled", callbackOwner: event.owner, callbackEventId: String(event.id) })]);
      }
      await client.query("UPDATE mission_callback_events SET status='done',result=$2::jsonb,completed_at=now() WHERE id=$1",
        [event.id, JSON.stringify(decision)]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      // Keep pending. A transient database outage must not permanently lose a callback.
      throw error;
    } finally { client.release(); }
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
let draining = false;
export function startCallbackRecovery() {
  if (timer) return;
  const recover = async () => {
    if (draining) return;
    draining = true;
    try { await drainCallbackEvents(); }
    catch { console.error("[mission-callback] recovery pending; will retry"); }
    finally { draining = false; }
  };
  timer = setInterval(() => void recover(), 5000);
  timer.unref();
  void recover();
}
