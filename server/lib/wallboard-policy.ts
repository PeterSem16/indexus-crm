import { canAgentReadCampaignByWorkspaceCountry } from "./agent-workspace-country-access";
import type { WallboardAgentState } from "@shared/wallboard";
import type { WallboardQueueCall } from "./wallboard-queue";

export interface WallboardCampaignAccessInput {
  role?: string | null;
  assignedCountries: readonly string[];
  workspaceCountries: readonly string[];
  campaignCountries: readonly string[] | null | undefined;
  isCampaignMember: boolean;
}

export function canReadWallboardCampaign(input: WallboardCampaignAccessInput): boolean {
  if (input.role === "admin") return true;
  const assigned = new Set(input.assignedCountries);
  const effective = input.assignedCountries.length > 0 && input.workspaceCountries.length > 0
    ? input.workspaceCountries.filter((country) => assigned.has(country))
    : input.workspaceCountries.length > 0
      ? Array.from(input.workspaceCountries)
      : Array.from(input.assignedCountries);
  if (input.assignedCountries.length > 0 && input.workspaceCountries.length > 0 && effective.length === 0) {
    return false;
  }
  if (effective.length > 0) {
    return canAgentReadCampaignByWorkspaceCountry({
      role: input.role,
      workspaceCountryCodes: effective,
      campaignCountryCodes: input.campaignCountries,
    });
  }
  return input.isCampaignMember;
}

export interface WallboardStateSignals {
  connected: boolean;
  inboundCallingSince?: string | null;
  inboundRingingSince?: string | null;
  outboundCallingSince?: string | null;
  outboundRingingSince?: string | null;
  breakSince?: string | null;
  workingSince?: string | null;
  availableSince?: string | null;
}

export function deriveWallboardAgentState(signals: WallboardStateSignals): {
  state: WallboardAgentState;
  stateSince: string | null;
  direction: "inbound" | "outbound" | null;
} {
  if (!signals.connected) return { state: "offline", stateSince: null, direction: null };
  if (signals.inboundCallingSince) return { state: "calling", stateSince: signals.inboundCallingSince, direction: "inbound" };
  if (signals.outboundCallingSince) return { state: "calling", stateSince: signals.outboundCallingSince, direction: "outbound" };
  if (signals.inboundRingingSince) return { state: "ringing", stateSince: signals.inboundRingingSince, direction: "inbound" };
  if (signals.outboundRingingSince) return { state: "ringing", stateSince: signals.outboundRingingSince, direction: "outbound" };
  if (signals.breakSince) return { state: "break", stateSince: signals.breakSince, direction: null };
  if (signals.workingSince) return { state: "working", stateSince: signals.workingSince, direction: null };
  return { state: "available", stateSince: signals.availableSince || null, direction: null };
}

export function selectAuthorizedWallboardQueueCalls(
  calls: readonly WallboardQueueCall[],
  visibleCampaignIds: ReadonlySet<string>,
  campaignId: string | null,
): WallboardQueueCall[] {
  return calls.filter((call) =>
    !!call.campaignId &&
    visibleCampaignIds.has(call.campaignId) &&
    (!campaignId || call.campaignId === campaignId),
  );
}

export function matchesWallboardPresence(
  presence: { sessionId: string; campaignId: string; working: boolean } | undefined,
  sessionId: string,
  sessionCampaignIds: readonly string[],
  visibleCampaignIds: ReadonlySet<string>,
): boolean {
  return !!presence &&
    presence.sessionId === sessionId &&
    visibleCampaignIds.has(presence.campaignId) &&
    sessionCampaignIds.includes(presence.campaignId);
}