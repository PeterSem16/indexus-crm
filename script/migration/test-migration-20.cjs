#!/usr/bin/env node
/**
 * ISCBC → INDEXUS Test Migration (20 records per entity)
 * 
 * Testovací scenár:
 *   Step 1: Test connection + zobraz vzorky dát z ISCBC
 *   Step 2: Reference data (CollectionStatuses, Laboratories)
 *   Step 3: Hospitals (TOP 20)
 *   Step 4: Collaborators (TOP 20)
 *   Step 5: Customers/Clients (TOP 20)
 *   Step 6: Collections + Lab Results (TOP 20)
 *   Step 7: Verification — porovnanie zdrojových vs prenesených dát
 * 
 * Run on Ubuntu: node test-migration-20.cjs
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
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i] || '').length)));
  const maxWidth = 120;
  const adjustedWidths = widths.map(w => Math.min(w, 30));
  console.log('  ' + headers.map((h, i) => h.padEnd(adjustedWidths[i])).join(' | '));
  console.log('  ' + adjustedWidths.map(w => '─'.repeat(w)).join('─┼─'));
  for (const row of rows) {
    console.log('  ' + row.map((c, i) => String(c || '—').slice(0, 30).padEnd(adjustedWidths[i])).join(' | '));
  }
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
  separator('STEP 1: Test pripojenia + vzorky dát z ISCBC');

  mssqlPool = await sql.connect(MSSQL_CONFIG);
  log('✓ Pripojené k MSSQL (ISCBC)');

  pgPool = new Pool(PG_CONFIG);
  await pgPool.query('SELECT 1');
  log('✓ Pripojené k PostgreSQL (INDEXUS)');

  // Record counts
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

  log('\nPočty záznamov v ISCBC:');
  table(['Tabuľka', 'Počet'], counts.recordset.map(r => [r.t, r.cnt]));

  // Sample phones/emails to show what needs normalization
  log('\nUkážka telefónnych formátov v ISCBC (PersonalData):');
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
}

// ============================================================
// STEP 2: Reference Data
// ============================================================
async function step2_referenceData() {
  separator('STEP 2: Referenčné dáta (StatusyOdberov, Laboratóriá)');

  // 2a: Collection Statuses
  log('--- CollectionStatuses ---');
  const statuses = await mssqlPool.request().query(`
    SELECT csu_id, csu_code, csu_default_name, csu_order, csu_branch
    FROM CollectionStatuses ORDER BY csu_order
  `);

  table(
    ['ID', 'Kód', 'Názov', 'Poradie', 'Vetva'],
    statuses.recordset.map(r => [r.csu_id, r.csu_code, r.csu_default_name, r.csu_order, r.csu_branch])
  );

  let sInserted = 0, sSkipped = 0;
  for (const row of statuses.recordset) {
    const existing = await pgPool.query('SELECT id FROM collection_statuses WHERE id = $1', [row.csu_id]);
    if (existing.rows.length > 0) { sSkipped++; continue; }

    await pgPool.query(`
      INSERT INTO collection_statuses (id, name, code, branch, sort_order, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
    `, [row.csu_id, row.csu_default_name, row.csu_code || '', row.csu_branch || 1, row.csu_order || 0]);
    sInserted++;
  }
  log(`  → ${sInserted} vložených, ${sSkipped} preskočených`);

  // 2b: Laboratories
  log('\n--- Laboratories ---');
  const labs = await mssqlPool.request().query(`
    SELECT lab_id, lab_name, lab_country_code, lab_active
    FROM Laboratories ORDER BY lab_id
  `);

  table(
    ['ID', 'Názov', 'Krajina', 'Aktívne'],
    labs.recordset.map(r => [r.lab_id, r.lab_name, r.lab_country_code, r.lab_active ? 'áno' : 'nie'])
  );

  let lInserted = 0, lSkipped = 0;
  for (const row of labs.recordset) {
    const existing = await pgPool.query('SELECT id FROM laboratories WHERE name = $1', [row.lab_name]);
    if (existing.rows.length > 0) { lSkipped++; continue; }

    await pgPool.query(`
      INSERT INTO laboratories (name, country_code, is_active)
      VALUES ($1, $2, $3)
    `, [row.lab_name, row.lab_country_code || 'SK', row.lab_active === true || row.lab_active === 1]);
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
    ORDER BY h.hos_id
  `);

  log('Zdrojové dáta z ISCBC:');
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

      const countryCode = row.add_country || row.lab_country_code || 'SK';
      const labId = row.lab_name ? (labLookup[row.lab_name] || null) : null;

      await pgPool.query(`
        INSERT INTO hospitals (
          legacy_id, name, full_name, is_active, street_number, city, postal_code, region,
          country_code, laboratory_id, svet_zdravia, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `, [
        String(row.hos_id), row.hos_name, row.hos_full_name,
        row.hos_active === true || row.hos_active === 1,
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
    ORDER BY d.doc_id
  `);

  // Get country from agreements
  const collabCountries = await mssqlPool.request().query(`
    SELECT DISTINCT ca.doc_id, c.com_country_code
    FROM CollaboratorAgreements ca
    JOIN Companies c ON c.com_id = ca.com_id
  `);
  const countryMap = {};
  for (const r of collabCountries.recordset) countryMap[r.doc_id] = r.com_country_code;

  // Get hospital mappings
  const collabHospitals = await mssqlPool.request().query('SELECT doc_id, hos_id FROM CollaboratorsHospitals');
  const hospMap = {};
  for (const r of collabHospitals.recordset) {
    if (!hospMap[r.doc_id]) hospMap[r.doc_id] = [];
    hospMap[r.doc_id].push(String(r.hos_id));
  }

  log('Zdrojové dáta z ISCBC:');
  table(
    ['doc_id', 'Meno', 'Priezvisko', 'Typ', 'Mobil (RAW)', '→ Normalized', 'Email', 'Krajina'],
    collabs.recordset.map(r => [
      r.doc_id, r.pda_first_name, r.pda_last_name, r.cty_code,
      r.pda_mobile, normalizePhone(r.pda_mobile, countryMap[r.doc_id] || 'SK'),
      r.pda_email, countryMap[r.doc_id] || '?',
    ])
  );

  let inserted = 0, skipped = 0, errors = 0;
  for (const row of collabs.recordset) {
    try {
      const existing = await pgPool.query('SELECT id FROM collaborators WHERE legacy_id = $1', [String(row.doc_id)]);
      if (existing.rows.length > 0) { skipped++; continue; }

      const countryCode = countryMap[row.doc_id] || 'SK';
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
    LEFT JOIN MailAddresses a_perm ON a_perm.per_id = p.per_id AND a_perm.add_valid = 1
      AND a_perm.mat_id IN (SELECT mat_id FROM MailAddressTypes WHERE mat_code = 'PERMANENT')
    LEFT JOIN MailAddresses a_corr ON a_corr.per_id = p.per_id AND a_corr.add_valid = 1
      AND a_corr.mat_id IN (SELECT mat_id FROM MailAddressTypes WHERE mat_code = 'MAIL')
    WHERE c.cli_deleted = 0 OR c.cli_deleted IS NULL
    ORDER BY c.cli_id
  `);

  // Contract status map
  const clientContracts = await mssqlPool.request().query(`
    SELECT con.cli_id, cs.csa_code
    FROM Contracts con
    JOIN ContractStatuses cs ON cs.csa_id = con.csa_id
  `);
  const contractStatusMap = {};
  for (const r of clientContracts.recordset) contractStatusMap[r.cli_id] = r.csa_code;

  log('Zdrojové dáta z ISCBC:');
  table(
    ['cli_id', 'Meno', 'Priezvisko', 'Mobil (RAW)', '→ Normalized', 'Email', 'Mesto', 'Krajina'],
    clients.recordset.map(r => [
      r.cli_id, r.pda_first_name, r.pda_last_name,
      r.pda_mobile, normalizePhone(r.pda_mobile, r.perm_country || r.com_country_code || 'SK'),
      r.pda_email, r.perm_city, r.perm_country || r.com_country_code || '?',
    ])
  );

  let inserted = 0, skipped = 0, errors = 0;
  for (const row of clients.recordset) {
    try {
      const existing = await pgPool.query('SELECT id FROM customers WHERE internal_id = $1', [String(row.cli_id)]);
      if (existing.rows.length > 0) { skipped++; continue; }

      const country = row.perm_country || row.com_country_code || 'SK';
      const firstName = normalizeName(row.pda_first_name) || 'N/A';
      const lastName = normalizeName(row.pda_last_name) || 'N/A';
      const email = normalizeEmail(row.pda_email) || `legacy_${row.cli_id}@import.local`;

      let clientStatus = 'potential';
      const csaCode = contractStatusMap[row.cli_id];
      if (csaCode) {
        if (['REALIZED', 'CONFIRMED', 'RETURNED', 'VALIDATED'].includes(csaCode)) clientStatus = 'acquired';
        else if (['TERMINATED', 'CANCELLED'].includes(csaCode)) clientStatus = 'terminated';
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
        normalizePhone(row.pda_phone_number, country), normalizePhone(row.pda_mobile, country),
        normalizePhone(row.pda_mobile2, country), row.pda_other_contact,
        email, normalizeEmail(row.pda_email2),
        normalizeNationalId(row.pda_id_number), row.pda_id_card, row.pda_birth_date,
        row.cli_mailinglist === true || row.cli_mailinglist === 1,
        country, normalizeCity(row.perm_city), row.perm_street, normalizePostalCode(row.perm_zip, country), row.perm_area,
        hasCorr, row.corr_name, row.corr_street, normalizeCity(row.corr_city),
        normalizePostalCode(row.corr_zip, row.corr_country || country), row.corr_area, row.corr_country,
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

  // Build lookups
  const hospitalLookup = {};
  const pgH = await pgPool.query('SELECT id, legacy_id FROM hospitals WHERE legacy_id IS NOT NULL');
  for (const r of pgH.rows) hospitalLookup[r.legacy_id] = r.id;

  const collabLookup = {};
  const pgC = await pgPool.query('SELECT id, legacy_id FROM collaborators WHERE legacy_id IS NOT NULL');
  for (const r of pgC.rows) collabLookup[r.legacy_id] = r.id;

  const customerLookup = {};
  const pgCust = await pgPool.query('SELECT id, internal_id FROM customers WHERE internal_id IS NOT NULL');
  for (const r of pgCust.rows) customerLookup[r.internal_id] = r.id;

  // Get collaborator mappings for these collections
  const collabMap = {};
  const collabRows = await mssqlPool.request().query(`
    SELECT cc.sco_id, cc.doc_id, at.agt_code
    FROM CollectionCollaborators cc
    LEFT JOIN CollaborationAgreementTypes at ON at.agt_id = cc.agt_id
  `);
  for (const r of collabRows.recordset) {
    if (!collabMap[r.sco_id]) collabMap[r.sco_id] = {};
    const code = (r.agt_code || '').toUpperCase();
    if (code.includes('BLOOD') || code.includes('KRV')) collabMap[r.sco_id].blood = String(r.doc_id);
    else if (code.includes('TISSUE') || code.includes('TKANIV')) collabMap[r.sco_id].tissue = String(r.doc_id);
    else if (code.includes('PLACENT')) collabMap[r.sco_id].placenta = String(r.doc_id);
    else if (code.includes('ASSIST') || code.includes('ASIST')) collabMap[r.sco_id].assistant = String(r.doc_id);
  }

  // Get client IDs
  const clientMap = {};
  const clientRows = await mssqlPool.request().query(`
    SELECT cs.sco_id, c.cli_id
    FROM ContractServices cs JOIN Contracts c ON c.con_id = cs.con_id WHERE cs.sco_id IS NOT NULL
  `);
  for (const r of clientRows.recordset) clientMap[r.sco_id] = String(r.cli_id);

  // Get country from company
  const companyCountry = {};
  const compRows = await mssqlPool.request().query('SELECT com_id, com_country_code FROM Companies');
  for (const r of compRows.recordset) companyCountry[r.com_id] = r.com_country_code;

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

  log('Zdrojové dáta z ISCBC:');
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

      const countryCode = companyCountry[row.com_id] || 'SK';
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
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
      `, [
        String(row.sco_id), row.sco_collection_unit_number, countryCode,
        customerId,
        normalizeName(row.sco_client_first_name), normalizeName(row.sco_client_last_name),
        normalizePhone(row.sco_client_phone_number, countryCode),
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

  // Lab results for these collections
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

    let labInserted = 0;
    for (const [scoId, fields] of Object.entries(grouped)) {
      const collectionId = collLookup[scoId];
      if (!collectionId) continue;

      const existing = await pgPool.query('SELECT id FROM collection_lab_results WHERE collection_id = $1', [collectionId]);
      if (existing.rows.length > 0) continue;

      try {
        await pgPool.query(`
          INSERT INTO collection_lab_results (collection_id, usability, sterility, volume, tnc_count, lab_note)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          collectionId,
          fields['usability'] || fields['pouzitelnost'] || null,
          fields['sterility'] || fields['sterilita'] || null,
          fields['volume'] || fields['objem'] || null,
          fields['tnc'] || fields['tnc_count'] || null,
          JSON.stringify(fields),
        ]);
        labInserted++;
      } catch (err) {
        log(`  ERROR lab sco_id=${scoId}: ${err.message}`);
      }
    }
    log(`  Lab výsledky: ${labInserted} vložených`);
  }
}

// ============================================================
// STEP 7: Verification — Detail comparison
// ============================================================
async function step7_verification() {
  separator('STEP 7: Verifikácia — porovnanie prenesených dát');

  // Count migrated records
  const counts = [
    { name: 'CollectionStatuses', query: 'SELECT COUNT(*) as cnt FROM collection_statuses' },
    { name: 'Laboratories', query: 'SELECT COUNT(*) as cnt FROM laboratories' },
    { name: 'Hospitals (migrated)', query: "SELECT COUNT(*) as cnt FROM hospitals WHERE legacy_id IS NOT NULL" },
    { name: 'Collaborators (migrated)', query: "SELECT COUNT(*) as cnt FROM collaborators WHERE legacy_id IS NOT NULL" },
    { name: 'Customers (migrated)', query: "SELECT COUNT(*) as cnt FROM customers WHERE internal_id IS NOT NULL" },
    { name: 'Collections (migrated)', query: "SELECT COUNT(*) as cnt FROM collections WHERE legacy_id IS NOT NULL" },
    { name: 'Lab Results (migrated)', query: "SELECT COUNT(*) as cnt FROM collection_lab_results" },
  ];

  const countRows = [];
  for (const c of counts) {
    const res = await pgPool.query(c.query);
    countRows.push([c.name, res.rows[0].cnt]);
  }
  log('Počty v INDEXUS po migrácii:');
  table(['Entita', 'Počet'], countRows);

  // Detail: Show hospitals in INDEXUS
  log('\n--- Nemocnice v INDEXUS ---');
  const hospitals = await pgPool.query(`
    SELECT legacy_id, name, city, postal_code, country_code, is_active
    FROM hospitals WHERE legacy_id IS NOT NULL ORDER BY legacy_id::int LIMIT 20
  `);
  table(
    ['LegacyID', 'Názov', 'Mesto', 'PSČ', 'Krajina', 'Aktívna'],
    hospitals.rows.map(r => [r.legacy_id, r.name, r.city, r.postal_code, r.country_code, r.is_active ? 'áno' : 'nie'])
  );

  // Detail: Show collaborators in INDEXUS
  log('\n--- Spolupracovníci v INDEXUS ---');
  const collabs = await pgPool.query(`
    SELECT legacy_id, first_name, last_name, mobile, email, birth_number, country_code, collaborator_type
    FROM collaborators WHERE legacy_id IS NOT NULL ORDER BY legacy_id::int LIMIT 20
  `);
  table(
    ['LegacyID', 'Meno', 'Priezvisko', 'Mobil', 'Email', 'RČ', 'Krajina', 'Typ'],
    collabs.rows.map(r => [r.legacy_id, r.first_name, r.last_name, r.mobile, r.email, r.birth_number, r.country_code, r.collaborator_type])
  );

  // Detail: Show customers in INDEXUS
  log('\n--- Klientky v INDEXUS ---');
  const customers = await pgPool.query(`
    SELECT internal_id, first_name, last_name, mobile, email, national_id, city, postal_code, country, client_status
    FROM customers WHERE internal_id IS NOT NULL ORDER BY internal_id::int LIMIT 20
  `);
  table(
    ['InternalID', 'Meno', 'Priezvisko', 'Mobil', 'Email', 'RČ', 'Mesto', 'PSČ', 'Krajina', 'Status'],
    customers.rows.map(r => [r.internal_id, r.first_name, r.last_name, r.mobile, r.email, r.national_id, r.city, r.postal_code, r.country, r.client_status])
  );

  // Detail: Show collections in INDEXUS
  log('\n--- Odbery v INDEXUS ---');
  const colls = await pgPool.query(`
    SELECT c.legacy_id, c.cbu_number, c.client_first_name, c.client_last_name, c.client_mobile,
           c.child_first_name, c.collection_date, h.name as hospital_name, c.status, c.country_code
    FROM collections c
    LEFT JOIN hospitals h ON h.id = c.hospital_id
    WHERE c.legacy_id IS NOT NULL ORDER BY c.legacy_id::int DESC LIMIT 20
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

  // Cross-check: Verify a few records against MSSQL source
  log('\n--- Krížová kontrola (ISCBC vs INDEXUS) ---');
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
      log(`  sco_id=${row.legacy_id}: CBU ${cbuMatch ? '✓' : '✗'} | Meno ${nameMatch ? '✓' : '✗'} | ISCBC: "${s.sco_client_first_name} ${s.sco_client_last_name}" → INDEXUS: "${row.client_first_name} ${row.client_last_name}"`);
    }
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   ISCBC → INDEXUS  Testovací migračný scenár (20 záznamov)     ║');
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
    await step7_verification();

    separator('HOTOVO');
    log('Testovací prenos 20 záznamov bol úspešne dokončený.');
    log('Skontrolujte výsledky vyššie a overte dáta v INDEXUS CRM.');
    log('');
    log('Ak sú dáta OK, môžete spustiť plnú migráciu:');
    log('  bash run-migration.sh');
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
