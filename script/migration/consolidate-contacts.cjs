#!/usr/bin/env node
/**
 * ISCBC → INDEXUS Migration - Contact Data Consolidation
 * Normalizes phone numbers, emails, names, addresses from ISCBC format to INDEXUS format.
 * 
 * Run on Ubuntu AFTER migration phases: node consolidate-contacts.js
 * Can also be used as a library: require('./consolidate-contacts.js')
 * 
 * ISCBC phone formats found:
 *   "0903123456", "0903 123 456", "+421903123456", "+421 903 123 456"
 *   "421903123456", "00421903123456", "903123456", "903 123 456"
 *   "06301234567" (HU), "+36301234567", "00420777888999" (CZ)
 *   Sometimes garbage: "N/A", "-", ".", "xxx", empty strings
 * 
 * INDEXUS expected format:
 *   "+421 903 123 456" (prefix + space + digits grouped by 3)
 */

// pg is only needed when running as main script (not when imported as library)

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'indexus_crm',
  user: 'indexus',
  password: 'HanyurIfKisck',
};

let pgPool;
let stats = { phones_fixed: 0, emails_fixed: 0, names_fixed: 0, duplicates_found: 0, errors: 0 };

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// ============================================================
// PHONE NUMBER NORMALIZATION
// ============================================================

const COUNTRY_PREFIXES = [
  { code: 'SK', prefix: '+421', digits: '421', localPrefix: '0', localLen: 10 },
  { code: 'CZ', prefix: '+420', digits: '420', localPrefix: '0', localLen: 10 },
  { code: 'HU', prefix: '+36',  digits: '36',  localPrefix: '06', localLen: 9 },
  { code: 'RO', prefix: '+40',  digits: '40',  localPrefix: '0', localLen: 10 },
  { code: 'IT', prefix: '+39',  digits: '39',  localPrefix: '',  localLen: 10 },
  { code: 'DE', prefix: '+49',  digits: '49',  localPrefix: '0', localLen: 11 },
  { code: 'AT', prefix: '+43',  digits: '43',  localPrefix: '0', localLen: 10 },
  { code: 'CH', prefix: '+41',  digits: '41',  localPrefix: '0', localLen: 10 },
  { code: 'PL', prefix: '+48',  digits: '48',  localPrefix: '',  localLen: 9 },
];

function isGarbagePhone(val) {
  if (!val) return true;
  const cleaned = val.replace(/[\s\-\.\(\)\/]/g, '');
  if (cleaned.length < 5) return true;
  if (/^[a-zA-Z]+$/.test(cleaned)) return true;
  if (['N/A', 'n/a', 'xxx', 'XXX', '---', '...', 'none', 'žiadny', 'ziadny', 'nema', 'nemá'].includes(cleaned.toLowerCase())) return true;
  return false;
}

function formatGrouped(digits) {
  const parts = [];
  for (let i = 0; i < digits.length; i += 3) {
    parts.push(digits.slice(i, i + 3));
  }
  return parts.join(' ');
}

