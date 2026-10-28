import { and, asc, eq, sql } from "drizzle-orm";
import { callLogs, callRecordings, inboundCallLogs } from "@shared/schema";
import { db } from "../db";
import { createStandingAnalysisDispatcher } from "./standing-recording-analysis-policy";

let dispatch: ReturnType<typeof createStandingAnalysisDispatcher> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let scanning = false;

/** Called only after the shared analysis pipeline is ready. Polling is
 * independent of ARI/CEL, so already-published audio survives a CRM restart. */
export function setStandingRecordingAnalyzer(analyze: (id: string, filePath: string) => Promise<void>): void {
  if (dispatch) return;
  dispatch = createStandingAnalysisDispatcher(analyze, () =>
    console.error("[StandingRecordingAnalysis] Published audio analysis failed; call history unchanged"));
  timer = setInterval(() => { void dispatchPendingStandingAnalyses(); }, 30_000);
  timer.unref();
  void dispatchPendingStandingAnalyses();
}

export async function dispatchPendingStandingAnalyses(callLogId?: string): Promise<void> {
  const analyze = dispatch;
  if (!analyze || !process.env.OPENAI_API_KEY || (!callLogId && scanning)) return;
  if (!callLogId) scanning = true;
  try {
    const rows = await db.select({
      recording: {
        id: callRecordings.id, callLogId: callRecordings.callLogId,
        campaignId: callRecordings.campaignId, filename: callRecordings.filename,
        filePath: callRecordings.filePath, analysisStatus: callRecordings.analysisStatus,
        recordingMode: callRecordings.recordingMode, recordingPolicySnapshot: callRecordings.recordingPolicySnapshot,
      },
      call: {
        id: callLogs.id, inboundCallLogId: callLogs.inboundCallLogId,
        campaignId: callLogs.campaignId, status: callLogs.status, isForwarded: callLogs.isForwarded,
      },
      inbound: { id: inboundCallLogs.id, callLogId: inboundCallLogs.callLogId, metadata: inboundCallLogs.metadata },
    }).from(callRecordings)
      .innerJoin(callLogs, eq(callRecordings.callLogId, callLogs.id))
      .innerJoin(inboundCallLogs, and(
        eq(inboundCallLogs.id, callLogs.inboundCallLogId),
        eq(inboundCallLogs.callLogId, callLogs.id),
      )).where(and(
        eq(callRecordings.id, sql`'standing_' || ${callLogs.id}`),
        eq(callRecordings.analysisStatus, "pending"),
        eq(callLogs.status, "completed"), eq(callLogs.isForwarded, true),
        sql`${inboundCallLogs.metadata} ->> 'standingForward' = 'true'`,
        sql`${inboundCallLogs.metadata} -> 'standingForwardRecording' ->> 'authorized' = 'true'`,
        sql`${inboundCallLogs.metadata} -> 'standingForwardRecording' ->> 'state' = 'saved'`,
        callLogId ? eq(callLogs.id, callLogId) : undefined,
      )).orderBy(asc(callRecordings.createdAt)).limit(25);
    // Keep recovery bounded to two concurrent AI requests. Immediate publication
    // and the recovery sweep share the same per-recording dispatcher.
    let next = 0;
    await Promise.all([0, 1].map(async () => {
      while (next < rows.length) await analyze(rows[next++]);
    }));
  } catch {
    console.error("[StandingRecordingAnalysis] Pending scan unavailable; published audio retained");
  } finally {
    if (!callLogId) scanning = false;
  }
}
