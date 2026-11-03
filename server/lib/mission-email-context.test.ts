import { test } from "node:test";
import assert from "node:assert/strict";
import { deliverAttributedEmail, resolveMissionEmailContext } from "./mission-email-context";

function fixture(options: { allowed?: boolean; linked?: boolean; country?: string; countries?: string[]; missing?: boolean; admin?: boolean;
  duplicate?: boolean; template?: Record<string, unknown> | null } = {}) {
  const queries: string[] = [];
  return {
    queries,
    query: async (sql: string, values: unknown[]) => {
      queries.push(sql);
      if (sql.includes("FROM message_templates")) return { rows: options.template === null ? [] : [{
        id: "template", name: "Proposal", type: "email", is_active: true,
        country_codes: ["SK"], email_purpose: "cooperation_proposal", ...options.template,
      }] };
      if (sql.includes("FROM users u CROSS JOIN campaigns")) return { rows: options.allowed === false ? [] : [{
        role: options.admin ? "admin" : "user", assigned: true,
        assigned_countries: options.countries ?? ["SK"], country_codes: ["SK", "CZ"], name: "Mission",
      }] };
      if (sql.includes("FROM users WHERE")) return { rows: [{
        role: options.admin ? "admin" : "user", assigned_countries: options.countries ?? ["SK"],
      }] };
      if (sql.includes("FROM campaign_contacts")) {
        assert.deepEqual(values, ["medical", "entity", "clinic"]);
        return { rows: options.linked === false ? [] : options.duplicate ? [{ id: "contact" }, { id: "twin" }] : [{ id: "contact" }] };
      }
      assert.match(sql, /^SELECT (country|country_code) AS country_code FROM (clinics|customers|hospitals|collaborators) WHERE id=\$1$/);
      return { rows: options.missing ? [] : [{ country_code: options.country ?? "SK" }] };
    },
  } as any;
}
const body = { campaignId: "medical", customerId: "entity", contactType: "clinic" };

test("template purpose is read from the allowed active email template, never from supplied metadata", async () => {
  const resolved = await resolveMissionEmailContext(fixture(), "agent", {
    ...body, emailTemplateId: "template", emailPurpose: "reminder", templateName: "Forged",
  });
  assert.deepEqual(resolved.emailTemplate, { id: "template", name: "Proposal", purpose: "cooperation_proposal" });
  for (const options of [
    { template: null }, { template: { is_active: false } }, { template: { type: "sms" } },
    { template: { country_codes: ["IT"] } }, { template: { email_purpose: "postal_sent" } },
    { duplicate: true },
  ]) await assert.rejects(resolveMissionEmailContext(fixture(options), "agent", {
    ...body, emailTemplateId: "template",
  }), /invalid_mission_email_context/);
  await assert.rejects(resolveMissionEmailContext(fixture(), "agent", { ...body, emailTemplateId: {} }));
});

test("template snapshot and exact enrollment survive edits and provider receipt without forged purpose", async () => {
  const context = await resolveMissionEmailContext(fixture(), "agent", { ...body, emailTemplateId: "template" });
  const rows: any[] = [];
  const store = {
    async createCommunicationMessage(data: any) { rows.push({ ...data, id: "message" }); return { id: "message" }; },
    async updateCommunicationMessage(_id: string, data: any) { Object.assign(rows[0], data); },
  };
  await deliverAttributedEmail(store, context, {
    userId: "agent", subject: "Changed subject", content: "Personalized content",
    recipientEmail: "recipient@example.invalid",
    metadata: JSON.stringify({ missionEmail: { purpose: "reminder", campaignId: "foreign" } }),
  }, async () => {
    const saved = JSON.parse(rows[0].metadata).missionEmail;
    assert.equal(saved.campaignId, "medical");
    assert.equal(saved.campaignContactId, "contact");
    assert.equal(saved.purpose, "cooperation_proposal");
    context.emailTemplate!.purpose = "information_materials";
    return undefined;
  });
  const saved = JSON.parse(rows[0].metadata).missionEmail;
  assert.equal(saved.purpose, "cooperation_proposal");
  assert.equal(saved.templateId, "template");
  assert.equal(saved.templateName, "Proposal");
  assert.equal(rows[0].status, "sent");
});

