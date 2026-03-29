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
  connectionTimeout: 30000,
  requestTimeout: 600000,
};

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'indexus_crm',
  user: 'indexus',
  password: 'HanyurIfKisck',
};

const LIMIT = parseInt(process.env.MIGRATION_LIMIT || '20', 10);
const MSSQL_BATCH_SIZE = 5000;
let mssqlPool, pgPool;

async function batchMssqlQuery(idList, queryTemplate, label) {
  if (!idList || idList.length === 0) return [];
  const allResults = [];
  const totalBatches = Math.ceil(idList.length / MSSQL_BATCH_SIZE);
  for (let i = 0; i < idList.length; i += MSSQL_BATCH_SIZE) {
    const batch = idList.slice(i, i + MSSQL_BATCH_SIZE);
    const batchNum = Math.floor(i / MSSQL_BATCH_SIZE) + 1;
    if (totalBatches > 1 && label) {
      log(`  ${label} batch ${batchNum}/${totalBatches} (${batch.length} IDs)...`);
    }
    const sql = queryTemplate.replace(/\$\{BATCH_IDS\}/g, batch.join(','));
    const result = await mssqlPool.request().query(sql);
    allResults.push(...result.recordset);
  }
  return allResults;
}
const cbcStatusRemap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8 };

const cbcCollaboratorTypeMap = {
  'REG_CTY_DOCTOR': 'doctor',
  'REG_CTY_NURSE': 'nurse',
  'REG_CTY_OTHER': 'other',
  'REG_CTY_RESIDENT': 'resident',
  'REG_CTY_HEAD_NURSE': 'headNurse',
  'REG_CTY_EXTERNAL': 'external',
  'REG_CTY_REPRESENTATIVE': 'representative',
  'REG_CTY_BM': 'bm',
  'REG_CTY_VEDONO': 'vedono',
  'REG_CTY_CALL_CENTER': 'callCenter',
};
function normalizeCollaboratorType(cbcType) {
  if (!cbcType) return 'other';
  return cbcCollaboratorTypeMap[cbcType] || cbcCollaboratorTypeMap[cbcType.toUpperCase()] || 'other';
}

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

const https = require('https');
const http = require('http');
let geocodeLastCall = 0;
async function geocodeAddress(street, city, postalCode, countryCode) {
  if (!city && !postalCode) return null;
  const parts = [street, city, postalCode].filter(Boolean).join(', ');
  const q = encodeURIComponent(parts);
  const cc = (countryCode || '').toLowerCase();
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&countrycodes=${cc}&format=json&limit=1`;
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - geocodeLastCall));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  geocodeLastCall = Date.now();
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'INDEXUS-CRM-Migration/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const arr = JSON.parse(data);
          if (arr.length > 0) resolve({ lat: parseFloat(arr[0].lat).toFixed(7), lng: parseFloat(arr[0].lon).toFixed(7) });
          else resolve(null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
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

  // Auto-ensure new columns exist in PostgreSQL
  const ensureCols = [
    { table: 'hospitals', column: 'data_source', type: 'text' },
    { table: 'collaborators', column: 'data_source', type: 'text' },
    { table: 'collaborator_agreements', column: 'questionnaire_returned', type: 'boolean DEFAULT false' },
    { table: 'collaborator_agreements', column: 'social_insurance_registration_day', type: 'integer' },
    { table: 'collaborator_agreements', column: 'social_insurance_registration_month', type: 'integer' },
    { table: 'collaborator_agreements', column: 'social_insurance_registration_year', type: 'integer' },
    { table: 'collaborator_agreements', column: 'social_insurance_cancel_day', type: 'integer' },
    { table: 'collaborator_agreements', column: 'social_insurance_cancel_month', type: 'integer' },
    { table: 'collaborator_agreements', column: 'social_insurance_cancel_year', type: 'integer' },
    { table: 'collaborator_agreements', column: 'note', type: 'text' },
    { table: 'customers', column: 'data_source', type: 'text' },
    { table: 'collections', column: 'data_source', type: 'text' },
  ];
  for (const ec of ensureCols) {
    const check = await pgPool.query(`SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [ec.table, ec.column]);
    if (check.rows.length === 0) {
      await pgPool.query(`ALTER TABLE ${ec.table} ADD COLUMN ${ec.column} ${ec.type}`);
      log(`  → Pridaný stĺpec ${ec.table}.${ec.column}`);
    }
  }
  // Ensure collaborator_activities table
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS collaborator_activities (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_id text,
      collaborator_id varchar NOT NULL,
      agreement_id varchar,
      hospital_id varchar,
      collection_id varchar,
      state text,
      currency text,
      amount text,
      name text,
      internal_note text,
      public_note text,
      due_date timestamp,
      due_date_type text,
      proposed_at timestamp,
      proposed_by text,
      approved_at timestamp,
      approved_by text,
      paid_at timestamp,
      cancelled_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  // Ensure customer_documents table
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS customer_documents (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_id text,
      customer_id varchar NOT NULL,
      document_type text NOT NULL,
      data_source text DEFAULT 'iscbc',
      contract_number text,
      contract_template text,
      product_type text,
      contract_status text,
      company_name text,
      expected_collection_date timestamp,
      contacted_at timestamp,
      invoice_number text,
      invoice_type text,
      domestic_currency text,
      accounting_currency text,
      amount text,
      invoice_status text,
      document_status text,
      delivery_date timestamp,
      issue_date timestamp,
      sent_date timestamp,
      due_date timestamp,
      note text,
      legacy_data jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  // Ensure customer_debt_collection table
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS customer_debt_collection (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_id text,
      customer_id varchar NOT NULL,
      data_source text DEFAULT 'iscbc',
      invoice_number text,
      contract_number text,
      amount text,
      currency text,
      status text,
      phase text,
      start_date timestamp,
      last_action_date timestamp,
      note text,
      legacy_data jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  log('✓ Schema overená (data_source, collaborator_activities, customer_documents, customer_debt_collection)');

  const counts = await mssqlPool.request().query(`
    SELECT 'CollectionStatuses' as t, COUNT(*) as cnt FROM CollectionStatuses
    UNION ALL SELECT 'Laboratories', COUNT(*) FROM Laboratories
    UNION ALL SELECT 'Hospitals', COUNT(*) FROM Hospitals
    UNION ALL SELECT 'Collaborators', COUNT(*) FROM Collaborators
    UNION ALL SELECT 'Clients', COUNT(*) FROM Clients WHERE cli_deleted = 0 OR cli_deleted IS NULL
    UNION ALL SELECT 'ServiceCollections', COUNT(*) FROM ServiceCollections
    UNION ALL SELECT 'CollectionEvaluationResults', COUNT(*) FROM CollectionEvaluationResults
    UNION ALL SELECT 'Contracts', COUNT(*) FROM Contracts
    UNION ALL SELECT 'Invoices', COUNT(*) FROM Invoices
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

  log('\n--- Diagnostika CBC: CollaborationAgreementTypes ---');
  try {
    const agtTypes = await mssqlPool.request().query(`
      SELECT at2.agt_id, at2.agt_code, at2.agt_default_name, COUNT(cc.sco_id) as cnt
      FROM CollaborationAgreementTypes at2
      LEFT JOIN CollectionCollaborators cc ON cc.agt_id = at2.agt_id
      GROUP BY at2.agt_id, at2.agt_code, at2.agt_default_name
      ORDER BY at2.agt_id
    `);
    table(['agt_id', 'Kód', 'Názov', 'Počet použití'],
      agtTypes.recordset.map(r => [r.agt_id, r.agt_code, r.agt_default_name, r.cnt])
    );
  } catch (err) { log(`  WARN: AgreementTypes: ${err.message}`); }

  log('\n--- Diagnostika CBC: CollaboratorAgreements stĺpce ---');
  try {
    const caCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'CollaboratorAgreements'
      ORDER BY ORDINAL_POSITION
    `);
    if (caCols.recordset.length > 0) {
      log('  CollaboratorAgreements stĺpce: ' + caCols.recordset.map(r => r.COLUMN_NAME).join(', '));
      const caSample = await mssqlPool.request().query(`SELECT TOP 3 * FROM CollaboratorAgreements ORDER BY cag_id DESC`);
      if (caSample.recordset.length > 0) {
        const cols = Object.keys(caSample.recordset[0]);
        table(cols, caSample.recordset.map(r => cols.map(c => r[c] != null ? String(r[c]).substring(0, 30) : '—')));
      }
    } else {
      log('  CollaboratorAgreements tabuľka neexistuje');
    }
  } catch (err) { log(`  WARN: CollaboratorAgreements: ${err.message}`); }

  log('\n--- Diagnostika CBC: Repository/Súbory dohôd ---');
  try {
    const repoStats = await mssqlPool.request().query(`
      SELECT COUNT(*) as total, COUNT(cag_repository) as with_repo
      FROM CollaboratorAgreements
    `);
    log(`  cag_repository: ${repoStats.recordset[0].with_repo} z ${repoStats.recordset[0].total} má hodnotu`);
    const repoCount = await mssqlPool.request().query(`SELECT COUNT(*) as cnt FROM FileRepositories`);
    log(`  FileRepositories: ${repoCount.recordset[0].cnt} záznamov (PRÁZDNA — súbory sa budú riešiť manuálne)`);
  } catch (err) { log(`  WARN: Repository diagnostika: ${err.message}`); }

  log('\n--- Diagnostika CBC: Historické dáta klientov (zhrnutie) ---');
  try {
    const remarksCnt = await mssqlPool.request().query(`SELECT COUNT(*) as cnt FROM Remarks`);
    const phoneCnt = await mssqlPool.request().query(`SELECT COUNT(*) as cnt FROM PhoneCommunications`);
    log(`  Remarks: ${remarksCnt.recordset[0].cnt} záznamov`);
    log(`  PhoneCommunications: ${phoneCnt.recordset[0].cnt} záznamov`);

    const remarkCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Remarks' ORDER BY ORDINAL_POSITION
    `);
    log(`  Remarks stĺpce: ${remarkCols.recordset.map(r => `${r.COLUMN_NAME}(${r.DATA_TYPE})`).join(', ')}`);
    const remarkSample = await mssqlPool.request().query(`SELECT TOP 3 * FROM Remarks ORDER BY rem_id DESC`);
    if (remarkSample.recordset.length > 0) {
      const cols = Object.keys(remarkSample.recordset[0]);
      table(cols, remarkSample.recordset.map(r => cols.map(c => {
        const v = r[c]; if (v == null) return '—';
        const s = String(v); return s.length > 40 ? s.substring(0, 40) + '…' : s;
      })));
    }

    const phoneSample = await mssqlPool.request().query(`
      SELECT TOP 3 pho_id, pot_id, cnt_id, con_id, cli_id, phr_id,
             pho_call_date, pho_caller, pho_number, pho_note, pho_deleted
      FROM PhoneCommunications ORDER BY pho_id DESC
    `);
    if (phoneSample.recordset.length > 0) {
      log(`  PhoneCommunications vzorky:`);
      const cols = Object.keys(phoneSample.recordset[0]);
      table(cols, phoneSample.recordset.map(r => cols.map(c => {
        const v = r[c]; if (v == null) return '—';
        const s = String(v); return s.length > 35 ? s.substring(0, 35) + '…' : s;
      })));
    }

    const phoneResultTypes = await mssqlPool.request().query(`SELECT * FROM PhoneCallResults ORDER BY phr_id`);
    log(`  PhoneCallResults (výsledky hovorov):`);
    for (const r of phoneResultTypes.recordset) {
      log(`    ${r.phr_id}: ${r.phr_code} = ${r.phr_default_name}`);
    }
  } catch (err) { log(`  WARN: Historické dáta diagnostika: ${err.message}`); }

  log('\n--- Diagnostika CBC: Collaborators stĺpce (health, marital, insurance) ---');
  try {
    const docCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Collaborators'
      AND (COLUMN_NAME LIKE '%health%' OR COLUMN_NAME LIKE '%insur%' OR COLUMN_NAME LIKE '%marit%'
           OR COLUMN_NAME LIKE '%poistn%' OR COLUMN_NAME LIKE '%stav%' OR COLUMN_NAME LIKE '%zdrav%')
      ORDER BY COLUMN_NAME
    `);
    if (docCols.recordset.length > 0) {
      log('  Collaborators health/marital stĺpce: ' + docCols.recordset.map(r => r.COLUMN_NAME).join(', '));
    } else {
      log('  Žiadne health/marital stĺpce v Collaborators');
    }
  } catch (err) { log(`  WARN: Collab health: ${err.message}`); }

  log('\n--- Diagnostika CBC: PersonalData stĺpce (health, marital, insurance) ---');
  try {
    const pdCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'PersonalData'
      AND (COLUMN_NAME LIKE '%health%' OR COLUMN_NAME LIKE '%insur%' OR COLUMN_NAME LIKE '%marit%'
           OR COLUMN_NAME LIKE '%poistn%' OR COLUMN_NAME LIKE '%stav%' OR COLUMN_NAME LIKE '%zdrav%')
      ORDER BY COLUMN_NAME
    `);
    if (pdCols.recordset.length > 0) {
      log('  PersonalData health/marital stĺpce: ' + pdCols.recordset.map(r => r.COLUMN_NAME).join(', '));
    } else {
      log('  Žiadne health/marital stĺpce v PersonalData');
    }
  } catch (err) { log(`  WARN: PD health: ${err.message}`); }

  log('\n--- Diagnostika CBC: Companies stĺpce (billing, fakturacna) ---');
  try {
    const comCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Companies'
      ORDER BY ORDINAL_POSITION
    `);
    log('  Companies stĺpce: ' + comCols.recordset.map(r => r.COLUMN_NAME).join(', '));
  } catch (err) { log(`  WARN: Companies: ${err.message}`); }

  log('\n--- Diagnostika CBC: Hľadanie billing údajov (IČO, DIČ, IBAN, adresa firmy) ---');
  try {
    const billingTables = await mssqlPool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE (COLUMN_NAME LIKE '%ico%' OR COLUMN_NAME LIKE '%dic%' OR COLUMN_NAME LIKE '%vat%' 
             OR COLUMN_NAME LIKE '%iban%' OR COLUMN_NAME LIKE '%tax%' OR COLUMN_NAME LIKE '%swift%'
             OR COLUMN_NAME LIKE '%bank%' OR COLUMN_NAME LIKE '%reg%number%'
             OR COLUMN_NAME LIKE '%company_name%' OR COLUMN_NAME LIKE '%billing%')
      AND TABLE_NAME NOT LIKE 'sys%'
      ORDER BY TABLE_NAME, COLUMN_NAME
    `);
    log('  Billing stĺpce v CBC:');
    for (const r of billingTables.recordset) {
      log(`    ${r.TABLE_NAME}.${r.COLUMN_NAME}`);
    }
  } catch (err) { log(`  WARN billing search: ${err.message}`); }

  try {
    const addCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'MailAddresses'
      ORDER BY ORDINAL_POSITION
    `);
    log('  MailAddresses ALL stĺpce: ' + addCols.recordset.map(r => r.COLUMN_NAME).join(', '));
  } catch (err) { log(`  WARN MailAddresses cols: ${err.message}`); }

  try {
    const invAddrSample = await mssqlPool.request().query(`
      SELECT TOP 5 i.inv_id, i.add_id_company, i.add_id_invoice,
             ac.add_name AS company_name, ac.add_street_and_number AS company_street, ac.add_city AS company_city,
             ac.add_zip AS company_zip, ac.add_country AS company_country, ac.add_area AS company_area,
             ai.add_name AS invoice_name, ai.add_street_and_number AS invoice_street, ai.add_city AS invoice_city
      FROM Invoices i
      LEFT JOIN MailAddresses ac ON ac.add_id = i.add_id_company
      LEFT JOIN MailAddresses ai ON ai.add_id = i.add_id_invoice
      WHERE i.add_id_company IS NOT NULL
    `);
    log('  Invoices → MailAddresses (company address) vzorka:');
    for (const r of invAddrSample.recordset) {
      log(`    inv_id=${r.inv_id}: company=[${r.company_name}] ${r.company_street}, ${r.company_city} ${r.company_zip} ${r.company_country} | area=${r.company_area}`);
    }
  } catch (err) { log(`  WARN inv addr sample: ${err.message}`); }

  try {
    const companiesAll = await mssqlPool.request().query(`SELECT * FROM Companies`);
    log('  Companies ALL data:');
    for (const r of companiesAll.recordset) {
      log(`    com_id=${r.com_id}: ${r.com_name} (${r.com_code}) country=${r.com_country_code} entity=${r.com_entity_code}`);
    }
  } catch (err) { log(`  WARN companies all: ${err.message}`); }

  try {
    const relatedTables = await mssqlPool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%Company%' OR TABLE_NAME LIKE '%Billing%' OR TABLE_NAME LIKE '%Account%' 
            OR TABLE_NAME LIKE '%Bank%' OR TABLE_NAME LIKE '%Entity%'
      ORDER BY TABLE_NAME
    `);
    log('  Súvisiace tabuľky (Company/Billing/Account/Bank/Entity):');
    for (const r of relatedTables.recordset) {
      log(`    ${r.TABLE_NAME}`);
    }
  } catch (err) { log(`  WARN related tables: ${err.message}`); }

  try {
    const compEntityCols = await mssqlPool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME LIKE '%CompanyEntit%' OR TABLE_NAME LIKE '%Entity%'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);
    if (compEntityCols.recordset.length > 0) {
      log('  Entity tabuľky stĺpce:');
      for (const r of compEntityCols.recordset) {
        log(`    ${r.TABLE_NAME}.${r.COLUMN_NAME}`);
      }
    }
  } catch (err) { log(`  WARN entity tables: ${err.message}`); }

  try {
    const entityData = await mssqlPool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%Entit%'
    `);
    for (const t of entityData.recordset) {
      try {
        const cols = await mssqlPool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${t.TABLE_NAME}' ORDER BY ORDINAL_POSITION`);
        log(`    ${t.TABLE_NAME} stĺpce: ${cols.recordset.map(r => r.COLUMN_NAME).join(', ')}`);
        const data = await mssqlPool.request().query(`SELECT TOP 3 * FROM [${t.TABLE_NAME}]`);
        for (const r of data.recordset) {
          log(`      ${JSON.stringify(r)}`);
        }
      } catch (e) { log(`    ${t.TABLE_NAME}: ${e.message}`); }
    }
  } catch (err) { log(`  WARN entity data: ${err.message}`); }

  log('\n--- Diagnostika CBC: ServiceCollections stĺpce (representative, nurse, certificate, coordinator) ---');
  try {
    const scoCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ServiceCollections'
      AND (COLUMN_NAME LIKE '%rep%' OR COLUMN_NAME LIKE '%nurse%' OR COLUMN_NAME LIKE '%agent%'
           OR COLUMN_NAME LIKE '%emp%' OR COLUMN_NAME LIKE '%usr%' OR COLUMN_NAME LIKE '%sales%'
           OR COLUMN_NAME LIKE '%obch%' OR COLUMN_NAME LIKE '%second%'
           OR COLUMN_NAME LIKE '%cert%' OR COLUMN_NAME LIKE '%coord%' OR COLUMN_NAME LIKE '%lab%'
           OR COLUMN_NAME LIKE '%child%' OR COLUMN_NAME LIKE '%gender%' OR COLUMN_NAME LIKE '%sex%')
      ORDER BY COLUMN_NAME
    `);
    if (scoCols.recordset.length > 0) {
      log('  ServiceCollections relevant stĺpce: ' + scoCols.recordset.map(r => r.COLUMN_NAME).join(', '));
      const scoSample = await mssqlPool.request().query(`
        SELECT TOP 5 ${scoCols.recordset.map(r => r.COLUMN_NAME).join(', ')}
        FROM ServiceCollections ORDER BY sco_id DESC
      `);
      table(scoCols.recordset.map(r => r.COLUMN_NAME),
        scoSample.recordset.map(r => scoCols.recordset.map(c => r[c.COLUMN_NAME] != null ? String(r[c.COLUMN_NAME]).substring(0, 30) : '—'))
      );
    } else {
      log('  Žiadne relevantné stĺpce v ServiceCollections');
    }
  } catch (err) { log(`  WARN: SC cols: ${err.message}`); }

  log('\n--- Diagnostika CBC: Contracts stĺpce (representative, agent, sales) ---');
  try {
    const conCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Contracts'
      AND (COLUMN_NAME LIKE '%rep%' OR COLUMN_NAME LIKE '%agent%' OR COLUMN_NAME LIKE '%sales%'
           OR COLUMN_NAME LIKE '%obch%' OR COLUMN_NAME LIKE '%emp%' OR COLUMN_NAME LIKE '%usr%')
      ORDER BY COLUMN_NAME
    `);
    if (conCols.recordset.length > 0) {
      log('  Contracts relevant stĺpce: ' + conCols.recordset.map(r => r.COLUMN_NAME).join(', '));
      const conSample = await mssqlPool.request().query(`
        SELECT TOP 5 ${conCols.recordset.map(r => r.COLUMN_NAME).join(', ')}
        FROM Contracts WHERE con_id IN (
          SELECT TOP 5 con_id FROM ContractServices WHERE sco_id IS NOT NULL ORDER BY con_id DESC
        )
      `);
      log('  Contracts sample (s odberom):');
      table(conCols.recordset.map(r => r.COLUMN_NAME), conSample.recordset.map(r => conCols.recordset.map(c => r[c.COLUMN_NAME])));
    } else {
      log('  Žiadne rep/agent/sales stĺpce v Contracts');
    }
  } catch (err) { log(`  WARN: Contracts cols: ${err.message}`); }

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

  const cbcToIndexusStatus = {
    1:  { name: 'Vydaný',                  code: '1',   branch: 1, sortOrder: 1 },
    2:  { name: 'V preprave',              code: '1.1', branch: 1, sortOrder: 2 },
    3:  { name: 'Na spracovaní',           code: '1.2', branch: 1, sortOrder: 3 },
    4:  { name: 'Na vyhodnotení',          code: '1.3', branch: 1, sortOrder: 4 },
    5:  { name: 'Evaluated',              code: '1.4', branch: 1, sortOrder: 5 },
    6:  { name: 'Generovanie certifikátov', code: '1.5', branch: 1, sortOrder: 6 },
    7:  { name: 'Uskladnený',             code: '1.6', branch: 1, sortOrder: 7 },
    8:  { name: 'Released',               code: '1.7', branch: 1, sortOrder: 8 },
    9:  { name: 'Transferred',            code: '1.8', branch: 1, sortOrder: 9 },
    11: { name: 'Likvidácia',             code: '2',   branch: 2, sortOrder: 1 },
    12: { name: 'V preprave - likvidácia', code: '2.1', branch: 2, sortOrder: 2 },
    13: { name: 'Na spracovaní - likvidácia', code: '2.2', branch: 2, sortOrder: 3 },
    14: { name: 'Na vyhodnotení - likvidácia', code: '2.3', branch: 2, sortOrder: 4 },
    15: { name: 'Zlikvidovaný',           code: '2.4', branch: 2, sortOrder: 5 },
  };

  log('  Mapovanie CBC → INDEXUS statusov (zjednotené):');
  for (const [id, mapping] of Object.entries(cbcToIndexusStatus)) {
    log(`    ID=${id} → code=${mapping.code}, name=${mapping.name}`);
  }
  log('  CBC remap (duplicity zlúčené): ' + JSON.stringify(cbcStatusRemap));

  await pgPool.query('DELETE FROM collection_statuses WHERE id > 0');
  log('  Vyčistené staré statusy');

  let sInserted = 0;
  for (const [id, mapping] of Object.entries(cbcToIndexusStatus)) {
    await pgPool.query(`
      INSERT INTO collection_statuses (id, name, code, branch, sort_order, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
    `, [parseInt(id), mapping.name, mapping.code, mapping.branch, mapping.sortOrder]);
    sInserted++;
  }
  log(`  → ${sInserted} statusov vložených (9 zjednotených z 10 CBC)`);

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
  separator(`STEP 3: Nemocnice (referencované z TOP ${LIMIT} odberov)`);

  const referencedHosIds = await mssqlPool.request().query(`
    SELECT DISTINCT hos_id FROM (SELECT TOP ${LIMIT} hos_id FROM ServiceCollections ORDER BY sco_id DESC) sub
    WHERE hos_id IS NOT NULL
  `);
  const hosIdList = referencedHosIds.recordset.map(r => r.hos_id);
  log(`  Referencované nemocnice z odberov: ${hosIdList.length} unikátnych hos_id`);

  const labLookup = {};
  const pgLabs = await pgPool.query('SELECT id, name FROM laboratories');
  for (const r of pgLabs.rows) labLookup[r.name] = r.id;

  const hospitals = hosIdList.length > 0 ? await mssqlPool.request().query(`
    SELECT h.hos_id, h.hos_name, h.hos_full_name, h.hos_active,
           h.hos_svet_zdravia, h.hos_inserted,
           a.add_street_and_number, a.add_city, a.add_zip, a.add_area, a.add_country,
           l.lab_name, l.lab_country_code
    FROM Hospitals h
    LEFT JOIN MailAddresses a ON a.add_id = h.add_id AND a.add_valid = 1
    LEFT JOIN Laboratories l ON l.lab_id = h.lab_id
    WHERE h.hos_id IN (${hosIdList.join(',')})
    ORDER BY h.hos_id DESC
  `) : { recordset: [] };

  const showLimit = Math.min(10, hospitals.recordset.length);
  log(`Zdrojové dáta z CBC (prvých ${showLimit} z ${hospitals.recordset.length}):`);
  table(
    ['hos_id', 'Názov', 'Mesto', 'PSČ', 'Krajina', 'Lab', 'Aktívna'],
    hospitals.recordset.slice(0, showLimit).map(r => [
      r.hos_id, r.hos_name, r.add_city, r.add_zip,
      r.add_country || r.lab_country_code || '?', r.lab_name, r.hos_active ? 'áno' : 'nie'
    ])
  );

  let inserted = 0, skipped = 0, updated = 0, errors = 0, geocoded = 0;
  for (const row of hospitals.recordset) {
    try {
      const countryCode = normalizeCountryCode(row.add_country || row.lab_country_code);
      const city = normalizeCity(row.add_city);
      const postalCode = normalizePostalCode(row.add_zip, countryCode);

      const existing = await pgPool.query('SELECT id, latitude, data_source FROM hospitals WHERE legacy_id = $1', [String(row.hos_id)]);
      if (existing.rows.length > 0) {
        // Update existing record with GPS + data_source if missing
        const ex = existing.rows[0];
        if (!ex.latitude || !ex.data_source) {
          let lat = ex.latitude, lng = null;
          if (!ex.latitude) {
            try {
              const geo = await geocodeAddress(row.add_street_and_number, city, postalCode, countryCode);
              if (geo) { lat = geo.lat; lng = geo.lng; geocoded++; }
            } catch (geoErr) { /* skip */ }
          }
          await pgPool.query(`UPDATE hospitals SET data_source = COALESCE(data_source, 'iscbc'), latitude = COALESCE(latitude, $2), longitude = COALESCE(longitude, $3), updated_at = now() WHERE id = $1`,
            [ex.id, lat, lng]);
          updated++;
        }
        skipped++;
        continue;
      }

      const labId = row.lab_name ? (labLookup[row.lab_name] || null) : null;
      let lat = null, lng = null;
      try {
        const geo = await geocodeAddress(row.add_street_and_number, city, postalCode, countryCode);
        if (geo) { lat = geo.lat; lng = geo.lng; geocoded++; }
      } catch (geoErr) { /* skip geocoding errors */ }

      await pgPool.query(`
        INSERT INTO hospitals (
          legacy_id, name, full_name, is_active, street_number, city, postal_code, region,
          country_code, laboratory_id, svet_zdravia, latitude, longitude, data_source, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      `, [
        String(row.hos_id), row.hos_name, row.hos_full_name,
        !!row.hos_active,
        row.add_street_and_number, city, postalCode, row.add_area,
        countryCode, labId,
        row.hos_svet_zdravia === true || row.hos_svet_zdravia === 1,
        lat, lng, 'iscbc',
        row.hos_inserted || new Date(), new Date(),
      ]);
      inserted++;
    } catch (err) {
      errors++;
      log(`  ERROR hos_id=${row.hos_id}: ${err.message}`);
    }
  }
  log(`\n  → ${inserted} vložených, ${skipped} preskočených (${updated} aktualizovaných), ${errors} chýb, ${geocoded} geocodovaných`);
}

