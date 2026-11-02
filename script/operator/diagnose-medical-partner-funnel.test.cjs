const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const sql = fs.readFileSync("script/operator/diagnose-medical-partner-funnel.sql", "utf8");

test("production funnel audit is pinned to the named Mission and read-only", () => {
  assert.match(sql, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;/);
  assert.match(sql, /SET LOCAL statement_timeout/);
  assert.match(sql, /a65e7775-885c-4413-b2be-e63c92decd3d/);
  assert.match(sql, /Medical Partner Cooperation/);

  const statements = sql
    .replace(/^\\.*$/gm, "")
    .replace(/^--.*$/gm, "")
    .split(";")
    .map(part => part.trim())
    .filter(Boolean);
  assert.ok(statements.at(-1).startsWith("COMMIT"));
  assert.equal(statements.filter(part => /^(?:WITH|SELECT)\b/i.test(part)).length, 3);
  assert.doesNotMatch(
    statements.join("\n"),
    /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE)\b/i,
  );
});

test("audit distinguishes stored mappings, state, history and the requested funnel gaps", () => {
  for (const table of [
    "campaign_status_list_items",
    "campaign_contact_status_list_state",
    "campaign_contact_history",
  ]) assert.ok(sql.includes(table), table);
  for (const source of [
    "email", "sent", "activeWith", "activeWithout", "materials17", "materials18", "materials19",
  ]) assert.ok(sql.includes(`'${source}'`), source);
  for (const check of [
    "sentWithoutAnyEmailConfirmation",
    "emailConfirmedAfterContractSent",
    "currentCooperationRuleMatchesSameContact",
    "allThreeMaterialItemsEverConfirmedSameContact",
  ]) assert.ok(sql.includes(check), check);
  assert.match(sql, /md5|clinic_id/);
  assert.doesNotMatch(sql, /\b(?:phone|email_address|mobile|clinic_name)\b/i);
});
