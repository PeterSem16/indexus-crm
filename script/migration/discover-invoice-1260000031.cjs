#!/usr/bin/env node
/**
 * Discovery: Explore specific invoice 1260000031, contract 1112600003, client 208252
 * Find all related data: items, accounting codes, schedules, payments
 * Each section wrapped in try/catch so the script continues even if a query fails
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

  let conId = null;
  let cliId = null;
  let cseIds = [];
  let invId = null;
  let accId = null;

  // 1. Find the contract
  console.log('=== 1. CONTRACT (con_number = 1112600003) ===\n');
  try {
    const conRes = await pool.request().query(`
      SELECT c.con_id, c.con_number, c.cli_id, cs.csa_code,
             c.con_contacted, c.con_filled, c.con_generated, c.con_sent, c.con_confirmed,
             c.con_returned, c.con_validated, c.con_realized, c.con_terminated, c.con_cancelled,
             c.con_inserted, c.con_note,
             ct.cte_id, ct.cte_name, ct.cte_template_number,
             mpi.mpi_name,
             mp.mpr_name
      FROM Contracts c
      LEFT JOIN ContractStatuses cs ON cs.csa_id = c.csa_id
      LEFT JOIN ContractTemplates ct ON ct.cte_id = c.cte_id
      LEFT JOIN MarketProductInstances mpi ON mpi.mpi_id = ct.mpi_id
      LEFT JOIN MarketProducts mp ON mp.mpr_id = mpi.mpr_id
      WHERE c.con_number = '1112600003'
    `);
    for (const r of conRes.recordset) console.log(JSON.stringify(r, null, 2));
    conId = conRes.recordset[0]?.con_id;
    cliId = conRes.recordset[0]?.cli_id;
    console.log(`\ncon_id = ${conId}, cli_id = ${cliId}\n`);
  } catch (e) { console.log(`ERROR section 1: ${e.message}\n`); }

  if (!conId) {
    console.log('Contract not found, trying by cli_id = 208252...');
    try {
      const conRes2 = await pool.request().query(`
        SELECT c.con_id, c.con_number, c.cli_id, c.con_inserted
        FROM Contracts c WHERE c.cli_id = 208252
      `);
      console.log(`Contracts for cli_id=208252: ${conRes2.recordset.length}`);
      for (const r of conRes2.recordset) console.log(JSON.stringify(r));
      if (conRes2.recordset.length > 0) {
        conId = conRes2.recordset[0].con_id;
        cliId = 208252;
      }
    } catch (e) { console.log(`ERROR: ${e.message}`); }
  }

  // 2. Find client info
  console.log('\n=== 2. CLIENT ===\n');
  try {
    const cliRes = await pool.request().query(`
      SELECT cli_id, cli_title, cli_first_name, cli_last_name, cli_birth_date, cli_personal_id,
             cli_phone, cli_email, cli_note
      FROM Clients WHERE cli_id = ${cliId || 208252}
    `);
    for (const r of cliRes.recordset) console.log(JSON.stringify(r, null, 2));
  } catch (e) { console.log(`ERROR section 2: ${e.message}\n`); }

  // 3. ContractServices for this contract
  console.log('\n=== 3. CONTRACT SERVICES ===\n');
  try {
    if (conId) {
      const cseRes = await pool.request().query(`
        SELECT cs.cse_id, cs.con_id, cs.sin_id, cs.sco_id, cs.ser_id,
               cs.cse_original_price, cs.cse_actual_price, cs.cse_active,
               cs.cse_invoiceable, cs.cse_collectable, cs.cse_storable,
               cs.cse_invoicing_finished, cs.cse_note,
               si.sin_name, si.sin_invoice_identifier,
               ser.ser_name
        FROM ContractServices cs
        LEFT JOIN ServiceInstances si ON si.sin_id = cs.sin_id
        LEFT JOIN Services ser ON ser.ser_id = cs.ser_id
        WHERE cs.con_id = ${conId}
        ORDER BY cs.cse_id
      `);
      for (const r of cseRes.recordset) console.log(JSON.stringify(r, null, 2));
      cseIds = cseRes.recordset.map(r => r.cse_id);
    } else {
      console.log('No con_id, skipping.');
    }
  } catch (e) { console.log(`ERROR section 3: ${e.message}\n`); }

  // 4. Specific invoice 1260000031
  console.log('\n=== 4. INVOICE 1260000031 ===\n');
  try {
    const invRes = await pool.request().query(`
      SELECT i.inv_id, i.inv_invoice_number, i.cse_id, i.ist_id,
             i.inv_variable_symbol, i.inv_constant_symbol, i.inv_specific_symbol,
             i.inv_amount_cur_home_no_vat, i.inv_amount_cur_home_with_vat,
             i.inv_paid_cur_home, i.inv_fully_paid,
             i.inv_date_of_delivery, i.inv_date_of_issue, i.inv_dispatch_date, i.inv_date_of_payment,
             i.inv_period_from, i.inv_period_to,
             i.cur_code_home, i.acc_id,
             ist.ist_code
      FROM Invoices i
      LEFT JOIN InvoiceStatuses ist ON ist.ist_id = i.ist_id
      WHERE i.inv_invoice_number = '1260000031'
    `);
    for (const r of invRes.recordset) console.log(JSON.stringify(r, null, 2));
    invId = invRes.recordset[0]?.inv_id;
    accId = invRes.recordset[0]?.acc_id;
  } catch (e) { console.log(`ERROR section 4: ${e.message}\n`); }

  // 4b. ALL invoices for this contract
  if (cseIds.length > 0) {
    console.log('\n=== 4b. ALL INVOICES FOR THIS CONTRACT ===\n');
    try {
      const allInvRes = await pool.request().query(`
        SELECT i.inv_id, i.inv_invoice_number, i.cse_id, 
               i.inv_amount_cur_home_with_vat, i.inv_paid_cur_home, i.inv_fully_paid,
               i.inv_date_of_issue, i.inv_date_of_payment,
               ist.ist_code
        FROM Invoices i
        LEFT JOIN InvoiceStatuses ist ON ist.ist_id = i.ist_id
        WHERE i.cse_id IN (${cseIds.join(',')})
        ORDER BY i.inv_date_of_issue
      `);
      console.log(`Total invoices for this contract: ${allInvRes.recordset.length}`);
      for (const r of allInvRes.recordset) console.log(JSON.stringify(r));
    } catch (e) { console.log(`ERROR section 4b: ${e.message}\n`); }
  }

  // 5. Invoice items for invoice 1260000031 with ACCOUNTING CODES
  if (invId) {
    console.log('\n=== 5. INVOICE ITEMS for 1260000031 (with Accounting Codes) ===\n');
    try {
      const iiRes = await pool.request().query(`
        SELECT ii.iit_id, ii.inv_id, ii.iit_position, ii.iit_label,
               ii.iit_item_accounting_code,
               ii.iit_units, ii.iit_unit_code,
               ii.iit_price_per_unit_cur_home_no_vat, ii.iit_price_per_unit_cur_home_with_vat,
               ii.iit_price_cur_home_no_vat, ii.iit_price_cur_home_with_vat,
               v.vat_rate
        FROM InvoiceItems ii
        LEFT JOIN VATs v ON v.vat_id = ii.vat_id
        WHERE ii.inv_id = ${invId}
        ORDER BY ii.iit_position
      `);
      for (const r of iiRes.recordset) console.log(JSON.stringify(r, null, 2));
    } catch (e) { console.log(`ERROR section 5: ${e.message}\n`); }
  }

  // 5b. ALL invoice items for ALL invoices of this contract
  if (cseIds.length > 0) {
    console.log('\n=== 5b. ALL INVOICE ITEMS FOR ALL CONTRACT INVOICES ===\n');
    try {
      const allItemsRes = await pool.request().query(`
        SELECT ii.iit_id, ii.inv_id, i.inv_invoice_number,
               ii.iit_position, ii.iit_label, ii.iit_item_accounting_code,
               ii.iit_units, ii.iit_price_cur_home_with_vat, ii.iit_price_cur_home_no_vat,
               v.vat_rate
        FROM InvoiceItems ii
        JOIN Invoices i ON i.inv_id = ii.inv_id
        LEFT JOIN VATs v ON v.vat_id = ii.vat_id
        WHERE i.cse_id IN (${cseIds.join(',')})
        ORDER BY i.inv_invoice_number, ii.iit_position
      `);
      console.log(`Total items across all invoices: ${allItemsRes.recordset.length}`);
      for (const r of allItemsRes.recordset) console.log(JSON.stringify(r));
    } catch (e) { console.log(`ERROR section 5b: ${e.message}\n`); }
  }

  // 6. ContractServicePayments (payment plan setup) with accounting codes
  if (cseIds.length > 0) {
    console.log('\n=== 6. CONTRACT SERVICE PAYMENTS (payment plan) ===\n');
    try {
      const cspRes = await pool.request().query(`
        SELECT csp.csp_id, csp.cse_id, csp.plp_id,
               csp.csp_original_price, csp.csp_actual_price,
               plp.plp_name, plp.plp_invoice_item, plp.plp_price,
               plp.plp_accounting_code,
               pty.pty_name, pty.pty_installments_count
        FROM ContractServicePayments csp
        LEFT JOIN PriceListPayments plp ON plp.plp_id = csp.plp_id
        LEFT JOIN PaymentTypes pty ON pty.pty_id = plp.pty_id
        WHERE csp.cse_id IN (${cseIds.join(',')})
        ORDER BY csp.cse_id, csp.csp_id
      `);
      for (const r of cspRes.recordset) console.log(JSON.stringify(r, null, 2));
    } catch (e) { console.log(`ERROR section 6: ${e.message}\n`); }
  }

  // 7. Schedules (splátky)
  console.log('\n=== 7. SCHEDULES ===\n');
  if (cseIds.length > 0) {
    try {
      const hcsRes = await pool.request().query(`
        SELECT hcs_id, cse_id FROM HistoryContractServices WHERE cse_id IN (${cseIds.join(',')})
      `);
      console.log(`HistoryContractServices records: ${hcsRes.recordset.length}`);
      for (const r of hcsRes.recordset) console.log(`  hcs_id=${r.hcs_id}, cse_id=${r.cse_id}`);

      const hcsIds = hcsRes.recordset.map(r => r.hcs_id);
      if (hcsIds.length > 0) {
        const schRes = await pool.request().query(`
          SELECT csh_id, sch_id, hcs_id, csh_name, csh_preliminary_schedule, csh_inserted
          FROM ContractServiceSchedules
          WHERE hcs_id IN (${hcsIds.join(',')})
          ORDER BY csh_id
        `);
        console.log(`\nContractServiceSchedules: ${schRes.recordset.length}`);
        for (const s of schRes.recordset) console.log(JSON.stringify(s, null, 2));

        const cshIds = schRes.recordset.map(r => r.csh_id);
        if (cshIds.length > 0) {
          console.log('\n=== 8. SCHEDULE PAYMENTS (individual installments) ===\n');
          const spRes = await pool.request().query(`
            SELECT * FROM ContractServiceSchedulePayments
            WHERE csh_id IN (${cshIds.join(',')})
            ORDER BY csh_id, csy_installments_id
          `);
          console.log(`ContractServiceSchedulePayments: ${spRes.recordset.length}`);
          for (const s of spRes.recordset) console.log(JSON.stringify(s, null, 2));
        }
      }
    } catch (e) { console.log(`ERROR section 7/8: ${e.message}\n`); }
  }

  // 9. RealizedPayments
  if (cseIds.length > 0) {
    console.log('\n=== 9. REALIZED PAYMENTS ===\n');
    try {
      const rpRes = await pool.request().query(`
        SELECT rp.rpa_id, rp.inv_id, i.inv_invoice_number,
               rp.rpa_amount_cur_home, rp.rpa_date_of_payment,
               rp.rpa_payment_identifier, rp.rpa_variable_symbol, rp.rpa_detail
        FROM RealizedPayments rp
        JOIN Invoices i ON i.inv_id = rp.inv_id
        WHERE i.cse_id IN (${cseIds.join(',')})
        ORDER BY rp.rpa_date_of_payment
      `);
      console.log(`Realized payments: ${rpRes.recordset.length}`);
      for (const r of rpRes.recordset) console.log(JSON.stringify(r));
    } catch (e) { console.log(`ERROR section 9: ${e.message}\n`); }
  }

  // 10. Accounts
  if (accId) {
    console.log('\n=== 10. ACCOUNTS ===\n');
    try {
      const accRes = await pool.request().query(`SELECT * FROM Accounts WHERE acc_id = ${accId}`);
      for (const r of accRes.recordset) console.log(JSON.stringify(r, null, 2));
    } catch (e) { console.log(`ERROR section 10: ${e.message}\n`); }
  }

  // 11. PriceListPayments with accounting codes (sample)
  console.log('\n=== 11. PRICELIST PAYMENTS with ACCOUNTING CODES (sample) ===\n');
  try {
    const plpRes = await pool.request().query(`
      SELECT TOP 20 plp_id, plp_name, plp_invoice_item, plp_price, plp_accounting_code, pty_id, pls_id
      FROM PriceListPayments
      WHERE plp_accounting_code IS NOT NULL AND plp_accounting_code != ''
      ORDER BY plp_id
    `);
    console.log(`PriceListPayments with accounting codes: ${plpRes.recordset.length}`);
    for (const r of plpRes.recordset) console.log(JSON.stringify(r));
  } catch (e) { console.log(`ERROR section 11: ${e.message}\n`); }

  // 12. ContractServiceSchedulePayments COLUMNS (to see what fields exist)
  console.log('\n=== 12. ContractServiceSchedulePayments COLUMNS ===\n');
  try {
    const cspCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ContractServiceSchedulePayments' ORDER BY ORDINAL_POSITION
    `);
    console.log(cspCols.recordset.map(r => r.COLUMN_NAME + '(' + r.DATA_TYPE + ')').join(', '));
  } catch (e) { console.log(`ERROR section 12: ${e.message}\n`); }

  // 13. InvoiceItems COLUMNS
  console.log('\n=== 13. InvoiceItems COLUMNS ===\n');
  try {
    const iiCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'InvoiceItems' ORDER BY ORDINAL_POSITION
    `);
    console.log(iiCols.recordset.map(r => r.COLUMN_NAME + '(' + r.DATA_TYPE + ')').join(', '));
  } catch (e) { console.log(`ERROR section 13: ${e.message}\n`); }

  await pool.close();
  console.log('\n\nDone.');
}

run().catch(err => { console.error(err); process.exit(1); });
