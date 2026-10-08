import { pool } from "../db";
import type { ReferenceKind, ReferenceLookup } from "./automation-display-values";

// Fixed table/column allowlist; never select entire contact/user records.
const sources: Record<ReferenceKind, { table: string; label: string; scope?: string }> = {
  user: { table: "users", label: "COALESCE(NULLIF(full_name,''),username)" },
  department: { table: "departments", label: "name" },
  group: { table: "task_groups", label: "COALESCE(NULLIF(display_alias,''),name)" },
  customer: { table: "customers", label: "concat_ws(' ',first_name,last_name)", scope: "country=$2" },
  clinic: { table: "clinics", label: "name", scope: "country_code=$2" },
  hospital: { table: "hospitals", label: "name", scope: "country_code=$2" },
  collaborator: { table: "collaborators", label: "concat_ws(' ',first_name,last_name)", scope: "(country_code=$2 OR $2=ANY(country_codes))" },
  campaign: { table: "campaigns", label: "name", scope: "($2=ANY(country_codes) OR COALESCE(cardinality(country_codes),0)=0)" },
  queue: { table: "inbound_queues", label: "name", scope: "(country_code=$2 OR country_code IS NULL)" },
  task: { table: "tasks", label: "title", scope: "(country=$2 OR country IS NULL)" },
  contract: { table: "contract_instances", label: "contract_number",
    scope: "EXISTS (SELECT 1 FROM customers c WHERE c.id=contract_instances.customer_id AND c.country=$2)" },
  invoice: { table: "invoices", label: "invoice_number",
    scope: "EXISTS (SELECT 1 FROM customers c WHERE c.id=invoices.customer_id AND c.country=$2)" },
};

export function createAutomationReferenceLookup(query: { query: (sql: string, values?: any[]) => Promise<{ rows: any[] }> }): ReferenceLookup {
  return async (kind, id, country) => {
    const source = sources[kind];
    // Contact names must stay within the trusted event country. Staff/group
    // directory names are global, but no emails, credentials or full rows leave here.
    if (source.scope && !country) return null;
    const result = await query.query(
      `SELECT ${source.label} AS label FROM ${source.table} WHERE id=$1${
        source.scope ? ` AND ${source.scope}` : ""
      } LIMIT 1`, source.scope ? [id, country] : [id],
    );
    return result.rows[0]?.label || null;
  };
}
export const lookupAutomationReference = createAutomationReferenceLookup(pool);
