import { z } from "zod";
import { sql, type SQLWrapper } from "drizzle-orm";

/** The existing nine-field contract, now validated before persistence or events. */
export const emailMonitoringSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative", "angry"]),
  hasInappropriateContent: z.boolean(),
  hasAngryTone: z.boolean(),
  hasRudeExpressions: z.boolean(),
  wantsToCancel: z.boolean(),
  wantsConsent: z.boolean(),
  doesNotAcceptContract: z.boolean(),
  alertLevel: z.enum(["none", "warning", "critical"]),
  note: z.string().max(100),
}).strict();
export type EmailMonitoringAnalysis = z.infer<typeof emailMonitoringSchema>;
export function parseEmailMonitoringAnalysis(content: string): EmailMonitoringAnalysis {
  try {
    return emailMonitoringSchema.parse(JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim()));
  } catch {
    // Never log model content or a Zod issue containing customer values.
    throw new Error("email_monitoring_invalid_analysis");
  }
}
export function emailMonitoringFields(analysis: EmailMonitoringAnalysis, now = new Date()) {
  const value = emailMonitoringSchema.parse(analysis);
  return {
    aiAnalyzed: true, aiSentiment: value.sentiment, aiAlertLevel: value.alertLevel,
    aiHasAngryTone: value.hasAngryTone, aiHasRudeExpressions: value.hasRudeExpressions,
    aiWantsToCancel: value.wantsToCancel, aiWantsConsent: value.wantsConsent,
    aiDoesNotAcceptContract: value.doesNotAcceptContract, aiAnalysisNote: value.note,
    aiAnalyzedAt: now,
  };
}
/** Atomic JSON merge preserves concurrently saved mailbox/contact attribution. */
export function emailMonitoringMetadata(column: SQLWrapper, analysis: EmailMonitoringAnalysis) {
  return sql`jsonb_set(COALESCE(${column}::jsonb, '{}'::jsonb),
    '{emailMonitoringAnalysis}', ${JSON.stringify(emailMonitoringSchema.parse(analysis))}::jsonb, true)::text`;
}