// ============================================================
// STEP 4: Collaborators (TOP 20)
// ============================================================
async function step4_collaborators() {
  separator(`STEP 4: Spolupracovníci (referencovaní z TOP ${LIMIT} odberov)`);

  const hospitalLookup = {};
  const pgH = await pgPool.query('SELECT id, legacy_id FROM hospitals WHERE legacy_id IS NOT NULL');
  for (const r of pgH.rows) hospitalLookup[r.legacy_id] = r.id;

  const referencedDocIds = await mssqlPool.request().query(`
    SELECT DISTINCT cc.doc_id FROM CollectionCollaborators cc
    WHERE cc.sco_id IN (SELECT TOP ${LIMIT} sco_id FROM ServiceCollections ORDER BY sco_id DESC)
    AND cc.doc_id IS NOT NULL
  `);
  const docIdList = referencedDocIds.recordset.map(r => r.doc_id);
  log(`  Referencovaní spolupracovníci z odberov: ${docIdList.length} unikátnych doc_id`);

  const collabs = docIdList.length > 0 ? await mssqlPool.request().query(`
    SELECT d.doc_id, d.per_id, d.rer_id, d.add_id, d.add_id_firm,
           d.doc_active, d.doc_note, d.doc_agreement_type,
           d.doc_IBAN, d.doc_SWIFT, d.doc_ICO, d.doc_DIC, d.doc_IC_DPH,
           d.doc_birth_place, d.doc_client_contract, d.doc_svet_zdravia,
           d.doc_monthly_rewards, d.doc_inserted,
           ct.cty_code,
           pd.pda_title_prefix, pd.pda_first_name, pd.pda_last_name,
           pd.pda_maiden_name, pd.pda_title_suffix, pd.pda_birth_date,
           pd.pda_id_number, pd.pda_email, pd.pda_mobile, pd.pda_mobile2,
           pd.pda_phone_number, pd.pda_other_contact,
           pd.pda_health_insurance_code, pd.pda_health_insurance_company,
           pd.pda_IBAN as pda_iban, pd.pda_SWIFT as pda_swift
    FROM Collaborators d
    LEFT JOIN CollaboratorTypes ct ON ct.cty_id = d.cty_id
    LEFT JOIN PersonalData pd ON pd.per_id = d.per_id AND pd.pda_valid = 1
    WHERE d.doc_id IN (${docIdList.join(',')})
    ORDER BY d.doc_id DESC
  `) : { recordset: [] };

  // Representants lookup: rer_id → person name
  const repLookup = {};
  try {
    const reps = await mssqlPool.request().query(`
      SELECT r.rer_id, pd.pda_title_prefix, pd.pda_first_name, pd.pda_last_name
      FROM Representants r
      LEFT JOIN PersonalData pd ON pd.per_id = r.per_id AND pd.pda_valid = 1
      WHERE r.rer_active = 1
    `);
    for (const r of reps.recordset) {
      const parts = [r.pda_title_prefix, r.pda_first_name, r.pda_last_name].filter(Boolean);
      repLookup[r.rer_id] = parts.join(' ');
    }
    log(`  Representants: ${Object.keys(repLookup).length} aktívnych`);
  } catch (err) { log(`  WARN Representants: ${err.message}`); }

  // MailAddresses lookup: per_id → all addresses by mat_id type + add_id for firm
  // mat_id: 1 = Trvalé bydlisko (permanent), 2 = Adresa pracoviska (work), 3 = Korešpondenčná adresa (correspondence)
  // add_id_firm = Adresa spoločnosti (company)
  const addressByPerId = {};  // per_id → { permanent: addr, work: addr, correspondence: addr }
  const addressByAddId = {};  // add_id → addr (for firm addresses)
  try {
    const perIds = new Set();
    const firmAddIds = new Set();
    const workAddIds = new Set();
    for (const r of collabs.recordset) {
      if (r.per_id) perIds.add(r.per_id);
      if (r.add_id_firm) firmAddIds.add(r.add_id_firm);
      if (r.add_id) workAddIds.add(r.add_id);
    }
    if (perIds.size > 0) {
      const addrs = await mssqlPool.request().query(`
        SELECT a.add_id, a.per_id, a.mat_id, a.add_name, a.add_street_and_number, a.add_city, a.add_zip, a.add_area, a.add_country, a.add_valid,
               mt.mat_code
        FROM MailAddresses a
        LEFT JOIN MailAddressTypes mt ON mt.mat_id = a.mat_id
        WHERE a.per_id IN (${[...perIds].join(',')}) AND a.add_valid = 1
        ORDER BY a.add_id DESC
      `);
      for (const a of addrs.recordset) {
        if (!addressByPerId[a.per_id]) addressByPerId[a.per_id] = {};
        // mat_id: 1 = Trvalé bydlisko (permanent), 2 = Adresa pracoviska (work), 3 = Korešpondenčná adresa (correspondence)
        if (a.mat_id === 1 && !addressByPerId[a.per_id].permanent) {
          addressByPerId[a.per_id].permanent = a;
        } else if (a.mat_id === 2 && !addressByPerId[a.per_id].work) {
          addressByPerId[a.per_id].work = a;
        } else if (a.mat_id === 3 && !addressByPerId[a.per_id].correspondence) {
          addressByPerId[a.per_id].correspondence = a;
        }
        addressByAddId[a.add_id] = a;
      }
    }
    // Also load firm addresses and workplace addresses by add_id if not already loaded
    const extraAddIds = new Set([...firmAddIds, ...workAddIds]);
    if (extraAddIds.size > 0) {
      const missing = [...extraAddIds].filter(id => !addressByAddId[id]);
      if (missing.length > 0) {
        const extraAddrs = await mssqlPool.request().query(`
          SELECT a.add_id, a.per_id, a.mat_id, a.add_name, a.add_street_and_number, a.add_city, a.add_zip, a.add_area, a.add_country
          FROM MailAddresses a
          WHERE a.add_id IN (${missing.join(',')})
        `);
        for (const a of extraAddrs.recordset) {
          addressByAddId[a.add_id] = a;
        }
      }
    }
    const workCount = [...workAddIds].filter(id => addressByAddId[id]).length;
    const firmCount = [...firmAddIds].filter(id => addressByAddId[id]).length;
    const totalAddrs = Object.values(addressByPerId).reduce((sum, p) => sum + (p.permanent ? 1 : 0) + (p.work ? 1 : 0) + (p.correspondence ? 1 : 0), 0) + firmCount + workCount;
    log(`  MailAddresses: ${totalAddrs} adries načítaných (per_id: ${Object.keys(addressByPerId).length}, work: ${workCount}, firm: ${firmCount})`);
  } catch (err) { log(`  WARN MailAddresses: ${err.message}`); }

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

  const showLimitC = Math.min(10, collabs.recordset.length);
  log(`Zdrojové dáta z CBC (prvých ${showLimitC} z ${collabs.recordset.length}):`);
  table(
    ['doc_id', 'Meno', 'Priezvisko', 'Typ', 'Mobil (RAW)', '→ Normalized', 'Email', 'Krajina'],
    collabs.recordset.slice(0, showLimitC).map(r => [
      r.doc_id, r.pda_first_name, r.pda_last_name, r.cty_code,
      r.pda_mobile, normalizePhone(r.pda_mobile, countryMap[r.doc_id] || 'SK'),
      r.pda_email, countryMap[r.doc_id] || 'SK',
    ])
  );

  const healthInsLookup = {};
  const pgHI = await pgPool.query('SELECT id, code, country_code FROM health_insurance_companies');
  for (const r of pgHI.rows) healthInsLookup[`${r.code}_${r.country_code}`] = r.id;

  let hiMatched = 0, hiUnmatched = 0;
  let inserted = 0, skipped = 0, errors = 0, addrInserted = 0, repMatched = 0;
  for (const row of collabs.recordset) {
    try {
      const existing = await pgPool.query('SELECT id, data_source, representative_id, health_insurance_id, hospital_ids, bank_account_iban, note FROM collaborators WHERE legacy_id = $1', [String(row.doc_id)]);
      if (existing.rows.length > 0) {
        const ex = existing.rows[0];
        const countryCode = normalizeCountryCode(countryMap[row.doc_id]);
        const repName = row.rer_id ? (repLookup[row.rer_id] || null) : null;
        const hospIds = (hospMap[row.doc_id] || []).map(legId => hospitalLookup[legId]).filter(Boolean);
        const iban = row.doc_IBAN || row.pda_iban || null;
        const swift = row.doc_SWIFT || row.pda_swift || null;

        let healthInsId = null;
        if (row.pda_health_insurance_code) {
          const hiKey = `${row.pda_health_insurance_code}_${countryCode}`;
          healthInsId = healthInsLookup[hiKey] || null;
          if (healthInsId) hiMatched++; else hiUnmatched++;
        }

        await pgPool.query(`UPDATE collaborators SET
          data_source = COALESCE(data_source, 'iscbc'),
          representative_id = COALESCE(representative_id, $2),
          health_insurance_id = COALESCE(health_insurance_id, $3),
          hospital_ids = CASE WHEN hospital_ids IS NULL OR hospital_ids = '{}' THEN $4::varchar[] ELSE hospital_ids END,
          bank_account_iban = COALESCE(bank_account_iban, $5),
          swift_code = COALESCE(swift_code, $6),
          note = COALESCE(note, $7),
          updated_at = now()
        WHERE id = $1`,
          [ex.id, repName, healthInsId, hospIds.length > 0 ? hospIds : null, iban, swift, row.doc_note]);

        const existingAddrs = await pgPool.query('SELECT address_type FROM collaborator_addresses WHERE collaborator_id = $1', [ex.id]);
        const existingTypes = new Set(existingAddrs.rows.map(r => r.address_type));
        const perAddrData = row.per_id ? (addressByPerId[row.per_id] || {}) : {};
        const addrPairs = [
          { addr: perAddrData.permanent, type: 'permanent' },
          { addr: perAddrData.work, type: 'work' },
          { addr: perAddrData.correspondence, type: 'correspondence' },
          { addr: row.add_id_firm ? addressByAddId[row.add_id_firm] : null, type: 'company' },
        ];
        for (const ap of addrPairs) {
          if (!ap.addr || existingTypes.has(ap.type)) continue;
          const addrCountry = normalizeCountryCode(ap.addr.add_country);
          const legacyIdSuffix = ap.type === 'correspondence' ? '_cor' : (ap.type === 'work' ? '_work' : (ap.type === 'company' ? '_firm' : ''));
          await pgPool.query(`INSERT INTO collaborator_addresses (legacy_id, collaborator_id, address_type, name, street_number, city, postal_code, region, country_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [String(ap.addr.add_id) + legacyIdSuffix, ex.id, ap.type, ap.addr.add_name, ap.addr.add_street_and_number, normalizeCity(ap.addr.add_city), normalizePostalCode(ap.addr.add_zip, addrCountry), ap.addr.add_area, addrCountry]);
          addrInserted++;
        }
        if (repName) repMatched++;
        skipped++;
        continue;
      }

      const countryCode = normalizeCountryCode(countryMap[row.doc_id]);
      const firstName = normalizeName(row.pda_first_name) || 'N/A';
      const lastName = normalizeName(row.pda_last_name) || 'N/A';
      const birth = decomposeBirthDate(row.pda_birth_date);

      const hospIdsRaw = (hospMap[row.doc_id] || []).map(legId => hospitalLookup[legId]).filter(Boolean);
      const hospIds = hospIdsRaw.length > 0 ? `{${hospIdsRaw.join(',')}}` : '{}';

      let healthInsId = null;
      if (row.pda_health_insurance_code) {
        const hiKey = `${row.pda_health_insurance_code}_${countryCode}`;
        healthInsId = healthInsLookup[hiKey] || null;
        if (healthInsId) hiMatched++;
        else hiUnmatched++;
      }

      const repName = row.rer_id ? (repLookup[row.rer_id] || null) : null;
      const iban = row.doc_IBAN || row.pda_iban || null;
      const swift = row.doc_SWIFT || row.pda_swift || null;

      const legacyCompany = {};
      if (row.doc_ICO) legacyCompany.ico = row.doc_ICO;
      if (row.doc_DIC) legacyCompany.dic = row.doc_DIC;
      if (row.doc_IC_DPH) legacyCompany.icDph = row.doc_IC_DPH;
      if (row.doc_IBAN) legacyCompany.iban = row.doc_IBAN;
      if (row.doc_SWIFT) legacyCompany.swift = row.doc_SWIFT;
      if (row.add_id_firm && addressByAddId[row.add_id_firm]) {
        const fa = addressByAddId[row.add_id_firm];
        legacyCompany.firmAddress = {
          street: fa.add_street, city: fa.add_city, zip: fa.add_zip, country: fa.add_country,
          name: fa.add_name, phone: fa.add_phone, email: fa.add_email
        };
      }
      if (row.doc_agreement_type) legacyCompany.agreementType = row.doc_agreement_type;

      const res = await pgPool.query(`
        INSERT INTO collaborators (
          legacy_id, country_code, country_codes, first_name, last_name,
          title_before, maiden_name, title_after,
          birth_number, birth_day, birth_month, birth_year, birth_place,
          phone, mobile, mobile_2, other_contact, email,
          bank_account_iban, swift_code, ico, dic, ic_dph,
          client_contact, is_active, svet_zdravia, month_rewards,
          note, collaborator_type, hospital_ids, health_insurance_id,
          representative_id, data_source, legacy_company,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)
        RETURNING id
      `, [
        String(row.doc_id), countryCode, [countryCode],
        firstName, lastName,
        row.pda_title_prefix, normalizeName(row.pda_maiden_name), row.pda_title_suffix,
        normalizeNationalId(row.pda_id_number), birth.day, birth.month, birth.year, row.doc_birth_place,
        normalizePhone(row.pda_phone_number, countryCode) || normalizePhone(row.pda_mobile, countryCode),
        normalizePhone(row.pda_mobile, countryCode),
        normalizePhone(row.pda_mobile2, countryCode),
        row.pda_other_contact, normalizeEmail(row.pda_email),
        iban, swift, row.doc_ICO, row.doc_DIC, row.doc_IC_DPH,
        row.doc_client_contract === true || row.doc_client_contract === 1,
        row.doc_active === true || row.doc_active === 1,
        row.doc_svet_zdravia === true || row.doc_svet_zdravia === 1,
        row.doc_monthly_rewards === true || row.doc_monthly_rewards === 1,
        row.doc_note, normalizeCollaboratorType(row.cty_code), hospIds, healthInsId,
        repName, 'iscbc', Object.keys(legacyCompany).length > 0 ? JSON.stringify(legacyCompany) : null,
        row.doc_inserted || new Date(), new Date(),
      ]);
      const collabId = res.rows[0].id;

      // Migrate addresses: per_id → permanent (mat_id=1), work (mat_id=2), correspondence (mat_id=3)
      // add_id → workplace address (Adresa pracoviska); add_id_firm → company address (Adresa spoločnosti)
      const perAddrData = row.per_id ? (addressByPerId[row.per_id] || {}) : {};
      const workAddr = perAddrData.work || (row.add_id ? addressByAddId[row.add_id] : null);
      const addrPairs = [
        { addr: perAddrData.permanent, type: 'permanent' },
        { addr: workAddr, type: 'work' },
        { addr: perAddrData.correspondence, type: 'correspondence' },
        { addr: row.add_id_firm ? addressByAddId[row.add_id_firm] : null, type: 'company' },
      ];
      for (const ap of addrPairs) {
        if (!ap.addr) continue;
        const addrCountry = normalizeCountryCode(ap.addr.add_country);
        const legacyIdSuffix = ap.type === 'correspondence' ? '_cor' : (ap.type === 'work' ? '_work' : (ap.type === 'company' ? '_firm' : ''));
        await pgPool.query(`
          INSERT INTO collaborator_addresses (
            legacy_id, collaborator_id, address_type, name, street_number, city, postal_code, region, country_code
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [
          String(ap.addr.add_id) + legacyIdSuffix, collabId, ap.type,
          ap.addr.add_name, ap.addr.add_street_and_number,
          normalizeCity(ap.addr.add_city), normalizePostalCode(ap.addr.add_zip, addrCountry),
          ap.addr.add_area, addrCountry,
        ]);
        addrInserted++;
      }

      if (repName) repMatched++;
      inserted++;
    } catch (err) {
      errors++;
      log(`  ERROR doc_id=${row.doc_id}: ${err.message}`);
    }
  }
  log(`\n  → ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);
  log(`  Adresy: ${addrInserted} vložených (permanent + work + correspondence + company)`);
  log(`  Representants: ${repMatched} priradených`);
  log(`  Zdravotné poisťovne: ${hiMatched} priradených, ${hiUnmatched} nenájdených v INDEXUS`);
  // Log health insurance diagnostic for unmatched
  if (hiUnmatched > 0) {
    const unmatchedHICodes = new Set();
    for (const row of collabs.recordset) {
      if (row.pda_health_insurance_code) {
        const cc = normalizeCountryCode(countryMap[row.doc_id]);
        const hiKey = `${row.pda_health_insurance_code}_${cc}`;
        if (!healthInsLookup[hiKey]) unmatchedHICodes.add(`${row.pda_health_insurance_code} (${cc})`);
      }
    }
    log(`  Nenájdené HI kódy: ${[...unmatchedHICodes].join(', ')}`);
  }
}

// ============================================================
// STEP 4.5: Collaborator Agreements
// ============================================================
async function step4b_agreements() {
  separator('STEP 4.5: Dohody spolupracovníkov (CollaboratorAgreements)');

  const collabLookup = {};
  const pgC = await pgPool.query('SELECT id, legacy_id FROM collaborators WHERE legacy_id IS NOT NULL');
  for (const r of pgC.rows) collabLookup[r.legacy_id] = r.id;

  const docIds = Object.keys(collabLookup);
  if (docIds.length === 0) { log('  Žiadni spolupracovníci, preskakujem'); return; }

  let agreements;
  try {
    agreements = await mssqlPool.request().query(`
      SELECT ca.cag_id, ca.doc_id, ca.com_id, ca.cag_number,
             ca.cag_from, ca.cag_to,
             ca.cag_agreement_sent, ca.cag_agreement_returned,
             ca.cag_valid, ca.cag_inserted, ca.afo_id,
             ca.cag_questionaire_returned,
             ca.cag_social_insurance_registration,
             ca.cag_social_insurance_cancel,
             ca.cag_note, ca.cag_repository,
             c.com_name, c.com_country_code
      FROM CollaboratorAgreements ca
      LEFT JOIN Companies c ON c.com_id = ca.com_id
      WHERE ca.doc_id IN (${docIds.join(',')})
      ORDER BY ca.cag_id DESC
    `);
  } catch (err) {
    log(`  WARN: CollaboratorAgreements query: ${err.message}`);
    return;
  }

  log(`  Nájdených ${agreements.recordset.length} dohôd pre ${docIds.length} spolupracovníkov`);

  const showLimit = Math.min(10, agreements.recordset.length);
  if (showLimit > 0) {
    table(
      ['cag_id', 'doc_id', 'Company', 'Number', 'From', 'To', 'Sent', 'Returned', 'Valid', 'Form'],
      agreements.recordset.slice(0, showLimit).map(r => [
        r.cag_id, r.doc_id, r.com_name || '—',
        r.cag_number || '—',
        r.cag_from ? new Date(r.cag_from).toLocaleDateString('sk') : '—',
        r.cag_to ? new Date(r.cag_to).toLocaleDateString('sk') : '—',
        r.cag_agreement_sent ? new Date(r.cag_agreement_sent).toLocaleDateString('sk') : '—',
        r.cag_agreement_returned ? new Date(r.cag_agreement_returned).toLocaleDateString('sk') : '—',
        r.cag_valid != null ? String(r.cag_valid) : '—',
        r.afo_id != null ? String(r.afo_id) : '—',
      ])
    );
  }

  // Build reward_types map from CollectionCollaborators: for each cag_id → set of agt_codes
  const rewardTypesMap = {};
  const agtCodeToRewardType = {
    'REG_AGT_RECRUITING': 'recruitment',
    'REG_AGT_ASSISTANCE': 'assistance',
    'REG_AGT_COLLECTING_BLOOD': 'puk_collection',
    'REG_AGT_COLLECTING_TISSUE': 'tpu_collection',
    'REG_AGT_COLLECTING_PLACENTA': 'plk_collection',
    'REG_AGT_INFORMING': 'informing',
    'REG_AGT_GRANT': 'emergency_grant',
    'REG_AGT_PROPHYLAXIS': 'prophylaxis',
    'REG_AGT_NURSE_MANAGER': 'head_nurse',
    'REG_AGT_LECTURE': 'lecture',
    'REG_AGT_VEDONO': 'management',
  };
  try {
    const ccForAgreements = await mssqlPool.request().query(`
      SELECT DISTINCT cc.doc_id, ca.cag_id, at2.agt_code
      FROM CollectionCollaborators cc
      JOIN CollaborationAgreementTypes at2 ON at2.agt_id = cc.agt_id
      JOIN CollaboratorAgreements ca ON ca.doc_id = cc.doc_id
        AND ca.cag_from <= ISNULL((SELECT s.sco_date FROM ServiceCollections s WHERE s.sco_id = cc.sco_id), ca.cag_to)
        AND ca.cag_to >= ISNULL((SELECT s.sco_date FROM ServiceCollections s WHERE s.sco_id = cc.sco_id), ca.cag_from)
      WHERE cc.doc_id IN (${docIds.join(',')})
    `);
    for (const r of ccForAgreements.recordset) {
      const key = String(r.cag_id);
      if (!rewardTypesMap[key]) rewardTypesMap[key] = new Set();
      const mapped = agtCodeToRewardType[r.agt_code];
      if (mapped) rewardTypesMap[key].add(mapped);
    }
    log(`  Reward types namapované pre ${Object.keys(rewardTypesMap).length} dohôd`);
  } catch (err) {
    log(`  WARN: reward_types mapping: ${err.message}`);
    // Fallback: simpler query without date range
    try {
      const ccSimple = await mssqlPool.request().query(`
        SELECT DISTINCT cc.doc_id, at2.agt_code
        FROM CollectionCollaborators cc
        JOIN CollaborationAgreementTypes at2 ON at2.agt_id = cc.agt_id
        WHERE cc.doc_id IN (${docIds.join(',')})
      `);
      // Group by doc_id and find matching cag_ids
      const docAgtCodes = {};
      for (const r of ccSimple.recordset) {
        const dk = String(r.doc_id);
        if (!docAgtCodes[dk]) docAgtCodes[dk] = new Set();
        const mapped = agtCodeToRewardType[r.agt_code];
        if (mapped) docAgtCodes[dk].add(mapped);
      }
      // For each agreement, use doc_id to get reward_types
      for (const row of agreements.recordset) {
        const dk = String(row.doc_id);
        if (docAgtCodes[dk] && docAgtCodes[dk].size > 0) {
          rewardTypesMap[String(row.cag_id)] = docAgtCodes[dk];
        }
      }
      log(`  Reward types (fallback) namapované pre ${Object.keys(rewardTypesMap).length} dohôd`);
    } catch (err2) {
      log(`  WARN: reward_types fallback: ${err2.message}`);
    }
  }

  let inserted = 0, skipped = 0, errors = 0;
  for (const row of agreements.recordset) {
    try {
      const existing = await pgPool.query('SELECT id FROM collaborator_agreements WHERE legacy_id = $1', [String(row.cag_id)]);
      if (existing.rows.length > 0) { skipped++; continue; }

      const collaboratorId = collabLookup[String(row.doc_id)];
      if (!collaboratorId) { skipped++; continue; }

      const vFrom = row.cag_from ? new Date(row.cag_from) : null;
      const vTo = row.cag_to ? new Date(row.cag_to) : null;
      const sent = row.cag_agreement_sent ? new Date(row.cag_agreement_sent) : null;
      const returned = row.cag_agreement_returned ? new Date(row.cag_agreement_returned) : null;

      const socReg = row.cag_social_insurance_registration ? new Date(row.cag_social_insurance_registration) : null;
      const socCancel = row.cag_social_insurance_cancel ? new Date(row.cag_social_insurance_cancel) : null;

      const rtSet = rewardTypesMap[String(row.cag_id)];
      const rewardTypesArr = rtSet ? Array.from(rtSet) : [];
      const rewardTypesPg = rewardTypesArr.length > 0 ? `{${rewardTypesArr.join(',')}}` : null;

      await pgPool.query(`
        INSERT INTO collaborator_agreements (
          legacy_id, collaborator_id, contract_number,
          valid_from_day, valid_from_month, valid_from_year,
          valid_to_day, valid_to_month, valid_to_year,
          agreement_sent_day, agreement_sent_month, agreement_sent_year,
          agreement_returned_day, agreement_returned_month, agreement_returned_year,
          agreement_form, is_valid,
          questionnaire_returned,
          social_insurance_registration_day, social_insurance_registration_month, social_insurance_registration_year,
          social_insurance_cancel_day, social_insurance_cancel_month, social_insurance_cancel_year,
          note, created_at, reward_types
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
      `, [
        String(row.cag_id), collaboratorId, row.cag_number,
        vFrom ? vFrom.getDate() : null, vFrom ? vFrom.getMonth() + 1 : null, vFrom ? vFrom.getFullYear() : null,
        vTo ? vTo.getDate() : null, vTo ? vTo.getMonth() + 1 : null, vTo ? vTo.getFullYear() : null,
        sent ? sent.getDate() : null, sent ? sent.getMonth() + 1 : null, sent ? sent.getFullYear() : null,
        returned ? returned.getDate() : null, returned ? returned.getMonth() + 1 : null, returned ? returned.getFullYear() : null,
        row.afo_id != null ? String(row.afo_id) : null,
        row.cag_valid === true || row.cag_valid === 1,
        row.cag_questionaire_returned === true || row.cag_questionaire_returned === 1,
        socReg ? socReg.getDate() : null, socReg ? socReg.getMonth() + 1 : null, socReg ? socReg.getFullYear() : null,
        socCancel ? socCancel.getDate() : null, socCancel ? socCancel.getMonth() + 1 : null, socCancel ? socCancel.getFullYear() : null,
        row.cag_note || null,
        row.cag_inserted || new Date(),
        rewardTypesPg,
      ]);
      inserted++;
    } catch (err) {
      errors++;
      log(`  ERROR cag_id=${row.cag_id}: ${err.message}`);
    }
  }
  log(`\n  → ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);
}

// ============================================================
// STEP 4.6: Collaborator Activities (Úkony z CollectionCollaborators)
// ============================================================
async function step4c_activities() {
  separator('STEP 4.6: Úkony spolupracovníkov (CollectionCollaborators)');

  const collabLookup = {};
  const pgC = await pgPool.query('SELECT id, legacy_id FROM collaborators WHERE legacy_id IS NOT NULL');
  for (const r of pgC.rows) collabLookup[r.legacy_id] = r.id;

  const agreementLookup = {};
  const pgA = await pgPool.query('SELECT id, legacy_id FROM collaborator_agreements WHERE legacy_id IS NOT NULL');
  for (const r of pgA.rows) agreementLookup[r.legacy_id] = r.id;

  const hospitalLookup = {};
  const pgH = await pgPool.query('SELECT id, legacy_id FROM hospitals WHERE legacy_id IS NOT NULL');
  for (const r of pgH.rows) hospitalLookup[r.legacy_id] = r.id;

  const collectionLookup = {};
  const pgS = await pgPool.query('SELECT id, legacy_id FROM collections WHERE legacy_id IS NOT NULL');
  for (const r of pgS.rows) collectionLookup[r.legacy_id] = r.id;

  const docIds = Object.keys(collabLookup);
  if (docIds.length === 0) { log('  Žiadni spolupracovníci, preskakujem'); return; }

  // Discover CollectionCollaborators columns
  const ccColsResult = await mssqlPool.request().query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CollectionCollaborators' ORDER BY ORDINAL_POSITION
  `);
  const ccCols = ccColsResult.recordset.map(r => r.COLUMN_NAME);
  log(`  CollectionCollaborators stĺpce: ${ccCols.join(', ')}`);

  // Query CollectionCollaborators — this is the actual source of Úkony tab data
  // Join to CollaboratorAgreements via doc_id + agt_id (no cag_id on cc)
  const docIdList = docIds.join(',');
  const ukonyRows = await mssqlPool.request().query(`
    SELECT
      cc.sco_id, cc.doc_id, cc.agt_id,
      ca.cag_id,
      at2.agt_default_name as typ_dohody,
      at2.agt_code,
      ca.cag_number as cislo_zmluvy,
      sc.sco_collection_made as datum_ukonu,
      sc.sco_collection_unit_number as cislo_cbu,
      sc.hos_id
    FROM CollectionCollaborators cc
    LEFT JOIN CollaborationAgreementTypes at2 ON at2.agt_id = cc.agt_id
    OUTER APPLY (
      SELECT TOP 1 cag_id, cag_number
      FROM CollaboratorAgreements cag2
      WHERE cag2.doc_id = cc.doc_id
      ORDER BY cag2.cag_valid DESC, cag2.cag_id DESC
    ) ca
    LEFT JOIN ServiceCollections sc ON sc.sco_id = cc.sco_id
    WHERE cc.doc_id IN (${docIdList})
    ORDER BY sc.sco_collection_made DESC
  `);

  log(`  Nájdených ${ukonyRows.recordset.length} úkonov pre ${docIds.length} spolupracovníkov`);

  // Skúsime aj načítať odmeny z [Reward].[Acts] ak existujú
  const rewardMap = {};
  try {
    const rewardRows = await mssqlPool.request().query(`
      SELECT rac_id, sco_id_bound, agreement_id_reward,
             rac_state, cur_code, rac_amount, rac_name
      FROM [Reward].[Acts]
      WHERE agreement_id_reward IS NOT NULL
    `);
    for (const r of rewardRows.recordset) {
      const key = `${r.sco_id_bound}_${r.agreement_id_reward}`;
      rewardMap[key] = {
        state: r.rac_state,
        currency: r.cur_code,
        amount: r.rac_amount != null ? String(r.rac_amount) : null,
        name: r.rac_name,
      };
    }
    log(`  Odmeny z [Reward].[Acts]: ${rewardRows.recordset.length} záznamov`);
  } catch (err) { log(`  [Reward].[Acts] nedostupná alebo prázdna: ${err.message}`); }

  // Show sample
  const showLimit = Math.min(15, ukonyRows.recordset.length);
  if (showLimit > 0) {
    // Map agt_code to Slovak names for display
    const agtNameMap = {
      'REG_AGT_RECRUITING': 'Naverbovanie',
      'REG_AGT_ASSISTANCE': 'Asistencia',
      'REG_AGT_COLLECTING_BLOOD': 'Odber PK',
      'REG_AGT_COLLECTING_TISSUE': 'Odber TK',
      'REG_AGT_COLLECTING_PLACENTA': 'Odber placenta',
      'REG_AGT_INFORMING': 'Informovanie',
      'REG_AGT_GRANT': 'Nórsky grant',
      'REG_AGT_PROPHYLAXIS': 'Profylaxia',
      'REG_AGT_NURSE_MANAGER': 'Vrchná sestra',
      'REG_AGT_LECTURE': 'Prednáška',
      'REG_AGT_VEDONO': 'Vedono',
    };
    table(
      ['doc_id', 'Typ dohody', 'Číslo zmluvy', 'Dátum', 'Číslo CBU', 'Odmena'],
      ukonyRows.recordset.slice(0, showLimit).map(r => {
        const typName = agtNameMap[r.agt_code] || r.typ_dohody || '—';
        const reward = rewardMap[`${r.sco_id}_${r.cag_id}`];
        return [
          r.doc_id,
          typName,
          (r.cislo_zmluvy || '—').slice(0, 25),
          r.datum_ukonu ? new Date(r.datum_ukonu).toLocaleDateString('sk') : '—',
          r.cislo_cbu || '—',
          reward ? `${reward.state || ''} ${reward.amount || ''} ${reward.currency || ''}`.trim() : '—',
        ];
      })
    );
  }

  // Aggregate type counts
  const typeCounts = {};
  for (const r of ukonyRows.recordset) {
    const typ = r.agt_code || 'UNKNOWN';
    typeCounts[typ] = (typeCounts[typ] || 0) + 1;
  }
  log(`  Rozdelenie podľa typu:`);
  for (const [code, cnt] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    log(`    ${code}: ${cnt}`);
  }

  // Insert into collaborator_activities
  let inserted = 0, skipped = 0, errors = 0;
  for (const row of ukonyRows.recordset) {
    try {
      const legacyId = `cc_${row.doc_id}_${row.sco_id}_${row.agt_id}`;
      const existing = await pgPool.query('SELECT id FROM collaborator_activities WHERE legacy_id = $1', [legacyId]);
      if (existing.rows.length > 0) { skipped++; continue; }

      const collaboratorId = collabLookup[String(row.doc_id)];
      if (!collaboratorId) { skipped++; continue; }

      const agreementId = row.cag_id ? (agreementLookup[String(row.cag_id)] || null) : null;
      const hospitalId = row.hos_id ? (hospitalLookup[String(row.hos_id)] || null) : null;
      const collectionId = row.sco_id ? (collectionLookup[String(row.sco_id)] || null) : null;

      const reward = rewardMap[`${row.sco_id}_${row.cag_id}`];

      // Map agt_code to Slovak activity name
      const agtNameMap = {
        'REG_AGT_RECRUITING': 'Naverbovanie',
        'REG_AGT_ASSISTANCE': 'Asistencia',
        'REG_AGT_COLLECTING_BLOOD': 'Odber PK',
        'REG_AGT_COLLECTING_TISSUE': 'Odber TK',
        'REG_AGT_COLLECTING_PLACENTA': 'Odber placenta',
        'REG_AGT_INFORMING': 'Informovanie',
        'REG_AGT_GRANT': 'Nórsky grant',
        'REG_AGT_PROPHYLAXIS': 'Profylaxia',
        'REG_AGT_NURSE_MANAGER': 'Vrchná sestra',
        'REG_AGT_LECTURE': 'Prednáška',
        'REG_AGT_VEDONO': 'Vedono',
      };
      const actName = agtNameMap[row.agt_code] || row.typ_dohody || row.agt_code || 'Neznámy';

      await pgPool.query(`
        INSERT INTO collaborator_activities (
          legacy_id, collaborator_id, agreement_id, hospital_id, collection_id,
          state, currency, amount, name, internal_note, public_note,
          due_date, due_date_type,
          proposed_at, proposed_by, approved_at, approved_by,
          paid_at, cancelled_at, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      `, [
        legacyId, collaboratorId, agreementId, hospitalId, collectionId,
        reward ? reward.state : null,
        reward ? reward.currency : null,
        reward ? reward.amount : null,
        actName,
        row.cislo_zmluvy || null,
        row.cislo_cbu || null,
        row.datum_ukonu ? new Date(row.datum_ukonu) : null,
        null,
        null, null, null, null,
        null, null,
        new Date(),
      ]);
      inserted++;
    } catch (err) {
      errors++;
      if (errors <= 5) log(`  ERROR doc=${row.doc_id} sco=${row.sco_id}: ${err.message}`);
    }
  }
  log(`\n  → ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);
}

// ============================================================
// STEP 5: Customers (TOP 20)
// ============================================================
async function step5_customers() {
  separator(`STEP 5: Klientky/Zákazníci (referencovaní z TOP ${LIMIT} odberov)`);

  const referencedCliIds = await mssqlPool.request().query(`
    SELECT DISTINCT c.cli_id FROM ContractServices cs
    JOIN Contracts c ON c.con_id = cs.con_id
    WHERE cs.sco_id IN (SELECT TOP ${LIMIT} sco_id FROM ServiceCollections ORDER BY sco_id DESC)
    AND c.cli_id IS NOT NULL
  `);
  const cliIdList = referencedCliIds.recordset.map(r => r.cli_id);
  log(`  Referencovaní klienti z odberov: ${cliIdList.length} unikátnych cli_id`);

  // Batch query to avoid MSSQL timeout on large IN clauses
  const BATCH_SIZE = 5000;
  const allClientRecords = [];
  for (let i = 0; i < cliIdList.length; i += BATCH_SIZE) {
    const batch = cliIdList.slice(i, i + BATCH_SIZE);
    log(`  Načítavam klientov batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(cliIdList.length/BATCH_SIZE)} (${batch.length} IDs)...`);
    const batchResult = await mssqlPool.request().query(`
      SELECT c.cli_id, c.com_id, c.cli_children, c.cli_mailinglist,
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
      WHERE c.cli_id IN (${batch.join(',')})
        AND (c.cli_deleted = 0 OR c.cli_deleted IS NULL)
      ORDER BY c.cli_id DESC
    `);
    allClientRecords.push(...batchResult.recordset);
  }
  const clients = { recordset: allClientRecords };
  log(`  Celkovo načítaných klientov: ${clients.recordset.length}`);

  const cliIds = clients.recordset.map(r => r.cli_id);
  const contractStatusMap = {};
  for (let i = 0; i < cliIds.length; i += BATCH_SIZE) {
    const batch = cliIds.slice(i, i + BATCH_SIZE);
    log(`  Načítavam kontrakty batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(cliIds.length/BATCH_SIZE)}...`);
    const batchResult = await mssqlPool.request().query(`
      SELECT con.cli_id, cs.csa_code
      FROM Contracts con
      JOIN ContractStatuses cs ON cs.csa_id = con.csa_id
      WHERE con.cli_id IN (${batch.join(',')})
    `);
    for (const r of batchResult.recordset) contractStatusMap[r.cli_id] = r.csa_code;
  }

  const showLimitCli = Math.min(10, clients.recordset.length);
  log(`Zdrojové dáta z CBC (prvých ${showLimitCli} z ${clients.recordset.length}):`);
  table(
    ['cli_id', 'Meno', 'Priezvisko', 'Mobil (RAW)', '→ Normalized', 'Email', 'Mesto', 'Krajina'],
    clients.recordset.slice(0, showLimitCli).map(r => [
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
          client_status, status, notes, lead_score, data_source, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)
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
        'iscbc', row.cli_inserted || new Date(),
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
    else if (code.includes('SECOND') || code.includes('DRUH')) collabMap[r.sco_id].secondNurse = String(r.doc_id);
    else if (code.includes('ASSIST') || code.includes('ASIST')) collabMap[r.sco_id].assistant = String(r.doc_id);
    else {
      if (!collabMap[r.sco_id]._unmatched) collabMap[r.sco_id]._unmatched = [];
      collabMap[r.sco_id]._unmatched.push(code);
    }
  }

  const collabStats = { blood: 0, tissue: 0, placenta: 0, assistant: 0, secondNurse: 0, unmatched: 0 };
  const unmatchedCodes = new Set();
  for (const scoId of Object.keys(collabMap)) {
    const cc = collabMap[scoId];
    if (cc.blood) collabStats.blood++;
    if (cc.tissue) collabStats.tissue++;
    if (cc.placenta) collabStats.placenta++;
    if (cc.assistant) collabStats.assistant++;
    if (cc.secondNurse) collabStats.secondNurse++;
    if (cc._unmatched) { collabStats.unmatched += cc._unmatched.length; cc._unmatched.forEach(c => unmatchedCodes.add(c)); }
  }
  log(`  Collaborator priradenia: blood=${collabStats.blood}, tissue=${collabStats.tissue}, placenta=${collabStats.placenta}, assistant=${collabStats.assistant}, secondNurse=${collabStats.secondNurse}`);
  if (unmatchedCodes.size > 0) log(`  ⚠ Nepriradené kódy: ${[...unmatchedCodes].join(', ')}`);

  const clientMap = {};
  const contractMap = {};
  const clientRows = await mssqlPool.request().query(`
    SELECT cs.sco_id, c.cli_id, c.con_id
    FROM ContractServices cs JOIN Contracts c ON c.con_id = cs.con_id WHERE cs.sco_id IS NOT NULL
  `);
  for (const r of clientRows.recordset) {
    clientMap[r.sco_id] = String(r.cli_id);
    contractMap[r.sco_id] = String(r.con_id);
  }

  const companyCountry = {};
  const compRows = await mssqlPool.request().query('SELECT com_id, com_country_code FROM Companies');
  for (const r of compRows.recordset) companyCountry[r.com_id] = normalizeCountryCode(r.com_country_code);

  const labLookup = {};
  const pgLabs = await pgPool.query('SELECT id, name FROM laboratories');
  for (const r of pgLabs.rows) labLookup[r.name] = r.id;

  const cbcLabNames = {};
  const cbcLabs = await mssqlPool.request().query('SELECT lab_id, lab_name FROM Laboratories');
  for (const r of cbcLabs.recordset) cbcLabNames[r.lab_id] = r.lab_name;

  const collections = await mssqlPool.request().query(`
    SELECT TOP ${LIMIT} sc.sco_id, sc.sco_collection_unit_number, sc.sco_collection_made,
      sc.sco_client_first_name, sc.sco_client_last_name, sc.sco_client_phone_number,
      sc.sco_client_mobile, sc.sco_client_email, sc.sco_client_birth_date, sc.sco_client_id_number,
      sc.sco_child_first_name, sc.sco_child_last_name, sc.sco_child_sex,
      sc.sco_state_detail, sc.sco_sterility, sc.sco_lab_evaluation, sc.sco_paired, sc.sco_evaluated,
      sc.sco_stored, sc.sco_transferred, sc.sco_released,
      sc.sco_waiting_for_dispose, sc.sco_disposed,
      sc.sco_doctors_note, sc.sco_note, sc.sco_responsible_coordinator, sc.sco_inserted, sc.sco_updated,
      sc.csu_id, sc.com_id, sc.hos_id,
      h.lab_id as hos_lab_id
    FROM ServiceCollections sc
    LEFT JOIN Hospitals h ON h.hos_id = sc.hos_id
    ORDER BY sc.sco_id DESC
  `);

  const showLimitSco = Math.min(10, collections.recordset.length);
  log(`Zdrojové dáta z CBC (prvých ${showLimitSco} z ${collections.recordset.length}):`);
  table(
    ['sco_id', 'CBU#', 'Klientka', 'Mobil (RAW)', '→ Normalized', 'Dieťa', 'Dátum', 'Status'],
    collections.recordset.slice(0, showLimitSco).map(r => [
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

      const cbcLabName = row.hos_lab_id ? cbcLabNames[row.hos_lab_id] : null;
      const labId = cbcLabName ? (labLookup[cbcLabName] || null) : null;
      const conId = contractMap[row.sco_id] || null;

      const collectionLegacyData = {
        sco_id: row.sco_id,
        sco_state_detail: row.sco_state_detail || null,
        sco_sterility: row.sco_sterility || null,
        sco_lab_evaluation: row.sco_lab_evaluation || null,
        sco_client_email: row.sco_client_email || null,
        sco_client_id_number: row.sco_client_id_number || null,
        csu_id: row.csu_id,
        com_id: row.com_id,
        hos_id: row.hos_id,
        hos_lab_id: row.hos_lab_id || null,
        collaborators: cc,
      };

      await pgPool.query(`
        INSERT INTO collections (
          legacy_id, cbu_number, country_code,
          customer_id, client_first_name, client_last_name,
          client_phone, client_mobile, client_birth_number,
          client_birth_day, client_birth_month, client_birth_year,
          child_first_name, child_last_name, child_gender,
          collection_date, hospital_id,
          cord_blood_collector_id, tissue_collector_id, placenta_collector_id, assistant_nurse_id,
          second_nurse_id,
          laboratory_id, contract_id, responsible_coordinator_id,
          status, state,
          status_paired_at, status_evaluated_at, status_verified_at,
          status_stored_at, status_transferred_at, status_released_at,
          status_awaiting_disposal_at, status_disposed_at,
          doctor_note, note, data_source, legacy_data, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41)
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
        collabLookup[cc.secondNurse] || null,
        labId, conId, row.sco_responsible_coordinator || null,
        cbcStatusRemap[row.csu_id] || row.csu_id, String(cbcStatusRemap[row.csu_id] || row.csu_id),
        row.sco_paired, row.sco_lab_evaluation, row.sco_sterility,
        row.sco_stored, row.sco_transferred, row.sco_released,
        row.sco_waiting_for_dispose, row.sco_disposed,
        row.sco_doctors_note, row.sco_note, 'iscbc',
        JSON.stringify(collectionLegacyData),
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
        const noteText = findField(fields, 'note') || null;
        const cbcCbu = findField(fields, 'cbu');
        const cbcProduct = findField(fields, 'product');
        const labstate = findField(fields, 'labstate');
        const datePorod = findField(fields, 'datum porodu');
        const casPorod = findField(fields, 'cas porodu');
        const sterilityDate = findField(fields, 'sterility');
        const evaluatedDate = findField(fields, 'evaluated');
        const certDate = findField(fields, 'certif v ec vytlaceny');

        await pgPool.query(`
          INSERT INTO collection_lab_results (
            collection_id, client_result_id,
            usability, sterility, sterility_type, result_of_sterility, result_of_sterility_bag_b,
            volume, volume_in_bag, tnc_count, max_weight,
            infection_agents, transplant_processing, transferred_to,
            umbilical_tissue, tissue_processed, tissue_sterility,
            tissue_usability, tissue_infection_agents, premium_status,
            bag_a_usability, bag_a_volume, bag_a_tnc,
            bag_b_usability, bag_b_volume, bag_b_tnc,
            first_name, surname, id_birth_number,
            cbu, processing, collection_for, status, final_analyses,
            date_of_collection, time_of_collection,
            lab_note
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)
        `, [
          collectionId, scoId,
          findField(fields, 'standard_pouzitelnost', 'usability', 'pouzitelnost'),
          findField(fields, 'sterilita vysledok', 'TP_sterilita_vysledok', 'sterilita'),
          findField(fields, 'sterility_type', 'typ_sterility'),
          findField(fields, 'sterilita vysledok', 'TP_sterilita_vysledok', 'result_of_sterility'),
          findField(fields, 'p_sterilita vysledok'),
          findField(fields, 'objem odobratej krvi', 'Standard_objem_odobratej_krvi', 'volume', 'objem'),
          findField(fields, 'objem plk', 'Objem PLK', 'volume_in_bag'),
          findField(fields, 'celkovy pocet zmraz bb_1x10e7', 'tnc', 'tnc_count'),
          findField(fields, 'max_weight', 'hmotnost'),
          findField(fields, 'infekcne agens', 'TP_infekcne_agens', 'infection_agents'),
          findField(fields, 'spracovanie transplantatu', 'transplant_processing'),
          findField(fields, 'transplantat_preradenyDo', 'transferred_to'),
          findField(fields, 'transplantat', 'umbilical_tissue'),
          findField(fields, 'tp', 'tissue_processed'),
          findField(fields, 'tissue_sterility', 'sterilita_tkaniva'),
          findField(fields, 'Premium_pouzitelnost', 'tissue_usability'),
          findField(fields, 'tissue_infection_agents'),
          findField(fields, 'Premium_stav', 'premium_status'),
          findField(fields, 'standard_bb', 'Standard_BB', 'kriterium na certifikat'),
          findField(fields, 'premium_objem_odobratej_krvi', 'bag_a_volume'),
          findField(fields, 'bag_a_tnc'),
          findField(fields, 'usability2', 'TP_pouzitelnost', 'bag_b_usability'),
          findField(fields, 'bag_b_volume'),
          findField(fields, 'bag_b_tnc'),
          findField(fields, 'meno matky', 'Meno matky', 'first_name'),
          findField(fields, 'priezvisko matky', 'Priezvisko matky', 'surname'),
          findField(fields, 'rodne cislo', 'id_birth_number'),
          cbcCbu,
          findField(fields, 'spracovaniexx', 'spracovanieXX', 'processing'),
          findField(fields, 'transplantat odobrany pre', 'collection_for'),
          labstate || findField(fields, 'Premium_stav', 'status'),
          findField(fields, 'transpl dovysetrovany', 'final_analyses'),
          datePorod ? new Date(datePorod) : null,
          casPorod,
          noteText,
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

  const fatherStatsResults = await batchMssqlQuery(migratedCustomerIds, `
    SELECT
      COUNT(*) as total,
      COUNT(pc.per_id_father) as with_father,
      COUNT(pc.pot_father_address_country_ft) as with_father_country
    FROM Contracts c
    JOIN PotentialClients pc ON pc.pot_id = c.pot_id
    WHERE c.cli_id IN (\${BATCH_IDS})
  `, 'FatherStats');
  const fs = { total: 0, with_father: 0, with_father_country: 0 };
  for (const r of fatherStatsResults) {
    fs.total += parseInt(r.total) || 0;
    fs.with_father += parseInt(r.with_father) || 0;
    fs.with_father_country += parseInt(r.with_father_country) || 0;
  }
  log(`  Štatistika: ${fs.total} contracts, ${fs.with_father} s otcom (per_id_father), ${fs.with_father_country} s krajinou otca`);

  const potDataRecords = await batchMssqlQuery(migratedCustomerIds, `
    SELECT
      c.cli_id, c.con_id, c.hos_id, c.doc_id,
      c.con_expected_collection_date, c.con_pregnancy_type,
      pc.pot_id, pc.per_id_father, pc.pot_father_address_country_ft,
      pc.pot_product_ft, pc.pot_marketproduct_ft, pc.pot_payment_type_ft,
      pc.pot_exp_birth_date, pc.pot_exp_hospital_ft, pc.pot_exp_doctor_ft,
      pc.pot_recruiting_ft, pc.pot_pregnancy_type, pc.pot_children,
      pc.pot_gift_card, pc.pot_previous_contracts,
      pc.pot_registration_type_ft, pc.pot_first_information_source_ft,
      pc.pot_cbc_reason_ft, pc.pot_marketing_action_ft, pc.pot_marketing_code_ft,
      pc.pot_mailinglist, pc.pot_note,
      pc.doc_id_exp, pc.doc_id_recruit, pc.hos_id AS pot_hos_id,
      pc.cos_id,
      pc.per_id AS pot_per_id_mother
    FROM Contracts c
    JOIN PotentialClients pc ON pc.pot_id = c.pot_id
    WHERE c.cli_id IN (\${BATCH_IDS})
      AND c.pot_id IS NOT NULL
    ORDER BY c.con_id DESC
  `, 'PotData');
  const potData = { recordset: potDataRecords };

  const fatherPerIds = potData.recordset
    .filter(r => r.per_id_father)
    .map(r => r.per_id_father);

  const fatherData = {};
  if (fatherPerIds.length > 0) {
    const fatherRows = await batchMssqlQuery(fatherPerIds, `
      SELECT pd.per_id, pd.pda_first_name as per_first_name, pd.pda_last_name as per_last_name,
             pd.pda_title_prefix as per_title,
             pd.pda_phone_number as per_phone_number, pd.pda_mobile as per_mobile, pd.pda_email as per_email,
             ma.add_street_and_number as add_street, ma.add_city, ma.add_zip, ma.add_country
      FROM PersonalData pd
      LEFT JOIN MailAddresses ma ON ma.per_id = pd.per_id AND ma.add_valid = 1
      WHERE pd.per_id IN (\${BATCH_IDS})
    `, 'FatherData');
    for (const r of fatherRows) {
      fatherData[r.per_id] = r;
    }
  }

  const childFatherData = {};
  try {
    const cfRows = await batchMssqlQuery(migratedCustomerIds, `
      SELECT cf.* FROM ChildFather cf
      JOIN Contracts c ON c.con_id = cf.con_id
      WHERE c.cli_id IN (\${BATCH_IDS})
    `, 'ChildFather');
    for (const r of cfRows) {
      childFatherData[r.con_id] = r;
    }
  } catch (e) {
    log(`  WARN: ChildFather tabuľka: ${e.message}`);
  }

  const gynDocIds = potData.recordset.filter(r => r.doc_id_exp).map(r => r.doc_id_exp);
  const gynData = {};
  if (gynDocIds.length > 0) {
    const gynRows = await batchMssqlQuery(gynDocIds, `
      SELECT d.doc_id,
             pd.pda_first_name, pd.pda_last_name, pd.pda_title_prefix,
             pd.pda_mobile, pd.pda_phone_number, pd.pda_email
      FROM Collaborators d
      JOIN Persons p ON p.per_id = d.per_id
      LEFT JOIN PersonalData pd ON pd.per_id = p.per_id AND pd.pda_valid = 1
      WHERE d.doc_id IN (\${BATCH_IDS})
    `, 'GynData');
    for (const r of gynRows) {
      gynData[r.doc_id] = r;
    }
  }
  log(`  Gynekológovia nájdení: ${Object.keys(gynData).length} z ${gynDocIds.length} doc_id_exp`);

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
      const fatherCountry = normalizeCountryCode(row.pot_father_address_country_ft || (f.add_country ? f.add_country : null));

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

      const contactDate = row.con_expected_collection_date || row.pot_exp_birth_date;
      let ctDay = null, ctMonth = null, ctYear = null;
      if (contactDate) {
        const cd = new Date(contactDate);
        if (!isNaN(cd.getTime())) {
          ctDay = cd.getDate(); ctMonth = cd.getMonth() + 1; ctYear = cd.getFullYear();
        }
      }

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
          contact_date_day, contact_date_month, contact_date_year,
          existing_contracts, recruiting,
          sales_channel, info_source, marketing_action, marketing_code,
          newsletter_opt_in, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
      `, [
        customerId,
        expDay, expMonth, expYear,
        hospitalLookup[String(row.pot_hos_id || row.hos_id)] || null,
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
        ctDay, ctMonth, ctYear,
        row.pot_previous_contracts || null,
        row.pot_recruiting_ft || null,
        row.pot_registration_type_ft || null,
        row.pot_first_information_source_ft || null,
        row.pot_marketing_action_ft || null,
        row.pot_marketing_code_ft || null,
        row.pot_mailinglist === true || row.pot_mailinglist === 1,
        row.pot_note || null,
      ]);

      const gyn = gynData[row.doc_id_exp] || {};
      const gynName = gyn.pda_first_name || gyn.pda_last_name
        ? [gyn.pda_title_prefix, gyn.pda_first_name, gyn.pda_last_name].filter(Boolean).join(' ')
        : (row.pot_exp_doctor_ft || null);
      const gynPhone = normalizePhone(gyn.pda_mobile || gyn.pda_phone_number, 'SK') || null;
      const gynEmail = normalizeEmail(gyn.pda_email) || null;
      const expDateTs = expDate ? new Date(expDate) : null;
      const hospitalName = row.pot_exp_hospital_ft || null;

      if (gynName || gynPhone || gynEmail || expDateTs || hospitalName) {
        await pgPool.query(`
          UPDATE customers SET
            gynecologist_name = COALESCE($2, gynecologist_name),
            gynecologist_phone = COALESCE($3, gynecologist_phone),
            gynecologist_email = COALESCE($4, gynecologist_email),
            expected_delivery_date = COALESCE($5, expected_delivery_date),
            hospital_name = COALESCE($6, hospital_name)
          WHERE id = $1
        `, [customerId, gynName, gynPhone, gynEmail, expDateTs, hospitalName]);
      }

      inserted++;
    } catch (err) {
      errors++;
      log(`  ERROR cli_id=${row.cli_id}: ${err.message}`);
    }
  }
  log(`\n  Cases: ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);
}

// ============================================================
// STEP 8: Remarks → customer_notes
// ============================================================
async function step8_remarks() {
  separator('STEP 8: Remarks (poznámky) → customer_notes');

  await pgPool.query(`ALTER TABLE customer_notes ADD COLUMN IF NOT EXISTS legacy_id VARCHAR`);
  await pgPool.query(`ALTER TABLE customer_notes ADD COLUMN IF NOT EXISTS contract_id VARCHAR`);
  await pgPool.query(`ALTER TABLE customer_notes ADD COLUMN IF NOT EXISTS data_source TEXT`);

  const migratedCustomers = await pgPool.query(`
    SELECT id, internal_id FROM customers WHERE internal_id IS NOT NULL AND internal_id != ''
  `);
  if (migratedCustomers.rows.length === 0) {
    log('  Žiadni migrovaní klienti — preskakujem.');
    return;
  }
  const customerMap = {};
  for (const c of migratedCustomers.rows) {
    customerMap[c.internal_id] = c.id;
  }
  const cliIdKeys = Object.keys(customerMap);

  const contractToCustomer = {};
  const contractRows = await batchMssqlQuery(cliIdKeys, `
    SELECT con_id, cli_id FROM Contracts WHERE cli_id IN (\${BATCH_IDS})
  `, 'Contracts→Remarks');
  for (const c of contractRows) {
    contractToCustomer[String(c.con_id)] = customerMap[String(c.cli_id)];
  }

  const conIdKeys = Object.keys(contractToCustomer);
  const remarkRecords = [];
  const cliRemarks = await batchMssqlQuery(cliIdKeys, `
    SELECT rem_id, cli_id, con_id, rem_date, rem_login, rem_note
    FROM Remarks
    WHERE cli_id IN (\${BATCH_IDS})
      AND (rem_deleted = 0 OR rem_deleted IS NULL)
      AND rem_note IS NOT NULL AND LTRIM(RTRIM(rem_note)) != ''
  `, 'Remarks(cli)');
  remarkRecords.push(...cliRemarks);
  if (conIdKeys.length > 0) {
    const conRemarks = await batchMssqlQuery(conIdKeys, `
      SELECT rem_id, cli_id, con_id, rem_date, rem_login, rem_note
      FROM Remarks
      WHERE con_id IN (\${BATCH_IDS}) AND cli_id IS NULL
        AND (rem_deleted = 0 OR rem_deleted IS NULL)
        AND rem_note IS NOT NULL AND LTRIM(RTRIM(rem_note)) != ''
    `, 'Remarks(con)');
    remarkRecords.push(...conRemarks);
  }
  const totalRemarks = remarkRecords.length;
  log(`  Nájdených ${totalRemarks} poznámok pre ${migratedCustomers.rows.length} klientov`);

  const existingLegacyIds = new Set();
  const existingRes = await pgPool.query(`SELECT legacy_id FROM customer_notes WHERE legacy_id IS NOT NULL AND data_source = 'iscbc'`);
  for (const r of existingRes.rows) existingLegacyIds.add(r.legacy_id);
  log(`  Existujúcich poznámok: ${existingLegacyIds.size}`);

  let inserted = 0, skipped = 0, errors = 0;
  const BATCH_PG = 500;
  for (let bi = 0; bi < totalRemarks; bi += BATCH_PG) {
    const batch = remarkRecords.slice(bi, bi + BATCH_PG);
    const values = [];
    const params = [];
    let pi = 1;
    for (const r of batch) {
      let customerId = null;
      if (r.cli_id) customerId = customerMap[String(r.cli_id)];
      if (!customerId && r.con_id) customerId = contractToCustomer[String(r.con_id)];
      if (!customerId) { skipped++; continue; }
      if (existingLegacyIds.has(String(r.rem_id))) { skipped++; continue; }
      const contractInternalId = r.con_id ? `contract_${r.con_id}` : null;
      values.push(`(gen_random_uuid(), $${pi}, $${pi+1}, $${pi+2}, $${pi+3}, $${pi+4}, 'iscbc', $${pi+5})`);
      params.push(customerId, r.rem_login || 'system', r.rem_note, String(r.rem_id), contractInternalId, r.rem_date || new Date());
      pi += 6;
    }
    if (values.length > 0) {
      try {
        await pgPool.query(`
          INSERT INTO customer_notes (id, customer_id, user_id, content, legacy_id, contract_id, data_source, created_at)
          VALUES ${values.join(', ')}
          ON CONFLICT DO NOTHING
        `, params);
        inserted += values.length;
      } catch (err) {
        errors += values.length;
        if (errors <= 3 * BATCH_PG) log(`  ERROR batch ${Math.floor(bi/BATCH_PG)}: ${err.message}`);
      }
    }
    if ((bi % 50000) === 0 && bi > 0) log(`  Remarks progress: ${bi}/${totalRemarks} (${inserted} vložených)`);
  }
  log(`  Remarks: ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);

  const sampleNotes = await pgPool.query(`
    SELECT cn.legacy_id, cn.user_id, cn.content, cn.created_at, cu.internal_id
    FROM customer_notes cn
    JOIN customers cu ON cu.id = cn.customer_id
    WHERE cn.legacy_id IS NOT NULL
    ORDER BY cn.created_at DESC LIMIT 5
  `);
  if (sampleNotes.rows.length > 0) {
    table(
      ['RemID', 'KlientID', 'Autor', 'Dátum', 'Poznámka'],
      sampleNotes.rows.map(r => [
        r.legacy_id, r.internal_id, r.user_id,
        r.created_at ? new Date(r.created_at).toISOString().substring(0, 16) : '—',
        r.content ? (r.content.length > 60 ? r.content.substring(0, 60) + '…' : r.content) : '—',
      ])
    );
  }
}

// ============================================================
// STEP 9: PhoneCommunications → communication_messages
// ============================================================
async function step9_phoneCommunications() {
  separator('STEP 9: PhoneCommunications (telefonáty) → communication_messages');

  await pgPool.query(`ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS contract_id VARCHAR`);

  const migratedCustomers = await pgPool.query(`
    SELECT id, internal_id FROM customers WHERE internal_id IS NOT NULL AND internal_id != ''
  `);
  if (migratedCustomers.rows.length === 0) {
    log('  Žiadni migrovaní klienti — preskakujem.');
    return;
  }
  const customerMap = {};
  for (const c of migratedCustomers.rows) {
    customerMap[c.internal_id] = c.id;
  }
  const cliIdKeysP = Object.keys(customerMap);

  const contractToCustomer = {};
  const contractRowsP = await batchMssqlQuery(cliIdKeysP, `
    SELECT con_id, cli_id FROM Contracts WHERE cli_id IN (\${BATCH_IDS})
  `, 'Contracts→Phones');
  for (const c of contractRowsP) {
    contractToCustomer[String(c.con_id)] = customerMap[String(c.cli_id)];
  }

  let phoneResultMap = {};
  try {
    const phoneResults = await mssqlPool.request().query(`SELECT phr_id, phr_code, phr_default_name FROM PhoneCallResults`);
    for (const r of phoneResults.recordset) {
      phoneResultMap[String(r.phr_id)] = r.phr_default_name || r.phr_code || '';
    }
  } catch (e) { log(`  WARN: PhoneCallResults: ${e.message}`); }

  const conIdKeysP = Object.keys(contractToCustomer);
  const phoneRecords = [];
  const cliPhones = await batchMssqlQuery(cliIdKeysP, `
    SELECT pho_id, pot_id, con_id, cli_id, phr_id,
           pho_call_date, pho_caller, pho_number, pho_note
    FROM PhoneCommunications
    WHERE cli_id IN (\${BATCH_IDS})
      AND (pho_deleted = 0 OR pho_deleted IS NULL)
  `, 'Phones(cli)');
  phoneRecords.push(...cliPhones);
  if (conIdKeysP.length > 0) {
    const conPhones = await batchMssqlQuery(conIdKeysP, `
      SELECT pho_id, pot_id, con_id, cli_id, phr_id,
             pho_call_date, pho_caller, pho_number, pho_note
      FROM PhoneCommunications
      WHERE con_id IN (\${BATCH_IDS}) AND cli_id IS NULL
        AND (pho_deleted = 0 OR pho_deleted IS NULL)
    `, 'Phones(con)');
    phoneRecords.push(...conPhones);
  }
  const totalPhones = phoneRecords.length;
  log(`  Nájdených ${totalPhones} hovorov pre ${migratedCustomers.rows.length} klientov`);

  const existingExtIds = new Set();
  const existingPh = await pgPool.query(`SELECT external_id FROM communication_messages WHERE provider = 'cbc_legacy'`);
  for (const r of existingPh.rows) existingExtIds.add(r.external_id);
  log(`  Existujúcich hovorov: ${existingExtIds.size}`);

  let inserted = 0, skipped = 0, errors = 0;
  const BATCH_PG_PH = 500;
  for (let bi = 0; bi < totalPhones; bi += BATCH_PG_PH) {
    const batch = phoneRecords.slice(bi, bi + BATCH_PG_PH);
    const values = [];
    const params = [];
    let pi = 1;
    for (const p of batch) {
      let customerId = null;
      if (p.cli_id) customerId = customerMap[String(p.cli_id)];
      if (!customerId && p.con_id) customerId = contractToCustomer[String(p.con_id)];
      if (!customerId) { skipped++; continue; }
      const extId = 'cbc_pho_' + p.pho_id;
      if (existingExtIds.has(extId)) { skipped++; continue; }
      const callResult = p.phr_id ? (phoneResultMap[String(p.phr_id)] || '') : '';
      const noteText = [p.pho_note, callResult ? `[Výsledok: ${callResult}]` : ''].filter(Boolean).join(' ');
      const phoneContractInternalId = p.con_id ? `contract_${p.con_id}` : null;
      values.push(`(gen_random_uuid(), $${pi}, $${pi+1}, 'phone', 'outbound', $${pi+2}, $${pi+3}, 'delivered', $${pi+4}, 'cbc_legacy', $${pi+5}, $${pi+6}, $${pi+7})`);
      params.push(
        customerId, p.pho_caller || 'system', noteText || '(bez poznámky)',
        p.pho_number || null, extId, phoneContractInternalId,
        p.pho_call_date || new Date(), p.pho_call_date || new Date()
      );
      pi += 8;
    }
    if (values.length > 0) {
      try {
        await pgPool.query(`
          INSERT INTO communication_messages (
            id, customer_id, user_id, type, direction, content,
            recipient_phone, status, external_id, provider, contract_id, sent_at, created_at
          ) VALUES ${values.join(', ')}
          ON CONFLICT DO NOTHING
        `, params);
        inserted += values.length;
      } catch (err) {
        errors += values.length;
        if (errors <= 3 * BATCH_PG_PH) log(`  ERROR batch ${Math.floor(bi/BATCH_PG_PH)}: ${err.message}`);
      }
    }
    if ((bi % 50000) === 0 && bi > 0) log(`  Phones progress: ${bi}/${totalPhones} (${inserted} vložených)`);
  }
  log(`  PhoneCommunications: ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);

  const samplePhones = await pgPool.query(`
    SELECT cm.external_id, cm.user_id, cm.recipient_phone, cm.content, cm.sent_at, cu.internal_id
    FROM communication_messages cm
    JOIN customers cu ON cu.id = cm.customer_id
    WHERE cm.provider = 'cbc_legacy'
    ORDER BY cm.sent_at DESC LIMIT 5
  `);
  if (samplePhones.rows.length > 0) {
    table(
      ['PhoID', 'KlientID', 'Volajúci', 'Číslo', 'Dátum', 'Poznámka'],
      samplePhones.rows.map(r => [
        r.external_id, r.internal_id, r.user_id, r.recipient_phone || '—',
        r.sent_at ? new Date(r.sent_at).toISOString().substring(0, 16) : '—',
        r.content ? (r.content.length > 50 ? r.content.substring(0, 50) + '…' : r.content) : '—',
      ])
    );
  }
}

// ============================================================
// STEP 10: Verification — Detail comparison
// ============================================================
// ============================================================
// STEP 11: Contracts from CBC → contract_instances + customer_documents
// Maps CBC Contracts to INDEXUS contract_instances module with full field coverage
// Also creates a reference record in customer_documents for Documents tab display
// ============================================================
async function step11_customerContracts() {
  separator('STEP 11: Zmluvy klientov (Contracts → contract_instances + customer_documents)');

  const migratedCustomers = await pgPool.query(
    `SELECT id, internal_id FROM customers WHERE internal_id IS NOT NULL`
  );
  if (migratedCustomers.rows.length === 0) { log('Žiadni migrovaní klienti.'); return; }

  const customerMap = {};
  for (const c of migratedCustomers.rows) customerMap[c.internal_id] = c.id;
  const cliIdKeysC = Object.keys(customerMap);

  // Ensure contract_instances table has required columns
  try {
    await pgPool.query(`ALTER TABLE contract_instances ADD COLUMN IF NOT EXISTS internal_id varchar(100)`);
    await pgPool.query(`ALTER TABLE contract_instances ADD COLUMN IF NOT EXISTS data_source text`);
    await pgPool.query(`ALTER TABLE contract_instances ADD COLUMN IF NOT EXISTS legacy_data jsonb`);
    await pgPool.query(`ALTER TABLE contract_instances ADD COLUMN IF NOT EXISTS company_name text`);
    await pgPool.query(`ALTER TABLE contract_instances ADD COLUMN IF NOT EXISTS pregnancy_type text`);
    log('  ✓ contract_instances stĺpce overené/doplnené');
  } catch (err) { log(`  WARN ensure columns: ${err.message}`); }

  log(`\n--- Diagnostika CBC: Contracts stĺpce ---`);
  try {
    const conColsRes = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Contracts' ORDER BY ORDINAL_POSITION
    `);
    log('  Contracts ALL: ' + conColsRes.recordset.map(r => r.COLUMN_NAME).join(', '));
  } catch (err) { log(`  WARN: ${err.message}`); }

  log(`\n--- Diagnostika CBC: ContractStatuses ---`);
  try {
    const csRes = await mssqlPool.request().query(`SELECT csa_id, csa_code FROM ContractStatuses ORDER BY csa_id`);
    table(['csa_id', 'csa_code'], csRes.recordset.map(r => [r.csa_id, r.csa_code]));
  } catch (err) { log(`  WARN: ${err.message}`); }

  const companyMap = {};
  const companyInfoMap = {};
  try {
    const compResRecords = await batchMssqlQuery(cliIdKeysC, `
      SELECT cl.cli_id, comp.*
      FROM Clients cl
      JOIN Companies comp ON comp.com_id = cl.com_id
      WHERE cl.cli_id IN (\${BATCH_IDS}) AND cl.com_id IS NOT NULL
    `, 'CompanyMap');
    const compRes = { recordset: compResRecords };
    for (const r of compRes.recordset) {
      companyMap[String(r.cli_id)] = r.com_name;
      const allFields = {};
      for (const [k, v] of Object.entries(r)) {
        if (k !== 'cli_id') allFields[k] = v;
      }
      companyInfoMap[String(r.cli_id)] = allFields;
    }
    log(`  Company mapa: ${Object.keys(companyMap).length} klientov s firmou`);
    if (compRes.recordset.length > 0) {
      log(`  Vzorka Company: ${JSON.stringify(compRes.recordset[0])}`);
    }
  } catch (err) { log(`  WARN company map: ${err.message}`); }

  const companyDetailsMap = {};
  try {
    const cdRes = await mssqlPool.request().query(`SELECT * FROM CompanyDetails`);
    for (const r of cdRes.recordset) {
      const comId = r.com_id || r.cod_com_id;
      if (comId) companyDetailsMap[String(comId)] = r;
    }
    log(`  CompanyDetails: ${Object.keys(companyDetailsMap).length} záznamov`);
    if (cdRes.recordset.length > 0) {
      log(`  CompanyDetails stĺpce: ${Object.keys(cdRes.recordset[0]).join(', ')}`);
      log(`  CompanyDetails vzorka: ${JSON.stringify(cdRes.recordset[0])}`);
    }
  } catch (err) { log(`  WARN CompanyDetails: ${err.message}`); }

  const companyAccountsMap = {};
  try {
    const caRes = await mssqlPool.request().query(`SELECT * FROM CompanyAccounts`);
    for (const r of caRes.recordset) {
      const comId = r.com_id;
      if (comId) {
        if (!companyAccountsMap[String(comId)]) companyAccountsMap[String(comId)] = [];
        companyAccountsMap[String(comId)].push(r);
      }
    }
    log(`  CompanyAccounts: ${Object.keys(companyAccountsMap).length} firiem s účtami`);
    if (caRes.recordset.length > 0) {
      log(`  CompanyAccounts stĺpce: ${Object.keys(caRes.recordset[0]).join(', ')}`);
      log(`  CompanyAccounts vzorka: ${JSON.stringify(caRes.recordset[0])}`);
    }
  } catch (err) { log(`  WARN CompanyAccounts: ${err.message}`); }

  const vatRatesMap = {};
  try {
    const vatRes = await mssqlPool.request().query(`SELECT * FROM VATs ORDER BY vat_id`);
    for (const r of vatRes.recordset) {
      vatRatesMap[String(r.vat_id)] = r;
    }
    log(`  VATs: ${Object.keys(vatRatesMap).length} sadzby DPH`);
    if (vatRes.recordset.length > 0) {
      log(`  VATs vzorka: ${JSON.stringify(vatRes.recordset.slice(0, 5))}`);
    }
  } catch (err) { log(`  WARN VATs: ${err.message}`); }

  const hospitalLookupRes = await pgPool.query(`SELECT id, legacy_id FROM hospitals WHERE legacy_id IS NOT NULL`);
  const hospitalLookup = {};
  for (const h of hospitalLookupRes.rows) hospitalLookup[h.legacy_id] = h.id;

  const collabLookupRes = await pgPool.query(`SELECT id, legacy_id FROM collaborators WHERE legacy_id IS NOT NULL`);
  const collabLookup = {};
  for (const c of collabLookupRes.rows) collabLookup[c.legacy_id] = c.id;

  const contractRecords = await batchMssqlQuery(cliIdKeysC, `
    SELECT c.con_id, c.cli_id, c.con_number, c.con_inserted,
           c.con_expected_collection_date, c.con_pregnancy_type,
           c.hos_id, c.doc_id, c.pot_id, c.cte_id,
           c.con_note,
           c.con_contacted, c.con_filled, c.con_generated, c.con_sent,
           c.con_confirmed, c.con_returned, c.con_validated, c.con_realized,
           c.con_terminated, c.con_cancelled,
           c.con_gift_card, c.con_indicated,
           c.con_collection_kit_number, c.con_collection_kit_sent, c.con_collection_kit_expired,
           c.con_invoicing_postponed, c.con_invoices_by_email, c.con_invoices_by_letter,
           c.con_saving_bank, c.con_refinancing_detail, c.rfo_id,
           c.con_repository,
           cs.csa_code,
           ct.cte_name, ct.cte_template_number,
           mpi.mpi_name,
           mp.mpr_name,
           pc.pot_product_ft, pc.pot_marketproduct_ft, pc.pot_payment_type_ft,
           pc.pot_registration_type_ft, pc.pot_first_information_source_ft,
           pc.pot_marketing_action_ft, pc.pot_marketing_code_ft,
           pc.pot_gift_card AS pot_gift_card, pc.pot_recruiting_ft,
           pc.pot_exp_hospital_ft, pc.pot_exp_doctor_ft,
           pc.pot_exp_birth_date, pc.pot_children
    FROM Contracts c
    LEFT JOIN ContractStatuses cs ON cs.csa_id = c.csa_id
    LEFT JOIN PotentialClients pc ON pc.pot_id = c.pot_id
    LEFT JOIN ContractTemplates ct ON ct.cte_id = c.cte_id
    LEFT JOIN MarketProductInstances mpi ON mpi.mpi_id = ct.mpi_id
    LEFT JOIN MarketProducts mp ON mp.mpr_id = mpi.mpr_id
    WHERE c.cli_id IN (\${BATCH_IDS})
    ORDER BY c.con_id
  `, 'Contracts');
  const contracts = { recordset: contractRecords };
  log(`  Nájdených ${contracts.recordset.length} zmlúv pre ${migratedCustomers.rows.length} klientov`);

  if (contracts.recordset.length > 0) {
    table(
      ['con_id', 'cli_id', 'con_number', 'Stav', 'Firma', 'Oč. dátum', 'Produkt', 'Tehotenstvo'],
      contracts.recordset.slice(0, 10).map(r => [
        r.con_id, r.cli_id, r.con_number || '-', r.csa_code || '-',
        companyMap[String(r.cli_id)] || '-',
        r.con_expected_collection_date ? new Date(r.con_expected_collection_date).toLocaleDateString('sk') : '-',
        r.pot_product_ft || r.pot_marketproduct_ft || '-',
        r.con_pregnancy_type || '-'
      ])
    );
  }

  const mapCbcStatusToIndexus = (csaCode) => {
    if (!csaCode) return 'draft';
    const code = csaCode.toUpperCase();
    const map = {
      'REG_CSA_NEW': 'draft',
      'REG_CSA_FILLED': 'draft',
      'REG_CSA_GENERATED': 'draft',
      'REG_CSA_SENT_PACKAGE': 'sent',
      'REG_CSA_CONFIRMED_RECEPTION': 'pending_signature',
      'REG_CSA_RETURNED': 'pending_signature',
      'REG_CSA_VALIDATED': 'signed',
      'REG_CSA_REALIZED': 'completed',
      'REG_CSA_CANCELLED': 'cancelled',
      'REG_CSA_TERMINATED': 'cancelled',
      'REG_CSA_MOVED': 'completed',
    };
    return map[code] || 'draft';
  };

  // --- Preload Prepayments (zálohy ku zmluvám) ---
  const allConIds = contracts.recordset.map(r => r.con_id);
  const prepaymentsByConId = {}; // con_id → prepayments[]
  try {
    if (allConIds.length > 0) {
      const preCols = await mssqlPool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Prepayments' ORDER BY ORDINAL_POSITION
      `);
      if (preCols.recordset.length > 0) {
        log(`  Prepayments stĺpce: ${preCols.recordset.map(r => r.COLUMN_NAME).join(', ')}`);
        const preResRecords = await batchMssqlQuery(allConIds, `
          SELECT * FROM Prepayments WHERE con_id IN (\${BATCH_IDS}) ORDER BY con_id, pre_id
        `, 'Prepayments');
        log(`  Prepayments: ${preResRecords.length} záznamov`);
        for (const p of preResRecords) {
          const key = String(p.con_id);
          if (!prepaymentsByConId[key]) prepaymentsByConId[key] = [];
          prepaymentsByConId[key].push(p);
        }
        if (preResRecords.length > 0) {
          log(`  Vzorka Prepayment: ${JSON.stringify(preResRecords[0])}`);
        }
      } else {
        log('  Prepayments tabuľka neexistuje');
      }
    }
  } catch (err) { log(`  WARN Prepayments: ${err.message}`); }

  // --- Preload ContractServicePayments (platby za služby) ---
  const cspByConId = {}; // con_id → service payments[]
  try {
    if (allConIds.length > 0) {
      const cspCols = await mssqlPool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ContractServicePayments' ORDER BY ORDINAL_POSITION
      `);
      if (cspCols.recordset.length > 0) {
        log(`  ContractServicePayments stĺpce: ${cspCols.recordset.map(r => r.COLUMN_NAME).join(', ')}`);
        const cseResRecords = await batchMssqlQuery(allConIds, `
          SELECT cse_id, con_id FROM ContractServices WHERE con_id IN (\${BATCH_IDS})
        `, 'ContractServices');
        const cseToConMap = {};
        const cseIds = [];
        for (const cs of cseResRecords) {
          cseToConMap[String(cs.cse_id)] = String(cs.con_id);
          cseIds.push(cs.cse_id);
        }
        log(`  ContractServices pre zmluvy: ${cseIds.length} záznamov`);

        if (cseIds.length > 0) {
          const cspResRecords = await batchMssqlQuery(cseIds, `
            SELECT csp.*, plp.plp_name, plp.plp_invoice_item, plp.plp_price AS plp_list_price,
                   plp.plp_accounting_code
            FROM ContractServicePayments csp
            LEFT JOIN PriceListPayments plp ON plp.plp_id = csp.plp_id
            WHERE csp.cse_id IN (\${BATCH_IDS})
            ORDER BY csp.cse_id, csp.csp_id
          `, 'CSP');
          const cspRes = { recordset: cspResRecords };
          log(`  ContractServicePayments: ${cspRes.recordset.length} záznamov`);
          for (const csp of cspRes.recordset) {
            const conId = cseToConMap[String(csp.cse_id)];
            if (conId) {
              if (!cspByConId[conId]) cspByConId[conId] = [];
              cspByConId[conId].push(csp);
            }
          }
          if (cspRes.recordset.length > 0) {
            log(`  ContractServicePayments kľúče: ${Object.keys(cspRes.recordset[0]).join(', ')}`);
            log(`  Vzorka ContractServicePayment: ${JSON.stringify(cspRes.recordset[0])}`);
          }
        }
      } else {
        log('  ContractServicePayments tabuľka neexistuje');
      }
    }
  } catch (err) { log(`  WARN ContractServicePayments: ${err.message}`); }

  // --- Preload HistoryContractServicePayments (história zmien platieb) ---
  const hcspByConId = {}; // con_id → history[]
  try {
    // Gather all csp_ids from loaded CSPs
    const allCspIds = [];
    for (const csps of Object.values(cspByConId)) {
      for (const csp of csps) allCspIds.push(csp.csp_id);
    }
    if (allCspIds.length > 0) {
      const hResRecords = await batchMssqlQuery(allCspIds, `
        SELECT * FROM HistoryContractServicePayments
        WHERE csp_id IN (\${BATCH_IDS})
        ORDER BY csp_id, hsp_id
      `, 'HistoryCSP');
      const hRes = { recordset: hResRecords };
      log(`  HistoryContractServicePayments: ${hRes.recordset.length} záznamov`);
      // Map hsp → con_id via csp_id
      const cspToConMap = {};
      for (const [conId, csps] of Object.entries(cspByConId)) {
        for (const csp of csps) cspToConMap[String(csp.csp_id)] = conId;
      }
      for (const h of hRes.recordset) {
        const conId = cspToConMap[String(h.csp_id)];
        if (conId) {
          if (!hcspByConId[conId]) hcspByConId[conId] = [];
          hcspByConId[conId].push(h);
        }
      }
      if (hRes.recordset.length > 0) {
        log(`  HistoryCSP kľúče: ${Object.keys(hRes.recordset[0]).join(', ')}`);
        log(`  Vzorka HistoryCSP: ${JSON.stringify(hRes.recordset[0])}`);
      }
    }
  } catch (err) { log(`  WARN HistoryCSP: ${err.message}`); }

  // --- Preload ContractStatusHistory (história stavov zmluvy) ---
  const contractHistoryByConId = {};
  try {
    if (allConIds.length > 0) {
      let histTable = null;
      try {
        const hcCols = await mssqlPool.request().query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HistoryContracts' ORDER BY ORDINAL_POSITION
        `);
        if (hcCols.recordset.length > 0) {
          log(`  HistoryContracts stĺpce: ${hcCols.recordset.map(r => r.COLUMN_NAME).join(', ')}`);
          histTable = 'HistoryContracts';
        }
      } catch (e) { /* table may not exist */ }

      if (!histTable) {
        try {
          const hcsCols = await mssqlPool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HistoryContractStatuses' ORDER BY ORDINAL_POSITION
          `);
          if (hcsCols.recordset.length > 0) {
            log(`  HistoryContractStatuses stĺpce: ${hcsCols.recordset.map(r => r.COLUMN_NAME).join(', ')}`);
            histTable = 'HistoryContractStatuses';
          }
        } catch (e) { /* table may not exist */ }
      }

      if (histTable) {
        const hcResRecords = await batchMssqlQuery(allConIds, `
          SELECT * FROM ${histTable} WHERE con_id IN (\${BATCH_IDS}) ORDER BY con_id
        `, histTable);
        const hcRes = { recordset: hcResRecords };
        log(`  ContractStatusHistory: ${hcRes.recordset.length} záznamov`);
        for (const h of hcRes.recordset) {
          const key = String(h.con_id);
          if (!contractHistoryByConId[key]) contractHistoryByConId[key] = [];
          contractHistoryByConId[key].push(h);
        }
        if (hcRes.recordset.length > 0) {
          log(`  ContractHistory kľúče: ${Object.keys(hcRes.recordset[0]).join(', ')}`);
          log(`  Vzorka ContractHistory: ${JSON.stringify(hcRes.recordset[0])}`);
        }
      } else {
        log('  HistoryContracts/HistoryContractStatuses tabuľka neexistuje — stavová história bude z dátumov zmluvy');
      }
    }
  } catch (err) { log(`  WARN ContractHistory: ${err.message}`); }

  // --- Preload ContractServices (služby pod zmluvou) with Service/ServiceInstance/Company details ---
  const contractServicesByConId = {};
  try {
    if (allConIds.length > 0) {
      const csResRecords = await batchMssqlQuery(allConIds, `
        SELECT cs.cse_id, cs.con_id, cs.sin_id, cs.sco_id,
               cs.cse_original_price, cs.cse_actual_price, cs.cse_active,
               cs.cse_invoicing_finished, cs.cse_note,
               cs.cse_inserted, cs.cse_inserted_by,
               si.sin_name, si.sin_invoice_identifier,
               ser.ser_id, ser.ser_name, ser.ser_is_invoicable, ser.ser_is_collectable, ser.ser_is_storable,
               comp.com_name AS ser_company
        FROM ContractServices cs
        LEFT JOIN ServiceInstances si ON si.sin_id = cs.sin_id
        LEFT JOIN Services ser ON ser.ser_id = si.ser_id
        LEFT JOIN Companies comp ON comp.com_id = ser.com_id
        WHERE cs.con_id IN (\${BATCH_IDS})
        ORDER BY cs.con_id, cs.cse_id
      `, 'ContractServices');
      const csRes = { recordset: csResRecords };
      log(`  ContractServices: ${csRes.recordset.length} záznamov`);
      for (const s of csRes.recordset) {
        const key = String(s.con_id);
        if (!contractServicesByConId[key]) contractServicesByConId[key] = [];
        contractServicesByConId[key].push(s);
      }
      if (csRes.recordset.length > 0) {
        log(`  Vzorka ContractService: ${JSON.stringify(csRes.recordset[0])}`);
      }
    }
  } catch (err) { log(`  WARN ContractServices: ${err.message}`); }

  // --- Preload HistoryContractServices (cenová história služieb) ---
  const histServicesByConId = {};
  try {
    const allCseIds = [];
    for (const svcs of Object.values(contractServicesByConId)) {
      for (const s of svcs) allCseIds.push(s.cse_id);
    }
    if (allCseIds.length > 0) {
      const hsResRecords = await batchMssqlQuery(allCseIds, `
        SELECT * FROM HistoryContractServices
        WHERE cse_id IN (\${BATCH_IDS})
        ORDER BY cse_id, hcs_from
      `, 'HistoryContractServices');
      const hsRes = { recordset: hsResRecords };
      log(`  HistoryContractServices: ${hsRes.recordset.length} záznamov`);
      const cseToConMap = {};
      for (const [conId, svcs] of Object.entries(contractServicesByConId)) {
        for (const s of svcs) cseToConMap[String(s.cse_id)] = conId;
      }
      for (const h of hsRes.recordset) {
        const conId = cseToConMap[String(h.cse_id)];
        if (conId) {
          if (!histServicesByConId[conId]) histServicesByConId[conId] = [];
          histServicesByConId[conId].push(h);
        }
      }
    }
  } catch (err) { log(`  WARN HistoryContractServices: ${err.message}`); }

  // --- Preload ContractServiceSurcharges (zľavy/príplatky) ---
  const surchargesByConId = {};
  try {
    const allCseIds = [];
    for (const svcs of Object.values(contractServicesByConId)) {
      for (const s of svcs) allCseIds.push(s.cse_id);
    }
    if (allCseIds.length > 0) {
      const surResRecords = await batchMssqlQuery(allCseIds, `
        SELECT css.css_id, css.cse_id, css.pls_id,
               css.css_original_price, css.css_actual_price,
               pls.pls_name, pls.pls_invoice_item_name,
               pls.pls_surcharge_fixed, pls.pls_surcharge_percentage
        FROM ContractServiceSurcharges css
        LEFT JOIN PriceListSurcharges pls ON pls.pls_id = css.pls_id
        WHERE css.cse_id IN (\${BATCH_IDS})
        ORDER BY css.cse_id, css.css_id
      `, 'Surcharges');
      const surRes = { recordset: surResRecords };
      log(`  ContractServiceSurcharges: ${surRes.recordset.length} záznamov`);
      const cseToConMap = {};
      for (const [conId, svcs] of Object.entries(contractServicesByConId)) {
        for (const s of svcs) cseToConMap[String(s.cse_id)] = conId;
      }
      for (const s of surRes.recordset) {
        const conId = cseToConMap[String(s.cse_id)];
        if (conId) {
          if (!surchargesByConId[conId]) surchargesByConId[conId] = [];
          surchargesByConId[conId].push(s);
        }
      }
    }
  } catch (err) { log(`  WARN ContractServiceSurcharges: ${err.message}`); }

  // --- Preload HistoryContractServiceSurcharges ---
  const histSurchargesByConId = {};
  try {
    const allCssIds = [];
    for (const surs of Object.values(surchargesByConId)) {
      for (const s of surs) allCssIds.push(s.css_id);
    }
    if (allCssIds.length > 0) {
      const hssResRecords = await batchMssqlQuery(allCssIds, `
        SELECT * FROM HistoryContractServiceSurcharges
        WHERE css_id IN (\${BATCH_IDS})
        ORDER BY css_id, hss_from
      `, 'HistorySurcharges');
      const hssRes = { recordset: hssResRecords };
      log(`  HistoryContractServiceSurcharges: ${hssRes.recordset.length} záznamov`);
      const cssToConMap = {};
      for (const [conId, surs] of Object.entries(surchargesByConId)) {
        for (const s of surs) cssToConMap[String(s.css_id)] = conId;
      }
      for (const h of hssRes.recordset) {
        const conId = cssToConMap[String(h.css_id)];
        if (conId) {
          if (!histSurchargesByConId[conId]) histSurchargesByConId[conId] = [];
          histSurchargesByConId[conId].push(h);
        }
      }
    }
  } catch (err) { log(`  WARN HistorySurcharges: ${err.message}`); }

  // --- Preload ContractServiceSchedules + SchedulePayments (splátky) ---
  const schedulesByConId = {};
  try {
    const allCseIds = [];
    for (const svcs of Object.values(contractServicesByConId)) {
      for (const s of svcs) allCseIds.push(s.cse_id);
    }
    // ContractServiceSchedules links via hcs_id to HistoryContractServices.hcs_id which has cse_id
    // But simpler: link via the cse_id lookup from HistoryContractServices
    if (allCseIds.length > 0) {
      // First get all hcs_ids for our cse_ids
      const hcsResRec = await batchMssqlQuery(allCseIds, `
        SELECT hcs_id, cse_id FROM HistoryContractServices WHERE cse_id IN (\${BATCH_IDS})
      `, 'HCS→Schedules');
      const hcsRes = { recordset: hcsResRec };
      const hcsToConMap = {};
      const hcsToCseMap = {};
      const cseToConMap = {};
      for (const [conId, svcs] of Object.entries(contractServicesByConId)) {
        for (const s of svcs) cseToConMap[String(s.cse_id)] = conId;
      }
      const allHcsIds = [];
      for (const h of hcsRes.recordset) {
        hcsToConMap[String(h.hcs_id)] = cseToConMap[String(h.cse_id)];
        hcsToCseMap[String(h.hcs_id)] = String(h.cse_id);
        allHcsIds.push(h.hcs_id);
      }

      if (allHcsIds.length > 0) {
        const schResRecords = await batchMssqlQuery(allHcsIds, `
          SELECT csh.csh_id, csh.sch_id, csh.hcs_id, csh.csh_name, csh.csh_preliminary_schedule,
                 csh.csh_inserted, csh.csh_inserted_by
          FROM ContractServiceSchedules csh
          WHERE csh.hcs_id IN (\${BATCH_IDS})
          ORDER BY csh.csh_id
        `, 'Schedules');
        const schRes = { recordset: schResRecords };
        log(`  ContractServiceSchedules: ${schRes.recordset.length} záznamov`);

        const cshIds = schRes.recordset.map(r => r.csh_id);
        let schedulePayments = [];
        if (cshIds.length > 0) {
          const spResRecords = await batchMssqlQuery(cshIds, `
            SELECT * FROM ContractServiceSchedulePayments
            WHERE csh_id IN (\${BATCH_IDS})
            ORDER BY csh_id, csy_installments_id
          `, 'SchedulePayments');
          const spRes = { recordset: spResRecords };
          schedulePayments = spRes.recordset;
          log(`  ContractServiceSchedulePayments: ${schedulePayments.length} záznamov`);
        }

        const paymentsByCshId = {};
        for (const sp of schedulePayments) {
          const key = String(sp.csh_id);
          if (!paymentsByCshId[key]) paymentsByCshId[key] = [];
          paymentsByCshId[key].push(sp);
        }

        for (const sch of schRes.recordset) {
          const conId = hcsToConMap[String(sch.hcs_id)];
          if (conId) {
            if (!schedulesByConId[conId]) schedulesByConId[conId] = [];
            schedulesByConId[conId].push({
              ...sch,
              cse_id: hcsToCseMap[String(sch.hcs_id)] || null,
              payments: paymentsByCshId[String(sch.csh_id)] || [],
            });
          }
        }
      }
    }
  } catch (err) { log(`  WARN Schedules: ${err.message}`); }

  log(`  Mapy zmluvy: prepayments=${Object.keys(prepaymentsByConId).length} zmlúv, servicePayments=${Object.keys(cspByConId).length} zmlúv, historyCSP=${Object.keys(hcspByConId).length} zmlúv, history=${Object.keys(contractHistoryByConId).length} zmlúv, services=${Object.keys(contractServicesByConId).length} zmlúv, surcharges=${Object.keys(surchargesByConId).length} zmlúv, schedules=${Object.keys(schedulesByConId).length} zmlúv`);

  // Build customer lookup map for scheduled invoices (name + address + email + phone)
  const customerNameLookup = {};
  const customerDetailLookup = {};
  try {
    const cnRes = await pgPool.query(`SELECT id, first_name, last_name, address, city, postal_code, country, email, phone, mobile FROM customers WHERE internal_id IS NOT NULL`);
    for (const c of cnRes.rows) {
      customerNameLookup[c.id] = `${c.first_name || ''} ${c.last_name || ''}`.trim();
      customerDetailLookup[c.id] = {
        address: c.address || null,
        city: c.city || null,
        zip: c.postal_code || null,
        country: c.country || null,
        email: c.email || null,
        phone: c.phone || c.mobile || null,
      };
    }
    log(`  Customer name lookup: ${Object.keys(customerNameLookup).length} záznamov`);
    log(`  Customer detail lookup: ${Object.keys(customerDetailLookup).length} záznamov`);
  } catch (err) { log(`  WARN customer name lookup: ${err.message}`); }

  // Build cse_id → invoice item label + accounting code maps from CBC InvoiceItems
  const invoiceItemLabelByCseId = {};
  const accountingCodeByCseId = {};
  const invoiceItemLabelByConId = {};
  const accountingCodeByConId = {};
  try {
    const itemLabelResRecords = await batchMssqlQuery(allConIds, `
      SELECT DISTINCT cs.con_id, cs.cse_id, iit.iit_label, iit.iit_item_accounting_code
      FROM ContractServices cs
      JOIN Invoices i ON i.cse_id = cs.cse_id
      JOIN InvoiceItems iit ON iit.inv_id = i.inv_id
      WHERE cs.con_id IN (\${BATCH_IDS}) AND iit.iit_label IS NOT NULL AND iit.iit_label != ''
      ORDER BY cs.con_id
    `, 'InvoiceItemLabels');
    const itemLabelRes = { recordset: itemLabelResRecords };
    for (const r of itemLabelRes.recordset) {
      const cseKey = String(r.cse_id);
      const conKey = String(r.con_id);
      if (!invoiceItemLabelByCseId[cseKey]) invoiceItemLabelByCseId[cseKey] = r.iit_label;
      if (!accountingCodeByCseId[cseKey] && r.iit_item_accounting_code) accountingCodeByCseId[cseKey] = r.iit_item_accounting_code;
      if (!invoiceItemLabelByConId[conKey]) invoiceItemLabelByConId[conKey] = r.iit_label;
      if (!accountingCodeByConId[conKey] && r.iit_item_accounting_code) accountingCodeByConId[conKey] = r.iit_item_accounting_code;
    }
    log(`  Invoice item labels: ${Object.keys(invoiceItemLabelByConId).length} zmlúv, ${Object.keys(invoiceItemLabelByCseId).length} služieb`);
    log(`  Accounting codes: ${Object.keys(accountingCodeByConId).length} zmlúv, ${Object.keys(accountingCodeByCseId).length} služieb`);
    const acSample = Object.entries(accountingCodeByCseId).slice(0, 5);
    if (acSample.length > 0) log(`  Vzorky AC (per-service): ${acSample.map(([k,v]) => `cse_id=${k}: "${v}"`).join(', ')}`);
  } catch (err) { log(`  WARN invoice item labels: ${err.message}`); }

  // Build currency map from CBC Invoices (cur_code_home per cse_id and con_id)
  const currencyByCseId = {};
  const currencyByConId = {};
  try {
    const curResRecords = await batchMssqlQuery(allConIds, `
      SELECT DISTINCT cs.con_id, cs.cse_id, i.cur_code_home
      FROM ContractServices cs
      JOIN Invoices i ON i.cse_id = cs.cse_id
      WHERE cs.con_id IN (\${BATCH_IDS}) AND i.cur_code_home IS NOT NULL AND i.cur_code_home != ''
    `, 'Currency');
    const curRes = { recordset: curResRecords };
    for (const r of curRes.recordset) {
      if (!currencyByCseId[String(r.cse_id)]) currencyByCseId[String(r.cse_id)] = r.cur_code_home;
      if (!currencyByConId[String(r.con_id)]) currencyByConId[String(r.con_id)] = r.cur_code_home;
    }
    log(`  Currency map: ${Object.keys(currencyByConId).length} zmlúv, ${Object.keys(currencyByCseId).length} služieb`);
    const curSample = Object.entries(currencyByConId).slice(0, 5);
    if (curSample.length > 0) log(`  Vzorky mien: ${curSample.map(([k,v]) => `con_id=${k}: "${v}"`).join(', ')}`);
  } catch (err) { log(`  WARN currency map: ${err.message}`); }

  let insertedCI = 0, insertedCD = 0, skipped = 0, errors = 0;
  for (const r of contracts.recordset) {
    const customerId = customerMap[String(r.cli_id)];
    if (!customerId) { skipped++; continue; }

    const legacyId = `contract_${r.con_id}`;
    const existingCI = await pgPool.query(`SELECT id FROM contract_instances WHERE internal_id = $1`, [legacyId]);
    if (existingCI.rows.length > 0) { skipped++; continue; }

    try {
      const contractNumber = r.con_number || `ISCBC-${r.con_id}`;
      const indexusStatus = mapCbcStatusToIndexus(r.csa_code);
      const expDate = r.con_expected_collection_date || r.pot_exp_birth_date || null;
      const pregnancyType = r.con_pregnancy_type || null;
      const isMultiple = pregnancyType && parseInt(pregnancyType) > 1;
      const hospitalIdPg = hospitalLookup[String(r.hos_id)] || null;
      const gynName = r.pot_exp_doctor_ft || null;

      const legacyData = {
        con_id: r.con_id, cli_id: r.cli_id, csa_code: r.csa_code,
        hos_id: r.hos_id, doc_id: r.doc_id, pot_id: r.pot_id,
        cte_id: r.cte_id,
        cte_name: r.cte_name, cte_template_number: r.cte_template_number,
        mpi_name: r.mpi_name,
        mpr_name: r.mpr_name,
        pot_product_ft: r.pot_product_ft, pot_marketproduct_ft: r.pot_marketproduct_ft,
        pot_payment_type_ft: r.pot_payment_type_ft, pot_children: r.pot_children,
        pot_recruiting_ft: r.pot_recruiting_ft,
        con_repository: r.con_repository,
        con_invoicing_postponed: r.con_invoicing_postponed,
        con_invoices_by_email: r.con_invoices_by_email,
        con_invoices_by_letter: r.con_invoices_by_letter,
        con_saving_bank: r.con_saving_bank,
        con_refinancing_detail: r.con_refinancing_detail,
        rfo_id: r.rfo_id,
        con_collection_kit_expired: r.con_collection_kit_expired,
        prepayments: prepaymentsByConId[String(r.con_id)] || [],
        servicePayments: cspByConId[String(r.con_id)] || [],
        servicePaymentHistory: hcspByConId[String(r.con_id)] || [],
        contractHistory: contractHistoryByConId[String(r.con_id)] || [],
        contractServices: contractServicesByConId[String(r.con_id)] || [],
        serviceHistory: histServicesByConId[String(r.con_id)] || [],
        surcharges: surchargesByConId[String(r.con_id)] || [],
        surchargeHistory: histSurchargesByConId[String(r.con_id)] || [],
        schedules: schedulesByConId[String(r.con_id)] || [],
      };

      const ciResult = await pgPool.query(`
        INSERT INTO contract_instances (
          id, contract_number, template_id, customer_id, billing_details_id,
          status, internal_id, data_source, legacy_data,
          company_name, pregnancy_type,
          expected_delivery_date, hospital_id, obstetrician,
          multiple_pregnancy,
          sales_channel, info_source, marketing_action, marketing_code,
          gift_voucher, client_note,
          initial_product_id,
          indicated_contract,
          contact_date, filled_date, created_contract_date, sent_contract_date,
          received_by_client_date, returned_date, verified_date, executed_date,
          terminated_date, cancelled_at,
          collection_kit_sent_date,
          refinancing,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, 'iscbc_legacy', $2, 'iscbc_legacy',
          $3, $4, 'iscbc', $5,
          $6, $7,
          $8, $9, $10,
          $11,
          $12, $13, $14, $15,
          $16, $17,
          $18,
          $19,
          $20, $21, $22, $23,
          $24, $25, $26, $27,
          $28, $29,
          $30,
          $31,
          $32, $32
        ) RETURNING id
      `, [
        contractNumber,                                           // $1
        customerId,                                               // $2
        indexusStatus,                                            // $3
        legacyId,                                                 // $4
        JSON.stringify(legacyData),                               // $5
        companyMap[String(r.cli_id)] || null,                     // $6
        pregnancyType,                                            // $7
        expDate,                                                  // $8
        hospitalIdPg,                                             // $9
        gynName,                                                  // $10
        isMultiple || false,                                      // $11
        r.pot_registration_type_ft || null,                       // $12 sales_channel
        r.pot_first_information_source_ft || null,                // $13 info_source
        r.pot_marketing_action_ft || null,                        // $14 marketing_action
        r.pot_marketing_code_ft || null,                          // $15 marketing_code
        r.con_gift_card || r.pot_gift_card || null,               // $16 gift_voucher
        r.con_note || null,                                       // $17 client_note
        r.pot_product_ft || r.pot_marketproduct_ft || null,       // $18 initial_product_id
        r.con_indicated || false,                                 // $19 indicated_contract
        r.con_contacted || null,                                  // $20 contact_date
        r.con_filled || null,                                     // $21 filled_date
        r.con_generated || null,                                  // $22 created_contract_date
        r.con_sent || null,                                       // $23 sent_contract_date
        r.con_confirmed || null,                                  // $24 received_by_client_date
        r.con_returned || null,                                   // $25 returned_date
        r.con_validated || null,                                  // $26 verified_date
        r.con_realized || null,                                   // $27 executed_date
        r.con_terminated || null,                                 // $28 terminated_date
        r.con_cancelled || null,                                  // $29 cancelled_at
        r.con_collection_kit_sent || null,                        // $30 collection_kit_sent_date
        r.con_saving_bank || r.con_refinancing_detail || null,    // $31 refinancing
        r.con_inserted || new Date(),                             // $32 created_at
      ]);
      insertedCI++;

      const contractInstanceId = ciResult.rows[0].id;
      try {
        await pgPool.query(`
          INSERT INTO customer_documents (id, legacy_id, customer_id, document_type, data_source,
            contract_number, contract_status, company_name, expected_collection_date, note, legacy_data, created_at)
          VALUES (gen_random_uuid(), $1, $2, 'contract', 'iscbc', $3, $4, $5, $6, $7, $8, $9)
        `, [
          legacyId,
          customerId,
          contractNumber,
          r.csa_code || null,
          companyMap[String(r.cli_id)] || null,
          expDate,
          r.con_note || null,
          JSON.stringify({ con_id: r.con_id, contract_instance_id: contractInstanceId }),
          r.con_inserted || new Date(),
        ]);
        insertedCD++;
      } catch (cdErr) {
        log(`  WARN customer_documents con_id=${r.con_id}: ${cdErr.message}`);
      }

      // NOTE: scheduled_invoices are now created in step12 from actual invoice ScheduledPayments (not from ContractServiceSchedulePayments templates)
    } catch (err) {
      errors++;
      if (errors <= 5) log(`  ERROR con_id=${r.con_id}: ${err.message}`);
    }
  }
  log(`  contract_instances: ${insertedCI} vložených`);
  log(`  customer_documents: ${insertedCD} vložených (odkazy)`);
  log(`  scheduled_invoices: teraz v step12 (z ScheduledPayments)`);
  log(`  Preskočených: ${skipped}, Chýb: ${errors}`);
}

// ============================================================
// STEP 12: Customer Documents — Invoices (Faktúry) from CBC
// Chain: Invoices.cse_id → ContractServices.con_id → Contracts.cli_id
// Also links to contract_instances via con_id for contract reference
// ============================================================
async function step12_customerInvoices() {
  separator('STEP 12: Faktúry klientov (Invoices → customer_documents)');

  // Ensure new columns exist
  try {
    await pgPool.query(`ALTER TABLE customer_documents ADD COLUMN IF NOT EXISTS variable_symbol text`);
    await pgPool.query(`ALTER TABLE customer_documents ADD COLUMN IF NOT EXISTS amount_no_vat text`);
    await pgPool.query(`ALTER TABLE customer_documents ADD COLUMN IF NOT EXISTS paid_amount text`);
    await pgPool.query(`ALTER TABLE customer_documents ADD COLUMN IF NOT EXISTS fully_paid boolean`);
    await pgPool.query(`ALTER TABLE customer_documents ADD COLUMN IF NOT EXISTS contract_instance_id varchar`);
    log('  ✓ customer_documents stĺpce overené/doplnené');

    await pgPool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS data_source text`);
    await pgPool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS legacy_data jsonb`);
    await pgPool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contract_instance_id varchar`);
    await pgPool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS note text`);
    log('  ✓ invoices stĺpce overené/doplnené');
  } catch (err) { log(`  WARN ensure columns: ${err.message}`); }

  const migratedCustomers = await pgPool.query(
    `SELECT id, internal_id FROM customers WHERE internal_id IS NOT NULL`
  );
  if (migratedCustomers.rows.length === 0) { log('Žiadni migrovaní klienti.'); return; }

  const customerMap = {};
  for (const c of migratedCustomers.rows) customerMap[c.internal_id] = c.id;
  const cliIdKeysInv = Object.keys(customerMap);

  const customerNameLookup = {};
  try {
    const cnRes = await pgPool.query(`SELECT id, first_name, last_name FROM customers WHERE internal_id IS NOT NULL`);
    for (const c of cnRes.rows) {
      customerNameLookup[c.id] = `${c.first_name || ''} ${c.last_name || ''}`.trim();
    }
    log(`  Customer name lookup (invoices): ${Object.keys(customerNameLookup).length} záznamov`);
  } catch (err) { log(`  WARN customer name lookup: ${err.message}`); }

  const conIdsForInvoices = await batchMssqlQuery(cliIdKeysInv, `
    SELECT DISTINCT con_id FROM Contracts WHERE cli_id IN (\${BATCH_IDS})
  `, 'ConIDs for invoices');
  const conIdListInv = conIdsForInvoices.map(r => r.con_id);
  log(`  ConIDs pre faktúry: ${conIdListInv.length}`);

  const accountingCodeByCseId = {};
  const accountingCodeByConId = {};
  try {
    const acResRecords = await batchMssqlQuery(conIdListInv, `
      SELECT DISTINCT cs.con_id, cs.cse_id, iit.iit_item_accounting_code
      FROM ContractServices cs
      JOIN Invoices i ON i.cse_id = cs.cse_id
      JOIN InvoiceItems iit ON iit.inv_id = i.inv_id
      WHERE cs.con_id IN (\${BATCH_IDS}) AND iit.iit_item_accounting_code IS NOT NULL AND iit.iit_item_accounting_code != ''
    `, 'AccountingCodes');
    const acRes = { recordset: acResRecords };
    for (const r of acRes.recordset) {
      if (!accountingCodeByCseId[String(r.cse_id)]) accountingCodeByCseId[String(r.cse_id)] = r.iit_item_accounting_code;
      if (!accountingCodeByConId[String(r.con_id)]) accountingCodeByConId[String(r.con_id)] = r.iit_item_accounting_code;
    }
    log(`  Accounting codes (invoices): ${Object.keys(accountingCodeByCseId).length} služieb, ${Object.keys(accountingCodeByConId).length} zmlúv`);
  } catch (err) { log(`  WARN accounting codes lookup: ${err.message}`); }

  // --- Diagnostika: Invoices stĺpce ---
  try {
    const invCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Invoices' ORDER BY ORDINAL_POSITION
    `);
    log(`\n--- Diagnostika CBC: Invoices stĺpce ---`);
    log(`  Invoices ALL: ${invCols.recordset.map(r => r.COLUMN_NAME).join(', ')}`);
  } catch (err) { log(`  WARN Invoices columns: ${err.message}`); }

  // Build ContractServices → Contract chain (cse_id → cli_id + con_id)
  let cseToClient = {};
  let cseToConId = {};
  try {
    const cseCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ContractServices' ORDER BY ORDINAL_POSITION
    `);
    log(`  ContractServices stĺpce: ${cseCols.recordset.map(r => r.COLUMN_NAME).join(', ')}`);

    const cseResRecords = await batchMssqlQuery(cliIdKeysInv, `
      SELECT cs.cse_id, c.cli_id, c.con_id, c.con_number
      FROM ContractServices cs
      JOIN Contracts c ON c.con_id = cs.con_id
      WHERE c.cli_id IN (\${BATCH_IDS})
    `, 'CSE→Client');
    for (const r of cseResRecords) {
      cseToClient[String(r.cse_id)] = String(r.cli_id);
      cseToConId[String(r.cse_id)] = String(r.con_id);
    }
    log(`  ContractServices → Client mapa: ${Object.keys(cseToClient).length} záznamov`);
  } catch (err) {
    log(`  WARN ContractServices: ${err.message}`);
    try {
      const conResFallback = await batchMssqlQuery(cliIdKeysInv, `SELECT con_id, cli_id FROM Contracts WHERE cli_id IN (\${BATCH_IDS})`, 'ConFallback');
      for (const c of conResFallback) cseToClient[`con_${c.con_id}`] = String(c.cli_id);
      log(`  Fallback: contract map with ${Object.keys(cseToClient).length} entries`);
    } catch (err2) { log(`  WARN contract map: ${err2.message}`); }
  }

  // Build contract_instances lookup: CBC con_id → INDEXUS contract_instances.id
  const contractInstanceLookup = {};
  try {
    const ciRes = await pgPool.query(`SELECT id, internal_id FROM contract_instances WHERE internal_id IS NOT NULL AND data_source = 'iscbc'`);
    for (const r of ciRes.rows) contractInstanceLookup[r.internal_id] = r.id;
    log(`  contract_instances lookup: ${Object.keys(contractInstanceLookup).length} záznamov`);
  } catch (err) { log(`  WARN contract_instances lookup: ${err.message}`); }

  // Load InvoiceStatuses + map to normalized values
  const invoiceStatusRaw = {};
  const INVOICE_STATUS_MAP = {
    'REG_IST_NEW': 'new',
    'REG_IST_FILLED': 'filled',
    'REG_IST_INDUE': 'in_due',
    'REG_IST_SENT': 'sent',
    'REG_IST_PAID': 'paid',
    'REG_IST_PARTIALLY_PAID': 'partially_paid',
    'REG_IST_OVERDUE': 'overdue',
    'REG_IST_STORNO': 'cancelled',
    'REG_IST_CANCELLED': 'cancelled',
    'REG_IST_CREDIT_NOTE': 'credit_note',
  };
  try {
    const istRes = await mssqlPool.request().query(`SELECT * FROM InvoiceStatuses`);
    log(`\n--- Diagnostika CBC: InvoiceStatuses ---`);
    for (const r of istRes.recordset) {
      const code = r.ist_code || String(r.ist_id);
      invoiceStatusRaw[r.ist_id] = code;
      log(`  ist_id=${r.ist_id}: ${code} → ${INVOICE_STATUS_MAP[code] || code}`);
    }
    log(`  InvoiceStatuses: ${Object.keys(invoiceStatusRaw).length} statusov`);
  } catch (err) { log(`  WARN InvoiceStatuses: ${err.message}`); }

  // Load InvoiceTypes + map to normalized values
  const invoiceTypeRaw = {};
  const INVOICE_TYPE_MAP = {
    'REG_ITY_INVOICE': 'REG_ITY_INVOICE',
    'REG_ITY_CREDIT_NOTE': 'REG_ITY_CREDIT_NOTE',
    'REG_ITY_PROFORMA': 'REG_ITY_PROFORMA',
    'REG_ITY_ADVANCE': 'REG_ITY_ADVANCE',
    'REG_ITY_DEBIT_NOTE': 'REG_ITY_DEBIT_NOTE',
  };
  try {
    const ityRes = await mssqlPool.request().query(`SELECT * FROM InvoiceTypes`);
    log(`\n--- Diagnostika CBC: InvoiceTypes ---`);
    for (const r of ityRes.recordset) {
      const code = r.ity_code || String(r.ity_id);
      invoiceTypeRaw[r.ity_id] = code;
      log(`  ity_id=${r.ity_id}: ${code} → ${INVOICE_TYPE_MAP[code] || code}`);
    }
    log(`  InvoiceTypes: ${Object.keys(invoiceTypeRaw).length} typov`);
  } catch (err) { log(`  WARN InvoiceTypes: ${err.message}`); }

  // Build Company info map: cli_id → full billing company info (via Clients.com_id → Companies)
  const companyMap = {};
  const companyInfoMap = {};
  try {
    const compResRecords = await batchMssqlQuery(cliIdKeysInv, `
      SELECT DISTINCT cl.cli_id, comp.*
      FROM Clients cl
      JOIN Companies comp ON comp.com_id = cl.com_id
      WHERE cl.cli_id IN (\${BATCH_IDS}) AND cl.com_id IS NOT NULL
    `, 'CompanyMap(inv)');
    const compRes = { recordset: compResRecords };
    for (const r of compRes.recordset) {
      companyMap[String(r.cli_id)] = r.com_name;
      const allFields = {};
      for (const [k, v] of Object.entries(r)) {
        if (k !== 'cli_id') allFields[k] = v;
      }
      companyInfoMap[String(r.cli_id)] = allFields;
    }
    log(`  Company mapa: ${Object.keys(companyMap).length} klientov s firmou`);
    if (compRes.recordset.length > 0) {
      log(`  Vzorka Company: ${JSON.stringify(compRes.recordset[0])}`);
    }
  } catch (err) { log(`  WARN company map: ${err.message}`); }

  const companyDetailsMap = {};
  try {
    const cdRes = await mssqlPool.request().query(`SELECT * FROM CompanyDetails`);
    for (const r of cdRes.recordset) {
      const comId = r.com_id || r.cod_com_id;
      if (comId) companyDetailsMap[String(comId)] = r;
    }
    log(`  CompanyDetails: ${Object.keys(companyDetailsMap).length} záznamov`);
  } catch (err) { log(`  WARN CompanyDetails: ${err.message}`); }

  const companyAccountsMap = {};
  try {
    const caRes = await mssqlPool.request().query(`SELECT * FROM CompanyAccounts`);
    for (const r of caRes.recordset) {
      const comId = r.com_id;
      if (comId) {
        if (!companyAccountsMap[String(comId)]) companyAccountsMap[String(comId)] = [];
        companyAccountsMap[String(comId)].push(r);
      }
    }
    log(`  CompanyAccounts: ${Object.keys(companyAccountsMap).length} firiem s účtami`);
  } catch (err) { log(`  WARN CompanyAccounts: ${err.message}`); }

  const vatRatesMap = {};
  try {
    const vatRes = await mssqlPool.request().query(`SELECT * FROM VATs ORDER BY vat_id`);
    for (const r of vatRes.recordset) {
      vatRatesMap[String(r.vat_id)] = r;
    }
    log(`  VATs: ${Object.keys(vatRatesMap).length} sadzby DPH`);
  } catch (err) { log(`  WARN VATs: ${err.message}`); }

  // Query invoices with all available fields
  // Actual CBC columns: inv_id, ity_id, cur_code_home, cur_code_account, ist_id, cse_id,
  //   inv_invoice_number, inv_variable_symbol, inv_specific_symbol, inv_constant_symbol,
  //   inv_date_of_delivery, inv_date_of_issue, inv_dispatch_date, inv_date_of_payment,
  //   inv_amount_cur_home_no_vat, inv_amount_cur_account_no_vat,
  //   inv_amount_cur_home_with_vat, inv_amount_cur_account_with_vat,
  //   inv_paid_cur_home, inv_paid_cur_account, inv_prepaid_cur_home, inv_prepaid_cur_account,
  //   inv_exchange_rate, inv_fully_paid, inv_note, inv_writeoff,
  //   inv_inserted, inv_inserted_by, inv_updated, inv_updated_by,
  //   inv_period_from, inv_period_to, inv_emailed, inv_bsp_note
  // Pre-fetch cse_ids for invoice lookup
  const cseIdsForInvoices = await batchMssqlQuery(conIdListInv, `
    SELECT cse_id FROM ContractServices WHERE con_id IN (\${BATCH_IDS})
  `, 'CSE for invoices');
  const cseIdListInv = cseIdsForInvoices.map(r => r.cse_id);
  log(`  CSE IDs pre faktúry: ${cseIdListInv.length}`);

  let invoices;
  try {
    const invRecords = await batchMssqlQuery(cseIdListInv, `
      SELECT i.inv_id, i.cse_id, i.ist_id, i.ity_id,
             i.inv_invoice_number, i.inv_variable_symbol, i.inv_specific_symbol, i.inv_constant_symbol,
             i.inv_date_of_issue, i.inv_date_of_delivery, i.inv_date_of_payment, i.inv_dispatch_date,
             i.inv_amount_cur_home_with_vat, i.inv_amount_cur_home_no_vat,
             i.inv_amount_cur_account_with_vat, i.inv_amount_cur_account_no_vat,
             i.inv_paid_cur_home, i.inv_paid_cur_account,
             i.inv_prepaid_cur_home, i.inv_prepaid_cur_account,
             i.inv_exchange_rate, i.cur_code_home, i.cur_code_account,
             i.inv_fully_paid, i.inv_note, i.inv_writeoff,
             i.inv_inserted, i.inv_inserted_by, i.inv_updated, i.inv_updated_by,
             i.inv_period_from, i.inv_period_to, i.inv_emailed, i.inv_bsp_note,
             i.inv_id_credit_note_to, i.inv_id_proforma_link,
             i.add_id_company, i.add_id_invoice,
             ac.add_name AS billing_addr_name, ac.add_street_and_number AS billing_addr_street,
             ac.add_city AS billing_addr_city, ac.add_zip AS billing_addr_zip,
             ac.add_country AS billing_addr_country, ac.add_area AS billing_addr_area
      FROM Invoices i
      LEFT JOIN MailAddresses ac ON ac.add_id = i.add_id_company
      WHERE i.cse_id IN (\${BATCH_IDS})
      ORDER BY i.inv_id
    `, 'Invoices');
    invoices = { recordset: invRecords };
  } catch (err) {
    log(`  WARN: Extended query failed (${err.message}), trying basic query...`);
    try {
      const invRecordsBasic = await batchMssqlQuery(cseIdListInv, `
        SELECT i.inv_id, i.cse_id, i.ist_id, i.ity_id,
               i.inv_invoice_number, i.inv_variable_symbol,
               i.inv_date_of_issue, i.inv_date_of_delivery, i.inv_date_of_payment, i.inv_dispatch_date,
               i.inv_amount_cur_home_with_vat, i.inv_amount_cur_home_no_vat,
               i.inv_paid_cur_home, i.cur_code_home,
               i.inv_fully_paid, i.inv_note, i.inv_inserted, i.inv_writeoff
        FROM Invoices i
        WHERE i.cse_id IN (\${BATCH_IDS})
        ORDER BY i.inv_id
      `, 'Invoices(basic)');
      invoices = { recordset: invRecordsBasic };
    } catch (err2) {
      log(`  ERROR: Invoices query failed: ${err2.message}`);
      return;
    }
  }

  log(`  Nájdených ${invoices.recordset.length} faktúr`);

  if (invoices.recordset.length > 0) {
    table(
      ['inv_id', 'Číslo', 'VS', 'Vydaná', 'Splatnosť', 'Suma', 'Mena', 'Zapl.', 'Stav', 'Typ', 'Firma'],
      invoices.recordset.slice(0, 10).map(r => {
        const cliId = cseToClient[String(r.cse_id)];
        return [
          r.inv_id,
          r.inv_invoice_number || '-',
          r.inv_variable_symbol || '-',
          r.inv_date_of_issue ? new Date(r.inv_date_of_issue).toLocaleDateString('sk') : '-',
          (r.inv_due_date || r.inv_date_of_payment) ? new Date(r.inv_due_date || r.inv_date_of_payment).toLocaleDateString('sk') : '-',
          r.inv_amount_cur_home_with_vat != null ? String(r.inv_amount_cur_home_with_vat) : '-',
          r.cur_code_home || '-',
          r.inv_fully_paid ? 'Áno' : 'Nie',
          invoiceStatusRaw[r.ist_id] || '-',
          invoiceTypeRaw[r.ity_id] || '-',
          cliId ? (companyMap[cliId] || '-') : '-'
        ];
      })
    );

    // Status distribution
    const statusDist = {};
    for (const r of invoices.recordset) {
      const code = invoiceStatusRaw[r.ist_id] || 'unknown';
      statusDist[code] = (statusDist[code] || 0) + 1;
    }
    log(`  Rozdelenie podľa statusu: ${Object.entries(statusDist).map(([k,v]) => `${k}=${v}`).join(', ')}`);

    // Type distribution
    const typeDist = {};
    for (const r of invoices.recordset) {
      const code = invoiceTypeRaw[r.ity_id] || 'unknown';
      typeDist[code] = (typeDist[code] || 0) + 1;
    }
    log(`  Rozdelenie podľa typu: ${Object.entries(typeDist).map(([k,v]) => `${k}=${v}`).join(', ')}`);

    // Currency distribution
    const curDist = {};
    for (const r of invoices.recordset) {
      const cur = r.cur_code_home || 'unknown';
      curDist[cur] = (curDist[cur] || 0) + 1;
    }
    log(`  Rozdelenie podľa meny: ${Object.entries(curDist).map(([k,v]) => `${k}=${v}`).join(', ')}`);

    // Paid distribution
    let paidCount = 0, unpaidCount = 0;
    for (const r of invoices.recordset) { if (r.inv_fully_paid) paidCount++; else unpaidCount++; }
    log(`  Zaplatené: ${paidCount}, Nezaplatené: ${unpaidCount}`);
  }

  // Ensure pdf_downloaded_at column
  try {
    await pgPool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_downloaded_at timestamp`);
    log('  ✓ invoices.pdf_downloaded_at stĺpec overený');
  } catch (err) { log(`  WARN pdf_downloaded_at: ${err.message}`); }

  // --- Preload InvoiceItems (legacy invoice line items) ---
  const invoiceItemsMap = {}; // inv_id → items[]
  try {
    const iiCols = await mssqlPool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'InvoiceItems' ORDER BY ORDINAL_POSITION
    `);
    if (iiCols.recordset.length > 0) {
      log(`  InvoiceItems stĺpce: ${iiCols.recordset.map(r => r.COLUMN_NAME).join(', ')}`);
      const invIdList = invoices.recordset.map(r => r.inv_id);
      const iiResRecords = await batchMssqlQuery(invIdList, `
        SELECT * FROM InvoiceItems WHERE inv_id IN (\${BATCH_IDS}) ORDER BY inv_id, iit_id
      `, 'InvoiceItems');
      const iiRes = { recordset: iiResRecords };
      log(`  InvoiceItems: ${iiRes.recordset.length} záznamov`);
      for (const item of iiRes.recordset) {
        const vatRecord = vatRatesMap[String(item.vat_id)];
        item.vat_rate = vatRecord ? (vatRecord.vat_rate != null ? parseFloat(vatRecord.vat_rate) : null) : null;
        const key = String(item.inv_id);
        if (!invoiceItemsMap[key]) invoiceItemsMap[key] = [];
        invoiceItemsMap[key].push(item);
      }
      if (iiRes.recordset.length > 0) {
        log(`  Vzorka InvoiceItem: ${JSON.stringify(iiRes.recordset[0])}`);
      }
    } else {
      log('  InvoiceItems tabuľka neexistuje alebo je prázdna');
    }
  } catch (err) { log(`  WARN InvoiceItems: ${err.message}`); }

  // --- Preload ScheduledPayments (plánované splátky k faktúram) ---
  const scheduledPaymentsMap = {}; // inv_id → payments[]
  try {
    const invIdListSP = invoices.recordset.map(r => r.inv_id);
    const spResRecords = await batchMssqlQuery(invIdListSP, `
      SELECT sp.*, ips.ips_code, ips.ips_default_name
      FROM ScheduledPayments sp
      LEFT JOIN InvoicePaymentStatuses ips ON ips.ips_id = sp.ips_id
      WHERE sp.inv_id IN (\${BATCH_IDS})
      ORDER BY sp.inv_id, sp.spa_id
    `, 'ScheduledPayments');
    const spRes = { recordset: spResRecords };
    log(`  ScheduledPayments: ${spRes.recordset.length} záznamov`);
    for (const pay of spRes.recordset) {
      const key = String(pay.inv_id);
      if (!scheduledPaymentsMap[key]) scheduledPaymentsMap[key] = [];
      scheduledPaymentsMap[key].push(pay);
    }
    if (spRes.recordset.length > 0) {
      log(`  Vzorka ScheduledPayment: ${JSON.stringify(spRes.recordset[0])}`);
    }
  } catch (err) { log(`  WARN ScheduledPayments: ${err.message}`); }

  // --- Preload RealizedPayments (skutočné úhrady k faktúram) ---
  const realizedPaymentsMap = {}; // inv_id → realized[]
  try {
    const invIdListRP = invoices.recordset.map(r => r.inv_id);
    const rpResRecords = await batchMssqlQuery(invIdListRP, `
      SELECT * FROM RealizedPayments
      WHERE inv_id IN (\${BATCH_IDS})
      ORDER BY inv_id, rpa_id
    `, 'RealizedPayments');
    const rpRes = { recordset: rpResRecords };
    log(`  RealizedPayments: ${rpRes.recordset.length} záznamov`);
    for (const rp of rpRes.recordset) {
      const key = String(rp.inv_id);
      if (!realizedPaymentsMap[key]) realizedPaymentsMap[key] = [];
      realizedPaymentsMap[key].push(rp);
    }
    if (rpRes.recordset.length > 0) {
      log(`  Vzorka RealizedPayment: ${JSON.stringify(rpRes.recordset[0])}`);
    }
  } catch (err) { log(`  WARN RealizedPayments: ${err.message}`); }

  // --- Preload InvoiceSchedulesPaymentDates (dátumy splátok) ---
  const paymentDatesMap = {}; // inv_id → dates object
  try {
    const invIdListPD = invoices.recordset.map(r => r.inv_id);
    const pdResRecords = await batchMssqlQuery(invIdListPD, `
      SELECT * FROM InvoiceSchedulesPaymentDates
      WHERE inv_id IN (\${BATCH_IDS})
    `, 'PaymentDates');
    const pdRes = { recordset: pdResRecords };
    log(`  InvoiceSchedulesPaymentDates: ${pdRes.recordset.length} záznamov`);
    for (const pd of pdRes.recordset) {
      paymentDatesMap[String(pd.inv_id)] = pd;
    }
  } catch (err) { log(`  WARN InvoiceSchedulesPaymentDates: ${err.message}`); }

  log(`  Mapy načítané: items=${Object.keys(invoiceItemsMap).length} faktúr, scheduledPayments=${Object.keys(scheduledPaymentsMap).length} faktúr, realizedPayments=${Object.keys(realizedPaymentsMap).length} faktúr`);

  let inserted = 0, skipped = 0, errors = 0;
  for (const r of invoices.recordset) {
    const cliId = cseToClient[String(r.cse_id)];
    const customerId = cliId ? customerMap[cliId] : null;
    if (!customerId) { skipped++; continue; }

    const legacyId = `invoice_${r.inv_id}`;
    const existing = await pgPool.query(`SELECT id FROM customer_documents WHERE legacy_id = $1`, [legacyId]);
    if (existing.rows.length > 0) { skipped++; continue; }

    // Resolve contract_instance reference (internal_id format is "contract_${con_id}")
    const cbcConId = cseToConId[String(r.cse_id)];
    const contractInstanceId = cbcConId ? (contractInstanceLookup[`contract_${cbcConId}`] || null) : null;

    // Map status code → normalized
    const statusCode = invoiceStatusRaw[r.ist_id] || '';
    const normalizedStatus = INVOICE_STATUS_MAP[statusCode] || statusCode || (r.inv_fully_paid ? 'paid' : 'new');

    // Map type code
    const typeCode = invoiceTypeRaw[r.ity_id] || null;

    // Company from contract chain
    const companyName = cliId ? (companyMap[cliId] || null) : null;

    // Build legacy data object
    const legacyData = {
      inv_id: r.inv_id,
      cse_id: r.cse_id,
      con_id: cbcConId || null,
      ist_id: r.ist_id,
      ity_id: r.ity_id,
      ist_code: statusCode,
      ity_code: typeCode,
      writeoff: r.inv_writeoff || null,
      specific_symbol: r.inv_specific_symbol || null,
      constant_symbol: r.inv_constant_symbol || null,
      exchange_rate: r.inv_exchange_rate || null,
      amount_account_vat: r.inv_amount_cur_account_with_vat || null,
      amount_account_no_vat: r.inv_amount_cur_account_no_vat || null,
      paid_account: r.inv_paid_cur_account || null,
      prepaid_home: r.inv_prepaid_cur_home || null,
      prepaid_account: r.inv_prepaid_cur_account || null,
      period_from: r.inv_period_from || null,
      period_to: r.inv_period_to || null,
      emailed: r.inv_emailed || null,
      bsp_note: r.inv_bsp_note || null,
      credit_note_to: r.inv_id_credit_note_to || null,
      proforma_link: r.inv_id_proforma_link || null,
      inserted_by: r.inv_inserted_by || null,
      updated_by: r.inv_updated_by || null,
      accountingCode: r.cse_id ? (accountingCodeByCseId[String(r.cse_id)] || accountingCodeByConId[String(cbcConId)] || null) : null,
      legacyBillingCompany: cliId ? (companyInfoMap[cliId] || null) : null,
      billingAddress: r.billing_addr_name ? {
        name: r.billing_addr_name, street: r.billing_addr_street,
        city: r.billing_addr_city, zip: r.billing_addr_zip,
        country: r.billing_addr_country, area: r.billing_addr_area,
      } : null,
      companyDetails: (() => {
        const comp = cliId ? (companyInfoMap[cliId] || {}) : {};
        const comId = comp.com_id ? String(comp.com_id) : null;
        const cd = comId ? (companyDetailsMap[comId] || {}) : {};
        const ca = comId ? ((companyAccountsMap[comId] || [])[0] || {}) : {};
        return {
          ico: cd.cod_ico || null,
          dic: cd.cod_dic || null,
          vatDic: cd.cod_vat_dic || null,
          bankName: ca.acc_bank_name || null,
          iban: ca.acc_IBAN || null,
          swift: ca.acc_SWIFT || null,
          bankCode: ca.acc_account_bank_code || null,
        };
      })(),
      items: invoiceItemsMap[String(r.inv_id)] || [],
      scheduledPayments: scheduledPaymentsMap[String(r.inv_id)] || [],
      realizedPayments: realizedPaymentsMap[String(r.inv_id)] || [],
      paymentDates: paymentDatesMap[String(r.inv_id)] || null,
    };

    // Map invoice status to invoices module status
    const INVOICES_MODULE_STATUS_MAP = {
      'new': 'generated',
      'filled': 'generated',
      'in_due': 'sent',
      'sent': 'sent',
      'paid': 'paid',
      'partially_paid': 'partially_paid',
      'overdue': 'overdue',
      'cancelled': 'cancelled',
      'credit_note': 'cancelled',
    };
    const invoicesModuleStatus = INVOICES_MODULE_STATUS_MAP[normalizedStatus] || 'generated';

    try {
      // 1) Insert into customer_documents (Documents tab)
      await pgPool.query(`
        INSERT INTO customer_documents (
          id, legacy_id, customer_id, document_type, data_source,
          invoice_number, variable_symbol, invoice_type, invoice_status,
          domestic_currency, accounting_currency,
          amount, amount_no_vat, paid_amount, fully_paid,
          issue_date, due_date, sent_date, delivery_date,
          company_name, contract_instance_id,
          note, legacy_data, created_at
        )
        VALUES (
          gen_random_uuid(), $1, $2, 'invoice', 'iscbc',
          $3, $4, $5, $6,
          $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18,
          $19, $20, $21
        )
      `, [
        legacyId,
        customerId,
        r.inv_invoice_number || null,
        r.inv_variable_symbol || null,
        typeCode,
        normalizedStatus,
        r.cur_code_home || null,
        r.cur_code_account || null,
        r.inv_amount_cur_home_with_vat != null ? String(r.inv_amount_cur_home_with_vat) : null,
        r.inv_amount_cur_home_no_vat != null ? String(r.inv_amount_cur_home_no_vat) : null,
        r.inv_paid_cur_home != null ? String(r.inv_paid_cur_home) : null,
        r.inv_fully_paid ? true : false,
        r.inv_date_of_issue || null,
        r.inv_date_of_payment || null,
        r.inv_dispatch_date || null,
        r.inv_date_of_delivery || null,
        companyName,
        contractInstanceId,
        r.inv_note || null,
        JSON.stringify(legacyData),
        r.inv_inserted || r.inv_date_of_issue || new Date(),
      ]);

      // 2) Insert into invoices module (main invoices table)
      const rawInvNum = r.inv_invoice_number || r.inv_variable_symbol || `${r.inv_id}`;
      const invoiceNumberForModule = `CBC-${rawInvNum}`;
      const invComp = cliId ? (companyInfoMap[cliId] || {}) : {};
      const invComId = invComp.com_id ? String(invComp.com_id) : null;
      const invCompDetails = invComId ? (companyDetailsMap[invComId] || {}) : {};
      const invCompAccounts = invComId ? ((companyAccountsMap[invComId] || [])[0] || {}) : {};

      // Determine payment_date for paid invoices from RealizedPayments
      let resolvedPaymentDate = null;
      if (normalizedStatus === 'paid' || r.inv_fully_paid) {
        const realized = realizedPaymentsMap[String(r.inv_id)] || [];
        if (realized.length > 0) {
          // Use the last realized payment date
          const lastPayment = realized[realized.length - 1];
          resolvedPaymentDate = lastPayment.rpa_date || lastPayment.rpa_date_of_payment || lastPayment.rpa_inserted || null;
        }
        // Fallback: if no realized payment, try payment dates map
        if (!resolvedPaymentDate) {
          const pd = paymentDatesMap[String(r.inv_id)];
          if (pd) resolvedPaymentDate = pd.ispd_date || pd.ispd_date_of_payment || null;
        }
        // Final fallback: use due date as approximation for fully paid invoices
        if (!resolvedPaymentDate && r.inv_date_of_payment) {
          resolvedPaymentDate = r.inv_date_of_payment;
        }
      }

      await pgPool.query(`
        INSERT INTO invoices (
          id, invoice_number, legacy_id, customer_id,
          total_amount, subtotal, paid_amount,
          currency, status,
          variable_symbol, specific_symbol, constant_symbol,
          delivery_date, issue_date, send_date, due_date,
          period_from, period_to,
          billing_company_name, billing_address, billing_country,
          billing_tax_id, billing_vat_id,
          billing_bank_name, billing_bank_iban, billing_bank_swift,
          contract_instance_id,
          payment_date,
          customer_name,
          data_source, legacy_data, note,
          generated_at, created_at
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3,
          $4, $5, $6,
          $7, $8,
          $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17,
          $18, $19, $20,
          $21, $22,
          $23, $24, $25,
          $26,
          $27,
          $28,
          'iscbc', $29, $30,
          $31, $31
        )
      `, [
        invoiceNumberForModule,                                                        // $1
        legacyId,                                                                      // $2
        customerId,                                                                    // $3
        r.inv_amount_cur_home_with_vat != null ? String(r.inv_amount_cur_home_with_vat) : '0', // $4
        r.inv_amount_cur_home_no_vat != null ? String(r.inv_amount_cur_home_no_vat) : null, // $5
        r.inv_paid_cur_home != null ? String(r.inv_paid_cur_home) : '0',               // $6
        r.cur_code_home || 'EUR',                                                      // $7
        invoicesModuleStatus,                                                          // $8
        r.inv_variable_symbol || null,                                                 // $9
        r.inv_specific_symbol || null,                                                 // $10
        r.inv_constant_symbol || null,                                                 // $11
        r.inv_date_of_delivery || null,                                                // $12
        r.inv_date_of_issue || null,                                                   // $13
        r.inv_dispatch_date || null,                                                   // $14
        r.inv_date_of_payment || null,                                                 // $15 due_date
        r.inv_period_from || null,                                                     // $16
        r.inv_period_to || null,                                                       // $17
        companyName,                                                                   // $18
        r.billing_addr_street ? [r.billing_addr_street, r.billing_addr_city, r.billing_addr_zip].filter(Boolean).join(', ') : null, // $19 billing_address
        r.billing_addr_country ? r.billing_addr_country.replace('COUNTRY_', '') : null,  // $20 billing_country
        invCompDetails.cod_ico || null,                                                // $21 billing_tax_id (IČO)
        invCompDetails.cod_dic || invCompDetails.cod_vat_dic || null,                  // $22 billing_vat_id (DIČ)
        invCompAccounts.acc_bank_name || null,                                         // $23 billing_bank_name
        invCompAccounts.acc_IBAN || null,                                              // $24 billing_bank_iban
        invCompAccounts.acc_SWIFT || null,                                             // $25 billing_bank_swift
        contractInstanceId,                                                            // $26
        resolvedPaymentDate,                                                           // $27 payment_date
        customerNameLookup[customerId] || null,                                        // $28 customer_name
        JSON.stringify(legacyData),                                                    // $29
        r.inv_note || null,                                                            // $30
        r.inv_inserted || r.inv_date_of_issue || new Date(),                           // $31
      ]);

      inserted++;
    } catch (err) {
      errors++;
      if (errors <= 5) log(`  ERROR inv_id=${r.inv_id}: ${err.message}`);
    }
  }

  log(`  customer_documents: ${inserted} faktúr vložených`);
  log(`  invoices (modul): ${inserted} faktúr vložených`);
  log(`  Preskočených: ${skipped}, Chýb: ${errors}`);

  // --- Create scheduled_invoices from actual ScheduledPayments per invoice ---
  let insertedSI = 0, siErrors = 0;
  for (const r of invoices.recordset) {
    const cliId = cseToClient[String(r.cse_id)];
    const customerId = cliId ? customerMap[cliId] : null;
    if (!customerId) continue;

    const payments = scheduledPaymentsMap[String(r.inv_id)] || [];
    if (payments.length < 2) continue; // skip single-payment invoices (one time payment = not a schedule)

    // Only create scheduled_invoices for unpaid/partially paid installments
    const unpaidPayments = payments.filter(p => {
      const status = (p.ips_code || '').toUpperCase();
      return status !== 'REG_IPS_PAID';
    });
    if (unpaidPayments.length === 0) continue;

    const invoiceCurrency = r.cur_code_home || 'EUR';
    const customerNameStr = customerNameLookup[customerId] || null;

    const invComp = cliId ? (companyInfoMap[cliId] || {}) : {};
    const comId = invComp.com_id ? String(invComp.com_id) : null;
    const compDet = comId ? (companyDetailsMap[comId] || {}) : {};
    const compAcc = comId ? ((companyAccountsMap[comId] || [])[0] || {}) : {};
    const vatRate = compDet.cod_vat_dic ? '20' : '0';
    const cseId = String(r.cse_id);
    const cbcConId = cseToConId[cseId];
    const itemAccountingCode = accountingCodeByCseId[cseId] || (cbcConId ? accountingCodeByConId[cbcConId] : null) || null;

    // Get invoice item label for naming
    const invItems = invoiceItemsMap[String(r.inv_id)] || [];
    const itemLabel = invItems.length > 0 ? (invItems[0].iit_label || null) : null;

    const totalInstallments = payments.length;

    for (const sp of unpaidPayments) {
      const amount = parseFloat(sp.spa_amount_home) || 0;
      if (amount <= 0) continue;

      const scheduledDate = sp.spa_date_of_payment ? new Date(sp.spa_date_of_payment) : null;
      if (!scheduledDate) continue;

      const installmentNumber = sp.spa_installments_id || 1;
      const baseItemName = itemLabel || sp.spa_name || 'Splátka';
      const itemEntry = {
        name: baseItemName,
        quantity: 1,
        unitPrice: amount.toFixed(2),
        totalPrice: amount.toFixed(2),
        vatRate: vatRate,
      };
      if (itemAccountingCode) itemEntry.accountingCode = itemAccountingCode;
      const items = JSON.stringify([itemEntry]);

      try {
        await pgPool.query(`
          INSERT INTO scheduled_invoices (
            id, customer_id, scheduled_date, installment_number, total_installments,
            status, currency, payment_term_days, items, total_amount,
            customer_name,
            created_at, created_by,
            billing_company_name, billing_country,
            billing_tax_id, billing_vat_id,
            billing_bank_name, billing_bank_iban, billing_bank_swift
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4,
            'pending', $5, 14, $6, $7,
            $8,
            $9, 'migration-v20',
            $10, $11,
            $12, $13,
            $14, $15, $16
          )
        `, [
          customerId,
          scheduledDate,
          installmentNumber,
          totalInstallments,
          invoiceCurrency,
          items,
          amount.toFixed(2),
          customerNameStr,
          r.inv_inserted || r.inv_date_of_issue || new Date(),
          invComp.com_name || null,
          invComp.com_country_code || null,
          compDet.cod_ico || null,
          compDet.cod_dic || compDet.cod_vat_dic || null,
          compAcc.acc_bank_name || null,
          compAcc.acc_IBAN || null,
          compAcc.acc_SWIFT || null,
        ]);
        insertedSI++;
      } catch (siErr) {
        siErrors++;
        if (siErrors <= 5) log(`  WARN scheduled_invoice inv_id=${r.inv_id}: ${siErr.message}`);
      }
    }
  }
  log(`  scheduled_invoices: ${insertedSI} vložených (z ScheduledPayments — nezaplatené splátky)`);
  if (siErrors > 0) log(`  scheduled_invoices chyby: ${siErrors}`);
  if (Object.keys(contractInstanceLookup).length > 0) {
    let linked = 0;
    for (const r of invoices.recordset) {
      const cbcConId = cseToConId[String(r.cse_id)];
      if (cbcConId && contractInstanceLookup[`contract_${cbcConId}`]) linked++;
    }
    log(`  Faktúry prepojené na contract_instances: ${linked}/${invoices.recordset.length}`);
  }
}

