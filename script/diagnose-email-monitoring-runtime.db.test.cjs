"use strict";
const assert = require("node:assert/strict"), os = require("node:os");
const { Client } = require("pg");
const { persistenceReport } = require("./diagnose-email-monitoring-runtime.cjs");
if (process.env.NODE_ENV !== "test" || process.env.EMAIL_MONITOR_DIAGNOSTIC_DEV_TEST !== "1" ||
    os.hostname().split(".")[0].toUpperCase() === "CORPCRM01")
  throw Error("EXPLICIT_DEVELOPMENT_DATABASE_TEST_REQUIRED");
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
  try {
    await client.connect(); await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='8000'");
    await client.query("CREATE TEMP TABLE email_metadata (LIKE public.email_metadata INCLUDING DEFAULTS) ON COMMIT DROP");
    await client.query("ALTER TABLE pg_temp.email_metadata ADD COLUMN IF NOT EXISTS email_monitoring_result jsonb");
    await client.query("CREATE TEMP TABLE user_ms365_connections (LIKE public.user_ms365_connections INCLUDING DEFAULTS) ON COMMIT DROP");
    await client.query(`INSERT INTO pg_temp.email_metadata(message_id,mailbox_email,email_monitoring_result)
      VALUES('SYNTHETIC-ID','fixture@example.test',$1::jsonb),('SYNTHETIC-ID','FIXTURE@example.test',NULL)`,
    [JSON.stringify({ kind: "personal", ownerUserId: "SYNTHETIC-A", analyzedAt: "2026-11-17T12:00:00.000Z" })]);
    await client.query(`INSERT INTO pg_temp.user_ms365_connections(user_id,email,access_token)
      VALUES('SYNTHETIC-A','fixture@example.test','SYNTHETIC'),('SYNTHETIC-B','fixture@example.test','SYNTHETIC')`);
    const out = await persistenceReport(client, "fixture@example.test");
    assert.equal(out.metadata.mailbox_rows, 2);
    assert.equal(out.metadata.saved_results, 1);
    assert.equal(out.duplicates.ambiguous_message_groups, 1);
    assert.equal(out.duplicates.rows_in_ambiguous_groups, 2);
    assert.equal(out.personalOwners.connected_users, 2);
    assert.equal(out.ownerConflicts.saved_result_owner_conflicts, 1);
    assert.doesNotMatch(JSON.stringify(out), /SYNTHETIC|fixture|@/);
    assert.equal((await persistenceReport(client, "absent@example.test")).metadata.mailbox_rows, 0);
    console.log("PASS: real PostgreSQL identifies duplicate identities and owner conflicts using only synthetic temporary rows; public data unchanged.");
  } finally { await client.query("ROLLBACK").catch(() => {}); await client.end(); }
})().catch(error => { console.error("DEVELOPMENT_DATABASE_DIAGNOSTIC_TEST_FAILED"); process.exitCode = 1; });
