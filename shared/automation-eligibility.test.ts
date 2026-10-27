import assert from "node:assert/strict";
import { test } from "node:test";
import { analysisSourceExclusion, analysisSourceMatches, type CommunicationAnalysisConfig } from "./automation-analysis";
import { eligibilityInput, eligibilitySourceListInput, ELIGIBILITY_SOURCE_EVENTS } from "./automation-eligibility";
import { automationEligibilityTranslations } from "../client/src/i18n/automation-eligibility-translations";

test("source exclusions retain exact execution filter semantics", () => {
  const config: CommunicationAnalysisConfig = { channels: ["email", "chat"], analyzeContent: true,
    analyzeAttachments: false, mailboxMode: "selected", mailboxUserIds: ["owner"], senderEmails: [" Billing@example.test "] };
  const cases = [
    [{ channel: "sms" }, "channel_unselected"],
    [{ channel: "email", ownerUserId: "other", senderEmail: "billing@example.test" }, "mailbox_filtered"],
    [{ channel: "email", ownerUserId: "owner", senderEmail: "billing@example.test.attacker.test" }, "sender_filtered"],
    [{ channel: "email", ownerUserId: "owner", senderEmail: null }, "sender_filtered"],
    [{ channel: "email", ownerUserId: "owner", senderEmail: "BILLING@example.test" }, null],
    [{ channel: "chat", ownerUserId: "other" }, null],
  ] as const;
  for (const [source, reason] of cases) {
    assert.equal(analysisSourceExclusion(config, source), reason);
    assert.equal(analysisSourceMatches(config, source), reason === null);
  }
  assert.equal(analysisSourceExclusion({ ...config, mailboxUserIds: [] }, { channel: "email" }), "mailbox_filtered");
});

test("input validation accepts supported identities only", () => {
  for (const sourceEvent of ELIGIBILITY_SOURCE_EVENTS)
    assert.deepEqual(eligibilityInput({ sourceId: " source ", sourceEvent }), { sourceId: "source", sourceEvent });
  for (const input of [null, {}, { sourceId: ["source"], sourceEvent: "chat.received" },
    { sourceId: " ", sourceEvent: "chat.received" }, { sourceId: "a".repeat(129), sourceEvent: "chat.received" },
    { sourceId: "source", sourceEvent: "communication.analyzed" }])
    assert.equal(eligibilityInput(input), null);
});

test("all seven languages provide every reason, source and explanatory label", () => {
  assert.equal(Object.keys(automationEligibilityTranslations).length, 7);
  const en = automationEligibilityTranslations.en;
  for (const copy of Object.values(automationEligibilityTranslations)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(en).sort());
    assert.deepEqual(Object.keys(copy.reasons).sort(), Object.keys(en.reasons).sort());
    assert.deepEqual(Object.keys(copy.sources).sort(), [...ELIGIBILITY_SOURCE_EVENTS].sort());
    for (const value of [...Object.values(copy).filter(v => typeof v === "string"),
      ...Object.values(copy.reasons), ...Object.values(copy.sources)]) assert.ok(value.trim().length);
  }
});

test("picker periods accept all source types and reject unbounded or malformed requests", () => {
  const from = "2026-10-01T00:00:00.000Z", to = "2026-10-08T00:00:00.000Z";
  for (const sourceEvent of ELIGIBILITY_SOURCE_EVENTS)
    assert.deepEqual(eligibilitySourceListInput({ sourceEvent, from, to }), {
      sourceEvent, from: new Date(from), to: new Date(to),
    });
  for (const input of [null, {}, { sourceEvent: "wrong", from, to },
    { sourceEvent: "chat.received", from: [from], to },
    { sourceEvent: "chat.received", from: "invalid", to },
    { sourceEvent: "chat.received", from: to, to: from },
    { sourceEvent: "chat.received", from, to: from },
    { sourceEvent: "chat.received", from, to: "2026-12-01T00:00:00.000Z" }])
    assert.equal(eligibilitySourceListInput(input), null);
});
