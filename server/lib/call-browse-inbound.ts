import { and, eq, gte, lte, or, sql } from "drizzle-orm";
import { callLogs, inboundCallLogs, type InboundCallLog } from "@shared/schema";
import { hasForwardedCallEvidence } from "./mission-call-list-scope";

export const INBOUND_BROWSE_PREFIX = "inbound:";

/** Page the combined history, not two independently paginated result sets.
 * Any existing canonical link suppresses the inbound copy, even if that
 * canonical row is outside the viewer's filters or permissions. */
export function callBrowsePageQuery(input: {
  userId: string;
  isPrivileged: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  limit: number;
  offset: number;
}) {
  const canonical = [];
  const inbound = [];
  if (!input.isPrivileged) {
    canonical.push(eq(callLogs.userId, input.userId));
    inbound.push(eq(inboundCallLogs.assignedAgentId, input.userId));
  }
  if (input.dateFrom) {
    canonical.push(gte(callLogs.startedAt, input.dateFrom));
    inbound.push(gte(inboundCallLogs.enteredQueueAt, input.dateFrom));
  }
  if (input.dateTo) {
    canonical.push(lte(callLogs.startedAt, input.dateTo));
    inbound.push(lte(inboundCallLogs.enteredQueueAt, input.dateTo));
  }
  inbound.push(sql`NOT EXISTS (SELECT 1 FROM ${callLogs} WHERE ${or(
    eq(callLogs.inboundCallLogId, inboundCallLogs.id),
    eq(callLogs.id, inboundCallLogs.callLogId),
  )})`);
  return sql`
    SELECT id, source FROM (
      SELECT ${callLogs.id} AS id, ${callLogs.startedAt} AS started_at,
        'canonical'::text AS source
      FROM ${callLogs} WHERE ${and(...canonical) ?? sql`true`}
      UNION ALL
      SELECT ${inboundCallLogs.id} AS id, ${inboundCallLogs.enteredQueueAt} AS started_at,
        'inbound'::text AS source
      FROM ${inboundCallLogs} WHERE ${and(...inbound)}
    ) AS browse_calls
    ORDER BY started_at DESC, source ASC, id DESC
    LIMIT ${input.limit} OFFSET ${input.offset}
  `;
}

export function inboundBrowseCampaignId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  if (m.campaignClassificationConflict === true || m.campaignClassificationUnverified === true) return null;
  return typeof m.campaignId === "string" && m.campaignId.trim() ? m.campaignId : null;
}

/** A read-only projection, not a recovered/fabricated canonical call. */
export function inboundOnlyBrowseEntry(row: InboundCallLog, labels: {
  queueName: string | null;
  campaignName: string | null;
  customerName: string | null;
}) {
  const campaignId = inboundBrowseCampaignId(row.metadata);
  const elapsed = (end: Date | null) => end
    ? Math.max(0, Math.floor((end.getTime() - row.enteredQueueAt.getTime()) / 1000)) : 0;
  const answered = !!row.answeredAt && ["answered", "completed"].includes(row.status);
  return {
    id: `${INBOUND_BROWSE_PREFIX}${row.id}`,
    recordSource: "inbound" as const,
    inboundCallLogId: row.id,
    userId: row.assignedAgentId,
    customerId: row.customerId,
    campaignId,
    campaignContactId: null,
    phoneNumber: row.callerNumber,
    direction: "inbound",
    status: row.status,
    startedAt: row.enteredQueueAt,
    answeredAt: answered ? row.answeredAt : null,
    endedAt: row.completedAt,
    durationSeconds: answered ? Math.max(0, row.talkDurationSeconds || 0) : 0,
    ringTimeSeconds: answered ? elapsed(row.answeredAt)
      : row.completedAt ? elapsed(row.completedAt) : Math.max(0, row.waitDurationSeconds || 0),
    hungUpBy: null,
    notes: null,
    createdAt: row.createdAt,
    isImportant: false,
    isForwarded: hasForwardedCallEvidence({
      inboundStatus: row.status, inboundTransferredTo: row.transferredTo,
      inboundMetadata: row.metadata,
    }),
    inboundQueueId: row.queueId,
    inboundQueueName: labels.queueName,
    customerName: labels.customerName,
    campaignName: campaignId ? labels.campaignName : null,
    hasRecording: false,
    recording: null,
    isMobile: false,
    mobileAgentName: null,
    mobileOutboundCallerId: null,
    dispositionCode: null,
    dispositionName: null,
    dispositionSubstatuses: [],
    contactType: null,
    entityName: null,
  };
}
