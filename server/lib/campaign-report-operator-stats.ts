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
  const start = call.answeredAt || (call.status === "completed" ? call.startedAt : null);
  if (!start || !call.endedAt) return 0;
  return Math.max(0, Math.round((new Date(call.endedAt).getTime() - new Date(start).getTime()) / 1000));
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
  const claimed = new Set<string>();
  for (const call of calls) {
    if (!call.startedAt || claimed.has(call.id)) continue;
    claimed.add(call.id);
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