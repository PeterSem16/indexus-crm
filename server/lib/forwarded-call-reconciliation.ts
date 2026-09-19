import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  ariSettings, callLogs, callRecordings, inboundCallLogs, queueForwardedCalls,
  type QueueForwardedCall,
} from "@shared/schema";
import { STORAGE_PATHS } from "../config/storage-paths";
import { downloadFileViaSsh } from "./ami-client";
import { readForwardedCelEvents, type ForwardedCelEvent, type ForwardedCelSshConfig } from "./forwarded-cel-source";
import { reconcileForwardedEvidence } from "./forwarded-call-evidence";

type ForwardedAnalysisPublication = {
  recordingId: string;
  filePath: string;
  handoff: Pick<QueueForwardedCall, "id" | "status" | "recordingState" | "recordingAuthorized" | "campaignId" | "recordingPolicySnapshot">;
};

/** Analyze only an already-published, snapshot-authorized recording. No insert,
 * download, or canonical lifecycle mutation is permitted in this dispatcher. */
export function createForwardedAnalysisDispatcher(
  analyze: (recordingId: string, filePath: string) => Promise<void>,
  failed: (recordingId: string) => void,
) {
  const inFlight = new Set<string>();
  return async ({ recordingId, filePath, handoff }: ForwardedAnalysisPublication): Promise<void> => {
    const snapshot = handoff.recordingPolicySnapshot;
    if (handoff.status !== "completed" || handoff.recordingState !== "saved" ||
        !handoff.recordingAuthorized || recordingId !== `qfwd_${handoff.id}` ||
        (handoff.campaignId && !snapshot) || (snapshot && (!snapshot.active || snapshot.mode !== "both")) ||
        inFlight.has(recordingId)) return;
    inFlight.add(recordingId);
    try { await analyze(recordingId, filePath); }
    catch { failed(recordingId); }
    finally { inFlight.delete(recordingId); }
  };
}

let dispatchForwardedAnalysis: ReturnType<typeof createForwardedAnalysisDispatcher> | null = null;
let analysisScanRunning = false;

/** Routes supplies the existing transcription/analysis pipeline after it is
 * configured. Keeping the dependency injected avoids importing routes here. */
export function setForwardedRecordingAnalyzer(
  analyze: (recordingId: string, filePath: string) => Promise<void>,
): void {
  dispatchForwardedAnalysis = createForwardedAnalysisDispatcher(analyze, recordingId => {
    console.error(`[QueueForwardedCEL] Published recording analysis failed for ${recordingId}; canonical history unchanged`);
  });
  // Recover already-published pending work on server startup, without requiring
  // a new call or successful PBX/ARI connection.
  void dispatchPendingForwardedAnalyses();
}

async function dispatchPendingForwardedAnalyses(): Promise<void> {
  const dispatch = dispatchForwardedAnalysis;
  if (!dispatch || !process.env.OPENAI_API_KEY || analysisScanRunning) return;
  analysisScanRunning = true;
  try {
    const publications = await db.select({
      handoff: queueForwardedCalls,
      recordingId: callRecordings.id,
      filePath: callRecordings.filePath,
    }).from(queueForwardedCalls).innerJoin(callRecordings, and(
      eq(callRecordings.id, sql`'qfwd_' || ${queueForwardedCalls.id}`),
      eq(callRecordings.callLogId, queueForwardedCalls.callLogId),
    )).where(and(
      eq(queueForwardedCalls.status, "completed"),
      eq(queueForwardedCalls.recordingState, "saved"),
      eq(queueForwardedCalls.recordingAuthorized, true),
      eq(callRecordings.analysisStatus, "pending"),
    )).limit(25);
    // Do not delay CEL reconciliation or other calls behind an AI request.
    // Durable pending rows are rediscovered after restart, even with CEL down.
    for (const publication of publications) void dispatch(publication);
  } catch {
    console.error("[QueueForwardedCEL] Pending analysis scan unavailable; publication and canonical history retained");
  } finally { analysisScanRunning = false; }
}

/**
 * Source is read once per sweep, not once per call. No live ARI/AMI state is
 * admissible. Incomplete calls (including provisional no-answer) stay durable
 * and replayable; no arbitrary polling timeout deletes their evidence.
 */
export async function runForwardedSweep<T>(deps: {
  pending(): Promise<T[]>;
  read(): Promise<ForwardedCelEvent[]>;
  reconcile(row: T, events: ForwardedCelEvent[]): Promise<void>;
  failed(row: T, error: unknown): Promise<void>;
}): Promise<void> {
  const rows = await deps.pending();
  if (!rows.length) return;
  let events: ForwardedCelEvent[];
  try { events = await deps.read(); }
  catch (error) {
    await Promise.all(rows.map(row => deps.failed(row, error)));
    return;
  }
  for (const row of rows) {
    try { await deps.reconcile(row, events); }
    catch (error) { await deps.failed(row, error); }
  }
}

