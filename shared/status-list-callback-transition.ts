export type CallbackOwner = "legacy" | "compatible";
export type CallbackTransitionReadiness = {
  campaignId: string;
  missionName: string;
  fingerprint: string;
  capturedAt: string;
  owner: CallbackOwner;
  supported: boolean;
  ready: boolean;
  blockers: string[];
  callbackCount: number;
  pendingCount: number;
  failedCount: number;
  legacyOnlyCount: number;
  audit: { at: string; from: string; to: string; actorName: string | null }[];
};
