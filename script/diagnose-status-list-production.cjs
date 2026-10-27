"use strict";
// Operator-local, read-only. Never print credentials, IDs, labels, or raw errors.
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const ROOT = "/var/www/indexus-crm";
const ALLOWED = new Set(["sources", "options", "questions", "schema_columns", "source_config", "source_write_plan", "source_counts"]);
function safeError(error) {
  const safe = value => typeof value === "string" && /^[a-zA-Z_][a-zA-Z_0-9]{0,100}$/.test(value) ? value : undefined;
  return { code: /^[0-9A-Z]{5}$/.test(String(error.code)) ? error.code : "OPERATOR_ERROR",
    table: safe(error.table), column: safe(error.column), constraint: safe(error.constraint) };
}
async function probe(client, name, sql) {
  if (!ALLOWED.has(name)) throw Error("UNKNOWN_PROBE");
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout='10s'");
    const result = await client.query(sql);
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ check: name, ok: true,
      ...(["source_counts", "schema_columns"].includes(name) ? { rows: result.rows } : {}) }));
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    console.log(JSON.stringify({ check: name, ok: false, ...safeError(error) }));
  }
}
async function main() {
  if (require("node:os").hostname().split(".")[0].toUpperCase() !== "CORPCRM01") throw Error("WRONG_HOST");
  process.chdir(ROOT);
  console.log("STATUS_LIST_READ_ONLY_DIAGNOSTICS");
  console.log(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
  console.log(execFileSync("df", ["-h", "/", "/tmp", `${ROOT}/data`], { encoding: "utf8" }).trim());
  console.log(execFileSync("df", ["-i", "/", `${ROOT}/data`], { encoding: "utf8" }).trim());
  const names = fs.readdirSync("/tmp").filter(n => /^indexus-(batch-frontend|automation-release)\.[a-zA-Z0-9]+$/.test(n));
  for (const name of names) {
    try {
      console.log(execFileSync("du", ["-sh", "--", `/tmp/${name}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
    } catch { console.log("TEMP_DIRECTORY_NOT_READABLE"); }
  }
  const { parseDatabaseUrl } = require(`${ROOT}/script/automation-production-db-admin.cjs`);
  const connectionString = parseDatabaseUrl(fs.readFileSync(`${ROOT}/.env`, "utf8"));
  const rows = JSON.parse(execFileSync("pm2", ["jlist"], { encoding: "utf8" }));
  const processes = rows.filter(row => row.name === "indexus-crm");
  if (processes.length !== 1) throw Error("PM2_PROCESS_COUNT");
  const managed = processes[0].pm2_env || {};
  if ((managed.DATABASE_URL || managed.env?.DATABASE_URL) &&
    (managed.DATABASE_URL || managed.env?.DATABASE_URL) !== connectionString) throw Error("DATABASE_CONFIG_MISMATCH");
  console.log(JSON.stringify({ backendStatus: managed.status, backendPid: processes[0].pid }));
  const { Client } = require(`${ROOT}/node_modules/pg`);
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000,
    application_name: "status-list-read-only-diagnostics" });
  try {
    await client.connect();
    await probe(client, "schema_columns", `SELECT table_name,column_name,data_type
      FROM information_schema.columns WHERE table_schema='public' AND table_name IN
      ('mission_status_list_option_sources','campaign_status_list_items','campaign_status_list_questions')
      ORDER BY table_name,ordinal_position`);
    await probe(client, "sources", "SELECT group_id,campaign_id,config,revision FROM mission_status_list_option_sources LIMIT 0");
    await probe(client, "options", "SELECT id,parent_id,item_type,confirmation_type,is_hidden,sort_order FROM campaign_status_list_items LIMIT 0");
    await probe(client, "questions", "SELECT item_id FROM campaign_status_list_questions LIMIT 0");
    await probe(client, "source_config", "SELECT config-'hidden',revision FROM mission_status_list_option_sources LIMIT 0");
    // EXPLAIN without ANALYZE checks the exact UPSERT shape, but executes no writes.
    await probe(client, "source_write_plan", `EXPLAIN INSERT INTO mission_status_list_option_sources(campaign_id,group_id,config)
      VALUES(NULL,NULL,'{}'::jsonb) ON CONFLICT(group_id) DO UPDATE SET
      revision=CASE WHEN (mission_status_list_option_sources.config-'hidden')<>(EXCLUDED.config-'hidden')
      THEN gen_random_uuid()::text ELSE mission_status_list_option_sources.revision END,config=EXCLUDED.config`);
    await probe(client, "source_counts", `SELECT CASE WHEN config->>'source' IN
      ('healthcare_reachability','coordinator','reachability') THEN config->>'source' ELSE 'other' END AS kind,
      count(*)::int AS count FROM mission_status_list_option_sources GROUP BY 1 ORDER BY 1`);
  } finally { await client.end().catch(() => {}); }
}
if (require.main === module || process.argv[1] === "-") main().catch(error => {
  console.error(JSON.stringify({ diagnosticFailed: true, ...safeError(error) }));
  process.exitCode = 1;
});
module.exports = { safeError, probe };
