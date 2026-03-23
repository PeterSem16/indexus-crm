#!/usr/bin/env node
/**
 * ISCBC → INDEXUS Migration - Phase 3: Business Records
 * Migrates: ServiceCollections → collections, CollectionEvaluationResults → collection_lab_results
 * Run on Ubuntu: node migrate-phase3-collections.js
 * Requires: npm install mssql pg
 */
const sql = require('mssql');
const { Pool } = require('pg');
const { normalizePhone, normalizeName, normalizeNationalId } = require('./consolidate-contacts.cjs');

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

const lookups = {
  companies: {},
  hospitals: {},
  collaborators: {},
  customers: {},
  statuses: {},
};

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

  const bd = await pgPool.query('SELECT id, legacy_id, country_code FROM billing_details WHERE legacy_id IS NOT NULL');
  for (const r of bd.rows) lookups.companies[r.legacy_id] = { id: r.id, countryCode: r.country_code };

  const h = await pgPool.query('SELECT id, legacy_id FROM hospitals WHERE legacy_id IS NOT NULL');
  for (const r of h.rows) lookups.hospitals[r.legacy_id] = r.id;

  const col = await pgPool.query('SELECT id, legacy_id FROM collaborators WHERE legacy_id IS NOT NULL');
  for (const r of col.rows) lookups.collaborators[r.legacy_id] = r.id;

  const cust = await pgPool.query('SELECT id, internal_id FROM customers WHERE internal_id IS NOT NULL');
  for (const r of cust.rows) lookups.customers[r.internal_id] = r.id;

  const st = await pgPool.query('SELECT id, legacy_id FROM collection_statuses WHERE legacy_id IS NOT NULL');
  for (const r of st.rows) lookups.statuses[r.legacy_id] = r.id;

  log(`  Lookups: ${Object.keys(lookups.companies).length} companies, ${Object.keys(lookups.hospitals).length} hospitals, ${Object.keys(lookups.collaborators).length} collaborators, ${Object.keys(lookups.customers).length} customers, ${Object.keys(lookups.statuses).length} statuses`);
}

