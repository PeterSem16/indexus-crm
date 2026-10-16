import { and, eq, inArray } from "drizzle-orm";
import { dirname, join } from "node:path";
import { db } from "../db";
import { storage } from "../storage";
import { callLogs, callRecordings, chatMessages, communicationMessages, taskComments, taskGroupMembers, taskAttachmentUploads, tasks, users, type WorkflowEvent, type WorkflowRule } from "../../shared/schema";
import { communicationSourceContext, emailEnvelopeContext } from "./automation-communication-context";
import type { CommunicationContext } from "../../shared/automation-communication-context";
import { analysisSourceMatches, type AnalysisChannel, type CommunicationAnalysisConfig } from "../../shared/automation-analysis";
import { decryptTokenSafe, encryptTokenWithMarker } from "./token-crypto";
import { getValidAccessToken } from "./ms365";
import { canAccessTaskByPolicy } from "./task-contract";
import { DATA_ROOT } from "../config/storage-paths";
import { privateAnalysisAttachmentIds, readPrivateAnalysisAttachment } from "./automation-private-attachment";

export type AnalysisSource = {
  channel: AnalysisChannel; ownerUserId: string; senderEmail?: string | null;
  text: string; message?: typeof communicationMessages.$inferSelect;
  communication: CommunicationContext;
  mailboxToken?: string;
  systemMailboxCountry?: string;
  mailboxEmail?: string;
  privateAttachments?: unknown;
};
export type SourceAttachment = { id: string; name: string; contentType: string; size: number; contentBytes?: string; privateStorageKey?: string };

async function canReadTask(creator: any, task: typeof tasks.$inferSelect) {
  const memberships = ["admin", "manager"].includes(creator.role) ? [] :
    await db.select({ groupId: taskGroupMembers.groupId }).from(taskGroupMembers).where(eq(taskGroupMembers.userId, creator.id));
  return canAccessTaskByPolicy(creator, task, new Set(memberships.map(member => member.groupId)));
}

async function sourcePerson(id: string | null | undefined) {
  if (!id) return undefined;
  return (await db.select({ id: users.id, fullName: users.fullName, email: users.email })
    .from(users).where(eq(users.id, id)))[0];
}

