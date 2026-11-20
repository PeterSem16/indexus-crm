import { createHash, randomUUID } from "node:crypto";
import type { AIJobService, AIJobStatus, AIJobView } from "../../../shared/ai-jobs";
import { JobError } from "./policy";
import { maintenanceAllowsClaim } from "./maintenance-gate";

export interface JobSQL { query(text: string, values?: any[]): Promise<{ rows: any[]; rowCount?: number | null }> }
export interface JobConnection extends JobSQL { release(): void }
export interface JobPool extends JobSQL { connect(): Promise<JobConnection> }
export interface JobRow {
  id: string; service: AIJobService; entity_type: "task" | "email"; entity_id: string;
  owner_user_id: string; status: AIJobStatus; priority: number; payload: any; result: any;
  attempts: number; max_attempts: number; error_code: string | null;
  created_at: Date; started_at: Date | null; finished_at: Date | null;
  locked_until: Date | null; worker_id: string | null; input_fingerprint: string; idempotency_key: string;
  metrics?: { queuedAt?: string; gatewayMs?: number; applyMs?: number; httpStatus?: number | null; requestId?: string | null };
}
export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const jobView = (r: JobRow): AIJobView => ({
  id: r.id, service: r.service, entityType: r.entity_type, entityId: r.entity_id, status: r.status,
  attempts: r.attempts, maxAttempts: r.max_attempts, result: r.result, errorCode: r.error_code,
  createdAt: new Date(r.created_at).toISOString(),
  startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
  finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
  metrics: {
    queueMs: r.started_at ? Math.max(0, new Date(r.started_at).getTime() - new Date(r.metrics?.queuedAt ?? r.created_at).getTime()) : null,
    gatewayMs: r.metrics?.gatewayMs ?? null, applyMs: r.metrics?.applyMs ?? null,
    httpStatus: r.metrics?.httpStatus ?? null, requestId: r.metrics?.requestId ?? null,
  },
});
export async function jobTransaction<T>(pool: JobPool, fn: (tx: JobConnection) => Promise<T>): Promise<T> {
  const tx = await pool.connect();
  try { await tx.query("BEGIN"); const result = await fn(tx); await tx.query("COMMIT"); return result; }
  catch (error) { await tx.query("ROLLBACK").catch(() => {}); throw error; }
  finally { tx.release(); }
}
export async function insertJob(tx: JobSQL, data: {
  service: AIJobService; entityType: "task" | "email"; entityId: string;
  ownerId: string; payload: unknown; inputFingerprint: string; shared?: boolean;
}): Promise<JobRow> {
  const key = fingerprint([data.service, data.entityType, data.entityId,
    data.shared ? "shared-task" : data.ownerId, data.inputFingerprint]);
  const inserted = await tx.query(`INSERT INTO ai_jobs
    (id,service,entity_type,entity_id,owner_user_id,payload,idempotency_key,input_fingerprint)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) ON CONFLICT(idempotency_key) DO NOTHING RETURNING *`,
  [randomUUID(), data.service, data.entityType, data.entityId, data.ownerId, JSON.stringify(data.payload), key, data.inputFingerprint]);
  return inserted.rows[0] ?? (await tx.query("SELECT * FROM ai_jobs WHERE idempotency_key=$1", [key])).rows[0];
}
export function createJobStore(pool: JobPool) {
  return {
    pool,
    async get(id: string): Promise<JobRow | undefined> {
      return (await pool.query("SELECT * FROM ai_jobs WHERE id=$1", [id])).rows[0];
    },
    async active(ownerId: string, service: AIJobService): Promise<JobRow | undefined> {
      return (await pool.query(`SELECT * FROM ai_jobs WHERE owner_user_id=$1 AND service=$2
        AND status IN ('pending','processing') ORDER BY created_at LIMIT 1`, [ownerId, service])).rows[0];
    },
    async list(owner: string, service?: string, entityId?: string): Promise<JobRow[]> {
      return (await pool.query(`SELECT * FROM ai_jobs WHERE (owner_user_id=$1 OR service='task.checklist')
        AND ($2::text IS NULL OR service=$2) AND ($3::text IS NULL OR entity_id=$3)
        ORDER BY created_at DESC,id DESC LIMIT 100`, [owner, service ?? null, entityId ?? null])).rows;
    },
    async claim(workerId: string, leaseMs: number): Promise<JobRow | null> {
      return jobTransaction(pool, async tx => {
        // A short global admission lock closes the empty-queue/two-workers race.
        if (!(await tx.query("SELECT pg_try_advisory_xact_lock(517,1) AS acquired")).rows[0].acquired) return null;
        if (!await maintenanceAllowsClaim(tx)) return null;
        // An uncertain sent inference is NEVER automatically sent again.
        await tx.query(`UPDATE ai_jobs SET status='failed',error_code='worker_lost_outcome_unknown',
          error_message='worker_lost_outcome_unknown',finished_at=now(),worker_id=NULL,locked_until=NULL,
          history=history || jsonb_build_array(jsonb_build_object('event','lease_expired','at',now(),'metrics',metrics))
          WHERE status='processing' AND locked_until < now()`);
        if ((await tx.query("SELECT id FROM ai_jobs WHERE status='processing' LIMIT 1")).rows.length) return null;
        // Share one inference slot with the universal internally routed queue.
        if ((await tx.query("SELECT id FROM ai_inference_jobs WHERE status='processing' LIMIT 1")).rows.length) return null;
        const row = (await tx.query(`SELECT id FROM ai_jobs WHERE status='pending' AND attempts < max_attempts
          ORDER BY priority DESC,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`)).rows[0];
        if (!row) return null;
        return (await tx.query(`UPDATE ai_jobs SET status='processing',attempts=attempts+1,
          started_at=now(),finished_at=NULL,error_code=NULL,error_message=NULL,worker_id=$2,
          locked_until=now()+($3 * interval '1 millisecond'),
          history=history || jsonb_build_array(jsonb_build_object('event','claimed','at',now(),'worker', $2::text))
          WHERE id=$1 RETURNING *`, [row.id, workerId, leaseMs])).rows[0];
      });
    },
    async heartbeat(job: JobRow, leaseMs: number): Promise<boolean> {
      const r = await pool.query(`UPDATE ai_jobs SET locked_until=now()+($3 * interval '1 millisecond')
        WHERE id=$1 AND worker_id=$2 AND status='processing' AND locked_until>now() RETURNING id`,
      [job.id, job.worker_id, leaseMs]);
      return r.rows.length === 1;
    },
    async finish(job: JobRow, result: any, apply: (tx: JobSQL) => Promise<void>): Promise<boolean> {
      return jobTransaction(pool, async tx => {
        const owned = (await tx.query(`SELECT id FROM ai_jobs WHERE id=$1 AND worker_id=$2
          AND status='processing' AND locked_until>now() FOR UPDATE`, [job.id, job.worker_id])).rows[0];
        if (!owned) return false;
        const applyStarted = performance.now();
        await apply(tx);
        await tx.query(`UPDATE ai_jobs SET status='completed',result=$2::jsonb,finished_at=now(),
          worker_id=NULL,locked_until=NULL,history=history || jsonb_build_array(jsonb_build_object('event','completed','at',now()))
          ,metrics=metrics || jsonb_build_object('applyMs',$3::integer)
          WHERE id=$1`, [job.id, JSON.stringify(result), Math.round(performance.now() - applyStarted)]);
        return true;
      });
    },
    async fail(job: JobRow, code: string): Promise<void> {
      // Only server-owned safe error codes are accepted, never provider text.
      if (!/^[a-z][a-z0-9_]{0,79}$/.test(code)) code = "provider_or_contract_error";
      await pool.query(`UPDATE ai_jobs SET status='failed',error_code=$3,error_message=$3,
        finished_at=now(),worker_id=NULL,locked_until=NULL,
        history=history || jsonb_build_array(jsonb_build_object('event','failed','code',$3::text,'at',now(),'metrics',metrics))
        WHERE id=$1 AND worker_id=$2 AND status='processing'`,
      [job.id, job.worker_id, code]);
    },
    async retry(id: string, authorize: (job: JobRow, tx: JobSQL) => Promise<string | void>): Promise<JobRow> {
      return jobTransaction(pool, async tx => {
        const r: JobRow | undefined = (await tx.query("SELECT * FROM ai_jobs WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (!r) throw new JobError("job_not_found", 404);
        const ownerId = await authorize(r, tx);
        if (r.status !== "failed") throw new JobError("job_not_failed");
        if (r.attempts >= r.max_attempts) throw new JobError("attempts_exhausted");
        // No model retry occurs here: an explicitly authorized retry returns to the durable queue.
        return (await tx.query(`UPDATE ai_jobs SET status='pending',result=NULL,error_code=NULL,error_message=NULL,
          metrics=jsonb_build_object('queuedAt',now()),
          started_at=NULL,finished_at=NULL,worker_id=NULL,locked_until=NULL,
          owner_user_id=COALESCE($2::varchar,owner_user_id),
          history=history || jsonb_build_array(jsonb_build_object('event','manual_retry','at',now(),'actor',$2::varchar,'previousMetrics',metrics))
          WHERE id=$1 RETURNING *`, [id, ownerId ?? null])).rows[0];
      });
    },
  };
}
