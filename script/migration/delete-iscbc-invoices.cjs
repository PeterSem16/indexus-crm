const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/indexus_crm',
});

async function deleteIscbcInvoices() {
  const client = await pool.connect();

  try {
    console.log('=== DELETE ISCBC INVOICES MIGRATION ===\n');

    const countResult = await client.query(
      "SELECT COUNT(*) as total FROM invoices WHERE LOWER(billing_company) = 'iscbc'"
    );
    const totalInvoices = parseInt(countResult.rows[0].total);
    console.log(`Found ${totalInvoices} ISCBC invoices to delete`);

    if (totalInvoices === 0) {
      console.log('No ISCBC invoices found. Nothing to delete.');
      return;
    }

    const preview = await client.query(
      "SELECT id, invoice_number, status, total_amount, issue_date FROM invoices WHERE LOWER(billing_company) = 'iscbc' ORDER BY issue_date DESC LIMIT 10"
    );
    console.log('\nSample invoices to be deleted:');
    preview.rows.forEach(row => {
      console.log(`  ${row.invoice_number} | ${row.status} | ${row.total_amount} | ${row.issue_date}`);
    });
    if (totalInvoices > 10) {
      console.log(`  ... and ${totalInvoices - 10} more`);
    }

    const scheduledCount = await client.query(
      "SELECT COUNT(*) as total FROM scheduled_invoices WHERE LOWER(billing_company) = 'iscbc'"
    );
    const totalScheduled = parseInt(scheduledCount.rows[0].total);
    console.log(`\nFound ${totalScheduled} ISCBC scheduled invoices to delete`);

    await client.query('BEGIN');

    const deletedInvoices = await client.query(
      "DELETE FROM invoices WHERE LOWER(billing_company) = 'iscbc' RETURNING id"
    );
    console.log(`\nDeleted ${deletedInvoices.rowCount} invoices`);

    if (totalScheduled > 0) {
      const deletedScheduled = await client.query(
        "DELETE FROM scheduled_invoices WHERE LOWER(billing_company) = 'iscbc' RETURNING id"
      );
      console.log(`Deleted ${deletedScheduled.rowCount} scheduled invoices`);
    }

    await client.query('COMMIT');
    console.log('\n=== MIGRATION COMPLETED SUCCESSFULLY ===');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

deleteIscbcInvoices();