export async function loadAnalysisSource(rule: WorkflowRule, event: WorkflowEvent): Promise<AnalysisSource | null> {
  if (!event.entityId || !rule.createdByUserId) return null;
  const creator = await storage.getUser(rule.createdByUserId);
  if (!creator?.isActive) return null;
  const config = (rule.trigger as any).analysis as CommunicationAnalysisConfig;
  let source: AnalysisSource | null = null;
  if (event.module === "communication" && ["email.received", "sms.received"].includes(event.eventType)) {
    const [message] = await db.select().from(communicationMessages).where(eq(communicationMessages.id, event.entityId));
    if (!message || message.direction !== "inbound" || !["email", "sms"].includes(message.type)) return null;
    let metadata: any = message.metadata || {};
    if (typeof metadata === "string") { try { metadata = JSON.parse(metadata); } catch { metadata = {}; } }
    const from = metadata.from?.emailAddress?.address || metadata.from?.address || metadata.senderEmail || (typeof metadata.from === "string" ? metadata.from : null);
    const systemMailbox = metadata.mailboxSource?.kind === "system" ? metadata.mailboxSource : null;
    const owner = systemMailbox ? `system:${systemMailbox.countryCode}` : metadata.mailboxSource?.ownerUserId || message.userId || "";
    // Selecting a mailbox never grants a manager access to another person's private mail.
    if (message.type === "email" && owner !== creator.id &&
        !(["admin", "superadmin", "owner"].includes(creator.role) && owner &&
          (!config.mailboxUserIds?.length || config.mailboxUserIds.includes(owner)))) return null;
    if (message.type === "sms") {
      const { getOmniSmsNotificationAudience } = await import("../omni-sms-service");
      const audience = await getOmniSmsNotificationAudience(message.id);
      if (!audience.some(user => user.id === creator.id)) return null;
    }
    const recipient = systemMailbox ? undefined : await sourcePerson(message.userId);
    source = { channel: message.type as AnalysisChannel, ownerUserId: owner, senderEmail: from, text: message.content || "", message,
      communication: communicationSourceContext(message.type as AnalysisChannel, message, owner, { recipient }),
      ...(systemMailbox ? { systemMailboxCountry: systemMailbox.countryCode, mailboxEmail: systemMailbox.mailboxEmail } : {}) };
  } else if (event.module === "communication" && event.eventType === "chat.received") {
    const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, event.entityId));
    if (!message || ![message.senderId, message.receiverId].includes(creator.id)) return null;
    const [sender, recipient] = await Promise.all([sourcePerson(message.senderId), sourcePerson(message.receiverId)]);
    source = { channel: "chat", ownerUserId: message.receiverId, text: message.content,
      privateAttachments: message.attachments,
      communication: communicationSourceContext("chat", message, message.receiverId, { sender, recipient }) };
  } else if (event.module === "communication" && event.eventType === "task.body_received") {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, event.entityId));
    if (!task || !await canReadTask(creator, task)) return null;
    const [sender, recipient] = await Promise.all([sourcePerson(task.createdByUserId), sourcePerson(task.assignedUserId)]);
    source = { channel: "task", ownerUserId: creator.id, text: `${task.title}\n${task.description || ""}`,
      privateAttachments: task.attachments,
      communication: communicationSourceContext("task", task, creator.id, { sender, recipient }) };
  } else if (event.module === "communication" && event.eventType === "task.message_received") {
    const [comment] = await db.select().from(taskComments).where(eq(taskComments.id, event.entityId));
    if (!comment) return null;
    const [task] = await db.select().from(tasks).where(eq(tasks.id, comment.taskId));
    if (!task || !await canReadTask(creator, task)) return null;
    const [sender, recipient] = await Promise.all([sourcePerson(comment.userId), sourcePerson(task.assignedUserId)]);
    source = { channel: "task", ownerUserId: creator.id, text: comment.content || "",
      privateAttachments: (comment.metadata as any)?.attachments,
      communication: communicationSourceContext("task", comment, creator.id, { task, sender, recipient }) };
  } else if (event.module === "communication" && event.eventType === "voice.transcribed") {
    const [recording] = await db.select().from(callRecordings).where(eq(callRecordings.id, event.entityId));
    if (!recording?.transcriptionText || recording.analysisStatus !== "completed") return null;
    if (recording.userId !== creator.id && !["admin", "superadmin", "owner"].includes(creator.role)) return null;
    // Only the existing authorized recording/transcription path can supply voice text.
    const [call] = await db.select().from(callLogs).where(and(eq(callLogs.id, recording.callLogId), eq(callLogs.userId, recording.userId)));
    const sender = await sourcePerson(recording.userId);
    source = { channel: "voice", ownerUserId: recording.userId, text: recording.transcriptionText,
      communication: communicationSourceContext("voice", recording, recording.userId, { call, sender }) };
  }
  if (!source || !analysisSourceMatches(config, source)) return null;
  // Legacy ingestion omitted envelope fields. Read only the authorized original;
  // never guess its recipient from the responsible agent's CRM login address.
  if (source.channel === "email" && source.message?.externalId &&
      (!source.communication.recipientEmail || !source.communication.sentAt || !source.communication.receivedAt)) {
    const envelope = await mailboxRequest(source, "?$select=toRecipients,ccRecipients,sentDateTime,receivedDateTime");
    source.communication = emailEnvelopeContext(source.communication, source.mailboxEmail!, envelope);
  }
  return source;
}

