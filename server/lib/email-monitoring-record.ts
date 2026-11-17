import { z } from "zod";
import { emailMonitoringSchema, type EmailMonitoringAnalysis } from "./ai/email-monitoring-contract";
import type { EmailMonitoringDetail } from "../../shared/email-monitoring-detail";

export interface EmailMonitoringScope {
  externalId: string;
  mailbox: string;
  kind: "personal" | "system";
  ownerUserId: string | null;
}
const snapshotSchema = z.object({
  source: z.literal("email.monitoring"),
  mailbox: z.string().min(1),
  kind: z.enum(["personal", "system"]),
  ownerUserId: z.string().min(1).nullable(),
  analyzedAt: z.string().datetime(),
  analysis: emailMonitoringSchema,
}).strict();
export function monitoringScope(scope: EmailMonitoringScope): EmailMonitoringScope {
  const mailbox = scope.mailbox?.trim().toLowerCase();
  if (!scope.externalId || !mailbox || !["personal", "system"].includes(scope.kind) ||
      (scope.kind === "personal" ? !scope.ownerUserId : scope.ownerUserId !== null))
    throw Error("email_monitoring_scope_required");
  return { ...scope, mailbox };
}
export function monitoringSnapshot(scope: EmailMonitoringScope, analysis: EmailMonitoringAnalysis, now = new Date()) {
  const value = monitoringScope(scope);
  return snapshotSchema.parse({ source: "email.monitoring", mailbox: value.mailbox, kind: value.kind,
    ownerUserId: value.ownerUserId, analyzedAt: now.toISOString(), analysis });
}
export function readMonitoringSnapshot(value: unknown, scope: EmailMonitoringScope): EmailMonitoringDetail | null {
  const expected = monitoringScope(scope);
  if (value == null) return null;
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success) throw Error("email_monitoring_saved_analysis_invalid");
  const saved = parsed.data;
  if (saved.mailbox !== expected.mailbox || saved.kind !== expected.kind ||
      saved.ownerUserId !== expected.ownerUserId) return null;
  return { source: saved.source, analyzedAt: saved.analyzedAt, analysis: saved.analysis };
}

interface Repository {
  read(scope: EmailMonitoringScope): Promise<EmailMonitoringDetail | null>;
  save(scope: EmailMonitoringScope, analysis: EmailMonitoringAnalysis):
    Promise<{ detail: EmailMonitoringDetail; created: boolean }>;
}
/** Does not need a CRM contact, write CRM history, or change provider routing. */
export function createEmailMonitoringRecorder(repository: Repository) {
  const running = new Map<string, Promise<{ detail: EmailMonitoringDetail; created: boolean }>>();
  // A transient save failure must not silently discard the successful model answer.
  const pending = new Map<string, { value: EmailMonitoringAnalysis; time: number }>();
  return {
    async obtain(rawScope: EmailMonitoringScope, analyze: () => Promise<EmailMonitoringAnalysis>) {
      const scope = monitoringScope(rawScope), key = JSON.stringify(scope);
      const active = running.get(key);
      if (active) return active;
      const job = (async () => {
        const saved = await repository.read(scope);
        if (saved) { pending.delete(key); return { detail: saved, created: false }; }
        const now = Date.now();
        for (const [k, entry] of pending) if (now - entry.time > 86400000) pending.delete(k);
        let answer = pending.get(key)?.value;
        if (!answer) {
          // Do not evict unsaved answers or issue another inference when capacity is exhausted.
          if (pending.size >= 500) throw Error("email_monitoring_pending_capacity");
          answer = emailMonitoringSchema.parse(await analyze());
          pending.set(key, { value: answer, time: now });
        }
        const result = await repository.save(scope, answer);
        pending.delete(key);
        return result;
      })();
      running.set(key, job);
      try { return await job; } finally { if (running.get(key) === job) running.delete(key); }
    },
  };
}
