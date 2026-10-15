import type { PoolClient } from "pg";
import { pool } from "../db";
import { LEGAL_ENTITY_EDITABLE_FIELDS, type FacilityType, type LegalEntitySummary, type RegistryPerson } from "../../shared/healthcare-legal-entity";
import { LegalEntityError } from "./orsr-client";
import type { LegalEntityActor } from "./healthcare-legal-entity-access";
import { readLegalFacility } from "./healthcare-legal-entity-access";

export function legalEntitySummary(row: any): LegalEntitySummary {
  const details = Object.fromEntries(LEGAL_ENTITY_EDITABLE_FIELDS
    .filter(field => typeof row.details?.[field] === "string")
    .map(field => [field, row.details[field]]));
  return { ...row.normalized, ...details, details, registryCompany: row.normalized,
    id: row.id, notes: row.notes, checkedAt: new Date(row.checked_at).toISOString(),
    sourceUpdatedAt: row.source_updated_at, facilityCount: row.facility_count == null ? undefined : Number(row.facility_count),
    personCount: row.person_count == null ? undefined : Number(row.person_count) };
}
export async function inLegalTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await fn(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function legalAudit(client: any, entityId: string, actor: LegalEntityActor, kind: string, details: Record<string, unknown> = {}) {
  await client.query(`INSERT INTO healthcare_legal_entity_audit(legal_entity_id,actor_id,kind,details) VALUES($1,$2,$3,$4)`,
    [entityId, actor.id, kind, JSON.stringify(details)]);
}
export async function legalEntityRow(id: string, client: any = pool) {
  const { rows } = await client.query(`SELECT * FROM healthcare_legal_entities WHERE id=$1`, [id]);
  if (!rows[0]) throw new LegalEntityError("not_found", 404);
  return rows[0];
}
export async function facilityLinks(entityId: string | null, facilityType?: FacilityType, facilityId?: string, client: any = pool) {
  const { rows } = await client.query(`SELECT l.id,l.legal_entity_id AS "legalEntityId",l.facility_type AS "facilityType",
    l.facility_id AS "facilityId",COALESCE(c.name,h.name,'') AS "facilityName",l.relationship,
    l.valid_from AS "validFrom",l.valid_to AS "validTo",l.confirmed_at AS "confirmedAt",e.normalized->>'name' AS "legalEntityName"
    FROM healthcare_legal_entity_facilities l
    JOIN healthcare_legal_entities e ON e.id=l.legal_entity_id
    LEFT JOIN clinics c ON l.facility_type='clinic' AND c.id=l.facility_id AND c.country_code='SK'
    LEFT JOIN hospitals h ON l.facility_type='hospital' AND h.id=l.facility_id AND h.country_code='SK'
    WHERE ($1::varchar IS NULL OR l.legal_entity_id=$1)
      AND ($2::text IS NULL OR (l.facility_type=$2 AND l.facility_id=$3))
      AND COALESCE(c.id,h.id) IS NOT NULL ORDER BY l.valid_from DESC,l.id`, [entityId, facilityType || null, facilityId || null]);
  return rows;
}
export async function relatedLegalPeople(entityId: string | null, personId?: string, client: any = pool) {
  const { rows } = await client.query(`SELECT DISTINCT p.id AS "personId", concat_ws(' ',p.first_name,p.last_name) AS "personName",
    a.entity_type AS "facilityType",a.entity_id AS "facilityId",COALESCE(c.name,h.name) AS "facilityName",
    l.legal_entity_id AS "legalEntityId",e.normalized->>'name' AS "legalEntityName",a.role,
    a.start_date AS "validFrom",a.end_date AS "validTo"
    FROM contact_assignments a JOIN collaborators p ON p.id=a.person_id
    JOIN healthcare_legal_entity_facilities l ON l.facility_type=a.entity_type AND l.facility_id=a.entity_id
      AND l.valid_to IS NULL
    JOIN healthcare_legal_entities e ON e.id=l.legal_entity_id
    LEFT JOIN clinics c ON a.entity_type='clinic' AND c.id=a.entity_id AND c.country_code='SK'
    LEFT JOIN hospitals h ON a.entity_type='hospital' AND h.id=a.entity_id AND h.country_code='SK'
    WHERE ($1::varchar IS NULL OR e.id=$1) AND ($2::varchar IS NULL OR p.id=$2)
      AND a.is_active=true AND (a.start_date IS NULL OR a.start_date<=now())
      AND (a.end_date IS NULL OR a.end_date>now())
      AND (p.country_code='SK' OR 'SK'=ANY(p.country_codes))
      AND COALESCE(c.id,h.id) IS NOT NULL ORDER BY "personName","facilityName"`, [entityId, personId || null]);
  return rows;
}
export async function directLegalPeople(entityId: string | null, personId?: string, client: any = pool) {
  const { rows } = await client.query(`SELECT l.id,l.legal_entity_id AS "legalEntityId",l.person_id AS "personId",
    concat_ws(' ',p.first_name,p.last_name) AS "personName",l.registry_person_key AS "registryPersonKey",
    l.role,l.valid_from AS "validFrom",l.valid_to AS "validTo",e.normalized->>'name' AS "legalEntityName"
    FROM healthcare_legal_entity_person_links l JOIN collaborators p ON p.id=l.person_id
    JOIN healthcare_legal_entities e ON e.id=l.legal_entity_id
    WHERE ($1::varchar IS NULL OR l.legal_entity_id=$1) AND ($2::varchar IS NULL OR p.id=$2)
      AND (p.country_code='SK' OR 'SK'=ANY(p.country_codes)) ORDER BY l.valid_from DESC`, [entityId, personId || null]);
  return rows;
}
export async function confirmFacilityLink(client: PoolClient, actor: LegalEntityActor, entityId: string,
  type: FacilityType, id: string, confirm: unknown, replace: unknown) {
  if (confirm !== true) throw new LegalEntityError("confirmation_required");
  const facility = await readLegalFacility(type, id, actor, true, client);
  const entity = await legalEntityRow(entityId, client);
  if (facility.ico && facility.ico.replace(/\s/g, "") !== entity.ico) throw new LegalEntityError("ico_mismatch", 409);
  // The facility row lock serializes imports and link replacements, even when no link exists yet.
  const active = await client.query(`SELECT * FROM healthcare_legal_entity_facilities
    WHERE facility_type=$1 AND facility_id=$2 AND valid_to IS NULL FOR UPDATE`, [type, id]);
  if (active.rows[0]?.legal_entity_id === entityId) return active.rows[0].id as string;
  if (active.rows.length && replace !== true) throw new LegalEntityError("operator_conflict", 409);
  if (active.rows.length) {
    await client.query(`UPDATE healthcare_legal_entity_facilities SET valid_to=now(),ended_by=$1
      WHERE id=$2`, [actor.id, active.rows[0].id]);
    await legalAudit(client, active.rows[0].legal_entity_id, actor, "operator_ended", { facilityType: type, facilityId: id });
  }
  const { rows } = await client.query(`INSERT INTO healthcare_legal_entity_facilities
    (legal_entity_id,facility_type,facility_id,confirmed_by) VALUES($1,$2,$3,$4) RETURNING id`, [entityId, type, id, actor.id]);
  await legalAudit(client, entityId, actor, "operator_confirmed", { facilityType: type, facilityId: id });
  return rows[0].id as string;
}
export async function saveLegalVerification(actor: LegalEntityActor, body: any) {
  return inLegalTransaction(async client => {
    const { rows } = await client.query(`SELECT * FROM healthcare_legal_entity_verifications
      WHERE id=$1 AND created_by=$2 FOR UPDATE`, [body.verificationId, actor.id]);
    const verification = rows[0];
    if (!verification || new Date(verification.expires_at).getTime() <= Date.now())
      throw new LegalEntityError("verification_expired", 409);
    if (verification.facility_type && (verification.facility_type !== (body.facilityType || null) || verification.facility_id !== (body.facilityId || null)))
      throw new LegalEntityError("verification_context_mismatch", 409);
    if (verification.used_at) {
      // A lost response can be retried, but cannot apply a different linking/update request.
      throw new LegalEntityError("verification_used", 409);
    }
    const company = verification.normalized;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`healthcare-legal:SK:${company.ico}`]);
    const existing = await client.query(`SELECT * FROM healthcare_legal_entities WHERE country_code='SK' AND ico=$1 FOR UPDATE`, [company.ico]);
    if (!existing.rows.length && !actor.canAdd) throw new LegalEntityError("forbidden", 403);
    if (existing.rows.length && !actor.canEdit) throw new LegalEntityError("forbidden", 403);
    // Old previews must never overwrite a newer completed verification.
    if (existing.rows[0] && new Date(existing.rows[0].checked_at) > new Date(verification.checked_at))
      throw new LegalEntityError("stale_verification", 409);
    const fields = body.applyFields || [];
    if (fields.length && !body.facilityId) throw new LegalEntityError("invalid");
    if (body.facilityId) {
      const facility = await readLegalFacility(body.facilityType, body.facilityId, actor, true, client);
      if (facility.ico && facility.ico.replace(/\s/g, "") !== company.ico) {
        if (!fields.includes("ico")) throw new LegalEntityError("ico_mismatch", 409);
        // An explicit field selection may change the operator IČO. This stays
        // in the same transaction: a missing replacement confirmation rolls it back.
        await client.query(`UPDATE ${body.facilityType === "clinic" ? "clinics" : "hospitals"} SET ico=$2 WHERE id=$1`,
          [body.facilityId, company.ico]);
      }
    }
    const saved = await client.query(`INSERT INTO healthcare_legal_entities(country_code,ico,normalized,checked_at,source_updated_at,created_by)
      VALUES('SK',$1,$2,$3,$4,$5) ON CONFLICT(country_code,ico) DO UPDATE SET
      normalized=excluded.normalized,checked_at=excluded.checked_at,source_updated_at=excluded.source_updated_at,updated_at=now()
      RETURNING *`, [company.ico, JSON.stringify(company), verification.checked_at, verification.source_updated_at, actor.id]);
    const entityId = saved.rows[0].id;
    await client.query(`INSERT INTO healthcare_legal_entity_snapshots(legal_entity_id,normalized,registry_people,raw_data,checked_at,source_updated_at,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [entityId, JSON.stringify(company), JSON.stringify(verification.registry_people),
      JSON.stringify(verification.raw_data), verification.checked_at, verification.source_updated_at, actor.id]);
    let linkId: string | null = null;
    if (body.facilityId) {
      linkId = await confirmFacilityLink(client, actor, entityId, body.facilityType, body.facilityId, body.confirmOperator, body.replaceExisting);
      const mapping: Record<string, [string, any]> = {
        name: ["name", company.name], ico: ["ico", company.ico],
        address: [body.facilityType === "clinic" ? "address" : "street_number", company.registeredAddress],
        city: ["city", company.city], postalCode: ["postal_code", company.postalCode],
      };
      if (fields.length) {
        const values: unknown[] = [body.facilityId];
        const updates = fields.map((field: string) => {
          const [column, value] = mapping[field];
          if (value === null || value === undefined || value === "") throw new LegalEntityError("source_field_empty");
          values.push(value);
          return `${column}=$${values.length}`;
        });
        if (body.facilityType === "hospital" && fields.includes("name")) {
          values.push(company.name);
          updates.push(`full_name=$${values.length}`);
        }
        await client.query(`UPDATE ${body.facilityType === "clinic" ? "clinics" : "hospitals"} SET ${updates.join(",")} WHERE id=$1`, values);
        await legalAudit(client, entityId, actor, "facility_fields_updated", { facilityType: body.facilityType, facilityId: body.facilityId, fields });
      }
    }
    await client.query(`UPDATE healthcare_legal_entity_verifications SET used_at=now(),result_entity_id=$2 WHERE id=$1`, [verification.id, entityId]);
    await legalAudit(client, entityId, actor, "registry_saved");
    return { entityId, linkId };
  });
}
export async function latestRegistryPeople(entityId: string, client: any = pool): Promise<RegistryPerson[]> {
  const { rows } = await client.query(`SELECT registry_people FROM healthcare_legal_entity_snapshots
    WHERE legal_entity_id=$1 ORDER BY checked_at DESC,created_at DESC,id DESC LIMIT 1`, [entityId]);
  return rows[0]?.registry_people || [];
}
