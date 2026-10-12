import { eq } from "drizzle-orm";
import { db } from "../db";
import { callRecordings, callLogs, chatMessages, taskComments, tasks, users } from "../../shared/schema";
import { emitEventOnceForIdentity } from "./event-bus";
export async function publishTaskBodySource(taskId: string, eventId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return;
  await emitEventOnceForIdentity({ module: "communication", entityType: "communication", entityId: taskId,
    eventType: "task.body_received", countryCode: task.country, actorUserId: task.createdByUserId,
    newValues: { type: "task", serviceSourceId: eventId } }, "serviceSourceId", eventId, `task-body:${eventId}`);
}

/** Event payloads carry an identity only; analysis re-reads the authorized source. */
export async function publishCommunicationServiceSource(channel: "chat" | "task" | "voice", id: string) {
  let countryCode: string | null = null;
  let actorUserId: string | null = null;
  let eventType: string;
  if (channel === "chat") {
    const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
    if (!message) return;
    const [receiver] = await db.select().from(users).where(eq(users.id, message.receiverId));
    countryCode = receiver?.assignedCountries?.length === 1 ? receiver.assignedCountries[0] : null;
    actorUserId = message.senderId;
    eventType = "chat.received";
  } else if (channel === "task") {
    const [comment] = await db.select().from(taskComments).where(eq(taskComments.id, id));
    if (!comment || (comment as any).kind === "state_change") return;
    const [task] = await db.select().from(tasks).where(eq(tasks.id, comment.taskId));
    if (!task) return;
    countryCode = task.country;
    actorUserId = comment.userId;
    eventType = "task.message_received";
  } else {
    const [recording] = await db.select().from(callRecordings).where(eq(callRecordings.id, id));
    if (!recording?.transcriptionText || recording.analysisStatus !== "completed") return;
    // Do not invent a Mission/contact country from an agent's assignments.
    // Unknown voice scope is visible only to global rules.
    countryCode = null;
    actorUserId = recording.userId;
    eventType = "voice.transcribed";
  }
  await emitEventOnceForIdentity({ module: "communication", entityType: "communication", entityId: id,
    eventType, countryCode, actorUserId, newValues: { type: channel, serviceSourceId: id } },
  "serviceSourceId", id, `${channel}:${id}`);
}
