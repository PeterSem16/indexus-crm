import type { PoolClient } from "pg";
import { pool } from "../db";
import { LEGAL_ENTITY_EDITABLE_FIELDS, type FacilityType, type LegalEntitySummary, type RegistryPerson } from "../../shared/healthcare-legal-entity";
import { LegalEntityError } from "./orsr-client";
import type { LegalEntityActor } from "./healthcare-legal-entity-access";
import { readLegalFacility, assertLegalCountry } from "./healthcare-legal-entity-access";
import { normalizeCompanyId } from "./company-registry-client";
import { compareRegistrySnapshots, hasRegistryChanges, registryReviewStatus, registryComparisonKey,
  REGISTRY_COMPARISON_KEY_VERSION, type RegistrySnapshot } from "../../shared/healthcare-legal-entity-diff";

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
    l.valid_from AS "validFrom",l.valid_to AS "validTo",l.confirmed_at AS "confirmedAt",e.normalized->>'name' AS "legalEntityName",
    u.full_name AS "confirmedByName"
    FROM healthcare_legal_entity_facilities l
    JOIN healthcare_legal_entities e ON e.id=l.legal_entity_id
    LEFT JOIN users u ON u.id=l.confirmed_by
    LEFT JOIN clinics c ON l.facility_type='clinic' AND c.id=l.facility_id AND c.country_code=e.country_code
    LEFT JOIN hospitals h ON l.facility_type='hospital' AND h.id=l.facility_id AND h.country_code=e.country_code
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
    LEFT JOIN clinics c ON a.entity_type='clinic' AND c.id=a.entity_id AND c.country_code=e.country_code
    LEFT JOIN hospitals h ON a.entity_type='hospital' AND h.id=a.entity_id AND h.country_code=e.country_code
    WHERE ($1::varchar IS NULL OR e.id=$1) AND ($2::varchar IS NULL OR p.id=$2)
      AND a.is_active=true AND (a.start_date IS NULL OR a.start_date<=now())
      AND (a.end_date IS NULL OR a.end_date>now())
      AND (p.country_code=e.country_code OR e.country_code=ANY(p.country_codes))
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
      AND (p.country_code=e.country_code OR e.country_code=ANY(p.country_codes)) ORDER BY l.valid_from DESC`, [entityId, personId || null]);
  return rows;
}
export async function confirmFacilityLink(client: PoolClient, actor: LegalEntityActor, entityId: string,
  type: FacilityType, id: string, confirm: unknown, replace: unknown) {
  if (confirm !== true) throw new LegalEntityError("confirmation_required");
  const facility = await readLegalFacility(type, id, actor, true, client);
  const entity = await legalEntityRow(entityId, client);
  assertLegalCountry(actor, entity.country_code);
  if (facility.countryCode !== entity.country_code) throw new LegalEntityError("country_mismatch", 409);
  if (facility.ico && normalizeCompanyId(facility.ico, entity.country_code) !== entity.ico) throw new LegalEntityError("ico_mismatch", 409);
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
  if (body.applyFields !== undefined && (!Array.isArray(body.applyFields) || body.applyFields.length > 0))
    throw new LegalEntityError("invalid");
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
    assertLegalCountry(actor, company.countryCode);
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`healthcare-legal:${company.countryCode}:${company.ico}`]);
    const existing = await client.query(`SELECT * FROM healthcare_legal_entities WHERE country_code=$2 AND ico=$1 FOR UPDATE`, [company.ico, company.countryCode]);
    if (!existing.rows.length && !actor.canAdd) throw new LegalEntityError("forbidden", 403);
    if (existing.rows.length && !actor.canEdit) throw new LegalEntityError("forbidden", 403);
    // Old previews must never overwrite a newer completed verification.
    if (existing.rows[0] && new Date(existing.rows[0].checked_at) > new Date(verification.checked_at))
      throw new LegalEntityError("stale_verification", 409);
    if (body.facilityId) {
      const facility = await readLegalFacility(body.facilityType, body.facilityId, actor, true, client);
      if (facility.countryCode !== company.countryCode) throw new LegalEntityError("country_mismatch", 409);
      if (facility.ico && normalizeCompanyId(facility.ico, company.countryCode) !== company.ico)
        throw new LegalEntityError("ico_mismatch", 409);
    }
    const saved = await client.query(`INSERT INTO healthcare_legal_entities(country_code,ico,normalized,checked_at,source_updated_at,created_by)
      VALUES($6,$1,$2,$3,$4,$5) ON CONFLICT(country_code,ico) DO UPDATE SET
      normalized=excluded.normalized,checked_at=excluded.checked_at,source_updated_at=excluded.source_updated_at,updated_at=now()
      RETURNING *`, [company.ico, JSON.stringify(company), verification.checked_at, verification.source_updated_at, actor.id, company.countryCode]);
    const entityId = saved.rows[0].id;
    const snapshot = await client.query(`INSERT INTO healthcare_legal_entity_snapshots(legal_entity_id,normalized,registry_people,raw_data,checked_at,source_updated_at,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [entityId, JSON.stringify(company), JSON.stringify(verification.registry_people),
      JSON.stringify(verification.raw_data), verification.checked_at, verification.source_updated_at, actor.id]);
    await writeRegistryComparisonKeys(client, [{ id: snapshot.rows[0].id,
      normalized: company, registry_people: verification.registry_people }]);
    let linkId: string | null = null;
    if (body.facilityId) {
      linkId = await confirmFacilityLink(client, actor, entityId, body.facilityType, body.facilityId, body.confirmOperator, body.replaceExisting);
    }
    await client.query(`UPDATE healthcare_legal_entity_verifications SET used_at=now(),result_entity_id=$2 WHERE id=$1`, [verification.id, entityId]);
    await legalAudit(client, entityId, actor, "registry_saved");
    return { entityId, linkId, comparison: await savedSnapshotComparison(entityId, snapshot.rows[0].id, client) };
  });
}
export async function latestRegistryPeople(entityId: string, client: any = pool): Promise<RegistryPerson[]> {
  const { rows } = await client.query(`SELECT registry_people FROM healthcare_legal_entity_snapshots
    WHERE legal_entity_id=$1 ORDER BY checked_at DESC,created_at DESC,id DESC LIMIT 1`, [entityId]);
  return rows[0]?.registry_people || [];
}

