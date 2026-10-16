import { textSearchIssues, type TextSearchConfig } from "./automation-text-search";
export const ANALYSIS_CHANNELS = ["email", "sms", "voice", "task", "chat"] as const;
export type AnalysisChannel = typeof ANALYSIS_CHANNELS[number];
export const ATTACHMENT_ANALYSIS_CHANNELS: readonly AnalysisChannel[] = ["email", "task", "chat"];
export type CommunicationAnalysisConfig = {
  channels: AnalysisChannel[];
  mailboxUserIds?: string[];
  mailboxMode?: "all" | "selected";
  senderEmails?: string[];
  analyzeContent: boolean;
  analyzeAttachments: boolean;
  textSearch?: TextSearchConfig;
};
export const METRIC_TYPES = [
  "pending_lab_results", "collections_without_hospital", "overdue_collections",
  "pending_evaluations", "expiring_api_keys", "inactive_customers", "upcoming_collection_dates",
  "low_collection_rate", "pending_invoices", "overdue_tasks",
  "overdue_scheduled_invoices", "upcoming_scheduled_invoices",
] as const;
export const METRIC_FREQUENCIES = { hourly: 3600000, every_6_hours: 21600000, daily: 86400000, weekly: 604800000 } as const;

export function analysisConfigIssues(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["analysis configuration is required"];
  const config = value as CommunicationAnalysisConfig;
  const issues: string[] = [];
  if (!Array.isArray(config.channels) || !config.channels.length || config.channels.length > 5 ||
      config.channels.some(channel => !ANALYSIS_CHANNELS.includes(channel))) issues.push("choose supported communication channels");
  if (typeof config.analyzeContent !== "boolean" || typeof config.analyzeAttachments !== "boolean" ||
      (!config.analyzeContent && !config.analyzeAttachments)) issues.push("choose content or attachment analysis");
  for (const key of ["mailboxUserIds", "senderEmails"] as const) {
    if (config[key] !== undefined && (!Array.isArray(config[key]) || config[key]!.length > 100 ||
        config[key]!.some(value => typeof value !== "string" || !value.trim() || value.length > 254))) issues.push(`invalid ${key}`);
  }
  if (config.senderEmails?.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) issues.push("invalid sender email");
  if (config.analyzeAttachments && !config.channels?.some(channel => ATTACHMENT_ANALYSIS_CHANNELS.includes(channel)))
    issues.push("attachment analysis requires email, task or chat");
  if (config.mailboxMode !== undefined && !["all", "selected"].includes(config.mailboxMode)) issues.push("invalid mailbox selection");
  if (config.mailboxMode === "selected" && !config.mailboxUserIds?.length) issues.push("choose at least one authorized mailbox");
  if (config.textSearch !== undefined) {
    issues.push(...textSearchIssues(config.textSearch));
    if (["content", "all"].includes(config.textSearch?.scope) && !config.analyzeContent)
      issues.push("text search requires content analysis");
    if (["attachments", "all"].includes(config.textSearch?.scope) && !config.analyzeAttachments)
      issues.push("text search requires attachment analysis");
  }
  return issues;
}

/** Exact addresses, never substring or display-name matching. */
export function analysisSourceMatches(config: CommunicationAnalysisConfig, source: {
  channel: AnalysisChannel; ownerUserId?: string | null; senderEmail?: string | null;
}): boolean {
  if (!config.channels.includes(source.channel)) return false;
  if (source.channel !== "email") return true;
  if (config.mailboxMode === "selected" && !config.mailboxUserIds?.length) return false;
  if (config.mailboxUserIds?.length && (!source.ownerUserId || !config.mailboxUserIds.includes(source.ownerUserId))) return false;
  return !config.senderEmails?.length || (!!source.senderEmail &&
    config.senderEmails.some(email => email.trim().toLowerCase() === source.senderEmail!.trim().toLowerCase()));
}

export const ANALYSIS_FIELDS = [
  { value: "analysis.sentiment", label: "Sentiment", type: "string", options: ["positive", "neutral", "negative", "angry"] },
  { value: "analysis.tone", label: "Tone", type: "string", options: ["calm", "concerned", "angry", "rude"] },
  { value: "analysis.summary", label: "Summary", type: "string" },
  { value: "analysis.wantsToCancel", label: "Wants to cancel", type: "boolean" },
  { value: "analysis.mentionsInvoice", label: "Message mentions an invoice", type: "boolean" },
  { value: "analysis.hasComplaint", label: "Complaint", type: "boolean" },
  { value: "analysis.needsReply", label: "Reply needed", type: "boolean" },
  { value: "analysis.isUrgent", label: "Urgent content", type: "boolean" },
  { value: "analysis.isThankYou", label: "Thank-you message", type: "boolean" },
  { value: "analysis.requestsCallback", label: "Callback requested", type: "boolean" },
  { value: "analysis.hasInvoice", label: "Invoice found", type: "boolean" },
  { value: "analysis.invoiceCount", label: "Invoice count", type: "number" },
  { value: "analysis.attachmentCount", label: "Attachment count", type: "number" },
  { value: "analysis.failedAttachmentCount", label: "Unprocessed attachment count", type: "number" },
  { value: "analysis.textMatched", label: "Requested text found", type: "boolean" },
  { value: "analysis.textContentMatched", label: "Requested text found in message / call", type: "boolean" },
  { value: "analysis.textAttachmentsMatched", label: "Requested text found in attachments", type: "boolean" },
  { value: "analysis.textMatchCount", label: "Number of matched search terms", type: "number" },
] as const;
