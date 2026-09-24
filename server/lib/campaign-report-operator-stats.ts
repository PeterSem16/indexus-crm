export interface ReportSession {
  id: string;
  userId: string;
  status: string;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  totalWorkTime?: number | null;
  totalWrapUpTime?: number | null;
  contactsHandled?: number | null;
}

export interface ReportCall {
  id: string;
  userId: string;
  startedAt: Date | string | null;
  answeredAt: Date | string | null;
  endedAt: Date | string | null;
  status: string;
  metadata?: string | null;
  isForwarded?: boolean | null;
  durationSeconds?: number | null;
}

function parseCallMetadata(metadata: string | null | undefined): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Ring time is start-to-answer for answered calls and start-to-end for attempts
 * that never produced answer evidence. The per-call Mission limit is a trusted
 * call-time snapshot and prevents delayed cleanup from inflating either value.
 */
export function reportCallRingSeconds(call: ReportCall): number {
  if (!call.startedAt) return 0;
  const startedAt = new Date(call.startedAt).getTime();
  const ringEndedAtValue = call.answeredAt || call.endedAt;
  if (!ringEndedAtValue) return 0;
  const ringEndedAt = new Date(ringEndedAtValue).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(ringEndedAt)) return 0;

  let seconds = Math.max(0, Math.floor((ringEndedAt - startedAt) / 1000));
  const metadata = parseCallMetadata(call.metadata);
  const maxRingSeconds = Number(metadata.maxRingSeconds);
  if (Number.isFinite(maxRingSeconds) && maxRingSeconds > 0) {
    seconds = Math.min(seconds, Math.floor(maxRingSeconds));
  }
  return seconds;
}

export function reportGroupKey(value: Date | string, groupBy = "total"): string {
  const date = new Date(value);
  if (groupBy === "day") return date.toISOString().split("T")[0];
  if (groupBy === "week") {
    const monday = new Date(date);
    const day = monday.getDay();
    monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
    return `W${monday.toISOString().split("T")[0]}`;
  }
  if (groupBy === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return "total";
}

export function reportCallTalkSeconds(call: ReportCall): number {
  if (call.isForwarded) {
    // A forwarded attempt may be completed by hangup after ringing without
    // ever being answered. Only durable answer evidence proves talk time for
    // the forwarded leg.
    if (!call.answeredAt || !call.endedAt) return 0;
    const answeredAt = new Date(call.answeredAt).getTime();
    const endedAt = new Date(call.endedAt).getTime();
    if (!Number.isFinite(answeredAt) || !Number.isFinite(endedAt)) return 0;
    // CEL reconciliation computes this from the original microsecond
    // timestamps before PostgreSQL converts them to millisecond Date values.
    if (Number.isInteger(call.durationSeconds) && call.durationSeconds! >= 0) {
      return call.durationSeconds!;
    }
    // Legacy forwarded rows may predate canonical duration persistence.
    return Math.max(0, Math.floor((endedAt - answeredAt) / 1000));
  }

  // Preserve the historical completed-call fallback for non-forwarded calls:
  // older rows can lack answeredAt even though startedAt and endedAt bracket
  // the completed attempt.
  return legacyCompletedCallSeconds(call);
}

function legacyCompletedCallSeconds(call: ReportCall): number {
  const start = call.answeredAt || (call.status === "completed" ? call.startedAt : null);
  if (!start || !call.endedAt) return 0;
  const startedAt = new Date(start).getTime();
  const endedAt = new Date(call.endedAt).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0;
  return Math.max(0, Math.round((endedAt - startedAt) / 1000));
}

/**
 * Duration shown by recording analysis reports. A recording file's duration is
 * not proof that the forwarded external leg answered (it can contain ringing
 * or queue audio), so forwarded calls always use canonical answer evidence.
 * Preserve the legacy recording preference for unrelated call types.
 */
export function reportCallAnalysisSeconds(
  call: ReportCall,
  recordingDurationSeconds?: number | null,
): number {
  if (call.isForwarded) return reportCallTalkSeconds(call);
  return recordingDurationSeconds || legacyCompletedCallSeconds(call);
}

/**
 * Call-list talk time follows verified answer evidence for forwarded calls,
 * while retaining the historical completed-call fallback for other call types.
 */
export function reportCallListTalkSeconds(call: ReportCall): number {
  return call.isForwarded ? reportCallTalkSeconds(call) : legacyCompletedCallSeconds(call);
}

function canonicalCallEvidenceRank(call: ReportCall): number {
  const hasStartedAt = !!call.startedAt && Number.isFinite(new Date(call.startedAt).getTime());
  const hasAnsweredAt = !!call.answeredAt && Number.isFinite(new Date(call.answeredAt).getTime());
  const hasEndedAt = !!call.endedAt && Number.isFinite(new Date(call.endedAt).getTime());
  const isTerminal = ["completed", "failed", "no_answer", "busy", "cancelled"].includes(call.status);
  return (hasStartedAt ? 1 : 0)
    + (hasAnsweredAt ? 4 : 0)
    + (hasEndedAt ? 2 : 0)
    + (isTerminal ? 1 : 0);
}

/**
 * A canonical call can be observed more than once while its durable row is
 * updated (for example before and after a worker restart). Select one complete
 * observation instead of combining timestamps from different observations;
 * combining them could invent a longer call or move it to another period.
 */
function canonicalReportCalls(calls: ReportCall[]): ReportCall[] {
  const byId = new Map<string, ReportCall>();
  for (const call of calls) {
    const current = byId.get(call.id);
    if (!current || canonicalCallEvidenceRank(call) > canonicalCallEvidenceRank(current)) {
      byId.set(call.id, call);
    }
  }
  return [...byId.values()];
}

export function callHandledContactIncrement(
  call: ReportCall,
  sessions: ReportSession[],
  claimedBySession: Map<string, number>,
): 0 | 1 {
  if (!call.startedAt) return 0;
  const at = new Date(call.startedAt).getTime();
  const matching = sessions
    .filter(session => session.userId === call.userId && session.startedAt
      && at >= new Date(session.startedAt).getTime()
      && at <= (session.endedAt ? new Date(session.endedAt).getTime() : Date.now()))
    .sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime())[0];
  if (!matching) return 1;
  const claimed = (claimedBySession.get(matching.id) || 0) + 1;
  claimedBySession.set(matching.id, claimed);
  return claimed > (matching.contactsHandled || 0) ? 1 : 0;
}

