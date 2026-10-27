import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import type { PoolClient } from "pg";
import { readTransitionExport } from "./status-list-transition-export";
import { verifyTransitionExport } from "../../shared/status-list-transition-export";

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });
const mission = "a65e7775-885c-4413-b2be-e63c92decd3d";
const item = "7a72d71b-33b3-4d08-a394-602e9f71dc0d";
const action = "2d2cdb47-78e2-4110-bb7f-2004ef0dacfc";
const template = "00cadb72-b7e1-4184-980b-269abce940cd";
const disposition = "bdf39464-05f3-4d4c-aaf0-1490f38d4dba";
const rule = "7656cd19-4747-4cfd-a2ec-e26543a6a8a4";
async function snapshot(options: { fail?: boolean; missingSchema?: boolean; templateChanged?: boolean; dispositionChanged?: boolean; sourceChanged?: boolean } = {}) {
  const statements: string[] = [];
  const client = {
    async query(sql: string, params?: any[]) {
      statements.push(sql);
      if (sql.includes("transaction_timestamp()")) return { rows: [{
        captured_at: "2026-10-20T12:00:00.000Z", database_identity: "private_database",
        server_identity: "private_host", server_port: 5432,
      }] };
      if (sql.includes("information_schema.columns")) return { rows: [{ table_name: "campaigns", column_name: "id" }] };
      if (sql.includes("to_regclass")) return { rows: [{ relation: options.missingSchema && params?.[0] === "public.mission_status_list_rules" ? null : params?.[0] }] };
      if (sql.includes("FROM public.campaigns ")) return { rows: [{ config: { id: mission, settings: { value: "private settings" } } }] };
      if (sql.includes("FROM public.campaign_status_list_items t")) return { rows: [{ config: {
        id: item, label: "Private label", campaign_id: mission, next_step_id: "private navigation reference",
      } }] };
      if (sql.includes("FROM public.campaign_status_list_automations t")) {
        if (options.fail) throw new Error("simulated read failure");
        return { rows: [{ config: { id: action, status_list_item_id: item, disposition_id: disposition,
          action_type: "send_email_group", email_template_id: template, email_recipients: ["private@example.test"],
          target_role: "role:private-role" } }] };
      }
      if (sql.includes("FROM public.campaign_dispositions t")) return { rows: [{ config: { id: disposition,
        action_type: options.dispositionChanged ? "none" : "callback", campaign_id: mission } }] };
      if (sql.includes("FROM public.message_templates t")) return { rows: [{ config: { id: template,
        content: options.templateChanged ? "new private body" : "private body" } }] };
      if (sql.includes("FROM public.mission_status_list_sources t")) return { rows: [{ config: {
        question_id: item, campaign_id: mission, source: options.sourceChanged ? "changed" : "coordinator",
      } }] };
      if (sql.includes("FROM public.mission_status_list_rules t")) return { rows: [{ config: {
        id: rule, campaign_id: mission, definition: {
          name: "private rule", enabled: true, source: { kind: "item", id: item }, trigger: "agent_confirmation",
          logic: "and", conditions: [], thenActions: [{ type: "clear_answer", target: { kind: "question", id: template } }], elseActions: [],
        },
      } }] };
      return { rows: [] };
    },
  } as unknown as Pick<PoolClient, "query">;
  try {
    const value = await readTransitionExport(client, mission);
    await verifyTransitionExport(value);
    const text = JSON.stringify(value);
    for (const forbidden of ["private@", "private body", "Private label", "private settings", "private_host", "private_database", "private-role", "private navigation reference", "private rule"])
      assert.ok(!text.includes(forbidden));
    assert.equal(value.activationAllowed, false);
    assert.equal(value.source.productionIdentityVerified, false);
    assert.ok(value.dependencies.some(row => row.kind === "mailbox" && row.state === "unknown"));
    assert.ok(value.dependencies.some(row => row.kind === "role_membership" && row.state === "unknown"));
    assert.ok(value.dependencies.some(row => row.kind === "question" && row.state === "missing"));
    assert.ok(value.records.some(row => row.kind === "email_template"));
    if (!options.missingSchema) {
      assert.ok(value.dependencies.some(row => row.owner === rule && row.kind === "question" && row.target === template && row.state === "missing"));
      assert.ok(value.dependencies.some(row => row.owner === rule && row.kind === "item" && row.target === item && row.state === "present"));
    }
    assert.ok(value.dependencies.some(row => row.owner === item && row.kind === "item" && row.target?.length === 64 && row.state === "missing"));
    if (options.missingSchema) assert.ok(value.unknowns.includes("schema"));
    return value;
  } finally {
    assert.match(statements[0], /REPEATABLE READ READ ONLY/);
    assert.equal(statements.at(-1), "ROLLBACK");
    assert.ok(statements.every(sql => !/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|COMMIT)\b/i.test(sql)));
    assert.ok(statements.every(sql => !/\b(campaign_contacts|call_logs|users|tasks|messages|ms365_tokens|task_group_members)\b/.test(sql)));
  }
}
const original = await snapshot();
assert.equal((await snapshot()).fingerprint, original.fingerprint);
for (const option of ["templateChanged", "dispositionChanged", "sourceChanged", "missingSchema"]) {
  assert.notEqual((await snapshot({ [option]: true })).fingerprint, original.fingerprint);
}
await assert.rejects(() => snapshot({ fail: true }), /simulated read failure/);
console.log("Read-only export checks passed: redaction, dependencies, referenced configuration drift, missing schema and rollback on failure.");