async function freshSshSettings() {
  const [cfg] = await db.select().from(ariSettings).limit(1);
  if (!cfg?.host || !cfg.sshUsername || !cfg.sshPassword) {
    throw new Error("Forwarded CEL reconciliation requires configured SSH transport");
  }
  return {
    host: cfg.host, sshPort: cfg.sshPort || 22,
    sshUsername: cfg.sshUsername, sshPassword: cfg.sshPassword,
  };
}

class ForwardedPbxIdentityError extends Error {
  constructor() {
    super("Forwarded call PBX identity differs from configured CEL source; refusing reconciliation");
  }
}

export function assertForwardedPbxIdentity(
  row: { pbxHost: string | null; pbxSshPort: number | null },
  settings: Pick<ForwardedCelSshConfig, "host" | "sshPort">,
): void {
  // Unknown legacy identity is NOT backfilled from current configuration.
  // PBX-local uniqueids can collide after a server switch.
  if (!row.pbxHost || row.pbxSshPort === null ||
      row.pbxHost.trim().toLowerCase() !== settings.host.trim().toLowerCase() ||
      row.pbxSshPort !== settings.sshPort) {
    throw new ForwardedPbxIdentityError();
  }
}

export async function persistForwardedHandoff(
  values: typeof queueForwardedCalls.$inferInsert,
  connection: Pick<typeof db, "insert"> = db,
): Promise<void> {
  // A cancelled handoff may be retried on the same inbound root. Its new
  // transfer timestamp excludes old CEL evidence. Active handoffs cannot be
  // overwritten by duplicate delivery.
  const [row] = await connection.insert(queueForwardedCalls).values(values)
    .onConflictDoUpdate({
      target: queueForwardedCalls.rootUniqueId,
      set: { ...values, evidence: null, lastError: null, updatedAt: new Date() },
      setWhere: eq(queueForwardedCalls.status, "cancelled"),
    }).returning({ id: queueForwardedCalls.id });
  if (!row) throw new Error("A durable forwarding handoff already exists for this channel");
}

export async function cancelForwardedHandoff(rootUniqueId: string): Promise<void> {
  await db.update(queueForwardedCalls).set({
    status: "cancelled", recordingState: "off", updatedAt: new Date(),
  }).where(eq(queueForwardedCalls.rootUniqueId, rootUniqueId));
}

async function applyEvidence(id: string, events: ForwardedCelEvent[]): Promise<QueueForwardedCall | null> {
  return db.transaction(async tx => {
    const [row] = await tx.select().from(queueForwardedCalls)
      .where(eq(queueForwardedCalls.id, id)).for("update");
    if (!row || row.status === "cancelled") return null;
    const evidence = reconcileForwardedEvidence(row.rootUniqueId, row.transferredAt, row.evidence, events);
    const values = {
      status: evidence.status,
      // Preserve CEL's microseconds in PostgreSQL rather than round-tripping
      // through a JavaScript Date (which truncates to milliseconds).
      answeredAt: evidence.answeredAt ? sql`${evidence.answeredAt}::timestamptz AT TIME ZONE 'UTC'` : null,
      endedAt: evidence.endedAt ? sql`${evidence.endedAt}::timestamptz AT TIME ZONE 'UTC'` : null,
      durationSeconds: evidence.durationSeconds,
    };
    // Canonical and inbound logs are independent of recording authorization,
    // download availability, transcription, and current process lifetime.
    await tx.update(callLogs).set(values).where(eq(callLogs.id, row.callLogId));
    await tx.update(inboundCallLogs).set({
      status: evidence.status,
      answeredAt: values.answeredAt,
      completedAt: values.endedAt,
      talkDurationSeconds: values.durationSeconds,
    }).where(and(
      eq(inboundCallLogs.id, row.inboundCallLogId),
      eq(inboundCallLogs.callLogId, row.callLogId),
    ));
    const [updated] = await tx.update(queueForwardedCalls).set({
      evidence, status: evidence.status, lastError: null, updatedAt: new Date(),
    }).where(eq(queueForwardedCalls.id, row.id)).returning();
    return updated;
  });
}

