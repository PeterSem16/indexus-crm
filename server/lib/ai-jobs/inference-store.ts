import { randomUUID } from "node:crypto";
import { jobTransaction, type JobPool } from "./store";
import { AI_SERVICES, type AIService } from "../ai/service-catalog";
import { internalEligible } from "../ai/settings-policy";
import { internalModelsForService, validateInternalRequest } from "../ai/internal-contract";
import { JobError } from "./policy";

export interface InferenceJob {
  id: string;
  service: AIService;
  model: string;
  request: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed";
  response: { data: any; status: number; requestId: string | null } | null;
  error_code: string | null;
  error_meta?: { status?: number; code?: string; type?: string; reason_code?: string; request_id?: string };
  worker_id: string | null;
}
export function createInferenceStore(pool: JobPool) {
  return {
    async ready() {
      return (await pool.query(`SELECT EXISTS(SELECT FROM ai_inference_workers
        WHERE heartbeat_at > now() - interval '30 seconds') AS ready`)).rows[0]?.ready === true;
    },
    async heartbeat(id: string) {
      await pool.query(`INSERT INTO ai_inference_workers(id) VALUES($1)
        ON CONFLICT(id) DO UPDATE SET heartbeat_at=now()`, [id]);
    },
    async offline(id: string) {
      await pool.query("DELETE FROM ai_inference_workers WHERE id=$1", [id]);
    },
    async enqueue(service: AIService, model: string, body: unknown): Promise<InferenceJob> {
      if (!Object.hasOwn(AI_SERVICES, service) || !internalEligible(service))
        throw new JobError("async_service_unsupported", 422);
      const request = { ...(body as object), model };
      validateInternalRequest(request, internalModelsForService(service));
      // Admission and the heartbeat observation share one database operation.
      // No job is silently accepted when there is no consumer.
      const result = await pool.query(`INSERT INTO ai_inference_jobs(id,service,model,request)
        SELECT $1,$2,$3,$4::jsonb WHERE EXISTS(SELECT FROM ai_inference_workers
          WHERE heartbeat_at > now() - interval '30 seconds') RETURNING *`,
      [randomUUID(), service, model, JSON.stringify(request)]);
      if (!result.rows[0]) throw new JobError("async_worker_unavailable", 503);
      return result.rows[0];
    },
    async get(id: string): Promise<InferenceJob | undefined> {
      return (await pool.query("SELECT * FROM ai_inference_jobs WHERE id=$1", [id])).rows[0];
    },
    async claim(workerId: string, timeoutMs: number): Promise<InferenceJob | undefined> {
      return jobTransaction(pool, async tx => {
        if (!(await tx.query("SELECT pg_try_advisory_xact_lock(517,1) AS acquired")).rows[0].acquired)
          return undefined;
        await tx.query(`UPDATE ai_inference_jobs SET status='failed',
          error_code='worker_lost_outcome_unknown',finished_at=now(),locked_until=null,worker_id=null
          WHERE status='processing' AND locked_until<now()`);
        const result = await tx.query(`UPDATE ai_inference_jobs SET status='processing',worker_id=$1,
          attempts=1,started_at=now(),locked_until=now()+($2::int * interval '1 millisecond')
          WHERE id=(SELECT id FROM ai_inference_jobs WHERE status='pending'
            AND NOT EXISTS(SELECT FROM ai_inference_jobs WHERE status='processing')
            AND NOT EXISTS(SELECT FROM ai_jobs WHERE status='processing')
            ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`,
        [workerId, timeoutMs + 60000]);
        return result.rows[0];
      });
    },
    async finish(job: InferenceJob, response: NonNullable<InferenceJob["response"]>) {
      const bytes = JSON.stringify(response);
      if (Buffer.byteLength(bytes) > 3 * 1024 * 1024) throw new JobError("invalid_output", 422);
      const result = await pool.query(`UPDATE ai_inference_jobs SET status='completed',response=$3::jsonb,
        http_status=$4,request_id=$5,finished_at=now(),locked_until=null,worker_id=null
        WHERE id=$1 AND worker_id=$2 AND status='processing' AND locked_until>now() RETURNING id`,
      [job.id, job.worker_id, bytes, response.status, response.requestId]);
      if (!result.rows.length) throw new JobError("worker_claim_lost", 409);
    },
    async fail(job: InferenceJob, code: string, meta: NonNullable<InferenceJob["error_meta"]> = {}) {
      await pool.query(`UPDATE ai_inference_jobs SET status='failed',error_code=$3,
        error_meta=$4::jsonb,finished_at=now(),locked_until=null,worker_id=null
        WHERE id=$1 AND worker_id=$2 AND status='processing' AND locked_until>now()`,
      [job.id, job.worker_id, code, JSON.stringify(meta)]);
    },
    async status() {
      const counts = (await pool.query(`SELECT status,count(*)::int AS count
        FROM ai_inference_jobs GROUP BY status`)).rows;
      return { ready: await this.ready(), counts: Object.fromEntries(counts.map(r => [r.status, r.count])) };
    },
  };
}
