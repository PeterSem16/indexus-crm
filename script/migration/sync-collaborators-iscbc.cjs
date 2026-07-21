#!/usr/bin/env node
/**
 * ISCBC → INDEXUS: Inkrementálny sync spolupracovníkov (VŠETCI, nie TOP N)
 *
 * - INSERT chýbajúcich collaborators (podľa legacy_id = doc_id) + ich adresy
 * - INSERT chýbajúcich collaborator_agreements (podľa legacy_id = cag_id)
 * - UPDATE existujúcich: iba doplnenie prázdnych polí (COALESCE) — nič neprepisuje
 *
 * Spustenie na CORPCRM01 (default = dry-run, nič nezapíše):
 *   node script/migration/sync-collaborators-iscbc.cjs
 * Ostrý zápis:
 *   node script/migration/sync-collaborators-iscbc.cjs --commit
 */
const sql = require('mssql');
const { Pool } = require('pg');
const { normalizePhone, normalizeEmail, normalizeName, normalizeNationalId, normalizePostalCode, normalizeCity } = require('./consolidate-contacts.cjs');

const COMMIT = process.argv.includes('--commit');

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

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function normalizeCountryCode(cbcCode) {
  if (!cbcCode) return 'SK';
  const s = String(cbcCode).trim();
  if (s.startsWith('COUNTRY_')) return s.replace('COUNTRY_', '');
  return s;
}

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
  return cbcCollaboratorTypeMap[cbcType] || cbcCollaboratorTypeMap[String(cbcType).toUpperCase()] || 'other';
}

