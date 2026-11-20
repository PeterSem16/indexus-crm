export type AIMaintenanceAction = "pause" | "resume" | "takeover";
export interface AIMaintenanceCommand {
  action: AIMaintenanceAction;
  expectedVersion: number;
  operationId: string | null;
  confirm: true;
}
export interface AIMaintenanceView {
  mode: "running" | "paused";
  version: number;
  operationId: string | null;
  ownedByMe: boolean;
  changedAt: string;
  workers: { alive: number; confirmed: number; unsupported: number };
  queues: {
    jobs: { pending: number; processing: number };
    inference: { pending: number; processing: number };
  };
  // A queue/heartbeat observation is never evidence that remote work finished.
  gatewayDrain: "unverified";
  backendDrain: "unverified";
  audit: { id: string; action: AIMaintenanceAction; version: number; at: string }[];
}
