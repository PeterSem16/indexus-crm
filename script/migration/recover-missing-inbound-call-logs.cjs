#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const {
  deterministicCallLogId,
  parseArgs,
} = require("./recover-missing-inbound-call-logs-helper.cjs");

const REASONS = [
  "already_linked",
  "missing_answered_at",
  "missing_completed_at",
  "invalid_user",
  "missing_campaign_metadata",
  "invalid_campaign",
  "backlink_repair",
  "sip_channel_duplicate",
  "ambiguous_overlap",
  "missing",
];

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(process.cwd(), ".env");
  let contents;
  try {
    contents = fs.readFileSync(envPath, "utf8");
  } catch {
    throw new Error("DATABASE_URL is not set and .env could not be read");
  }
  const line = contents.split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not set and .env has no DATABASE_URL line");
  let value = line.slice("DATABASE_URL=".length).trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) value = value.slice(1, -1);
  if (!value) throw new Error("DATABASE_URL is empty");
  return value;
}

const CLASSIFY_SQL = `
WITH historical AS (
  SELECT i.*
  FROM inbound_call_logs i
  WHERE i.status = 'completed' AND i.completed_at < $1::timestamptz
),
classified AS (
  SELECT i.id,
    CASE
      WHEN i.call_log_id IS NOT NULL THEN 'already_linked'
      WHEN i.answered_at IS NULL THEN 'missing_answered_at'
      WHEN i.completed_at IS NULL THEN 'missing_completed_at'
      WHEN u.id IS NULL THEN 'invalid_user'
      WHEN NULLIF(i.metadata->>'campaignId', '') IS NULL THEN 'missing_campaign_metadata'
      WHEN campaign.id IS NULL THEN 'invalid_campaign'
      WHEN EXISTS (
        SELECT 1 FROM call_logs c WHERE c.inbound_call_log_id = i.id
      ) THEN 'backlink_repair'
      WHEN NULLIF(i.ari_channel_id, '') IS NOT NULL AND EXISTS (
        SELECT 1 FROM call_logs c WHERE c.sip_call_id = i.ari_channel_id
      ) THEN 'sip_channel_duplicate'
      WHEN EXISTS (
        SELECT 1
        FROM call_logs c
        WHERE c.direction = 'inbound'
          AND c.user_id = i.assigned_agent_id
          AND c.phone_number = i.caller_number
          AND c.inbound_call_log_id IS NULL
          AND c.started_at <= i.completed_at
          AND COALESCE(c.ended_at, c.started_at) >= i.entered_queue_at
      ) THEN 'ambiguous_overlap'
      ELSE 'missing'
    END AS reason
  FROM historical i
  LEFT JOIN users u ON u.id = i.assigned_agent_id
  LEFT JOIN campaigns campaign ON campaign.id = NULLIF(i.metadata->>'campaignId', '')
)
SELECT reason, count(*)::integer AS count
FROM classified
GROUP BY reason
ORDER BY reason`;

const CANDIDATE_IDS_SQL = `
SELECT i.id
FROM inbound_call_logs i
JOIN users u ON u.id = i.assigned_agent_id
JOIN campaigns campaign ON campaign.id = NULLIF(i.metadata->>'campaignId', '')
WHERE i.status = 'completed'
  AND i.completed_at < $1::timestamptz
  AND i.answered_at IS NOT NULL
  AND i.call_log_id IS NULL
ORDER BY i.completed_at, i.id`;

const LOCK_ROW_SQL = `
SELECT i.*, q.name AS queue_name, NULLIF(i.metadata->>'campaignId', '') AS campaign_id
FROM inbound_call_logs i
JOIN users u ON u.id = i.assigned_agent_id
JOIN campaigns campaign ON campaign.id = NULLIF(i.metadata->>'campaignId', '')
LEFT JOIN inbound_queues q ON q.id = i.queue_id
WHERE i.id = $1
  AND i.status = 'completed'
  AND i.completed_at < $2::timestamptz
  AND i.answered_at IS NOT NULL
FOR UPDATE OF i`;

