import { randomUUID } from "node:crypto";
import type { AIMaintenanceCommand, AIMaintenanceView } from "../../../shared/ai-maintenance";
import { jobTransaction, type JobPool } from "./store";
import { JobError } from "./policy";

export function parseMaintenanceCommand(body: unknown): AIMaintenanceCommand {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new JobError("maintenance_invalid", 400);
  const b = body as Record<string, unknown>;
  if (Object.keys(b).some(k => !["action", "expectedVersion", "operationId", "confirm"].includes(k)) ||
    typeof b.action !== "string" || !["pause", "resume", "takeover"].includes(b.action) || b.confirm !== true ||
    !Number.isInteger(b.expectedVersion) || Number(b.expectedVersion) < 0 ||
    Number(b.expectedVersion) >= 2147483647 ||
    (b.action === "pause" ? b.operationId !== null :
      typeof b.operationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.operationId)))
    throw new JobError("maintenance_invalid", 400);
  return b as unknown as AIMaintenanceCommand;
}

export function createMaintenanceStore(pool: JobPool) {
  return {
    async read(actor: string): Promise<AIMaintenanceView> {
      // Control version, acknowledgements and both queues share a statement snapshot.
      const r = (await pool.query(`SELECT m.*,
        (SELECT count(*)::int FROM ai_inference_workers WHERE heartbeat_at>now()-interval '30 seconds') AS alive,
        (SELECT count(*)::int FROM ai_inference_workers WHERE heartbeat_at>now()-interval '30 seconds'
          AND maintenance_protocol=1 AND maintenance_version=m.version) AS confirmed,
        (SELECT count(*)::int FROM ai_inference_workers WHERE heartbeat_at>now()-interval '30 seconds'
          AND maintenance_protocol<>1) AS unsupported,
        (SELECT count(*)::int FROM ai_jobs WHERE status='pending') AS jobs_pending,
        (SELECT count(*)::int FROM ai_jobs WHERE status='processing') AS jobs_processing,
        (SELECT count(*)::int FROM ai_inference_jobs WHERE status='pending') AS inference_pending,
        (SELECT count(*)::int FROM ai_inference_jobs WHERE status='processing') AS inference_processing
        FROM ai_queue_maintenance m WHERE m.scope='internal-gateway'`)).rows[0];
      if (!r || !["running", "paused"].includes(r.mode)) throw new JobError("maintenance_unavailable", 503);
      const audit = (await pool.query(`SELECT id,action,version,created_at
        FROM ai_queue_maintenance_audit ORDER BY id DESC LIMIT 20`)).rows;
      return {
        mode: r.mode, version: r.version, operationId: r.mode === "paused" ? r.operation_id : null,
        ownedByMe: r.mode === "paused" && r.owner_id === actor,
        changedAt: new Date(r.changed_at).toISOString(),
        workers: { alive: r.alive, confirmed: r.confirmed, unsupported: r.unsupported },
        queues: { jobs: { pending: r.jobs_pending, processing: r.jobs_processing },
          inference: { pending: r.inference_pending, processing: r.inference_processing } },
        gatewayDrain: "unverified", backendDrain: "unverified",
        audit: audit.map(a => ({ id: String(a.id), action: a.action, version: a.version,
          at: new Date(a.created_at).toISOString() })),
      };
    },
    async change(actor: string, input: AIMaintenanceCommand): Promise<void> {
      const command = parseMaintenanceCommand(input);
      if (!actor) throw new JobError("forbidden", 403);
      await jobTransaction(pool, async tx => {
        await tx.query("SET LOCAL lock_timeout='2s'");
        // Same short transaction lock as BOTH claim paths, not a session-held pause.
        await tx.query("SELECT pg_advisory_xact_lock(517,1)");
        const row = (await tx.query(`SELECT * FROM ai_queue_maintenance
          WHERE scope='internal-gateway' FOR UPDATE`)).rows[0];
        if (!row) throw new JobError("maintenance_unavailable", 503);
        if (row.version !== command.expectedVersion ||
          (command.action === "pause" ? row.mode !== "running" :
            row.mode !== "paused" || row.operation_id !== command.operationId))
          throw new JobError("maintenance_conflict", 409);
        if (command.action === "resume" && row.owner_id !== actor)
          throw new JobError("maintenance_owner_required", 409);
        if (command.action === "takeover" && row.owner_id === actor)
          throw new JobError("maintenance_conflict", 409);
        const operation = command.action === "pause" ? randomUUID() : row.operation_id;
        const version = row.version + 1;
        await tx.query(`UPDATE ai_queue_maintenance SET mode=$1,version=$2,operation_id=$3,
          owner_id=$4,changed_at=clock_timestamp() WHERE scope='internal-gateway'`,
        [command.action === "resume" ? "running" : "paused", version, operation, actor]);
        await tx.query(`INSERT INTO ai_queue_maintenance_audit(action,version,operation_id,actor_id)
          VALUES($1,$2,$3,$4)`, [command.action, version, operation, actor]);
      });
    },
  };
}
