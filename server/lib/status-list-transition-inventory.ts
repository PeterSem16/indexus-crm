import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import {
  parseTransitionCondition,
  type TransitionAction,
  type TransitionInventory,
  type TransitionIssue,
} from "../../shared/status-list-transition";
import {
  EXCLUDED_MEDICAL_PARTNER_EMAIL,
  MEDICAL_PARTNER_AUDIT_CAMPAIGN,
} from "../../shared/status-list-transition-audit";

export type TransitionInventoryRow = {
  config: Record<string, unknown>; fingerprint: string;
  item_id: string; step_code: string; disposition_type: string | null;
  disposition_campaign_id: string | null; question_valid: boolean;
};
export function normalizeTransitionAction(campaignId: string, row: TransitionInventoryRow): TransitionAction {
  const raw = row.config;
  const issues: TransitionIssue[] = [];
  const condition = parseTransitionCondition(raw);
  if (condition.kind === "unsupported") issues.push("condition_unsupported");
  if (!row.question_valid) issues.push("reference_missing");
  const type = typeof raw.action_type === "string" ? raw.action_type : "unknown";
  const id = String(raw.id);
  const exclusionApplies = campaignId === MEDICAL_PARTNER_AUDIT_CAMPAIGN && id === EXCLUDED_MEDICAL_PARTNER_EMAIL.id;
  const excluded = exclusionApplies && row.fingerprint === EXCLUDED_MEDICAL_PARTNER_EMAIL.fingerprint;
  if (exclusionApplies && !excluded) issues.push("exclusion_changed");
  if (excluded) issues.push("excluded_by_owner");
  const isStatus = type === "set_contact_status";
  if (isStatus && (!raw.disposition_id || row.disposition_campaign_id !== campaignId))
    issues.push("reference_missing");
  if (type === "notify_role") issues.push("legacy_notification_unhandled");
  else if (!excluded && type !== "set_callback" && !isStatus) issues.push("action_unsupported");
  // Other status dispositions are not silently converted into callback writes.
  if (isStatus && row.disposition_type !== "callback") issues.push("action_unsupported");
  const days = raw.callback_offset_days ?? 1;
  const validDays = typeof days === "number" && Number.isInteger(days) && days >= 0 && days <= 3660;
  const policy = raw.callback_existing_policy ?? "replace";
  const weekdays = raw.callback_business_days_only ?? true;
  if ((type === "set_callback" || isStatus) &&
      (!validDays || !["replace", "keep_existing"].includes(String(policy)) || typeof weekdays !== "boolean"))
    issues.push("calendar_unsupported");
  return {
    id, itemId: row.item_id, stepCode: row.step_code, type, fingerprint: row.fingerprint,
    dispositionId: typeof raw.disposition_id === "string" ? raw.disposition_id : null,
    condition, excluded, issues: [...new Set(issues)],
    callback: validDays && (type === "set_callback" || (isStatus && row.disposition_type === "callback")) ? {
      days, time: typeof raw.callback_time === "string" ? raw.callback_time : null,
      weekdaysOnly: weekdays !== false, existing: policy === "keep_existing" ? "keep_existing" : "replace",
    } : null,
  };
}

/** One consistent read-only configuration snapshot. No workflow/dispatch imports.
 * Contact tables, answers, messages and execution histories are deliberately not read.
 */
export async function readTransitionInventory(client: Pick<PoolClient, "query">, campaignId: string,
  options: { withinTransaction?: boolean } = {}): Promise<TransitionInventory> {
  if (!options.withinTransaction) await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    const { rows } = await client.query<TransitionInventoryRow>(`
      SELECT native.config AS config, md5(native.config::text) AS fingerprint,
        i.id AS item_id,i.step_id AS step_code,
        d.action_type AS disposition_type,d.campaign_id AS disposition_campaign_id,
        (a.question_id IS NULL OR EXISTS(
          SELECT 1 FROM campaign_status_list_questions q
          WHERE q.id=a.question_id AND q.item_id=i.id
        )) AS question_valid
      FROM campaign_status_list_automations a
      CROSS JOIN LATERAL (SELECT CASE
        WHEN coalesce(to_jsonb(a)->'service_action_config','null'::jsonb)='null'::jsonb
        THEN to_jsonb(a)-'service_action_config'-'service_action_owner_id'
        ELSE to_jsonb(a) END AS config) original_native
      -- Preserve approvals after the additive execution-policy migration.
      CROSS JOIN LATERAL (SELECT CASE
        WHEN coalesce(original_native.config->>'execution_policy','inherit')='inherit'
        THEN original_native.config-'execution_policy'
        ELSE original_native.config END AS config) native
      JOIN campaign_status_list_items i ON i.id=a.status_list_item_id
      LEFT JOIN campaign_dispositions d ON d.id=a.disposition_id
      WHERE i.campaign_id=$1 ORDER BY i.sort_order,i.id,a.sort_order,a.id`, [campaignId]);
    const { rows: metadata } = await client.query(`
      SELECT transaction_timestamp() AS captured_at,
        (SELECT count(*)::int FROM campaign_status_list_items WHERE campaign_id=$1) AS item_count,
        (SELECT count(*)::int FROM campaign_status_list_questions q JOIN campaign_status_list_items i
          ON i.id=q.item_id WHERE i.campaign_id=$1) AS question_count,
        (to_regclass('public.mission_status_list_rules') IS NOT NULL
          AND to_regclass('public.mission_status_list_sources') IS NOT NULL
          AND to_regclass('public.mission_status_list_option_sources') IS NOT NULL) AS schema_available,
        (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb)
          FROM campaign_status_list_items i WHERE i.campaign_id=$1) AS item_config,
        (SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb)
          FROM campaign_status_list_questions q JOIN campaign_status_list_items i
          ON i.id=q.item_id WHERE i.campaign_id=$1) AS question_config`, [campaignId]);
    const meta = metadata[0];
    const fingerprint = createHash("sha256").update(JSON.stringify({
      campaignId, rows, items: meta.item_config, questions: meta.question_config, schema: meta.schema_available,
    })).digest("hex");
    return {
      campaignId, source: "current_configuration",
      capturedAt: new Date(meta.captured_at).toISOString(), fingerprint,
      actions: rows.map(row => normalizeTransitionAction(campaignId, row)),
      evidence: {
        productionLiveVerified: false, sourceCommit: null,
        schemaAvailable: meta.schema_available, itemCount: meta.item_count, questionCount: meta.question_count,
      },
      activationAllowed: false,
    };
  } finally {
    if (!options.withinTransaction) await client.query("ROLLBACK");
  }
}
