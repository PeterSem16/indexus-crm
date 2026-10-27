// Shared document validation and validity model, but a strictly separate owner/table.
// Startup uses this same idempotent migration on CORPCRM01.
export const HOSPITAL_AGREEMENTS_MIGRATION = `
CREATE TABLE IF NOT EXISTS hospital_agreements (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id varchar NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  title text NOT NULL,
  contract_number text,
  valid_from date,
  valid_to date,
  active boolean NOT NULL DEFAULT true,
  ended_at timestamp,
  file_name text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  content_type text NOT NULL,
  file_size integer NOT NULL,
  created_by varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT hospital_agreement_dates CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);
CREATE INDEX IF NOT EXISTS idx_hospital_agreements_hospital ON hospital_agreements(hospital_id);
`;