async function applyCandidate(client, inboundId, before) {
  const locked = await client.query(LOCK_ROW_SQL, [inboundId, before]);
  if (!locked.rows[0]) return "became_ineligible";
  const row = locked.rows[0];
  if (row.call_log_id) return "already_linked";

  const byInbound = await client.query(
    "SELECT id FROM call_logs WHERE inbound_call_log_id = $1 ORDER BY id LIMIT 2",
    [row.id],
  );
  if (byInbound.rowCount > 1) return "ambiguous_inbound_links";
  if (byInbound.rowCount) {
    await client.query(
      "UPDATE inbound_call_logs SET call_log_id = $1 WHERE id = $2 AND call_log_id IS NULL",
      [byInbound.rows[0].id, row.id],
    );
    return "backlink_repaired";
  }

  if (row.ari_channel_id) {
    const byChannel = await client.query(
      "SELECT 1 FROM call_logs WHERE sip_call_id = $1 LIMIT 1",
      [row.ari_channel_id],
    );
    if (byChannel.rowCount) return "sip_channel_duplicate";
  }

  const overlap = await client.query(
    `SELECT 1 FROM call_logs
     WHERE direction = 'inbound'
       AND user_id = $1
       AND phone_number = $2
       AND inbound_call_log_id IS NULL
       AND started_at <= $3
       AND COALESCE(ended_at, started_at) >= $4
     LIMIT 1`,
    [row.assigned_agent_id, row.caller_number, row.completed_at, row.entered_queue_at],
  );
  if (overlap.rowCount) return "ambiguous_overlap";

  const canonicalId = deterministicCallLogId(row.id);
  const inserted = await client.query(
    `INSERT INTO call_logs (
       id, user_id, customer_id, campaign_id, phone_number, direction, status,
       started_at, answered_at, ended_at, duration_seconds, sip_call_id,
       inbound_queue_id, inbound_queue_name, inbound_call_log_id, created_at,
       is_forwarded, forwarded_to_number
     ) VALUES (
       $1, $2, $3, $4, $5, 'inbound', 'completed',
       $6, $7, $8, $9, $10,
       $11, $12, $13, $14, false, NULL
     )
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      canonicalId,
      row.assigned_agent_id,
      row.customer_id,
      row.campaign_id,
      row.caller_number,
      row.entered_queue_at,
      row.answered_at,
      row.completed_at,
      row.talk_duration_seconds == null ? 0 : row.talk_duration_seconds,
      row.ari_channel_id,
      row.queue_id,
      row.queue_name,
      row.id,
      row.created_at || row.entered_queue_at,
    ],
  );
  if (!inserted.rowCount) {
    const collision = await client.query(
      "SELECT inbound_call_log_id FROM call_logs WHERE id = $1",
      [canonicalId],
    );
    if (collision.rows[0]?.inbound_call_log_id !== row.id) {
      throw new Error(`Deterministic ID collision for inbound row ${row.id}`);
    }
  }
  await client.query(
    "UPDATE inbound_call_logs SET call_log_id = $1 WHERE id = $2 AND call_log_id IS NULL",
    [canonicalId, row.id],
  );
  return inserted.rowCount ? "inserted" : "backlink_repaired";
}

function emptyCounts() {
  return Object.fromEntries(REASONS.map((reason) => [reason, 0]));
}

function printCounts(mode, before, counts) {
  const output = { mode, before: before.toISOString(), ...emptyCounts(), ...counts };
  output.ineligible =
    output.missing_answered_at +
    output.missing_completed_at +
    output.invalid_user +
    output.missing_campaign_metadata +
    output.invalid_campaign;
  console.log(JSON.stringify(output, null, 2));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node script/migration/recover-missing-inbound-call-logs.cjs [--dry-run] [--before ISO_TIMESTAMP] [--apply]");
    return;
  }

  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();
  try {
    await client.query("BEGIN");
    if (!options.apply) await client.query("SET TRANSACTION READ ONLY");
    const classified = await client.query(CLASSIFY_SQL, [options.before]);
    const counts = emptyCounts();
    for (const row of classified.rows) counts[row.reason] = row.count;

    if (!options.apply) {
      await client.query("ROLLBACK");
      printCounts("dry-run", options.before, counts);
      return;
    }

    const ids = await client.query(CANDIDATE_IDS_SQL, [options.before]);
    const applied = {};
    for (const { id } of ids.rows) {
      const result = await applyCandidate(client, id, options.before);
      applied[result] = (applied[result] || 0) + 1;
    }
    await client.query("COMMIT");
    printCounts("apply", options.before, { ...counts, applied });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Recovery failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

module.exports = { CLASSIFY_SQL, applyCandidate, readDatabaseUrl };