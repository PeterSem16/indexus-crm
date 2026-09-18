export interface CompletedCanonicalCallValuesInput {
  answeredAt: Date | null;
  endedAt: Date;
}

export function canonicalCampaignId(
  queuedCampaignId: string | null | undefined,
  channelCampaignId: string | null | undefined,
): string | null {
  return queuedCampaignId || channelCampaignId || null;
}

export function standingForwardUserId(agentId: string): string {
  if (!agentId.startsWith("standing:") || agentId.length === "standing:".length) {
    throw new Error(`invalid standing-forward agent id: ${agentId}`);
  }
  return agentId.slice("standing:".length);
}

export function standingMixedRecordingAllowed(input: {
  recordCalls: boolean;
  campaignId: string | null;
  missionMode: "both" | "agent_only" | null;
}): boolean {
  return input.recordCalls && (!input.campaignId || input.missionMode === "both");
}

export interface CanonicalLifecycleState {
  status: "answered" | "completed" | "forwarded";
  answeredAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number;
}

export function finalizeCanonicalLifecycle(
  state: CanonicalLifecycleState,
  endedAt: Date,
): { state: CanonicalLifecycleState; finalized: boolean } {
  if (state.status !== "answered" || !state.answeredAt) {
    return { state, finalized: false };
  }
  return {
    finalized: true,
    state: { ...state, ...completedCanonicalCallValues({ answeredAt: state.answeredAt, endedAt }) },
  };
}

/**
 * Produces conservative canonical completion values. Duration is talk time,
 * therefore it is only derived from an observed answer timestamp.
 */
export function completedCanonicalCallValues(input: CompletedCanonicalCallValuesInput): {
  status: "completed" | "forwarded";
  endedAt: Date;
  durationSeconds: number;
  answeredAt?: Date;
} {
  return {
    status: input.answeredAt ? "completed" : "forwarded",
    endedAt: input.endedAt,
    durationSeconds: input.answeredAt
      ? Math.max(0, Math.floor((input.endedAt.getTime() - input.answeredAt.getTime()) / 1000))
      : 0,
    ...(input.answeredAt ? { answeredAt: input.answeredAt } : {}),
  };
}