function normalizePhone(rawPhone, countryCode) {
  if (isGarbagePhone(rawPhone)) return null;

  let digits = rawPhone.replace(/[\s\-\.\(\)\/]/g, '');

  const hadPlus = digits.startsWith('+');
  digits = digits.replace(/[^\d]/g, '');

  if (digits.length < 5) return null;

  const country = COUNTRY_PREFIXES.find(c => c.code === countryCode) || COUNTRY_PREFIXES[0];

  // Case 1: Already has international prefix with 00
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    // Now check which country it matches
    for (const cp of COUNTRY_PREFIXES) {
      if (digits.startsWith(cp.digits)) {
        const number = digits.slice(cp.digits.length);
        if (number.length >= 7 && number.length <= 12) {
          return `${cp.prefix} ${formatGrouped(number)}`;
        }
      }
    }
  }

  // Case 2: Had + prefix (international format)
  if (hadPlus) {
    for (const cp of COUNTRY_PREFIXES) {
      if (digits.startsWith(cp.digits)) {
        const number = digits.slice(cp.digits.length);
        if (number.length >= 7 && number.length <= 12) {
          return `${cp.prefix} ${formatGrouped(number)}`;
        }
      }
    }
    // Unknown prefix, just format with +
    if (digits.length >= 10) {
      return `+${digits.slice(0, 3)} ${formatGrouped(digits.slice(3))}`;
    }
  }

  // Case 3: Starts with country digits without + (e.g. "421903123456")
  for (const cp of COUNTRY_PREFIXES) {
    if (digits.startsWith(cp.digits) && digits.length >= cp.digits.length + 7) {
      const number = digits.slice(cp.digits.length);
      if (number.length >= 7 && number.length <= 12) {
        return `${cp.prefix} ${formatGrouped(number)}`;
      }
    }
  }

  // Case 4: Local format with leading 0 (SK/CZ: "0903123456", HU: "06301234567")
  if (countryCode === 'HU' && digits.startsWith('06') && digits.length >= 9) {
    const number = digits.slice(2);
    return `+36 ${formatGrouped(number)}`;
  }

  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 12) {
    const number = digits.slice(1);
    return `${country.prefix} ${formatGrouped(number)}`;
  }

  // Case 5: Just digits without prefix (e.g. "903123456")
  if (digits.length >= 7 && digits.length <= 10) {
    return `${country.prefix} ${formatGrouped(digits)}`;
  }

  // Case 6: Very long number, try to split
  if (digits.length > 12) {
    // May contain multiple numbers, take first reasonable one
    const firstPart = digits.slice(0, 12);
    for (const cp of COUNTRY_PREFIXES) {
      if (firstPart.startsWith(cp.digits)) {
        const number = firstPart.slice(cp.digits.length);
        if (number.length >= 7) {
          return `${cp.prefix} ${formatGrouped(number)}`;
        }
      }
    }
  }

  // Fallback: prefix with country code
  if (digits.length >= 9 && digits.length <= 12) {
    return `${country.prefix} ${formatGrouped(digits)}`;
  }

  return null;
}

// ============================================================
// EMAIL NORMALIZATION
// ============================================================

function isGarbageEmail(val) {
  if (!val) return true;
  const trimmed = val.trim();
  if (trimmed.length < 5) return true;
  if (['N/A', 'n/a', 'xxx', '---', 'none', 'nema', 'nemá', '.', '-'].includes(trimmed.toLowerCase())) return true;
  if (trimmed.startsWith('legacy_') && trimmed.endsWith('@import.local')) return true;
  return false;
}

function normalizeEmail(rawEmail) {
  if (isGarbageEmail(rawEmail)) return null;

  let email = rawEmail.trim().toLowerCase();

  // Remove leading/trailing dots and spaces
  email = email.replace(/^[\s\.]+|[\s\.]+$/g, '');

  // Fix common typos
  email = email.replace(/\s+@\s+/g, '@');
  email = email.replace(/@\s+/g, '@');
  email = email.replace(/\s+@/g, '@');

  // Fix missing dot before domain
  email = email.replace(/@gmailcom$/i, '@gmail.com');
  email = email.replace(/@yahoocom$/i, '@yahoo.com');
  email = email.replace(/@emailcz$/i, '@email.cz');
  email = email.replace(/@seznamcz$/i, '@seznam.cz');
  email = email.replace(/@centrumsk$/i, '@centrum.sk');
  email = email.replace(/@centrumcz$/i, '@centrum.cz');
  email = email.replace(/@azetslovaksk$/i, '@azet.sk');
  email = email.replace(/@postsk$/i, '@post.sk');
  email = email.replace(/@zaborsksk$/i, '@zaborsky.sk');

  // Fix double @
  const atCount = (email.match(/@/g) || []).length;
  if (atCount > 1) {
    const firstAt = email.indexOf('@');
    email = email.slice(0, firstAt) + '@' + email.slice(firstAt + 1).replace(/@/g, '');
  }

  // Validate basic structure
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return null;

  return email;
}

// ============================================================
// NAME NORMALIZATION
// ============================================================

function normalizeName(rawName) {
  if (!rawName) return null;
  let name = rawName.trim();

  // Remove garbage
  if (['N/A', 'n/a', 'xxx', '---', '.', '-', '?'].includes(name)) return null;

  // Fix ALL CAPS → Title Case
  if (name === name.toUpperCase() && name.length > 2) {
    name = name.toLowerCase().replace(/(?:^|\s|-)(\S)/g, (m, c) => m.slice(0, -1) + c.toUpperCase());
  }

  // Fix no caps → Title Case
  if (name === name.toLowerCase() && name.length > 1) {
    name = name.replace(/(?:^|\s|-)(\S)/g, (m, c) => m.slice(0, -1) + c.toUpperCase());
  }

  // Trim extra whitespace
  name = name.replace(/\s+/g, ' ').trim();

  return name || null;
}

