import type { Pool, PoolClient } from "pg";
import type { RequestHandler } from "express";
import { AsyncLocalStorage } from "node:async_hooks";
import { transitionConditionPasses, type TransitionAction } from "../../shared/status-list-transition";
import { isEligibleScheduledCampaignCallback } from "../../shared/scheduled-callback";
import { serviceCallbackDate } from "./status-list-service-calendar";

export const CALLBACK_CONVERTER = "callback-compat-v1";
export const callbackBarrier = (id: string) => `mission-callback-admission:${id}`;
const admitted = new AsyncLocalStorage<string>();
export const hasCallbackAdmission = (campaignId: string) => admitted.getStore() === campaignId;

/** Admission is held until ALL legacy work in an HTTP request has finished, not
 * merely until its confirmation INSERT commits. The supplied pool MUST be the
 * dedicated admission pool, never the business-query pool. No endpoint activates a group.
 */
export function callbackAdmission(admissionPool: Pool, handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    let client: PoolClient | undefined;
    let released = false;
    const release = async () => {
      if (released || !client) return;
      released = true;
      try {
        await client.query("SELECT pg_advisory_unlock_shared(hashtextextended($1,0))", [callbackBarrier(req.params.campaignId)]);
        client.release();
      } catch {
        // Never return a possibly still-locked session to the admission pool.
        client.release(true);
      }
    };
    try {
      client = await admissionPool.connect();
      await client.query("SELECT pg_advisory_lock_shared(hashtextextended($1,0))", [callbackBarrier(req.params.campaignId)]);
      await admitted.run(req.params.campaignId, () => handler(req, res, next));
    } catch (error) { next(error); }
    finally { await release(); }
  };
}

export async function isManagedCallback(client: Pick<PoolClient, "query">, campaignId: string, actionId: string) {
  return !!(await client.query(`SELECT 1 FROM mission_callback_groups
    WHERE campaign_id=$1 AND enrolled AND EXISTS
    (SELECT 1 FROM jsonb_array_elements(actions) a WHERE a->>'id'=$2)`, [campaignId, actionId])).rowCount;
}

export type CallbackEvent = {
  id: string; campaign_id: string; campaign_contact_id: string; event_id: string; action_id: string;
  owner: "legacy" | "service"; generation: number; actor_id: string; occurred_at: Date;
  payload: { action: TransitionAction & { dispositionCode?: string }; callCount: number | null; manualDate?: string; note?: string; manual?: boolean };
};

/** Real DB executor. Callback, contact history and receipt commit together.
 * Both owners use this compatibility boundary; dedup identity excludes owner.
 * A crash/ambiguous COMMIT is safe: retry reads the durable receipt, not a flag.
 */
