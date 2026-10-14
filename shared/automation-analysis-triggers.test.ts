import assert from "node:assert/strict";
import test from "node:test";
import { ANALYSIS_RESULT_TRIGGERS, ANALYSIS_SOURCE_EVENTS, analysisResultMatches, analysisResultLabel, analysisResultDescription, communicationEventTrigger } from "./automation-analysis-triggers";
import { validateRuleCapabilities, fieldsForEvent, MODULE_EVENTS } from "../server/lib/automation-capabilities";
import { eventMatchesRule } from "../server/lib/automation-engine";
import { pool } from "../server/db";

test("every specific result is an authorized communication WHEN with analysis fields and no IF", () => {
  for (const item of ANALYSIS_RESULT_TRIGGERS) {
    const trigger = communicationEventTrigger(item.eventType, { channels: ["voice"], analyzeContent: true, analyzeAttachments: false });
    const rule: any = { enabled: true, module: "communication", countryCodes: ["SK"], trigger, conditions: null,
      actions: [{ type: "notify_user", config: { userId: "test-agent", title: "Notice" } }] };
    assert.ok(MODULE_EVENTS.communication.includes(item.eventType));
    assert.deepEqual(validateRuleCapabilities(rule), []);
    assert.ok(fieldsForEvent("communication", item.eventType).some(field => field.value === "analysis.tone"));
    for (const eventType of ANALYSIS_SOURCE_EVENTS) {
      const event: any = { module: "communication", entityType: "communication", eventType, countryCode: "SK", createdAt: new Date(), newValues: {} };
      assert.equal(eventMatchesRule(rule, event), true);
      assert.equal(eventMatchesRule(rule, { ...event, countryCode: "DE" }), false);
    }
    assert.equal(eventMatchesRule(rule, { module: "communication", entityType: "communication", eventType: "communication.analyzed", countryCode: "SK", createdAt: new Date() } as any), false, "do not dispatch again from generic analysis completion");
    assert.equal(analysisResultMatches(item.eventType, { [item.field]: item.value }), true);
    for (const value of item.field === "sentiment" ? ["positive", "neutral", "negative", "angry"] : ["calm", "concerned", "angry", "rude"])
      assert.equal(analysisResultMatches(item.eventType, { [item.field]: value }), value === item.value);
    for (const value of [null, undefined, "", "invented", true]) assert.equal(analysisResultMatches(item.eventType, { [item.field]: value }), null);
    assert.ok(validateRuleCapabilities({ ...rule, trigger: { ...trigger, analysis: { ...trigger.analysis, analyzeContent: false } } }).length);
    assert.ok(validateRuleCapabilities({ ...rule, trigger: { ...trigger, analysis: undefined } }).length);
  }
});
test("changing a result keeps selected channels, mailbox scope and sender filters while enabling required content analysis", () => {
  const config: any = { channels: ["email", "voice"], analyzeContent: false, analyzeAttachments: true,
    mailboxMode: "selected", mailboxUserIds: ["authorized-owner"], senderEmails: ["sender@example.test"] };
  const result = communicationEventTrigger("communication.tone.calm", config).analysis!;
  assert.deepEqual(result.channels, config.channels);
  assert.deepEqual(result.mailboxUserIds, config.mailboxUserIds);
  assert.deepEqual(result.senderEmails, config.senderEmails);
  assert.equal(result.analyzeAttachments, true);
  assert.equal(result.analyzeContent, true);
  assert.equal(config.analyzeContent, false);
  assert.equal(communicationEventTrigger("email.received", config).analysis, undefined);
});
test("result WHEN labels and explicit no-IF guidance exist in all seven languages", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"])
    for (const item of ANALYSIS_RESULT_TRIGGERS) {
      assert.ok(analysisResultLabel(locale, item.eventType));
      assert.ok(analysisResultDescription(locale, item.eventType).includes("IF"));
    }
});
test.after(async () => { await pool.end(); });