// ============================================================
// STEP 13: Debt Collection (Vymáhanie) — from CBC
// ============================================================
async function step13_debtCollection() {
  separator('STEP 13: Vymáhanie pohľadávok (Debt Collection)');

  const migratedCustomers = await pgPool.query(
    `SELECT id, internal_id FROM customers WHERE internal_id IS NOT NULL`
  );
  if (migratedCustomers.rows.length === 0) { log('Žiadni migrovaní klienti.'); return; }

  const customerMap = {};
  for (const c of migratedCustomers.rows) customerMap[c.internal_id] = c.id;
  const cliIdKeysDebt = Object.keys(customerMap);

  // CBC has per-company Debtors views: DebtorsCZ, DebtorsEurocord, DebtorsHU, DebtorsRO, DebtorsSKRest
  // Each has: cli_id, pda_first_name, pda_last_name, InvoicesOverdue, Debt, Currency, minDueDate, maxDueDate
  const debtorTables = [
    { table: 'DebtorsSKRest', company: 'Eurocord SK' },
    { table: 'DebtorsCZ', company: 'CBC.cz' },
    { table: 'DebtorsEurocord', company: 'Eurocord' },
    { table: 'DebtorsHU', company: 'CBC.hu' },
    { table: 'DebtorsRO', company: 'CBC.ro' },
  ];

  let totalInserted = 0, totalSkipped = 0, totalErrors = 0;

  for (const dt of debtorTables) {
    try {
      const debtorRecords = await batchMssqlQuery(cliIdKeysDebt, `
        SELECT cli_id, pda_id_number, pda_first_name, pda_last_name,
               pda_mobile, pda_email, InvoicesOverdue, Debt, Currency, minDueDate, maxDueDate
        FROM ${dt.table}
        WHERE cli_id IN (\${BATCH_IDS})
      `, dt.table);
      const debtors = { recordset: debtorRecords };

      log(`  ${dt.table} (${dt.company}): ${debtors.recordset.length} dlžníkov`);

      if (debtors.recordset.length > 0) {
        table(
          ['cli_id', 'Meno', 'Dlh', 'Mena', 'Faktúry', 'Od', 'Do'],
          debtors.recordset.slice(0, 5).map(r => [
            r.cli_id,
            `${r.pda_first_name || ''} ${r.pda_last_name || ''}`.trim() || '-',
            r.Debt != null ? String(r.Debt) : '-',
            r.Currency || '-',
            r.InvoicesOverdue != null ? String(r.InvoicesOverdue) : '-',
            r.minDueDate ? new Date(r.minDueDate).toLocaleDateString('sk') : '-',
            r.maxDueDate ? new Date(r.maxDueDate).toLocaleDateString('sk') : '-',
          ])
        );
      }

      let inserted = 0, skipped = 0, errors = 0;
      for (const r of debtors.recordset) {
        const customerId = customerMap[String(r.cli_id)];
        if (!customerId) { skipped++; continue; }

        const legacyId = `debt_${dt.table}_${r.cli_id}`;
        const existing = await pgPool.query(`SELECT id FROM customer_debt_collection WHERE legacy_id = $1`, [legacyId]);
        if (existing.rows.length > 0) { skipped++; continue; }

        try {
          await pgPool.query(`
            INSERT INTO customer_debt_collection (id, legacy_id, customer_id, data_source,
              debt_amount, currency, overdue_invoices_count, oldest_due_date, newest_due_date,
              company_name, status, note, legacy_data, created_at)
            VALUES (gen_random_uuid(), $1, $2, 'iscbc', $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
          `, [
            legacyId,
            customerId,
            r.Debt != null ? String(r.Debt) : null,
            r.Currency || null,
            r.InvoicesOverdue != null ? Number(r.InvoicesOverdue) : null,
            r.minDueDate || null,
            r.maxDueDate || null,
            dt.company,
            'active',
            null,
            JSON.stringify({ source_table: dt.table, cli_id: r.cli_id, pda_id_number: r.pda_id_number }),
          ]);
          inserted++;
        } catch (err) {
          errors++;
          if (errors <= 3) log(`  ERROR ${dt.table} cli_id=${r.cli_id}: ${err.message}`);
        }
      }
      totalInserted += inserted;
      totalSkipped += skipped;
      totalErrors += errors;
    } catch (err) {
      log(`  WARN ${dt.table}: ${err.message}`);
    }
  }

  // Also check ApplicationOfPayments for payment plans
  try {
    const aopResRecords = await batchMssqlQuery(cliIdKeysDebt, `
      SELECT aop_id, cli_id, aop_name, aop_case_opened, aop_case_opened_by, aop_case_closed, aop_case_closed_by
      FROM ApplicationOfPayments
      WHERE cli_id IN (\${BATCH_IDS})
      ORDER BY aop_id
    `, 'AoP');
    const aopRes = { recordset: aopResRecords };
    log(`  ApplicationOfPayments: ${aopRes.recordset.length} záznamov`);
    if (aopRes.recordset.length > 0) {
      table(
        ['aop_id', 'cli_id', 'Názov', 'Otvorené', 'Zatvorené'],
        aopRes.recordset.slice(0, 5).map(r => [
          r.aop_id, r.cli_id, r.aop_name || '-',
          r.aop_case_opened ? new Date(r.aop_case_opened).toLocaleDateString('sk') : '-',
          r.aop_case_closed ? new Date(r.aop_case_closed).toLocaleDateString('sk') : '-',
        ])
      );

      for (const r of aopRes.recordset) {
        const customerId = customerMap[String(r.cli_id)];
        if (!customerId) { totalSkipped++; continue; }
        const legacyId = `aop_${r.aop_id}`;
        const existing = await pgPool.query(`SELECT id FROM customer_debt_collection WHERE legacy_id = $1`, [legacyId]);
        if (existing.rows.length > 0) { totalSkipped++; continue; }
        try {
          await pgPool.query(`
            INSERT INTO customer_debt_collection (id, legacy_id, customer_id, data_source,
              company_name, status, note, legacy_data, created_at)
            VALUES (gen_random_uuid(), $1, $2, 'iscbc', $3, $4, $5, $6, $7)
          `, [
            legacyId,
            customerId,
            'Splátky',
            r.aop_case_closed ? 'closed' : 'active',
            r.aop_name || null,
            JSON.stringify({ aop_id: r.aop_id, opened: r.aop_case_opened, opened_by: r.aop_case_opened_by, closed: r.aop_case_closed, closed_by: r.aop_case_closed_by }),
            r.aop_case_opened || new Date(),
          ]);
          totalInserted++;
        } catch (err) {
          totalErrors++;
          if (totalErrors <= 5) log(`  ERROR aop_id=${r.aop_id}: ${err.message}`);
        }
      }
    }
  } catch (err) { log(`  WARN ApplicationOfPayments: ${err.message}`); }

  log(`  Vymáhanie celkovo: ${totalInserted} vložených, ${totalSkipped} preskočených, ${totalErrors} chýb`);
}

