export interface InboundQueueMissionResolution {
  campaignId: string | null;
  conflict: boolean;
}

/**
 * Mission attribution is frozen from trusted call-time evidence only. A queue
 * campaign is a safe fallback when the PBX variable is absent, but disagreement
 * between both trusted sources must fail closed rather than pick one.
 */
export function resolveInboundQueueMission(input: {
  queueCampaignId: string | null | undefined;
  channelCampaignId: string | null | undefined;
}): InboundQueueMissionResolution {
  const queueCampaignId = input.queueCampaignId?.trim() || null;
  const channelCampaignId = input.channelCampaignId?.trim() || null;
  if (queueCampaignId && channelCampaignId && queueCampaignId !== channelCampaignId) {
    return { campaignId: null, conflict: true };
  }
  return { campaignId: channelCampaignId || queueCampaignId, conflict: false };
}

export interface InboundQueueOverflowMissionResolution extends InboundQueueMissionResolution {
  unverified: boolean;
}

/**
 * Queue overflow is still the original inbound call. Preserve its source
 * Mission for audit/reporting; a newly selected queue may not silently rewrite
 * that identity or authorize recording under a different Mission's policy.
 */
export function resolveInboundQueueOverflowMission(input: {
  sourceCampaignId: string | null | undefined;
  sourceConflict?: boolean;
  sourceUnverified?: boolean;
  targetQueueCampaignId: string | null | undefined;
  channelCampaignId?: string | null;
  targetClassificationVerified: boolean;
}): InboundQueueOverflowMissionResolution {
  const sourceCampaignId = input.sourceCampaignId?.trim() || null;

  // Never "heal" an unknown or conflicted source from the later overflow
  // lookup: that would replace call-time evidence with routing-time evidence.
  if (input.sourceConflict || input.sourceUnverified || !input.targetClassificationVerified) {
    return {
      campaignId: sourceCampaignId,
      conflict: !!input.sourceConflict,
      unverified: !!input.sourceUnverified || !input.targetClassificationVerified,
    };
  }

  const target = resolveInboundQueueMission({
    queueCampaignId: input.targetQueueCampaignId,
    channelCampaignId: input.channelCampaignId,
  });

  if (target.conflict ||
      (sourceCampaignId && target.campaignId && sourceCampaignId !== target.campaignId)) {
    return {
      campaignId: sourceCampaignId,
      conflict: true,
      unverified: false,
    };
  }

  return {
    campaignId: sourceCampaignId || target.campaignId,
    conflict: false,
    unverified: false,
  };
}