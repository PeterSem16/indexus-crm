import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import { callLogs, inboundCallLogs } from "@shared/schema";

export interface StandingRecordingPbxIdentity {
  host: string;
  port: number;
}

export interface StandingRecordingRecoveryCandidate {
  callLogId: string;
  inboundCallLogId: string;
  metadata: unknown;
  endedAt: Date | null;
  status: string;
}

/** Select retryable rows before the page limit, so saved calls cannot starve older failures. */
export async function loadStandingRecordingRecoveryCandidates(
  connection: Pick<typeof db, "select"> = db,
): Promise<StandingRecordingRecoveryCandidate[]> {
  return connection.select({
    callLogId: callLogs.id,
    inboundCallLogId: inboundCallLogs.id,
    metadata: inboundCallLogs.metadata,
    endedAt: callLogs.endedAt,
    status: callLogs.status,
  }).from(callLogs).innerJoin(inboundCallLogs, and(
    eq(inboundCallLogs.id, callLogs.inboundCallLogId),
    eq(inboundCallLogs.callLogId, callLogs.id),
  )).where(and(
    eq(callLogs.isForwarded, true),
    eq(callLogs.status, "completed"),
    isNotNull(callLogs.endedAt),
    sql`${callLogs.endedAt} > NOW() - INTERVAL '7 days'`,
    sql`${inboundCallLogs.metadata} -> 'standingForwardRecording' ->> 'authorized' = 'true'`,
    sql`${inboundCallLogs.metadata} -> 'standingForwardRecording' ->> 'state' IN ('starting', 'recording', 'stop_requested', 'saving')`,
    sql`COALESCE(NULLIF(${inboundCallLogs.metadata} -> 'standingForwardRecording' ->> 'claimUntil', '')::timestamptz, '-infinity'::timestamptz) <= NOW()`,
    sql`COALESCE(NULLIF(${inboundCallLogs.metadata} -> 'standingForwardRecording' ->> 'nextRecoveryAt', '')::timestamptz, '-infinity'::timestamptz) <= NOW()`,
  )).orderBy(desc(callLogs.endedAt)).limit(500);
}

/** Atomic cross-worker claim; only one saver may own an unclaimed or expired lease. */
export async function claimStandingRecordingForSave(input: {
  inboundCallLogId: string;
  callLogId: string;
  recordingName: string;
  pbxIdentity: StandingRecordingPbxIdentity;
  claimToken: string;
  recoveryAttempts: number;
  nextRecoveryAt: string;
  claimUntil: string;
  recovery: boolean;
}, connection: Pick<typeof db, "update"> = db): Promise<boolean> {
  const base = sql`COALESCE(${inboundCallLogs.metadata}, '{}'::jsonb)`;
  const nested = sql`COALESCE(${base} -> 'standingForwardRecording', '{}'::jsonb)`;
  const due = input.recovery
    ? sql`COALESCE(NULLIF(${nested} ->> 'nextRecoveryAt', '')::timestamptz, '-infinity'::timestamptz) <= NOW()`
    : sql`TRUE`;
  const retryable = sql`(
    ${nested} ->> 'state' IN ('starting', 'recording', 'stop_requested')
    OR (
      ${nested} ->> 'state' = 'saving'
      AND COALESCE(NULLIF(${nested} ->> 'claimUntil', '')::timestamptz, '-infinity'::timestamptz) <= NOW()
    )
  )`;
  const patch = JSON.stringify({
    state: "saving",
    claimToken: input.claimToken,
    claimUntil: input.claimUntil,
    recoveryAttempts: input.recoveryAttempts,
    nextRecoveryAt: input.nextRecoveryAt,
  });
  const [claimed] = await connection.update(inboundCallLogs).set({
    metadata: sql`(${base} || jsonb_build_object(
      'standingForwardRecording',
      ${nested} || ${patch}::jsonb
    ))`,
  }).where(and(
    eq(inboundCallLogs.id, input.inboundCallLogId),
    eq(inboundCallLogs.callLogId, input.callLogId),
    sql`${base} ->> 'standingForward' = 'true'`,
    sql`${nested} ->> 'authorized' = 'true'`,
    sql`${nested} ->> 'recordingName' = ${input.recordingName}`,
    sql`${nested} -> 'pbxIdentity' ->> 'host' = ${input.pbxIdentity.host}`,
    sql`${nested} -> 'pbxIdentity' ->> 'port' = ${String(input.pbxIdentity.port)}`,
    retryable,
    due,
  )).returning({ id: inboundCallLogs.id });
  return !!claimed;
}