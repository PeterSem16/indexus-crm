import assert from "node:assert/strict";
import { communicationSourceContext } from "./automation-communication-context";
import { COMMUNICATION_SOURCE_FIELDS, safeCommunicationContext } from "../../shared/automation-communication-context";
import { communicationVariableLabels } from "../../client/src/i18n/automation-communication-variable-copy";
import { automationDisplayValues, renderAutomationText } from "./automation-display-values";

async function main() {
  const email = communicationSourceContext("email", { id: "mail", direction: "inbound",
    subject: "Subject", content: "<p>Original</p>", createdAt: new Date("2026-10-13T10:00:00Z"),
    metadata: JSON.stringify({ from: { emailAddress: { address: "sender@example.test", name: "Sender" } },
      receivedDateTime: "2026-10-13T07:48:52Z", accessToken: "excluded", conversationId: "conversation" }) }, "owner");
  assert.equal(email.type, "email");
  assert.equal(email.senderEmail, "sender@example.test");
  assert.equal(email.senderName, "Sender");
  assert.equal(email.subject, "Subject");
  assert.equal(email.receivedAt, "2026-10-13T07:48:52.000Z");
  assert.equal(email.createdAt, "2026-10-13T10:00:00.000Z");
  assert.ok(!JSON.stringify(email).includes("excluded"));
  assert.equal(communicationSourceContext("email", { metadata: "broken", content: "Body" }, "owner").receivedAt, null);
  const voice = { id: "recording", callLogId: "call", agentName: "Agent", customerName: "Contact",
    userId: "agent", transcriptionText: "Actual transcript", transcriptionLanguage: "sk" };
  const inbound = communicationSourceContext("voice", voice, "agent", { call: {
    direction: "inbound", phoneNumber: "+421900000000", durationSeconds: 42, status: "completed",
    startedAt: "2026-10-13T08:00:00Z", answeredAt: "2026-10-13T08:00:05Z", hungUpBy: "customer" } });
  assert.equal(inbound.initiatorName, "Contact");
  assert.equal(inbound.initiatorUserId, null);
  assert.equal(inbound.recipientName, "Agent");
  assert.equal(inbound.senderPhone, "+421900000000");
  assert.equal(inbound.text, "Actual transcript");
  const outbound = communicationSourceContext("voice", { ...voice, direction: "outbound" }, "agent");
  assert.equal(outbound.initiatorUserId, "agent");
  assert.equal(outbound.initiatorName, "Agent");
  assert.equal(outbound.recipientName, "Contact");
  assert.equal(outbound.startedAt, null, "Do not mistake recording creation for call start");
  const chat = communicationSourceContext("chat", { id: "chat", senderId: "a", receiverId: "b",
    content: "Hello", createdAt: "2026-10-13T08:00:00Z", attachments: [{ id: "attachment" }] }, "b",
    { sender: { fullName: "Sender" }, recipient: { fullName: "Receiver" } });
  assert.equal(chat.recipientName, "Receiver");
  assert.equal(chat.attachmentCount, 1);
  const task = communicationSourceContext("task", { id: "comment", userId: "author", kind: "answer",
    content: "Reply" }, "owner", { task: { id: "task", title: "Task", status: "pending", priority: "high", assignedUserId: "assignee" } });
  assert.equal(task.taskId, "task");
  assert.equal(task.commentKind, "answer");
  assert.equal(task.recipientUserId, "assignee");
  assert.equal(safeCommunicationContext({ text: "Original", receivedAt: "bad", durationSeconds: NaN, password: "never" }).receivedAt, null);
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const)
    for (const field of COMMUNICATION_SOURCE_FIELDS) assert.ok(communicationVariableLabels(locale)[field.value], `${locale}: ${field.value}`);
  const ctx = { communication: email, event: { module: "communication", countryCode: "SK" } };
  const display = await automationDisplayValues(ctx, ["{{communication.receivedAt}}"], async () => null, "sk");
  const rendered = renderAutomationText("{{communication.subject}} / {{communication.receivedAt}}", ctx, display);
  assert.match(rendered, /9:48/, rendered);
  assert.ok(!rendered.includes("T07:"), rendered);
  console.log("Communication variables: all five sources, call direction, no invented times, allowlist, seven locales and Bratislava templates passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
