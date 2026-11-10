export async function ensureRepresentativePlanSchema(client: { query: Function }) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS representative_distribution_plans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type text NOT NULL CHECK (entity_type IN ('clinic','hospital')),
      kind text NOT NULL CHECK (kind IN ('assign','departure','temporary')),
      from_user_id varchar,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz,
      created_by varchar NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS representative_distribution_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id uuid NOT NULL REFERENCES representative_distribution_plans(id),
      entity_id varchar NOT NULL,
      source_assignment_id varchar,
      from_user_id varchar,
      to_user_id varchar NOT NULL,
      temporary_assignment_id varchar,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','skipped','conflict')),
      reason text,
      UNIQUE(plan_id,entity_id)
    );
    CREATE INDEX IF NOT EXISTS representative_distribution_pending_idx
      ON representative_distribution_items(status,plan_id);
    CREATE INDEX IF NOT EXISTS representative_distribution_entity_idx
      ON representative_distribution_items(entity_id);
  `);
}
