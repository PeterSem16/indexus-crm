#!/usr/bin/env node
// Run locally on CORPCRM01. No SSH, source evaluation, messages or data writes.
const fs = require("node:fs");
const { Pool } = require("pg");

async function main() {
  const missionName = process.argv[2];
  if (!missionName) throw Object.assign(new Error(), { code: "MISSION_NAME_REQUIRED" });
  const line = fs.readFileSync(".env", "utf8").split(/\r?\n/).find(value => value.startsWith("DATABASE_URL="));
  let url = line?.slice(13).trim();
  if (url && ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'")))) url = url.slice(1, -1);
  if (!url) throw Object.assign(new Error(), { code: "DATABASE_CONFIGURATION_MISSING" });
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='15s'");
    const missions = (await client.query("SELECT id,name FROM campaigns WHERE name=$1", [missionName])).rows;
    if (missions.length !== 1) throw Object.assign(new Error(), { code: "MISSION_NAME_NOT_UNIQUE_OR_MISSING" });
    const id = missions[0].id;
    const groups = (await client.query(`SELECT s.group_id,i.label,s.config->>'source' AS source,i.is_hidden,
      (SELECT count(*)::int FROM campaign_contacts cc WHERE cc.campaign_id=s.campaign_id) AS contacts,
      (SELECT count(*)::int FROM mission_status_list_option_source_state x
        JOIN campaign_contacts cc ON cc.id=x.campaign_contact_id
        WHERE x.group_id=s.group_id AND cc.campaign_id=s.campaign_id) AS evaluated,
      (SELECT count(*)::int FROM mission_status_list_option_source_state x
        JOIN campaign_contacts cc ON cc.id=x.campaign_contact_id
        WHERE x.group_id=s.group_id AND cc.campaign_id=s.campaign_id AND x.config_revision=s.revision) AS current_revision,
      (SELECT count(*)::int FROM campaign_status_list_automations a
        JOIN campaign_status_list_items child ON child.id=a.status_list_item_id
        WHERE child.campaign_id=s.campaign_id AND (child.id=s.group_id OR child.parent_id=s.group_id)) AS disconnected_service_actions,
      (SELECT count(*)::int FROM mission_status_list_rules r
        WHERE r.campaign_id=s.campaign_id AND r.definition->>'enabled'='true'
          AND r.definition->>'trigger'='background_transition' AND r.definition->'source'->>'kind'='item'
          AND r.definition->'source'->>'id' IN (SELECT child.id FROM campaign_status_list_items child
            WHERE child.campaign_id=s.campaign_id AND child.parent_id=s.group_id)) AS enabled_background_rules,
      (SELECT count(*)::int FROM mission_status_list_transitions t
        WHERE t.campaign_id=s.campaign_id AND t.question_id=s.group_id AND t.target_kind='item' AND t.baseline) AS baseline_records,
      (SELECT count(*)::int FROM mission_status_list_transitions t
        WHERE t.campaign_id=s.campaign_id AND t.question_id=s.group_id AND t.target_kind='item' AND NOT t.baseline) AS state_changes
      FROM mission_status_list_option_sources s
      JOIN campaign_status_list_items i ON i.id=s.group_id AND i.campaign_id=s.campaign_id
      WHERE s.campaign_id=$1 ORDER BY i.sort_order,i.id`, [id])).rows;
    const triggers = (await client.query(`SELECT c.relname AS table_name,t.tgname AS trigger_name,t.tgenabled AS enabled
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE NOT t.tgisinternal AND t.tgname IN ('mission_status_list_changed','mission_status_list_communication_changed')
      ORDER BY c.relname,t.tgname`)).rows;
    const pending = (await client.query(`SELECT kind,count(*)::int AS count,min(due_at) AS earliest
      FROM mission_status_list_dirty WHERE (kind='mission' AND entity_id=$1)
      OR (kind='contact' AND entity_id IN (SELECT id FROM campaign_contacts WHERE campaign_id=$1))
      GROUP BY kind ORDER BY kind`, [id])).rows;
    await client.query("COMMIT");
    console.log(JSON.stringify({ mission: missionName, readOnly: true, groups, triggers, pending,
      note: "Counts and configuration evidence only; not proof that the worker is running. No contact identities or message contents included." }, null, 2));
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    await pool.end();
  }
}
main().catch(error => {
  // Never expose pg error details, connection strings or configuration values.
  console.error(JSON.stringify({ error: /^[A-Z0-9_]+$/.test(error.code || "") ? error.code : "DIAGNOSTIC_FAILED" }));
  process.exitCode = 1;
});
