#!/usr/bin/env node
// Reviewed, bounded historical attribution. Never sends or rewrites event dates.
const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const MISSION = "a65e7775-885c-4413-b2be-e63c92decd3d";
const SUBJECT = "Objednávanie vyšetrení pre klientky Cord Blood center, návrh spolupráce";
const SOURCE = "explicit_operator_proposal_batch_v2";
const SQL = `
 SELECT m.id,m.customer_id AS clinic_id,m.user_id,m.subject,m.status,m.campaign_id,
   m.provider,m.external_id,m.metadata,c.country_code,
   c.country_code=ANY(mission.country_codes) AS country_allowed,
   to_char(m.sent_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS sent_at,
   to_char(m.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recorded_at,
   ARRAY(SELECT cc.id FROM campaign_contacts cc WHERE cc.clinic_id=c.id
     AND cc.contact_type='clinic' AND cc.campaign_id=$1 ORDER BY cc.id) AS contact_ids,
   ARRAY(SELECT DISTINCT cc.campaign_id FROM campaign_contacts cc WHERE cc.clinic_id=c.id
     AND cc.contact_type='clinic' ORDER BY cc.campaign_id) AS mission_ids,
   reviewed.id AS review_id,
   EXISTS(SELECT 1 FROM campaign_contact_history h
     WHERE h.action='mission_email_attribution' AND h.metadata->>'messageId'=m.id
       AND h.metadata->>'purpose'='contract_proposal'
       AND h.id IS DISTINCT FROM reviewed.id) AS conflicting_review
 FROM communication_messages m
 JOIN clinics c ON c.id=m.customer_id
 JOIN campaigns mission ON mission.id=$1 AND mission.name='Medical Partner Cooperation'
 LEFT JOIN LATERAL (
   SELECT h.id FROM campaign_contact_history h
   JOIN campaign_contacts cc ON cc.id=h.campaign_contact_id
   WHERE cc.campaign_id=$1 AND cc.clinic_id=c.id AND cc.contact_type='clinic'
     AND h.action='mission_email_attribution' AND h.metadata->>'messageId'=m.id
     AND h.metadata->>'purpose'='contract_proposal'
     AND h.metadata->>'reviewSource'=$4 AND h.metadata->>'batchFingerprint'=$2
     AND h.metadata->>'previousCampaignId' IS NULL
   ORDER BY h.id LIMIT 1
 ) reviewed ON true
 WHERE m.type='email' AND m.direction='outbound' AND m.status IN ('sent','delivered','read')
   AND m.subject=$3 AND EXISTS(SELECT 1 FROM campaign_contacts cc
     WHERE cc.clinic_id=c.id AND cc.campaign_id=$1 AND cc.contact_type='clinic')
   AND (m.campaign_id IS NULL OR m.campaign_id=$1 AND reviewed.id IS NOT NULL)
 ORDER BY m.id`;
