/** Additive runtime migration: production startup does not run drizzle db:push. */
export async function ensureHealthcareLegalEntitySchema(pool: { query: (sql: string) => Promise<unknown> }) {
  await pool.query(`
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ico text;
    CREATE TABLE IF NOT EXISTS healthcare_legal_entities (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      country_code text NOT NULL DEFAULT 'SK' CHECK(country_code='SK'),
      ico text NOT NULL CHECK(ico ~ '^[0-9]{8}$'),
      normalized jsonb NOT NULL,
      notes text NOT NULL DEFAULT '',
      checked_at timestamptz NOT NULL,
      source_updated_at text,
      created_by varchar REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(country_code,ico)
    );
    ALTER TABLE healthcare_legal_entities ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}';
    CREATE TABLE IF NOT EXISTS healthcare_legal_entity_snapshots (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      legal_entity_id varchar NOT NULL REFERENCES healthcare_legal_entities(id),
      normalized jsonb NOT NULL, registry_people jsonb NOT NULL DEFAULT '[]',
      raw_data jsonb NOT NULL,
      checked_at timestamptz NOT NULL, source_updated_at text,
      created_by varchar REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS hle_snapshots_entity ON healthcare_legal_entity_snapshots(legal_entity_id,checked_at DESC);
    CREATE TABLE IF NOT EXISTS healthcare_legal_entity_verifications (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      created_by varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      facility_type text CHECK(facility_type IN ('clinic','hospital')),
      facility_id varchar,
      normalized jsonb NOT NULL, registry_people jsonb NOT NULL,
      raw_data jsonb NOT NULL, checked_at timestamptz NOT NULL,
      source_updated_at text, expires_at timestamptz NOT NULL,
      used_at timestamptz, result_entity_id varchar,
      CHECK((facility_type IS NULL) = (facility_id IS NULL))
    );
    CREATE INDEX IF NOT EXISTS hle_verifications_owner ON healthcare_legal_entity_verifications(created_by,expires_at);
    CREATE TABLE IF NOT EXISTS healthcare_legal_entity_facilities (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      legal_entity_id varchar NOT NULL REFERENCES healthcare_legal_entities(id),
      facility_type text NOT NULL CHECK(facility_type IN ('clinic','hospital')),
      facility_id varchar NOT NULL, relationship text NOT NULL DEFAULT 'operator' CHECK(relationship='operator'),
      valid_from timestamptz NOT NULL DEFAULT now(), valid_to timestamptz,
      confirmed_at timestamptz NOT NULL DEFAULT now(),
      confirmed_by varchar REFERENCES users(id), ended_by varchar REFERENCES users(id),
      CHECK(valid_to IS NULL OR valid_to >= valid_from)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS hle_one_active_operator
      ON healthcare_legal_entity_facilities(facility_type,facility_id) WHERE valid_to IS NULL;
    CREATE INDEX IF NOT EXISTS hle_facilities_entity ON healthcare_legal_entity_facilities(legal_entity_id);
    CREATE TABLE IF NOT EXISTS healthcare_legal_entity_person_links (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      legal_entity_id varchar NOT NULL REFERENCES healthcare_legal_entities(id),
      person_id varchar NOT NULL REFERENCES collaborators(id),
      registry_person_key text NOT NULL, role text NOT NULL,
      valid_from timestamptz NOT NULL DEFAULT now(), valid_to timestamptz,
      confirmed_by varchar REFERENCES users(id), ended_by varchar REFERENCES users(id),
      CHECK(valid_to IS NULL OR valid_to >= valid_from)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS hle_one_active_person_role
      ON healthcare_legal_entity_person_links(legal_entity_id,registry_person_key) WHERE valid_to IS NULL;
    CREATE INDEX IF NOT EXISTS hle_person_links_person ON healthcare_legal_entity_person_links(person_id);
    CREATE TABLE IF NOT EXISTS healthcare_legal_entity_audit (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      legal_entity_id varchar NOT NULL REFERENCES healthcare_legal_entities(id),
      actor_id varchar REFERENCES users(id), kind text NOT NULL,
      details jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}
