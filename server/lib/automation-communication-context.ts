import type { AnalysisChannel } from "../../shared/automation-analysis";
import { safeCommunicationContext, type CommunicationContext } from "../../shared/automation-communication-context";

function metadata(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string") {
    try { return metadata(JSON.parse(value)); } catch { return {}; }
  }
  return {};
}
type Person = { id?: string; fullName?: string; email?: string };
/** Called only AFTER loadAnalysisSource has authorized the persisted source. */
export function communicationSourceContext(channel: AnalysisChannel, record: any, ownerUserId: string,
  related: { sender?: Person; recipient?: Person; task?: any; call?: any } = {}): CommunicationContext {
  const meta = metadata(record.metadata);
  const base: Record<string, unknown> = { type: channel, id: record.id, ownerUserId,
    createdAt: record.createdAt, text: record.content, countryCode: record.countryCode ?? record.country,
    campaignId: record.campaignId, customerId: record.customerId, entityId: record.entityId,
    entityType: record.entityType, status: record.status, attachmentCount: Array.isArray(record.attachments) ? record.attachments.length : null };
  if (channel === "email" || channel === "sms") {
    const from = meta.from?.emailAddress || meta.from;
    Object.assign(base, { direction: record.direction, subject: record.subject,
      senderEmail: typeof from === "string" ? from : from?.address || meta.senderEmail,
      senderName: from?.name || meta.senderName, senderPhone: record.senderPhone,
      recipientName: meta.recipientName || related.recipient?.fullName, recipientEmail: record.recipientEmail || meta.mailboxSource?.mailboxEmail,
      recipientPhone: record.recipientPhone, recipientUserId: record.userId,
      provider: record.provider, sentAt: record.sentAt, deliveredAt: record.deliveredAt,
      receivedAt: meta.receivedAt || meta.receivedDateTime || record.deliveredAt || (channel === "sms" ? record.createdAt : null),
      conversationId: meta.conversationId });
  } else if (channel === "voice") {
    const call = related.call || {};
    const direction = call.direction || record.direction;
    const inbound = direction === "inbound";
    const outbound = direction === "outbound";
    const agentName = record.agentName || related.sender?.fullName;
    const contactName = record.customerName;
    const phone = call.phoneNumber || record.phoneNumber;
    Object.assign(base, { direction, text: record.transcriptionText, callId: record.callLogId,
      agentUserId: record.userId, agentName, contactName, campaignName: record.campaignName,
      senderName: inbound ? contactName : outbound ? agentName : null,
      senderPhone: inbound ? phone : null, senderUserId: outbound ? record.userId : null,
      recipientName: inbound ? agentName : outbound ? contactName : null,
      recipientUserId: inbound ? record.userId : null, recipientPhone: outbound ? phone : null,
      initiatorName: inbound ? contactName : outbound ? agentName : null,
      initiatorUserId: outbound ? record.userId : null,
      startedAt: call.startedAt, answeredAt: call.answeredAt, endedAt: call.endedAt,
      durationSeconds: call.durationSeconds ?? record.durationSeconds, endedBy: call.hungUpBy,
      status: call.status, transcriptionLanguage: record.transcriptionLanguage });
  } else if (channel === "chat") {
    Object.assign(base, { direction: "internal", senderUserId: record.senderId,
      senderName: related.sender?.fullName, senderEmail: related.sender?.email,
      recipientUserId: record.receiverId, recipientName: related.recipient?.fullName,
      recipientEmail: related.recipient?.email, receivedAt: record.createdAt });
  } else {
    const task = related.task || record;
    const isComment = !!related.task;
    Object.assign(base, { direction: "internal", taskId: task.id, taskTitle: task.title,
      taskStatus: task.status, taskPriority: task.priority, countryCode: task.country,
      senderUserId: isComment ? record.userId : task.createdByUserId,
      senderName: related.sender?.fullName, senderEmail: related.sender?.email,
      recipientUserId: task.assignedUserId, recipientName: related.recipient?.fullName,
      text: isComment ? record.content : `${task.title}\n${task.description || ""}`,
      commentKind: isComment ? record.kind : null, receivedAt: record.createdAt });
  }
  return safeCommunicationContext(base);
}

/** Envelope fetched from the already-authorized message in its own M365 mailbox.
 * The CRM user's login email is not evidence of the delivery address. */
export function emailEnvelopeContext(context: CommunicationContext, mailboxEmail: string, envelope: any): CommunicationContext {
  if (!mailboxEmail?.trim()) throw new Error("analysis_mailbox_unavailable");
  const recipients = [...(Array.isArray(envelope.toRecipients) ? envelope.toRecipients : []),
    ...(Array.isArray(envelope.ccRecipients) ? envelope.ccRecipients : [])];
  const deliveredTo = recipients.find(item =>
    typeof item?.emailAddress?.address === "string" &&
    item.emailAddress.address.trim().toLowerCase() === mailboxEmail.trim().toLowerCase());
  return safeCommunicationContext({ ...context,
    recipientEmail: context.recipientEmail || deliveredTo?.emailAddress.address || mailboxEmail.trim(),
    sentAt: context.sentAt || envelope.sentDateTime,
    receivedAt: context.receivedAt || envelope.receivedDateTime,
  });
}
