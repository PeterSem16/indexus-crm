import type { LegalEntityActor } from "./healthcare-legal-entity-access";
import { LegalEntityError } from "./orsr-client";
import { inLegalTransaction, legalEntityRow, legalEntitySummary, facilityLinks, directLegalPeople, relatedLegalPeople } from "./healthcare-legal-entity-store";

/** Private on-demand export; no public files or document URLs are created. */
export async function healthcareLegalEntityExport(entityId: string, snapshotId: string | undefined, actor: LegalEntityActor) {
  if (!actor.canRead || !actor.canViewSensitive) throw new LegalEntityError("forbidden", 403);
  return inLegalTransaction(async client => {
  // A simultaneous re-verification must not mix one entity version with a
  // different "latest" source snapshot in the same downloaded file.
  await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const row = await legalEntityRow(entityId, client);
  const result = await client.query(`SELECT * FROM healthcare_legal_entity_snapshots
    WHERE legal_entity_id=$1 AND ($2::varchar IS NULL OR id=$2)
    ORDER BY checked_at DESC,created_at DESC,id DESC LIMIT 1`, [entityId, snapshotId || null]);
  const snapshot = result.rows[0];
  if (!snapshot) throw new LegalEntityError("not_found", 404);
  const [history, audit, facilities, people, personLinks] = await Promise.all([
    client.query(`SELECT id,checked_at AS "checkedAt",source_updated_at AS "sourceUpdatedAt",created_at AS "savedAt"
      FROM healthcare_legal_entity_snapshots WHERE legal_entity_id=$1 ORDER BY checked_at DESC,created_at DESC,id DESC`, [entityId]),
    client.query(`SELECT id,occurred_at AS "occurredAt",kind FROM healthcare_legal_entity_audit
      WHERE legal_entity_id=$1 ORDER BY occurred_at DESC,id`, [entityId]),
    actor.canReadFacilities ? facilityLinks(entityId, undefined, undefined, client) : Promise.resolve([]),
    actor.canReadFacilities && actor.canReadPersons ? relatedLegalPeople(entityId, undefined, client) : Promise.resolve([]),
    actor.canReadPersons ? directLegalPeople(entityId, undefined, client) : Promise.resolve([]),
  ]);
  const checkedAt = new Date(snapshot.checked_at).toISOString();
  const bundle = {
    format: "indexus.healthcare-legal-entity.v1",
    exportedAt: new Date().toISOString(),
    source: { provider: "OR SR", url: "https://sluzby.orsr.sk", documentFilesIncluded: false },
    entity: legalEntitySummary(row),
    snapshot: {
      id: snapshot.id, checkedAt, sourceUpdatedAt: snapshot.source_updated_at,
      savedAt: new Date(snapshot.created_at).toISOString(),
      company: snapshot.normalized, registryPeople: snapshot.registry_people,
      rawData: snapshot.raw_data,
    },
    relationships: { facilities, people, personLinks },
    history: history.rows, audit: audit.rows,
  };
  return {
    filename: `healthcare-legal-entity-${row.ico}-orsr-${checkedAt.slice(0, 10)}.json`,
    content: JSON.stringify(bundle, null, 2) + "\n",
  };
  });
}
