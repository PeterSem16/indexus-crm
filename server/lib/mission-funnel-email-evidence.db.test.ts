import { test } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../db";
import { loadFunnelEmailEvidence } from "./mission-funnel-email-evidence";
import { createRequire } from "node:module";
const { attributeProposalEmail } = createRequire(import.meta.url)("../../script/operator/attribute-mission-proposal-email.cjs");
test("real SQL isolates successful configured emails and repairs one reviewed message without rewriting the sending event", async () => {
  const client = await pool.connect();
  const messageId = "11111111-1111-1111-1111-111111111111";
  const missionId = "22222222-2222-2222-2222-222222222222";
  const clinicId = "33333333-3333-3333-3333-333333333333";
  try {
    // Session-local tables shadow public tables; no real application rows change.
    await client.query(`
      CREATE TEMP TABLE campaigns(id text,country_codes text[]);
      CREATE TEMP TABLE clinics(id text,country_code text);
      CREATE TEMP TABLE campaign_contacts(id text,campaign_id text,clinic_id text,contact_type text);
      CREATE TEMP TABLE campaign_status_list_items(id text,campaign_id text,parent_id text);
      CREATE TEMP TABLE campaign_status_list_automations(id text,status_list_item_id text);
      CREATE TEMP TABLE status_list_service_executions(id text,campaign_id text,campaign_contact_id text,
        automation_id text,actor_id text,action_type text,status text,result jsonb,finished_at timestamp);
      CREATE TEMP TABLE communication_messages(id text,customer_id text,campaign_id text,user_id text,
        type text,direction text,status text,subject text,content text,sent_at timestamp,created_at timestamp,
        entity_type text,entity_id text,metadata text);
      CREATE TEMP TABLE campaign_contact_history(id text,campaign_contact_id text,user_id text,action text,
        metadata jsonb,created_at timestamp DEFAULT now());
    `);
    await client.query("INSERT INTO campaigns VALUES($1,ARRAY['SK']),('foreign',ARRAY['SK'])", [missionId]);
    await client.query("INSERT INTO clinics VALUES($1,'SK')", [clinicId]);
    await client.query("INSERT INTO campaign_contacts VALUES('contact',$1,$2,'clinic'),('foreign-contact','foreign',$2,'clinic')", [missionId, clinicId]);
    await client.query("INSERT INTO campaign_status_list_items VALUES('positive',$1,'parent'),('parent',$1,NULL),('other',$1,NULL)", [missionId]);
    await client.query("INSERT INTO campaign_status_list_automations VALUES('proposal','parent'),('unrelated','other')");
    for (const [id, action, status, sent, failed, automation, mission, contact] of [
      ["good", "send_contact_email", "succeeded", 1, 0, "proposal", missionId, "contact"],
      ["zero", "send_contact_email", "succeeded", 0, 0, "proposal", missionId, "contact"],
      ["failed", "send_contact_email", "failed", 0, 1, "proposal", missionId, "contact"],
      ["notify", "notify_email", "succeeded", 1, 0, "proposal", missionId, "contact"],
      ["other", "send_contact_email", "succeeded", 1, 0, "unrelated", missionId, "contact"],
      ["foreign", "send_contact_email", "succeeded", 1, 0, "proposal", "foreign", "foreign-contact"],
    ]) await client.query(`INSERT INTO status_list_service_executions VALUES($1,$2,$3,$4,'agent',$5,$6,$7::jsonb,'2026-10-01 09:30:00')`,
      [id, mission, contact, automation, action, status, JSON.stringify({ ok: status === "succeeded", output: { sentCount: sent, failedCount: failed } })]);
    for (const [id, output] of [["missing-proof", {}], ["skipped", { sentCount: 1, skipped: true }]])
      await client.query(`INSERT INTO status_list_service_executions VALUES($1,$2,'contact','proposal','agent',
        'send_contact_email','succeeded',$3::jsonb,'2026-10-01 09:30:00')`,
      [id, missionId, JSON.stringify({ ok: true, output })]);
    await client.query(`INSERT INTO communication_messages
      (id,customer_id,campaign_id,user_id,type,direction,status,subject,content,sent_at,created_at)
      VALUES($1,$2,NULL,'sender','email','outbound','sent',
      'Reviewed proposal','unchanged body','2026-10-01 09:26:59.018121','2026-10-01 09:26:59.018121')`, [messageId, clinicId]);
    assert.deepEqual((await loadFunnelEmailEvidence(client, missionId, ["contact"], ["positive"])).map(e => e.id), ["service:good"]);
    const input = { messageId, missionId, clinicId, subject: "Reviewed proposal", sentAt: "2026-10-01T09:26:59.018121Z" };
    assert.equal((await attributeProposalEmail(client, input)).status, "ready");
    assert.equal((await attributeProposalEmail(client, { ...input, apply: true })).status, "applied");
    assert.equal((await attributeProposalEmail(client, { ...input, apply: true })).status, "already_applied");
    const evidence = await loadFunnelEmailEvidence(client, missionId, ["contact"], ["positive"]);
    assert.equal(evidence.length, 2);
    const review = evidence.find(e => e.id.startsWith("review:"))!;
    assert.equal(review.actorId, "sender");
    assert.ok(review.at);
    assert.match(review.at, /^2026-10-01T09:26:59\.018Z$/);
    const saved = (await client.query("SELECT campaign_id,content,sent_at::text FROM communication_messages WHERE id=$1", [messageId])).rows[0];
    assert.deepEqual(saved, { campaign_id: missionId, content: "unchanged body", sent_at: "2026-10-01 09:26:59.018121" });
    assert.deepEqual(await loadFunnelEmailEvidence(client, "foreign", ["foreign-contact"], ["positive"]), []);
    const snapshot = {
      version: 1, campaignId: missionId, campaignContactId: "contact",
      entityType: "clinic", entityId: clinicId, purpose: "cooperation_proposal", templateId: "template",
    };
    for (const [id, patch, status, sentAt, campaign] of [
      ["typed-good", {}, "sent", "2026-10-02 08:00:00", missionId],
      ["typed-later", {}, "sent", "2026-10-03 08:00:00", missionId],
      ["typed-info", { purpose: "information_materials" }, "sent", "2026-10-02 08:00:00", missionId],
      ["typed-contract", { purpose: "contract_for_signature" }, "sent", "2026-10-02 08:00:00", missionId],
      ["typed-failed", {}, "failed", "2026-10-02 08:00:00", missionId],
      ["typed-no-time", {}, "sent", null, missionId],
      ["typed-unknown", { purpose: "unspecified" }, "sent", "2026-10-02 08:00:00", missionId],
      ["typed-no-template", { templateId: null }, "sent", "2026-10-02 08:00:00", missionId],
      ["typed-foreign", {}, "sent", "2026-10-02 08:00:00", "foreign"],
      ["typed-forged-entity", { entityId: "other" }, "sent", "2026-10-02 08:00:00", missionId],
      ["typed-forged-contact", { campaignContactId: "foreign-contact" }, "sent", "2026-10-02 08:00:00", missionId],
    ] as const) {
      await client.query(`INSERT INTO communication_messages
        (id,customer_id,campaign_id,user_id,type,direction,status,sent_at,created_at,entity_type,entity_id,metadata)
        VALUES($1,$2,$3,'sender','email','outbound',$4,$5,'2026-10-01','clinic',$2,$6)`,
      [id, clinicId, campaign, status, sentAt, JSON.stringify({ missionEmail: { ...snapshot, ...patch } })]);
    }
    const typed = await loadFunnelEmailEvidence(client, missionId, ["contact"], [], ["cooperation_proposal"]);
    // Reviewed evidence remains independent of the new purpose configuration.
    assert.deepEqual(typed.filter(e => e.id.startsWith("typed:")).map(e => e.id), ["typed:typed-good", "typed:typed-later"]);
    const info = await loadFunnelEmailEvidence(client, missionId, ["contact"], [], ["information_materials"]);
    assert.deepEqual(info.filter(e => e.id.startsWith("typed:")).map(e => e.id), ["typed:typed-info"]);
    assert.deepEqual(await loadFunnelEmailEvidence(client, missionId, ["contact"], [], []), []);
  } finally { client.release(true); await pool.end(); }
});
