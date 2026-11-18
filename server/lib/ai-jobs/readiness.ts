import type { JobSQL } from "./store";
import { JobError } from "./policy";
export async function assertJobSchema(sql: JobSQL) {
  await sql.query(`SELECT id,service,entity_type,entity_id,owner_user_id,status,priority,payload,result,
    attempts,max_attempts,error_code,error_message,created_at,started_at,finished_at,locked_until,
    worker_id,idempotency_key,input_fingerprint,history,metrics FROM ai_jobs LIMIT 0`);
  await sql.query("SELECT ai_job_id FROM task_ai_checklist_generations LIMIT 0");
  const index = (await sql.query(`SELECT indisunique,indisvalid,indisready,
    pg_get_expr(indpred,indrelid) AS predicate FROM pg_index
    WHERE indexrelid=to_regclass('ai_jobs_single_processing')`)).rows[0];
  if (!index?.indisunique || !index.indisvalid || !index.indisready ||
    !/status.*processing/.test(index.predicate ?? "")) throw new JobError("queue_schema_not_ready", 503);
}
