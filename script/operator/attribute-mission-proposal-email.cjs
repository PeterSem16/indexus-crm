#!/usr/bin/env node
// Explicit, bounded repair of one reviewed historical email. No sending.
const fs = require("node:fs");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
async function attributeProposalEmail(client, input) {
  const { messageId, missionId, clinicId, subject, sentAt, apply = false } = input;
  if (![messageId, missionId, clinicId].every(value => /^[a-f0-9-]{36}$/i.test(value || "")) ||
      !subject || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z?$/.test(sentAt || ""))
    throw Error("Invalid explicit repair identity");
  await client.query("BEGIN");
  try {
    const result = await client.query(`SELECT m.id,cc.id AS contact_id,m.campaign_id,
      to_char(COALESCE(m.sent_at,m.created_at),'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS sent_at
      FROM communication_messages m
      JOIN campaign_contacts cc ON cc.clinic_id=m.customer_id AND cc.contact_type='clinic'
      JOIN campaigns mission ON mission.id=cc.campaign_id
      JOIN clinics clinic ON clinic.id=cc.clinic_id
      WHERE m.id=$1 AND cc.campaign_id=$2 AND cc.clinic_id=$3
        AND m.subject=$4 AND COALESCE(m.sent_at,m.created_at)=$5::timestamp
        AND m.type='email' AND m.direction='outbound' AND m.status IN ('sent','delivered','read')
        AND (m.campaign_id IS NULL OR m.campaign_id=$2)
        AND clinic.country_code=ANY(mission.country_codes)
      FOR UPDATE OF m,cc`, [messageId, missionId, clinicId, subject, sentAt]);
    if (result.rows.length !== 1) throw Error("Email identity, sending evidence or Mission membership differs; stop");
    const row = result.rows[0];
    const prior = await client.query(`SELECT id FROM campaign_contact_history
      WHERE campaign_contact_id=$1 AND action='mission_email_attribution'
        AND metadata->>'messageId'=$2 AND metadata->>'purpose'='contract_proposal'`,
    [row.contact_id, messageId]);
    if (prior.rows.length) {
      if (row.campaign_id !== missionId) throw Error("Existing attribution conflicts with message Mission; stop");
      await client.query("ROLLBACK");
      return { status: "already_applied", messageId };
    }
    if (!apply) { await client.query("ROLLBACK"); return { status: "ready", messageId, missionId }; }
    await client.query("UPDATE communication_messages SET campaign_id=$2 WHERE id=$1", [messageId, missionId]);
    await client.query(`INSERT INTO campaign_contact_history
      (id,campaign_contact_id,user_id,action,metadata)
      VALUES($1,$2,$3,'mission_email_attribution',$4::jsonb)`,
    [randomUUID(), row.contact_id, `operator:${os.userInfo().username}`, JSON.stringify({
      messageId, purpose: "contract_proposal", originalSentAt: row.sent_at,
      previousCampaignId: row.campaign_id || null, campaignId: missionId,
      reviewSource: "explicit_operator_review", evidenceVersion: 1,
    })]);
    await client.query("COMMIT");
    return { status: "applied", messageId, missionId };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve primary error */ }
    throw error;
  }
}
async function main(args) {
  if (args.length !== 6 || !["--check", "--apply"].includes(args[0]))
    throw Error("Use --check or --apply followed by messageId missionId clinicId exactSubject exactUtcSentAt");
  const line = fs.readFileSync(".env", "utf8").split(/\r?\n/).find(value => value.startsWith("DATABASE_URL="));
  if (!line) throw Error("Application database is not configured");
  let url = line.slice(13).trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) url = url.slice(1, -1);
  const { Pool } = require("pg"), pool = new Pool({ connectionString: url }), client = await pool.connect();
  try {
    console.log(JSON.stringify(await attributeProposalEmail(client, {
      apply: args[0] === "--apply", messageId: args[1], missionId: args[2], clinicId: args[3],
      subject: args[4], sentAt: args[5],
    })));
  } finally { client.release(); await pool.end(); }
}
if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error("STOP:", error.code || error.message); process.exitCode = 1;
});
module.exports = { attributeProposalEmail, main };
