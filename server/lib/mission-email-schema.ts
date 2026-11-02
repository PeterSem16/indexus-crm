import type { Pool } from "pg";
export async function ensureMissionEmailSchema(database: Pick<Pool, "query">) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS scheduled_reports (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id varchar REFERENCES campaigns(id),
      report_types text[] NOT NULL, recipient_user_ids text[] NOT NULL,
      external_emails text[] DEFAULT '{}', send_time varchar(5) NOT NULL,
      date_range_type text NOT NULL DEFAULT 'yesterday', enabled boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id), last_run_at timestamp, next_run_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS delivery_options jsonb;
    CREATE TABLE IF NOT EXISTS mission_report_deliveries (
      schedule_id text NOT NULL, period_key text NOT NULL, recipient_id text NOT NULL,
      status text NOT NULL CHECK(status IN ('sending','sent','unknown')),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(schedule_id,period_key,recipient_id)
    );
    CREATE INDEX IF NOT EXISTS mission_report_deliveries_schedule_idx
      ON mission_report_deliveries(schedule_id,updated_at DESC);
  `);
}
