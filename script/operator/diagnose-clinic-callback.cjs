"use strict";
// Operator-local read-only capture. No app imports, replay, approval changes or startup.
const fs = require("node:fs"), cp = require("node:child_process");
const pattern = value => "%" + value.toLocaleLowerCase("sk").replace(/[\\%_]/g, "\\$&") + "%";
async function capture(client, search, emit = console.log) {
  if (!Array.isArray(search) || search.length !== 3 ||
      search.some(s => typeof s !== "string" || s.trim().length < 3 || s.length > 100))
    throw Error("SEARCH_ARGUMENTS_INVALID");
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout='10s'");
  await client.query("SET LOCAL lock_timeout='2s'");
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  async function q(check, sql, params = []) {
    await client.query("SAVEPOINT probe");
    try {
      const { rows } = await client.query(sql, params);
      emit(JSON.stringify({ check, rows, possiblyLimited: rows.length >= 100 }));
      return rows;
    } catch (e) {
      await client.query("ROLLBACK TO SAVEPOINT probe");
      emit(JSON.stringify({ check, sqlstate: /^[0-9A-Z]{5}$/.test(e.code || "") ? e.code : "probe_failed",
        typeHint: e.code === "42883" ? e.message?.match(/operator does not exist: [a-z ]+ [=<>]+ [a-z ]+/i)?.[0] : undefined }));
      return [];
    } finally { await client.query("RELEASE SAVEPOINT probe"); }
  }
  try {
    await q("database", "SELECT current_database() AS database,current_schema() AS schema,current_setting('transaction_read_only') AS read_only,now() AS captured_at");
    const clinics = await q("clinics", `SELECT id,name,representative_id FROM clinics
      WHERE country_code='SK' AND (lower(name) LIKE $1 OR
      (lower(doctor_name) LIKE $2 AND lower(doctor_name) LIKE $3)) ORDER BY id LIMIT 100`, search.map(pattern));
    const ids = clinics.map(r => String(r.id));
    const contacts = await q("enrollments", `SELECT id,campaign_id,clinic_id,contact_type,status,assigned_to,
      disposition_code,callback_date::text AS callback_utc,
      to_char(callback_date AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Bratislava','YYYY-MM-DD HH24:MI:SS') AS callback_bratislava,
      to_jsonb(c)->>'callback_status_list_item_id' AS callback_item,current_script_step_id,created_at,updated_at
      FROM campaign_contacts c WHERE clinic_id::text=ANY($1::text[])
      OR (contact_type='clinic' AND customer_id::text=ANY($1::text[])) ORDER BY id LIMIT 100`, [ids]);
    const cc = contacts.map(r => String(r.id)), missions = [...new Set(contacts.map(r => String(r.campaign_id)))];
    await q("missions", "SELECT id,name,country_codes FROM campaigns WHERE id::text=ANY($1::text[]) LIMIT 100", [missions]);
    await q("states", `SELECT s.id,s.campaign_contact_id,s.status_list_item_id,s.confirmed_at,
      s.confirmed_by_user_id,to_jsonb(s)->>'execution_request_id' AS request_id,i.label,i.parent_id
      FROM campaign_contact_status_list_state s LEFT JOIN campaign_status_list_items i
      ON i.id::text=s.status_list_item_id::text WHERE s.campaign_contact_id::text=ANY($1::text[])
      ORDER BY s.confirmed_at DESC LIMIT 100`, [cc]);
    await q("history", `SELECT h.id,h.campaign_contact_id,h.created_at,h.action,h.user_id,
      h.previous_status,h.new_status,h.metadata->>'statusListItemId' AS item_id,
      h.metadata->'confirmed' AS confirmed,h.metadata->>'callbackDate' AS callback_date,
      h.metadata->>'automationId' AS automation_id,
      (SELECT jsonb_agg(jsonb_build_object('actionType',r->>'actionType','type',r->>'type',
        'ok',r->'ok','success',r->'success','status',r->>'status',
        'callbackDate',r->>'callbackDate','keptExisting',r->'keptExisting'))
       FROM jsonb_array_elements(CASE WHEN jsonb_typeof(h.metadata->'results')='array'
         THEN h.metadata->'results' ELSE '[]'::jsonb END) r) AS results
      FROM campaign_contact_history h WHERE h.campaign_contact_id::text=ANY($1::text[])
      ORDER BY h.created_at DESC,h.id DESC LIMIT 100`, [cc]);
    await q("callback_definitions", `SELECT a.id,i.campaign_id,i.id AS item_id,i.label,i.parent_id,a.action_type,
      a.callback_offset_days,a.callback_time,a.condition_field,a.condition_operator,
      CASE WHEN a.condition_value ~ '^[0-9]{1,6}$' THEN a.condition_value END AS numeric_condition_value,
      md5(coalesce(a.condition_json,'')) AS condition_hash,
      to_jsonb(a)->>'callback_existing_policy' AS existing_policy,
      to_jsonb(a)->>'callback_offset_unit' AS offset_unit,
      to_jsonb(a)->>'callback_business_days_only' AS weekdays_only
      FROM campaign_status_list_automations a JOIN campaign_status_list_items i
      ON i.id::text=a.status_list_item_id::text WHERE i.campaign_id::text=ANY($1::text[])
      AND a.action_type IN ('set_callback','set_contact_status','service_action','schedule_callback')
      ORDER BY i.id,a.sort_order LIMIT 100`, [missions]);
    for (const table of ["mission_callback_ownership", "mission_callback_candidates",
      "mission_callback_groups", "mission_callback_events", "mission_callback_service_events"]) {
      const exists = (await client.query("SELECT to_regclass($1) IS NOT NULL AS exists", ["public." + table])).rows[0].exists;
      if (!exists) { emit(JSON.stringify({ check: table, missing: true })); continue; }
      if (table.endsWith("_events")) {
        const stateColumn = table === "mission_callback_service_events" ? "state" : "status";
        await q(table + "_counts", `SELECT campaign_id,${stateColumn} AS status,count(*)::int FROM ${table}
          WHERE campaign_id::text=ANY($1::text[]) GROUP BY campaign_id,${stateColumn}`, [missions]);
        await q(table, `SELECT id,campaign_id,campaign_contact_id,
          to_jsonb(e)->>'confirmation_id' AS confirmation_id,to_jsonb(e)->>'automation_id' AS automation_id,
          to_jsonb(e)->>'item_id' AS item_id,to_jsonb(e)->>'actor_id' AS actor_id,
          ${stateColumn} AS status,coalesce(to_jsonb(e)->>'created_at',to_jsonb(e)->>'occurred_at') AS created_at,
          to_jsonb(e)->>'completed_at' AS completed_at,
          jsonb_build_object('manualDate',payload->>'manualDate','now',payload->>'now',
            'callback',payload->'action'->'callback','condition',payload->'action'->'condition') AS input,
          jsonb_build_object('status',result->>'status','callbackDate',result->>'callbackDate') AS result
          FROM ${table} e WHERE campaign_contact_id::text=ANY($1::text[]) ORDER BY id DESC LIMIT 100`, [cc]);
      } else {
        await q(table, `SELECT campaign_id,jsonb_build_object('owner',to_jsonb(e)->>'owner',
          'fingerprint',to_jsonb(e)->>'fingerprint','automationId',to_jsonb(e)->>'automation_id',
          'sourceFingerprint',to_jsonb(e)->>'source_fingerprint','enrolled',to_jsonb(e)->'enrolled',
          'groupId',to_jsonb(e)->>'group_id','itemId',to_jsonb(e)->'definition'->'action'->>'itemId',
          'callback',to_jsonb(e)->'definition'->'action'->'callback',
          'condition',to_jsonb(e)->'definition'->'action'->'condition') AS info
          FROM ${table} e WHERE campaign_id::text=ANY($1::text[]) LIMIT 100`, [missions]);
      }
    }
    const columns = await q("call_log_identity_columns", `SELECT column_name,data_type
      FROM information_schema.columns WHERE table_schema='public' AND table_name='call_logs'
      AND column_name IN ('contact_id','customer_id','campaign_contact_id') ORDER BY column_name`);
    const fields = ["contact_id", "customer_id", "campaign_contact_id"]
      .filter(field => columns.some(c => c.column_name === field));
    if (fields.length) await q("call_counts", `SELECT ${fields.join(",")},count(*)::int FROM call_logs
      WHERE ${fields.map((field, i) => `${field}::text=ANY($${i + 1}::text[])`).join(" OR ")}
      GROUP BY ${fields.join(",")} LIMIT 100`, fields.map(field => field === "campaign_contact_id" ? cc : ids));
  } finally { await client.query("ROLLBACK"); }
}
async function main() {
  if (require("node:os").hostname().split(".")[0].toUpperCase() !== "CORPCRM01") throw Error("WRONG_HOST");
  process.chdir("/var/www/indexus-crm");
  const processes = JSON.parse(cp.execFileSync("pm2", ["jlist"], { encoding: "utf8", timeout: 10000 }));
  const apps = processes.filter(p => p.name === "indexus-crm");
  if (apps.length !== 1) throw Error("PM2_PROCESS_COUNT");
  const app = apps[0].pm2_env;
  const line = fs.readFileSync(".env", "utf8").split(/\r?\n/).find(l => l.startsWith("DATABASE_URL="));
  if (!line) throw Error("DATABASE_CONFIG_MISSING");
  let url = line.slice(13).trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) url = url.slice(1, -1);
  const managed = app.DATABASE_URL || app.env?.DATABASE_URL;
  if (managed && managed !== url) throw Error("DATABASE_CONFIG_MISMATCH");
  const backend = fs.readFileSync("dist/index.cjs");
  console.log(JSON.stringify({ check: "server", host: "CORPCRM01", status: app.status,
    databaseConfigSource: managed ? "application_env_matches_PM2" : "application_env_PM2_not_recorded",
    head: cp.execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    backendSha256: require("node:crypto").createHash("sha256").update(backend).digest("hex"),
    legacyCallCountQueryInBackend: /FROM\s+call_logs\s+WHERE\s+contact_id\s*=/i.test(backend.toString()) }));
  const { Client } = require(process.cwd() + "/node_modules/pg");
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10000, application_name: "callback-incident-read-only" });
  try { await client.connect(); await capture(client, process.argv.slice(2)); } finally { await client.end(); }
  for (const file of [app.pm_err_log_path, app.pm_out_log_path].filter(Boolean)) {
    let fd;
    try {
      fd = fs.openSync(file, "r");
      const size = fs.fstatSync(fd).size, buf = Buffer.alloc(Math.min(size, 262144));
      fs.readSync(fd, buf, 0, buf.length, size - buf.length);
      const counts = {};
      for (const match of buf.toString().matchAll(/\b(legacy_config_changed|callback_pending|callback_config_unsupported|confirmation_already_exists|invalid_callback_date|callback_contact_missing|unsupported_contact_type)\b/g))
        counts[match[1]] = (counts[match[1]] || 0) + 1;
      counts.call_log_contact_id_missing = [...buf.toString().matchAll(/column ["']?contact_id["']? does not exist/gi)].length;
      console.log(JSON.stringify({ check: "recent_log_code_counts_not_contact_attributed", counts }));
    } catch { console.log(JSON.stringify({ check: "recent_log_code_counts_not_contact_attributed", unavailable: true })); }
    finally { if (fd !== undefined) fs.closeSync(fd); }
  }
}
if (!module.parent) main().catch(e => {
  console.error(JSON.stringify({ stopped: true, code: /^[A-Z][A-Z0-9_]{3,60}$/.test(e.message || "") ? e.message : /^[0-9A-Z]{5}$/.test(e.code || "") ? e.code : "OPERATOR_DIAGNOSTIC_FAILED" }));
  process.exitCode = 1;
});
module.exports = { capture };
