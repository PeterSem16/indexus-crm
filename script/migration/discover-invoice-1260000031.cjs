#!/usr/bin/env node
/**
 * Discovery v3: invoice 1260000031, contract 1112600003, client 208252
 * Fixed columns based on v2 errors
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

  const conId = 263786;
  const cliId = 208252;

  // 2. Client - without cli_email (doesn't exist)
  console.log('=== 2. CLIENT ===\n');
  try {
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Clients' ORDER BY ORDINAL_POSITION
    `);
    console.log('Client columns: ' + cols.recordset.map(r => r.COLUMN_NAME).join(', '));

    const cliRes = await pool.request().query(`SELECT TOP 1 * FROM Clients WHERE cli_id = ${cliId}`);
    for (const r of cliRes.recordset) console.log(JSON.stringify(r, null, 2));
  } catch (e) { console.log(`ERROR: ${e.message}\n`); }

  // 3. ContractServices - without cse_storable
  console.log('\n=== 3. CONTRACT SERVICES ===\n');
  try {
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ContractServices' ORDER BY ORDINAL_POSITION
    `);
    console.log('ContractServices columns: ' + cols.recordset.map(r => r.COLUMN_NAME).join(', '));

    const cseRes = await pool.request().query(`
      SELECT cs.cse_id, cs.con_id, cs.sin_id, cs.sco_id, cs.ser_id,
             cs.cse_original_price, cs.cse_actual_price, cs.cse_active,
             cs.cse_invoicing_finished, cs.cse_note,
             si.sin_name, si.sin_invoice_identifier,
             ser.ser_name
      FROM ContractServices cs
      LEFT JOIN ServiceInstances si ON si.sin_id = cs.sin_id
      LEFT JOIN Services ser ON ser.ser_id = cs.ser_id
      WHERE cs.con_id = ${conId}
      ORDER BY cs.cse_id
    `);
    console.log(`\nContractServices count: ${cseRes.recordset.length}`);
    for (const r of cseRes.recordset) console.log(JSON.stringify(r, null, 2));
  } catch (e) { console.log(`ERROR: ${e.message}\n`); }

  // 4b. ALL invoices for cse_id = 1249118 (from invoice 1260000031)
  const cseId = 1249118;
  console.log('\n=== 4b. ALL INVOICES FOR cse_id = 1249118 ===\n');
  try {
    const allInvRes = await pool.request().query(`
      SELECT i.inv_id, i.inv_invoice_number, i.cse_id, 
             i.inv_amount_cur_home_no_vat, i.inv_amount_cur_home_with_vat, 
             i.inv_paid_cur_home, i.inv_fully_paid,
             i.inv_date_of_issue, i.inv_date_of_payment, i.inv_dispatch_date,
             i.inv_variable_symbol,
             ist.ist_code
      FROM Invoices i
      LEFT JOIN InvoiceStatuses ist ON ist.ist_id = i.ist_id
      WHERE i.cse_id = ${cseId}
      ORDER BY i.inv_date_of_issue
    `);
    console.log(`Total invoices for cse_id=${cseId}: ${allInvRes.recordset.length}`);
    for (const r of allInvRes.recordset) console.log(JSON.stringify(r));
  } catch (e) { console.log(`ERROR: ${e.message}\n`); }

  // Also check if there are more cse_ids for this contract
  console.log('\n=== 4c. ALL CSE_IDs AND THEIR INVOICES FOR con_id = 263786 ===\n');
  try {
    const allCseRes = await pool.request().query(`
      SELECT cs.cse_id, cs.cse_original_price, cs.cse_actual_price,
             si.sin_name, ser.ser_name,
             (SELECT COUNT(*) FROM Invoices i WHERE i.cse_id = cs.cse_id) as invoice_count
      FROM ContractServices cs
      LEFT JOIN ServiceInstances si ON si.sin_id = cs.sin_id
      LEFT JOIN Services ser ON ser.ser_id = cs.ser_id
      WHERE cs.con_id = ${conId}
      ORDER BY cs.cse_id
    `);
    console.log(`ContractServices for con_id=${conId}: ${allCseRes.recordset.length}`);
    for (const r of allCseRes.recordset) console.log(JSON.stringify(r));

    // Get all invoices for all cse_ids
    const allCseIds = allCseRes.recordset.map(r => r.cse_id);
    if (allCseIds.length > 0) {
      const allInv2 = await pool.request().query(`
        SELECT i.inv_id, i.inv_invoice_number, i.cse_id,
               i.inv_amount_cur_home_with_vat, i.inv_paid_cur_home, i.inv_fully_paid,
               i.inv_date_of_issue, i.inv_date_of_payment,
               i.inv_variable_symbol,
               ist.ist_code
        FROM Invoices i
        LEFT JOIN InvoiceStatuses ist ON ist.ist_id = i.ist_id
        WHERE i.cse_id IN (${allCseIds.join(',')})
        ORDER BY i.inv_date_of_issue
      `);
      console.log(`\nAll invoices across all services: ${allInv2.recordset.length}`);
      for (const r of allInv2.recordset) console.log(JSON.stringify(r));
    }
  } catch (e) { console.log(`ERROR: ${e.message}\n`); }

  // 5b. ALL invoice items across all invoices of this contract
  console.log('\n=== 5b. ALL INVOICE ITEMS WITH ACCOUNTING CODES ===\n');
  try {
    const allItemsRes = await pool.request().query(`
      SELECT ii.iit_id, ii.inv_id, i.inv_invoice_number,
             ii.iit_position, ii.iit_label, ii.iit_item_accounting_code,
             ii.iit_units, ii.iit_price_cur_home_with_vat, ii.iit_price_cur_home_no_vat,
             v.vat_rate
      FROM InvoiceItems ii
      JOIN Invoices i ON i.inv_id = ii.inv_id
      JOIN ContractServices cs ON cs.cse_id = i.cse_id
      LEFT JOIN VATs v ON v.vat_id = ii.vat_id
      WHERE cs.con_id = ${conId}
      ORDER BY i.inv_invoice_number, ii.iit_position
    `);
    console.log(`Total items across all invoices: ${allItemsRes.recordset.length}`);
    for (const r of allItemsRes.recordset) console.log(JSON.stringify(r));
  } catch (e) { console.log(`ERROR: ${e.message}\n`); }

  // 6. ContractServicePayments
  console.log('\n=== 6. CONTRACT SERVICE PAYMENTS ===\n');
  try {
    const plpCols = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'PriceListPayments' ORDER BY ORDINAL_POSITION
    `);
    console.log('PriceListPayments columns: ' + plpCols.recordset.map(r => r.COLUMN_NAME).join(', '));

    const cspRes = await pool.request().query(`
      SELECT csp.csp_id, csp.cse_id, csp.plp_id,
             csp.csp_original_price, csp.csp_actual_price,
             plp.plp_name, plp.plp_invoice_item, plp.plp_price,
             pty.pty_name, pty.pty_installments_count
      FROM ContractServicePayments csp
      LEFT JOIN PriceListPayments plp ON plp.plp_id = csp.plp_id
      LEFT JOIN PaymentTypes pty ON pty.pty_id = plp.pty_id
      WHERE csp.cse_id = ${cseId}
      ORDER BY csp.csp_id
    `);
    console.log(`\nContractServicePayments: ${cspRes.recordset.length}`);
    for (const r of cspRes.recordset) console.log(JSON.stringify(r, null, 2));
  } catch (e) { console.log(`ERROR: ${e.message}\n`); }

  // 7. Schedules
  console.log('\n=== 7. SCHEDULES ===\n');
  try {
    const hcsRes = await pool.request().query(`
      SELECT hcs_id, cse_id FROM HistoryContractServices WHERE cse_id = ${cseId}
    `);
    console.log(`HistoryContractServices records: ${hcsRes.recordset.length}`);
    for (const r of hcsRes.recordset) console.log(`  hcs_id=${r.hcs_id}, cse_id=${r.cse_id}`);

    const hcsIds = hcsRes.recordset.map(r => r.hcs_id);
    if (hcsIds.length > 0) {
      const schRes = await pool.request().query(`
        SELECT * FROM ContractServiceSchedules
        WHERE hcs_id IN (${hcsIds.join(',')})
        ORDER BY csh_id
      `);
      console.log(`\nContractServiceSchedules: ${schRes.recordset.length}`);
      for (const s of schRes.recordset) console.log(JSON.stringify(s, null, 2));

      const cshIds = schRes.recordset.map(r => r.csh_id);
      if (cshIds.length > 0) {
        console.log('\n=== 8. SCHEDULE PAYMENTS ===\n');
        const spRes = await pool.request().query(`
          SELECT * FROM ContractServiceSchedulePayments
          WHERE csh_id IN (${cshIds.join(',')})
          ORDER BY csh_id, csy_installments_id
        `);
        console.log(`ContractServiceSchedulePayments: ${spRes.recordset.length}`);
        for (const s of spRes.recordset) console.log(JSON.stringify(s, null, 2));
      }
    } else {
      console.log('No HistoryContractServices found for this cse_id.');
      console.log('Trying all cse_ids for this contract...');
      const allCseRes = await pool.request().query(`
        SELECT cse_id FROM ContractServices WHERE con_id = ${conId}
      `);
      const allCseIds = allCseRes.recordset.map(r => r.cse_id);
      if (allCseIds.length > 0) {
        const hcsRes2 = await pool.request().query(`
          SELECT hcs_id, cse_id FROM HistoryContractServices WHERE cse_id IN (${allCseIds.join(',')})
        `);
        console.log(`HistoryContractServices for all cse_ids: ${hcsRes2.recordset.length}`);
        for (const r of hcsRes2.recordset) console.log(`  hcs_id=${r.hcs_id}, cse_id=${r.cse_id}`);

        const hcsIds2 = hcsRes2.recordset.map(r => r.hcs_id);
        if (hcsIds2.length > 0) {
          const schRes2 = await pool.request().query(`
            SELECT * FROM ContractServiceSchedules WHERE hcs_id IN (${hcsIds2.join(',')}) ORDER BY csh_id
          `);
          console.log(`\nSchedules: ${schRes2.recordset.length}`);
          for (const s of schRes2.recordset) console.log(JSON.stringify(s, null, 2));
          const cshIds2 = schRes2.recordset.map(r => r.csh_id);
          if (cshIds2.length > 0) {
            const spRes2 = await pool.request().query(`
              SELECT * FROM ContractServiceSchedulePayments WHERE csh_id IN (${cshIds2.join(',')}) ORDER BY csh_id, csy_installments_id
            `);
            console.log(`\nSchedule payments: ${spRes2.recordset.length}`);
            for (const s of spRes2.recordset) console.log(JSON.stringify(s, null, 2));
          }
        }
      }
    }
  } catch (e) { console.log(`ERROR: ${e.message}\n`); }

  // 9. RealizedPayments
  console.log('\n=== 9. REALIZED PAYMENTS ===\n');
  try {
    const rpRes = await pool.request().query(`
      SELECT rp.rpa_id, rp.inv_id, i.inv_invoice_number,
             rp.rpa_amount_cur_home, rp.rpa_date_of_payment,
             rp.rpa_payment_identifier, rp.rpa_variable_symbol, rp.rpa_detail
      FROM RealizedPayments rp
      JOIN Invoices i ON i.inv_id = rp.inv_id
      JOIN ContractServices cs ON cs.cse_id = i.cse_id
      WHERE cs.con_id = ${conId}
      ORDER BY rp.rpa_date_of_payment
    `);
    console.log(`Realized payments: ${rpRes.recordset.length}`);
    for (const r of rpRes.recordset) console.log(JSON.stringify(r));
  } catch (e) { console.log(`ERROR: ${e.message}\n`); }

  // 10. Unique accounting codes across all ISCBC invoices
  console.log('\n=== 10. UNIQUE ACCOUNTING CODES IN ISCBC ===\n');
  try {
    const acRes = await pool.request().query(`
      SELECT DISTINCT iit_item_accounting_code, COUNT(*) as cnt
      FROM InvoiceItems
      WHERE iit_item_accounting_code IS NOT NULL AND iit_item_accounting_code != ''
      GROUP BY iit_item_accounting_code
      ORDER BY cnt DESC
    `);
    console.log(`Unique accounting codes: ${acRes.recordset.length}`);
    for (const r of acRes.recordset) console.log(`  ${r.iit_item_accounting_code}: ${r.cnt} items`);
  } catch (e) { console.log(`ERROR: ${e.message}\n`); }

  // 11. Mapping: accounting code per cse_id (for scheduled invoices)
  console.log('\n=== 11. ACCOUNTING CODE MAPPING: cse_id -> iit_item_accounting_code ===\n');
  try {
    const mapRes = await pool.request().query(`
      SELECT DISTINCT i.cse_id, ii.iit_item_accounting_code, ii.iit_label
      FROM InvoiceItems ii
      JOIN Invoices i ON i.inv_id = ii.inv_id
      JOIN ContractServices cs ON cs.cse_id = i.cse_id
      WHERE cs.con_id = ${conId}
    `);
    console.log(`Accounting code mappings for this contract:`);
    for (const r of mapRes.recordset) console.log(`  cse_id=${r.cse_id}: code=${r.iit_item_accounting_code}, label="${r.iit_label}"`);
  } catch (e) { console.log(`ERROR: ${e.message}\n`); }

  await pool.close();
  console.log('\n\nDone.');
}

run().catch(err => { console.error(err); process.exit(1); });
