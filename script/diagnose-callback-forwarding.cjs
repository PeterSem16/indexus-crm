"use strict";
// Read-only, bounded diagnostic. Never print numbers, names, message bodies, credentials or raw errors.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { Client } = require(require.resolve("pg", { paths: [process.cwd()] }));

function parsedMetadata(value) {
  try {
    const result = typeof value === "string" ? JSON.parse(value) : value;
    return result && typeof result === "object" && !Array.isArray(result) ? result : {};
  } catch { return {}; }
}

function policyMetadata(value) {
  const policy = parsedMetadata(value);
  const fields = ["enabled", "active", "mode", "customerMask", "timezone", "activeFrom", "activeUntil"];
  return Object.fromEntries(fields.filter(k => Object.hasOwn(policy, k)).map(k => [k, policy[k]]));
}

function inboundMetadata(value) {
  const metadata = parsedMetadata(value);
  const recording = parsedMetadata(metadata.standingForwardRecording);
  const fields = ["campaignId", "campaignClassificationConflict", "campaignClassificationUnverified",
    "recordingPolicySnapshot"];
  const recordingFields = ["authorized", "state", "recordingName", "campaignId",
    "callLogId", "inboundCallLogId", "recordingPolicySnapshot", "recoveryAttempts",
    "nextRecoveryAt", "updatedAt", "requestedAt", "startedAt", "stopRequestedAt"];
  return {
    ...Object.fromEntries(fields.filter(k => metadata[k] != null).map(k =>
      [k, k === "recordingPolicySnapshot" ? policyMetadata(metadata[k]) : metadata[k]])),
    ...(metadata.standingForwardRecording ? {
      standingForwardRecording: {
        ...Object.fromEntries(recordingFields.filter(k => recording[k] != null).map(k =>
          [k, k === "recordingPolicySnapshot" ? policyMetadata(recording[k]) : recording[k]])),
        hasPbxIdentity: Boolean(recording.pbxIdentity),
        hasError: Boolean(recording.lastError),
      },
    } : {}),
  };
}

function runtimeSummary() {
  const home = process.env.PM2_HOME || path.join(os.homedir(), ".pm2");
  // Never start a missing PM2 daemon merely to inspect it.
  try {
    const pid = Number(fs.readFileSync(path.join(home, "pm2.pid"), "utf8").trim());
    if (!Number.isInteger(pid) || pid <= 0) throw new Error();
    process.kill(pid, 0);
    if (!fs.existsSync(path.join(home, "rpc.sock"))) throw new Error();
  } catch { return { unavailable: "NO_ACCESSIBLE_RUNNING_PM2_DAEMON" }; }
  const result = spawnSync("pm2", ["jlist"], { encoding: "utf8", timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) return { unavailable: "PM2_READ_FAILED" };
  try {
    return JSON.parse(result.stdout).filter(p =>
      p.pm2_env?.pm_cwd === process.cwd() ||
      String(p.pm2_env?.pm_exec_path || "").startsWith(process.cwd() + path.sep),
    ).map(p => {
      const file = p.pm2_env.pm_exec_path;
      const code = file?.startsWith(process.cwd() + path.sep) && /\.[cm]?js$/.test(file)
        ? fs.readFileSync(file) : null;
      const text = code?.toString("utf8") || "";
      return {
        pid: p.pid, status: p.pm2_env.status, entrypoint: file,
        startedAt: p.pm2_env.pm_uptime ? new Date(p.pm2_env.pm_uptime).toISOString() : null,
        restarts: p.pm2_env.restart_time,
        fileMtime: code ? fs.statSync(file).mtime.toISOString() : null,
        bundleSha256: code ? crypto.createHash("sha256").update(code).digest("hex") : null,
        hasDurableQueueForwarding: code ? text.includes("Cannot forward a call without its inbound log") : null,
        hasStandingRecordingAuthorization: code ? text.includes("standingForwardRecording") : null,
        requiresMissionContact: code ? text.includes("Mission calls require a campaign contact") : null,
      };
    });
  } catch { return { unavailable: "PM2_OUTPUT_OR_ENTRYPOINT_UNREADABLE" }; }
}

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
    await db.query("SET LOCAL TIME ZONE 'UTC'");
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
      "campaignClassificationConflict", "recordingState", "standingForward",
      "queueForwarded", "recordingPolicySnapshot"];
    print("CALLS", calls.map(row => {
      const metadata = parsedMetadata(row.metadata);
      return { ...row, sip_call_id: row.sip_call_id?.split("@")[0] || null,
        metadata: Object.fromEntries(metadataFields.filter(k => metadata?.[k] != null).map(k =>
          [k, k === "recordingPolicySnapshot" ? policyMetadata(metadata[k]) : metadata[k]])) };
    }));
    const inbound = await rows("INBOUND", `SELECT id,queue_id,call_log_id,assigned_agent_id,
      ari_channel_id,status,entered_queue_at,answered_at,completed_at,wait_duration_seconds,
      talk_duration_seconds,called_back,called_back_at,called_back_by_user_id,metadata,
      (transferred_to IS NOT NULL) AS has_forward_target
      FROM inbound_call_logs
      WHERE right(regexp_replace(caller_number,'[^0-9]','','g'),9) IN ($1,$2)
      AND entered_queue_at >= (($3::date - 1)::timestamp AT TIME ZONE 'Europe/Bratislava')
      AND entered_queue_at < (($3::date + 1)::timestamp AT TIME ZONE 'Europe/Bratislava')
      ORDER BY entered_queue_at DESC LIMIT 30`, params);
    print("INBOUND", inbound.map(row => ({ ...row, metadata: inboundMetadata(row.metadata) })));
    const callIds = calls.map(r => r.id);
    const contactIds = [...new Set(calls.map(r => r.campaign_contact_id).filter(Boolean))];
    print("CALL_CONTACTS", await rows("CALL_CONTACTS",
      `SELECT cc.id,cc.campaign_id,cc.contact_type,cc.status,
        CASE WHEN cc.contact_type='clinic' THEN cl.is_active
             WHEN cc.contact_type='hospital' THEN h.is_active
             WHEN cc.contact_type='collaborator' THEN co.is_active
             WHEN cu.id IS NOT NULL THEN cu.status IS DISTINCT FROM 'inactive'
             ELSE NULL END AS entity_active
       FROM campaign_contacts cc
       LEFT JOIN clinics cl ON cl.id=cc.clinic_id
       LEFT JOIN hospitals h ON h.id=cc.hospital_id
       LEFT JOIN collaborators co ON co.id=cc.collaborator_id
       LEFT JOIN customers cu ON cu.id=cc.customer_id
       WHERE cc.id=ANY($1::varchar[]) LIMIT 30`, [contactIds]));
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
    print("RUNTIME", runtimeSummary());
    await db.query("ROLLBACK");
  } finally { await db.end(); }
}
module.exports = { parsedMetadata, inboundMetadata };
if (require.main === module) {
  main().catch(e => { console.error("DIAGNOSTIC_FAILED", e.code || e.name); process.exitCode = 1; });
}