async function step10_verification() {
  separator('STEP 10: Verifikácia — porovnanie prenesených dát');

  const counts = [
    { name: 'CollectionStatuses', query: 'SELECT COUNT(*) as cnt FROM collection_statuses' },
    { name: 'Laboratories', query: 'SELECT COUNT(*) as cnt FROM laboratories' },
    { name: 'Hospitals (migrated)', query: "SELECT COUNT(*) as cnt FROM hospitals WHERE legacy_id IS NOT NULL" },
    { name: 'Collaborators (migrated)', query: "SELECT COUNT(*) as cnt FROM collaborators WHERE legacy_id IS NOT NULL" },
    { name: 'Customers (migrated)', query: "SELECT COUNT(*) as cnt FROM customers WHERE internal_id IS NOT NULL" },
    { name: 'Collections (migrated)', query: "SELECT COUNT(*) as cnt FROM collections WHERE legacy_id IS NOT NULL" },
    { name: 'Lab Results (migrated)', query: "SELECT COUNT(*) as cnt FROM collection_lab_results" },
    { name: 'Agreements (migrated)', query: "SELECT COUNT(*) as cnt FROM collaborator_agreements WHERE collaborator_id IN (SELECT id FROM collaborators WHERE legacy_id IS NOT NULL)" },
    { name: 'Activities (migrated)', query: "SELECT COUNT(*) as cnt FROM collaborator_activities WHERE legacy_id IS NOT NULL" },
    { name: 'Addresses (migrated)', query: "SELECT COUNT(*) as cnt FROM collaborator_addresses WHERE legacy_id IS NOT NULL" },
    { name: 'Cases (migrated)', query: "SELECT COUNT(*) as cnt FROM customer_potential_cases WHERE customer_id IN (SELECT id FROM customers WHERE internal_id IS NOT NULL)" },
    { name: 'Notes (migrated)', query: "SELECT COUNT(*) as cnt FROM customer_notes WHERE legacy_id IS NOT NULL" },
    { name: 'PhoneCalls (migrated)', query: "SELECT COUNT(*) as cnt FROM communication_messages WHERE provider = 'cbc_legacy'" },
    { name: 'Documents-Contracts (migrated)', query: "SELECT COUNT(*) as cnt FROM customer_documents WHERE document_type = 'contract' AND data_source = 'iscbc'" },
    { name: 'Documents-Invoices (migrated)', query: "SELECT COUNT(*) as cnt FROM customer_documents WHERE document_type = 'invoice' AND data_source = 'iscbc'" },
    { name: 'Invoices-Module (migrated)', query: "SELECT COUNT(*) as cnt FROM invoices WHERE data_source = 'iscbc'" },
    { name: 'DebtCollection (migrated)', query: "SELECT COUNT(*) as cnt FROM customer_debt_collection WHERE data_source = 'iscbc'" },
    { name: 'PotentialClients (migrated)', query: "SELECT COUNT(*) as cnt FROM customers WHERE internal_id LIKE 'pot_%' AND client_status = 'potential'" },
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
    SELECT legacy_id, name, city, postal_code, country_code, is_active, latitude, longitude, data_source
    FROM hospitals WHERE legacy_id IS NOT NULL AND legacy_id != '' ORDER BY legacy_id LIMIT 10
  `);
  table(
    ['LegacyID', 'Názov', 'Mesto', 'PSČ', 'Krajina', 'GPS', 'Zdroj'],
    hospitals.rows.map(r => [r.legacy_id, r.name, r.city, r.postal_code, r.country_code,
      r.latitude && r.longitude ? `${r.latitude},${r.longitude}` : '—', r.data_source || '—'])
  );
  const gpsStats = await pgPool.query("SELECT COUNT(*) FILTER (WHERE latitude IS NOT NULL) as with_gps, COUNT(*) as total FROM hospitals WHERE legacy_id IS NOT NULL");
  log(`  GPS štatistika: ${gpsStats.rows[0].with_gps}/${gpsStats.rows[0].total} nemocníc má koordináty`);

  log('\n--- Spolupracovníci v INDEXUS ---');
  const collabs = await pgPool.query(`
    SELECT c.legacy_id, c.first_name, c.last_name, c.mobile, c.email, c.country_code, c.collaborator_type,
           c.representative_id, c.bank_account_iban, c.data_source, c.note,
           c.health_insurance_id, hi.name as hi_name, hi.code as hi_code,
           array_length(c.hospital_ids, 1) as hosp_count
    FROM collaborators c
    LEFT JOIN health_insurance_companies hi ON hi.id = c.health_insurance_id
    WHERE c.legacy_id IS NOT NULL AND c.legacy_id != '' ORDER BY c.legacy_id LIMIT 10
  `);
  table(
    ['LegacyID', 'Meno', 'Priezvisko', 'Mobil', 'Krajina', 'Typ', 'Representative', 'IBAN', 'HI', 'Nemocnice', 'Poznámka', 'Zdroj'],
    collabs.rows.map(r => [r.legacy_id, r.first_name, r.last_name, r.mobile, r.country_code,
      r.collaborator_type, r.representative_id || '—', r.bank_account_iban || '—',
      r.hi_code || '—', r.hosp_count || 0,
      (r.note || '—').slice(0, 20), r.data_source || '—'])
  );
  // Stats
  const collabStats = await pgPool.query(`
    SELECT
      COUNT(*) FILTER (WHERE health_insurance_id IS NOT NULL) as with_hi,
      COUNT(*) FILTER (WHERE representative_id IS NOT NULL) as with_rep,
      COUNT(*) FILTER (WHERE bank_account_iban IS NOT NULL) as with_iban,
      COUNT(*) FILTER (WHERE hospital_ids IS NOT NULL AND hospital_ids != '{}') as with_hosp,
      COUNT(*) FILTER (WHERE note IS NOT NULL AND note != '') as with_note,
      COUNT(*) FILTER (WHERE data_source = 'iscbc') as from_iscbc,
      COUNT(*) as total
    FROM collaborators WHERE legacy_id IS NOT NULL
  `);
  const cs = collabStats.rows[0];
  log(`  Štatistika: HI=${cs.with_hi}/${cs.total}, Rep=${cs.with_rep}/${cs.total}, IBAN=${cs.with_iban}/${cs.total}, Nemocnice=${cs.with_hosp}/${cs.total}, Poznámky=${cs.with_note}/${cs.total}, ISCBC=${cs.from_iscbc}/${cs.total}`);

  const addrStats = await pgPool.query(`
    SELECT address_type, COUNT(*) as cnt FROM collaborator_addresses WHERE legacy_id IS NOT NULL GROUP BY address_type ORDER BY address_type
  `);
  if (addrStats.rows.length > 0) {
    log('  Adresy podľa typu: ' + addrStats.rows.map(r => `${r.address_type}=${r.cnt}`).join(', '));
  }

  // Agreement stats
  const agStats = await pgPool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE questionnaire_returned = true) as with_questionnaire,
      COUNT(*) FILTER (WHERE social_insurance_registration_day IS NOT NULL) as with_soc_reg,
      COUNT(*) FILTER (WHERE social_insurance_cancel_day IS NOT NULL) as with_soc_cancel,
      COUNT(*) FILTER (WHERE note IS NOT NULL AND note != '') as with_note,
      COUNT(*) FILTER (WHERE is_valid = true) as valid
    FROM collaborator_agreements WHERE legacy_id IS NOT NULL
  `);
  const ag = agStats.rows[0];
  log(`  Dohody: total=${ag.total}, valid=${ag.valid}, questionnaire=${ag.with_questionnaire}, soc_reg=${ag.with_soc_reg}, soc_cancel=${ag.with_soc_cancel}, note=${ag.with_note}`);

  // Activities stats
  const actStats = await pgPool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT collaborator_id) as collaborators,
      COUNT(*) FILTER (WHERE agreement_id IS NOT NULL) as with_agreement,
      COUNT(*) FILTER (WHERE collection_id IS NOT NULL) as with_collection,
      COUNT(*) FILTER (WHERE hospital_id IS NOT NULL) as with_hospital,
      COUNT(*) FILTER (WHERE amount IS NOT NULL) as with_reward
    FROM collaborator_activities WHERE legacy_id IS NOT NULL
  `);
  const ac = actStats.rows[0];
  log(`  Úkony: total=${ac.total}, collaborators=${ac.collaborators}, with_agreement=${ac.with_agreement}, with_collection=${ac.with_collection}, with_hospital=${ac.with_hospital}, with_reward=${ac.with_reward}`);

  const actByName = await pgPool.query(`
    SELECT name, COUNT(*) as cnt FROM collaborator_activities WHERE legacy_id IS NOT NULL GROUP BY name ORDER BY cnt DESC
  `);
  if (actByName.rows.length > 0) {
    log('  Úkony podľa typu: ' + actByName.rows.map(r => `${r.name}=${r.cnt}`).join(', '));
  }

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
           c.child_first_name, c.collection_date, h.name as hospital_name, c.status, c.country_code,
           cb.first_name as cb_name, tc.first_name as tc_name,
           pc.first_name as pc_name, an.first_name as an_name, sn.first_name as sn_name
    FROM collections c
    LEFT JOIN hospitals h ON h.id = c.hospital_id
    LEFT JOIN collaborators cb ON cb.id = c.cord_blood_collector_id
    LEFT JOIN collaborators tc ON tc.id = c.tissue_collector_id
    LEFT JOIN collaborators pc ON pc.id = c.placenta_collector_id
    LEFT JOIN collaborators an ON an.id = c.assistant_nurse_id
    LEFT JOIN collaborators sn ON sn.id = c.second_nurse_id
    WHERE c.legacy_id IS NOT NULL AND c.legacy_id != '' ORDER BY c.legacy_id DESC LIMIT 10
  `);
  table(
    ['LegacyID', 'CBU#', 'Klientka', 'Nemocnica', 'Blood', 'Tissue', 'Placenta', 'Assist', '2ndNurse', 'Status'],
    colls.rows.map(r => [
      r.legacy_id, r.cbu_number,
      `${r.client_first_name || ''} ${r.client_last_name || ''}`.trim(),
      r.hospital_name || '—',
      r.cb_name || '—', r.tc_name || '—', r.pc_name || '—', r.an_name || '—', r.sn_name || '—',
      r.status,
    ])
  );

  const collStats = await pgPool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(hospital_id) as with_hospital,
      COUNT(cord_blood_collector_id) as with_blood,
      COUNT(tissue_collector_id) as with_tissue,
      COUNT(placenta_collector_id) as with_placenta,
      COUNT(assistant_nurse_id) as with_assistant,
      COUNT(second_nurse_id) as with_second_nurse,
      COUNT(customer_id) as with_customer,
      COUNT(laboratory_id) as with_lab,
      COUNT(contract_id) as with_contract,
      COUNT(child_first_name) as with_child_name,
      COUNT(child_gender) as with_child_gender,
      COUNT(doctor_note) as with_doctor_note,
      COUNT(note) as with_note,
      COUNT(responsible_coordinator_id) as with_coordinator
    FROM collections WHERE legacy_id IS NOT NULL
  `);
  const s = collStats.rows[0];
  log(`  Štatistika priradení (${s.total} odberov):`);
  log(`    hospital=${s.with_hospital}, lab=${s.with_lab}, contract=${s.with_contract}, customer=${s.with_customer}`);
  log(`    blood=${s.with_blood}, tissue=${s.with_tissue}, placenta=${s.with_placenta}, assistant=${s.with_assistant}, 2ndNurse=${s.with_second_nurse}`);
  log(`    child_name=${s.with_child_name}, child_gender=${s.with_child_gender}, doctor_note=${s.with_doctor_note}, note=${s.with_note}, coordinator=${s.with_coordinator}`);

  log('\n--- Cases v INDEXUS ---');
  const cases = await pgPool.query(`
    SELECT cpc.customer_id, cu.internal_id, cu.first_name, cu.last_name,
           cpc.father_first_name, cpc.father_last_name, cpc.father_mobile, cpc.father_email,
           cpc.father_country, cpc.product_type, cpc.payment_type,
           cpc.expected_date_day, cpc.expected_date_month, cpc.expected_date_year,
           cpc.recruiting, cpc.sales_channel, cpc.info_source,
           cpc.marketing_action, cpc.marketing_code, cpc.newsletter_opt_in, cpc.notes,
           cu.gynecologist_name, cu.gynecologist_phone, cu.gynecologist_email,
           cu.expected_delivery_date, cu.hospital_name as cust_hospital_name
    FROM customer_potential_cases cpc
    JOIN customers cu ON cu.id = cpc.customer_id
    WHERE cu.internal_id IS NOT NULL
    ORDER BY cu.internal_id LIMIT 10
  `);
  table(
    ['CliID', 'Klientka', 'Produkt', 'Platba', 'Gynekológ', 'Recruiting', 'SalesChannel', 'InfoSource', 'Marketing', 'Newsletter'],
    cases.rows.map(r => [
      r.internal_id,
      `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      r.product_type || '—', r.payment_type || '—',
      r.gynecologist_name || '—',
      r.recruiting || '—', r.sales_channel || '—', r.info_source || '—',
      r.marketing_action || '—',
      r.newsletter_opt_in ? 'áno' : 'nie',
    ])
  );
  const casesWithData = await pgPool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(cpc.product_type) as with_product,
      COUNT(cpc.payment_type) as with_payment,
      COUNT(cpc.recruiting) as with_recruiting,
      COUNT(cpc.sales_channel) as with_sales_channel,
      COUNT(cpc.info_source) as with_info_source,
      COUNT(cpc.marketing_action) as with_marketing,
      COUNT(cpc.marketing_code) as with_code,
      COUNT(cpc.notes) as with_notes,
      COUNT(cu.gynecologist_name) as with_gyn_name,
      COUNT(cu.gynecologist_phone) as with_gyn_phone,
      COUNT(cu.expected_delivery_date) as with_exp_date,
      COUNT(cu.hospital_name) as with_hospital_name
    FROM customer_potential_cases cpc
    JOIN customers cu ON cu.id = cpc.customer_id
    WHERE cu.internal_id IS NOT NULL
  `);
  const cd = casesWithData.rows[0];
  log(`  Cases štatistika (${cd.total} celkom):`);
  log(`    product=${cd.with_product}, payment=${cd.with_payment}, recruiting=${cd.with_recruiting}`);
  log(`    salesChannel=${cd.with_sales_channel}, infoSource=${cd.with_info_source}, marketing=${cd.with_marketing}, code=${cd.with_code}`);
  log(`    notes=${cd.with_notes}, gynName=${cd.with_gyn_name}, gynPhone=${cd.with_gyn_phone}, expDate=${cd.with_exp_date}, hospital=${cd.with_hospital_name}`);

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
// STEP 14: Potential Clients (PotentialClients bez zmluvy → customers so statusom potential)
// ============================================================
async function step14_potentialClients() {
  separator('STEP 14: Potenciálni klienti (PotentialClients bez zmluvy)');

  // Find PotentialClients that have NO associated Contract
  // These are leads/potential clients that never got to contract stage
  let potClients;
  try {
    potClients = await mssqlPool.request().query(`
      SELECT TOP ${LIMIT}
        pc.pot_id,
        pd.pda_first_name, pd.pda_last_name, pd.pda_maiden_name,
        pd.pda_title_prefix, pd.pda_title_suffix,
        pd.pda_phone_number, pd.pda_mobile, pd.pda_mobile2,
        pd.pda_email, pd.pda_email2,
        pd.pda_id_number, pd.pda_id_card, pd.pda_birth_date,
        pd.pda_other_contact,
        pd.pda_IBAN, pd.pda_account_number, pd.pda_account_bank_code,
        pd.pda_bank_name, pd.pda_SWIFT,
        ma_perm.add_street_and_number AS perm_street,
        ma_perm.add_city AS perm_city,
        ma_perm.add_zip AS perm_zip,
        ma_perm.add_area AS perm_area,
        ma_perm.add_country AS perm_country,
        ma_corr.add_street_and_number AS corr_street,
        ma_corr.add_city AS corr_city,
        ma_corr.add_zip AS corr_zip,
        ma_corr.add_area AS corr_area,
        ma_corr.add_country AS corr_country,
        ma_corr.add_name AS corr_name,
        pc.pot_product_ft, pc.pot_marketproduct_ft,
        pc.pot_exp_birth_date, pc.pot_exp_hospital_ft, pc.pot_exp_doctor_ft,
        pc.pot_recruiting_ft, pc.pot_pregnancy_type, pc.pot_children,
        pc.pot_registration_type_ft, pc.pot_first_information_source_ft,
        pc.pot_cbc_reason_ft, pc.pot_marketing_action_ft,
        pc.pot_mailinglist, pc.pot_note,
        pc.cos_id
      FROM PotentialClients pc
      JOIN PersonalData pd ON pd.per_id = pc.per_id
      LEFT JOIN MailAddresses ma_perm ON ma_perm.per_id = pc.per_id AND ma_perm.add_valid = 1 AND ma_perm.mat_id = 1
      LEFT JOIN MailAddresses ma_corr ON ma_corr.per_id = pc.per_id AND ma_corr.add_valid = 1 AND ma_corr.mat_id = 3
      WHERE pc.pot_id NOT IN (SELECT pot_id FROM Contracts WHERE pot_id IS NOT NULL)
      ORDER BY pc.pot_id DESC
    `);
  } catch (err) {
    log(`  WARN: PotentialClients query failed: ${err.message}`);
    log('  Skúšam alternatívny prístup...');
    try {
      potClients = await mssqlPool.request().query(`
        SELECT TOP ${LIMIT}
          pc.pot_id,
          pd.pda_first_name, pd.pda_last_name, pd.pda_maiden_name,
          pd.pda_title_prefix, pd.pda_title_suffix,
          pd.pda_phone_number, pd.pda_mobile, pd.pda_mobile2,
          pd.pda_email, pd.pda_email2,
          pd.pda_id_number, pd.pda_id_card, pd.pda_birth_date,
          pd.pda_other_contact,
          ma_perm.add_street_and_number AS perm_street,
          ma_perm.add_city AS perm_city,
          ma_perm.add_zip AS perm_zip,
          ma_perm.add_country AS perm_country,
          pc.pot_note
        FROM PotentialClients pc
        JOIN PersonalData pd ON pd.per_id = pc.per_id
        LEFT JOIN MailAddresses ma_perm ON ma_perm.per_id = pc.per_id AND ma_perm.add_valid = 1 AND ma_perm.mat_id = 1
        WHERE pc.pot_id NOT IN (SELECT pot_id FROM Contracts WHERE pot_id IS NOT NULL)
        ORDER BY pc.pot_id DESC
      `);
    } catch (err2) {
      log(`  ERROR: Alternatívny prístup zlyhal: ${err2.message}`);
      return;
    }
  }

  log(`  Nájdených ${potClients.recordset.length} potenciálnych klientov bez zmluvy`);
  if (potClients.recordset.length === 0) {
    log('  Žiadni potenciálni klienti bez zmluvy — skip');
    return;
  }

  const showLimit = Math.min(10, potClients.recordset.length);
  table(
    ['pot_id', 'Meno', 'Priezvisko', 'Mobil', 'Email', 'Mesto', 'Krajina'],
    potClients.recordset.slice(0, showLimit).map(r => [
      r.pot_id,
      r.pda_first_name || '-',
      r.pda_last_name || '-',
      r.pda_mobile || '-',
      r.pda_email || '-',
      r.perm_city || '-',
      r.perm_country || '-',
    ])
  );

  let inserted = 0, skipped = 0, errors = 0;
  for (const row of potClients.recordset) {
    try {
      const internalId = `pot_${row.pot_id}`;
      const existing = await pgPool.query('SELECT id FROM customers WHERE internal_id = $1', [internalId]);
      if (existing.rows.length > 0) { skipped++; continue; }

      const country = normalizeCountryCode(row.perm_country);
      const firstName = normalizeName(row.pda_first_name) || 'N/A';
      const lastName = normalizeName(row.pda_last_name) || 'N/A';
      const email = normalizeEmail(row.pda_email) || `potential_${row.pot_id}@import.local`;

      const bankAccount = row.pda_IBAN || (row.pda_account_number ? `${row.pda_account_number}/${row.pda_account_bank_code}` : null);
      const hasCorr = !!(row.corr_street || row.corr_city);

      const notes = [
        row.pot_note || '',
        row.pot_product_ft ? `Produkt: ${row.pot_product_ft}` : '',
        row.pot_recruiting_ft ? `Recruiting: ${row.pot_recruiting_ft}` : '',
        row.pot_first_information_source_ft ? `Zdroj info: ${row.pot_first_information_source_ft}` : '',
        row.pot_cbc_reason_ft ? `Dôvod CBC: ${row.pot_cbc_reason_ft}` : '',
        row.pot_marketing_action_ft ? `Marketing: ${row.pot_marketing_action_ft}` : '',
        row.pot_registration_type_ft ? `Typ registrácie: ${row.pot_registration_type_ft}` : '',
      ].filter(Boolean).join('; ');

      await pgPool.query(`
        INSERT INTO customers (
          internal_id, title_before, first_name, last_name, maiden_name, title_after,
          phone, mobile, mobile_2, other_contact, email, email_2,
          national_id, id_card_number, date_of_birth, newsletter,
          country, city, address, postal_code, region,
          use_correspondence_address, corr_name, corr_address, corr_city, corr_postal_code, corr_region, corr_country,
          bank_account, bank_code, bank_name, bank_swift,
          client_status, status, notes, lead_score, data_source, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)
      `, [
        internalId,
        row.pda_title_prefix || null, firstName, lastName, normalizeName(row.pda_maiden_name) || null, row.pda_title_suffix || null,
        normalizePhone(row.pda_phone_number, country) || normalizePhone(row.pda_mobile, country), normalizePhone(row.pda_mobile, country),
        normalizePhone(row.pda_mobile2, country), row.pda_other_contact || null,
        email, normalizeEmail(row.pda_email2) || null,
        normalizeNationalId(row.pda_id_number) || null, row.pda_id_card || null, row.pda_birth_date || null,
        row.pot_mailinglist === true || row.pot_mailinglist === 1,
        country, normalizeCity(row.perm_city) || null, row.perm_street || null, normalizePostalCode(row.perm_zip, country) || null, row.perm_area || null,
        hasCorr, row.corr_name || null, row.corr_street || null, normalizeCity(row.corr_city) || null,
        normalizePostalCode(row.corr_zip, normalizeCountryCode(row.corr_country) || country) || null, row.corr_area || null, normalizeCountryCode(row.corr_country) || null,
        bankAccount || null, row.pda_account_bank_code || null, row.pda_bank_name || null, row.pda_SWIFT || null,
        'potential', 'active', notes || null, 0,
        'iscbc', new Date(),
      ]);
      inserted++;
    } catch (err) {
      errors++;
      if (errors <= 5) log(`  ERROR pot_id=${row.pot_id}: ${err.message}`);
    }
  }
  log(`\n  → ${inserted} vložených, ${skipped} preskočených, ${errors} chýb`);
}

// ============================================================
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log(`║   CBC → INDEXUS  Testovací migračný scenár (${LIMIT} záznamov)`.padEnd(66) + '║');
  console.log('║   S: Zmluvy, Faktúry, Vymáhanie, Potenciálni klienti           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    await step1_testConnection();

    separator('STEP 0: Cleanup — vymazanie starých migrovaných dát');
    try {
      const tables = [
        { table: 'scheduled_invoices', where: "created_by = 'migration-v20'" },
        { table: 'customer_debt_collection', where: "data_source = 'iscbc'" },
        { table: 'invoices', where: "data_source = 'iscbc'" },
        { table: 'customer_documents', where: "data_source = 'iscbc'" },
        { table: 'contract_instances', where: "data_source = 'iscbc'" },
        { table: 'communication_messages', where: "external_id LIKE 'cbc_pho_%'" },
        { table: 'customer_notes', where: "data_source = 'iscbc'" },
        { table: 'customer_potential_cases', where: "customer_id IN (SELECT id FROM customers WHERE data_source = 'iscbc')" },
        { table: 'collection_lab_results', where: "collection_id IN (SELECT id FROM collections WHERE data_source = 'iscbc')" },
        { table: 'collections', where: "data_source = 'iscbc'" },
        { table: 'collaborator_activities', where: "legacy_id IS NOT NULL AND legacy_id LIKE 'cc_%'" },
        { table: 'collaborator_agreements', where: "legacy_id IS NOT NULL" },
        { table: 'collaborator_addresses', where: "collaborator_id IN (SELECT id FROM collaborators WHERE data_source = 'iscbc')" },
        { table: 'collaborators', where: "data_source = 'iscbc'" },
        { table: 'customers', where: "data_source = 'iscbc'" },
        { table: 'hospitals', where: "data_source = 'iscbc'" },
      ];
      for (const { table, where } of tables) {
        try {
          const res = await pgPool.query(`DELETE FROM ${table} WHERE ${where}`);
          if (res.rowCount > 0) log(`  ${table}: ${res.rowCount} vymazaných`);
        } catch (e) {
          log(`  WARN ${table}: ${e.message}`);
        }
      }
      log('  ✓ Cleanup dokončený');
    } catch (e) { log(`  WARN cleanup: ${e.message}`); }

    await step2_referenceData();
    await step3_hospitals();
    await step4_collaborators();
    await step4b_agreements();
    await step4c_activities();
    await step5_customers();
    await step6_collections();
    await step6b_cases();
    await step8_remarks();
    await step9_phoneCommunications();
    await step11_customerContracts();
    await step12_customerInvoices();
    await step13_debtCollection();
    await step14_potentialClients();
    await step10_verification();

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
