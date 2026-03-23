#!/usr/bin/env node
/**
 * ISCBC → INDEXUS Migration - Phase 4: Financial Records
 * Migrates: Invoices, InvoiceItems, RealizedPayments
 * Run on Ubuntu: node migrate-phase4-invoices.js
 * Requires: npm install mssql pg
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
  requestTimeout: 120000,
};

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'indexus_crm',
  user: 'indexus',
  password: 'HanyurIfKisck',
};

let mssqlPool, pgPool;
let stats = { inserted: 0, skipped: 0, errors: 0 };

const lookups = { customers: {}, companies: {}, accounts: {} };

function resetStats() { stats = { inserted: 0, skipped: 0, errors: 0 }; }
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function connect() {
  mssqlPool = await sql.connect(MSSQL_CONFIG);
  pgPool = new Pool(PG_CONFIG);
  await pgPool.query('SELECT 1');
  log('Connected to both databases');
}

async function disconnect() {
  await mssqlPool?.close();
  await pgPool?.end();
}

async function buildLookups() {
  log('Building lookup tables...');

  const cust = await pgPool.query('SELECT id, internal_id FROM customers WHERE internal_id IS NOT NULL');
  for (const r of cust.rows) lookups.customers[r.internal_id] = r.id;

  const bd = await pgPool.query('SELECT id, legacy_id FROM billing_details WHERE legacy_id IS NOT NULL');
  for (const r of bd.rows) lookups.companies[r.legacy_id] = r.id;

  // Map MSSQL cse_id → cli_id for customer resolution
  const cseClients = await mssqlPool.request().query(`
    SELECT cs.cse_id, c.cli_id
    FROM ContractServices cs
    JOIN Contracts c ON c.con_id = cs.con_id
  `);
  lookups.cseToClient = {};
  for (const r of cseClients.recordset) {
    lookups.cseToClient[r.cse_id] = String(r.cli_id);
  }

  // Map invoice statuses
  const iStatuses = await mssqlPool.request().query(
    'SELECT ist_id, ist_code FROM InvoiceStatuses'
  );
  lookups.invoiceStatuses = {};
  for (const r of iStatuses.recordset) lookups.invoiceStatuses[r.ist_id] = r.ist_code;

  log(`  ${Object.keys(lookups.customers).length} customers, ${Object.keys(lookups.companies).length} companies`);
}

function mapInvoiceStatus(istCode) {
  const map = {
    'NEW': 'generated',
    'GENERATED': 'generated',
    'SENT': 'sent',
    'PAID': 'paid',
    'PARTIALLY_PAID': 'partially_paid',
    'OVERDUE': 'overdue',
    'CANCELLED': 'cancelled',
    'STORNO': 'cancelled',
    'WRITEOFF': 'cancelled',
  };
  return map[(istCode || '').toUpperCase()] || 'generated';
}

// ============================================================
// 1. Invoices → invoices
// ============================================================
async function migrateInvoices() {
  log('--- Migrating Invoices → invoices ---');
  resetStats();

  const invoices = await mssqlPool.request().query(`
    SELECT inv_id, inv_invoice_number, inv_variable_symbol, inv_specific_symbol, inv_constant_symbol,
      inv_date_of_delivery, inv_date_of_issue, inv_dispatch_date, inv_date_of_payment,
      inv_amount_cur_home_no_vat, inv_amount_cur_home_with_vat, inv_paid_cur_home,
      inv_fully_paid, inv_note, inv_inserted, inv_updated,
      inv_period_from, inv_period_to,
      ist_id, cse_id, cur_code_home, acc_id,
      add_id_client, add_id_company, add_id_invoice
    FROM Invoices
    ORDER BY inv_id
  `);

  // Get client addresses for customer snapshot
  const clientAddresses = await mssqlPool.request().query(`
    SELECT a.add_id, a.add_name, a.add_street_and_number, a.add_city, a.add_zip, a.add_country
    FROM MailAddresses a WHERE a.add_valid = 1
  `);
  const addrMap = {};
  for (const r of clientAddresses.recordset) addrMap[r.add_id] = r;

  let batch = 0;
  for (const row of invoices.recordset) {
    try {
      const existing = await pgPool.query(
        'SELECT id FROM invoices WHERE legacy_id = $1',
        [String(row.inv_id)]
      );
      if (existing.rows.length > 0) { stats.skipped++; continue; }

      const clientLegacyId = lookups.cseToClient[row.cse_id];
      const customerId = clientLegacyId ? (lookups.customers[clientLegacyId] || null) : null;
      const status = mapInvoiceStatus(lookups.invoiceStatuses[row.ist_id]);
      const currency = row.cur_code_home || 'EUR';
      const invoiceNumber = row.inv_invoice_number || `LEGACY-${row.inv_id}`;

      // Customer address snapshot
      const clientAddr = addrMap[row.add_id_client] || {};
      const compAddr = addrMap[row.add_id_company] || {};

      const totalAmount = row.inv_amount_cur_home_with_vat || 0;
      const subtotal = row.inv_amount_cur_home_no_vat || totalAmount;
      const paidAmount = row.inv_paid_cur_home || 0;

      await pgPool.query(`
        INSERT INTO invoices (
          legacy_id, invoice_number, customer_id,
          variable_symbol, specific_symbol, constant_symbol,
          delivery_date, issue_date, send_date, due_date,
          period_from, period_to,
          subtotal, total_amount, paid_amount, currency, status,
          payment_date,
          customer_name, customer_address, customer_city, customer_zip, customer_country,
          billing_company_name, billing_address, billing_city, billing_zip,
          created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
      `, [
        String(row.inv_id),
        invoiceNumber,
        customerId,
        row.inv_variable_symbol, row.inv_specific_symbol, row.inv_constant_symbol,
        row.inv_date_of_delivery, row.inv_date_of_issue, row.inv_dispatch_date, row.inv_date_of_payment,
        row.inv_period_from, row.inv_period_to,
        subtotal, totalAmount, paidAmount, currency, status,
        row.inv_fully_paid,
        clientAddr.add_name, clientAddr.add_street_and_number, clientAddr.add_city, clientAddr.add_zip, clientAddr.add_country,
        compAddr.add_name, compAddr.add_street_and_number, compAddr.add_city, compAddr.add_zip,
        row.inv_inserted || new Date(),
      ]);
      stats.inserted++;
      batch++;
      if (batch % 500 === 0) log(`  ... ${batch} invoices processed`);
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 10) {
        log(`  ERROR Invoice ${row.inv_id}: ${err.message}`);
      }
    }
  }
  log(`  Invoices: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);
}

// ============================================================
// 2. InvoiceItems → invoice_items
// ============================================================
async function migrateInvoiceItems() {
  log('--- Migrating InvoiceItems → invoice_items ---');
  resetStats();

  const invLookup = {};
  const pgInvs = await pgPool.query('SELECT id, legacy_id FROM invoices WHERE legacy_id IS NOT NULL');
  for (const r of pgInvs.rows) invLookup[r.legacy_id] = r.id;

  const items = await mssqlPool.request().query(`
    SELECT ii.iit_id, ii.inv_id, ii.iit_position, ii.iit_item_accounting_code,
      ii.iit_label, ii.iit_units, ii.iit_unit_code,
      ii.iit_price_cur_home_with_vat, ii.iit_price_per_unit_cur_home_with_vat,
      ii.iit_price_cur_home_no_vat, ii.iit_price_per_unit_cur_home_no_vat,
      v.vat_rate
    FROM InvoiceItems ii
    LEFT JOIN VATs v ON v.vat_id = ii.vat_id
    ORDER BY ii.inv_id, ii.iit_position
  `);

  for (const row of items.recordset) {
    try {
      const invoiceId = invLookup[String(row.inv_id)];
      if (!invoiceId) continue;

      await pgPool.query(`
        INSERT INTO invoice_items (
          invoice_id, name, quantity, unit_price, line_total, vat_rate,
          total_price, accounting_code, sort_order
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        invoiceId,
        row.iit_label || 'Item',
        row.iit_units || 1,
        row.iit_price_per_unit_cur_home_no_vat || row.iit_price_per_unit_cur_home_with_vat || 0,
        row.iit_price_cur_home_no_vat || row.iit_price_cur_home_with_vat || 0,
        row.vat_rate || 0,
        row.iit_price_cur_home_with_vat || 0,
        row.iit_item_accounting_code,
        row.iit_position || 0,
      ]);
      stats.inserted++;
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 10) log(`  ERROR Item ${row.iit_id}: ${err.message}`);
    }
  }
  log(`  Invoice Items: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);
}

// ============================================================
// 3. RealizedPayments → invoice_payments
// ============================================================
async function migratePayments() {
  log('--- Migrating RealizedPayments → invoice_payments ---');
  resetStats();

  const invLookup = {};
  const pgInvs = await pgPool.query('SELECT id, legacy_id FROM invoices WHERE legacy_id IS NOT NULL');
  for (const r of pgInvs.rows) invLookup[r.legacy_id] = r.id;

  const payments = await mssqlPool.request().query(`
    SELECT rpa_id, inv_id, rpa_amount_cur_home, rpa_date_of_payment,
      rpa_payment_identifier, rpa_detail, rpa_payment_type,
      rpa_variable_symbol, rpa_from_account_IBAN,
      rpa_note, rpa_inserted
    FROM RealizedPayments
    ORDER BY rpa_id
  `);

  for (const row of payments.recordset) {
    try {
      const invoiceId = invLookup[String(row.inv_id)];
      if (!invoiceId) continue;

      await pgPool.query(`
        INSERT INTO invoice_payments (
          invoice_id, transaction_name, amount, paid_amount,
          status, payment_date, external_reference, notes, source,
          created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        invoiceId,
        row.rpa_detail || row.rpa_payment_identifier || 'Legacy payment',
        row.rpa_amount_cur_home || 0,
        row.rpa_amount_cur_home || 0,
        'completed',
        row.rpa_date_of_payment,
        row.rpa_payment_identifier,
        row.rpa_note,
        'migration',
        row.rpa_inserted || new Date(),
      ]);
      stats.inserted++;
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 10) log(`  ERROR Payment ${row.rpa_id}: ${err.message}`);
    }
  }
  log(`  Payments: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);
}

// ============================================================
// Main
// ============================================================
async function main() {
  log('=== ISCBC → INDEXUS Migration: Phase 4 - Financial Records ===\n');

  try {
    await connect();
    await buildLookups();
    await migrateInvoices();
    await migrateInvoiceItems();
    await migratePayments();
    log('\n=== Phase 4 Complete ===');
  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

main();