function decomposeBirthDate(dateVal) {
  if (!dateVal) return { day: null, month: null, year: null };
  const d = new Date(dateVal);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

// ============================================================
// 1. ServiceCollections → collections
// ============================================================
async function migrateCollections() {
  log('--- Migrating ServiceCollections → collections ---');
  resetStats();

  // Get collection collaborator mappings
  const collabMap = {};
  const collabRows = await mssqlPool.request().query(`
    SELECT cc.sco_id, cc.doc_id, cc.agt_id, at.agt_code
    FROM CollectionCollaborators cc
    LEFT JOIN CollaborationAgreementTypes at ON at.agt_id = cc.agt_id
  `);
  for (const r of collabRows.recordset) {
    if (!collabMap[r.sco_id]) collabMap[r.sco_id] = {};
    const code = (r.agt_code || '').toUpperCase();
    if (code.includes('BLOOD') || code.includes('KRV')) {
      collabMap[r.sco_id].blood = String(r.doc_id);
    } else if (code.includes('TISSUE') || code.includes('TKANIV')) {
      collabMap[r.sco_id].tissue = String(r.doc_id);
    } else if (code.includes('PLACENT')) {
      collabMap[r.sco_id].placenta = String(r.doc_id);
    } else if (code.includes('ASSIST') || code.includes('ASIST')) {
      collabMap[r.sco_id].assistant = String(r.doc_id);
    }
  }

  // Get client IDs from Contracts → ContractServices → ServiceCollections
  const clientMap = {};
  const clientRows = await mssqlPool.request().query(`
    SELECT cs.sco_id, c.cli_id
    FROM ContractServices cs
    JOIN Contracts c ON c.con_id = cs.con_id
    WHERE cs.sco_id IS NOT NULL
  `);
  for (const r of clientRows.recordset) {
    clientMap[r.sco_id] = String(r.cli_id);
  }

  // Fetch all collections
  const collections = await mssqlPool.request().query(`
    SELECT sco_id, sco_collection_unit_number, sco_collection_made,
      sco_client_first_name, sco_client_last_name, sco_client_phone_number,
      sco_client_mobile, sco_client_email, sco_client_birth_date, sco_client_id_number,
      sco_child_first_name, sco_child_last_name, sco_child_sex,
      sco_state_detail, sco_responsible_coordinator,
      sco_sterility, sco_lab_evaluation, sco_paired, sco_evaluated,
      sco_stored, sco_transferred, sco_released, sco_waiting_for_dispose, sco_disposed,
      sco_doctors_note, sco_note, sco_inserted, sco_updated,
      csu_id, mpr_id, com_id, hos_id, lab_id, rer_id
    FROM ServiceCollections
    ORDER BY sco_id
  `);

  let batch = 0;
  for (const row of collections.recordset) {
    try {
      const existing = await pgPool.query(
        'SELECT id FROM collections WHERE legacy_id = $1',
        [String(row.sco_id)]
      );
      if (existing.rows.length > 0) { stats.skipped++; continue; }

      const companyInfo = lookups.companies[String(row.com_id)] || {};
      const hospitalId = lookups.hospitals[String(row.hos_id)] || null;
      const customerId = lookups.customers[clientMap[row.sco_id]] || null;
      const birth = decomposeBirthDate(row.sco_client_birth_date);

      // Collaborators
      const cc = collabMap[row.sco_id] || {};
      const bloodCollId = lookups.collaborators[cc.blood] || null;
      const tissueCollId = lookups.collaborators[cc.tissue] || null;
      const placentaCollId = lookups.collaborators[cc.placenta] || null;
      const assistantId = lookups.collaborators[cc.assistant] || null;

      await pgPool.query(`
        INSERT INTO collections (
          legacy_id, cbu_number,
          billing_company_id, country_code,
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
          doctor_note, note,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
      `, [
        String(row.sco_id),
        row.sco_collection_unit_number,
        companyInfo.id || null,
        companyInfo.countryCode || 'SK',
        customerId,
        normalizeName(row.sco_client_first_name), normalizeName(row.sco_client_last_name),
        normalizePhone(row.sco_client_phone_number, companyInfo.countryCode || 'SK'), normalizePhone(row.sco_client_mobile, companyInfo.countryCode || 'SK'),
        normalizeNationalId(row.sco_client_id_number),
        birth.day, birth.month, birth.year,
        normalizeName(row.sco_child_first_name), normalizeName(row.sco_child_last_name), row.sco_child_sex,
        row.sco_collection_made, hospitalId,
        bloodCollId, tissueCollId, placentaCollId, assistantId,
        row.csu_id, row.sco_state_detail,
        row.sco_paired, row.sco_lab_evaluation, row.sco_sterility,
        row.sco_stored, row.sco_transferred, row.sco_released,
        row.sco_waiting_for_dispose, row.sco_disposed,
        row.sco_doctors_note, row.sco_note,
        row.sco_inserted || new Date(),
        row.sco_updated || row.sco_inserted || new Date(),
      ]);
      stats.inserted++;
      batch++;
      if (batch % 500 === 0) log(`  ... ${batch} collections processed`);
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 10) {
        log(`  ERROR Collection sco_id=${row.sco_id}: ${err.message}`);
      }
    }
  }
  log(`  Collections: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);
}

// ============================================================
// 2. CollectionEvaluationResults → collection_lab_results
// ============================================================
async function migrateLabResults() {
  log('--- Migrating CollectionEvaluationResults → collection_lab_results ---');
  resetStats();

  // First, build a lookup of collectionId by legacy sco_id
  const collLookup = {};
  const pgColls = await pgPool.query('SELECT id, legacy_id FROM collections WHERE legacy_id IS NOT NULL');
  for (const r of pgColls.rows) collLookup[r.legacy_id] = r.id;

  // Get evaluation results grouped by sco_id
  const evalResults = await mssqlPool.request().query(`
    SELECT cer.sco_id, cer.cev_id, cer.cet_id,
           cer.cev_value_number, cer.cev_value_text, cer.cev_value_text_update,
           cet.cet_code, cet.cet_name, cet.cet_field_name
    FROM CollectionEvaluationResults cer
    JOIN CollectionEvaluationTemplates cet ON cet.cet_id = cer.cet_id
    ORDER BY cer.sco_id, cet.cet_order
  `);

  // Group by sco_id
  const grouped = {};
  for (const r of evalResults.recordset) {
    if (!grouped[r.sco_id]) grouped[r.sco_id] = {};
    const code = (r.cet_code || r.cet_field_name || '').toLowerCase();
    const value = r.cev_value_text_update || r.cev_value_text || (r.cev_value_number != null ? String(r.cev_value_number) : null);
    grouped[r.sco_id][code] = value;
  }

  for (const [scoId, fields] of Object.entries(grouped)) {
    try {
      const collectionId = collLookup[scoId];
      if (!collectionId) continue;

      const existing = await pgPool.query(
        'SELECT id FROM collection_lab_results WHERE collection_id = $1',
        [collectionId]
      );
      if (existing.rows.length > 0) { stats.skipped++; continue; }

      await pgPool.query(`
        INSERT INTO collection_lab_results (
          collection_id, usability, sterility, volume, tnc_count,
          lab_note
        ) VALUES ($1,$2,$3,$4,$5,$6)
      `, [
        collectionId,
        fields['usability'] || fields['pouzitelnost'] || null,
        fields['sterility'] || fields['sterilita'] || null,
        fields['volume'] || fields['objem'] || null,
        fields['tnc'] || fields['tnc_count'] || null,
        JSON.stringify(fields),
      ]);
      stats.inserted++;
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 10) {
        log(`  ERROR LabResult sco_id=${scoId}: ${err.message}`);
      }
    }
  }
  log(`  Lab Results: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);
}

// ============================================================
// Main
// ============================================================
async function main() {
  log('=== ISCBC → INDEXUS Migration: Phase 3 - Collections ===\n');

  try {
    await connect();
    await buildLookups();
    await migrateCollections();
    await migrateLabResults();
    log('\n=== Phase 3 Complete ===');
  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

main();