// ============================================================
// NATIONAL ID (Rodné číslo) NORMALIZATION
// ============================================================

function normalizeNationalId(val) {
  if (!val) return null;
  const cleaned = val.replace(/[\s\/\-]/g, '');
  if (cleaned.length < 9 || cleaned.length > 11) return null;
  if (!/^\d+$/.test(cleaned)) return null;

  // Format: XXXXXX/YYYY → with slash after 6th digit
  if (cleaned.length === 9 || cleaned.length === 10) {
    return cleaned.slice(0, 6) + '/' + cleaned.slice(6);
  }
  return cleaned;
}

// ============================================================
// ADDRESS NORMALIZATION
// ============================================================

function normalizePostalCode(zipCode, countryCode) {
  if (!zipCode) return null;
  const digits = zipCode.replace(/[\s\-]/g, '');

  if (['SK', 'CZ'].includes(countryCode)) {
    // Slovak/Czech format: XXX XX
    if (/^\d{5}$/.test(digits)) {
      return digits.slice(0, 3) + ' ' + digits.slice(3);
    }
  }
  if (countryCode === 'HU') {
    // Hungarian format: XXXX (4 digits)
    if (/^\d{4}$/.test(digits)) return digits;
  }
  if (countryCode === 'RO') {
    // Romanian format: XXXXXX (6 digits)
    if (/^\d{6}$/.test(digits)) return digits;
  }
  if (countryCode === 'DE' || countryCode === 'IT') {
    // German/Italian format: XXXXX (5 digits)
    if (/^\d{5}$/.test(digits)) return digits;
  }

  return zipCode.trim();
}

function normalizeCity(city) {
  if (!city) return null;
  let c = city.trim();
  if (['N/A', 'n/a', 'xxx', '---', '.', '-'].includes(c)) return null;

  // Fix ALL CAPS
  if (c === c.toUpperCase() && c.length > 2) {
    c = c.toLowerCase().replace(/(?:^|\s|-)(\S)/g, (m, ch) => m.slice(0, -1) + ch.toUpperCase());
  }

  return c.replace(/\s+/g, ' ').trim() || null;
}

// ============================================================
// DATABASE UPDATE FUNCTIONS
// ============================================================

async function consolidateCustomerPhones() {
  log('--- Consolidating customer phone numbers ---');
  let fixed = 0;

  const customers = await pgPool.query(`
    SELECT id, phone, mobile, mobile_2, other_contact, country, internal_id
    FROM customers WHERE internal_id IS NOT NULL
  `);

  for (const row of customers.rows) {
    const updates = {};
    const countryCode = row.country || 'SK';

    if (row.phone) {
      const normalized = normalizePhone(row.phone, countryCode);
      if (normalized && normalized !== row.phone) updates.phone = normalized;
      else if (!normalized && isGarbagePhone(row.phone)) updates.phone = null;
    }
    if (row.mobile) {
      const normalized = normalizePhone(row.mobile, countryCode);
      if (normalized && normalized !== row.mobile) updates.mobile = normalized;
      else if (!normalized && isGarbagePhone(row.mobile)) updates.mobile = null;
    }
    if (row.mobile_2) {
      const normalized = normalizePhone(row.mobile_2, countryCode);
      if (normalized && normalized !== row.mobile_2) updates.mobile_2 = normalized;
      else if (!normalized && isGarbagePhone(row.mobile_2)) updates.mobile_2 = null;
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.entries(updates).map(([k, v], i) => `"${k}" = $${i + 2}`);
      const values = Object.values(updates);
      try {
        await pgPool.query(
          `UPDATE customers SET ${setClauses.join(', ')} WHERE id = $1`,
          [row.id, ...values]
        );
        fixed++;
      } catch (err) {
        stats.errors++;
      }
    }
  }
  log(`  Customer phones: ${fixed} records updated`);
  stats.phones_fixed += fixed;
}

