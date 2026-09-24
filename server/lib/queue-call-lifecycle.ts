import type { MissionCallRecordingSnapshot } from "@shared/mission-recording";
import { markRetryableQueueHandoffFailure } from "./mission-call-list-scope";

export interface CompletedCanonicalCallValuesInput {
  answeredAt: Date | null;
  endedAt: Date;
}

export function canonicalCampaignId(
  queuedCampaignId: string | null | undefined,
  channelCampaignId: string | null | undefined,
): string | null {
  if (queuedCampaignId && channelCampaignId && queuedCampaignId !== channelCampaignId) {
    throw new Error("Inbound queue and PBX Mission IDs conflict");
  }
  return queuedCampaignId || channelCampaignId || null;
}

export function standingForwardUserId(agentId: string): string {
  if (!agentId.startsWith("standing:") || agentId.length === "standing:".length) {
    throw new Error(`invalid standing-forward agent id: ${agentId}`);
  }
  return agentId.slice("standing:".length);
}

export function inboundQueueForwardedRecordingAllowed(input: {
  recordCalls: boolean;
  campaignId: string | null;
  recordingPolicySnapshot: MissionCallRecordingSnapshot | null;
  classificationVerified?: boolean;
}): boolean {
  return input.classificationVerified !== false && input.recordCalls && (!input.campaignId ||
    !!input.recordingPolicySnapshot?.active && input.recordingPolicySnapshot.mode === "both");
}

export function failedQueueForwardHandoffReset(metadata: unknown, endedAt: Date) {
  return {
    callLog: {
      status: "failed",
      endedAt,
      durationSeconds: 0,
      inboundCallLogId: null,
      metadata: markRetryableQueueHandoffFailure(metadata),
    },
    inboundCall: {
      callLogId: null,
      status: "queued",
      transferredTo: null,
      assignedAgentId: null,
      answeredAt: null,
      completedAt: null,
      talkDurationSeconds: 0,
    },
  };
}

export interface StandingRecordingIdentity {
  host: string;
  port: number;
}

export interface StandingRecordingAuthorization {
  authorized: boolean;
  recordingName?: string;
  state: "off" | "starting" | "recording" | "stop_requested" | "saving" | "saved" | "failed";
  campaignId: string | null;
  recordingPolicySnapshot: MissionCallRecordingSnapshot | null;
  inboundCallLogId?: string;
  pbxIdentity?: StandingRecordingIdentity | null;
  recoveryAttempts?: number;
  nextRecoveryAt?: string | null;
  claimToken?: string | null;
  claimUntil?: string | null;
  savedAt?: string;
}

export function standingRecordingRecoveryDelayMs(recoveryAttempts: number): number {
  const attempts = Math.max(0, Math.floor(recoveryAttempts));
  return Math.min(5 * 60_000, 15_000 * (2 ** Math.min(attempts, 5)));
}

export function shouldRecoverStandingRecording(input: {
  callStatus: string;
  endedAt: Date | null;
  recordingState: string;
  now?: Date;
}): boolean {
  if (input.callStatus !== "completed" || !input.endedAt ||
      !["starting", "recording", "stop_requested", "saving"].includes(input.recordingState)) return false;
  const ageMs = (input.now || new Date()).getTime() - input.endedAt.getTime();
  return ageMs >= 0 && ageMs <= 7 * 24 * 60 * 60 * 1000;
}

export function canClaimStandingRecordingRecovery(input: {
  callStatus: string;
  endedAt: Date | null;
  authorization: StandingRecordingAuthorization;
  now?: Date;
}): boolean {
  const now = input.now || new Date();
  if (!input.authorization.authorized || !shouldRecoverStandingRecording({
    callStatus: input.callStatus,
    endedAt: input.endedAt,
    recordingState: input.authorization.state,
    now,
  })) return false;
  const claimUntil = input.authorization.claimUntil ? Date.parse(input.authorization.claimUntil) : 0;
  const nextRecoveryAt = input.authorization.nextRecoveryAt ? Date.parse(input.authorization.nextRecoveryAt) : 0;
  if (input.authorization.claimUntil && (!Number.isFinite(claimUntil) || claimUntil > now.getTime())) return false;
  if (input.authorization.nextRecoveryAt && (!Number.isFinite(nextRecoveryAt) || nextRecoveryAt > now.getTime())) return false;
  return true;
}

export function isTrustedStandingRecording(input: {
  callLogId: string;
  recordingName: string;
  standingForward: boolean;
  authorization: StandingRecordingAuthorization | null | undefined;
  currentPbxIdentity: StandingRecordingIdentity | null;
}): boolean {
  const { authorization } = input;
  if (!input.standingForward || !authorization?.authorized ||
      !["starting", "recording", "stop_requested", "saving"].includes(authorization.state) ||
      !authorization.recordingName || authorization.recordingName !== input.recordingName ||
      !new RegExp(`^mobile_${input.callLogId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_standing_\\d+$`).test(input.recordingName) ||
      !authorization.pbxIdentity || !input.currentPbxIdentity ||
      authorization.pbxIdentity.host.trim().toLowerCase() !== input.currentPbxIdentity.host.trim().toLowerCase() ||
      authorization.pbxIdentity.port !== input.currentPbxIdentity.port) {
    return false;
  }
  if (authorization.campaignId && !authorization.recordingPolicySnapshot) return false;
  if (authorization.recordingPolicySnapshot &&
      (!authorization.recordingPolicySnapshot.active || authorization.recordingPolicySnapshot.mode !== "both")) return false;
  return true;
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