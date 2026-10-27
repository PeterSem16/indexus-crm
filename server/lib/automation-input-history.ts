import { sql } from "drizzle-orm";
import { db } from "../db";
import type { EligibilityHistory, RuleInputSettings } from "../../shared/automation-eligibility";

type StoredSettings = RuleInputSettings & { fingerprint: string };
function publicSettings({ fingerprint: _fingerprint, ...settings }: StoredSettings): RuleInputSettings {
  return settings;
}

/** SELECT only. Never reconstruct missing bindings from today's rule or source permissions. */
export async function readAutomationInputHistory(ruleId: string, event?: { id: string; createdAt: Date }): Promise<EligibilityHistory> {
  const current = await db.execute(sql`
    SELECT automation_input_settings(r) AS settings FROM workflow_rules r WHERE r.id = ${ruleId}
  `);
  const currentStored = current.rows[0]?.settings as StoredSettings | undefined;
  const base: EligibilityHistory = {
    status: event ? "missing" : "event_missing", permissions: "unknown",
    ...(event ? { eventAt: event.createdAt.toISOString() } : {}),
    ...(currentStored ? { currentSettings: publicSettings(currentStored) } : {}),
  };
  if (!event) return base;
  const result = await db.execute(sql`
    SELECT v.id::text AS version, to_char(v.effective_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recorded_at, v.settings
    FROM workflow_event_input_versions b JOIN workflow_rule_input_versions v ON v.id = b.version_id
    WHERE b.event_id = ${event.id} AND b.rule_id = ${ruleId}
  `);
  const row = result.rows[0];
  if (!row) return base;
  const stored = row.settings as StoredSettings;
  return { ...base, status: "verified", version: row.version as string, recordedAt: row.recorded_at as string,
    settings: publicSettings(stored), changed: currentStored ? stored.fingerprint !== currentStored.fingerprint : undefined };
}
