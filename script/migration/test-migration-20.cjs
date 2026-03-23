#!/usr/bin/env node
/**
 * CBC → INDEXUS Test Migration (20 records per entity)
 * 
 * Testovací scenár:
 *   Step 1: Test connection + zobraz vzorky dát z CBC
 *   Step 2: Reference data (CollectionStatuses, Laboratories)
 *   Step 3: Hospitals (TOP 20)
 *   Step 4: Collaborators (TOP 20)
 *   Step 5: Customers/Clients (TOP 20)
 *   Step 6: Collections + Lab Results (TOP 20)
 *   Step 7: Verification — porovnanie zdrojových vs prenesených dát
 *
 * Run on Ubuntu: cd /var/www/indexus-crm/script/migration && node test-migration-20.cjs
 * Requires: npm install mssql pg
 *
 * BEZPEČNÉ: Neprepisuje existujúce dáta (skip ak legacy_id existuje)
 * BEZ: Invoices, Billing Companies, Rewards
 */
const sql = require('mssql');
const { Pool } = require('pg');
const { normalizePhone, normalizeEmail, normalizeName, normalizeNationalId, normalizePostalCode, normalizeCity } = require('./consolidate-contacts.cjs');

const MSSQL_CONFIG = {
  user: 'cbcuser',
  password: 'XqU0nNND',
  server: '10.1.2.2',
  port: 1433,
  database: 'CBC',
  options: { encrypt: false, trustServerCertificate: true },
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

const LIMIT = 20;
let mssqlPool, pgPool;

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function separator(title) {
  console.log('');
  console.log('═'.repeat(70));
  console.log(`  ${title}`);
  console.log('═'.repeat(70));
}
function table(headers, rows) {
  const adjustedWidths = headers.map((h, i) =>
    Math.min(30, Math.max(h.length, ...rows.map(r => String(r[i] || '').length)))
  );
  console.log('  ' + headers.map((h, i) => h.padEnd(adjustedWidths[i])).join(' | '));
  console.log('  ' + adjustedWidths.map(w => '─'.repeat(w)).join('─┼─'));
  for (const row of rows) {
    console.log('  ' + row.map((c, i) => String(c || '—').slice(0, 30).padEnd(adjustedWidths[i])).join(' | '));
  }
}

function normalizeCountryCode(cbcCode) {
  if (!cbcCode) return 'SK';
  const s = String(cbcCode).trim();
  if (s.startsWith('COUNTRY_')) return s.replace('COUNTRY_', '');
  return s;
}

function decomposeBirthDate(dateVal) {
  if (!dateVal) return { day: null, month: null, year: null };
  const d = new Date(dateVal);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

// ============================================================
// STEP 1: Test Connection + Show Source Data Samples
// ============================================================
async function step1_testConnection() {
  separator('STEP 1: Test pripojenia + vzorky dát z CBC');

  mssqlPool = await sql.connect(MSSQL_CONFIG);
  log('✓ Pripojené k MSSQL (CBC)');

  pgPool = new Pool(PG_CONFIG);
  await pgPool.query('SELECT 1');
  log('✓ Pripojené k PostgreSQL (INDEXUS)');

  const counts = await mssqlPool.request().query(`
    SELECT 'CollectionStatuses' as t, COUNT(*) as cnt FROM CollectionStatuses
    UNION ALL SELECT 'Laboratories', COUNT(*) FROM Laboratories
    UNION ALL SELECT 'Hospitals', COUNT(*) FROM Hospitals
    UNION ALL SELECT 'Collaborators', COUNT(*) FROM Collaborators
    UNION ALL SELECT 'Clients', COUNT(*) FROM Clients WHERE cli_deleted = 0 OR cli_deleted IS NULL
    UNION ALL SELECT 'ServiceCollections', COUNT(*) FROM ServiceCollections
    UNION ALL SELECT 'CollectionEvaluationResults', COUNT(*) FROM CollectionEvaluationResults
    ORDER BY 1
  `);

  log('\nPočty záznamov v CBC:');
  table(['Tabuľka', 'Počet'], counts.recordset.map(r => [r.t, r.cnt]));

  log('\nUkážka telefónnych formátov v CBC (PersonalData):');
  const phones = await mssqlPool.request().query(`
    SELECT TOP 10 pda_mobile, pda_phone_number, pda_email
    FROM PersonalData WHERE pda_valid = 1 AND pda_mobile IS NOT NULL AND pda_mobile != ''
    ORDER BY pda_id DESC
  `);
  table(
    ['Mobil (RAW)', 'Normalized', 'Telefón (RAW)', 'Email (RAW)'],
    phones.recordset.map(r => [
      r.pda_mobile,
      normalizePhone(r.pda_mobile, 'SK'),
      r.pda_phone_number,
      r.pda_email,
    ])
  );

  log('\n--- Diagnostika CBC: Lab Result Kódy (TOP 30) ---');
  try {
    const labCodes = await mssqlPool.request().query(`
      SELECT TOP 30 cet.cet_code, cet.cet_field_name, cet.cet_order, COUNT(*) as cnt
      FROM CollectionEvaluationTemplates cet
      JOIN CollectionEvaluationResults cer ON cer.cet_id = cet.cet_id
      GROUP BY cet.cet_code, cet.cet_field_name, cet.cet_order
      ORDER BY cet.cet_order
    `);
    table(
      ['cet_code', 'cet_field_name', 'Poradie', 'Počet'],
      labCodes.recordset.map(r => [r.cet_code, r.cet_field_name, r.cet_order, r.cnt])
    );
  } catch (err) { log(`  WARN: Lab codes: ${err.message}`); }

  log('\n--- Diagnostika CBC: Otec (Contracts/Father) ---');
  try {
    const fatherCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Contracts' AND COLUMN_NAME LIKE '%father%'
      ORDER BY COLUMN_NAME
    `);
    if (fatherCols.recordset.length > 0) {
      log('  Contracts stĺpce s "father": ' + fatherCols.recordset.map(r => r.COLUMN_NAME).join(', '));
    } else {
      log('  Contracts: žiadne stĺpce s "father"');
    }

    const allContractCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Contracts'
      ORDER BY ORDINAL_POSITION
    `);
    log('  Contracts ALL: ' + allContractCols.recordset.map(r => r.COLUMN_NAME).join(', '));

    const fatherTables = await mssqlPool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME LIKE '%father%' OR COLUMN_NAME LIKE '%otec%'
      ORDER BY TABLE_NAME, COLUMN_NAME
    `);
    if (fatherTables.recordset.length > 0) {
      log('  Tabuľky s otcovskými stĺpcami:');
      for (const r of fatherTables.recordset) log(`    ${r.TABLE_NAME}.${r.COLUMN_NAME}`);
    } else {
      log('  Žiadne tabuľky s otcovskými stĺpcami v CBC');
    }

    const potTable = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'PotentialClients' OR TABLE_NAME = 'Potentials'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);
    if (potTable.recordset.length > 0) {
      log('  PotentialClients stĺpce: ' + potTable.recordset.map(r => r.COLUMN_NAME).join(', '));
    }

    const scoFatherCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ServiceCollections' AND (COLUMN_NAME LIKE '%father%' OR COLUMN_NAME LIKE '%otec%' OR COLUMN_NAME LIKE '%child%' OR COLUMN_NAME LIKE '%dieta%')
      ORDER BY COLUMN_NAME
    `);
    if (scoFatherCols.recordset.length > 0) {
      log('  ServiceCollections child/father stĺpce: ' + scoFatherCols.recordset.map(r => r.COLUMN_NAME).join(', '));
    }

    const conSample = await mssqlPool.request().query(`
      SELECT TOP 3 con_id, cli_id, hos_id, pot_id, con_expected_collection_date, con_pregnancy_type
      FROM Contracts WHERE pot_id IS NOT NULL ORDER BY con_id DESC
    `);
    log('  Contracts sample (s pot_id):');
    table(['con_id', 'cli_id', 'hos_id', 'pot_id', 'Expected Date', 'Pregnancy'],
      conSample.recordset.map(r => [r.con_id, r.cli_id, r.hos_id, r.pot_id, r.con_expected_collection_date, r.con_pregnancy_type])
    );
  } catch (err) { log(`  WARN: Father columns: ${err.message}`); }

  log('\n--- Diagnostika CBC: Hospital active values ---');
  try {
    const hospActive = await mssqlPool.request().query(`
      SELECT hos_active, COUNT(*) as cnt FROM Hospitals GROUP BY hos_active
    `);
    table(['hos_active', 'Počet'], hospActive.recordset.map(r => [String(r.hos_active), r.cnt]));
  } catch (err) { log(`  WARN: Hospital active: ${err.message}`); }

  log('\n--- Diagnostika CBC: Hospital adresy (sample) ---');
  try {
    const hospAddr = await mssqlPool.request().query(`
      SELECT TOP 5 h.hos_id, h.hos_name, h.add_id,
             a.add_city, a.add_street_and_number, a.add_zip, a.add_country, a.add_valid
      FROM Hospitals h
      LEFT JOIN MailAddresses a ON a.add_id = h.add_id
      WHERE h.hos_active = 1
      ORDER BY h.hos_id DESC
    `);
    table(
      ['hos_id', 'Názov', 'add_id', 'Mesto', 'Ulica', 'PSČ', 'Krajina', 'Valid'],
      hospAddr.recordset.map(r => [r.hos_id, r.hos_name, r.add_id, r.add_city, r.add_street_and_number, r.add_zip, r.add_country, r.add_valid])
    );
  } catch (err) { log(`  WARN: Hospital addr: ${err.message}`); }
}

