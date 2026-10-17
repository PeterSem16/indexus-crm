import type { LegalEntityActor } from "./healthcare-legal-entity-access";
import { assertLegalCountry } from "./healthcare-legal-entity-access";
import { LegalEntityError } from "./orsr-client";
import { inLegalTransaction, legalEntityRow, savedSnapshotComparison } from "./healthcare-legal-entity-store";
import { registryComparisonDocument } from "../../shared/healthcare-legal-entity-comparison-document";
import { healthcareLegalEntityTranslations } from "../../client/src/i18n/healthcare-legal-entity-translations";

export type ComparisonLocale = keyof typeof healthcareLegalEntityTranslations;

/** Read-only public comparison, distinct from the restricted raw-source export. */
export async function healthcareLegalEntityComparisonExport(
  entityId: string, snapshotId: string, actor: LegalEntityActor, locale: ComparisonLocale,
) {
  if (!actor.canRead) throw new LegalEntityError("forbidden", 403);
  return inLegalTransaction(async client => {
    await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const entity = await legalEntityRow(entityId, client);
    assertLegalCountry(actor, entity.country_code);
    const comparison = await savedSnapshotComparison(entityId, snapshotId, client);
    // Identity belongs to the selected historical snapshot, never mutable CRM edits.
    const { rows } = await client.query(`SELECT normalized FROM healthcare_legal_entity_snapshots
      WHERE legal_entity_id=$1 AND id=$2`, [entityId, snapshotId]);
    if (!rows[0]) throw new LegalEntityError("not_found", 404);
    const company = rows[0].normalized;
    return {
      filename: `${company.countryCode === "CZ" ? "ares" : company.countryCode === "RO" ? "anaf" : "orsr"}-comparison-${company.ico}-${comparison.current.checkedAt.slice(0, 10)}.html`,
      content: registryComparisonDocument(comparison, company, healthcareLegalEntityTranslations[locale], locale),
    };
  });
}
