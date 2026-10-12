#!/usr/bin/env node
"use strict";
// Operator-only, read-only production diagnosis. Never print secrets or SMS contents.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { Pool } = require("pg");

async function main() {
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" ||
      os.userInfo().username !== "seman" || process.cwd() !== "/var/www/indexus-crm") {
    throw Object.assign(new Error(), { code: "RUN_AS_SEMAN_ON_CORPCRM01_IN_APP_DIRECTORY" });
  }
  const env = {};
  if (fs.existsSync(".env")) {
    for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(DATABASE_URL|BULKGATE_[A-Z_]+|NODE_ENV)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      env[match[1]] = value;
    }
  }
  const processes = JSON.parse(execFileSync("pm2", ["jlist"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }));
  const app = processes.find(p => p.name === "indexus-crm");
  if (!app) throw Object.assign(new Error(), { code: "PM2_APPLICATION_NOT_FOUND" });
  const runtime = { ...env, ...app.pm2_env };
  console.log("READ-ONLY: no deployment, no message send, no DB writes.");
  console.log("Git HEAD:", execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
  console.log("PM2:", { status: app.pm2_env.status, started: new Date(app.pm2_env.pm_uptime).toISOString(), mode: runtime.NODE_ENV || "unset" });
  console.log("Configuration presence only:", {
    application_id: Boolean(runtime.BULKGATE_APPLICATION_ID),
    application_token: Boolean(runtime.BULKGATE_APPLICATION_TOKEN),
    webhook_token: Boolean(runtime.BULKGATE_WEBHOOK_TOKEN),
    webhook_url: Boolean(runtime.BULKGATE_WEBHOOK_URL),
  });
  const bundle = path.resolve("dist/index.cjs");
  console.log("Compiled callback batch fix:", fs.existsSync(bundle) &&
    fs.readFileSync(bundle, "utf8").includes("bulkgate_callback_processing_failed"));
  for (const file of [app.pm2_env.pm_out_log_path, app.pm2_env.pm_err_log_path].filter(Boolean)) {
    try {
      const fd = fs.openSync(file, "r");
      const size = fs.fstatSync(fd).size;
      const buffer = Buffer.alloc(Math.min(size, 512 * 1024));
      fs.readSync(fd, buffer, 0, buffer.length, Math.max(0, size - buffer.length));
      fs.closeSync(fd);
      const text = buffer.toString("utf8");
      const hits = re => (text.match(re) || []).length;
      console.log("Recent log tail aggregate:", {
        stream: file === app.pm2_env.pm_out_log_path ? "stdout" : "stderr",
        callback_200: hits(/\/api\/auth\/bulkgate\/callback 200\b/g),
        callback_403: hits(/\/api\/auth\/bulkgate\/callback 403\b/g),
        callback_503: hits(/\/api\/auth\/bulkgate\/callback 503\b/g),
        invalid_token: hits(/\[BulkGate DLR\] Invalid or missing token/g),
        callback_arrivals: hits(/\[BulkGate DLR\].*(?:received:|Accepted records=)/g),
        stored_incoming: hits(/\[BulkGate DLR\] Stored incoming SMS/g),
        processing_failures: hits(/\[BulkGate DLR\] (?:Error processing callback|Callback processing failed)/g),
      });
    } catch { console.log("Log tail unavailable:", path.basename(file)); }
  }
  if (!runtime.DATABASE_URL) throw Object.assign(new Error(), { code: "DATABASE_CONFIGURATION_MISSING" });
  const pool = new Pool({ connectionString: runtime.DATABASE_URL, connectionTimeoutMillis: 5000 });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout='10s'");
    const rows = await client.query(`SELECT COALESCE(provider,'unknown') AS provider,
      direction, count(*)::int AS messages_48h, max(created_at) AS last_message,
      count(*) FILTER (WHERE direction='inbound' AND COALESCE(content,'')='')::int AS empty_incoming,
      count(*) FILTER (WHERE direction='inbound' AND NULLIF(sender_phone,'') IS NULL)::int AS missing_sender
      FROM communication_messages WHERE type='sms' AND created_at > now()-interval '48 hours'
      GROUP BY provider,direction ORDER BY provider,direction`);
    console.table(rows.rows);
    const notices = await client.query(`SELECT m.provider,count(*)::int AS notices_48h
      FROM notifications n JOIN communication_messages m ON m.id=n.entity_id
      WHERE n.type='new_sms' AND n.created_at>now()-interval '48 hours'
      GROUP BY m.provider ORDER BY m.provider`);
    console.table(notices.rows);
    await client.query("ROLLBACK");
  } finally {
    if (client) client.release();
    await pool.end();
  }
}
main().catch(error => {
  console.error("Read-only diagnosis stopped:", error.code || error.name);
  process.exitCode = 1;
});