// ============================================================
// STEP 2: Reference Data
// ============================================================
async function step2_referenceData() {
  separator('STEP 2: Referenčné dáta (StatusyOdberov, Laboratóriá)');

  log('--- CollectionStatuses ---');
  const statuses = await mssqlPool.request().query(`
    SELECT csu_id, csu_code, csu_default_name, csu_order
    FROM CollectionStatuses ORDER BY csu_order
  `);

  table(
    ['ID', 'Kód', 'Názov', 'Poradie'],
    statuses.recordset.map(r => [r.csu_id, r.csu_code, r.csu_default_name, r.csu_order])
  );

  let sInserted = 0, sSkipped = 0;
  for (const row of statuses.recordset) {
    const existing = await pgPool.query('SELECT id FROM collection_statuses WHERE id = $1', [row.csu_id]);
    if (existing.rows.length > 0) { sSkipped++; continue; }

    await pgPool.query(`
      INSERT INTO collection_statuses (id, name, code, branch, sort_order, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
    `, [row.csu_id, row.csu_default_name, row.csu_code || '', 1, row.csu_order || 0]);
    sInserted++;
  }
  log(`  → ${sInserted} vložených, ${sSkipped} preskočených`);

  log('\n--- Laboratories ---');
  const labs = await mssqlPool.request().query(`
    SELECT lab_id, lab_name, lab_full_name, lab_country_code, lab_phone, lab_email
    FROM Laboratories ORDER BY lab_id
  `);

  table(
    ['ID', 'Názov', 'Krajina', 'Telefón', 'Email'],
    labs.recordset.map(r => [r.lab_id, r.lab_name, r.lab_country_code, r.lab_phone, r.lab_email])
  );

  let lInserted = 0, lSkipped = 0;
  for (const row of labs.recordset) {
    const existing = await pgPool.query('SELECT id FROM laboratories WHERE name = $1', [row.lab_name]);
    if (existing.rows.length > 0) { lSkipped++; continue; }

    await pgPool.query(`
      INSERT INTO laboratories (name, country_code, is_active)
      VALUES ($1, $2, true)
    `, [row.lab_name, normalizeCountryCode(row.lab_country_code)]);
    lInserted++;
  }
  log(`  → ${lInserted} vložených, ${lSkipped} preskočených`);
}