async function consolidateCustomerEmails() {
  log('--- Consolidating customer emails ---');
  let fixed = 0;

  const customers = await pgPool.query(`
    SELECT id, email, email_2, internal_id
    FROM customers WHERE internal_id IS NOT NULL
  `);

  for (const row of customers.rows) {
    const updates = {};

    if (row.email) {
      const normalized = normalizeEmail(row.email);
      if (normalized && normalized !== row.email) updates.email = normalized;
    }
    if (row.email_2) {
      const normalized = normalizeEmail(row.email_2);
      if (normalized && normalized !== row.email_2) updates.email_2 = normalized;
      else if (!normalized && isGarbageEmail(row.email_2)) updates.email_2 = null;
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.entries(updates).map(([k, v], i) => `"${k}" = $${i + 2}`);
      const values = Object.values(updates);
      try {
        await pgPool.query(
          `UPDATE customers SET ${setClauses.join(', ')} WHERE id = $1`,
          [row.id, ...values]
        );
        fixed++;
      } catch (err) {
        stats.errors++;
      }
    }
  }
  log(`  Customer emails: ${fixed} records updated`);
  stats.emails_fixed += fixed;
}

async function consolidateCustomerNames() {
  log('--- Consolidating customer names ---');
  let fixed = 0;

  const customers = await pgPool.query(`
    SELECT id, first_name, last_name, maiden_name, title_before, title_after,
           national_id, postal_code, city, country, internal_id
    FROM customers WHERE internal_id IS NOT NULL
  `);

  for (const row of customers.rows) {
    const updates = {};
    const countryCode = row.country || 'SK';

    // Names
    const normFirst = normalizeName(row.first_name);
    if (normFirst && normFirst !== row.first_name) updates.first_name = normFirst;

    const normLast = normalizeName(row.last_name);
    if (normLast && normLast !== row.last_name) updates.last_name = normLast;

    const normMaiden = normalizeName(row.maiden_name);
    if (row.maiden_name && normMaiden !== row.maiden_name) updates.maiden_name = normMaiden;

    // National ID (rodné číslo)
    if (row.national_id) {
      const normId = normalizeNationalId(row.national_id);
      if (normId && normId !== row.national_id) updates.national_id = normId;
    }

    // Postal code
    if (row.postal_code) {
      const normZip = normalizePostalCode(row.postal_code, countryCode);
      if (normZip && normZip !== row.postal_code) updates.postal_code = normZip;
    }

    // City
    if (row.city) {
      const normCity = normalizeCity(row.city);
      if (normCity && normCity !== row.city) updates.city = normCity;
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.entries(updates).map(([k, v], i) => `"${k}" = $${i + 2}`);
      const values = Object.values(updates);
      try {
        await pgPool.query(
          `UPDATE customers SET ${setClauses.join(', ')} WHERE id = $1`,
          [row.id, ...values]
        );
        fixed++;
      } catch (err) {
        stats.errors++;
      }
    }
  }
  log(`  Customer names/IDs/addresses: ${fixed} records updated`);
  stats.names_fixed += fixed;
}

async function consolidateCollaboratorContacts() {
  log('--- Consolidating collaborator contacts ---');
  let fixed = 0;

  const collabs = await pgPool.query(`
    SELECT id, phone, mobile, mobile_2, email, other_contact,
           first_name, last_name, maiden_name, birth_number,
           country_code, legacy_id
    FROM collaborators WHERE legacy_id IS NOT NULL
  `);

  for (const row of collabs.rows) {
    const updates = {};
    const countryCode = row.country_code || 'SK';

    // Phones
    if (row.phone) {
      const normalized = normalizePhone(row.phone, countryCode);
      if (normalized && normalized !== row.phone) updates.phone = normalized;
      else if (!normalized && isGarbagePhone(row.phone)) updates.phone = null;
    }
    if (row.mobile) {
      const normalized = normalizePhone(row.mobile, countryCode);
      if (normalized && normalized !== row.mobile) updates.mobile = normalized;
      else if (!normalized && isGarbagePhone(row.mobile)) updates.mobile = null;
    }
    if (row.mobile_2) {
      const normalized = normalizePhone(row.mobile_2, countryCode);
      if (normalized && normalized !== row.mobile_2) updates.mobile_2 = normalized;
      else if (!normalized && isGarbagePhone(row.mobile_2)) updates.mobile_2 = null;
    }

    // Email
    if (row.email) {
      const normalized = normalizeEmail(row.email);
      if (normalized && normalized !== row.email) updates.email = normalized;
    }

    // Names
    const normFirst = normalizeName(row.first_name);
    if (normFirst && normFirst !== row.first_name) updates.first_name = normFirst;
    const normLast = normalizeName(row.last_name);
    if (normLast && normLast !== row.last_name) updates.last_name = normLast;

    // Birth number
    if (row.birth_number) {
      const normId = normalizeNationalId(row.birth_number);
      if (normId && normId !== row.birth_number) updates.birth_number = normId;
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.entries(updates).map(([k, v], i) => `"${k}" = $${i + 2}`);
      const values = Object.values(updates);
      try {
        await pgPool.query(
          `UPDATE collaborators SET ${setClauses.join(', ')} WHERE id = $1`,
          [row.id, ...values]
        );
        fixed++;
      } catch (err) {
        stats.errors++;
      }
    }
  }
  log(`  Collaborator contacts: ${fixed} records updated`);
  stats.phones_fixed += fixed;
}

