"use strict";
// Operator-local only. Never prints database credentials or message contents.
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawnSync, execFileSync } = require("node:child_process");
const ROOT = "/var/www/indexus-crm";

function parseDatabaseUrl(text) {
  const line = text.split(/\r?\n/).find(value => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_CONFIG_MISSING");
  let value = line.slice(13).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    value = value.slice(1, -1);
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2)
    throw new Error("DATABASE_CONFIG_INVALID");
  return value;
}

function dumpEnvironment(value, inherited) {
  const url = new URL(value);
  // Console PGHOSTADDR/PGSERVICE must never redirect a dump away from the app URL.
  const clean = Object.fromEntries(Object.entries(inherited)
    .filter(([key]) => !key.startsWith("PG") && key !== "DATABASE_URL"));
  const env = { ...clean, PGCONNECT_TIMEOUT: "10",
    PGHOST: url.hostname.replace(/^\[|\]$/g, ""), PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) };
  for (const key of ["PGSERVICE", "PGSERVICEFILE", "PGPASSFILE", "DATABASE_URL"]) delete env[key];
  const parameters = { sslmode: "PGSSLMODE", sslrootcert: "PGSSLROOTCERT", sslcert: "PGSSLCERT",
    sslkey: "PGSSLKEY", options: "PGOPTIONS", application_name: "PGAPPNAME",
    connect_timeout: "PGCONNECT_TIMEOUT" };
  for (const [key, val] of url.searchParams) {
    if (!parameters[key]) throw new Error("DATABASE_QUERY_PARAMETER_UNSUPPORTED");
    env[parameters[key]] = val;
  }
  return env;
}

function pm2Row() {
  const rows = JSON.parse(execFileSync("pm2", ["jlist"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }))
    .filter(row => row.name === "indexus-crm");
  if (rows.length !== 1) throw new Error("PM2_PROCESS_AMBIGUOUS");
  return rows[0];
}

async function guardSnapshot(client, { requireDormant = false } = {}) {
  const ownership = await client.query(`SELECT campaign_id,owner,fingerprint
    FROM mission_callback_ownership ORDER BY campaign_id`);
  const candidates = await client.query(`SELECT campaign_id,automation_id,definition,source_fingerprint
    FROM mission_callback_candidates ORDER BY campaign_id,automation_id`);
  const rules = await client.query("SELECT id,enabled FROM workflow_rules ORDER BY id");
  const configs = await client.query(`SELECT item_id,enabled FROM mission_status_list_automatic_configs ORDER BY item_id`);
  const table = await client.query("SELECT to_regclass('public.mission_callback_groups') AS t");
  const groups = table.rows[0].t ? (await client.query(`SELECT campaign_id,owner,enrolled,generation,fingerprint
    FROM mission_callback_groups ORDER BY campaign_id`)).rows : [];
  if (requireDormant && groups.some(group => group.enrolled))
    throw new Error("ACTIVE_SERVICE_GROUP_REQUIRES_REVIEW");
  const state = { ownership: ownership.rows, candidates: candidates.rows, rules: rules.rows,
    configs: configs.rows, groups };
  return { sha256: crypto.createHash("sha256").update(JSON.stringify(state)).digest("hex"),
    counts: Object.fromEntries(Object.entries(state).map(([key, rows]) => [key, rows.length])) };
}

async function main(mode) {
  if (!["pid", "guard", "schema", "dump"].includes(mode)) throw new Error("INVALID_OPERATION");
  if (require("node:os").hostname().split(".")[0].toUpperCase() !== "CORPCRM01" ||
      require("node:os").userInfo().username !== "seman") throw new Error("WRONG_OPERATOR_HOST");
  const row = pm2Row(), e = row.pm2_env || {};
  if (mode === "pid") {
    if (!row.pid || e.status !== "online" || e.pm_cwd !== ROOT ||
        e.pm_exec_path !== `${ROOT}/dist/index.cjs` ||
        (e.watch && (!Array.isArray(e.watch) || e.watch.length)) ||
        Number(e.PORT || e.env?.PORT || 5000) !== 5000) throw new Error("PM2_CONFIG_MISMATCH");
    console.log(row.pid);
    return;
  }
  const value = parseDatabaseUrl(fs.readFileSync(`${ROOT}/.env`, "utf8"));
  const managed = e.DATABASE_URL || e.env?.DATABASE_URL;
  if (managed && managed !== value) throw new Error("DATABASE_CONFIG_MISMATCH");
  if (mode === "dump") {
    const result = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--no-acl"], {
      env: dumpEnvironment(value, process.env), stdio: ["ignore", "inherit", "pipe"],
    });
    if (result.error || result.status !== 0) throw new Error("DATABASE_DUMP_FAILED");
    return;
  }
  const { Client } = require(`${ROOT}/node_modules/pg`);
  const client = new Client({ connectionString: value, connectionTimeoutMillis: 10000,
    statement_timeout: 15000, application_name: "indexus-automation-operator" });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    if (mode === "schema") {
      const required = ["chat_analysis_outbox", "workflow_rule_input_versions", "workflow_event_input_versions",
        "workflow_analysis_retries", "mission_callback_groups", "mission_phone_issues"];
      for (const name of required) {
        if (!(await client.query("SELECT to_regclass($1) AS t", [`public.${name}`])).rows[0].t)
          throw new Error("DATABASE_SCHEMA_INCOMPLETE");
      }
      for (const [table, column] of [["campaign_status_list_items", "label_translations"],
        ["campaign_status_list_automations", "execution_policy"], ["task_attachment_uploads", "analysis_cache_key"]]) {
        const result = await client.query(`SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [table, column]);
        if (!result.rowCount) throw new Error("DATABASE_COLUMN_MISSING");
      }
      console.log("DATABASE_SCHEMA_OK");
    } else {
      console.log(JSON.stringify(await guardSnapshot(client, { requireDormant: process.argv[3] === "--require-dormant" })));
    }
  } finally {
    try { await client.query("ROLLBACK"); } catch {}
    await client.end();
  }
}

if (require.main === module) main(process.argv[2]).catch(error => {
  const code = /^[A-Z][A-Z_]+$/.test(error.message || "") ? error.message : "DATABASE_OPERATION_FAILED";
  console.error(`OPERATOR_DB_FAILED: ${code}`);
  process.exitCode = 1;
});
module.exports = { parseDatabaseUrl, dumpEnvironment, guardSnapshot };
