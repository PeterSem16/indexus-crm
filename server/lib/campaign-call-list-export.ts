export interface CampaignCallListReportEvent {
  type: string;
  agent?: string | null;
  customer?: string | null;
  phoneNumber?: string | null;
  direction?: string | null;
  status?: string | null;
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  ringTimeFormatted?: string | null;
  talkTimeFormatted?: string | null;
  totalDurationFormatted?: string | null;
  disposition?: string | null;
  dispositionName?: string | null;
  hungUpBy?: string | null;
  notes?: string | null;
  isForwarded?: boolean;
}

const cell = (value: string | null | undefined): string => value || "";

/**
 * Keep CSV/XLSX and emailed call-list rows as a projection of the exact event
 * set shown by Full Call List, rather than rebuilding its call-log query.
 */
export function campaignCallListEventsToExportRows(
  events: CampaignCallListReportEvent[],
): Record<string, string>[] {
  return events.filter(event => event.type === "call").map(event => ({
    Agent: cell(event.agent),
    Customer: cell(event.customer),
    "Phone Number": cell(event.phoneNumber),
    Direction: cell(event.direction),
    Status: cell(event.status),
    "Started At": cell(event.startedAt),
    "Answered At": cell(event.answeredAt),
    "Ended At": cell(event.endedAt),
    "Ring Time": cell(event.ringTimeFormatted),
    "Talk Time": cell(event.talkTimeFormatted),
    "Total Duration": cell(event.totalDurationFormatted),
    Disposition: cell(event.dispositionName) || cell(event.disposition),
    Forwarded: event.isForwarded ? "Yes" : "No",
    "Hung Up By": cell(event.hungUpBy),
    Notes: cell(event.notes),
  }));
}