function decomposeBirthDate(dateVal) {
  if (!dateVal) return { day: null, month: null, year: null };
  const d = new Date(dateVal);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

function dmy(dateVal) {
  if (!dateVal) return { day: null, month: null, year: null };
  const d = new Date(dateVal);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

async function main() {
  log(`Režim: ${COMMIT ? 'COMMIT (ostrý zápis)' : 'DRY-RUN (len report, nič sa nezapíše)'}`);

  const mssqlPool = await sql.connect(MSSQL_CONFIG);
  const pgPool = new Pool(PG_CONFIG);
  await pgPool.query('SELECT 1');
  log('Pripojené k obom databázam');

  // ---------- PG lookups ----------
  const existingCollab = {};
  const pgC = await pgPool.query('SELECT id, legacy_id, email, mobile, birth_number FROM collaborators WHERE legacy_id IS NOT NULL');
  for (const r of pgC.rows) existingCollab[r.legacy_id] = r;
  log(`INDEXUS: ${pgC.rows.length} spolupracovníkov s legacy_id`);

  const existingAgr = new Set();
  const pgA = await pgPool.query('SELECT legacy_id FROM collaborator_agreements WHERE legacy_id IS NOT NULL');
  for (const r of pgA.rows) existingAgr.add(r.legacy_id);
  log(`INDEXUS: ${existingAgr.size} dohôd s legacy_id`);

  const hospitalLookup = {};
  const pgH = await pgPool.query('SELECT id, legacy_id FROM hospitals WHERE legacy_id IS NOT NULL');
  for (const r of pgH.rows) hospitalLookup[r.legacy_id] = r.id;

  const healthInsLookup = {};
  try {
    const pgHI = await pgPool.query('SELECT id, code, country_code FROM health_insurance_companies');
    for (const r of pgHI.rows) healthInsLookup[`${r.code}_${r.country_code}`] = r.id;
  } catch (e) { log(`WARN health_insurance_companies: ${e.message}`); }

  // ---------- MSSQL: všetci spolupracovníci ----------
  const collabs = await mssqlPool.request().query(`
    SELECT d.doc_id, d.per_id, d.cty_id, d.rer_id, d.add_id, d.add_id_firm,
           d.doc_active, d.doc_note, d.doc_IBAN, d.doc_SWIFT,
           d.doc_ICO, d.doc_DIC, d.doc_IC_DPH,
           d.doc_birth_place, d.doc_client_contract, d.doc_svet_zdravia,
           d.doc_monthly_rewards, d.doc_inserted, d.doc_updated,
           ct.cty_code,
           pd.pda_title_prefix, pd.pda_first_name, pd.pda_last_name,
           pd.pda_maiden_name, pd.pda_title_suffix, pd.pda_birth_date,
           pd.pda_id_number, pd.pda_email, pd.pda_mobile, pd.pda_mobile2,
           pd.pda_phone_number, pd.pda_other_contact,
           pd.pda_health_insurance_code
    FROM Collaborators d
    LEFT JOIN CollaboratorTypes ct ON ct.cty_id = d.cty_id
    LEFT JOIN PersonalData pd ON pd.per_id = d.per_id AND pd.pda_valid = 1
    ORDER BY d.doc_id
  `);
  log(`ISCBC: ${collabs.recordset.length} spolupracovníkov`);

  const collabCountries = await mssqlPool.request().query(`
    SELECT DISTINCT ca.doc_id, c.com_country_code
    FROM CollaboratorAgreements ca
    JOIN Companies c ON c.com_id = ca.com_id
  `);
  const countryMap = {};
  for (const r of collabCountries.recordset) countryMap[r.doc_id] = normalizeCountryCode(r.com_country_code);

  const hospMap = {};
  try {
    const ch = await mssqlPool.request().query('SELECT doc_id, hos_id FROM CollaboratorsHospitals');
    for (const r of ch.recordset) {
      if (!hospMap[r.doc_id]) hospMap[r.doc_id] = [];
      hospMap[r.doc_id].push(String(r.hos_id));
    }
  } catch (e) { log(`WARN CollaboratorsHospitals: ${e.message}`); }

  // Adresy pre nových (osobné cez per_id + firemné cez add_id)
  const addressByPerId = {};
  const addressByAddId = {};
  try {
    const addrs = await mssqlPool.request().query(`
      SELECT a.add_id, a.per_id, a.mat_id, a.add_name, a.add_street_and_number,
             a.add_city, a.add_zip, a.add_area, a.add_country
      FROM MailAddresses a
      WHERE a.add_valid = 1
    `);
    for (const a of addrs.recordset) {
      addressByAddId[a.add_id] = a;
      if (!a.per_id) continue;
      if (!addressByPerId[a.per_id]) addressByPerId[a.per_id] = {};
      const type = a.mat_id === 1 ? 'permanent' : a.mat_id === 2 ? 'work' : a.mat_id === 3 ? 'correspondence' : null;
      if (type && !addressByPerId[a.per_id][type]) addressByPerId[a.per_id][type] = a;
    }
  } catch (e) { log(`WARN MailAddresses: ${e.message}`); }

  // ---------- 1. Collaborators: insert chýbajúcich + fill-in-blanks update ----------
  let inserted = 0, updated = 0, skipped = 0, errors = 0, addrInserted = 0;
  const newCollabIds = {}; // doc_id -> new pg id
  const insertedDocIds = new Set(); // doc_id, ktoré sa (by sa) úspešne vložili
  const toInsertPreview = [];

  for (const row of collabs.recordset) {
    const legacyId = String(row.doc_id);
    const countryCode = countryMap[row.doc_id] || 'SK';
    try {
      const ex = existingCollab[legacyId];
      if (ex) {
        // fill-in-blanks (len prázdne polia)
        const email = normalizeEmail(row.pda_email);
        const mobile = normalizePhone(row.pda_mobile, countryCode);
        const birthNo = normalizeNationalId(row.pda_id_number);
        const needs = (!ex.email && email) || (!ex.mobile && mobile) || (!ex.birth_number && birthNo);
        if (needs) {
          if (COMMIT) {
            await pgPool.query(`UPDATE collaborators SET
              email = COALESCE(email, $2),
              mobile = COALESCE(mobile, $3),
              birth_number = COALESCE(birth_number, $4),
              updated_at = now()
            WHERE id = $1`, [ex.id, email, mobile, birthNo]);
          }
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      // nový spolupracovník
      const firstName = normalizeName(row.pda_first_name) || 'N/A';
      const lastName = normalizeName(row.pda_last_name) || 'N/A';
      const birth = decomposeBirthDate(row.pda_birth_date);
      const hospIds = (hospMap[row.doc_id] || []).map(l => hospitalLookup[l]).filter(Boolean);
      let healthInsId = null;
      if (row.pda_health_insurance_code) {
        healthInsId = healthInsLookup[`${row.pda_health_insurance_code}_${countryCode}`] || null;
      }

      if (toInsertPreview.length < 20) toInsertPreview.push(`${legacyId} ${firstName} ${lastName} (${countryCode})`);

      if (COMMIT) {
        const client = await pgPool.connect();
        try {
        await client.query('BEGIN');
        const res = await client.query(`
          INSERT INTO collaborators (
            legacy_id, country_code, country_codes, first_name, last_name,
            title_before, maiden_name, title_after,
            birth_number, birth_day, birth_month, birth_year, birth_place,
            phone, mobile, mobile_2, other_contact, email,
            bank_account_iban, swift_code,
            client_contact, is_active, svet_zdravia, month_rewards,
            note, collaborator_type, health_insurance_id,
            hospital_ids, data_source,
            created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
          RETURNING id
        `, [
          legacyId, countryCode, [countryCode], firstName, lastName,
          row.pda_title_prefix, normalizeName(row.pda_maiden_name), row.pda_title_suffix,
          normalizeNationalId(row.pda_id_number), birth.day, birth.month, birth.year, row.doc_birth_place,
          normalizePhone(row.pda_phone_number, countryCode), normalizePhone(row.pda_mobile, countryCode), normalizePhone(row.pda_mobile2, countryCode),
          row.pda_other_contact, normalizeEmail(row.pda_email),
          row.doc_IBAN, row.doc_SWIFT,
          row.doc_client_contract === true || row.doc_client_contract === 1,
          row.doc_active === true || row.doc_active === 1,
          row.doc_svet_zdravia === true || row.doc_svet_zdravia === 1,
          row.doc_monthly_rewards === true || row.doc_monthly_rewards === 1,
          row.doc_note, normalizeCollaboratorType(row.cty_code), healthInsId,
          hospIds, 'iscbc',
          row.doc_inserted || new Date(),
          row.doc_updated || row.doc_inserted || new Date(),
        ]);
        const collabId = res.rows[0].id;
        newCollabIds[legacyId] = collabId;

        // adresy (osobné + firemná)
        const perAddr = row.per_id ? { ...(addressByPerId[row.per_id] || {}) } : {};
        if (row.add_id_firm && addressByAddId[row.add_id_firm]) {
          perAddr.company = addressByAddId[row.add_id_firm];
        }
        let addrCount = 0;
        for (const [type, addr] of Object.entries(perAddr)) {
          const suffix = type === 'correspondence' ? '_cor' : (type === 'work' ? '_work' : (type === 'company' ? '_firm' : ''));
          const addrCountry = normalizeCountryCode(addr.add_country);
          await client.query(`
            INSERT INTO collaborator_addresses (legacy_id, collaborator_id, address_type, name, street_number, city, postal_code, region, country_code)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          `, [String(addr.add_id) + suffix, collabId, type, addr.add_name, addr.add_street_and_number,
              normalizeCity(addr.add_city), normalizePostalCode(addr.add_zip, addrCountry), addr.add_area, addrCountry]);
          addrCount++;
        }
        await client.query('COMMIT');
        addrInserted += addrCount;
        } catch (txErr) {
          await client.query('ROLLBACK').catch(() => {});
          throw txErr;
        } finally {
          client.release();
        }
      }
      insertedDocIds.add(legacyId);
      inserted++;
    } catch (err) {
      errors++;
      log(`  ERROR doc_id=${legacyId}: ${err.message}`);
    }
  }

  log(`Collaborators: ${inserted} nových, ${updated} doplnených (prázdne polia), ${skipped} bez zmeny, ${errors} chýb, ${addrInserted} adries`);
  if (!COMMIT && toInsertPreview.length) {
    log(`Ukážka nových (prvých ${toInsertPreview.length}):`);
    toInsertPreview.forEach(p => log(`  + ${p}`));
  }

  // ---------- 2. Agreements: insert chýbajúcich ----------
  // refresh collabLookup (po insertoch)
  const collabLookup = {};
  const pgC2 = await pgPool.query('SELECT id, legacy_id FROM collaborators WHERE legacy_id IS NOT NULL');
  for (const r of pgC2.rows) collabLookup[r.legacy_id] = r.id;

  const agreements = await mssqlPool.request().query(`
    SELECT ca.cag_id, ca.doc_id, ca.cag_number,
           ca.cag_from, ca.cag_to,
           ca.cag_agreement_sent, ca.cag_agreement_returned,
           ca.cag_valid, ca.cag_inserted, ca.afo_id,
           ca.cag_questionaire_returned,
           ca.cag_social_insurance_registration,
           ca.cag_social_insurance_cancel,
           ca.cag_note
    FROM CollaboratorAgreements ca
    ORDER BY ca.cag_id
  `);
  log(`ISCBC: ${agreements.recordset.length} dohôd`);

  let agrInserted = 0, agrSkipped = 0, agrNoCollab = 0, agrErrors = 0;
  for (const row of agreements.recordset) {
    const legacyId = String(row.cag_id);
    if (existingAgr.has(legacyId)) { agrSkipped++; continue; }
    const collaboratorId = collabLookup[String(row.doc_id)];
    if (!collaboratorId) {
      // v dry-run nové collaborators ešte nie sú v PG — počítaj len tie, ktoré by sa reálne vložili
      if (!COMMIT && insertedDocIds.has(String(row.doc_id))) { agrInserted++; continue; }
      agrNoCollab++;
      continue;
    }
    try {
      if (COMMIT) {
        const vFrom = dmy(row.cag_from), vTo = dmy(row.cag_to);
        const sent = dmy(row.cag_agreement_sent), returned = dmy(row.cag_agreement_returned);
        const socReg = dmy(row.cag_social_insurance_registration), socCancel = dmy(row.cag_social_insurance_cancel);
        await pgPool.query(`
          INSERT INTO collaborator_agreements (
            legacy_id, collaborator_id, contract_number,
            valid_from_day, valid_from_month, valid_from_year,
            valid_to_day, valid_to_month, valid_to_year,
            agreement_sent_day, agreement_sent_month, agreement_sent_year,
            agreement_returned_day, agreement_returned_month, agreement_returned_year,
            agreement_form, is_valid, questionnaire_returned,
            social_insurance_registration_day, social_insurance_registration_month, social_insurance_registration_year,
            social_insurance_cancel_day, social_insurance_cancel_month, social_insurance_cancel_year,
            note, created_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
        `, [
          legacyId, collaboratorId, row.cag_number,
          vFrom.day, vFrom.month, vFrom.year,
          vTo.day, vTo.month, vTo.year,
          sent.day, sent.month, sent.year,
          returned.day, returned.month, returned.year,
          row.afo_id != null ? String(row.afo_id) : null,
          row.cag_valid === true || row.cag_valid === 1,
          row.cag_questionaire_returned === true || row.cag_questionaire_returned === 1,
          socReg.day, socReg.month, socReg.year,
          socCancel.day, socCancel.month, socCancel.year,
          row.cag_note || null,
          row.cag_inserted || new Date(),
        ]);
      }
      agrInserted++;
    } catch (err) {
      agrErrors++;
      log(`  ERROR cag_id=${legacyId}: ${err.message}`);
    }
  }
  log(`Agreements: ${agrInserted} nových, ${agrSkipped} existujúcich, ${agrNoCollab} bez spolupracovníka, ${agrErrors} chýb`);

  log('=== HOTOVO ===');
  if (!COMMIT) log('Toto bol DRY-RUN. Pre ostrý zápis spusti s --commit');

  await mssqlPool.close();
  await pgPool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
