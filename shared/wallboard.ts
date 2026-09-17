export type WallboardAgentState =
  | "calling"
  | "ringing"
  | "working"
  | "available"
  | "break"
  | "offline";

export interface WallboardSnapshot {
  generatedAt: string;
  scope: {
    campaignId: string | null;
    campaignName: string | null;
  };
  campaigns: Array<{ id: string; name: string }>;
  agents: Array<{
    id: string;
    name: string;
    campaignIds: string[];
    campaignNames: string[];
    state: WallboardAgentState;
    stateSince: string | null;
    direction: "inbound" | "outbound" | null;
    connected: boolean;
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