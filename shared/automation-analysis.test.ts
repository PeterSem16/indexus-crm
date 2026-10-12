import assert from "node:assert/strict";
import { analysisConfigIssues, analysisSourceMatches } from "./automation-analysis";
import { validateRuleCapabilities } from "../server/lib/automation-capabilities";
import { sourceFingerprint } from "../server/lib/automation-reviewed-transition";
import { selectedAnalysisAttachments, type ServiceAnalysis } from "../server/lib/automation-analysis";
import { evalCondition } from "../server/lib/automation-engine";

const config = { channels: ["email", "sms", "voice", "task", "chat"] as any,
  analyzeContent: true, analyzeAttachments: true,
  mailboxUserIds: ["authorized-owner"], senderEmails: ["billing@example.test"] };
assert.deepEqual(analysisConfigIssues(config), []);
assert.equal(analysisSourceMatches(config, { channel: "email", ownerUserId: "authorized-owner", senderEmail: "BILLING@example.test" }), true);
for (const source of [
  { channel: "email" as const, ownerUserId: "different-owner", senderEmail: "billing@example.test" },
  { channel: "email" as const, ownerUserId: "authorized-owner", senderEmail: "billing@example.test.attacker.test" },
  { channel: "email" as const, ownerUserId: "authorized-owner", senderEmail: null },
]) assert.equal(analysisSourceMatches(config, source), false);
for (const channel of ["sms", "voice", "task", "chat"] as const)
  assert.equal(analysisSourceMatches(config, { channel, ownerUserId: "source-owner" }), true);
assert.ok(analysisConfigIssues({ ...config, channels: ["chat"], analyzeContent: false }).length);
assert.ok(analysisConfigIssues({ ...config, senderEmails: ["malformed"] }).length);
const rule = { module: "communication", trigger: { type: "event", entityType: "communication",
  eventType: "communication.received", analysis: config }, conditions: { field: "analysis.hasInvoice", op: "eq", value: true },
  actions: [{ type: "create_task", config: { title: "Review invoice", assignedUserId: "owner", analysisAttachments: "invoice" } }] };
assert.deepEqual(validateRuleCapabilities(rule), []);
assert.ok(validateRuleCapabilities({ ...rule, trigger: { ...rule.trigger, analysis: { ...config, channels: [] } } }).length);
assert.deepEqual(validateRuleCapabilities({ module: "metric", trigger: { type: "event", entityType: "metric", eventType: "metric.threshold",
  metric: { metricType: "pending_invoices", checkFrequency: "hourly", cooldownMinutes: 60 } },
  conditions: { field: "newValues.value", op: "gte", value: 5 }, actions: [{ type: "notify_user", config: { title: "Review", userId: "owner" } }] }), []);
const result: ServiceAnalysis = { sentiment: "neutral", tone: "calm", summary: "Document received", wantsToCancel: false,
  hasInvoice: true, invoiceCount: 1, attachmentCount: 3, failedAttachmentCount: 1, attachments: [
    { id: "trusted-upload", name: "document.pdf", url: "/api/tasks/attachments/trusted-upload", type: "application/pdf", size: 6, classification: "invoice" },
    { id: "other-upload", name: "invoice.pdf", url: "/api/tasks/attachments/other-upload", type: "application/pdf", size: 7, classification: "other" },
  ] };
assert.deepEqual(selectedAnalysisAttachments("invoice", result).map(attachment => attachment.id), ["trusted-upload"]);
assert.equal(selectedAnalysisAttachments("all", result).length, 2);
assert.throws(() => selectedAnalysisAttachments("invoice", null), /unavailable/);
assert.equal(evalCondition({ field: "analysis.hasInvoice", op: "neq", value: true }, { analysis: { hasInvoice: null } }), false);
assert.equal(evalCondition({ field: "analysis.hasInvoice", op: "eq", value: false }, { analysis: { hasInvoice: null } }), false);
assert.equal(sourceFingerprint({ id: "source", isActive: true, name: "Rule", lastCheckedAt: new Date(0) }),
  sourceFingerprint({ name: "Rule", id: "source", isActive: true, lastCheckedAt: new Date(100) }));
assert.notEqual(sourceFingerprint({ name: "Rule", thresholdValue: 5 }), sourceFingerprint({ name: "Rule", thresholdValue: 6 }));
console.log("Unified service policy, source filters, analysis fields, attachment selection and transition fingerprints passed");
