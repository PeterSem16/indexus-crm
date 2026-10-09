"use strict";
// Read-only, bounded diagnostic. Never print numbers, names, message bodies, credentials or raw errors.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require(require.resolve("pg", { paths: [process.cwd()] }));

async function main() {
  const [day, callbackSuffix, forwardedSuffix] = process.argv.slice(2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "") ||
      !/^\d{9}$/.test(callbackSuffix || "") || !/^\d{9}$/.test(forwardedSuffix || ""))
    throw Object.assign(new Error(), { code: "EXPECTED_DAY_AND_TWO_NINE_DIGIT_SUFFIXES" });
  let url = process.env.DATABASE_URL;
  if (!url) {
    const line = fs.readFileSync(".env", "utf8").split(/\r?\n/)
      .find(s => /^\s*(?:export\s+)?DATABASE_URL\s*=/.test(s));
    if (!line) throw Object.assign(new Error(), { code: "DATABASE_URL_MISSING" });
    url = line.replace(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*/, "").trim();
    if (url.startsWith('"')) url = JSON.parse(url);
    else if (url.startsWith("'")) url = url.slice(1, url.lastIndexOf("'"));
    else url = url.replace(/\s+#.*$/, "");
  }
  const db = new Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  await db.connect();
  try {
    await db.query("BEGIN READ ONLY");
    await db.query("SET LOCAL statement_timeout='15s'");
    const rows = async (label, sql, values) => {
      await db.query("SAVEPOINT diagnostic");
      try { return (await db.query(sql, values)).rows; }
      catch (e) {
        await db.query("ROLLBACK TO SAVEPOINT diagnostic");
        console.log(label, JSON.stringify({ unavailable: true, code: e.code || e.name }));
        return [];
      } finally { await db.query("RELEASE SAVEPOINT diagnostic"); }
    };
    const print = (label, data) => console.log(label, JSON.stringify(data, null, 2));
    const params = [callbackSuffix, forwardedSuffix, day];
    // Include yesterday's forwarded call shown in the screenshot. Bounds are civil days, not server UTC.
    const window = `started_at >= (($3::date - 1)::timestamp AT TIME ZONE 'Europe/Bratislava')
      AND started_at < (($3::date + 1)::timestamp AT TIME ZONE 'Europe/Bratislava')`;
    const calls = await rows("CALLS", `SELECT id,user_id,campaign_id,campaign_contact_id,
      direction,status,started_at,answered_at,ended_at,duration_seconds,sip_call_id,
      inbound_queue_id,inbound_call_log_id,is_forwarded,metadata,
      CASE WHEN right(regexp_replace(phone_number,'[^0-9]','','g'),9)=$1
        THEN 'callback_target' ELSE 'forwarded_target' END AS target
      FROM call_logs WHERE right(regexp_replace(phone_number,'[^0-9]','','g'),9) IN ($1,$2)
      AND ${window} ORDER BY started_at DESC LIMIT 30`, params);
    const metadataFields = ["sipStatusCode", "sipResponseCode", "failureCode", "hangupCause",
      "dialStatus", "forwardedAnswerVerified", "calleeAnsweredAt", "rootUniqueId",
      "campaignClassificationConflict", "recordingState"];
    print("CALLS", calls.map(row => {
      let metadata = row.metadata;
      try { if (typeof metadata === "string") metadata = JSON.parse(metadata); } catch { metadata = {}; }
      return { ...row, sip_call_id: row.sip_call_id?.split("@")[0] || null,
        metadata: Object.fromEntries(metadataFields.filter(k => metadata?.[k] != null).map(k => [k, metadata[k]])) };
    }));
    const inbound = await rows("INBOUND", `SELECT id,queue_id,call_log_id,assigned_agent_id,
      ari_channel_id,status,entered_queue_at,answered_at,completed_at,wait_duration_seconds,
      talk_duration_seconds,called_back,called_back_at,called_back_by_user_id,
      (transferred_to IS NOT NULL) AS has_forward_target
      FROM inbound_call_logs
      WHERE right(regexp_replace(caller_number,'[^0-9]','','g'),9) IN ($1,$2)
      AND entered_queue_at >= (($3::date - 1)::timestamp AT TIME ZONE 'Europe/Bratislava')
      AND entered_queue_at < (($3::date + 1)::timestamp AT TIME ZONE 'Europe/Bratislava')
      ORDER BY entered_queue_at DESC LIMIT 30`, params);
    print("INBOUND", inbound);
    const callIds = calls.map(r => r.id);
    print("VOICE_INCIDENTS", await rows("VOICE_INCIDENTS",
      `SELECT call_log_id,kind,severity,connection_state,ice_state,created_at
       FROM voice_network_incidents WHERE call_log_id=ANY($1::varchar[]) ORDER BY created_at LIMIT 40`, [callIds]));
    print("FORWARDING", await rows("FORWARDING",
      `SELECT root_unique_id,call_log_id,inbound_call_log_id,status,transferred_at,
        recording_authorized,recording_state,recording_policy_snapshot,
        evidence->>'answeredAt' AS evidence_answered_at,
        evidence->>'endedAt' AS evidence_ended_at,
        evidence->>'dialStatus' AS dial_status,
        (last_error IS NOT NULL) AS has_error,updated_at
       FROM queue_forwarded_calls WHERE call_log_id=ANY($1::varchar[]) LIMIT 30`, [callIds]));
    const queues = [...new Set([...calls.map(r => r.inbound_queue_id), ...inbound.map(r => r.queue_id)].filter(Boolean))];
    print("QUEUE_POLICY", await rows("QUEUE_POLICY",
      `SELECT id,country_code,campaign_id,record_calls,is_active FROM inbound_queues WHERE id=ANY($1::varchar[])`, [queues]));
    const campaigns = [...new Set(calls.map(r => r.campaign_id).filter(Boolean))];
    print("MISSION_POLICY", await rows("MISSION_POLICY",
      `SELECT id,settings::jsonb->'callRecordingPolicy' AS recording_policy
       FROM campaigns WHERE id=ANY($1::varchar[])`, [campaigns]));
    const recordings = await rows("RECORDINGS", `SELECT id,call_log_id,file_path,
      file_size_bytes,duration_seconds,analysis_status FROM call_recordings WHERE call_log_id=ANY($1::varchar[])`, [callIds]);
    print("RECORDINGS", recordings.map(({ file_path, ...row }) => {
      const file = file_path ? path.resolve(file_path) : null;
      const root = process.cwd() + path.sep;
      let exists = false;
      if (file?.startsWith(root)) { try { exists = fs.statSync(file).isFile(); } catch {} }
      return { ...row, local_file_exists: exists, path_in_app_root: Boolean(file?.startsWith(root)) };
    }));
    print("SOURCE", ["server/lib/queue-engine.ts", "server/lib/forwarded-call-reconciliation.ts",
      "client/src/components/sip-phone.tsx"].map(file => ({
      file, sha256: fs.existsSync(file) ? crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") : "missing",
    })));
    await db.query("ROLLBACK");
  } finally { await db.end(); }
}
main().catch(e => { console.error("DIAGNOSTIC_FAILED", e.code || e.name); process.exitCode = 1; });
