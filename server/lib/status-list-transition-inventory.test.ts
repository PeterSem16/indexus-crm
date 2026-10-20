import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import {
  normalizeTransitionAction, readTransitionInventory, type TransitionInventoryRow,
} from "./status-list-transition-inventory";
import {
  MEDICAL_PARTNER_AUDIT_CAMPAIGN as campaignId, EXCLUDED_MEDICAL_PARTNER_EMAIL as email,
} from "../../shared/status-list-transition-audit";

const row: TransitionInventoryRow = {
  config: { id: "callback", action_type: "set_callback", callback_offset_days: 3,
    email_recipients: ["private@example.test"], task_description: "PRIVATE CONTENT" },
  item_id: "item", step_code: "MPN-05b", fingerprint: "fingerprint",
  disposition_type: null, disposition_campaign_id: null, question_valid: true,
};
const normalized = normalizeTransitionAction(campaignId, row);
assert.deepEqual(normalized.callback, { days: 3, time: null, weekdaysOnly: true, existing: "replace" });
assert.ok(!JSON.stringify(normalized).includes("private"));
assert.ok(!JSON.stringify(normalized).includes("PRIVATE"));
for (const config of [
  { callback_offset_days: -1 }, { callback_offset_days: 1.5 }, { callback_offset_days: 9999999 },
  { callback_existing_policy: "unknown" }, { callback_business_days_only: "false" },
]) assert.ok(normalizeTransitionAction(campaignId, { ...row, config: { ...row.config, ...config } }).issues.includes("calendar_unsupported"));
assert.ok(normalizeTransitionAction(campaignId, { ...row, question_valid: false }).issues.includes("reference_missing"));
assert.ok(normalizeTransitionAction(campaignId, { ...row, config: { ...row.config, action_type: "unknown" } }).issues.includes("action_unsupported"));
const privateCondition = normalizeTransitionAction(campaignId, { ...row,
  config: { ...row.config, condition_json: '{"logic":"AND","rules":[{"field":"email","op":"eq","value":"private@example.test"}]}' },
});
assert.equal(privateCondition.condition.kind, "unsupported");
assert.ok(!JSON.stringify(privateCondition).includes("private@example"));
const excludedRow = { ...row, config: { id: email.id, action_type: "send_email_group" }, fingerprint: email.fingerprint };
assert.equal(normalizeTransitionAction(campaignId, excludedRow).excluded, true);
assert.equal(normalizeTransitionAction("other", excludedRow).excluded, false);
assert.equal(normalizeTransitionAction(campaignId, { ...excludedRow, fingerprint: "changed" }).excluded, false);
assert.ok(normalizeTransitionAction(campaignId, { ...excludedRow, fingerprint: "changed" }).issues.includes("exclusion_changed"));
assert.ok(normalizeTransitionAction(campaignId, { ...row, config: {
  ...row.config, action_type: "set_contact_status", disposition_id: "missing",
} }).issues.includes("reference_missing"));

async function testReadOnly(fail = false) {
  const statements: string[] = [];
  const client = {
    async query(sql: string, params?: unknown[]) {
      statements.push(sql);
      if (sql.includes("SELECT to_jsonb(a)")) {
        assert.deepEqual(params, [campaignId]);
        if (fail) throw new Error("simulated read failure");
        return { rows: [row] };
      }
      if (sql.includes("SELECT transaction_timestamp()")) return { rows: [{
        captured_at: "2026-10-20T10:10:28Z", item_count: 70, question_count: 0,
        schema_available: false, item_config: [], question_config: [],
      }] };
      return { rows: [] };
    },
  } as unknown as Pick<PoolClient, "query">;
  if (fail) await assert.rejects(() => readTransitionInventory(client, campaignId), /simulated read failure/);
  else {
    const result = await readTransitionInventory(client, campaignId);
    assert.equal(result.activationAllowed, false);
    assert.equal(result.evidence.productionLiveVerified, false);
    assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(result).includes("PRIVATE CONTENT"));
    assert.ok(!JSON.stringify(result).includes("private@example.test"));
    const again = await readTransitionInventory(client, campaignId);
    assert.equal(again.fingerprint, result.fingerprint);
  }
  assert.match(statements[0], /REPEATABLE READ READ ONLY/);
  assert.equal(statements.at(-1), "ROLLBACK");
  assert.ok(statements.every(sql => !/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|COMMIT)\b/i.test(sql)));
  assert.ok(statements.every(sql => !/\b(campaign_contacts|call_logs|users|tasks|messages)\b/.test(sql)));
}
await testReadOnly();
await testReadOnly(true);
console.log("Transition inventory checks passed: redaction, exact exclusions, fail-closed mapping and read-only transaction.");
