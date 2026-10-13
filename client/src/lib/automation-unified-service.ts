export type AnalysisServiceId = "communication_analysis" | "attachment_analysis" | "metric_monitor";
export type AnalysisChannel = "email" | "sms" | "voice" | "task" | "chat";

export function createAnalysisServiceDraft(id: Exclude<AnalysisServiceId, "metric_monitor">, title: string, description: string) {
  const attachment = id === "attachment_analysis";
  return {
    name: title,
    description,
    module: "communication",
    enabled: false,
    countryCode: null,
    countryCodes: null,
    trigger: {
      type: "event" as const,
      entityType: "communication",
      eventType: "communication.received",
      analysis: {
        channels: attachment ? ["email"] as AnalysisChannel[] : ["email", "sms", "voice", "task", "chat"] as AnalysisChannel[],
        mailboxUserIds: [] as string[],
        senderEmails: [] as string[],
        analyzeContent: true,
        analyzeAttachments: attachment,
      },
    },
    conditions: null,
    actions: [{ type: "notify_user", config: { notificationActionVersion: 2, title } }],
    rateLimitPerHour: null,
  };
}

export function createMetricServiceDraft(input: {
  name: string; description: string; metricType: string; checkFrequency: string; cooldownMinutes: number; threshold: number;
}) {
  return {
    name: input.name,
    description: input.description,
    module: "metric",
    enabled: false,
    countryCode: null,
    countryCodes: null,
    trigger: {
      type: "event" as const,
      entityType: "metric",
      eventType: "metric.threshold",
      metric: { metricType: input.metricType, checkFrequency: input.checkFrequency, cooldownMinutes: input.cooldownMinutes },
    },
    conditions: { field: "newValues.value", op: "gte", value: input.threshold },
    actions: [{ type: "notify_user", config: { notificationActionVersion: 2, title: input.name } }],
    rateLimitPerHour: null,
  };
}

export const ANALYSIS_RESULT_FIELDS = [
  "analysis.sentiment", "analysis.tone", "analysis.summary", "analysis.wantsToCancel",
  "analysis.hasInvoice", "analysis.invoiceCount", "analysis.attachmentCount", "analysis.failedAttachmentCount",
  "analysis.mentionsInvoice", "analysis.hasComplaint", "analysis.needsReply", "analysis.isUrgent",
  "analysis.isThankYou", "analysis.requestsCallback",
] as const;
