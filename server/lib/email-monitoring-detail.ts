import { emailMonitoringFields, emailMonitoringSchema } from "./ai/email-monitoring-contract";
import type { EmailMonitoringDetail } from "../../shared/email-monitoring-detail";

export interface MonitoringDetailScope {
  userId: string;
  externalId: string;
  mailbox: string;
  personalMailbox: string;
}
export function resolveEmailMonitoringDetail(
  rows: Record<string, any>[], scope: MonitoringDetailScope,
): EmailMonitoringDetail | null {
  if (!scope.userId || !scope.externalId || !scope.mailbox || !scope.personalMailbox)
    throw Error("email_monitoring_scope_required");
  if (rows.length > 100) throw Error("email_monitoring_identity_ambiguous");
  const mailbox = scope.mailbox.trim().toLowerCase();
  const personal = mailbox === scope.personalMailbox.trim().toLowerCase();
  const matching: { row: Record<string, any>; metadata: Record<string, any> }[] = [];
  for (const row of rows) {
    if (row.externalId !== scope.externalId || row.type !== "email" ||
        row.direction !== "inbound" || row.aiAnalyzed !== true) continue;
    let metadata: any;
    try { metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata; }
    catch { continue; }
    const source = metadata?.mailboxSource;
    const owned = (personal && source?.kind === "personal" && source.ownerUserId === scope.userId) ||
      (source?.kind === "system" && typeof source.mailboxEmail === "string" &&
        source.mailboxEmail.trim().toLowerCase() === mailbox);
    if (owned && metadata?.emailMonitoringAnalysis !== undefined) matching.push({ row, metadata });
  }
  if (matching.length > 1) throw Error("email_monitoring_identity_ambiguous");
  if (!matching.length) return null;
  const { row, metadata } = matching[0];
  const parsed = emailMonitoringSchema.safeParse(metadata.emailMonitoringAnalysis);
  if (!parsed.success) throw Error("email_monitoring_saved_analysis_invalid");
  const expected = emailMonitoringFields(parsed.data);
  for (const [key, value] of Object.entries(expected)) {
    if (key !== "aiAnalyzedAt" && row[key] !== value)
      throw Error("email_monitoring_saved_analysis_inconsistent");
  }
  const date = row.aiAnalyzedAt ? new Date(row.aiAnalyzedAt) : null;
  return { source: "email.monitoring", analysis: parsed.data,
    analyzedAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null };
}
