import type { StandingRecordingAuthorization } from "./queue-call-lifecycle";

/** Late start/stop responses cannot regress a claim, saved file, or terminal failure. */
export function allowedStandingRecordingStates(next: StandingRecordingAuthorization["state"], ownsClaim = false): string[] {
  switch (next) {
    case "recording": return ["starting"];
    case "stop_requested": return ["starting", "recording", ...(ownsClaim ? ["saving"] : [])];
    case "failed": return ["starting", "recording", "stop_requested", "saving"];
    case "saved": return ["saving"];
    default: return [];
  }
}

export function isCurrentCallerBridgeExit(
  current: { bridgeId: string; callerChannelId: string } | undefined,
  channelId: string | undefined,
  eventBridgeId: string | undefined,
): boolean {
  return !!current && current.callerChannelId === channelId && current.bridgeId === eventBridgeId;
}
