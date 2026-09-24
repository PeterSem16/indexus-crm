export interface MissionCallListInboundSnapshot {
  campaignId: string | null;
  callLogId: string | null;
  inboundCallLogId: string | null;
  startedAt: Date | string | null;
  assignedAgentId: string | null;
  status: string;
  metadata: unknown;
}

export interface MissionCallListFilters {
  campaignId: string;
  direction?: string;
  status?: string;
  agentId?: string;
  dateFrom?: Date | null;
  dateToExclusive?: Date | null;
}

function metadataObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function hasMissionCallListSnapshot(metadata: unknown, campaignId: string): boolean {
  return metadataObject(metadata).campaignId === campaignId;
}

export function markRetryableQueueHandoffFailure(metadata: unknown): string {
  return JSON.stringify({
    ...metadataObject(metadata),
    retryableQueueHandoffFailure: true,
  });
}

export function isMissionCanonicalCall(input: {
  campaignId: string | null;
  campaignContactId: string | null;
  linkedInboundCampaignId?: string | null;
  linkedInboundExists?: boolean;
  campaignContactIds: ReadonlySet<string>;
  requestedCampaignId: string;
  metadata?: unknown;
}): boolean {
  if (metadataObject(input.metadata).retryableQueueHandoffFailure === true) return false;
  if (input.campaignId === input.requestedCampaignId) return true;
  if (input.campaignId !== null) return false;
  const linkedInboundExists = input.linkedInboundExists ?? input.linkedInboundCampaignId !== undefined;
  if (linkedInboundExists) {
    return input.linkedInboundCampaignId === input.requestedCampaignId;
  }
  return !!input.campaignContactId && input.campaignContactIds.has(input.campaignContactId);
}

/**
 * The inbound log itself is reportable only if its call-time Mission snapshot
 * matches exactly and no canonical call log already represents the same call.
 * Current queue/customer membership is deliberately not considered.
 */
export function isMissionInboundOnlyCall(input: {
  inbound: MissionCallListInboundSnapshot;
  canonicalCallLogIds: ReadonlySet<string>;
  filters: MissionCallListFilters;
}): boolean {
  const { inbound, canonicalCallLogIds, filters } = input;
  if (!hasMissionCallListSnapshot(inbound.metadata, filters.campaignId)) return false;
  if (inbound.callLogId || canonicalCallLogIds.has(inbound.inboundCallLogId || "")) return false;
  if (filters.direction && filters.direction !== "all" && filters.direction !== "inbound") return false;
  if (filters.status && filters.status !== "all" && inbound.status !== filters.status) return false;
  if (filters.agentId && filters.agentId !== "all" && inbound.assignedAgentId !== filters.agentId) return false;
  const startedAt = inbound.startedAt ? new Date(inbound.startedAt).getTime() : NaN;
  if (!Number.isFinite(startedAt)) return false;
  if (filters.dateFrom && startedAt < filters.dateFrom.getTime()) return false;
  if (filters.dateToExclusive && startedAt >= filters.dateToExclusive.getTime()) return false;
  return true;
}

export function hasForwardedCallEvidence(input: {
  isForwarded?: boolean | null;
  status?: string | null;
  metadata?: unknown;
  inboundStatus?: string | null;
  inboundTransferredTo?: string | null;
  inboundMetadata?: unknown;
}): boolean {
  if (input.isForwarded || input.status === "forwarded" || input.inboundStatus === "forwarded" ||
      !!input.inboundTransferredTo) return true;
  const metadata = metadataObject(input.metadata);
  const inboundMetadata = metadataObject(input.inboundMetadata);
  return metadata.standingForward === true || metadata.queueForwarded === true ||
    inboundMetadata.standingForward === true || inboundMetadata.queueForwarded === true;
}