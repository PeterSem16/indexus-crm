import { pool as applicationPool } from "../../db";
import { aiJobEnabled, aiJobTimeout, JobError } from "./policy";
import { createJobStore, insertJob, jobTransaction, jobView, type JobRow, type JobSQL, type JobPool } from "./store";
import { emailPayload, taskPayload, validateJobSource } from "./context";
import type { AIJobService } from "../../../shared/ai-jobs";

import { evaluateChecklistApply } from "../task-ai-checklist";

export function createAIJobRuntime(pool: JobPool, loadEmail = emailPayload) {
const aiJobStore = createJobStore(pool);
async function enqueueTaskJob(service: "task.checklist" | "task.resolution", taskId: string,
  actorId?: string, locale?: string) {
  if (!aiJobEnabled(service)) throw new JobError("async_service_disabled", 503);
  return jobTransaction(pool, async tx => {
    const source = await taskPayload(tx, service, taskId, actorId, locale, true);
    if (service === "task.checklist") {
      if ((await tx.query("SELECT id FROM task_checklist_items WHERE task_id=$1 LIMIT 1", [taskId])).rows.length)
        throw new JobError("checklist_preserved");
      const gen = (await tx.query("SELECT * FROM task_ai_checklist_generations WHERE task_id=$1 FOR UPDATE", [taskId])).rows[0];
      if (gen?.status === "preserved") throw new JobError("checklist_preserved");
      if (gen?.status === "generated") throw new JobError("checklist_generated");
      if (gen?.status === "generating" && !gen.ai_job_id && Date.now() - new Date(gen.updated_at).getTime() < 180000)
        throw new JobError("legacy_generation_in_progress");
    }
    // Never wait on an existing job row while holding the task lock: finish
    // acquires those locks in the opposite order. Plain SELECT is nonblocking.
    const existing = (await tx.query(`SELECT * FROM ai_jobs WHERE service=$1 AND entity_id=$2 AND input_fingerprint=$3
      AND (service='task.checklist' OR owner_user_id=$4) ORDER BY created_at DESC LIMIT 1`,
    [service, taskId, source.hash, source.ownerId])).rows[0];
    const job: JobRow = existing ?? await insertJob(tx, {
      service, entityType: "task", entityId: taskId, ownerId: source.ownerId,
      payload: source.payload, inputFingerprint: source.hash, shared: service === "task.checklist",
    });
    if (service === "task.checklist") {
      await tx.query(`INSERT INTO task_ai_checklist_generations(task_id,status,attempt_token,fingerprint,ai_job_id)
        VALUES($1,'generating',$2::text,$3,($2::text)::uuid) ON CONFLICT(task_id) DO UPDATE SET
        status='generating',attempt_token=$2::text,fingerprint=$3,ai_job_id=($2::text)::uuid,error_code=NULL,updated_at=now()`,
      [taskId, job.id, source.hash]);
    }
    return job;
  });
}
async function enqueueEmailJob(userId: string, entityId: string, mailbox: unknown, language: unknown) {
  if (!aiJobEnabled("email.summary")) throw new JobError("async_service_disabled", 503);
  const source = await loadEmail(userId, entityId, mailbox, language);
  return insertJob(pool, { service: "email.summary", entityType: "email", entityId, ownerId: userId,
    payload: source.payload, inputFingerprint: source.hash });
}
async function drainingJob(userId: string, service: "task.resolution" | "email.summary",
  entityId: unknown, locale?: string, mailbox?: unknown) {
  const job = await aiJobStore.active(userId, service);
  if (!job) return null;
  if (job.entity_id !== entityId ||
    (job.payload.input?.userLocale ?? job.payload.input?.language ?? null) !== (locale ?? null))
    throw new JobError("async_service_draining", 503);
  if (service === "email.summary") {
    const { resolveJobMailbox } = await import("./mailbox");
    if ((await resolveJobMailbox(userId, mailbox)).mailbox !== job.payload.mailbox)
      throw new JobError("async_service_draining", 503);
  }
  await validateJobSource(pool, job, userId, loadEmail);
  return job;
}
async function linkedChecklistJob(taskId: string) {
  return (await pool.query(`SELECT j.* FROM ai_jobs j JOIN task_ai_checklist_generations g ON g.ai_job_id=j.id
    WHERE g.task_id=$1`, [taskId])).rows[0] as JobRow | undefined;
}
async function queuedChecklistState(taskId: string, options: { retry?: boolean; actorId?: string; readOnly?: boolean } = {}) {
  let job = await linkedChecklistJob(taskId);
  if (options.readOnly && !job) return null;
  if (!job && !aiJobEnabled("task.checklist")) return null;
  try {
    if (!options.readOnly && (!job || aiJobEnabled("task.checklist"))) job = await enqueueTaskJob("task.checklist", taskId, options.actorId);
    if (!job) return null;
    if (options.readOnly) await validateJobSource(pool, job, options.actorId ?? job.owner_user_id, loadEmail);
    if (options.retry && job.status === "failed") {
      if (!aiJobEnabled("task.checklist")) throw new JobError("async_service_disabled", 503);
      job = await retryJob(job.id, options.actorId ?? job.owner_user_id);
    }
    return {
      status: job.status === "completed" ? "generated" as const : job.status === "failed" ? "failed" as const : "generating" as const,
      ...(job.error_code ? { errorCode: job.error_code } : {}), job: jobView(job), jobId: job.id,
    };
  } catch (error) {
    if (error instanceof JobError && error.code === "checklist_preserved") return { status: "preserved" as const };
    if (error instanceof JobError && error.code === "checklist_generated") return { status: "generated" as const };
    if (error instanceof JobError && error.code === "legacy_generation_in_progress") return { status: "generating" as const };
    throw error;
  }
}
async function retryJob(id: string, userId: string) {
  return aiJobStore.retry(id, async (job, tx) => {
    if (!aiJobEnabled(job.service)) throw new JobError("async_service_disabled", 503);
    if (job.service !== "task.checklist" && job.owner_user_id !== userId) throw new JobError("forbidden", 403);
    await validateJobSource(tx, job, userId, loadEmail);
    if (job.service === "task.checklist") {
      const rows = (await tx.query("SELECT id FROM task_checklist_items WHERE task_id=$1 LIMIT 1", [job.entity_id])).rows;
      if (rows.length) throw new JobError("checklist_preserved");
    }
    return userId;
  });
}
async function applyJob(job: JobRow, result: any, tx: JobSQL) {
  if (job.entity_type === "task" && !(await tx.query("SELECT id FROM tasks WHERE id=$1 FOR UPDATE", [job.entity_id])).rows.length)
    throw new JobError("task_not_found", 404);
  const source = await validateJobSource(tx, job, job.owner_user_id, loadEmail);
  if (job.service !== "task.checklist") return; // Private drafts live in ai_jobs until the user accepts them.
  const generation = (await tx.query("SELECT * FROM task_ai_checklist_generations WHERE task_id=$1 FOR UPDATE", [job.entity_id])).rows[0];
  const decision = evaluateChecklistApply({
    claimMatches: generation?.status === "generating" && generation?.attempt_token === job.id,
    hasItems: (await tx.query("SELECT id FROM task_checklist_items WHERE task_id=$1 LIMIT 1", [job.entity_id])).rows.length > 0,
    taskActive: true, fingerprintMatches: source.hash === job.input_fingerprint,
  });
  if (decision !== "apply") throw new JobError(decision === "preserved" ? "checklist_preserved" : decision);
  // All rows and completion state commit together with ai_jobs.completed.
  for (let position = 0; position < result.steps.length; position++) {
    await tx.query("INSERT INTO task_checklist_items(task_id,position,label,required) VALUES($1,$2,$3,false)",
      [job.entity_id, position, result.steps[position]]);
  }
  await tx.query(`UPDATE task_ai_checklist_generations SET status='generated',error_code=NULL,attempt_token=NULL,
    generated_item_count=$2,attempt_count=$3,updated_at=now() WHERE task_id=$1`,
  [job.entity_id, result.steps.length, job.attempts]);
}
return { aiJobStore, enqueueTaskJob, enqueueEmailJob, linkedChecklistJob, queuedChecklistState, retryJob, applyJob, drainingJob };
}
export const { aiJobStore, enqueueTaskJob, enqueueEmailJob, linkedChecklistJob, queuedChecklistState, retryJob, applyJob, drainingJob } =
  createAIJobRuntime(applicationPool);
