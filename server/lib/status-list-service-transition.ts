import type { Pool, PoolClient } from "pg";
import { readTransitionInventory } from "./status-list-transition-inventory";
import { callbackBarrier, CALLBACK_CONVERTER } from "./status-list-service";
import { MEDICAL_PARTNER_AUDIT_CAMPAIGN, medicalPartnerAudit } from "../../shared/status-list-transition-audit";
import type { TransitionAction } from "../../shared/status-list-transition";
import { CALLBACK_DEFERRED_PREDICATE } from "./status-list-service-pending";

export type ExecutableCallback = TransitionAction & { dispositionCode?: string; dispositionFingerprint?: string };
const CONFIG_LOCK = `LOCK TABLE campaigns,campaign_status_list_items,campaign_status_list_questions,
 campaign_status_list_automations,campaign_dispositions,mission_status_list_rules,
 mission_status_list_sources,mission_status_list_option_sources IN SHARE MODE`;

async function transaction<T>(pool: Pool, campaignId: string, run: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [callbackBarrier(campaignId)]);
    // Serialize with the pre-existing owner/candidate mechanism as well.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-callback-owner:${campaignId}`]);
    await client.query(CONFIG_LOCK);
    if ((await client.query("SELECT to_regclass(current_schema()||'.mission_callback_ownership') AS t")).rows[0]?.t) {
      if ((await client.query("SELECT 1 FROM mission_callback_ownership WHERE campaign_id=$1 AND owner='compatible'", [campaignId])).rowCount)
        throw new Error("callback_other_executor_active");
    }
    const value = await run(client);
    await client.query("COMMIT");
    return value;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function candidate(client: PoolClient, campaignId: string) {
  // Intentionally scoped to the reviewed Mission; this is not a generic importer.
  if (campaignId !== MEDICAL_PARTNER_AUDIT_CAMPAIGN) throw new Error("callback_mission_not_reviewed");
  const inventory = await readTransitionInventory(client, campaignId, false);
  const expected = medicalPartnerAudit(campaignId)!.actions.filter(a => a.callback && !a.excluded);
  const selected = inventory.actions.filter(a => expected.some(e => e.id === a.id));
  if (selected.length !== 8 || selected.some(a => a.issues.length || a.excluded || !a.callback))
    throw new Error("callback_dependencies_unverified");
  // Never adopt new/changed semantics merely because a converter can express them.
  for (const action of selected) {
    const audited = expected.find(a => a.id === action.id)!;
    if (action.fingerprint !== audited.fingerprint) throw new Error("callback_audit_changed");
  }
  // The excluded email must still be exactly the reviewed exclusion, not a changed
  // action hidden by its old id. notify_role never becomes a service action.
  if (inventory.actions.some(a => a.issues.includes("exclusion_changed")))
    throw new Error("callback_exclusion_changed");
  const actions: ExecutableCallback[] = [];
  for (const action of selected) {
    if (action.type === "set_contact_status") {
      const d = (await client.query(`SELECT code,md5(to_jsonb(d)::text) AS fingerprint
        FROM campaign_dispositions d WHERE id=$1 AND campaign_id=$2 AND action_type='callback'`,
      [action.dispositionId, campaignId])).rows[0];
      if (!d?.code) throw new Error("callback_disposition_missing");
      actions.push({ ...action, dispositionCode: d.code, dispositionFingerprint: d.fingerprint });
    } else actions.push(action);
  }
  return { fingerprint: inventory.fingerprint, actions };
}

/** Idempotent, INACTIVE candidate. No effects, answers, copies or backfill. */
export async function prepareCallbackTransition(pool: Pool, campaignId: string) {
  return transaction(pool, campaignId, async client => {
    const next = await candidate(client, campaignId);
    const existing = (await client.query("SELECT * FROM mission_callback_groups WHERE campaign_id=$1 FOR UPDATE", [campaignId])).rows[0];
    if (existing?.enrolled && existing.fingerprint !== next.fingerprint) throw new Error("callback_enrolled_plan_changed");
    await client.query(`INSERT INTO mission_callback_groups(campaign_id,fingerprint,converter,actions)
      VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(campaign_id) DO UPDATE SET
      fingerprint=EXCLUDED.fingerprint,actions=EXCLUDED.actions,converter=EXCLUDED.converter
      WHERE NOT mission_callback_groups.enrolled`,
    [campaignId, next.fingerprint, CALLBACK_CONVERTER, JSON.stringify(next.actions)]);
    return { ...next, activationAllowed: false as const };
  });
}

/** These are separately audited operator attestations, NOT simulation results.
 * No HTTP route calls these administrative functions. A future authorized
 * cutover must obtain actual approval and a private verified backup first.
 */