export async function executeCallbackEvent(client: PoolClient, event: CallbackEvent) {
  const action = event.payload.action;
  if (action.excluded || action.issues.length || !action.callback ||
      !["set_callback", "set_contact_status"].includes(action.type))
    throw new Error("callback_action_unsupported");
  const pass = event.payload.manual ? true :
    action.condition.kind === "call_count" && event.payload.callCount === null ? false :
      transitionConditionPasses(action.condition, event.payload.callCount ?? 0);
  if (pass === null) throw new Error("callback_condition_unsupported");
  if (!pass) return { status: "condition_false" };
  const contact = (await client.query(`SELECT * FROM campaign_contacts
    WHERE id=$1 AND campaign_id=$2 FOR UPDATE`, [event.campaign_contact_id, event.campaign_id])).rows[0];
  if (!contact) throw new Error("callback_contact_missing");
  if (action.callback.existing === "keep_existing" &&
      isEligibleScheduledCampaignCallback(contact.status, contact.callback_date))
    return { status: "kept_existing", callbackDate: new Date(contact.callback_date).toISOString() };
  const date = serviceCallbackDate(action.callback, new Date(event.occurred_at), event.payload.manualDate);
  if (action.type === "set_contact_status" && !action.dispositionCode) throw new Error("callback_disposition_missing");
  await client.query(`UPDATE campaign_contacts SET callback_date=$3,status='callback_scheduled',
    callback_status_list_item_id=$4,assigned_to=$5,updated_at=now(),
    callback_note=CASE WHEN nullif(trim($6::text),'') IS NULL THEN callback_note ELSE trim($6) END,
    disposition_code=CASE WHEN $7::boolean THEN $8 ELSE disposition_code END
    WHERE id=$1 AND campaign_id=$2`,
  [event.campaign_contact_id, event.campaign_id, date, action.itemId, event.actor_id,
    event.payload.note ?? null, action.type === "set_contact_status", action.dispositionCode ?? null]);
  const metadata = { actionType: action.type, automationId: action.id, campaignId: event.campaign_id,
    callbackDate: date.toISOString(), callbackNote: event.payload.note?.trim() || null,
    ...(action.type === "set_contact_status" ? { dispositionCode: action.dispositionCode, status: "callback_scheduled" } : {}),
    executor: event.owner, eventId: event.event_id, generation: event.generation };
  await client.query(`INSERT INTO campaign_contact_history(campaign_contact_id,user_id,action,metadata)
    VALUES($1,$2,'status_list_action',$3::jsonb)`,
  [event.campaign_contact_id, event.actor_id, JSON.stringify(metadata)]);
  return { status: "changed", callbackDate: date.toISOString() };
}

/** One event per transaction; SKIP LOCKED plus a per-contact lock preserves
 * event/action order even with multiple workers. Unresolved events block cutover.
 */
export async function drainCallbackEvents(pool: Pool, limit = 50) {
  let completed = 0;
  for (let i = 0; i < limit; i++) {
    const client = await pool.connect();
    let event: CallbackEvent | undefined;
    try {
      await client.query("BEGIN");
      const candidate = (await client.query(`SELECT e.campaign_contact_id FROM mission_callback_service_events e
        WHERE state='pending' AND NOT EXISTS(SELECT 1 FROM mission_callback_service_events b
          WHERE b.campaign_contact_id=e.campaign_contact_id AND b.state='blocked' AND b.id<e.id)
        ORDER BY id LIMIT 1`)).rows[0];
      if (!candidate) { await client.query("ROLLBACK"); break; }
      // Same serialization key as manual dispatch. No event lock before this lock.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-callback-contact:${candidate.campaign_contact_id}`]);
      event = (await client.query(`SELECT * FROM mission_callback_service_events e
        WHERE campaign_contact_id=$1 AND state='pending'
        AND NOT EXISTS(SELECT 1 FROM mission_callback_service_events b
          WHERE b.campaign_contact_id=e.campaign_contact_id AND b.state='blocked' AND b.id<e.id)
        ORDER BY id LIMIT 1 FOR UPDATE`, [candidate.campaign_contact_id])).rows[0];
      if (!event) { await client.query("ROLLBACK"); break; }
      const group = (await client.query(`SELECT * FROM mission_callback_groups
        WHERE campaign_id=$1 FOR SHARE`, [event.campaign_id])).rows[0];
      if (!group?.enrolled || group.owner !== event.owner || group.generation !== event.generation)
        throw new Error("callback_owner_conflict");
      const result = await executeCallbackEvent(client, event);
      await client.query("UPDATE mission_callback_service_events SET state='done',result=$2::jsonb WHERE id=$1", [event.id, JSON.stringify(result)]);
      await client.query("COMMIT");
      completed++;
    } catch {
      await client.query("ROLLBACK");
      if (event) await client.query(`UPDATE mission_callback_service_events SET attempts=attempts+1,
        state=CASE WHEN attempts>=4 THEN 'blocked' ELSE state END,
        result='{"status":"retry_required"}'::jsonb WHERE id=$1 AND state='pending'`, [event.id]);
      // No recipient, note or raw database/vendor error is logged.
      break;
    } finally { client.release(); }
  }
  return completed;
}