// ============================================================
// STEP 3: Hospitals (TOP 20)
// ============================================================
async function step3_hospitals() {
  separator(`STEP 3: Nemocnice (TOP ${LIMIT})`);

  const labLookup = {};
  const pgLabs = await pgPool.query('SELECT id, name FROM laboratories');
  for (const r of pgLabs.rows) labLookup[r.name] = r.id;

  const hospitals = await mssqlPool.request().query(`
    SELECT TOP ${LIMIT} h.hos_id, h.hos_name, h.hos_full_name, h.hos_active,
           h.hos_svet_zdravia, h.hos_inserted,
           a.add_street_and_number, a.add_city, a.add_zip, a.add_area, a.add_country,
           l.lab_name, l.lab_country_code
    FROM Hospitals h
    LEFT JOIN MailAddresses a ON a.add_id = h.add_id AND a.add_valid = 1
    LEFT JOIN Laboratories l ON l.lab_id = h.lab_id
    ORDER BY h.hos_id DESC
  `);

  log('Zdrojové dáta z CBC:');
  table(
    ['hos_id', 'Názov', 'Mesto', 'PSČ', 'Krajina', 'Lab', 'Aktívna'],
    hospitals.recordset.map(r => [
      r.hos_id, r.hos_name, r.add_city, r.add_zip,
      r.add_country || r.lab_country_code || '?', r.lab_name, r.hos_active ? 'áno' : 'nie'
    ])
  );

  let inserted = 0, skipped = 0, errors = 0;
  for (const row of hospitals.recordset) {
    try {
      const existing = await pgPool.query('SELECT id FROM hospitals WHERE legacy_id = $1', [String(row.hos_id)]);
      if (existing.rows.length > 0) { skipped++; continue; }

      const countryCode = normalizeCountryCode(row.add_country || row.lab_country_code);
      const labId = row.lab_name ? (labLookup[row.lab_name] || null) : null;

      await pgPool.query(`
        INSERT INTO hospitals (
          legacy_id, name, full_name, is_active, street_number, city, postal_code, region,
          country_code, laboratory_id, svet_zdravia, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `, [
        String(row.hos_id), row.hos_name, row.hos_full_name,
        !!row.hos_active,
        row.add_street_and_number, normalizeCity(row.add_city),
        normalizePostalCode(row.add_zip, countryCode), row.add_area,
        countryCode, labId,
        row.hos_svet_zdravia === true || row.hos_svet_zdravia === 1,
        row.hos_inserted || new Date(), new Date(),
      ]);
      inserted++;
    } catch (err) {
      errors++;
      log(`  ERROR hos_id=${row.hos_id}: ${err.message}`);
    }
  }
  log(`\n  → ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);
}

// ============================================================
// STEP 4: Collaborators (TOP 20)
// ============================================================
async function step4_collaborators() {
  separator(`STEP 4: Spolupracovníci (TOP ${LIMIT})`);

  const hospitalLookup = {};
  const pgH = await pgPool.query('SELECT id, legacy_id FROM hospitals WHERE legacy_id IS NOT NULL');
  for (const r of pgH.rows) hospitalLookup[r.legacy_id] = r.id;

  const collabs = await mssqlPool.request().query(`
    SELECT TOP ${LIMIT} d.doc_id, d.per_id, d.doc_active, d.doc_note,
           d.doc_IBAN, d.doc_SWIFT, d.doc_ICO, d.doc_DIC, d.doc_IC_DPH,
           d.doc_birth_place, d.doc_client_contract, d.doc_svet_zdravia,
           d.doc_monthly_rewards, d.doc_inserted,
           ct.cty_code,
           pd.pda_title_prefix, pd.pda_first_name, pd.pda_last_name,
           pd.pda_maiden_name, pd.pda_title_suffix, pd.pda_birth_date,
           pd.pda_id_number, pd.pda_email, pd.pda_mobile, pd.pda_mobile2,
           pd.pda_phone_number, pd.pda_other_contact
    FROM Collaborators d
    LEFT JOIN CollaboratorTypes ct ON ct.cty_id = d.cty_id
    LEFT JOIN PersonalData pd ON pd.per_id = d.per_id AND pd.pda_valid = 1
    ORDER BY d.doc_id DESC
  `);

  const collabCountries = await mssqlPool.request().query(`
    SELECT DISTINCT ca.doc_id, c.com_country_code
    FROM CollaboratorAgreements ca
    JOIN Companies c ON c.com_id = ca.com_id
  `);
  const countryMap = {};
  for (const r of collabCountries.recordset) countryMap[r.doc_id] = normalizeCountryCode(r.com_country_code);

  let hospMap = {};
  try {
    const collabHospitals = await mssqlPool.request().query('SELECT doc_id, hos_id FROM CollaboratorsHospitals');
    for (const r of collabHospitals.recordset) {
      if (!hospMap[r.doc_id]) hospMap[r.doc_id] = [];
      hospMap[r.doc_id].push(String(r.hos_id));
    }
  } catch (err) {
    log(`  WARN: CollaboratorsHospitals: ${err.message}`);
  }

  log('Zdrojové dáta z CBC:');
  table(
    ['doc_id', 'Meno', 'Priezvisko', 'Typ', 'Mobil (RAW)', '→ Normalized', 'Email', 'Krajina'],
    collabs.recordset.map(r => [
      r.doc_id, r.pda_first_name, r.pda_last_name, r.cty_code,
      r.pda_mobile, normalizePhone(r.pda_mobile, countryMap[r.doc_id] || 'SK'),
      r.pda_email, countryMap[r.doc_id] || 'SK',
    ])
  );

  let inserted = 0, skipped = 0, errors = 0;
  for (const row of collabs.recordset) {
    try {
      const existing = await pgPool.query('SELECT id FROM collaborators WHERE legacy_id = $1', [String(row.doc_id)]);
      if (existing.rows.length > 0) { skipped++; continue; }

      const countryCode = normalizeCountryCode(countryMap[row.doc_id]);
      const firstName = normalizeName(row.pda_first_name) || 'N/A';
      const lastName = normalizeName(row.pda_last_name) || 'N/A';
      const birth = decomposeBirthDate(row.pda_birth_date);

      const hospIds = (hospMap[row.doc_id] || []).map(legId => hospitalLookup[legId]).filter(Boolean);

      await pgPool.query(`
        INSERT INTO collaborators (
          legacy_id, country_code, country_codes, first_name, last_name,
          title_before, maiden_name, title_after,
          birth_number, birth_day, birth_month, birth_year, birth_place,
          phone, mobile, mobile_2, other_contact, email,
          bank_account_iban, swift_code, ico, dic, ic_dph,
          client_contact, is_active, svet_zdravia, month_rewards,
          note, collaborator_type, hospital_ids,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
      `, [
        String(row.doc_id), countryCode, [countryCode],
        firstName, lastName,
        row.pda_title_prefix, normalizeName(row.pda_maiden_name), row.pda_title_suffix,
        normalizeNationalId(row.pda_id_number), birth.day, birth.month, birth.year, row.doc_birth_place,
        normalizePhone(row.pda_phone_number, countryCode),
        normalizePhone(row.pda_mobile, countryCode),
        normalizePhone(row.pda_mobile2, countryCode),
        row.pda_other_contact, normalizeEmail(row.pda_email),
        row.doc_IBAN, row.doc_SWIFT, row.doc_ICO, row.doc_DIC, row.doc_IC_DPH,
        row.doc_client_contract === true || row.doc_client_contract === 1,
        row.doc_active === true || row.doc_active === 1,
        row.doc_svet_zdravia === true || row.doc_svet_zdravia === 1,
        row.doc_monthly_rewards === true || row.doc_monthly_rewards === 1,
        row.doc_note, row.cty_code, hospIds,
        row.doc_inserted || new Date(), new Date(),
      ]);
      inserted++;
    } catch (err) {
      errors++;
      log(`  ERROR doc_id=${row.doc_id}: ${err.message}`);
    }
  }
  log(`\n  → ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);
}

// ============================================================
// STEP 5: Customers (TOP 20)
// ============================================================
async function step5_customers() {
  separator(`STEP 5: Klientky/Zákazníci (TOP ${LIMIT})`);

  const clients = await mssqlPool.request().query(`
    SELECT TOP ${LIMIT} c.cli_id, c.com_id, c.cli_children, c.cli_mailinglist,
           c.cli_note, c.cli_rating, c.cli_inserted,
           comp.com_country_code,
           pd.pda_title_prefix, pd.pda_first_name, pd.pda_last_name,
           pd.pda_maiden_name, pd.pda_title_suffix, pd.pda_birth_date,
           pd.pda_id_number, pd.pda_id_card, pd.pda_sex,
           pd.pda_email, pd.pda_email2, pd.pda_mobile, pd.pda_mobile2,
           pd.pda_phone_number, pd.pda_other_contact,
           pd.pda_bank_name, pd.pda_account_number, pd.pda_account_bank_code,
           pd.pda_IBAN, pd.pda_SWIFT,
           a_perm.add_street_and_number as perm_street, a_perm.add_city as perm_city,
           a_perm.add_zip as perm_zip, a_perm.add_area as perm_area, a_perm.add_country as perm_country,
           a_corr.add_name as corr_name, a_corr.add_street_and_number as corr_street,
           a_corr.add_city as corr_city, a_corr.add_zip as corr_zip,
           a_corr.add_area as corr_area, a_corr.add_country as corr_country
    FROM Clients c
    JOIN Persons p ON p.per_id = c.per_id
    LEFT JOIN PersonalData pd ON pd.per_id = p.per_id AND pd.pda_valid = 1
    LEFT JOIN Companies comp ON comp.com_id = c.com_id
    LEFT JOIN MailAddresses a_perm ON a_perm.per_id = p.per_id AND a_perm.add_valid = 1 AND a_perm.mat_id = 1
    LEFT JOIN MailAddresses a_corr ON a_corr.per_id = p.per_id AND a_corr.add_valid = 1 AND a_corr.mat_id = 3
    WHERE c.cli_deleted = 0 OR c.cli_deleted IS NULL
    ORDER BY c.cli_id DESC
  `);

  const cliIds = clients.recordset.map(r => r.cli_id);
  const clientContracts = await mssqlPool.request().query(`
    SELECT con.cli_id, cs.csa_code
    FROM Contracts con
    JOIN ContractStatuses cs ON cs.csa_id = con.csa_id
    WHERE con.cli_id IN (${cliIds.join(',')})
  `);
  const contractStatusMap = {};
  for (const r of clientContracts.recordset) contractStatusMap[r.cli_id] = r.csa_code;

  log('Zdrojové dáta z CBC:');
  table(
    ['cli_id', 'Meno', 'Priezvisko', 'Mobil (RAW)', '→ Normalized', 'Email', 'Mesto', 'Krajina'],
    clients.recordset.map(r => [
      r.cli_id, r.pda_first_name, r.pda_last_name,
      r.pda_mobile, normalizePhone(r.pda_mobile, normalizeCountryCode(r.perm_country || r.com_country_code)),
      r.pda_email, r.perm_city, normalizeCountryCode(r.perm_country || r.com_country_code),
    ])
  );

  let inserted = 0, skipped = 0, errors = 0;
  for (const row of clients.recordset) {
    try {
      const existing = await pgPool.query('SELECT id FROM customers WHERE internal_id = $1', [String(row.cli_id)]);
      if (existing.rows.length > 0) { skipped++; continue; }

      const country = normalizeCountryCode(row.perm_country || row.com_country_code);
      const firstName = normalizeName(row.pda_first_name) || 'N/A';
      const lastName = normalizeName(row.pda_last_name) || 'N/A';
      const email = normalizeEmail(row.pda_email) || `legacy_${row.cli_id}@import.local`;

      let clientStatus = 'potential';
      const csaCode = contractStatusMap[row.cli_id];
      if (csaCode) {
        if (['REG_CSA_REALIZED', 'REG_CSA_CONFIRMED_RECEPTION', 'REG_CSA_RETURNED', 'REG_CSA_VALIDATED'].includes(csaCode)) clientStatus = 'acquired';
        else if (['REG_CSA_TERMINATED', 'REG_CSA_CANCELLED'].includes(csaCode)) clientStatus = 'terminated';
        else clientStatus = 'in_process';
      }

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
          client_status, status, notes, lead_score, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)
      `, [
        String(row.cli_id),
        row.pda_title_prefix, firstName, lastName, normalizeName(row.pda_maiden_name), row.pda_title_suffix,
        normalizePhone(row.pda_phone_number, country) || normalizePhone(row.pda_mobile, country), normalizePhone(row.pda_mobile, country),
        normalizePhone(row.pda_mobile2, country), row.pda_other_contact,
        email, normalizeEmail(row.pda_email2),
        normalizeNationalId(row.pda_id_number), row.pda_id_card, row.pda_birth_date,
        row.cli_mailinglist === true || row.cli_mailinglist === 1,
        country, normalizeCity(row.perm_city), row.perm_street, normalizePostalCode(row.perm_zip, country), row.perm_area,
        hasCorr, row.corr_name, row.corr_street, normalizeCity(row.corr_city),
        normalizePostalCode(row.corr_zip, normalizeCountryCode(row.corr_country) || country), row.corr_area, normalizeCountryCode(row.corr_country),
        bankAccount, row.pda_account_bank_code, row.pda_bank_name, row.pda_SWIFT,
        clientStatus, 'active', row.cli_note, row.cli_rating || 0,
        row.cli_inserted || new Date(),
      ]);
      inserted++;
    } catch (err) {
      errors++;
      log(`  ERROR cli_id=${row.cli_id}: ${err.message}`);
    }
  }
  log(`\n  → ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);
}

// ============================================================
// STEP 6: Collections + Lab Results (TOP 20)
// ============================================================
async function step6_collections() {
  separator(`STEP 6: Odbery + Lab výsledky (TOP ${LIMIT})`);

  const hospitalLookup = {};
  const pgH = await pgPool.query('SELECT id, legacy_id FROM hospitals WHERE legacy_id IS NOT NULL');
  for (const r of pgH.rows) hospitalLookup[r.legacy_id] = r.id;

  const collabLookup = {};
  const pgC = await pgPool.query('SELECT id, legacy_id FROM collaborators WHERE legacy_id IS NOT NULL');
  for (const r of pgC.rows) collabLookup[r.legacy_id] = r.id;

  const customerLookup = {};
  const pgCust = await pgPool.query('SELECT id, internal_id FROM customers WHERE internal_id IS NOT NULL');
  for (const r of pgCust.rows) customerLookup[r.internal_id] = r.id;

  const collabMap = {};
  const collabRows = await mssqlPool.request().query(`
    SELECT cc.sco_id, cc.doc_id, at2.agt_code
    FROM CollectionCollaborators cc
    LEFT JOIN CollaborationAgreementTypes at2 ON at2.agt_id = cc.agt_id
  `);
  for (const r of collabRows.recordset) {
    if (!collabMap[r.sco_id]) collabMap[r.sco_id] = {};
    const code = (r.agt_code || '').toUpperCase();
    if (code.includes('BLOOD') || code.includes('KRV')) collabMap[r.sco_id].blood = String(r.doc_id);
    else if (code.includes('TISSUE') || code.includes('TKANIV')) collabMap[r.sco_id].tissue = String(r.doc_id);
    else if (code.includes('PLACENT')) collabMap[r.sco_id].placenta = String(r.doc_id);
    else if (code.includes('ASSIST') || code.includes('ASIST')) collabMap[r.sco_id].assistant = String(r.doc_id);
  }

  const clientMap = {};
  const clientRows = await mssqlPool.request().query(`
    SELECT cs.sco_id, c.cli_id
    FROM ContractServices cs JOIN Contracts c ON c.con_id = cs.con_id WHERE cs.sco_id IS NOT NULL
  `);
  for (const r of clientRows.recordset) clientMap[r.sco_id] = String(r.cli_id);

  const companyCountry = {};
  const compRows = await mssqlPool.request().query('SELECT com_id, com_country_code FROM Companies');
  for (const r of compRows.recordset) companyCountry[r.com_id] = normalizeCountryCode(r.com_country_code);

  const collections = await mssqlPool.request().query(`
    SELECT TOP ${LIMIT} sco_id, sco_collection_unit_number, sco_collection_made,
      sco_client_first_name, sco_client_last_name, sco_client_phone_number,
      sco_client_mobile, sco_client_email, sco_client_birth_date, sco_client_id_number,
      sco_child_first_name, sco_child_last_name, sco_child_sex,
      sco_state_detail, sco_sterility, sco_lab_evaluation, sco_paired, sco_evaluated,
      sco_stored, sco_transferred, sco_released,
      sco_waiting_for_dispose, sco_disposed,
      sco_doctors_note, sco_note, sco_inserted, sco_updated,
      csu_id, com_id, hos_id
    FROM ServiceCollections
    ORDER BY sco_id DESC
  `);

  log('Zdrojové dáta z CBC:');
  table(
    ['sco_id', 'CBU#', 'Klientka', 'Mobil (RAW)', '→ Normalized', 'Dieťa', 'Dátum', 'Status'],
    collections.recordset.map(r => [
      r.sco_id, r.sco_collection_unit_number,
      `${r.sco_client_first_name || ''} ${r.sco_client_last_name || ''}`.trim(),
      r.sco_client_mobile,
      normalizePhone(r.sco_client_mobile, companyCountry[r.com_id] || 'SK'),  
      `${r.sco_child_first_name || ''} ${r.sco_child_last_name || ''}`.trim(),
      r.sco_collection_made ? new Date(r.sco_collection_made).toLocaleDateString('sk') : '—',
      r.csu_id,
    ])
  );

  let inserted = 0, skipped = 0, errors = 0;
  for (const row of collections.recordset) {
    try {
      const existing = await pgPool.query('SELECT id FROM collections WHERE legacy_id = $1', [String(row.sco_id)]);
      if (existing.rows.length > 0) { skipped++; continue; }

      const countryCode = normalizeCountryCode(companyCountry[row.com_id]);
      const hospitalId = hospitalLookup[String(row.hos_id)] || null;
      const customerId = customerLookup[clientMap[row.sco_id]] || null;
      const birth = decomposeBirthDate(row.sco_client_birth_date);
      const cc = collabMap[row.sco_id] || {};

      await pgPool.query(`
        INSERT INTO collections (
          legacy_id, cbu_number, country_code,
          customer_id, client_first_name, client_last_name,
          client_phone, client_mobile, client_birth_number,
          client_birth_day, client_birth_month, client_birth_year,
          child_first_name, child_last_name, child_gender,
          collection_date, hospital_id,
          cord_blood_collector_id, tissue_collector_id, placenta_collector_id, assistant_nurse_id,
          status, state,
          status_paired_at, status_evaluated_at, status_verified_at,
          status_stored_at, status_transferred_at, status_released_at,
          status_awaiting_disposal_at, status_disposed_at,
          doctor_note, note, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
      `, [
        String(row.sco_id), row.sco_collection_unit_number, countryCode,
        customerId,
        normalizeName(row.sco_client_first_name), normalizeName(row.sco_client_last_name),
        normalizePhone(row.sco_client_phone_number, countryCode) || normalizePhone(row.sco_client_mobile, countryCode),
        normalizePhone(row.sco_client_mobile, countryCode),
        normalizeNationalId(row.sco_client_id_number),
        birth.day, birth.month, birth.year,
        normalizeName(row.sco_child_first_name), normalizeName(row.sco_child_last_name), row.sco_child_sex,
        row.sco_collection_made, hospitalId,
        collabLookup[cc.blood] || null, collabLookup[cc.tissue] || null,
        collabLookup[cc.placenta] || null, collabLookup[cc.assistant] || null,
        row.csu_id, row.sco_state_detail,
        row.sco_paired, row.sco_lab_evaluation, row.sco_sterility,
        row.sco_stored, row.sco_transferred, row.sco_released,
        row.sco_waiting_for_dispose, row.sco_disposed,
        row.sco_doctors_note, row.sco_note,
        row.sco_inserted || new Date(), row.sco_updated || new Date(),
      ]);
      inserted++;
    } catch (err) {
      errors++;
      log(`  ERROR sco_id=${row.sco_id}: ${err.message}`);
    }
  }
  log(`\n  Odbery: ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);

  log('\n--- Lab výsledky pre prenesené odbery ---');
  const collLookup = {};
  const pgColls = await pgPool.query('SELECT id, legacy_id FROM collections WHERE legacy_id IS NOT NULL');
  for (const r of pgColls.rows) collLookup[r.legacy_id] = r.id;

  const scoIds = collections.recordset.map(r => r.sco_id);
  if (scoIds.length > 0) {
    const evalResults = await mssqlPool.request().query(`
      SELECT cer.sco_id, cer.cev_value_number, cer.cev_value_text, cer.cev_value_text_update,
             cet.cet_code, cet.cet_field_name
      FROM CollectionEvaluationResults cer
      JOIN CollectionEvaluationTemplates cet ON cet.cet_id = cer.cet_id
      WHERE cer.sco_id IN (${scoIds.join(',')})
      ORDER BY cer.sco_id, cet.cet_order
    `);

    const grouped = {};
    for (const r of evalResults.recordset) {
      if (!grouped[r.sco_id]) grouped[r.sco_id] = {};
      const code = (r.cet_code || r.cet_field_name || '').toLowerCase();
      const value = r.cev_value_text_update || r.cev_value_text || (r.cev_value_number != null ? String(r.cev_value_number) : null);
      grouped[r.sco_id][code] = value;
    }

    const findField = (fields, ...keys) => {
      for (const k of keys) {
        const lower = k.toLowerCase();
        for (const [fk, fv] of Object.entries(fields)) {
          if (fk.toLowerCase() === lower || fk.toLowerCase().includes(lower)) return fv;
        }
      }
      return null;
    };

    let labInserted = 0;
    for (const [scoId, fields] of Object.entries(grouped)) {
      const collectionId = collLookup[scoId];
      if (!collectionId) continue;

      const existing = await pgPool.query('SELECT id FROM collection_lab_results WHERE collection_id = $1', [collectionId]);
      if (existing.rows.length > 0) continue;

      try {
        await pgPool.query(`
          INSERT INTO collection_lab_results (
            collection_id, client_result_id,
            usability, sterility, sterility_type, result_of_sterility,
            volume, volume_in_bag, tnc_count, max_weight,
            infection_agents, transplant_processing,
            umbilical_tissue, tissue_processed, tissue_sterility,
            tissue_usability, tissue_infection_agents,
            bag_a_usability, bag_a_volume, bag_a_tnc,
            bag_b_usability, bag_b_volume, bag_b_tnc,
            first_name, surname, id_birth_number,
            processing, collection_for, status, final_analyses,
            lab_note
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
        `, [
          collectionId, scoId,
          findField(fields, 'Standard_pouzitelnost', 'TP_pouzitelnost', 'usability', 'pouzitelnost'),
          findField(fields, 'TP_sterilita_vysledok', 'sterility', 'sterilita'),
          findField(fields, 'sterility_type', 'typ_sterility'),
          findField(fields, 'TP_sterilita_vysledok', 'result_of_sterility'),
          findField(fields, 'Standard_objem_odobratej_krvi', 'volume', 'objem'),
          findField(fields, 'Objem PLK', 'volume_in_bag', 'objem_vo_vaku'),
          findField(fields, 'tnc', 'tnc_count'),
          findField(fields, 'max_weight', 'hmotnost'),
          findField(fields, 'TP_infekcne_agens', 'infection_agents', 'infekcne_agens'),
          findField(fields, 'transplantat_preradenyDo', 'transplant_processing'),
          findField(fields, 'umbilical_tissue', 'pupocnikove_tkanivo'),
          findField(fields, 'tissue_processed', 'tkanivo_spracovane'),
          findField(fields, 'tissue_sterility', 'sterilita_tkaniva'),
          findField(fields, 'Premium_pouzitelnost', 'tissue_usability', 'pouzitelnost_tkaniva'),
          findField(fields, 'tissue_infection_agents', 'infekcne_agensy_tkaniva'),
          findField(fields, 'Standard_BB', 'bag_a_usability', 'pouzitelnost_vak_a'),
          findField(fields, 'bag_a_volume', 'objem_vak_a'),
          findField(fields, 'bag_a_tnc', 'tnc_vak_a'),
          findField(fields, 'bag_b_usability', 'pouzitelnost_vak_b'),
          findField(fields, 'bag_b_volume', 'objem_vak_b'),
          findField(fields, 'bag_b_tnc', 'tnc_vak_b'),
          findField(fields, 'Meno matky', 'first_name', 'meno'),
          findField(fields, 'Priezvisko matky', 'surname', 'priezvisko'),
          findField(fields, 'id_birth_number', 'rodne_cislo'),
          findField(fields, 'spracovanieXX', 'processing', 'spracovanie'),
          findField(fields, 'transplantat odobrany pre', 'collection_for', 'odber_pre'),
          findField(fields, 'Premium_stav', 'status', 'stav'),
          findField(fields, 'final_analyses', 'zaverecne_analyzy'),
          JSON.stringify(fields),
        ]);
        labInserted++;
      } catch (err) {
        log(`  ERROR lab sco_id=${scoId}: ${err.message}`);
      }
    }
    log(`  Lab výsledky: ${labInserted} vložených (z ${Object.keys(grouped).length} skupín)`);
  }
}

// ============================================================
// STEP 6.5: Cases (customer_potential_cases) — father data
// ============================================================
async function step6b_cases() {
  separator('STEP 6.5: Cases — otcovské dáta (cez PotentialClients)');

  const customerLookup = {};
  const pgCust = await pgPool.query('SELECT id, internal_id FROM customers WHERE internal_id IS NOT NULL');
  for (const r of pgCust.rows) customerLookup[r.internal_id] = r.id;

  const hospitalLookup = {};
  const pgH = await pgPool.query('SELECT id, legacy_id FROM hospitals WHERE legacy_id IS NOT NULL');
  for (const r of pgH.rows) hospitalLookup[r.legacy_id] = r.id;

  const collabLookup = {};
  const pgCol = await pgPool.query('SELECT id, legacy_id FROM collaborators WHERE legacy_id IS NOT NULL');
  for (const r of pgCol.rows) collabLookup[r.legacy_id] = r.id;

  const migratedCustomerIds = Object.keys(customerLookup);
  if (migratedCustomerIds.length === 0) {
    log('  Žiadni migrovaní zákazníci — skip');
    return;
  }

  const cliIdList = migratedCustomerIds.join(',');

  const fatherStats = await mssqlPool.request().query(`
    SELECT
      COUNT(*) as total,
      COUNT(pc.per_id_father) as with_father,
      COUNT(pc.pot_father_address_country_ft) as with_father_country
    FROM Contracts c
    JOIN PotentialClients pc ON pc.pot_id = c.pot_id
    WHERE c.cli_id IN (${cliIdList})
  `);
  const fs = fatherStats.recordset[0];
  log(`  Štatistika: ${fs.total} contracts, ${fs.with_father} s otcom (per_id_father), ${fs.with_father_country} s krajinou otca`);

  const potData = await mssqlPool.request().query(`
    SELECT
      c.cli_id, c.con_id, c.hos_id, c.doc_id,
      c.con_expected_collection_date, c.con_pregnancy_type,
      pc.pot_id, pc.per_id_father, pc.pot_father_address_country_ft,
      pc.pot_product_ft, pc.pot_marketproduct_ft, pc.pot_payment_type_ft,
      pc.pot_exp_birth_date, pc.pot_pregnancy_type, pc.pot_children,
      pc.pot_gift_card, pc.pot_previous_contracts,
      pc.pot_registration_type_ft, pc.pot_first_information_source_ft,
      pc.per_id AS pot_per_id_mother
    FROM Contracts c
    JOIN PotentialClients pc ON pc.pot_id = c.pot_id
    WHERE c.cli_id IN (${cliIdList})
      AND c.pot_id IS NOT NULL
    ORDER BY c.con_id DESC
  `);

  const fatherPerIds = potData.recordset
    .filter(r => r.per_id_father)
    .map(r => r.per_id_father);

  const fatherData = {};
  if (fatherPerIds.length > 0) {
    const fatherRows = await mssqlPool.request().query(`
      SELECT pd.per_id, pd.per_first_name, pd.per_last_name, pd.per_title,
             pd.per_phone_number, pd.per_mobile, pd.per_email,
             ma.add_street, ma.add_city, ma.add_zip, ma.add_country_code
      FROM PersonalData pd
      LEFT JOIN MailAddresses ma ON ma.per_id = pd.per_id AND ma.add_valid = 1
      WHERE pd.per_id IN (${fatherPerIds.join(',')})
    `);
    for (const r of fatherRows.recordset) {
      fatherData[r.per_id] = r;
    }
  }

  const childFatherData = {};
  try {
    const cfRows = await mssqlPool.request().query(`
      SELECT cf.* FROM ChildFather cf
      JOIN Contracts c ON c.con_id = cf.con_id
      WHERE c.cli_id IN (${cliIdList})
    `);
    for (const r of cfRows.recordset) {
      childFatherData[r.con_id] = r;
    }
  } catch (e) {
    log(`  WARN: ChildFather tabuľka: ${e.message}`);
  }

  log('Zdrojové dáta z CBC:');
  table(
    ['cli_id', 'Otec (meno)', 'Otec (priezvisko)', 'Otec mobil', 'Otec email', 'Krajina otca', 'Produkt', 'Tehotenstvo'],
    potData.recordset.slice(0, 20).map(r => {
      const f = fatherData[r.per_id_father] || {};
      return [
        r.cli_id,
        f.per_first_name || '—',
        f.per_last_name || '—',
        f.per_mobile || '—',
        f.per_email || '—',
        r.pot_father_address_country_ft || '—',
        r.pot_product_ft || '—',
        r.pot_pregnancy_type || r.con_pregnancy_type || '—',
      ];
    })
  );

  let inserted = 0, skipped = 0, errors = 0;
  const processed = new Set();
  for (const row of potData.recordset) {
    const cliIdStr = String(row.cli_id);
    if (processed.has(cliIdStr)) continue;
    processed.add(cliIdStr);

    const customerId = customerLookup[cliIdStr];
    if (!customerId) continue;

    try {
      const existing = await pgPool.query('SELECT id FROM customer_potential_cases WHERE customer_id = $1', [customerId]);
      if (existing.rows.length > 0) { skipped++; continue; }

      const f = fatherData[row.per_id_father] || {};
      const cf = childFatherData[row.con_id] || {};
      const fatherName = f.per_first_name || cf.FatherName || null;
      const fatherCountry = normalizeCountryCode(row.pot_father_address_country_ft || (f.add_country_code ? f.add_country_code : null));

      const expDate = row.con_expected_collection_date || row.pot_exp_birth_date;
      let expDay = null, expMonth = null, expYear = null;
      if (expDate) {
        const d = new Date(expDate);
        expDay = d.getDate();
        expMonth = d.getMonth() + 1;
        expYear = d.getFullYear();
      }

      const pregnancyType = row.pot_pregnancy_type || row.con_pregnancy_type;
      const isMultiple = pregnancyType && parseInt(pregnancyType) > 1;

      await pgPool.query(`
        INSERT INTO customer_potential_cases (
          customer_id,
          expected_date_day, expected_date_month, expected_date_year,
          hospital_id, obstetrician_id,
          is_multiple_pregnancy, child_count,
          father_first_name, father_last_name, father_title_before,
          father_phone, father_mobile, father_email,
          father_street, father_city, father_postal_code, father_country,
          product_type, payment_type, gift_voucher,
          existing_contracts, info_source, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      `, [
        customerId,
        expDay, expMonth, expYear,
        hospitalLookup[String(row.hos_id)] || null,
        collabLookup[String(row.doc_id)] || null,
        isMultiple || false, row.pot_children || 1,
        normalizeName(fatherName),
        normalizeName(f.per_last_name),
        f.per_title || null,
        normalizePhone(f.per_phone_number, fatherCountry || 'SK') || normalizePhone(f.per_mobile, fatherCountry || 'SK'),
        normalizePhone(f.per_mobile, fatherCountry || 'SK'),
        normalizeEmail(f.per_email),
        f.add_street || null,
        normalizeCity(f.add_city),
        normalizePostalCode(f.add_zip),
        fatherCountry,
        row.pot_product_ft || null,
        row.pot_payment_type_ft || null,
        row.pot_gift_card || null,
        row.pot_previous_contracts || null,
        row.pot_first_information_source_ft || null,
        null,
      ]);
      inserted++;
    } catch (err) {
      errors++;
      log(`  ERROR cli_id=${row.cli_id}: ${err.message}`);
    }
  }
  log(`\n  Cases: ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);
}

// ============================================================
// STEP 7: Verification — Detail comparison
// ============================================================
async function step7_verification() {
  separator('STEP 7: Verifikácia — porovnanie prenesených dát');

  const counts = [
    { name: 'CollectionStatuses', query: 'SELECT COUNT(*) as cnt FROM collection_statuses' },
    { name: 'Laboratories', query: 'SELECT COUNT(*) as cnt FROM laboratories' },
    { name: 'Hospitals (migrated)', query: "SELECT COUNT(*) as cnt FROM hospitals WHERE legacy_id IS NOT NULL" },
    { name: 'Collaborators (migrated)', query: "SELECT COUNT(*) as cnt FROM collaborators WHERE legacy_id IS NOT NULL" },
    { name: 'Customers (migrated)', query: "SELECT COUNT(*) as cnt FROM customers WHERE internal_id IS NOT NULL" },
    { name: 'Collections (migrated)', query: "SELECT COUNT(*) as cnt FROM collections WHERE legacy_id IS NOT NULL" },
    { name: 'Lab Results (migrated)', query: "SELECT COUNT(*) as cnt FROM collection_lab_results" },
    { name: 'Cases (migrated)', query: "SELECT COUNT(*) as cnt FROM customer_potential_cases WHERE customer_id IN (SELECT id FROM customers WHERE internal_id IS NOT NULL)" },
  ];

  const countRows = [];
  for (const c of counts) {
    const res = await pgPool.query(c.query);
    countRows.push([c.name, res.rows[0].cnt]);
  }
  log('Počty v INDEXUS po migrácii:');
  table(['Entita', 'Počet'], countRows);

  log('\n--- Nemocnice v INDEXUS ---');
  const hospitals = await pgPool.query(`
    SELECT legacy_id, name, city, postal_code, country_code, is_active
    FROM hospitals WHERE legacy_id IS NOT NULL AND legacy_id != '' ORDER BY legacy_id LIMIT 20
  `);
  table(
    ['LegacyID', 'Názov', 'Mesto', 'PSČ', 'Krajina', 'Aktívna'],
    hospitals.rows.map(r => [r.legacy_id, r.name, r.city, r.postal_code, r.country_code, r.is_active ? 'áno' : 'nie'])
  );

  log('\n--- Spolupracovníci v INDEXUS ---');
  const collabs = await pgPool.query(`
    SELECT legacy_id, first_name, last_name, mobile, email, birth_number, country_code, collaborator_type
    FROM collaborators WHERE legacy_id IS NOT NULL AND legacy_id != '' ORDER BY legacy_id LIMIT 20
  `);
  table(
    ['LegacyID', 'Meno', 'Priezvisko', 'Mobil', 'Email', 'RČ', 'Krajina', 'Typ'],
    collabs.rows.map(r => [r.legacy_id, r.first_name, r.last_name, r.mobile, r.email, r.birth_number, r.country_code, r.collaborator_type])
  );

  log('\n--- Klientky v INDEXUS ---');
  const customers = await pgPool.query(`
    SELECT internal_id, first_name, last_name, mobile, email, national_id, city, postal_code, country, client_status
    FROM customers WHERE internal_id IS NOT NULL AND internal_id != '' ORDER BY internal_id LIMIT 20
  `);
  table(
    ['InternalID', 'Meno', 'Priezvisko', 'Mobil', 'Email', 'RČ', 'Mesto', 'PSČ', 'Krajina', 'Status'],
    customers.rows.map(r => [r.internal_id, r.first_name, r.last_name, r.mobile, r.email, r.national_id, r.city, r.postal_code, r.country, r.client_status])
  );

  log('\n--- Odbery v INDEXUS ---');
  const colls = await pgPool.query(`
    SELECT c.legacy_id, c.cbu_number, c.client_first_name, c.client_last_name, c.client_mobile,
           c.child_first_name, c.collection_date, h.name as hospital_name, c.status, c.country_code
    FROM collections c
    LEFT JOIN hospitals h ON h.id = c.hospital_id
    WHERE c.legacy_id IS NOT NULL AND c.legacy_id != '' ORDER BY c.legacy_id DESC LIMIT 20
  `);
  table(
    ['LegacyID', 'CBU#', 'Klientka', 'Mobil', 'Dieťa', 'Dátum', 'Nemocnica', 'Status', 'Krajina'],
    colls.rows.map(r => [
      r.legacy_id, r.cbu_number,
      `${r.client_first_name || ''} ${r.client_last_name || ''}`.trim(),
      r.client_mobile,
      r.child_first_name,
      r.collection_date ? new Date(r.collection_date).toLocaleDateString('sk') : '—',
      r.hospital_name, r.status, r.country_code,
    ])
  );

  log('\n--- Cases v INDEXUS ---');
  const cases = await pgPool.query(`
    SELECT cpc.customer_id, cu.internal_id, cu.first_name, cu.last_name,
           cpc.father_first_name, cpc.father_last_name, cpc.father_mobile, cpc.father_email,
           cpc.father_country, cpc.product_type, cpc.payment_type,
           cpc.expected_date_day, cpc.expected_date_month, cpc.expected_date_year
    FROM customer_potential_cases cpc
    JOIN customers cu ON cu.id = cpc.customer_id
    WHERE cu.internal_id IS NOT NULL
    ORDER BY cu.internal_id LIMIT 20
  `);
  table(
    ['CliID', 'Klientka', 'Otec meno', 'Otec priezvisko', 'Otec mobil', 'Otec email', 'Krajina', 'Produkt'],
    cases.rows.map(r => [
      r.internal_id,
      `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      r.father_first_name, r.father_last_name, r.father_mobile, r.father_email,
      r.father_country, r.product_type,
    ])
  );

  log('\n--- Krížová kontrola (CBC vs INDEXUS) ---');
  const sampleColls = await pgPool.query("SELECT legacy_id, cbu_number, client_first_name, client_last_name FROM collections WHERE legacy_id IS NOT NULL LIMIT 5");
  for (const row of sampleColls.rows) {
    const source = await mssqlPool.request().query(`
      SELECT sco_collection_unit_number, sco_client_first_name, sco_client_last_name
      FROM ServiceCollections WHERE sco_id = ${row.legacy_id}
    `);
    if (source.recordset.length > 0) {
      const s = source.recordset[0];
      const cbuMatch = (row.cbu_number || '') === (s.sco_collection_unit_number || '');
      const nameMatch = (row.client_first_name || '').toLowerCase() === (normalizeName(s.sco_client_first_name) || '').toLowerCase();
      log(`  sco_id=${row.legacy_id}: CBU ${cbuMatch ? '✓' : '✗'} | Meno ${nameMatch ? '✓' : '✗'} | CBC: "${s.sco_client_first_name} ${s.sco_client_last_name}" → INDEXUS: "${row.client_first_name} ${row.client_last_name}"`);
    }
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   CBC → INDEXUS  Testovací migračný scenár (20 záznamov)       ║');
  console.log('║   BEZ: Invoices, Billing Companies, Rewards                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    await step1_testConnection();
    await step2_referenceData();
    await step3_hospitals();
    await step4_collaborators();
    await step5_customers();
    await step6_collections();
    await step6b_cases();
    await step7_verification();

    separator('HOTOVO');
    log('Testovací prenos 20 záznamov bol úspešne dokončený.');
    log('Skontrolujte výsledky vyššie a overte dáta v INDEXUS CRM.');
    log('');
    log('Ak chcete vymazať testovacích 20 záznamov:');
    log('  node cleanup-test-migration.cjs');
  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err.stack);
  } finally {
    await mssqlPool?.close();
    await pgPool?.end();
  }
}

main();