test("Mission email captures the exact typed entity and actual country without trusting a supplied country", async () => {
  assert.deepEqual(await resolveMissionEmailContext(fixture(), "agent", body), {
    campaignId: "medical", campaignContactId: "contact", entityType: "clinic", entityId: "entity", countryCode: "SK",
  });
  const db = fixture();
  assert.deepEqual(await resolveMissionEmailContext(db, "agent", {}), {
    campaignId: null, campaignContactId: null, entityType: null, entityId: null, countryCode: null,
  });
  assert.equal(db.queries.length, 0, "standalone never searches for a Mission");
  assert.equal((await resolveMissionEmailContext(fixture(), "agent", { ...body, campaignId: null })).campaignId, null);
});

test("reject foreign Mission, non-member entity, actual foreign country and forged country before delivery", async () => {
  for (const options of [
    { allowed: false }, { linked: false }, { missing: true }, { country: "IT" },
    { country: "CZ", countries: ["SK"] }, { countries: [] },
  ]) await assert.rejects(resolveMissionEmailContext(fixture(options), "agent", body), /invalid_mission_email_context/);
  for (const patch of [
    { campaignCountryCode: "IT" }, { entityId: "other" }, { entityType: "hospital" },
    { contactType: "constructor" }, { customerId: null }, { campaignId: [] }, { customerId: 7 },
  ]) await assert.rejects(resolveMissionEmailContext(fixture(), "agent", { ...body, ...patch }));
  await assert.rejects(resolveMissionEmailContext(fixture({ country: "IT", admin: true }), "agent", body));
  await assert.rejects(resolveMissionEmailContext(fixture(), "agent", { useSystemMailbox: true }));
  await assert.rejects(resolveMissionEmailContext(fixture(), "agent", {
    useSystemMailbox: true, campaignCountryCode: "CZ",
  }));
  await assert.rejects(resolveMissionEmailContext(fixture({ country: "CZ" }), "agent", {
    customerId: "entity", contactType: "clinic",
  }));
});

test("all entity types, canonical fields and person alias are supported without address inference", async () => {
  for (const type of ["customer", "hospital", "collaborator", "person"]) {
    const db = fixture();
    // Membership response is independent of email or the user's current roster.
    const query = db.query;
    db.query = (sql: string, values: unknown[]) => sql.includes("FROM campaign_contacts")
      ? Promise.resolve({ rows: [{ id: "contact" }] }) : query(sql, values);
    const context = await resolveMissionEmailContext(db, "agent", {
      campaignId: "medical", entityId: "entity", entityType: type,
    });
    assert.equal(context.entityType, type === "person" ? "collaborator" : type);
  }
});

test("persist envelope before transport, keep sent/failed timestamps and refuse delivery when persistence fails", async () => {
  const context = await resolveMissionEmailContext(fixture(), "agent", body);
  const events: string[] = [];
  const rows: any[] = [];
  const store = {
    async createCommunicationMessage(data: any) { events.push("save"); rows.push(data); return { id: "message" }; },
    async updateCommunicationMessage(id: string, patch: any) { events.push(patch.status); Object.assign(rows[0], patch); },
  };
  const message = { userId: "agent", subject: "Subject", content: "Body", recipientEmail: "recipient@example.invalid" };
  const sent = await deliverAttributedEmail(store, context, message, async () => { events.push("transport"); return "ok"; });
  assert.deepEqual(events, ["save", "transport", "sent"]);
  assert.equal(sent.messageId, "message");
  assert.equal(rows[0].campaignId, "medical");
  assert.equal(rows[0].entityId, "entity");
  assert.equal(rows[0].entityType, "clinic");
  assert.ok(rows[0].sentAt instanceof Date);
  events.length = 0;
  await assert.rejects(deliverAttributedEmail(store, context, message, async () => {
    events.push("transport"); throw new Error("transport failed");
  }));
  assert.deepEqual(events, ["save", "transport", "failed"]);
  let delivered = false;
  await assert.rejects(deliverAttributedEmail({
    ...store, async createCommunicationMessage() { throw new Error("storage unavailable"); },
  }, context, message, async () => { delivered = true; }));
  assert.equal(delivered, false);
});

