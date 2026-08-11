/**
 * Monthly KPI snapshot auto-lock cron.
 *
 * Runs on startup (catch-up) and every hour thereafter.  Fires whenever the
 * previous month still has missing global (campaign_id IS NULL) snapshots for
 * any active representative, so a server restart on any day of the month does
 * not silently skip the lock.
 *
 * Reliability:
 *  - Catch-up on startup (30 s delay to let the pool warm up) + hourly re-check.
 *  - No day-of-month cutoff: a restart on the 15th still generates the lock.
 *  - `lastAutoLockMonth` is set only after all reps succeed.  A partial run
 *    keeps the flag clear so the next hourly tick retries the failed reps.
 *
 * Representative discovery (mirrors GET /api/representatives):
 *  - Queries `roles` for IDs with name 'representant' or 'representative'.
 *  - Finds active users via users.role_id OR user_roles many-to-many.
 *  - Parameters typed as varchar[] to match the schema exactly.
 *  - IDs remain strings (UUID/varchar) throughout — no Number() conversion.
 *
 * Aggregation correctness:
 *  - Clinic denominator uses time-valid assignments overlapping the target
 *    month: valid_from <= month_end AND (valid_to IS NULL OR valid_to >= month_start).
 *  - Month boundaries are computed in the app reporting timezone
 *    (Europe/Bratislava) entirely inside PostgreSQL to avoid server-clock UTC
 *    skew at month edges.
 *
 * Idempotency:
 *  - Preflight classifies a rep as "done" only when all 4 KPI keys exist.
 *  - Inserts use ON CONFLICT (representative_id, year, month, kpi_key)
 *    WHERE campaign_id IS NULL DO NOTHING, inferring the partial unique index.
 *  - Manual snapshots take precedence: all-4-rows present → rep is skipped.
 *
 * Only active when NODE_ENV === "production".
 */

import { pool } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const KPI_KEYS = ["kpi_34", "kpi_35", "kpi_36", "kpi_37"] as const;
const APP_TZ   = "Europe/Bratislava";

// Last month we successfully auto-locked (YYYY-M).
let lastAutoLockMonth = "";

// ─────────────────────────────────────────────────────────────────────────────
// Timezone helpers — compute "current" year/month in the app timezone
// ─────────────────────────────────────────────────────────────────────────────

