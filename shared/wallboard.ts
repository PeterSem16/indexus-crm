import type { WallboardCallActivity } from "./wallboard-alarms";

export type WallboardAgentState =
  | "calling"
  | "ringing"
  | "working"
  | "available"
  | "break"
  | "offline";

export interface WallboardSnapshot {
  generatedAt: string;
  callActivity: WallboardCallActivity;
  scope: {
    campaignId: string | null;
    campaignName: string | null;
  };
  campaigns: Array<{ id: string; name: string }>;
  agents: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    campaignIds: string[];
    campaignNames: string[];
    state: WallboardAgentState;
    stateSince: string | null;
    direction: "inbound" | "outbound" | null;
    connected: boolean;
    /** The authoritative current scoped open session, but only while connected. */
    sessionStartedAt: string | null;
    /** End of the latest scoped ended session, or abandonment checkpoint. */
    lastMissionAt: string | null;
    /** Union of scoped session intervals clipped to the Bratislava calendar day. */
    todayMissionSeconds: number;
    /** True only for a connected, current scoped open session. */
    todayAccruing: boolean;
  }>;
  inbound: Array<{
    id: string;
    campaignId: string | null;
    queueName: string;
    agentName: string | null;
    status: "waiting" | "ringing" | "talking";
    since: string;
    callerLabel: string | null;
  }>;
  queue: {
    waiting: number;
    longestWaitSeconds: number;
    answeredToday: number | null;
    averageWaitSeconds: number | null;
  };
  source: {
    live: boolean;
    warning: string | null;
  };
}