/**
 * Adds canonical Mission calls to already-created session rows. Calls are
 * grouped by their own timestamp, so a call outside a login window is not
 * hidden or attributed to a fabricated session. A call may update at most one
 * real session detail even when legacy session windows overlap.
 */
export function addCampaignCallsToOperatorStats(
  rows: Record<string, any>,
  calls: ReportCall[],
  sessions: ReportSession[],
  groupBy: string,
  createRow: (userId: string, period: string) => any,
): void {
  for (const call of canonicalReportCalls(calls)) {
    if (!call.startedAt) continue;
    const period = reportGroupKey(call.startedAt, groupBy);
    const key = `${call.userId}__${period}`;
    const row = rows[key] || (rows[key] = createRow(call.userId, period));
    const talkSeconds = reportCallTalkSeconds(call);
    row.totalCallTime += talkSeconds;
    row.callCount += 1;

    let metadata: Record<string, any> = {};
    try { metadata = call.metadata ? JSON.parse(call.metadata) : {}; } catch {}
    if (typeof metadata.dispositionDurationSeconds === "number") {
      row.totalDispositionTime += metadata.dispositionDurationSeconds;
      row.dispositionCount += 1;
    }
    if (typeof metadata.dispositionFormDurationSeconds === "number") {
      row.totalFormDispositionTime += metadata.dispositionFormDurationSeconds;
      row.formDispositionCount += 1;
    }

    const at = new Date(call.startedAt).getTime();
    const matching = sessions
      .filter(session => session.userId === call.userId && session.startedAt
        && at >= new Date(session.startedAt).getTime()
        && at <= (session.endedAt ? new Date(session.endedAt).getTime() : Date.now()))
      .sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime())[0];
    if (!matching) {
      row.contactsHandled += 1;
      continue;
    }
    const detail = row.sessionDetails?.find((item: any) => item.sessionId === matching.id);
    if (detail) {
      const previousHandled = detail.contactsHandled;
      detail.callTime += talkSeconds;
      detail.callCount += 1;
      // Session contactsHandled is incremented by disposition activity. Use it
      // as the floor rather than adding every call again.
      detail.contactsHandled = Math.max(
        previousHandled,
        detail.callCount + detail.emailCount + detail.smsCount,
      );
      row.contactsHandled += detail.contactsHandled - previousHandled;
    } else {
      row.contactsHandled += 1;
    }
  }
}