function validate(rows) {
  if (rows.length !== 38 || new Set(rows.map(row => row.clinic_id)).size !== 34)
    throw Error("Approved scope changed: expected 38 records and 34 clinics; stop");
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw Error("Duplicate message identities; stop");
  for (const row of rows) {
    let metadata;
    try { metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata; }
    catch { throw Error("Invalid source metadata; stop"); }
    if (!row.country_allowed || row.contact_ids?.length !== 1 ||
        row.mission_ids?.length !== 1 || row.mission_ids[0] !== MISSION ||
        metadata?.contactType !== "clinic" || metadata?.sentVia !== "ms365" ||
        row.subject !== SUBJECT || !["sent","delivered","read"].includes(row.status) ||
        !row.recorded_at || row.sent_at !== null || row.provider || row.external_id ||
        row.conflicting_review || Boolean(row.review_id) !== (row.campaign_id === MISSION) ||
        row.campaign_id && row.campaign_id !== MISSION)
      throw Error("Reviewed identity, provenance, dates or Mission scope changed; stop");
  }
}
function fingerprint(rows) {
  // Persisted source values only; normalize solely the change made by this batch.
  return createHash("sha256").update(JSON.stringify(rows.map(row => [
    row.id,row.clinic_id,row.contact_ids,row.mission_ids,row.country_code,
    row.user_id,row.subject,row.status,row.provider,row.external_id,row.metadata,
    row.sent_at,row.recorded_at,null,
  ]))).digest("hex");
}
async function reviewProposalBatch(client, { apply = false, expectedFingerprint } = {}) {
  if (apply && !/^[a-f0-9]{64}$/.test(expectedFingerprint || "")) throw Error("A check fingerprint is required");
  await client.query(apply ? "BEGIN ISOLATION LEVEL REPEATABLE READ" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='20s'");
    await client.query("SET LOCAL lock_timeout='3s'");
    const { rows } = await client.query(SQL + (apply ? " FOR UPDATE OF m" : ""),
      [MISSION, expectedFingerprint || null, SUBJECT, SOURCE]);
    validate(rows);
    const hash = fingerprint(rows);
    if (apply && hash !== expectedFingerprint) throw Error("Source fingerprint changed; stop");
    const pending = rows.filter(row => !row.review_id);
    if (!apply || pending.length === 0) {
      await client.query("ROLLBACK");
      return { status: !apply ? "ready" : "already_applied", fingerprint: hash, records: rows.length,
        clinics: 34, sendingTimeUnknown: rows.length, updates: 0 };
    }
    for (const row of pending) {
      const changed = await client.query(`UPDATE communication_messages SET campaign_id=$2
        WHERE id=$1 AND campaign_id IS NULL RETURNING id`, [row.id, MISSION]);
      if (changed.rows.length !== 1) throw Error("Message changed during review; stop");
      await client.query(`INSERT INTO campaign_contact_history
        (id,campaign_contact_id,user_id,action,metadata)
        VALUES($1,$2,$3,'mission_email_attribution',$4::jsonb)`,
      [randomUUID(), row.contact_ids[0], `operator:${os.userInfo().username}`, JSON.stringify({
        messageId: row.id, purpose: "contract_proposal", campaignId: MISSION, previousCampaignId: null,
        originalSentAt: null, originalRecordedAt: row.recorded_at, timestampKind: "recorded",
        sendingTimeKnown: false, reviewSource: SOURCE, evidenceVersion: 2, batchFingerprint: hash,
      })]);
    }
    await client.query("COMMIT");
    return { status: "applied", records: rows.length, clinics: 34, updates: pending.length,
      sendingTimeUnknown: rows.length, fingerprint: hash };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
function assertTimePolicy() {
  const source = fs.readFileSync("server/lib/mission-funnel-email-evidence.ts", "utf8");
  const engine = fs.readFileSync("server/lib/mission-funnel.ts", "utf8");
  if (source.includes("COALESCE(m.sent_at,m.created_at)") ||
      !source.includes("m.user_id,m.sent_at,m.created_at") || !engine.includes('timestampKind: "recorded"'))
    throw Error("Deploy and restart the reviewed-email time-policy release before applying attribution");
}
async function main(args) {
  if (!(args.length === 1 && args[0] === "--check") &&
      !(args.length === 2 && args[0] === "--apply")) throw Error("Use --check, or --apply CHECK_FINGERPRINT");
  if (args[0] === "--apply") assertTimePolicy();
  const line = fs.readFileSync(".env", "utf8").split(/\r?\n/).find(row => row.startsWith("DATABASE_URL="));
  if (!line) throw Error("Application database is not configured");
  let url = line.slice(13).trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) url = url.slice(1,-1);
  const { Pool } = require(require.resolve("pg", { paths: [process.cwd()] }));
  const pool = new Pool({ connectionString: url });
  let client;
  try {
    client = await pool.connect();
    console.log(JSON.stringify(await reviewProposalBatch(client, {
      apply: args[0] === "--apply", expectedFingerprint: args[1],
    })));
  } finally { client?.release(); await pool.end(); }
}
if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error("STOP:", error.code || error.message); process.exitCode = 1;
});
module.exports = { reviewProposalBatch, fingerprint, validate, SQL, MISSION, SUBJECT, SOURCE, assertTimePolicy };