async function saveVerifiedRecording(row: QueueForwardedCall): Promise<void> {
  if (row.status !== "completed" || !row.evidence?.answeredAt || !row.evidence?.endedAt ||
      !row.recordingAuthorized || row.recordingState !== "pending") return;
  // Only a flush grace period, never evidence or a lifecycle timestamp.
  if (Date.now() - Date.parse(row.evidence.endedAt) < 4000) return;
  // Recheck the immutable authorization snapshot, never current campaign policy.
  if ((row.campaignId && !row.recordingPolicySnapshot) ||
      (row.recordingPolicySnapshot && (!row.recordingPolicySnapshot.active || row.recordingPolicySnapshot.mode !== "both"))) {
    throw new Error("Forwarded mixed recording is not authorized by the handoff snapshot");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(row.recordingName) ||
      row.recordingPath !== `/var/spool/asterisk/monitor/${row.recordingName}`) {
    throw new Error("Invalid durable forwarded recording path");
  }
  // Stable primary key + filename make crash-after-insert and concurrent sweeps
  // harmless. Keep the PBX file until durable publication; do not delete it
  // before a successful local write/DB transaction.
  const recordingId = `qfwd_${row.id}`;
  const filename = `${recordingId}.wav`;
  const filePath = path.join(STORAGE_PATHS.callRecordings, filename);
  const [existing] = await db.select({ id: callRecordings.id }).from(callRecordings)
    .where(eq(callRecordings.id, recordingId)).limit(1);
  if (!existing) {
    const ssh = await freshSshSettings();
    assertForwardedPbxIdentity(row, ssh);
    const result = await downloadFileViaSsh(
      ssh.host, ssh.sshPort, ssh.sshUsername, ssh.sshPassword,
      `${row.recordingPath}.wav`, { exactPath: true },
    );
    if (!result || result.buffer.length <= 500) throw new Error("Verified forwarded recording is not available yet");
    await fs.mkdir(STORAGE_PATHS.callRecordings, { recursive: true });
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, result.buffer);
      await fs.rename(temporary, filePath);
    } finally { await fs.rm(temporary, { force: true }); }
    await db.transaction(async tx => {
      const [current] = await tx.select().from(queueForwardedCalls)
        .where(eq(queueForwardedCalls.id, row.id)).for("update");
      if (!current || current.status !== "completed" || !current.recordingAuthorized) return;
      await tx.insert(callRecordings).values({
        id: recordingId, callLogId: row.callLogId, userId: row.userId,
        customerId: row.customerId, campaignId: row.campaignId,
        filename, filePath, mimeType: "audio/wav", fileSizeBytes: result.buffer.length,
        durationSeconds: row.evidence!.durationSeconds,
        phoneNumber: row.callerNumber, agentName: "Forwarded Call", direction: "inbound",
        analysisStatus: "pending", recordingMode: row.recordingPolicySnapshot?.mode ?? null,
        recordingPolicySnapshot: row.recordingPolicySnapshot,
      }).onConflictDoNothing({ target: callRecordings.id });
      await tx.update(queueForwardedCalls).set({ recordingState: "saved", updatedAt: new Date() })
        .where(eq(queueForwardedCalls.id, row.id));
    });
  } else {
    await db.update(queueForwardedCalls).set({ recordingState: "saved", updatedAt: new Date() })
      .where(and(eq(queueForwardedCalls.id, row.id), eq(queueForwardedCalls.status, "completed")));
  }
}

export class ForwardedCallReconciler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly onObservedEnd?: (rootUniqueId: string) => void) {}

  start(): void {
    if (this.timer) return;
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), 15000);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    void dispatchPendingForwardedAnalyses();
    try {
      let sourceSettings: ForwardedCelSshConfig | null = null;
      await runForwardedSweep({
        pending: () => db.select().from(queueForwardedCalls).where(and(
          ne(queueForwardedCalls.status, "cancelled"),
          or(ne(queueForwardedCalls.status, "completed"), eq(queueForwardedCalls.recordingState, "pending")),
        )),
        read: async () => {
          sourceSettings = await freshSshSettings();
          return (await readForwardedCelEvents(sourceSettings)).events;
        },
        reconcile: async (row, events) => {
          if (!sourceSettings) throw new Error("CEL source identity is unavailable");
          assertForwardedPbxIdentity(row, sourceSettings);
          const updated = await applyEvidence(row.id, events);
          if (updated?.evidence?.endedAt) this.onObservedEnd?.(updated.rootUniqueId);
          if (updated) {
            await saveVerifiedRecording(updated);
            void dispatchPendingForwardedAnalyses();
          }
        },
        failed: async (row, error) => {
          // No transport exception text persisted: upstream errors can contain
          // configuration or command details. Surface a safe explicit error.
          console.error(`[QueueForwardedCEL] Reconciliation unavailable for ${row.id}; durable evidence retained`);
          await db.update(queueForwardedCalls).set({
            lastError: error instanceof ForwardedPbxIdentityError
              ? error.message
              : "CEL reconciliation or verified recording retrieval unavailable; will retry",
            updatedAt: new Date(),
          }).where(eq(queueForwardedCalls.id, row.id));
        },
      });
    } catch {
      console.error("[QueueForwardedCEL] Durable reconciliation sweep failed; will retry");
    } finally { this.running = false; }
  }
}