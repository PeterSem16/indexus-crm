#!/usr/bin/env node
/**
 * Discovery: Explore CBC tables related to ContractServices, Installments, Discounts, Products
 */
const sql = require('mssql');

const MSSQL_CONFIG = {
  user: 'cbcuser',
  password: 'XqU0nNND',
  server: '10.1.2.2',
  port: 1433,
  database: 'CBC',
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000,
  requestTimeout: 120000,
};

async function run() {
  const pool = await sql.connect(MSSQL_CONFIG);
  console.log('Connected to CBC.\n');

  // 1. List all tables that might be relevant
  const tablesOfInterest = [
    'ContractServices', 'Services', 'ServiceCombinations', 'ServiceInstances',
    'ContractServicePayments', 'HistoryContractServicePayments',
    'PriceListPayments', 'PriceListServices',
    'InstallmentFees', 'HistoryInstallmentFees', 'ContractInstallmentFees',
    'Discounts', 'ContractDiscounts', 'HistoryDiscounts',
    'Products', 'ProductTypes', 'Templates', 'ContractTemplates',
    'PaymentSystems', 'InstallmentSystems', 'PaymentTypes',
    'Surcharges', 'ContractSurcharges',
    'HistoryContracts', 'HistoryContractStatuses'
  ];

  console.log('=== TABLE DISCOVERY ===\n');
  for (const t of tablesOfInterest) {
    try {
      const cols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '${t}' ORDER BY ORDINAL_POSITION
      `);
      if (cols.recordset.length > 0) {
        console.log(`✓ ${t}: ${cols.recordset.map(r => r.COLUMN_NAME + '(' + r.DATA_TYPE + ')').join(', ')}`);
        // Sample data
        const sample = await pool.request().query(`SELECT TOP 2 * FROM [${t}]`);
        if (sample.recordset.length > 0) {
          console.log(`  Sample: ${JSON.stringify(sample.recordset[0])}`);
        }
        const cnt = await pool.request().query(`SELECT COUNT(*) as cnt FROM [${t}]`);
        console.log(`  Count: ${cnt.recordset[0].cnt}\n`);
      } else {
        console.log(`✗ ${t}: NOT FOUND\n`);
      }
    } catch (err) {
      console.log(`✗ ${t}: ${err.message}\n`);
    }
  }

  // 2. Find all tables with 'service' or 'install' or 'discount' in name
  console.log('\n=== ALL TABLES CONTAINING service/install/discount/product/template ===\n');
  const allTables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' 
    AND (TABLE_NAME LIKE '%Service%' OR TABLE_NAME LIKE '%Install%' 
         OR TABLE_NAME LIKE '%Discount%' OR TABLE_NAME LIKE '%Product%'
         OR TABLE_NAME LIKE '%Template%' OR TABLE_NAME LIKE '%Surcharge%'
         OR TABLE_NAME LIKE '%Payment%' OR TABLE_NAME LIKE '%Price%')
    ORDER BY TABLE_NAME
  `);
  for (const t of allTables.recordset) {
    console.log(`  ${t.TABLE_NAME}`);
  }

  // 3. ContractServices deep dive - get a contract's services with all joins
  console.log('\n\n=== CONTRACTSERVICES DEEP DIVE (for one contract) ===\n');
  try {
    const sampleContract = await pool.request().query(`
      SELECT TOP 1 cs.*, 
             sco.sco_name, sco.sco_code,
             ser.ser_name, ser.ser_code,
             si.sin_name, si.sin_code
      FROM ContractServices cs
      LEFT JOIN ServiceCombinations sco ON sco.sco_id = cs.sco_id
      LEFT JOIN Services ser ON ser.ser_id = cs.ser_id
      LEFT JOIN ServiceInstances si ON si.sin_id = cs.sin_id
      ORDER BY cs.con_id DESC
    `);
    if (sampleContract.recordset.length > 0) {
      console.log('ContractServices + joins:');
      console.log(JSON.stringify(sampleContract.recordset[0], null, 2));
    }

    // Get all services for that contract
    const conId = sampleContract.recordset[0]?.con_id;
    if (conId) {
      const allSvc = await pool.request().query(`
        SELECT cs.cse_id, cs.con_id, cs.ser_id, cs.sco_id, cs.sin_id,
               cs.cse_invoiceable, cs.cse_collectable, cs.cse_storable,
               cs.cse_note, cs.cse_inserted, cs.usr_id,
               sco.sco_name, sco.sco_code,
               ser.ser_name, ser.ser_code,
               si.sin_name, si.sin_code,
               comp.com_name
        FROM ContractServices cs
        LEFT JOIN ServiceCombinations sco ON sco.sco_id = cs.sco_id
        LEFT JOIN Services ser ON ser.ser_id = cs.ser_id
        LEFT JOIN ServiceInstances si ON si.sin_id = cs.sin_id
        LEFT JOIN Companies comp ON comp.com_id = cs.com_id
        WHERE cs.con_id = ${conId}
        ORDER BY cs.cse_id
      `);
      console.log(`\nAll services for con_id=${conId}:`);
      for (const s of allSvc.recordset) {
        console.log(`  cse_id=${s.cse_id} ser=${s.ser_name || s.ser_code} sco=${s.sco_name} sin=${s.sin_name} comp=${s.com_name} invoiceable=${s.cse_invoiceable} collectable=${s.cse_collectable} storable=${s.cse_storable}`);
      }

      // Payments for these services
      const cseIds = allSvc.recordset.map(r => r.cse_id).join(',');
      if (cseIds) {
        const payments = await pool.request().query(`
          SELECT csp.*, plp.plp_name, plp.plp_invoice_item
          FROM ContractServicePayments csp
          LEFT JOIN PriceListPayments plp ON plp.plp_id = csp.plp_id
          WHERE csp.cse_id IN (${cseIds})
          ORDER BY csp.cse_id, csp.csp_id
        `);
        console.log(`\nPayments for these services:`);
        for (const p of payments.recordset) {
          console.log(`  cse_id=${p.cse_id} csp_id=${p.csp_id} name=${p.plp_name} price=${p.csp_price} base=${p.csp_base_price} valid_from=${p.csp_valid_from} valid_to=${p.csp_valid_to} valid=${p.csp_valid}`);
        }

        // Price history
        const cspIds = payments.recordset.map(r => r.csp_id).join(',');
        if (cspIds) {
          const hist = await pool.request().query(`
            SELECT * FROM HistoryContractServicePayments WHERE csp_id IN (${cspIds}) ORDER BY csp_id, hsp_id
          `);
          console.log(`\nPrice history:`);
          for (const h of hist.recordset) {
            console.log(`  csp_id=${h.csp_id} price=${h.hsp_price} base=${h.hsp_base_price} valid_from=${h.hsp_valid_from} valid_to=${h.hsp_valid_to} changed_by=${h.usr_id}`);
          }
        }
      }
    }
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
  }

  // 4. Look for installment/discount tables linked to ContractServices
  console.log('\n\n=== INSTALLMENT FEES ===\n');
  try {
    const ifCols = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ContractInstallmentFees' ORDER BY ORDINAL_POSITION
    `);
    if (ifCols.recordset.length > 0) {
      console.log('ContractInstallmentFees columns: ' + ifCols.recordset.map(r => r.COLUMN_NAME).join(', '));
      const sample = await pool.request().query(`SELECT TOP 5 * FROM ContractInstallmentFees ORDER BY cif_id DESC`);
      for (const s of sample.recordset) console.log('  ' + JSON.stringify(s));
    }
  } catch (err) { console.log(`  ${err.message}`); }

  console.log('\n\n=== DISCOUNTS / SURCHARGES ===\n');
  try {
    const dcCols = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ContractDiscounts' ORDER BY ORDINAL_POSITION
    `);
    if (dcCols.recordset.length > 0) {
      console.log('ContractDiscounts columns: ' + dcCols.recordset.map(r => r.COLUMN_NAME).join(', '));
      const sample = await pool.request().query(`SELECT TOP 5 * FROM ContractDiscounts ORDER BY cdi_id DESC`);
      for (const s of sample.recordset) console.log('  ' + JSON.stringify(s));
    }
  } catch (err) { console.log(`  ${err.message}`); }

  // 5. HistoryContracts sample with all fields
  console.log('\n\n=== HISTORY CONTRACTS DEEP DIVE ===\n');
  try {
    const hc = await pool.request().query(`SELECT TOP 3 * FROM HistoryContracts ORDER BY hco_id DESC`);
    for (const h of hc.recordset) {
      console.log(JSON.stringify(h, null, 2));
      console.log('---');
    }
  } catch (err) { console.log(`  ${err.message}`); }

  await pool.close();
  console.log('\nDone.');
}

run().catch(err => { console.error(err); process.exit(1); });
