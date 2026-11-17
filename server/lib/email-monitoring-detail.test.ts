import test from "node:test";
import assert from "node:assert/strict";
import { resolveEmailMonitoringDetail } from "./email-monitoring-detail";
import { emailMonitoringFields } from "./ai/email-monitoring-contract";

export const acceptedNote = "Zákazník odmieta novú ponuku, existujúcu službu ponecháva.";
export const analysis = { sentiment: "neutral" as const, hasInappropriateContent: false,
  hasAngryTone: false, hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false,
  doesNotAcceptContract: true, alertLevel: "none" as const, note: acceptedNote };
export const scope = { userId: "agent-a", externalId: "message-a",
  mailbox: "agent@example.test", personalMailbox: "agent@example.test" };
export function saved(source: unknown = { kind: "personal", ownerUserId: scope.userId }) {
  return { externalId: scope.externalId, type: "email", direction: "inbound",
    ...emailMonitoringFields(analysis), metadata: JSON.stringify({
      contactType: "customer", mailboxSource: source, emailMonitoringAnalysis: analysis }),
  };
}
test("saved nine-field result and exact Slovak note are projected without rewriting", () => {
  const row = saved(), before = JSON.stringify(row);
  const result = resolveEmailMonitoringDetail([row], scope)!;
  assert.equal(result.source, "email.monitoring");
  assert.deepEqual(result.analysis, analysis);
  assert.equal(result.analysis.note, acceptedNote);
  assert.equal(JSON.stringify(row), before);
});
test("personal results cannot cross users or mailbox identities", () => {
  assert.equal(resolveEmailMonitoringDetail([saved()], { ...scope, userId: "agent-b" }), null);
  assert.equal(resolveEmailMonitoringDetail([saved()], { ...scope, mailbox: "shared@example.test" }), null);
  assert.equal(resolveEmailMonitoringDetail([saved({})], scope), null);
});
test("system results require exact mailbox attribution, including when it is the personal address", () => {
  const row = saved({ kind: "system", mailboxEmail: "SHARED@example.test", countryCode: "SK" });
  assert.deepEqual(resolveEmailMonitoringDetail([row], { ...scope, mailbox: "shared@example.test" })?.analysis, analysis);
  assert.equal(resolveEmailMonitoringDetail([row], scope), null);
  assert.deepEqual(resolveEmailMonitoringDetail([saved({ kind: "system", mailboxEmail: scope.mailbox })], scope)?.analysis, analysis);
});
test("same IDs in other mailboxes, outbound messages, SMS and legacy analyses never substitute for monitoring", () => {
  for (const row of [
    { ...saved(), externalId: "different-id" }, { ...saved(), type: "sms" },
    { ...saved(), direction: "outbound" }, { ...saved(), aiAnalyzed: false },
    { ...saved(), metadata: JSON.stringify({ mailboxSource: { kind: "personal", ownerUserId: "other" } }) },
    { ...saved(), metadata: "invalid-json" }, { ...saved(), metadata: "{}" },
  ]) assert.equal(resolveEmailMonitoringDetail([row], scope), null);
});
test("ambiguous, malformed and inconsistent saved outputs fail explicitly instead of guessing", () => {
  assert.throws(() => resolveEmailMonitoringDetail([saved(), saved()], scope), /identity_ambiguous/);
  assert.throws(() => resolveEmailMonitoringDetail(Array(101).fill(saved()), scope), /identity_ambiguous/);
  assert.throws(() => resolveEmailMonitoringDetail([{ ...saved(), aiWantsToCancel: true }], scope), /inconsistent/);
  const row = saved(), metadata = JSON.parse(row.metadata);
  delete metadata.emailMonitoringAnalysis.wantsToCancel;
  assert.throws(() => resolveEmailMonitoringDetail([{ ...row, metadata: JSON.stringify(metadata) }], scope), /invalid/);
});