async function consolidateCollectionContacts() {
  log('--- Consolidating collection client contacts ---');
  let fixed = 0;

  const collections = await pgPool.query(`
    SELECT id, client_phone, client_mobile, client_first_name, client_last_name,
           client_birth_number, country_code, legacy_id
    FROM collections WHERE legacy_id IS NOT NULL
  `);

  for (const row of collections.rows) {
    const updates = {};
    const countryCode = row.country_code || 'SK';

    if (row.client_phone) {
      const normalized = normalizePhone(row.client_phone, countryCode);
      if (normalized && normalized !== row.client_phone) updates.client_phone = normalized;
      else if (!normalized && isGarbagePhone(row.client_phone)) updates.client_phone = null;
    }
    if (row.client_mobile) {
      const normalized = normalizePhone(row.client_mobile, countryCode);
      if (normalized && normalized !== row.client_mobile) updates.client_mobile = normalized;
      else if (!normalized && isGarbagePhone(row.client_mobile)) updates.client_mobile = null;
    }

    // Names
    const normFirst = normalizeName(row.client_first_name);
    if (normFirst && normFirst !== row.client_first_name) updates.client_first_name = normFirst;
    const normLast = normalizeName(row.client_last_name);
    if (normLast && normLast !== row.client_last_name) updates.client_last_name = normLast;

    // Birth number
    if (row.client_birth_number) {
      const normId = normalizeNationalId(row.client_birth_number);
      if (normId && normId !== row.client_birth_number) updates.client_birth_number = normId;
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.entries(updates).map(([k, v], i) => `"${k}" = $${i + 2}`);
      const values = Object.values(updates);
      try {
        await pgPool.query(
          `UPDATE collections SET ${setClauses.join(', ')} WHERE id = $1`,
          [row.id, ...values]
        );
        fixed++;
      } catch (err) {
        stats.errors++;
      }
    }
  }
  log(`  Collection contacts: ${fixed} records updated`);
  stats.phones_fixed += fixed;
}

async function findDuplicateEmails() {
  log('--- Checking for duplicate emails ---');

  const dupes = await pgPool.query(`
    SELECT email, COUNT(*) as cnt, array_agg(internal_id) as ids
    FROM customers
    WHERE internal_id IS NOT NULL AND email IS NOT NULL
      AND email NOT LIKE 'legacy_%@import.local'
    GROUP BY email
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `);

  if (dupes.rows.length > 0) {
    log(`  Found ${dupes.rows.length} duplicate email groups:`);
    for (const row of dupes.rows) {
      log(`    ${row.email}: ${row.cnt} records (legacy IDs: ${row.ids.join(', ')})`);
      stats.duplicates_found++;
    }
  } else {
    log('  No duplicate emails found');
  }
}

async function findDuplicatePhones() {
  log('--- Checking for duplicate phone numbers ---');

  const dupes = await pgPool.query(`
    SELECT mobile, COUNT(*) as cnt, array_agg(internal_id) as ids
    FROM customers
    WHERE internal_id IS NOT NULL AND mobile IS NOT NULL AND mobile != ''
    GROUP BY mobile
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `);

  if (dupes.rows.length > 0) {
    log(`  Found ${dupes.rows.length} duplicate mobile groups:`);
    for (const row of dupes.rows.slice(0, 20)) {
      log(`    ${row.mobile}: ${row.cnt} records (legacy IDs: ${row.ids.join(', ')})`);
      stats.duplicates_found++;
    }
    if (dupes.rows.length > 20) log(`    ... and ${dupes.rows.length - 20} more`);
  } else {
    log('  No duplicate mobiles found');
  }
}

