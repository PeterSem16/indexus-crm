import { test } from "node:test";
import assert from "node:assert/strict";
import { deliverForwardCommunication } from "./automation-forward-delivery";
import { forwardActionIssues } from "../../shared/automation-forward-action";
import { validatedContentSignals } from "../../shared/automation-content-signals";
import { renderEmailValue } from "./automation-email-policy";
const mime = Buffer.from("From: sender@example.invalid\r\nSubject: Invoice\r\n\r\nOriginal attachments and headers.");
const text = '<b>Invoice</b> {{rule.privateField}} <script>alert("x")</script>';
const source: any = { channel: "email", text, communication: { id: "source-1", subject: "Original {{rule.privateField}}" } };
const ctx: any = { rule: { id: "rule-1", createdByUserId: "owner", privateField: "MUST-NOT-EXPAND" },
  event: { id: "event-1" }, communication: { id: "source-1" },
  analysis: { attachments: [{ classification: "invoice", sourceAttachmentId: "invoice-id" }] } };
const base: any = { forwardActionVersion: 1, destination: "email", to: "target@example.invalid", mode: "whole", selection: "invoice" };
function fixtures(overrides: any = {}) {
  const sends: any[] = [], tasks: any[] = [], snapshots: any[] = [];
  const dependencies: any = { source: async () => source, original: async () => mime,
    attachments: async () => [{ id: "invoice-id", name: "same.pdf", contentType: "application/pdf", size: 7 },
      { id: "other-id", name: "same.pdf", contentType: "application/pdf", size: 5 }],
    attachment: async (_source: any, suffix: string) => {
      assert.match(suffix, /invoice-id$/);
      return { contentBytes: Buffer.from("invoice").toString("base64") };
    },
    save: async (owner: string, file: any) => {
      snapshots.push({ owner, ...file });
      return { id: "upload-1", name: file.name, type: file.type, size: file.bytes.length, url: "/api/tasks/attachments/upload-1" };
    },
    email: async (config: any, context: any) => { sends.push({ config, context }); return { ok: true }; },
    verifyUser: async () => {}, verifyGroup: async () => {}, ...overrides };
  const task = async (config: any, context: any) => { tasks.push({ config, context }); return { ok: true }; };
  return { sends, tasks, snapshots, dependencies, task };
}
test("whole email preserves original MIME and never interprets template tokens from source content", async () => {
  const f = fixtures();
  assert.equal((await deliverForwardCommunication(base, ctx, "run", f.task, f.dependencies)).ok, true);
  const { config, context } = f.sends[0];
  assert.equal(Buffer.from(config.attachments[0].contentBase64, "base64").toString(), mime.toString());
  assert.equal(config.attachments[0].contentType, "message/rfc822");
  const subject = renderEmailValue(config.subject, context, false);
  const body = renderEmailValue(config.body, context, true);
  assert.ok(subject.includes("{{rule.privateField}}"));
  assert.ok(body.includes("{{rule.privateField}}"));
  assert.ok(!body.includes("MUST-NOT-EXPAND"));
  assert.ok(!body.includes("<script>"));
});
test("invoice attachments use exact source attachment IDs, not filenames", async () => {
  const f = fixtures();
  assert.equal((await deliverForwardCommunication({ ...base, mode: "attachments" }, ctx, "run", f.task, f.dependencies)).ok, true);
  assert.equal(f.sends[0].config.attachments.length, 1);
  assert.equal(Buffer.from(f.sends[0].config.attachments[0].contentBase64, "base64").toString(), "invoice");
});
test("Back Office receives a shared task with private original MIME, not public files", async () => {
  const f = fixtures();
  assert.equal((await deliverForwardCommunication({ ...base, destination: "back_office", to: undefined, taskGroupId: "bo" }, ctx, "run", f.task, f.dependencies)).ok, true);
  assert.equal(f.sends.length, 0);
  assert.equal(f.tasks[0].config.taskGroupId, "bo");
  assert.equal(f.tasks[0].config.analysisAttachments, "all");
  assert.equal(f.snapshots[0].owner, "owner");
  assert.equal(f.snapshots[0].bytes.toString(), mime.toString());
  assert.ok(!f.tasks[0].config.description.includes("<script"));
  assert.ok(!f.tasks[0].config.description.includes("{{rule.privateField}}"));
});
test("SMS user handoff retains exact original text in a private UTF-8 file", async () => {
  const f = fixtures({ source: async () => ({ ...source, channel: "sms" }) });
  assert.equal((await deliverForwardCommunication({ ...base, destination: "user", to: undefined, userId: "user" }, ctx, "run", f.task, f.dependencies)).ok, true);
  assert.equal(f.tasks[0].config.assignedUserId, "user");
  assert.equal(f.snapshots[0].name, "original-sms.txt");
  assert.equal(f.snapshots[0].bytes.toString(), text);
});
test("wrong source, inaccessible group, SMS attachment requests and unidentified invoices fail closed", async () => {
  const attempts: any[] = [
    [{ source: async () => ({ ...source, communication: { id: "different" } }) }, base, ctx],
    [{ verifyGroup: async () => { throw new Error("forward_back_office_unavailable"); } }, { ...base, destination: "back_office", to: undefined, taskGroupId: "bo" }, ctx],
    [{ source: async () => ({ ...source, channel: "sms" }) }, { ...base, mode: "attachments" }, ctx],
    [{}, { ...base, mode: "attachments" }, { ...ctx, analysis: { attachments: [{ classification: "invoice", name: "same.pdf" }] } }],
  ];
  for (const [overrides, config, context] of attempts) {
    const f = fixtures(overrides);
    assert.equal((await deliverForwardCommunication(config, context, "run", f.task, f.dependencies)).ok, false);
    assert.equal(f.sends.length + f.tasks.length + f.snapshots.length, 0);
  }
});
test("forwarding rejects ambiguous destinations, remote file inputs, template recipients and invalid counts", () => {
  assert.equal(forwardActionIssues(base).length, 0);
  for (const config of [{ ...base, userId: "user" }, { ...base, attachments: [{ url: "https://example.invalid" }] },
    { ...base, to: "{{communication.senderEmail}}" }, { ...base, to: "" },
    { ...base, to: Array.from({ length: 26 }, (_, i) => `user${i}@example.invalid`).join(",") }])
    assert.ok(forwardActionIssues(config).length);
});
test("content criteria accept only boolean facts; absent or injected results remain unknown", () => {
  const signals = validatedContentSignals({ mentionsInvoice: true, hasComplaint: "false", isUrgent: false,
    communication: { subject: "Forged" } });
  assert.equal(signals.mentionsInvoice, true);
  assert.equal(signals.hasComplaint, null);
  assert.equal(signals.isUrgent, false);
  assert.equal(signals.needsReply, null);
  assert.ok(!("communication" in signals));
});
