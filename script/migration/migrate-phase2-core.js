#!/usr/bin/env node
/**
 * ISCBC → INDEXUS Migration - Phase 2: Core Entities
 * Migrates: Hospitals, Collaborators, Clients/Customers
 * Run on Ubuntu: node migrate-phase2-core.js
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
const lookups = { companies: {}, labs: {} };

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
  const companies = await pgPool.query('SELECT id, legacy_id, country_code FROM billing_details WHERE legacy_id IS NOT NULL');
  for (const r of companies.rows) lookups.companies[r.legacy_id] = { id: r.id, countryCode: r.country_code };

  const labs = await pgPool.query('SELECT id, name FROM laboratories');
  for (const r of labs.rows) lookups.labs[r.name] = r.id;
}

function decomposeBirthDate(dateVal) {
  if (!dateVal) return { day: null, month: null, year: null };
  const d = new Date(dateVal);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

// ============================================================
// 1. Hospitals → hospitals
// ============================================================
async function migrateHospitals() {
  log('--- Migrating Hospitals → hospitals ---');
  resetStats();

  const hospitals = await mssqlPool.request().query(`
    SELECT h.hos_id, h.hos_name, h.hos_full_name, h.hos_active, h.rer_id,
           h.lab_id, h.hos_note, h.hos_svet_zdravia,
           h.hos_inserted, h.hos_updated,
           a.add_street_and_number, a.add_city, a.add_zip, a.add_area, a.add_country,
           l.lab_name, l.lab_country_code
    FROM Hospitals h
    LEFT JOIN MailAddresses a ON a.add_id = h.add_id AND a.add_valid = 1
    LEFT JOIN Laboratories l ON l.lab_id = h.lab_id
    ORDER BY h.hos_id
  `);

  // Determine country from related companies
  const hosCompanies = await mssqlPool.request().query(`
    SELECT DISTINCT sc.hos_id, c.com_country_code
    FROM ServiceCollections sc
    JOIN Companies c ON c.com_id = sc.com_id
    WHERE sc.hos_id IS NOT NULL
  `);
  const hosCountryMap = {};
  for (const r of hosCompanies.recordset) {
    hosCountryMap[r.hos_id] = r.com_country_code;
  }

  for (const row of hospitals.recordset) {
    try {
      const existing = await pgPool.query(
        'SELECT id FROM hospitals WHERE legacy_id = $1',
        [String(row.hos_id)]
      );
      if (existing.rows.length > 0) { stats.skipped++; continue; }

      const countryCode = row.add_country || hosCountryMap[row.hos_id] || row.lab_country_code || 'SK';
      const labId = row.lab_name ? (lookups.labs[row.lab_name] || null) : null;

      await pgPool.query(`
        INSERT INTO hospitals (
          legacy_id, name, full_name, is_active, street_number, city, postal_code, region,
          country_code, laboratory_id, svet_zdravia,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `, [
        String(row.hos_id),
        row.hos_name,
        row.hos_full_name,
        row.hos_active === true || row.hos_active === 1,
        row.add_street_and_number,
        row.add_city,
        row.add_zip,
        row.add_area,
        countryCode,
        labId,
        row.hos_svet_zdravia === true || row.hos_svet_zdravia === 1,
        row.hos_inserted || new Date(),
        row.hos_updated || row.hos_inserted || new Date(),
      ]);
      stats.inserted++;
    } catch (err) {
      stats.errors++;
      log(`  ERROR Hospital ${row.hos_id} "${row.hos_name}": ${err.message}`);
    }
  }
  log(`  Hospitals: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);
}

// ============================================================
// 2. Collaborators → collaborators
// ============================================================
async function migrateCollaborators() {
  log('--- Migrating Collaborators → collaborators ---');
  resetStats();

  const collabs = await mssqlPool.request().query(`
    SELECT d.doc_id, d.per_id, d.cty_id, d.rer_id, d.doc_active, d.doc_note,
           d.doc_IBAN, d.doc_SWIFT, d.doc_ICO, d.doc_DIC, d.doc_IC_DPH,
           d.doc_birth_place, d.doc_client_contract, d.doc_svet_zdravia,
           d.doc_monthly_rewards, d.doc_inserted, d.doc_updated,
           ct.cty_code, ct.cty_default_name,
           pd.pda_title_prefix, pd.pda_first_name, pd.pda_last_name,
           pd.pda_maiden_name, pd.pda_title_suffix, pd.pda_birth_date,
           pd.pda_id_number, pd.pda_email, pd.pda_mobile, pd.pda_mobile2,
           pd.pda_phone_number, pd.pda_other_contact
    FROM Collaborators d
    LEFT JOIN CollaboratorTypes ct ON ct.cty_id = d.cty_id
    LEFT JOIN PersonalData pd ON pd.per_id = d.per_id AND pd.pda_valid = 1
    ORDER BY d.doc_id
  `);

  // Get collaborator-hospital mappings
  const collabHospitals = await mssqlPool.request().query(
    'SELECT doc_id, hos_id FROM CollaboratorsHospitals'
  );
  const hospMap = {};
  for (const r of collabHospitals.recordset) {
    if (!hospMap[r.doc_id]) hospMap[r.doc_id] = [];
    hospMap[r.doc_id].push(String(r.hos_id));
  }

  // Get country from Companies → Collaborator agreements
  const collabCountries = await mssqlPool.request().query(`
    SELECT DISTINCT ca.doc_id, c.com_country_code
    FROM CollaboratorAgreements ca
    JOIN Companies c ON c.com_id = ca.com_id
  `);
  const countryMap = {};
  for (const r of collabCountries.recordset) countryMap[r.doc_id] = r.com_country_code;

  // Resolve hospital legacy_ids to INDEXUS IDs
  const hospitalLookup = {};
  const pgHospitals = await pgPool.query('SELECT id, legacy_id FROM hospitals WHERE legacy_id IS NOT NULL');
  for (const r of pgHospitals.rows) hospitalLookup[r.legacy_id] = r.id;

  for (const row of collabs.recordset) {
    try {
      const existing = await pgPool.query(
        'SELECT id FROM collaborators WHERE legacy_id = $1',
        [String(row.doc_id)]
      );
      if (existing.rows.length > 0) { stats.skipped++; continue; }

      const firstName = row.pda_first_name || 'N/A';
      const lastName = row.pda_last_name || 'N/A';
      const countryCode = countryMap[row.doc_id] || 'SK';
      const birth = decomposeBirthDate(row.pda_birth_date);

      // Map hospital legacy IDs to INDEXUS IDs
      const hospIds = (hospMap[row.doc_id] || [])
        .map(legId => hospitalLookup[legId])
        .filter(Boolean);

      await pgPool.query(`
        INSERT INTO collaborators (
          legacy_id, country_code, country_codes, first_name, last_name,
          title_before, maiden_name, title_after,
          birth_number, birth_day, birth_month, birth_year, birth_place,
          phone, mobile, mobile_2, other_contact, email,
          bank_account_iban, swift_code, ico, dic, ic_dph,
          client_contact, is_active, svet_zdravia, month_rewards,
          note, collaborator_type,
          hospital_ids,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
      `, [
        String(row.doc_id),
        countryCode,
        [countryCode],
        firstName, lastName,
        row.pda_title_prefix, row.pda_maiden_name, row.pda_title_suffix,
        row.pda_id_number, birth.day, birth.month, birth.year, row.doc_birth_place,
        row.pda_phone_number, row.pda_mobile, row.pda_mobile2,
        row.pda_other_contact, row.pda_email,
        row.doc_IBAN, row.doc_SWIFT, row.doc_ICO, row.doc_DIC, row.doc_IC_DPH,
        row.doc_client_contract === true || row.doc_client_contract === 1,
        row.doc_active === true || row.doc_active === 1,
        row.doc_svet_zdravia === true || row.doc_svet_zdravia === 1,
        row.doc_monthly_rewards === true || row.doc_monthly_rewards === 1,
        row.doc_note, row.cty_code,
        hospIds,
        row.doc_inserted || new Date(),
        row.doc_updated || row.doc_inserted || new Date(),
      ]);
      stats.inserted++;
    } catch (err) {
      stats.errors++;
      log(`  ERROR Collaborator ${row.doc_id}: ${err.message}`);
    }
  }
  log(`  Collaborators: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);
}

// ============================================================
// 3. Clients + PotentialClients → customers
// ============================================================
async function migrateCustomers() {
  log('--- Migrating Clients → customers ---');
  resetStats();

  const clients = await mssqlPool.request().query(`
    SELECT c.cli_id, c.com_id, c.pot_id, c.cli_children, c.cli_mailinglist,
           c.cli_note, c.cli_rating, c.cli_inserted, c.cli_updated,
           c.cli_marketing_signed_tx, c.cli_agree_marketing_news,
           comp.com_country_code,
           pd.pda_title_prefix, pd.pda_first_name, pd.pda_last_name,
           pd.pda_maiden_name, pd.pda_title_suffix, pd.pda_birth_date,
           pd.pda_id_number, pd.pda_id_card, pd.pda_sex,
           pd.pda_email, pd.pda_email2, pd.pda_mobile, pd.pda_mobile2,
           pd.pda_phone_number, pd.pda_other_contact,
           pd.pda_bank_name, pd.pda_account_number, pd.pda_account_bank_code,
           pd.pda_IBAN, pd.pda_SWIFT,
           pd.pda_health_insurance_code,
           a_perm.add_street_and_number as perm_street, a_perm.add_city as perm_city,
           a_perm.add_zip as perm_zip, a_perm.add_area as perm_area, a_perm.add_country as perm_country,
           a_corr.add_name as corr_name, a_corr.add_street_and_number as corr_street,
           a_corr.add_city as corr_city, a_corr.add_zip as corr_zip,
           a_corr.add_area as corr_area, a_corr.add_country as corr_country
    FROM Clients c
    JOIN Persons p ON p.per_id = c.per_id
    LEFT JOIN PersonalData pd ON pd.per_id = p.per_id AND pd.pda_valid = 1
    LEFT JOIN Companies comp ON comp.com_id = c.com_id
    LEFT JOIN MailAddresses a_perm ON a_perm.per_id = p.per_id AND a_perm.add_valid = 1
      AND a_perm.mat_id IN (SELECT mat_id FROM MailAddressTypes WHERE mat_code = 'PERMANENT')
    LEFT JOIN MailAddresses a_corr ON a_corr.per_id = p.per_id AND a_corr.add_valid = 1
      AND a_corr.mat_id IN (SELECT mat_id FROM MailAddressTypes WHERE mat_code = 'MAIL')
    WHERE c.cli_deleted = 0 OR c.cli_deleted IS NULL
    ORDER BY c.cli_id
  `);

  // Determine client status from contracts
  const clientContracts = await mssqlPool.request().query(`
    SELECT con.cli_id, cs.csa_code
    FROM Contracts con
    JOIN ContractStatuses cs ON cs.csa_id = con.csa_id
  `);
  const contractStatusMap = {};
  for (const r of clientContracts.recordset) {
    contractStatusMap[r.cli_id] = r.csa_code;
  }

  for (const row of clients.recordset) {
    try {
      const existing = await pgPool.query(
        'SELECT id FROM customers WHERE internal_id = $1',
        [String(row.cli_id)]
      );
      if (existing.rows.length > 0) { stats.skipped++; continue; }

      const firstName = row.pda_first_name || 'N/A';
      const lastName = row.pda_last_name || 'N/A';
      const email = row.pda_email || `legacy_${row.cli_id}@import.local`;
      const country = row.perm_country || row.com_country_code || 'SK';

      // Determine clientStatus
      let clientStatus = 'potential';
      const csaCode = contractStatusMap[row.cli_id];
      if (csaCode) {
        if (['REALIZED', 'CONFIRMED', 'RETURNED', 'VALIDATED'].includes(csaCode)) {
          clientStatus = 'acquired';
        } else if (['TERMINATED', 'CANCELLED'].includes(csaCode)) {
          clientStatus = 'terminated';
        } else {
          clientStatus = 'in_process';
        }
      }

      // Bank account: prefer IBAN
      const bankAccount = row.pda_IBAN || (row.pda_account_number ? `${row.pda_account_number}/${row.pda_account_bank_code}` : null);

      const hasCorr = !!(row.corr_street || row.corr_city);

      await pgPool.query(`
        INSERT INTO customers (
          internal_id, title_before, first_name, last_name, maiden_name, title_after,
          phone, mobile, mobile_2, other_contact, email, email_2,
          national_id, id_card_number, date_of_birth, newsletter,
          country, city, address, postal_code, region,
          use_correspondence_address, corr_name, corr_address, corr_city, corr_postal_code, corr_region, corr_country,
          bank_account, bank_code, bank_name, bank_swift,
          client_status, status, notes, lead_score,
          created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)
      `, [
        String(row.cli_id),
        row.pda_title_prefix, firstName, lastName, row.pda_maiden_name, row.pda_title_suffix,
        row.pda_phone_number, row.pda_mobile, row.pda_mobile2, row.pda_other_contact,
        email, row.pda_email2,
        row.pda_id_number, row.pda_id_card, row.pda_birth_date,
        row.cli_mailinglist === true || row.cli_mailinglist === 1,
        country, row.perm_city, row.perm_street, row.perm_zip, row.perm_area,
        hasCorr, row.corr_name, row.corr_street, row.corr_city, row.corr_zip, row.corr_area, row.corr_country,
        bankAccount, row.pda_account_bank_code, row.pda_bank_name, row.pda_SWIFT,
        clientStatus, 'active', row.cli_note,
        row.cli_rating || 0,
        row.cli_inserted || new Date(),
      ]);
      stats.inserted++;
    } catch (err) {
      stats.errors++;
      log(`  ERROR Client ${row.cli_id}: ${err.message}`);
    }
  }
  log(`  Customers: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);
}

// ============================================================
// Main
// ============================================================
async function main() {
  log('=== ISCBC → INDEXUS Migration: Phase 2 - Core Entities ===\n');

  try {
    await connect();
    await buildLookups();
    await migrateHospitals();
    await migrateCollaborators();
    await migrateCustomers();
    log('\n=== Phase 2 Complete ===');
  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

main();