test("provider time, immutable ID, conversation and original metadata persist together; only DB write is retried", async () => {
  const context = await resolveMissionEmailContext(fixture(), "agent", body);
  let sends = 0, updates = 0;
  const saved: any = {};
  const evidence = {
    externalId: "immutable-message", externalIdType: "immutable",
    conversationId: "conversation", internetMessageId: "<message@example.invalid>",
    sentAt: "2026-01-01T10:01:02.000Z", acceptedAt: new Date().toISOString(),
    sentAtSource: "ms365_sent_datetime", sentItemLocation: "originating_mailbox",
  };
  await deliverAttributedEmail({
    async createCommunicationMessage(row) {
      assert.equal(row.sentAt, null); assert.equal(row.externalId, null);
      Object.assign(saved, row); return { id: "message" };
    },
    async updateCommunicationMessage(_id, patch) {
      if (++updates === 1) throw Error("temporary DB failure");
      Object.assign(saved, patch);
    },
  }, context, { userId: "agent", subject: "Subject", content: "Body",
    recipientEmail: "recipient@example.invalid", metadata: JSON.stringify({ from: "sender@example.invalid", contactType: "clinic" }) },
  async () => { sends++; return evidence; });
  assert.equal(sends, 1); assert.equal(updates, 2);
  assert.equal(saved.sentAt.toISOString(), evidence.sentAt);
  assert.equal(saved.externalId, evidence.externalId);
  assert.equal(saved.campaignId, "medical");
  const metadata = JSON.parse(saved.metadata);
  assert.equal(metadata.from, "sender@example.invalid");
  assert.equal(metadata.contactType, "clinic");
  assert.equal(metadata.conversationId, evidence.conversationId);
  assert.deepEqual(metadata.sendEvidence, evidence);
});

test("uncertain delivery stays pending without a fabricated sending date or automatic resend", async () => {
  const context = await resolveMissionEmailContext(fixture(), "agent", body);
  const patches: any[] = [];
  let sends = 0;
  await assert.rejects(deliverAttributedEmail({
    async createCommunicationMessage() { return { id: "message" }; },
    async updateCommunicationMessage(_id, patch) { patches.push(patch); },
  }, context, { userId: "agent", subject: "Subject", content: "Body", recipientEmail: "recipient@example.invalid" },
  async () => { sends++; throw Object.assign(new Error("ms365_send_outcome_unknown"), {
    deliveryUncertain: true, sendEvidence: { externalId: "immutable-uncertain", conversationId: "conversation" },
  }); }));
  assert.equal(sends, 1);
  assert.equal(patches[0].status, "pending");
  assert.equal(patches[0].sentAt, null);
  assert.equal(patches[0].externalId, "immutable-uncertain");
  assert.equal(JSON.parse(patches[0].metadata).deliveryState, "unknown");
});

test("persistent evidence-save failure never retransmits or marks an accepted message as failed", async () => {
  const context = await resolveMissionEmailContext(fixture(), "agent", body);
  let sends = 0, attempts = 0;
  await assert.rejects(deliverAttributedEmail({
    async createCommunicationMessage() { return { id: "message" }; },
    async updateCommunicationMessage(_id, patch) {
      assert.equal(patch.status, "sent"); attempts++; throw Error("DB unavailable");
    },
  }, context, { userId: "agent", subject: "Subject", content: "Body", recipientEmail: "recipient@example.invalid" },
  async () => { sends++; return "ok"; }), /email_accepted_evidence_save_failed/);
  assert.equal(sends, 1); assert.equal(attempts, 3);
});
