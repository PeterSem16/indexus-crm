#!/usr/bin/env node
/**
 * PROCEDÚRA A: Plný cleanup — vymaže všetky dáta okrem Peter Seman
 * Resetuje číselníky (number_ranges) na počiatočnú hodnotu
 * Run on Ubuntu: node script/migration/cleanup-full-migration.cjs
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

  console.log('══════════════════════════════════════════════════════════════');
  console.log('  PROCEDÚRA A: Plný cleanup (všetko okrem Peter Seman)');
  console.log('══════════════════════════════════════════════════════════════\n');

  // --- Nájdi Peter Seman customer ID ---
  const psRes = await pool.query(`
    SELECT id FROM customers 
    WHERE LOWER(first_name) = 'peter' AND LOWER(last_name) = 'seman'
    LIMIT 1
  `);
  const peterSemanId = psRes.rows.length > 0 ? psRes.rows[0].id : null;
  if (peterSemanId) {
    console.log(`  ✓ Peter Seman nájdený: ID = ${peterSemanId} (bude ponechaný)\n`);
  } else {
    console.log(`  ⚠ Peter Seman nenájdený — pokračujem s cleanup všetkých dát\n`);
  }

  const excludeCustomer = peterSemanId ? `AND customer_id != '${peterSemanId}'` : '';
  const excludeCustomerId = peterSemanId ? `AND id != '${peterSemanId}'` : '';

  // --- Počty pred cleanup ---
  console.log('--- Stav pred cleanup ---');
  const countTables = [
    { name: 'customers', query: 'SELECT count(*) FROM customers' },
    { name: 'contract_instances', query: 'SELECT count(*) FROM contract_instances' },
    { name: 'invoices', query: 'SELECT count(*) FROM invoices' },
    { name: 'scheduled_invoices', query: 'SELECT count(*) FROM scheduled_invoices' },
    { name: 'customer_documents', query: 'SELECT count(*) FROM customer_documents' },
    { name: 'customer_debt_collection', query: 'SELECT count(*) FROM customer_debt_collection' },
    { name: 'collections', query: 'SELECT count(*) FROM collections' },
    { name: 'collaborators', query: 'SELECT count(*) FROM collaborators' },
    { name: 'hospitals', query: 'SELECT count(*) FROM hospitals' },
  ];
  for (const t of countTables) {
    const r = await pool.query(t.query);
    console.log(`  ${t.name}: ${r.rows[0].count}`);
  }
  console.log('');

  // --- DELETE v správnom poradí (FK závislosti) ---
  console.log('--- Mazanie dát ---');

  const deleteSteps = [
    // 1. Scheduled invoices
    {
      name: 'scheduled_invoices',
      query: peterSemanId
        ? `DELETE FROM scheduled_invoices WHERE customer_id != '${peterSemanId}'`
        : 'DELETE FROM scheduled_invoices'
    },
    // 2. Invoice payments
    {
      name: 'invoice_payments',
      query: peterSemanId
        ? `DELETE FROM invoice_payments WHERE invoice_id IN (SELECT id FROM invoices WHERE customer_id != '${peterSemanId}')`
        : 'DELETE FROM invoice_payments'
    },
    // 3. Invoice items
    {
      name: 'invoice_items',
      query: peterSemanId
        ? `DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE customer_id != '${peterSemanId}')`
        : 'DELETE FROM invoice_items'
    },
    // 4. Invoices
    {
      name: 'invoices',
      query: peterSemanId
        ? `DELETE FROM invoices WHERE customer_id != '${peterSemanId}'`
        : 'DELETE FROM invoices'
    },
    // 5. Contract instances
    {
      name: 'contract_instances',
      query: peterSemanId
        ? `DELETE FROM contract_instances WHERE customer_id != '${peterSemanId}'`
        : 'DELETE FROM contract_instances'
    },
    // 6. Customer debt collection
    {
      name: 'customer_debt_collection',
      query: peterSemanId
        ? `DELETE FROM customer_debt_collection WHERE customer_id != '${peterSemanId}'`
        : 'DELETE FROM customer_debt_collection'
    },
    // 7. Customer documents (invoices/contracts)
    {
      name: 'customer_documents',
      query: peterSemanId
        ? `DELETE FROM customer_documents WHERE customer_id != '${peterSemanId}'`
        : 'DELETE FROM customer_documents'
    },
    // 8. Communication messages
    {
      name: 'communication_messages',
      query: peterSemanId
        ? `DELETE FROM communication_messages WHERE customer_id != '${peterSemanId}'`
        : 'DELETE FROM communication_messages'
    },
    // 9. Customer notes
    {
      name: 'customer_notes',
      query: peterSemanId
        ? `DELETE FROM customer_notes WHERE customer_id != '${peterSemanId}'`
        : 'DELETE FROM customer_notes'
    },
    // 10. Customer potential cases
    {
      name: 'customer_potential_cases',
      query: peterSemanId
        ? `DELETE FROM customer_potential_cases WHERE customer_id != '${peterSemanId}'`
        : 'DELETE FROM customer_potential_cases'
    },
    // 11. Collection lab results
    {
      name: 'collection_lab_results',
      query: 'DELETE FROM collection_lab_results WHERE collection_id IN (SELECT id FROM collections WHERE legacy_id IS NOT NULL)'
    },
    // 12. Collections (len migrované — upsert ich znova vytvorí)
    {
      name: 'collections (migrated)',
      query: "DELETE FROM collections WHERE legacy_id IS NOT NULL"
    },
    // 13. Collaborator activities (len migrované)
    {
      name: 'collaborator_activities (migrated)',
      query: "DELETE FROM collaborator_activities WHERE legacy_id IS NOT NULL"
    },
    // 14. Collaborator addresses (len migrované)
    {
      name: 'collaborator_addresses (migrated)',
      query: "DELETE FROM collaborator_addresses WHERE legacy_id IS NOT NULL"
    },
    // 15. Collaborator agreements (len migrované)
    {
      name: 'collaborator_agreements (migrated)',
      query: "DELETE FROM collaborator_agreements WHERE collaborator_id IN (SELECT id FROM collaborators WHERE legacy_id IS NOT NULL)"
    },
    // 16. Customers (všetci okrem Peter Seman)
    {
      name: 'customers',
      query: peterSemanId
        ? `DELETE FROM customers WHERE id != '${peterSemanId}'`
        : 'DELETE FROM customers'
    },
    // 17. Collaborators — NEmažeme, len sa upsertujú pri migrácii
    // 18. Hospitals — NEmažeme, len sa upsertujú pri migrácii
  ];

  for (const step of deleteSteps) {
    try {
      const result = await pool.query(step.query);
      console.log(`  ✓ ${step.name}: ${result.rowCount} vymazaných`);
    } catch (err) {
      console.log(`  ✗ ${step.name}: ${err.message}`);
    }
  }

  // --- Reset číselníkov ---
  console.log('\n--- Reset číselníkov (number_ranges) ---');
  const nrRes = await pool.query(`
    UPDATE number_ranges SET last_number_used = 0 WHERE is_active = true
  `);
  console.log(`  ✓ number_ranges: ${nrRes.rowCount} číselníkov resetovaných na 0`);

  // --- Počty po cleanup ---
  console.log('\n--- Stav po cleanup ---');
  for (const t of countTables) {
    const r = await pool.query(t.query);
    console.log(`  ${t.name}: ${r.rows[0].count}`);
  }

  // --- Peter Seman kontrola ---
  if (peterSemanId) {
    const psCheck = await pool.query(`SELECT id, first_name, last_name FROM customers WHERE id = $1`, [peterSemanId]);
    if (psCheck.rows.length > 0) {
      console.log(`\n  ✓ Peter Seman stále existuje (ID: ${peterSemanId})`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  ✓ Plný cleanup dokončený');
  console.log('  Ďalší krok: MIGRATION_LIMIT=100 node script/migration/test-migration-20.cjs');
  console.log('══════════════════════════════════════════════════════════════');

  await pool.end();
}

main().catch(console.error);
