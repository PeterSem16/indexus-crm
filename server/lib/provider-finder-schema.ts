import type { Pool } from "pg";
export async function ensureProviderFinderSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS provider_finder_country_policies(
      country varchar(2) PRIMARY KEY, settings jsonb NOT NULL DEFAULT '{}',
      updated_by varchar, updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS provider_finder_country_forms(
      form_id varchar PRIMARY KEY REFERENCES web_forms(id) ON DELETE CASCADE,
      country varchar(2) NOT NULL REFERENCES provider_finder_country_policies(country) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS provider_finder_policies(
      billing_company_id varchar NOT NULL REFERENCES billing_details(id) ON DELETE CASCADE,
      country varchar(2) NOT NULL, settings jsonb NOT NULL DEFAULT '{}',
      updated_by varchar, updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(billing_company_id,country));
    CREATE TABLE IF NOT EXISTS provider_finder_profiles(
      billing_company_id varchar NOT NULL, country varchar(2) NOT NULL,
      facility_type varchar NOT NULL CHECK(facility_type IN ('clinic','hospital')), facility_id varchar NOT NULL,
      settings jsonb NOT NULL DEFAULT '{}', updated_by varchar, updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(billing_company_id,country,facility_type,facility_id),
      FOREIGN KEY(billing_company_id,country) REFERENCES provider_finder_policies ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS provider_finder_form_bindings(
      form_id varchar PRIMARY KEY REFERENCES web_forms(id) ON DELETE CASCADE,
      billing_company_id varchar NOT NULL,country varchar(2) NOT NULL,
      FOREIGN KEY(billing_company_id,country) REFERENCES provider_finder_policies ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS provider_finder_selections(
      customer_id varchar PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
      selection jsonb NOT NULL, selected_by varchar NOT NULL, selected_at timestamptz NOT NULL DEFAULT now());
  `);
}
