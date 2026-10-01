/**
 * Set only by the authenticated manual Nexus Pulse task-creation path after it
 * validates the agent's active Mission session. Generic task POST tags are
 * never trusted to establish this provenance.
 */
export const MANUAL_PULSE_TASK_TAG = "nexus_pulse_manual";

export interface ManualPulseTaskOriginRequest {
  missionId: string;
  sessionId: string;
}

export interface ActivePulseTaskSession {
  id: string;
  userId: string;
  campaignId?: string | null;
  campaignIds?: readonly string[] | null;
  endedAt?: Date | string | null;
}

/**
 * A client-supplied Mission/session pair is only evidence when it matches the
 * signed-in user's live session and current server-authorized Mission scope.
 */
export function isAuthorizedManualPulseTaskOrigin(
  actorUserId: string,
  requested: ManualPulseTaskOriginRequest,
  activeSession: ActivePulseTaskSession | null | undefined,
  authorizedMissionIds: readonly string[],
): boolean {
  if (!activeSession || activeSession.userId !== actorUserId || activeSession.id !== requested.sessionId || activeSession.endedAt) {
    return false;
  }
  const activeMissionIds = new Set([
    activeSession.campaignId,
    ...(activeSession.campaignIds || []),
  ].filter((id): id is string => typeof id === "string" && id.length > 0));
  return activeMissionIds.has(requested.missionId) && authorizedMissionIds.includes(requested.missionId);
}