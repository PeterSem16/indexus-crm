#!/usr/bin/env node
/**
 * ISCBC MSSQL Connection Test
 * Run on Ubuntu server: node test-mssql-connection.js
 * Requires: npm install mssql
 */
const sql = require('mssql');

const config = {
  user: 'cbcuser',
  password: 'XqU0nNND',
  server: '10.1.2.2',
  port: 1433,
  database: 'ISCBC',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: 'MSSQLSTD',
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

async function testConnection() {
  console.log('=== ISCBC MSSQL Connection Test ===');
  console.log(`Server: ${config.server}\\${config.options.instanceName}`);
  console.log(`Database: ${config.database}`);
  console.log(`User: ${config.user}`);
  console.log('');

  try {
    console.log('Connecting...');
    const pool = await sql.connect(config);
    console.log('Connected successfully!\n');

    // Test basic query
    const result = await pool.request().query('SELECT @@VERSION AS version');
    console.log('SQL Server Version:');
    console.log(result.recordset[0].version);
    console.log('');

    // Count records in key tables
    console.log('=== Record Counts ===');
    const countQuery = `
      SELECT 'Companies' as tbl, COUNT(*) as cnt FROM Companies
      UNION ALL SELECT 'Clients', COUNT(*) FROM Clients
      UNION ALL SELECT 'PotentialClients', COUNT(*) FROM PotentialClients
      UNION ALL SELECT 'Persons', COUNT(*) FROM Persons
      UNION ALL SELECT 'PersonalData', COUNT(*) FROM PersonalData
      UNION ALL SELECT 'MailAddresses', COUNT(*) FROM MailAddresses
      UNION ALL SELECT 'Contracts', COUNT(*) FROM Contracts
      UNION ALL SELECT 'ContractServices', COUNT(*) FROM ContractServices
      UNION ALL SELECT 'ServiceCollections', COUNT(*) FROM ServiceCollections
      UNION ALL SELECT 'CollectionCollaborators', COUNT(*) FROM CollectionCollaborators
      UNION ALL SELECT 'CollectionEvaluationResults', COUNT(*) FROM CollectionEvaluationResults
      UNION ALL SELECT 'CollectionStatuses', COUNT(*) FROM CollectionStatuses
      UNION ALL SELECT 'Hospitals', COUNT(*) FROM Hospitals
      UNION ALL SELECT 'Collaborators', COUNT(*) FROM Collaborators
      UNION ALL SELECT 'CollaboratorAgreements', COUNT(*) FROM CollaboratorAgreements
      UNION ALL SELECT 'Laboratories', COUNT(*) FROM Laboratories
      UNION ALL SELECT 'Invoices', COUNT(*) FROM Invoices
      UNION ALL SELECT 'InvoiceItems', COUNT(*) FROM InvoiceItems
      UNION ALL SELECT 'RealizedPayments', COUNT(*) FROM RealizedPayments
      UNION ALL SELECT 'ScheduledPayments', COUNT(*) FROM ScheduledPayments
      UNION ALL SELECT 'Rewards', COUNT(*) FROM Rewards
      UNION ALL SELECT 'Rewards3', COUNT(*) FROM Rewards3
      UNION ALL SELECT 'RewardsCZ', COUNT(*) FROM RewardsCZ
      UNION ALL SELECT 'Products', COUNT(*) FROM Products
      UNION ALL SELECT 'MarketProducts', COUNT(*) FROM MarketProducts
      UNION ALL SELECT 'MarketProductInstances', COUNT(*) FROM MarketProductInstances
      UNION ALL SELECT 'Contacts', COUNT(*) FROM Contacts
      UNION ALL SELECT 'Remarks', COUNT(*) FROM Remarks
      UNION ALL SELECT 'ContractStateHistories', COUNT(*) FROM ContractStateHistories
      UNION ALL SELECT 'ServiceCollectionStateHistories', COUNT(*) FROM ServiceCollectionStateHistories
      UNION ALL SELECT 'InvoiceStateHistories', COUNT(*) FROM InvoiceStateHistories
      UNION ALL SELECT 'ExchangeRates', COUNT(*) FROM ExchangeRates
      UNION ALL SELECT 'Representants', COUNT(*) FROM Representants
      UNION ALL SELECT 'CollectionTransports', COUNT(*) FROM CollectionTransports
      UNION ALL SELECT 'Couriers', COUNT(*) FROM Couriers
      UNION ALL SELECT 'RecordChanges', COUNT(*) FROM RecordChanges
      ORDER BY 1
    `;

    const counts = await pool.request().query(countQuery);
    let totalRecords = 0;
    for (const row of counts.recordset) {
      console.log(`  ${row.tbl.padEnd(40)} ${String(row.cnt).padStart(10)}`);
      totalRecords += row.cnt;
    }
    console.log(`  ${'TOTAL'.padEnd(40)} ${String(totalRecords).padStart(10)}`);

    // Check status code tables
    console.log('\n=== Collection Statuses ===');
    const statuses = await pool.request().query(
      'SELECT csu_id, csu_code, csu_default_name, csu_order FROM CollectionStatuses ORDER BY csu_order'
    );
    for (const row of statuses.recordset) {
      console.log(`  ${row.csu_id}: ${row.csu_code} - ${row.csu_default_name}`);
    }

    console.log('\n=== Contract Statuses ===');
    const cStatuses = await pool.request().query(
      'SELECT csa_id, csa_code, csa_default_name, csa_order FROM ContractStatuses ORDER BY csa_order'
    );
    for (const row of cStatuses.recordset) {
      console.log(`  ${row.csa_id}: ${row.csa_code} - ${row.csa_default_name}`);
    }

    console.log('\n=== Invoice Statuses ===');
    const iStatuses = await pool.request().query(
      'SELECT ist_id, ist_code, ist_default_name, ist_order FROM InvoiceStatuses ORDER BY ist_order'
    );
    for (const row of iStatuses.recordset) {
      console.log(`  ${row.ist_id}: ${ist.ist_code} - ${row.ist_default_name}`);
    }

    console.log('\n=== Companies (Countries/Entities) ===');
    const companies = await pool.request().query(
      'SELECT com_id, com_code, com_name, com_country_code, com_entity_code, cur_code FROM Companies ORDER BY com_id'
    );
    for (const row of companies.recordset) {
      console.log(`  ${row.com_id}: ${row.com_code} [${row.com_country_code}] - ${row.com_name} (${row.cur_code})`);
    }

    console.log('\n=== Laboratories ===');
    const labs = await pool.request().query(
      'SELECT lab_id, lab_name, lab_country_code FROM Laboratories ORDER BY lab_id'
    );
    for (const row of labs.recordset) {
      console.log(`  ${row.lab_id}: ${row.lab_name} [${row.lab_country_code}]`);
    }

    console.log('\n=== Collaborator Types ===');
    const cTypes = await pool.request().query(
      'SELECT cty_id, cty_code, cty_default_name FROM CollaboratorTypes ORDER BY cty_order'
    );
    for (const row of cTypes.recordset) {
      console.log(`  ${row.cty_id}: ${row.cty_code} - ${row.cty_default_name}`);
    }

    console.log('\n=== Sample Data: First 3 ServiceCollections ===');
    const sampleCollections = await pool.request().query(`
      SELECT TOP 3 sco_id, sco_collection_unit_number, sco_collection_made, 
        sco_client_first_name, sco_client_last_name, csu_id, hos_id, lab_id,
        sco_inserted
      FROM ServiceCollections ORDER BY sco_id DESC
    `);
    for (const row of sampleCollections.recordset) {
      console.log(`  CBU: ${row.sco_collection_unit_number}, Client: ${row.sco_client_first_name} ${row.sco_client_last_name}, Date: ${row.sco_collection_made}, Status: ${row.csu_id}`);
    }

    await pool.close();
    console.log('\nConnection closed. Test completed successfully!');

  } catch (err) {
    console.error('Connection failed:', err.message);
    if (err.code) console.error('Error code:', err.code);
    process.exit(1);
  }
}

testConnection();
