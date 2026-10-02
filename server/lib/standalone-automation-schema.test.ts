import assert from "node:assert/strict";
import test from "node:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { workflowRules, workflowEvents, workflowRuns, workflowActionLog, taskAssignmentAccess } from "../../shared/schema";
import { STANDALONE_AUTOMATION_SCHEMA as ddl, ensureStandaloneAutomationSchema } from "./standalone-automation-schema";

test("bootstrap covers every runtime column of all required tables", () => {
  for (const table of [workflowRules, workflowEvents, workflowRuns, workflowActionLog, taskAssignmentAccess]) {
    const name = getTableName(table);
    assert.match(ddl, new RegExp(`CREATE TABLE IF NOT EXISTS ${name}\\s*\\(`));
    const select = ddl.match(new RegExp(`SELECT ([^;]+) FROM ${name} LIMIT 0;`))![1];
    for (const column of Object.values(getTableColumns(table))) {
      assert.match(select, new RegExp(`\\b${column.name}\\b`), `${name}.${column.name}`);
      assert.match(ddl, new RegExp(`\\b${column.name}\\s+(?:varchar|text|jsonb|integer|boolean|timestamp|timestamptz)\\b`));
    }
  }
});
test("bootstrap cannot destroy data or enable the Status List cutover", () => {
  assert.doesNotMatch(ddl, /\b(?:DROP|DELETE|TRUNCATE|UPDATE)\b/i);
  assert.doesNotMatch(ddl, /campaign_status_list|campaign_contact|engine.owner/i);
  assert.match(ddl, /ON CONFLICT \(id\) DO NOTHING/);
});
test("SQL errors propagate before route initialization", async () => {
  const failure = new Error("schema unavailable");
  await assert.rejects(ensureStandaloneAutomationSchema({ query: async () => { throw failure; } }), failure);
  let count = 0;
  await ensureStandaloneAutomationSchema({ query: async sql => { assert.equal(sql, ddl); count++; } });
  assert.equal(count, 1);
});