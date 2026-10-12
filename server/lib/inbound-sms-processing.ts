import { eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { campaignAgents, communicationMessages } from "../../shared/schema";
import { getOmniSmsNotificationAudience } from "../omni-sms-service";
import { emitPersistedInboundEvent } from "./inbound-communication-events";
import { notificationService } from "./notification-service";
import { scheduleInboundSmsAnalysis, type SmsAnalysisResult } from "./inbound-sms-analysis";

const negativeTitles: Record<string, string> = {
  SK: "SMS vyžaduje pozornosť", CZ: "SMS vyžaduje pozornost",
  HU: "Az SMS figyelmet igényel", RO: "SMS-ul necesită atenție",
  IT: "L’SMS richiede attenzione", DE: "SMS erfordert Aufmerksamkeit",
  AT: "SMS erfordert Aufmerksamkeit", CH: "SMS erfordert Aufmerksamkeit",
};

/** Legacy notification rules must never widen the message's inbox permissions. */
async function triggerSmsRules(
  id: string, triggerType: "new_sms" | "sentiment_negative",
  smsAnalysisPhase?: "received" | "analyzed",
) {
  const [message] = await db.select({
    provider: communicationMessages.provider,
    countryCode: communicationMessages.countryCode,
    senderPhone: communicationMessages.senderPhone,
    aiSentiment: communicationMessages.aiSentiment,
    aiAlertLevel: communicationMessages.aiAlertLevel,
    aiHasAngryTone: communicationMessages.aiHasAngryTone,
    aiHasRudeExpressions: communicationMessages.aiHasRudeExpressions,
    aiWantsToCancel: communicationMessages.aiWantsToCancel,
    aiWantsConsent: communicationMessages.aiWantsConsent,
    aiDoesNotAcceptContract: communicationMessages.aiDoesNotAcceptContract,
    aiAnalysisNote: communicationMessages.aiAnalysisNote,
  }).from(communicationMessages).where(eq(communicationMessages.id, id)).limit(1);
  if (!message) return;
  const audience = await getOmniSmsNotificationAudience(id);
  if (!audience.length) return;
  await notificationService.triggerNotification(triggerType, {
    title: triggerType === "new_sms" ? "SMS" : negativeTitles[message.countryCode || ""] || "SMS needs attention",
    message: triggerType === "sentiment_negative" ? message.aiAnalysisNote || undefined : undefined,
    entityType: "sms", entityId: id, countryCode: message.countryCode || undefined,
    allowedUserIds: audience.map(member => member.id),
    smsAnalysisPhase,
    metadata: {
      provider: message.provider, senderPhone: message.senderPhone,
      sentiment: message.aiSentiment, alertLevel: message.aiAlertLevel,
      hasAngryTone: message.aiHasAngryTone, hasRudeExpressions: message.aiHasRudeExpressions,
      wantsToCancel: message.aiWantsToCancel, wantsConsent: message.aiWantsConsent,
      doesNotAcceptContract: message.aiDoesNotAcceptContract,
    },
  });
}

async function publishEvent(id: string, eventType: "sms.received" | "sentiment.negative") {
  try { await emitPersistedInboundEvent(id, eventType); }
  catch { console.error("[SMS Analysis] Event publication failed"); }
}

/** Both gateways enter here only after persistence, attribution and their inbox notice. */
export function startInboundSmsAnalysis(
  id: string, analyze: (content: string) => Promise<SmsAnalysisResult | null>,
) {
  scheduleInboundSmsAnalysis(id, {
    load: async messageId => {
      const [row] = await db.select({
        id: communicationMessages.id, type: communicationMessages.type,
        direction: communicationMessages.direction, provider: communicationMessages.provider,
        content: communicationMessages.content, aiAnalyzed: communicationMessages.aiAnalyzed,
      }).from(communicationMessages).where(eq(communicationMessages.id, messageId)).limit(1);
      return row;
    },
    analyze,
    persist: (messageId, patch) => storage.updateCommunicationMessage(messageId, patch),
    received: async messageId => {
      await publishEvent(messageId, "sms.received");
      try { await triggerSmsRules(messageId, "new_sms", "received"); }
      catch { console.error("[SMS Analysis] Incoming rule notification failed"); }
    },
    analyzed: async messageId => {
      try { await triggerSmsRules(messageId, "new_sms", "analyzed"); }
      catch { console.error("[SMS Analysis] Analyzed SMS rule notification failed"); }
    },
    negative: async (messageId, result) => {
      await publishEvent(messageId, "sentiment.negative");
      try { await triggerSmsRules(messageId, "sentiment_negative"); }
      catch { console.error("[SMS Analysis] Sentiment rule notification failed"); }
      // Preserve the existing Pulse Mission alert, now equally for both providers.
      const [message] = await db.select({
        campaignId: communicationMessages.campaignId,
        countryCode: communicationMessages.countryCode,
        provider: communicationMessages.provider,
      }).from(communicationMessages).where(eq(communicationMessages.id, messageId)).limit(1);
      if (!message?.campaignId) return;
      const assigned = await db.select({ userId: campaignAgents.userId }).from(campaignAgents)
        .where(eq(campaignAgents.campaignId, message.campaignId));
      const recipients = [...new Set(assigned.map(row => row.userId))];
      if (!recipients.length) return;
      await notificationService.sendNotificationToUsers(recipients, {
        type: "sentiment_negative",
        title: negativeTitles[message.countryCode || ""] || "SMS needs attention",
        message: result.note || undefined, entityType: "sms", entityId: messageId,
        countryCode: message.countryCode || undefined,
        priority: result.alertLevel === "critical" ? "urgent" : result.alertLevel === "warning" ? "high" : "normal",
        metadata: { provider: message.provider, sentiment: result.sentiment,
          alertLevel: result.alertLevel, hasAngryTone: result.hasAngryTone, wantsToCancel: result.wantsToCancel },
      });
    },
  });
}