async function generateConsolidationReport() {
  log('\n--- Consolidation Report ---');

  const totalCustomers = await pgPool.query("SELECT COUNT(*) as cnt FROM customers WHERE internal_id IS NOT NULL");
  const noEmail = await pgPool.query("SELECT COUNT(*) as cnt FROM customers WHERE internal_id IS NOT NULL AND (email IS NULL OR email LIKE 'legacy_%@import.local')");
  const noPhone = await pgPool.query("SELECT COUNT(*) as cnt FROM customers WHERE internal_id IS NOT NULL AND mobile IS NULL AND phone IS NULL");
  const noAddress = await pgPool.query("SELECT COUNT(*) as cnt FROM customers WHERE internal_id IS NOT NULL AND city IS NULL AND address IS NULL");

  const totalCollabs = await pgPool.query("SELECT COUNT(*) as cnt FROM collaborators WHERE legacy_id IS NOT NULL");
  const collabNoEmail = await pgPool.query("SELECT COUNT(*) as cnt FROM collaborators WHERE legacy_id IS NOT NULL AND email IS NULL");
  const collabNoPhone = await pgPool.query("SELECT COUNT(*) as cnt FROM collaborators WHERE legacy_id IS NOT NULL AND mobile IS NULL AND phone IS NULL");

  log(`  Customers total: ${totalCustomers.rows[0].cnt}`);
  log(`    Without valid email: ${noEmail.rows[0].cnt}`);
  log(`    Without any phone: ${noPhone.rows[0].cnt}`);
  log(`    Without address: ${noAddress.rows[0].cnt}`);
  log(`  Collaborators total: ${totalCollabs.rows[0].cnt}`);
  log(`    Without email: ${collabNoEmail.rows[0].cnt}`);
  log(`    Without phone: ${collabNoPhone.rows[0].cnt}`);

  // Sample normalized data
  log('\n--- Sample Normalized Customers ---');
  const samples = await pgPool.query(`
    SELECT internal_id, first_name, last_name, email, mobile, phone, national_id, postal_code, city, country
    FROM customers WHERE internal_id IS NOT NULL AND mobile IS NOT NULL
    ORDER BY created_at DESC LIMIT 5
  `);
  for (const r of samples.rows) {
    log(`  [${r.internal_id}] ${r.first_name} ${r.last_name} | ${r.email || '-'} | mob: ${r.mobile || '-'} | tel: ${r.phone || '-'} | RČ: ${r.national_id || '-'} | ${r.postal_code || '-'} ${r.city || '-'} (${r.country})`);
  }

  log('\n--- Sample Normalized Collaborators ---');
  const collabSamples = await pgPool.query(`
    SELECT legacy_id, first_name, last_name, email, mobile, phone, birth_number, country_code
    FROM collaborators WHERE legacy_id IS NOT NULL AND mobile IS NOT NULL
    ORDER BY created_at DESC LIMIT 5
  `);
  for (const r of collabSamples.rows) {
    log(`  [${r.legacy_id}] ${r.first_name} ${r.last_name} | ${r.email || '-'} | mob: ${r.mobile || '-'} | tel: ${r.phone || '-'} | RČ: ${r.birth_number || '-'} (${r.country_code})`);
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  log('=== ISCBC → INDEXUS Contact Data Consolidation ===\n');

  try {
    pgPool = new (require('pg').Pool)(PG_CONFIG);
    await pgPool.query('SELECT 1');
    log('Connected to PostgreSQL');

    await consolidateCustomerPhones();
    await consolidateCustomerEmails();
    await consolidateCustomerNames();
    await consolidateCollaboratorContacts();
    await consolidateCollectionContacts();
    await findDuplicateEmails();
    await findDuplicatePhones();
    await generateConsolidationReport();

    log('\n=== Summary ===');
    log(`  Phone numbers fixed: ${stats.phones_fixed}`);
    log(`  Emails fixed: ${stats.emails_fixed}`);
    log(`  Names/IDs/addresses fixed: ${stats.names_fixed}`);
    log(`  Duplicate groups found: ${stats.duplicates_found}`);
    log(`  Errors: ${stats.errors}`);
    log('\n=== Consolidation Complete ===');
  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await pgPool?.end();
  }
}

module.exports = { normalizePhone, normalizeEmail, normalizeName, normalizeNationalId, normalizePostalCode, normalizeCity };

if (require.main === module) {
  main();
}
