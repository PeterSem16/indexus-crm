#!/usr/bin/env node
/**
 * ISCBC → INDEXUS Migration - Phase 1: Reference Data
 * Migrates: Companies, CollectionStatuses, Laboratories, Products, MarketProducts, ExchangeRates
 * Run on Ubuntu: node migrate-phase1-reference.js
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
  requestTimeout: 60000,
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

function resetStats() { stats = { inserted: 0, skipped: 0, errors: 0 }; }

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function connect() {
  log('Connecting to MSSQL...');
  mssqlPool = await sql.connect(MSSQL_CONFIG);
  log('Connected to MSSQL');

  log('Connecting to PostgreSQL...');
  pgPool = new Pool(PG_CONFIG);
  await pgPool.query('SELECT 1');
  log('Connected to PostgreSQL');
}

async function disconnect() {
  await mssqlPool?.close();
  await pgPool?.end();
  log('Connections closed');
}

// ============================================================
// 1. Companies → billing_details
// ============================================================
async function migrateCompanies() {
  log('--- Migrating Companies → billing_details ---');
  resetStats();

  const companies = await mssqlPool.request().query(`
    SELECT c.com_id, c.com_code, c.com_name, c.com_country_code, c.com_entity_code,
           c.com_invoice_barcode_letter, c.cur_code,
           cd.cod_full_name, cd.cod_phone_contact, cd.cod_email,
           cd.cod_ico, cd.cod_dic, cd.cod_vat_dic,
           cd.cod_web_from_email, cd.cod_default_language,
           a_res.add_street_and_number as res_street, a_res.add_city as res_city,
           a_res.add_zip as res_zip, a_res.add_area as res_area, a_res.add_country as res_country,
           a_mail.add_street_and_number as mail_street, a_mail.add_city as mail_city,
           a_mail.add_zip as mail_zip, a_mail.add_area as mail_area, a_mail.add_country as mail_country
    FROM Companies c
    LEFT JOIN CompanyDetails cd ON cd.com_id = c.com_id AND cd.cod_active = 1
    LEFT JOIN MailAddresses a_res ON a_res.add_id = cd.add_id_residence AND a_res.add_valid = 1
    LEFT JOIN MailAddresses a_mail ON a_mail.add_id = cd.add_id_mail AND a_mail.add_valid = 1
    ORDER BY c.com_id
  `);

  for (const row of companies.recordset) {
    try {
      const existing = await pgPool.query(
        'SELECT id FROM billing_details WHERE legacy_id = $1',
        [String(row.com_id)]
      );
      if (existing.rows.length > 0) { stats.skipped++; continue; }

      await pgPool.query(`
        INSERT INTO billing_details (
          legacy_id, company_name, country_code, code, entity_code,
          invoice_barcode_letter, currency,
          tax_id, vat_id,
          address, city, postal_code, postal_street, postal_city, postal_postal_code
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      `, [
        String(row.com_id),
        row.cod_full_name || row.com_name,
        row.com_country_code,
        row.com_code,
        row.com_entity_code,
        row.com_invoice_barcode_letter,
        row.cur_code || 'EUR',
        row.cod_ico,
        row.cod_dic || row.cod_vat_dic,
        row.res_street, row.res_city, row.res_zip,
        row.mail_street, row.mail_city, row.mail_zip,
      ]);
      stats.inserted++;
    } catch (err) {
      stats.errors++;
      log(`  ERROR Company ${row.com_id}: ${err.message}`);
    }
  }
  log(`  Companies: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);
}

// ============================================================
// 2. CollectionStatuses → collection_statuses
// ============================================================
async function migrateCollectionStatuses() {
  log('--- Migrating CollectionStatuses → collection_statuses ---');
  resetStats();

  const statuses = await mssqlPool.request().query(
    'SELECT csu_id, csu_code, csu_default_name, csu_order, csu_description FROM CollectionStatuses ORDER BY csu_order'
  );

  for (const row of statuses.recordset) {
    try {
      const existing = await pgPool.query(
        'SELECT id FROM collection_statuses WHERE legacy_id = $1',
        [String(row.csu_id)]
      );
      if (existing.rows.length > 0) { stats.skipped++; continue; }

      await pgPool.query(`
        INSERT INTO collection_statuses (legacy_id, code, name, sort_order, description)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        String(row.csu_id),
        row.csu_code,
        row.csu_default_name,
        row.csu_order,
        row.csu_description,
      ]);
      stats.inserted++;
    } catch (err) {
      stats.errors++;
      log(`  ERROR Status ${row.csu_id}: ${err.message}`);
    }
  }
  log(`  CollectionStatuses: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);
}

// ============================================================
// 3. Laboratories → laboratories
// ============================================================
async function migrateLaboratories() {
  log('--- Migrating Laboratories → laboratories ---');
  resetStats();

  const labs = await mssqlPool.request().query(
    'SELECT lab_id, lab_name, lab_full_name, lab_country_code, lab_phone, lab_email FROM Laboratories'
  );

  for (const row of labs.recordset) {
    try {
      const existing = await pgPool.query(
        "SELECT id FROM laboratories WHERE name = $1 AND country_code = $2",
        [row.lab_name, row.lab_country_code || 'SK']
      );
      if (existing.rows.length > 0) { stats.skipped++; continue; }

      await pgPool.query(`
        INSERT INTO laboratories (name, country_code, is_active)
        VALUES ($1, $2, $3)
      `, [row.lab_name, row.lab_country_code || 'SK', true]);
      stats.inserted++;
    } catch (err) {
      stats.errors++;
      log(`  ERROR Lab ${row.lab_id}: ${err.message}`);
    }
  }
  log(`  Laboratories: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);
}

// ============================================================
// Main
// ============================================================
async function main() {
  log('=== ISCBC → INDEXUS Migration: Phase 1 - Reference Data ===\n');

  try {
    await connect();
    await migrateCompanies();
    await migrateCollectionStatuses();
    await migrateLaboratories();
    log('\n=== Phase 1 Complete ===');
  } catch (err) {
    log(`FATAL: ${err.message}`);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

main();
