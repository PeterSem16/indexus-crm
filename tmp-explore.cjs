const sql = require('mssql');

const config = {
  user: 'cbcuser',
  password: 'XqU0nNND',
  server: '10.1.2.2',
  port: 1433,
  database: 'CBC',
  options: { encrypt: false, trustServerCertificate: true }
};

(async () => {
  const pool = await sql.connect(config);
  
  // Find tables related to invoices
  const tables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME LIKE '%Invoice%' OR TABLE_NAME LIKE '%Payment%' OR TABLE_NAME LIKE '%inv%'
    ORDER BY TABLE_NAME
  `);
  console.log('=== Invoice/Payment related tables ===');
  for (const r of tables.recordset) console.log(`  ${r.TABLE_NAME}`);
  
  // Check InvoiceItems
  for (const tbl of ['InvoiceItems', 'InvoicePayments', 'PaymentItems', 'Payments', 'InvoiceDetails', 'InvoiceEntries']) {
    try {
      const cols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tbl}' ORDER BY ORDINAL_POSITION
      `);
      if (cols.recordset.length > 0) {
        console.log(`\n=== ${tbl} columns ===`);
        for (const c of cols.recordset) console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);
        
        // Sample 2 rows
        const sample = await pool.request().query(`SELECT TOP 2 * FROM ${tbl}`);
        if (sample.recordset.length > 0) {
          console.log(`  --- Sample row ---`);
          console.log(JSON.stringify(sample.recordset[0], null, 2));
        }
      }
    } catch (e) { /* table doesn't exist */ }
  }
  
  await pool.close();
})().catch(e => { console.error(e.message); process.exit(1); });
