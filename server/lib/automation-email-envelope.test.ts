import assert from "node:assert/strict";
import { emailEnvelopeContext, communicationSourceContext } from "./automation-communication-context";
import { safeCommunicationContext } from "../../shared/automation-communication-context";
import { automationDisplayValues, renderAutomationText } from "./automation-display-values";
import { renderEmailValue, renderEmailAddressConfig } from "./automation-email-policy";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { users, communicationMessages } from "../../shared/schema";
import { storage } from "../storage";
import { loadAnalysisSource } from "./automation-analysis-source";

async function main() {
  // Reproduce the legacy production message without recipient, dates, or Mission.
  const legacy = communicationSourceContext("email", { id: "original", direction: "inbound",
    subject: "Invoice", metadata: JSON.stringify({ from: "sender@example.test" }) }, "owner",
    { recipient: { email: "crm-login@example.test" } });
  assert.equal(legacy.recipientEmail, null);
  const envelope = { toRecipients: [{ emailAddress: { address: "Other@example.test" } },
    { emailAddress: { address: "Mailbox@example.test" } }],
    sentDateTime: "2026-10-13T12:22:00Z", receivedDateTime: "2026-10-13T12:23:00Z",
    accessToken: "never-expose", body: { content: "never-copy" } };
  const email = emailEnvelopeContext(legacy, "mailbox@example.test", envelope);
  assert.equal(email.recipientEmail, "Mailbox@example.test");
  assert.equal(email.sentAt, "2026-10-13T12:22:00.000Z");
  assert.equal(email.receivedAt, "2026-10-13T12:23:00.000Z");
  assert.equal(email.campaignId, null);
  assert.ok(!JSON.stringify(email).includes("never-"));
  // A BCC/alias delivery uses the verified owning mailbox, not the first To entry.
  assert.equal(emailEnvelopeContext(legacy, "bcc@example.test", envelope).recipientEmail, "bcc@example.test");
  assert.throws(() => emailEnvelopeContext(legacy, "", envelope), /mailbox_unavailable/);
  const existing = emailEnvelopeContext({ ...email, recipientEmail: "saved@example.test" }, "mailbox@example.test", {});
  assert.equal(existing.recipientEmail, "saved@example.test");
  assert.equal(existing.sentAt, email.sentAt);

  const ctx = { communication: email, event: { module: "communication", countryCode: "SK" } };
  const text = "From {{communication.senderEmail}} To {{communication.recipientEmail}} Sent {{communication.sentAt}} Mission {{communication.campaignId}}";
  const display = await automationDisplayValues(ctx, [text], async () => { throw new Error("Null Mission must not be looked up"); });
  const notification = renderAutomationText(text, ctx, display);
  assert.ok(notification.includes("Mailbox@example.test"));
  assert.ok(notification.endsWith("Mission "));
  assert.ok(!notification.includes("{{"));
  assert.ok(renderEmailValue(`<p>${text}</p>`, ctx, true, display).endsWith("Mission </p>"));
  const noDates = { communication: safeCommunicationContext({ id: "no-dates", type: "email" }) };
  assert.equal(renderEmailValue("Sent {{communication.sentAt}}", noDates), "Sent ");
  assert.equal(renderAutomationText("Mission {{communication.campaignId}}", ctx, new Map()), "Mission ");

  for (const path of ["communication.typo", "communication.unknown", "constructor.name", "newValues.email"]) {
    assert.throws(() => renderEmailValue(`{{${path}}}`, ctx), /unavailable/);
    assert.throws(() => renderAutomationText(`{{${path}}}`, ctx, display), /unavailable/);
  }
  assert.throws(() => renderEmailValue("{{communication.campaignId}}", { communication: { campaignId: null } }), /unavailable/);
  assert.throws(() => renderEmailAddressConfig({ to: "{{communication.recipientEmail}}" }, noDates), /unavailable/);
  assert.throws(() => renderEmailValue('<a href="/missions/{{communication.campaignId}}">Open</a>', ctx, true, display), /unavailable/);
  assert.throws(() => renderAutomationText("/missions/{{communication.campaignId}}", ctx, display), /unavailable/);
  const ids = [randomUUID(), randomUUID()], messageId = randomUUID();
  const originalFetch = globalThis.fetch, originalMailbox = storage.getUserMs365Connection;
  let requests = 0;
  try {
    await db.insert(users).values(ids.map((id, i) => ({ id, username: `envelope-fixture-${id}`,
      email: `crm-${i}@example.test`, passwordHash: "!", fullName: "Envelope fixture",
      role: "manager", assignedCountries: ["SK"], isActive: true })));
    await db.insert(communicationMessages).values({ id: messageId, userId: ids[0],
      type: "email", direction: "inbound", subject: "Invoice fixture", content: "Fixture",
      status: "received", externalId: "fixture-original", metadata: JSON.stringify({ from: "sender@example.test" }) });
    storage.getUserMs365Connection = async (id: string) => {
      assert.equal(id, ids[0]);
      return { email: "mailbox@example.test", isConnected: true, accessToken: "fixture-only",
        tokenExpiresAt: new Date(Date.now() + 3600000) } as any;
    };
    globalThis.fetch = async (url: any, init: any) => {
      requests++;
      assert.equal(String(url), "https://graph.microsoft.com/v1.0/me/messages/fixture-original?$select=toRecipients,ccRecipients,sentDateTime,receivedDateTime");
      assert.ok(!init.method || init.method === "GET");
      return new Response(JSON.stringify(envelope), { status: 200 });
    };
    const rule: any = { id: "fixture-rule", createdByUserId: ids[0], trigger: { analysis: {
      channels: ["email"], mailboxMode: "selected", mailboxUserIds: [ids[0]],
      senderEmails: [], analyzeContent: true, analyzeAttachments: true } } };
    const event: any = { entityId: messageId, module: "communication", eventType: "email.received" };
    const source = await loadAnalysisSource(rule, event);
    assert.equal(source?.communication.recipientEmail, "Mailbox@example.test");
    assert.equal(source?.communication.sentAt, email.sentAt);
    assert.equal(requests, 1);
    assert.equal(await loadAnalysisSource({ ...rule, createdByUserId: ids[1] }, event), null);
    assert.equal(requests, 1, "Unauthorized source must not reach Graph");
    assert.equal(await loadAnalysisSource({ ...rule, trigger: { analysis: {
      ...rule.trigger.analysis, senderEmails: ["excluded@example.test"] } } }, event), null);
    assert.equal(requests, 1, "Excluded sender must not reach Graph");
    globalThis.fetch = async () => {
      requests++;
      return new Response("Not found", { status: 404 });
    };
    await assert.rejects(() => loadAnalysisSource(rule, event), /analysis_mailbox_request_failed/);
  } finally {
    globalThis.fetch = originalFetch;
    storage.getUserMs365Connection = originalMailbox;
    await db.delete(communicationMessages).where(inArray(communicationMessages.id, [messageId]));
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
  console.log("Automation email envelope and nullable prose tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
