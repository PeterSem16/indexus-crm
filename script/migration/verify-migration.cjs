#!/usr/bin/env node
/**
 * ISCBC → INDEXUS Migration Verification
 * Run on Ubuntu: node verify-migration.js
 * Compares record counts between MSSQL source and PostgreSQL target
 */
const sql = require('mssql');
const { Pool } = require('pg');

const MSSQL_CONFIG = {
  user: 'cbcuser',
  password: 'XqU0nNND',
  server: '10.1.2.2',
  port: 1433,
  database: 'ISCBC',
  options: { encrypt: false, trustServerCertificate: true, instanceName: 'MSSQLSTD' },
  connectionTimeout: 15000,
  requestTimeout: 60000,
};

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'indexus_crm',
  user: 'indexus',
  password: 'HanyurIfKisck',
};

async function main() {
  console.log('=== Migration Verification ===\n');

  const mssqlPool = await sql.connect(MSSQL_CONFIG);
  const pgPool = new Pool(PG_CONFIG);

  const checks = [
    { name: 'Companies → billing_details', mssql: 'SELECT COUNT(*) as cnt FROM Companies', pg: "SELECT COUNT(*) as cnt FROM billing_details WHERE legacy_id IS NOT NULL" },
    { name: 'CollectionStatuses', mssql: 'SELECT COUNT(*) as cnt FROM CollectionStatuses', pg: "SELECT COUNT(*) as cnt FROM collection_statuses WHERE legacy_id IS NOT NULL" },
    { name: 'Laboratories', mssql: 'SELECT COUNT(*) as cnt FROM Laboratories', pg: "SELECT COUNT(*) as cnt FROM laboratories" },
    { name: 'Hospitals', mssql: 'SELECT COUNT(*) as cnt FROM Hospitals', pg: "SELECT COUNT(*) as cnt FROM hospitals WHERE legacy_id IS NOT NULL" },
    { name: 'Collaborators', mssql: 'SELECT COUNT(*) as cnt FROM Collaborators', pg: "SELECT COUNT(*) as cnt FROM collaborators WHERE legacy_id IS NOT NULL" },
    { name: 'Clients → customers', mssql: "SELECT COUNT(*) as cnt FROM Clients WHERE cli_deleted = 0 OR cli_deleted IS NULL", pg: "SELECT COUNT(*) as cnt FROM customers WHERE internal_id IS NOT NULL" },
    { name: 'ServiceCollections → collections', mssql: 'SELECT COUNT(*) as cnt FROM ServiceCollections', pg: "SELECT COUNT(*) as cnt FROM collections WHERE legacy_id IS NOT NULL" },
    { name: 'Invoices', mssql: 'SELECT COUNT(*) as cnt FROM Invoices', pg: "SELECT COUNT(*) as cnt FROM invoices WHERE legacy_id IS NOT NULL" },
    { name: 'InvoiceItems', mssql: 'SELECT COUNT(*) as cnt FROM InvoiceItems', pg: "SELECT COUNT(*) as cnt FROM invoice_items" },
    { name: 'RealizedPayments → invoice_payments', mssql: 'SELECT COUNT(*) as cnt FROM RealizedPayments', pg: "SELECT COUNT(*) as cnt FROM invoice_payments WHERE source = 'migration'" },
  ];

  console.log('Entity'.padEnd(45) + 'MSSQL'.padStart(10) + 'INDEXUS'.padStart(10) + 'Match'.padStart(8));
  console.log('─'.repeat(73));

  let allMatch = true;
  for (const check of checks) {
    try {
      const mRes = await mssqlPool.request().query(check.mssql);
      const pRes = await pgPool.query(check.pg);
      const mCount = mRes.recordset[0].cnt;
      const pCount = parseInt(pRes.rows[0].cnt);
      const match = mCount === pCount ? '✓' : `${mCount - pCount} diff`;
      if (mCount !== pCount) allMatch = false;

      console.log(
        check.name.padEnd(45) +
        String(mCount).padStart(10) +
        String(pCount).padStart(10) +
        match.padStart(8)
      );
    } catch (err) {
      console.log(check.name.padEnd(45) + 'ERROR'.padStart(10) + err.message);
      allMatch = false;
    }
  }

  console.log('─'.repeat(73));
  console.log(allMatch ? '\n✓ All counts match!' : '\n⚠ Some counts differ - review above');

  // Sample data verification
  console.log('\n=== Sample Data Spot Check ===\n');

  try {
    const sample = await pgPool.query(`
      SELECT c.cbu_number, c.client_first_name, c.client_last_name, c.collection_date,
             h.name as hospital_name, c.legacy_id
      FROM collections c
      LEFT JOIN hospitals h ON h.id = c.hospital_id
      WHERE c.legacy_id IS NOT NULL
      ORDER BY c.created_at DESC
      LIMIT 5
    `);
    console.log('Latest 5 migrated collections:');
    for (const r of sample.rows) {
      console.log(`  CBU: ${r.cbu_number || 'N/A'}, Client: ${r.client_first_name} ${r.client_last_name}, Hospital: ${r.hospital_name || 'N/A'}, Date: ${r.collection_date || 'N/A'}`);
    }
  } catch (err) {
    console.log('Could not verify sample data:', err.message);
  }

  await mssqlPool.close();
  await pgPool.end();
}

main().catch(console.error);
