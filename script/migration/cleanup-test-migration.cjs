#!/usr/bin/env node
/**
 * Cleanup testovacích 20 záznamov z INDEXUS
 * Vymaže iba záznamy s legacy_id/internal_id (= importované z ISCBC)
 * Run on Ubuntu: node cleanup-test-migration.cjs
 */
const { Pool } = require('pg');

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'indexus_crm',
  user: 'indexus',
  password: 'HanyurIfKisck',
};

async function main() {
  const pool = new Pool(PG_CONFIG);

  console.log('=== Cleanup testovacích migračných dát ===\n');

  const tables = [
    { name: 'customer_debt_collection (migrated)', query: "DELETE FROM customer_debt_collection WHERE data_source = 'iscbc'" },
    { name: 'customer_documents (migrated)', query: "DELETE FROM customer_documents WHERE data_source = 'iscbc'" },
    { name: 'communication_messages (legacy)', query: "DELETE FROM communication_messages WHERE provider = 'cbc_legacy'" },
    { name: 'customer_notes (legacy)', query: "DELETE FROM customer_notes WHERE legacy_id IS NOT NULL" },
    { name: 'collection_lab_results', query: "DELETE FROM collection_lab_results WHERE collection_id IN (SELECT id FROM collections WHERE legacy_id IS NOT NULL)" },
    { name: 'customer_potential_cases', query: "DELETE FROM customer_potential_cases WHERE customer_id IN (SELECT id FROM customers WHERE internal_id IS NOT NULL)" },
    { name: 'collections (migrated)', query: "DELETE FROM collections WHERE legacy_id IS NOT NULL" },
    { name: 'collaborator_activities', query: "DELETE FROM collaborator_activities WHERE legacy_id IS NOT NULL" },
    { name: 'collaborator_addresses', query: "DELETE FROM collaborator_addresses WHERE legacy_id IS NOT NULL" },
    { name: 'collaborator_agreements', query: "DELETE FROM collaborator_agreements WHERE collaborator_id IN (SELECT id FROM collaborators WHERE legacy_id IS NOT NULL)" },
    { name: 'customers (migrated)', query: "DELETE FROM customers WHERE internal_id IS NOT NULL" },
    { name: 'collaborators (migrated)', query: "DELETE FROM collaborators WHERE legacy_id IS NOT NULL" },
    { name: 'hospitals (migrated)', query: "DELETE FROM hospitals WHERE legacy_id IS NOT NULL" },
  ];

  for (const t of tables) {
    const result = await pool.query(t.query);
    console.log(`  ${t.name}: ${result.rowCount} záznamov vymazaných`);
  }

  console.log('\n✓ Cleanup dokončený. Referenčné dáta (statuses, labs) ponechané.');
  await pool.end();
}

main().catch(console.error);