export type CallbackApprovalEvidence = {
  executorVersion: typeof CALLBACK_CONVERTER;
  liveInventoryVerified: true;
  runtimeParityVerified: true;
  entryPathsDrained: true;
  deferredExecutionsReviewed: true;
  unknownDeferredExecutions: 0;
  backupRestoreVerified: true;
};
function validEvidence(value: CallbackApprovalEvidence) {
  return value?.executorVersion === CALLBACK_CONVERTER &&
    value.liveInventoryVerified === true && value.runtimeParityVerified === true &&
    value.entryPathsDrained === true && value.deferredExecutionsReviewed === true &&
    value.unknownDeferredExecutions === 0 && value.backupRestoreVerified === true;
}
export async function approveCallbackTransition(pool: Pool, input: {
  campaignId: string; fingerprint: string; generation: number; target: "enroll" | "legacy" | "service";
  approvedBy: string; backupReference: string; evidence: CallbackApprovalEvidence; expiresAt: Date;
}) {
  if (!input.approvedBy?.trim() || !input.backupReference?.trim() || !validEvidence(input.evidence) ||
      !Number.isFinite(input.expiresAt.getTime()) || input.expiresAt <= new Date() ||
      input.expiresAt.getTime() > Date.now() + 60 * 60 * 1000) throw new Error("callback_approval_incomplete");
  return transaction(pool, input.campaignId, async client => {
    const group = (await client.query("SELECT * FROM mission_callback_groups WHERE campaign_id=$1 FOR UPDATE", [input.campaignId])).rows[0];
    const live = await candidate(client, input.campaignId);
    if (!group || group.fingerprint !== input.fingerprint || live.fingerprint !== input.fingerprint ||
        group.generation !== input.generation) throw new Error("callback_plan_stale");
    const { rows } = await client.query(`INSERT INTO mission_callback_approvals
      (campaign_id,fingerprint,generation,target,approved_by,backup_reference,evidence,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING id`,
    [input.campaignId, input.fingerprint, input.generation, input.target, input.approvedBy,
      input.backupReference.trim(), JSON.stringify(input.evidence), input.expiresAt]);
    return rows[0].id as string;
  });
}

/** Enrollment and both cutover directions share the SAME safety gates.
 * The exclusive admission lock drains pre-existing legacy HTTP/background work.
 * Group row lock serializes capture, workers and the future-event boundary.
 * Existing callbacks/history are deliberately not read, changed or recreated.
 */
export async function switchCallbackOwnership(pool: Pool, campaignId: string, approvalId: string) {
  return transaction(pool, campaignId, async client => {
    const group = (await client.query("SELECT * FROM mission_callback_groups WHERE campaign_id=$1 FOR UPDATE", [campaignId])).rows[0];
    const approval = (await client.query(`SELECT * FROM mission_callback_approvals
      WHERE id=$1 AND campaign_id=$2 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE`, [approvalId, campaignId])).rows[0];
    if (!group || !approval || !validEvidence(approval.evidence) ||
        approval.generation !== group.generation || approval.fingerprint !== group.fingerprint ||
        group.converter !== CALLBACK_CONVERTER) throw new Error("callback_approval_required");
    const live = await candidate(client, campaignId);
    if (live.fingerprint !== group.fingerprint ||
        !(await client.query("SELECT $1::jsonb=$2::jsonb AS same", [JSON.stringify(live.actions), JSON.stringify(group.actions)])).rows[0].same)
      throw new Error("callback_plan_stale");
    if ((await client.query(`SELECT 1 FROM mission_callback_service_events WHERE campaign_id=$1 AND state<>'done' LIMIT 1`, [campaignId])).rowCount)
      throw new Error("callback_inflight_or_unresolved");
    if ((await client.query("SELECT to_regclass(current_schema()||'.mission_callback_events') AS t")).rows[0]?.t &&
        (await client.query("SELECT 1 FROM mission_callback_events WHERE campaign_id=$1 AND status<>'done' LIMIT 1", [campaignId])).rowCount)
      throw new Error("callback_other_executor_pending");
    // Take this lock only AFTER the group lock. Workers hold group SHARE while
    // updating contacts (which enqueue dirty work), so the opposite order deadlocks.
    await client.query("LOCK TABLE mission_status_list_dirty IN SHARE MODE");
    if ((await client.query(`SELECT 1 FROM mission_status_list_dirty d
      WHERE ${CALLBACK_DEFERRED_PREDICATE} LIMIT 1`, [campaignId])).rowCount)
      throw new Error("callback_deferred_or_unknown_work");
    if ((approval.target === "enroll") === group.enrolled) throw new Error("callback_invalid_transition");
    const owner = approval.target === "enroll" ? "legacy" : approval.target;
    if (group.enrolled && owner === group.owner) throw new Error("callback_already_owned");
    const boundary = (await client.query("SELECT coalesce(max(id),0) AS id FROM mission_callback_service_events WHERE campaign_id=$1", [campaignId])).rows[0].id;
    if (!group.enrolled) await client.query(`INSERT INTO mission_callback_baselines(campaign_id,state_id)
      SELECT $1::varchar,s.id FROM campaign_contact_status_list_state s
      JOIN campaign_contacts cc ON cc.id=s.campaign_contact_id
      WHERE cc.campaign_id=$1 AND EXISTS(SELECT 1 FROM jsonb_array_elements($2::jsonb) a
        WHERE a->>'itemId'=s.status_list_item_id) ON CONFLICT DO NOTHING`,
    [campaignId, JSON.stringify(group.actions)]);
    await client.query(`UPDATE mission_callback_groups SET owner=$2,enrolled=true,generation=generation+1 WHERE campaign_id=$1`, [campaignId, owner]);
    await client.query("UPDATE mission_callback_approvals SET consumed_at=now() WHERE id=$1", [approvalId]);
    await client.query(`INSERT INTO mission_callback_cutovers(campaign_id,approval_id,fingerprint,from_owner,to_owner,generation,actor_id,event_boundary)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [campaignId, approvalId, group.fingerprint,
      group.enrolled ? group.owner : "unmanaged_legacy", owner, group.generation + 1, approval.approved_by, boundary]);
    return { owner, generation: group.generation + 1, eventBoundary: boundary };
  });
}