function currentYearMonthInAppTz(now: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year:  "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year  = Number(parts.find((p) => p.type === "year")?.value  ?? 0);
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  return { year, month };
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year,           month: month - 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Representative discovery — same logic as GET /api/representatives
// ─────────────────────────────────────────────────────────────────────────────

async function getActiveRepresentatives(): Promise<string[]> {
  // Resolve role IDs for 'representant' / 'representative'
  const roleRes = await pool.query<{ id: string }>(
    `SELECT id FROM roles WHERE lower(name) IN ('representant', 'representative')`,
  );
  if (roleRes.rows.length === 0) {
    console.warn("[kpi-cron] No Representative role found in roles table; skipping");
    return [];
  }
  const roleIds = roleRes.rows.map((r) => r.id);

  // varchar[] cast matches the schema column types exactly (avoids
  // "operator does not exist: character varying = text" on some PG configs)
  const userRes = await pool.query<{ id: string }>(
    `SELECT DISTINCT u.id::text AS id
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     WHERE u.is_active = true
       AND (u.role_id = ANY($1::varchar[]) OR ur.role_id = ANY($1::varchar[]))
     ORDER BY u.id`,
    [roleIds],
  );
  return userRes.rows.map((r) => r.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-representative snapshot generation
// ─────────────────────────────────────────────────────────────────────────────

async function generateSnapshotForRep(
  repId: string,
  year: number,
  month: number,
): Promise<"generated" | "skipped"> {
  // Skip if all four KPI rows already exist (manual precedence)
  const existingRes = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::int AS cnt
     FROM representative_kpi_snapshots
     WHERE representative_id = $1
       AND campaign_id IS NULL
       AND year = $2
       AND month = $3`,
    [repId, year, month],
  );
  if (Number(existingRes.rows[0]?.cnt ?? 0) >= KPI_KEYS.length) {
    return "skipped";
  }

  // Aggregation with correct ownership attribution:
  //
  //  Denominator policy — "month-end ownership":
  //    Clinics for which this rep held an active assignment at the month's last
  //    moment (valid_from <= month_end AND (valid_to IS NULL OR valid_to >= month_end)).
  //    This gives a stable, point-in-time denominator unaffected by mid-month
  //    reassignments that reverse before month-end.
  //
  //  Status-event attribution:
  //    For each rep-owned clinic, only `clinic_cooperation_statuses` rows whose
  //    `confirmed_at` falls within [cra.valid_from, cra.valid_to] are counted.
  //    Pre-assignment history (from a prior rep) and post-reassignment events
  //    are excluded.
  //
  //  Month boundaries are computed in the app reporting timezone entirely in
  //  PostgreSQL (AT TIME ZONE) to avoid UTC skew at month edges.
  const summaryRes = await pool.query<{
    total_assigned: string;
    approached:     string;
    cooperating:    string;
    with_flyers:    string;
    with_contract:  string;
  }>(
    `WITH
     bounds AS (
       SELECT
         make_date($2::int, $3::int, 1)::timestamp AT TIME ZONE $4
           AS month_start,
         (make_date($2::int, $3::int, 1) + interval '1 month'
          - interval '1 millisecond')::timestamp AT TIME ZONE $4
           AS month_end
     ),
     rep_clinics AS (
       -- Denominator: clinics owned by this rep at month-end.
       -- At most one active assignment per clinic at any given instant
       -- (overlapping assignments are a data error), so DISTINCT is a safety net.
       SELECT DISTINCT ON (cra.clinic_id)
         cra.clinic_id,
         cra.valid_from,
         cra.valid_to
       FROM clinic_representative_assignments cra, bounds
       WHERE cra.user_id = $1
         AND cra.valid_from <= bounds.month_end
         AND (cra.valid_to IS NULL OR cra.valid_to >= bounds.month_end)
       ORDER BY cra.clinic_id, cra.valid_from DESC
     ),
     phases AS (
       -- Status events are attributed only when confirmed_at falls within the
       -- rep's own assignment window for that clinic, preventing pre- and
       -- post-assignment history from inflating this rep's metrics.
       SELECT
         rc.clinic_id,
         MIN(
           CASE
             WHEN ccs.confirmed_at >= rc.valid_from
              AND (rc.valid_to IS NULL OR ccs.confirmed_at <= rc.valid_to)
             THEN ccs.confirmed_at
           END
         ) AS phase1_at,
         BOOL_OR(
           ccs.status_key = 'flyers_accepted'
           AND ccs.confirmed_at >= rc.valid_from
           AND (rc.valid_to IS NULL OR ccs.confirmed_at <= rc.valid_to)
         ) AS has_flyers,
         BOOL_OR(
           ccs.status_key IN ('retention_active','services_confirmed')
           AND ccs.confirmed_at >= rc.valid_from
           AND (rc.valid_to IS NULL OR ccs.confirmed_at <= rc.valid_to)
         ) AS is_cooperating,
         BOOL_OR(
           ccs.status_key = 'contract_signed'
           AND ccs.confirmed_at >= rc.valid_from
           AND (rc.valid_to IS NULL OR ccs.confirmed_at <= rc.valid_to)
         ) AS has_contract
       FROM rep_clinics rc
       LEFT JOIN clinic_cooperation_statuses ccs ON ccs.clinic_id = rc.clinic_id
       GROUP BY rc.clinic_id
     )
     SELECT
       COUNT(*)::int                                                            AS total_assigned,
       COUNT(*) FILTER (WHERE phase1_at IS NOT NULL)::int                      AS approached,
       COUNT(*) FILTER (
         WHERE phase1_at BETWEEN (SELECT month_start FROM bounds)
                             AND (SELECT month_end   FROM bounds)
       )::int                                                                   AS new_in_period,
       COUNT(*) FILTER (WHERE is_cooperating)::int                             AS cooperating,
       COUNT(*) FILTER (WHERE has_flyers)::int                                 AS with_flyers,
       COUNT(*) FILTER (WHERE has_contract)::int                               AS with_contract
     FROM phases`,
    [repId, year, month, APP_TZ],
  );

  const s            = summaryRes.rows[0] ?? {};
  const total        = Number(s.total_assigned) || 0;
  const approached   = Number(s.approached)     || 0;
  const cooperating  = Number(s.cooperating)    || 0;
  const withFlyers   = Number(s.with_flyers)    || 0;
  const withContract = Number(s.with_contract)  || 0;

  const kpis: Array<{ key: string; value: number; numerator: number; denominator: number }> = [
    { key: "kpi_34", value: total > 0 ? approached   / total : 0, numerator: approached,   denominator: total },
    { key: "kpi_35", value: total > 0 ? cooperating  / total : 0, numerator: cooperating,  denominator: total },
    { key: "kpi_36", value: total > 0 ? withFlyers   / total : 0, numerator: withFlyers,   denominator: total },
    { key: "kpi_37", value: total > 0 ? withContract / total : 0, numerator: withContract, denominator: total },
  ];

  // Idempotent inserts — the partial unique index on (representative_id, year,
  // month, kpi_key) WHERE campaign_id IS NULL is the conflict target.
  for (const kpi of kpis) {
    await pool.query(
      `INSERT INTO representative_kpi_snapshots
         (representative_id, campaign_id, year, month, kpi_key,
          value, numerator, denominator, locked_at, created_by)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, now(), NULL)
       ON CONFLICT (representative_id, year, month, kpi_key)
         WHERE campaign_id IS NULL
       DO NOTHING`,
      [repId, year, month, kpi.key, kpi.value, kpi.numerator, kpi.denominator],
    );
  }

  console.log(
    `[kpi-cron] Snapshot generated for rep ${repId} ${year}-${month}:`,
    kpis.map((k) => `${k.key}=${k.value.toFixed(3)}`).join(", "),
  );
  return "generated";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main runner
// ─────────────────────────────────────────────────────────────────────────────

async function maybeAutoLockPreviousMonth(): Promise<void> {
  const now                      = new Date();
  const { year: curY, month: curM } = currentYearMonthInAppTz(now);
  const { year, month }          = prevMonth(curY, curM);
  const monthKey                 = `${year}-${month}`;

  // Already fully locked this month
  if (lastAutoLockMonth === monthKey) return;

  // Discover active representatives (UUID strings, varchar[]-safe query)
  const reps = await getActiveRepresentatives();
  if (reps.length === 0) return;

  // Which reps already have ALL four KPI rows for this month?
  // A rep with 1–3 rows (partial data) is still classified as missing.
  const snapRes = await pool.query<{ representative_id: string }>(
    `SELECT representative_id
     FROM representative_kpi_snapshots
     WHERE campaign_id IS NULL AND year = $1 AND month = $2
       AND kpi_key = ANY($3::text[])
     GROUP BY representative_id
     HAVING COUNT(DISTINCT kpi_key) >= $4`,
    [year, month, KPI_KEYS, KPI_KEYS.length],
  );
  const alreadyDone = new Set(snapRes.rows.map((r) => r.representative_id));
  const missing     = reps.filter((id) => !alreadyDone.has(id));

  if (missing.length === 0) {
    lastAutoLockMonth = monthKey;
    console.log(`[kpi-cron] All ${reps.length} reps already locked for ${year}-${month}`);
    return;
  }

  console.log(
    `[kpi-cron] Starting auto-lock for ${year}-${month}:`,
    `${missing.length} of ${reps.length} reps need snapshots`,
  );

  let generated = 0;
  let skipped   = 0;
  let errors    = 0;

  for (const repId of missing) {
    try {
      const outcome = await generateSnapshotForRep(repId, year, month);
      if (outcome === "generated") generated++;
      else skipped++;
    } catch (err: any) {
      errors++;
      console.error(
        `[kpi-cron] Error for rep ${repId} ${year}-${month}:`,
        err?.message || err,
      );
    }
  }

  console.log(
    `[kpi-cron] Auto-lock complete for ${year}-${month}:`,
    `generated=${generated} skipped=${skipped} errors=${errors}`,
  );

  // Set only when every rep succeeded; errors keep the flag clear so the next
  // hourly tick retries the failed reps.
  if (errors === 0) {
    lastAutoLockMonth = monthKey;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start the monthly KPI snapshot cron.
 * Only active when NODE_ENV === "production".
 */
export function startKpiSnapshotCron(): void {
  if (process.env.NODE_ENV !== "production") {
    console.log("[kpi-cron] Not in production — monthly KPI auto-lock disabled");
    return;
  }

  // Catch-up: run ~30 s after startup to let the pool warm up.
  setTimeout(() => {
    maybeAutoLockPreviousMonth().catch((err) =>
      console.error("[kpi-cron] Startup catch-up error:", err?.message || err),
    );
  }, 30_000);

  // Re-check every hour; fires whenever previous month still has missing reps.
  setInterval(() => {
    maybeAutoLockPreviousMonth().catch((err) =>
      console.error("[kpi-cron] Hourly check error:", err?.message || err),
    );
  }, 60 * 60 * 1000);

  console.log("[kpi-cron] Monthly KPI snapshot cron started");
}
