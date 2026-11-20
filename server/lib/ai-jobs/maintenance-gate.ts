import type { JobSQL } from "./store";
import { JobError } from "./policy";

/** Caller MUST hold (517,1) until its claim transaction commits. No cached default. */
export async function maintenanceAllowsClaim(tx: JobSQL): Promise<boolean> {
  const row = (await tx.query(
    "SELECT mode FROM ai_queue_maintenance WHERE scope='internal-gateway'",
  )).rows[0];
  if (!row || !["running", "paused"].includes(row.mode))
    throw new JobError("maintenance_unavailable", 503);
  return row.mode === "running";
}