export function registrySnapshot(row: any): RegistrySnapshot {
  return {
    summary: { id: row.id, checkedAt: new Date(row.checked_at).toISOString(), sourceUpdatedAt: row.source_updated_at,
      createdByName: row.created_by_name,
      review: row.reviewed_at ? { reviewedBy: row.reviewed_by, reviewedByName: row.reviewed_by_name,
        reviewedAt: new Date(row.reviewed_at).toISOString(), note: row.review_note ?? null } : null },
    company: row.normalized,
    people: row.registry_people || [],
  };
}

export const REGISTRY_KEY_BATCH_SIZE = 128;

async function writeRegistryComparisonKeys(client: Pick<PoolClient, "query">, rows: any[]) {
  const keys = rows.map(row => ({ snapshot_id: row.id,
    comparison_key: registryComparisonKey(row.normalized, row.registry_people || []) }));
  await client.query(`INSERT INTO healthcare_legal_entity_snapshot_comparison_keys(snapshot_id,key_version,comparison_key)
    SELECT snapshot_id,$2,comparison_key FROM jsonb_to_recordset($1::jsonb)
      AS k(snapshot_id varchar,comparison_key text)
    ON CONFLICT(snapshot_id) DO UPDATE SET key_version=excluded.key_version,comparison_key=excluded.comparison_key
      WHERE healthcare_legal_entity_snapshot_comparison_keys.key_version<>excluded.key_version`,
  [JSON.stringify(keys), REGISTRY_COMPARISON_KEY_VERSION]);
}

/** Must run inside a transaction on one dedicated client. Source rows remain immutable.
 * A server cursor bounds the cold backfill, including when upgrading diff semantics.
 * Concurrent readers can safely produce the same deterministic keys.
 */
export async function ensureRegistryComparisonKeys(client: Pick<PoolClient, "query">) {
  await client.query(`DECLARE hle_comparison_backfill NO SCROLL CURSOR FOR
    SELECT s.id,s.normalized,s.registry_people FROM healthcare_legal_entity_snapshots s
    LEFT JOIN healthcare_legal_entity_snapshot_comparison_keys k
      ON k.snapshot_id=s.id AND k.key_version=${REGISTRY_COMPARISON_KEY_VERSION}
    WHERE k.snapshot_id IS NULL ORDER BY s.id`);
  try {
    for (;;) {
      const { rows } = await client.query(`FETCH FORWARD ${REGISTRY_KEY_BATCH_SIZE} FROM hle_comparison_backfill`);
      if (!rows.length) break;
      await writeRegistryComparisonKeys(client, rows);
    }
  } finally {
    await client.query("CLOSE hle_comparison_backfill");
  }
}

/** Only compact derived facts are scanned on warm reads; no history JSON enters Node.
 * No pending-count cache: every response sees committed reviews immediately.
 */
