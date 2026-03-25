#!/usr/bin/env node
/**
 * Discovery 2: ContractServiceSurcharges, ContractServiceSchedules, 
 * MarketProducts, HistoryContractServices, ContractTemplates deep dive
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

  const tablesToExplore = [
    'ContractServiceSurcharges', 'HistoryContractServiceSurcharges',
    'SurchargeTypes', 'PriceListSurcharges',
    'ContractServiceSchedules', 'ContractServiceSchedulePayments', 'ScheduleTemplates', 'SchedulePaymentTemplates',
    'MarketProducts', 'MarketProductInstances', 'MarketProductServiceInstances', 'SetUpMarketProducts',
    'HistoryContractServices',
    'ContractTemplateServices',
    'ContractServiceInflations',
    'PriceLists', 'DiscountCategories',
    'ContractAmendmentTemplates', 'ContractAmendmentTemplateServices',
  ];

  for (const t of tablesToExplore) {
    try {
      const cols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '${t}' ORDER BY ORDINAL_POSITION
      `);
      if (cols.recordset.length > 0) {
        console.log(`\n=== ${t} ===`);
        console.log(`Columns: ${cols.recordset.map(r => r.COLUMN_NAME + '(' + r.DATA_TYPE + ')').join(', ')}`);
        const cnt = await pool.request().query(`SELECT COUNT(*) as cnt FROM [${t}]`);
        console.log(`Count: ${cnt.recordset[0].cnt}`);
        const sample = await pool.request().query(`SELECT TOP 3 * FROM [${t}] ORDER BY 1 DESC`);
        for (const s of sample.recordset) console.log(`  ${JSON.stringify(s)}`);
      } else {
        console.log(`\n✗ ${t}: NOT FOUND`);
      }
    } catch (err) {
      console.log(`\n✗ ${t}: ${err.message}`);
    }
  }

  // Deep dive: Get one contract's full service tree
  console.log('\n\n=== FULL SERVICE TREE FOR ONE CONTRACT ===\n');
  try {
    // Pick a recent contract with services
    const conRes = await pool.request().query(`
      SELECT TOP 1 cs.con_id 
      FROM ContractServices cs 
      WHERE cs.con_id IN (SELECT TOP 100 con_id FROM Contracts ORDER BY con_id DESC)
      GROUP BY cs.con_id HAVING COUNT(*) >= 3
      ORDER BY cs.con_id DESC
    `);
    const conId = conRes.recordset[0]?.con_id;
    if (!conId) { console.log('No contract found'); await pool.close(); return; }

    console.log(`Contract con_id = ${conId}`);

    // Contract info
    const conInfo = await pool.request().query(`
      SELECT c.con_id, c.con_number, cs2.csa_code, 
             c.cte_id, ct.cte_name, ct.cte_template_number,
             mp.mpr_name, mp.mpr_code,
             mpi.mpi_name, mpi.mpi_code
      FROM Contracts c
      LEFT JOIN ContractStatuses cs2 ON cs2.csa_id = c.csa_id
      LEFT JOIN ContractTemplates ct ON ct.cte_id = c.cte_id
      LEFT JOIN MarketProductInstances mpi ON mpi.mpi_id = ct.mpi_id
      LEFT JOIN MarketProducts mp ON mp.mpr_id = mpi.mpr_id
      WHERE c.con_id = ${conId}
    `);
    console.log('Contract: ' + JSON.stringify(conInfo.recordset[0], null, 2));

    // Services
    const svcRes = await pool.request().query(`
      SELECT cs.cse_id, cs.con_id, cs.sin_id, cs.sco_id,
             cs.cse_original_price, cs.cse_actual_price, cs.cse_active,
             cs.cse_invoicing_finished, cs.cse_note,
             cs.cse_inserted, cs.cse_inserted_by,
             si.sin_name, si.sin_invoice_identifier,
             ser.ser_id, ser.ser_name, ser.ser_is_invoicable, ser.ser_is_collectable, ser.ser_is_storable,
             comp.com_name
      FROM ContractServices cs
      LEFT JOIN ServiceInstances si ON si.sin_id = cs.sin_id
      LEFT JOIN Services ser ON ser.ser_id = si.ser_id
      LEFT JOIN Companies comp ON comp.com_id = ser.com_id
      WHERE cs.con_id = ${conId}
      ORDER BY cs.cse_id
    `);
    console.log(`\nServices (${svcRes.recordset.length}):`);
    for (const s of svcRes.recordset) {
      console.log(`  cse_id=${s.cse_id} sin=${s.sin_name} ser=${s.ser_name} comp=${s.com_name} orig=${s.cse_original_price} actual=${s.cse_actual_price} active=${s.cse_active} invoicable=${s.ser_is_invoicable} collectable=${s.ser_is_collectable} storable=${s.ser_is_storable}`);
    }

    // Payments per service
    const cseIds = svcRes.recordset.map(r => r.cse_id).join(',');
    if (cseIds) {
      const payRes = await pool.request().query(`
        SELECT csp.csp_id, csp.cse_id, csp.plp_id,
               csp.csp_original_price, csp.csp_actual_price,
               plp.plp_name, plp.plp_invoice_item, plp.plp_price AS plp_list_price,
               pty.pty_name, pty.pty_installments_count
        FROM ContractServicePayments csp
        LEFT JOIN PriceListPayments plp ON plp.plp_id = csp.plp_id
        LEFT JOIN PaymentTypes pty ON pty.pty_id = plp.pty_id
        WHERE csp.cse_id IN (${cseIds})
        ORDER BY csp.cse_id, csp.csp_id
      `);
      console.log(`\nPayments (${payRes.recordset.length}):`);
      for (const p of payRes.recordset) {
        console.log(`  cse_id=${p.cse_id} plp=${p.plp_name} orig=${p.csp_original_price} actual=${p.csp_actual_price} list=${p.plp_list_price} payType=${p.pty_name} installments=${p.pty_installments_count}`);
      }

      // Price history
      const cspIds = payRes.recordset.map(r => r.csp_id).join(',');
      if (cspIds) {
        const histRes = await pool.request().query(`
          SELECT * FROM HistoryContractServicePayments WHERE csp_id IN (${cspIds}) ORDER BY csp_id, hsp_from
        `);
        console.log(`\nPrice History (${histRes.recordset.length}):`);
        for (const h of histRes.recordset) {
          console.log(`  csp_id=${h.csp_id} price=${h.hsp_price} from=${h.hsp_from} to=${h.hsp_to} actual=${h.hsp_actual} by=${h.hsp_inserted_by} note=${h.hsp_note}`);
        }
      }

      // Surcharges
      const surRes = await pool.request().query(`
        SELECT css.*, st.sut_name, st.sut_code
        FROM ContractServiceSurcharges css
        LEFT JOIN SurchargeTypes st ON st.sut_id = css.sut_id
        WHERE css.cse_id IN (${cseIds})
        ORDER BY css.cse_id
      `);
      console.log(`\nSurcharges (${surRes.recordset.length}):`);
      for (const s of surRes.recordset) {
        console.log(`  cse_id=${s.cse_id} sut=${s.sut_name} price=${s.css_price} from=${s.css_from} to=${s.css_to} valid=${s.css_actual} by=${s.css_inserted_by}`);
      }

      // Schedules (splátky)
      const schRes = await pool.request().query(`
        SELECT csc.*, st.sct_name
        FROM ContractServiceSchedules csc
        LEFT JOIN ScheduleTemplates st ON st.sct_id = csc.sct_id
        WHERE csc.cse_id IN (${cseIds})
        ORDER BY csc.cse_id
      `);
      console.log(`\nSchedules (${schRes.recordset.length}):`);
      for (const s of schRes.recordset) {
        console.log(`  ${JSON.stringify(s)}`);
      }

      // Schedule Payments
      const schIds = schRes.recordset.map(r => r.csc_id).filter(Boolean);
      if (schIds.length > 0) {
        const spRes = await pool.request().query(`
          SELECT * FROM ContractServiceSchedulePayments WHERE csc_id IN (${schIds.join(',')}) ORDER BY csc_id
        `);
        console.log(`\nSchedule Payments (${spRes.recordset.length}):`);
        for (const s of spRes.recordset) {
          console.log(`  ${JSON.stringify(s)}`);
        }
      }
    }
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
  }

  // Check what fields Contracts table has for product/template info
  console.log('\n\n=== CONTRACTS TABLE - PRODUCT/TEMPLATE FIELDS ===\n');
  try {
    const conCols = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Contracts' 
      AND (COLUMN_NAME LIKE '%cte%' OR COLUMN_NAME LIKE '%mpi%' OR COLUMN_NAME LIKE '%mpr%' OR COLUMN_NAME LIKE '%pro%' OR COLUMN_NAME LIKE '%template%' OR COLUMN_NAME LIKE '%product%')
      ORDER BY ORDINAL_POSITION
    `);
    console.log('Product/template columns in Contracts: ' + conCols.recordset.map(r => r.COLUMN_NAME).join(', '));
  } catch (err) {
    console.log(`  ${err.message}`);
  }

  await pool.close();
  console.log('\nDone.');
}

run().catch(err => { console.error(err); process.exit(1); });
