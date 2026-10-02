import { eq } from "drizzle-orm";
import { db } from "../db";
import { communicationMessages, customers } from "../../shared/schema";
import { emitEventOnce } from "./event-bus";

/** Never publish content from a callback or an uncommitted AI result. */
export async function emitPersistedInboundEvent(
  messageId: string,
  eventType: "sms.received" | "email.received" | "sentiment.negative",
  contactType?: string | null,
) {
  const [message] = await db.select({
    id: communicationMessages.id,
    type: communicationMessages.type,
    direction: communicationMessages.direction,
    customerId: communicationMessages.customerId,
    campaignId: communicationMessages.campaignId,
    entityType: communicationMessages.entityType,
    aiAnalyzed: communicationMessages.aiAnalyzed,
    aiSentiment: communicationMessages.aiSentiment,
    aiHasAngryTone: communicationMessages.aiHasAngryTone,
  }).from(communicationMessages)
    .where(eq(communicationMessages.id, messageId)).limit(1);
  if (!message || message.direction !== "inbound") return null;
  if (eventType === "sms.received" && message.type !== "sms") return null;
  if (eventType === "email.received" && message.type !== "email") return null;
  if (eventType === "sentiment.negative" &&
      (!message.aiAnalyzed ||
       !(message.aiSentiment === "negative" || message.aiSentiment === "angry" || message.aiHasAngryTone))) {
    return null;
  }
  let countryCode: string | null = null;
  if (message.customerId) {
    const [customer] = await db.select({ country: customers.country })
      .from(customers).where(eq(customers.id, message.customerId)).limit(1);
    countryCode = customer?.country || null;
  }
  return emitEventOnce({
    source: "webhook",
    module: "communication",
    entityType: "communication",
    entityId: message.id,
    eventType,
    newValues: {
      type: message.type,
      customerId: message.customerId || null,
      campaignId: message.campaignId || null,
      contactType: message.entityType || contactType || null,
      ...(eventType === "sentiment.negative" ? { sentiment: message.aiSentiment } : {}),
    },
    countryCode,
  }, `communication:${message.id}:${eventType}`);
}