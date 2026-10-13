import { ANALYSIS_CHANNELS } from "./automation-analysis";
import { COMMUNICATION_CHOICE_VALUES } from "./automation-condition-catalog";

/** An allowlist, never a raw database row, metadata object, or mailbox credential. */
const definitions = [
  ["type", "string"], ["id", "string"], ["direction", "string"], ["subject", "string"],
  ["text", "string"], ["senderName", "string"], ["senderEmail", "string"], ["senderPhone", "string"],
  ["senderUserId", "string"], ["recipientName", "string"], ["recipientEmail", "string"],
  ["recipientPhone", "string"], ["recipientUserId", "string"], ["ownerUserId", "string"],
  ["countryCode", "string"], ["provider", "string"], ["status", "string"],
  ["createdAt", "datetime"], ["receivedAt", "datetime"], ["sentAt", "datetime"], ["deliveredAt", "datetime"],
  ["campaignId", "string"], ["campaignName", "string"], ["customerId", "string"],
  ["entityType", "string"], ["entityId", "string"], ["conversationId", "string"],
  ["callId", "string"], ["agentUserId", "string"], ["agentName", "string"],
  ["initiatorName", "string"], ["initiatorUserId", "string"], ["contactName", "string"],
  ["startedAt", "datetime"], ["answeredAt", "datetime"], ["endedAt", "datetime"],
  ["durationSeconds", "number"], ["endedBy", "string"], ["transcriptionLanguage", "string"],
  ["taskId", "string"], ["taskTitle", "string"], ["taskStatus", "string"],
  ["taskPriority", "string"], ["commentKind", "string"], ["attachmentCount", "number"],
] as const;
export type CommunicationVariable = typeof definitions[number][0];
export type CommunicationContext = Partial<Record<CommunicationVariable, string | number | null>>;
export const COMMUNICATION_SOURCE_FIELDS = definitions.map(([key, type]) => ({
  value: `communication.${key}`, label: key, type: type === "datetime" ? "date" : type,
  ...(key === "type" ? { options: [...ANALYSIS_CHANNELS] } : {}),
  ...(key === "direction" ? { options: ["inbound", "outbound", "internal"] } : {}),
  ...(COMMUNICATION_CHOICE_VALUES[key] ? { options: [...COMMUNICATION_CHOICE_VALUES[key]] } : {}),
}));

export function safeCommunicationContext(input: Record<string, unknown>): CommunicationContext {
  return Object.fromEntries(definitions.map(([key, type]) => {
    const value = input[key];
    if (type === "datetime") {
      if (value == null || value === "") return [key, null];
      const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
      return [key, date && Number.isFinite(date.getTime()) ? date.toISOString() : null];
    }
    if (type === "number") return [key, typeof value === "number" && Number.isFinite(value) ? value : null];
    return [key, typeof value === "string" ? value : null];
  }));
}
