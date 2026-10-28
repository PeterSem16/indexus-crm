import type { MissionCallRecordingSnapshot } from "@shared/mission-recording";
import type { StandingRecordingAuthorization } from "./queue-call-lifecycle";

export interface StandingAnalysisPublication {
  recording: {
    id: string; callLogId: string; campaignId: string | null;
    filename: string; filePath: string; analysisStatus: string | null;
    recordingMode: string | null; recordingPolicySnapshot: unknown;
  };
  call: {
    id: string; inboundCallLogId: string | null; campaignId: string | null;
    status: string; isForwarded: boolean | null;
  };
  inbound: { id: string; callLogId: string | null; metadata: unknown };
}

/** Published audio is authorized by its saved evidence, never today's settings
 * or the current PBX connection. This cannot create/recover a recording. */
export function canAnalyzeStandingRecording(row: StandingAnalysisPublication): boolean {
  const { recording, call, inbound } = row;
  const metadata = inbound.metadata as { standingForward?: boolean; standingForwardRecording?: StandingRecordingAuthorization } | null;
  const proof = metadata?.standingForwardRecording;
  const snapshot = recording.recordingPolicySnapshot as MissionCallRecordingSnapshot | null;
  if (call.status !== "completed" || call.isForwarded !== true ||
      call.inboundCallLogId !== inbound.id || inbound.callLogId !== call.id ||
      recording.callLogId !== call.id || recording.id !== `standing_${call.id}` ||
      recording.campaignId !== call.campaignId || !recording.filePath ||
      recording.analysisStatus !== "pending" || metadata?.standingForward !== true ||
      proof?.authorized !== true || proof.state !== "saved" || proof.bridgeConnected === false ||
      proof.campaignId !== call.campaignId || !proof.pbxIdentity?.host || !proof.pbxIdentity.port ||
      (proof.inboundCallLogId != null && proof.inboundCallLogId !== inbound.id) ||
      !proof.recordingName || recording.filename !== `${proof.recordingName}.wav`) return false;
  const escapedId = call.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`^mobile_${escapedId}_standing_\\d+$`).test(proof.recordingName)) return false;
  const allowsMixed = (value: MissionCallRecordingSnapshot | null) =>
    value == null ? !call.campaignId : value.active === true && value.mode === "both";
  return recording.recordingMode !== "agent_only" &&
    allowsMixed(snapshot) && allowsMixed(proof.recordingPolicySnapshot);
}

export function createStandingAnalysisDispatcher(
  analyze: (id: string, filePath: string) => Promise<void>,
  failed: (id: string) => void,
) {
  const inFlight = new Set<string>();
  return async (row: StandingAnalysisPublication): Promise<void> => {
    if (!canAnalyzeStandingRecording(row) || inFlight.has(row.recording.id)) return;
    inFlight.add(row.recording.id);
    try { await analyze(row.recording.id, row.recording.filePath); }
    catch { failed(row.recording.id); }
    finally { inFlight.delete(row.recording.id); }
  };
}
