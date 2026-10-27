import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { chatAnalysisOutbox, chatMessages, users, type ChatMessage } from "../../shared/schema";
import { db, pool } from "../db";
import { emitEventOnceForIdentity } from "./event-bus";

/** Call inside the message transaction, never after commit. No content is copied. */
export async function enqueueChatAnalysis(tx: Pick<typeof db, "select" | "insert">, message: ChatMessage) {
  const [receiver] = await tx.select({ countries: users.assignedCountries })
    .from(users).where(eq(users.id, message.receiverId));
  await tx.insert(chatAnalysisOutbox).values({
    messageId: message.id,
    countryCode: receiver?.countries?.length === 1 ? receiver.countries[0] : null,
    occurredAt: message.createdAt,
  }).onConflictDoNothing();
}

let active: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

/**
 * Only the outbox is scanned, never old chat history. A cross-process lock
 * serializes delivery; event/run identities make restart retries safe.
 */
export async function recoverChatAnalysis(): Promise<void> {
  if (active) return active;
  active = drain().finally(() => { active = null; });
  return active;
}

async function drain() {
  const client = await pool.connect();
  let locked = false;
  let discard = false;
  try {
    const lock = await client.query("SELECT pg_try_advisory_lock(hashtextextended('indexus:chat-analysis-outbox', 0)) AS locked");
    locked = lock.rows[0]?.locked === true;
    if (!locked) return;
    const pending = await db.select().from(chatAnalysisOutbox)
      .where(and(isNull(chatAnalysisOutbox.completedAt), lte(chatAnalysisOutbox.nextAttemptAt, new Date())))
      .orderBy(chatAnalysisOutbox.nextAttemptAt).limit(25);
    for (const item of pending) {
      try {
        // Re-read the persisted identity; do not reconstruct or resend chat.
        const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, item.messageId));
        if (!message) continue; // FK cascade removes deleted sources.
        const eventId = item.eventId || await emitEventOnceForIdentity({
          module: "communication", entityType: "communication", entityId: message.id,
          eventType: "chat.received", countryCode: item.countryCode, actorUserId: message.senderId,
          newValues: { type: "chat", serviceSourceId: message.id },
        }, "serviceSourceId", message.id, `chat:${message.id}`, undefined,
        { createdAt: item.occurredAt, deferDispatch: true, requireIdentity: true });
        if (!eventId) throw new Error("chat_event_not_persisted");
        await db.update(chatAnalysisOutbox).set({ eventId }).where(eq(chatAnalysisOutbox.messageId, item.messageId));
        const { processEvent } = await import("./automation-engine");
        await processEvent(eventId);
        await db.update(chatAnalysisOutbox).set({ completedAt: new Date() })
          .where(eq(chatAnalysisOutbox.messageId, item.messageId));
      } catch {
        // Retry publication/evaluation, not a previously started action. No PII
        // or raw provider errors are logged or persisted.
        await db.update(chatAnalysisOutbox).set({
          attempts: sql`${chatAnalysisOutbox.attempts} + 1`,
          nextAttemptAt: new Date(Date.now() + Math.min(300_000, 1000 * 2 ** Math.min(item.attempts, 8))),
        }).where(eq(chatAnalysisOutbox.messageId, item.messageId));
        console.error("[Automation] chat analysis handoff deferred");
      }
    }
  } finally {
    if (locked) {
      try { await client.query("SELECT pg_advisory_unlock(hashtextextended('indexus:chat-analysis-outbox', 0))"); }
      catch { discard = true; }
    }
    client.release(discard);
  }
}

export function startChatAnalysisRecovery() {
  if (timer) return;
  const tick = () => { void recoverChatAnalysis().catch(() => console.error("[Automation] chat recovery unavailable")); };
  timer = setInterval(tick, 15_000);
  timer.unref();
  tick();
}