export async function listLegalEntities(countries: readonly string[] = ["SK"]) {
  return inLegalTransaction(async client => {
    await ensureRegistryComparisonKeys(client);
    const { rows } = await client.query(`WITH ordered AS (
      SELECT s.legal_entity_id,s.id,s.checked_at,s.created_at,k.comparison_key,r.reviewed_at,
        lag(k.comparison_key) OVER (
          PARTITION BY s.legal_entity_id ORDER BY s.checked_at,s.created_at,s.id) AS previous_key,
        row_number() OVER (
          PARTITION BY s.legal_entity_id ORDER BY s.checked_at DESC,s.created_at DESC,s.id DESC) AS newest
      FROM healthcare_legal_entity_snapshots s
      JOIN healthcare_legal_entity_snapshot_comparison_keys k ON k.snapshot_id=s.id AND k.key_version=$1
      LEFT JOIN healthcare_legal_entity_snapshot_reviews r ON r.snapshot_id=s.id
    ), statuses AS (
      SELECT *,CASE WHEN previous_key IS NULL THEN 'baseline'
        WHEN comparison_key=previous_key THEN 'unchanged'
        WHEN reviewed_at IS NOT NULL THEN 'reviewed' ELSE 'pending' END AS change_status FROM ordered
    ), overview AS (
      SELECT legal_entity_id,max(change_status) FILTER (WHERE newest=1) AS change_status,
        count(*) FILTER (WHERE change_status='pending') AS pending_count
      FROM statuses GROUP BY legal_entity_id
    )
    SELECT e.*,o.change_status,COALESCE(o.pending_count,0) AS pending_count,
      (SELECT count(*) FROM healthcare_legal_entity_facilities l
        WHERE l.legal_entity_id=e.id AND l.valid_to IS NULL) AS facility_count
    FROM healthcare_legal_entities e LEFT JOIN overview o ON o.legal_entity_id=e.id
    WHERE e.country_code=ANY($2::text[])
    ORDER BY e.normalized->>'name',e.id`, [REGISTRY_COMPARISON_KEY_VERSION, countries]);
    return rows.map(row => ({ ...legalEntitySummary(row), changeStatus: row.change_status || "baseline",
      pendingSnapshotCount: Number(row.pending_count) }));
  });
}

/** Rows must be newest first, ordered by checked_at, created_at, id. */
export function savedRegistryHistory(rows: any[]) {
  return rows.map((row, index) => {
    const comparison = compareRegistrySnapshots(rows[index + 1] ? registrySnapshot(rows[index + 1]) : null, registrySnapshot(row));
    return { ...comparison.current, kind: "registry", changeStatus: registryReviewStatus(comparison) };
  });
}
export async function savedSnapshotComparison(entityId: string, snapshotId: string, client: any = pool) {
  // Order by verification time with deterministic tie breakers, just like history.
  const { rows } = await client.query(`SELECT s.id,s.normalized,s.registry_people,s.checked_at,s.source_updated_at,
      r.reviewed_by,r.reviewed_by_name,r.reviewed_at,r.note AS review_note
    FROM healthcare_legal_entity_snapshots s
    LEFT JOIN healthcare_legal_entity_snapshot_reviews r ON r.snapshot_id=s.id WHERE s.legal_entity_id=$1
    AND (s.checked_at,s.created_at,s.id) <= (SELECT checked_at,created_at,id FROM healthcare_legal_entity_snapshots
      WHERE legal_entity_id=$1 AND id=$2)
    ORDER BY s.checked_at DESC,s.created_at DESC,s.id DESC LIMIT 2`, [entityId, snapshotId]);
  if (!rows[0] || rows[0].id !== snapshotId) throw new LegalEntityError("not_found", 404);
  return compareRegistrySnapshots(rows[1] ? registrySnapshot(rows[1]) : null, registrySnapshot(rows[0]));
}

/** First review wins, including concurrent submissions and retries. Source rows are never updated. */
export async function reviewSavedSnapshot(actor: LegalEntityActor, entityId: string, snapshotId: string, note?: string) {
  if (!actor.canRead || !actor.canEdit) throw new LegalEntityError("forbidden", 403);
  return inLegalTransaction(async client => {
    const locked = await client.query(`SELECT id FROM healthcare_legal_entity_snapshots
      WHERE legal_entity_id=$1 AND id=$2 FOR UPDATE`, [entityId, snapshotId]);
    if (!locked.rows[0]) throw new LegalEntityError("not_found", 404);
    const comparison = await savedSnapshotComparison(entityId, snapshotId, client);
    if (!hasRegistryChanges(comparison)) throw new LegalEntityError("no_changes", 409);
    const result = await client.query(`INSERT INTO healthcare_legal_entity_snapshot_reviews
      (snapshot_id,reviewed_by,reviewed_by_name,note)
      SELECT $1,id,full_name,$3 FROM users WHERE id=$2
      ON CONFLICT(snapshot_id) DO NOTHING RETURNING snapshot_id`, [snapshotId, actor.id, note?.trim() || null]);
    if (result.rows.length) await legalAudit(client, entityId, actor, "registry_changes_reviewed", { snapshotId });
    return savedSnapshotComparison(entityId, snapshotId, client);
  });
}

/** Load only displayable comparison facts, never raw source data. */
export async function snapshotHistory(entityId: string, client: any = pool) {
  const { rows } = await client.query(`SELECT s.id,s.normalized,s.registry_people,s.checked_at,s.source_updated_at,
      u.full_name AS created_by_name,r.reviewed_by,r.reviewed_by_name,r.reviewed_at,r.note AS review_note
    FROM healthcare_legal_entity_snapshots s LEFT JOIN users u ON u.id=s.created_by
    LEFT JOIN healthcare_legal_entity_snapshot_reviews r ON r.snapshot_id=s.id
    WHERE s.legal_entity_id=$1 ORDER BY s.checked_at DESC,s.created_at DESC,s.id DESC`, [entityId]);
  return savedRegistryHistory(rows);
}