export async function prepareSourceMailbox(source: AnalysisSource) {
  if (!source.message?.externalId || !source.ownerUserId) throw new Error("analysis_mailbox_unavailable");
  const connection = source.systemMailboxCountry
    ? await storage.getSystemMs365Connection(source.systemMailboxCountry)
    : await storage.getUserMs365Connection(source.ownerUserId);
  if (!connection?.isConnected || !connection.accessToken) throw new Error("analysis_mailbox_unavailable");
  if (source.systemMailboxCountry && (!source.mailboxEmail ||
      source.mailboxEmail.toLowerCase() !== (connection as any).email?.toLowerCase())) throw new Error("analysis_mailbox_changed");
  if (!(connection as any).email?.trim()) throw new Error("analysis_mailbox_unavailable");
  source.mailboxEmail = (connection as any).email.trim();
  const token = await getValidAccessToken(decryptTokenSafe(connection.accessToken), connection.tokenExpiresAt,
    connection.refreshToken ? decryptTokenSafe(connection.refreshToken) : null);
  if (!token?.accessToken) throw new Error("analysis_mailbox_unavailable");
  if (token.refreshed) {
    const update = { accessToken: encryptTokenWithMarker(token.accessToken), tokenExpiresAt: token.expiresOn,
      ...(token.refreshToken ? { refreshToken: encryptTokenWithMarker(token.refreshToken) } : {}) };
    if (source.systemMailboxCountry) await storage.updateSystemMs365Connection(source.systemMailboxCountry, update);
    else await storage.updateUserMs365Connection(source.ownerUserId, update);
  }
  source.mailboxToken = token.accessToken;
}

export async function mailboxRequest(source: AnalysisSource, suffix: string) {
  if (!source.mailboxToken) await prepareSourceMailbox(source);
  if (!source.message?.externalId) throw new Error("analysis_mailbox_unavailable");
  const mailboxPath = source.systemMailboxCountry ? `/users/${encodeURIComponent(source.mailboxEmail!)}` : "/me";
  const response = await fetch(`https://graph.microsoft.com/v1.0${mailboxPath}/messages/${encodeURIComponent(source.message.externalId)}${suffix}`,
    { headers: { Authorization: `Bearer ${source.mailboxToken}` }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("analysis_mailbox_request_failed");
  return response.json();
}

export async function listSourceAttachments(source: AnalysisSource): Promise<SourceAttachment[]> {
  if (source.channel === "chat" || source.channel === "task") {
    const ids = privateAnalysisAttachmentIds(source.privateAttachments);
    if (!ids.length) return [];
    const uploads = await db.select().from(taskAttachmentUploads).where(inArray(taskAttachmentUploads.id, ids));
    return ids.map(id => {
      const upload = uploads.find(row => row.id === id);
      if (!upload) throw new Error("analysis_attachment_unavailable");
      return { id, name: upload.name, contentType: upload.type, size: upload.size, privateStorageKey: upload.storageKey };
    });
  }
  if (source.channel !== "email") return [];
  const result = await mailboxRequest(source, "/attachments");
  if (!Array.isArray(result.value) || result["@odata.nextLink"]) throw new Error("analysis_attachment_limit");
  return result.value.filter((attachment: any) => !attachment.isInline).map((attachment: any) => ({
    id: attachment.id, name: attachment.name, contentType: attachment.contentType, size: attachment.size,
    contentBytes: attachment.contentBytes,
  }));
}

export async function readSourceAttachment(source: AnalysisSource, attachment: SourceAttachment): Promise<Buffer> {
  if (source.channel === "chat" || source.channel === "task") {
    if (!attachment.privateStorageKey) throw new Error("analysis_attachment_unavailable");
    return readPrivateAnalysisAttachment(join(dirname(DATA_ROOT), "private-task-attachments"),
      attachment.privateStorageKey, attachment.size);
  }
  if (source.channel !== "email") throw new Error("analysis_attachment_unavailable");
  const downloaded = typeof attachment.contentBytes === "string" ? attachment :
    await mailboxRequest(source, `/attachments/${encodeURIComponent(attachment.id)}`);
  if (typeof downloaded.contentBytes !== "string") throw new Error("analysis_attachment_unavailable");
  if (downloaded.contentBytes.length > 4 * Math.ceil(15 * 1024 * 1024 / 3) + 4)
    throw new Error("analysis_attachment_limit");
  return Buffer.from(downloaded.contentBytes, "base64");
}