/** Manual run is a distinct explicit event, not a fabricated confirmation.
 * Its caller must reuse the request id on transport retry. Historical receipts
 * are retained across owner switches; changed payload under an old id is rejected.
 */
export async function runManagedCallback(pool: Pool, input: {
  campaignId: string; campaignContactId: string; actionId: string; actorId: string;
  eventId: string; manualDate?: string | null; note?: string | null;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(input.eventId)) throw new Error("callback_event_identity_required");
  const client = await pool.connect();
  let id: string;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-callback-contact:${input.campaignContactId}`]);
    const group = (await client.query(`SELECT * FROM mission_callback_groups
      WHERE campaign_id=$1 AND enrolled FOR SHARE`, [input.campaignId])).rows[0];
    const action = group?.actions.find((a: TransitionAction) => a.id === input.actionId);
    if (!action) throw new Error("callback_action_not_managed");
    const raw = (await client.query(`SELECT md5((CASE
      WHEN coalesce(original_native.config->>'execution_policy','inherit')='inherit'
      THEN original_native.config-'execution_policy' ELSE original_native.config END)::text) AS fingerprint,
      md5(to_jsonb(d)::text) AS disposition_fingerprint FROM campaign_status_list_automations a
      CROSS JOIN LATERAL (SELECT CASE
      WHEN coalesce(to_jsonb(a)->'service_action_config','null'::jsonb)='null'::jsonb
      THEN to_jsonb(a)-'service_action_config'-'service_action_owner_id'
      ELSE to_jsonb(a) END AS config) original_native
      LEFT JOIN campaign_dispositions d ON d.id=a.disposition_id WHERE a.id=$1`, [input.actionId])).rows[0];
    if (raw?.fingerprint !== action.fingerprint ||
        (action.type === "set_contact_status" && raw.disposition_fingerprint !== action.dispositionFingerprint))
      throw new Error("callback_configuration_changed");
    if (!(await client.query("SELECT 1 FROM campaign_contacts WHERE id=$1 AND campaign_id=$2",
      [input.campaignContactId, input.campaignId])).rowCount) throw new Error("callback_contact_missing");
    const payload = { action, callCount: 0, manual: true, manualDate: input.manualDate ?? null, note: input.note ?? null };
    await client.query(`INSERT INTO mission_callback_service_events(campaign_id,campaign_contact_id,event_id,
      action_id,owner,generation,actor_id,occurred_at,payload)
      VALUES($1,$2,$3,$4,$5,$6,$7,now(),$8::jsonb) ON CONFLICT DO NOTHING`,
    [input.campaignId, input.campaignContactId, `manual:${input.eventId}`, input.actionId,
      group.owner, group.generation, input.actorId, JSON.stringify(payload)]);
    const row = (await client.query(`SELECT *,payload=$5::jsonb AS same FROM mission_callback_service_events
      WHERE campaign_id=$1 AND campaign_contact_id=$2 AND event_id=$3 AND action_id=$4`,
    [input.campaignId, input.campaignContactId, `manual:${input.eventId}`, input.actionId, JSON.stringify(payload)])).rows[0];
    if (!row.same || row.actor_id !== input.actorId) throw new Error("callback_event_identity_conflict");
    id = row.id;
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  await drainCallbackEvents(pool);
  const receipt = (await pool.query("SELECT state,result FROM mission_callback_service_events WHERE id=$1", [id])).rows[0];
  if (receipt.state !== "done") throw new Error("callback_execution_pending");
  return { ok: true, callbackDate: receipt.result.callbackDate, keptExisting: receipt.result.status === "kept_existing" };
}

export function startCallbackServiceWorker(pool: Pool) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await drainCallbackEvents(pool); }
    catch { console.error("[status-list-callback] worker_failed"); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 2000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
