#!/usr/bin/env node
/**
 * One-time Ubuntu maintenance: display unpaid reward badges only for persons
 * whose verified legacy ID occurs in the FIRST worksheet of a payroll workbook.
 * This never edits reward_paid, reward_paid_at, or collaborator activities.
 *
 * Read-only preview:
 *   node scripts/limit-unpaid-reward-badges-from-excel.cjs --xlsx /private/input.xlsx --id-format plain
 *
 * Apply ONLY after reviewing the private report and confirming the target DB:
 *   node scripts/limit-unpaid-reward-badges-from-excel.cjs --xlsx /private/input.xlsx \
 *     --id-format plain --commit --expect-matched N --confirm-hash SHA256 \
 *     --expect-database DATABASE_NAME --backup /private/backup.json
 *
 * Alternative format is --id-format cbc, matching legacy_id = "cbc_" + Excel ID.
 * Use the actual format shown by the preview; never infer it from the filename.
 */
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const XLSX = require("xlsx");
const { Client } = require("pg");

function fail(message) { throw new Error(message); }
function argument(name) {
  const position = process.argv.indexOf(name);
  return position < 0 ? null : process.argv[position + 1] || fail(`${name} needs a value`);
}
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = process.env.CRM_ENV_FILE || "/var/www/indexus-crm/.env";
  const line = fs.readFileSync(envFile, "utf8").split(/\r?\n/).find(value => value.startsWith("DATABASE_URL="));
  if (!line) fail(`DATABASE_URL is missing in ${envFile}`);
  let value = line.slice("DATABASE_URL=".length).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!value) fail("DATABASE_URL is empty");
  return value;
}
function digest(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function normalizeId(value) {
  const id = String(value ?? "").trim().replace(/\.0+$/, "");
  if (!/^\d{3,12}$/.test(id)) fail(`Invalid personnel number in first worksheet: ${JSON.stringify(id)}`);
  return id; // leading zeroes are significant
}
const TITLES = new Set(["bc", "mgr", "mudr", "mddr", "phdr", "phd", "ing", "doc", "prof", "dr", "rndr", "judr", "paeddr", "mph", "msc", "mba", "dis", "csc", "drc", "et", "al"]);
function nameKey(name) {
  return String(name ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter(token => token && !TITLES.has(token)).sort().join(" ");
}
function workbookPeople(xlsxPath) {
  const bytes = fs.readFileSync(xlsxPath);
  const book = XLSX.read(bytes, { type: "buffer", cellDates: false, raw: false });
  if (!book.SheetNames.length) fail("Workbook has no worksheets");
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  if (rows[0]?.[0]?.trim() !== "Osobné číslo" || rows[0]?.[2]?.trim() !== "Meno") {
    fail('The first worksheet must have "Osobné číslo" in column A and "Meno" in column C');
  }
  const people = new Map();
  let count = 0;
  for (const [index, row] of rows.entries()) {
    if (index === 0 || row.every(value => String(value ?? "").trim() === "")) continue;
    const id = normalizeId(row[0]);
    const name = nameKey(row[2]);
    if (!name || name.split(" ").length < 2) fail(`Name missing/invalid at worksheet row ${index + 1}`);
    if (!people.has(id)) people.set(id, new Set());
    people.get(id).add(name);
    count++;
  }
  if (people.size < 10) fail("Too few Excel persons; refusing a broad badge change");
  return { sheet: book.SheetNames[0], people, rows: count, fileHash: digest(bytes) };
}
function matchPeople(people, dbRows, format, aliases = []) {
  const byLegacyId = new Map();
  const byId = new Map(dbRows.map(person => [person.id, person]));
  for (const person of dbRows) {
    if (!person.legacy_id) continue;
    const key = person.legacy_id.trim();
    if (!byLegacyId.has(key)) byLegacyId.set(key, []);
    byLegacyId.get(key).push(person);
  }
  const aliasesByLegacyId = new Map();
  for (const alias of aliases) {
    if (!aliasesByLegacyId.has(alias.legacy_id)) aliasesByLegacyId.set(alias.legacy_id, []);
    aliasesByLegacyId.get(alias.legacy_id).push(alias);
  }
  const matched = new Set();
  const unmatched = [];
  const ambiguous = [];
  const nameMismatch = [];
  const conflictingNames = [];
  for (const [excelId, names] of people) {
    if (names.size !== 1) { conflictingNames.push(excelId); continue; }
    const key = format === "cbc" ? `cbc_${excelId}` : excelId;
    const direct = byLegacyId.get(key) || [];
    const redirects = aliasesByLegacyId.get(key) || [];
    if (!direct.length && !redirects.length) { unmatched.push(excelId); continue; }
    const targetIds = new Set([...direct.map(row => row.id), ...redirects.map(row => row.canonical_id)]);
    if (direct.length > 1 || targetIds.size !== 1 || targetIds.has(null)) { ambiguous.push(excelId); continue; }
    const candidate = byId.get([...targetIds][0]);
    if (!candidate || (redirects.length && candidate.is_active === false)) { ambiguous.push(excelId); continue; }
    const expected = nameKey(`${candidate.first_name || ""} ${candidate.last_name || ""}`);
    if (!expected || !names.has(expected)) { nameMismatch.push(excelId); continue; }
    matched.add(candidate.id);
  }
  return { matched, unmatched, ambiguous, nameMismatch, conflictingNames };
}
function safeOutputPath(file) {
  if (!path.isAbsolute(file)) fail("Private report/backup paths must be absolute");
  const resolved = path.resolve(file);
  const directory = fs.realpathSync(path.dirname(resolved)); // must already exist; resolves directory symlinks
  const projectRoots = [process.cwd(), "/var/www", "/srv/www"].map(root => {
    try { return fs.realpathSync(root); } catch { return path.resolve(root); }
  });
  if (projectRoots.some(root => directory === root || directory.startsWith(root + path.sep))) {
    fail("Private report/backup cannot be written inside the application/web directory");
  }
  return path.join(directory, path.basename(resolved));
}
function privateJson(file, value) {
  const safeFile = safeOutputPath(file);
  const handle = fs.openSync(safeFile, "wx", 0o600); // never overwrite a previous review or backup
  try { fs.writeFileSync(handle, JSON.stringify(value, null, 2) + "\n"); }
  finally { fs.closeSync(handle); }
}

async function main() {
  const xlsx = argument("--xlsx");
  const format = argument("--id-format");
  const commit = process.argv.includes("--commit");
  if (!xlsx || !["plain", "cbc"].includes(format)) fail("Supply --xlsx FILE and --id-format plain|cbc");
  const { sheet, people, rows, fileHash } = workbookPeople(xlsx);
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    // The same snapshot is used for the comparison, backup, and transactional update.
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const dbInfo = (await client.query("SELECT current_database() AS db, current_user AS role")).rows[0];
    const dbRows = (await client.query(
      "SELECT id, legacy_id, first_name, last_name, is_active, unpaid_reward_badge_eligible FROM collaborators ORDER BY id"
    )).rows;
    const aliases = (await client.query(
      `SELECT legacy_id, source, canonical_id
         FROM dedupe_entity_aliases
        WHERE entity_kind = 'person' AND source IN ('iscbc', 'legacy')
        ORDER BY legacy_id, source`
    )).rows;
    const result = matchPeople(people, dbRows, format, aliases);
    const otherFormat = matchPeople(people, dbRows, format === "cbc" ? "plain" : "cbc", aliases);
    const planHash = digest(JSON.stringify({
      sheet, fileHash, format, database: dbInfo.db,
      dbSnapshot: dbRows.map(person => [person.id, person.legacy_id, person.first_name, person.last_name, person.is_active, person.unpaid_reward_badge_eligible]),
      aliases: aliases.map(alias => [alias.legacy_id, alias.source, alias.canonical_id]),
      matched: [...result.matched].sort(),
    }));
    const summary = {
      sheet, excelRows: rows, uniqueExcelIds: people.size, idFormat: format,
      database: dbInfo.db, databaseRole: dbInfo.role, collaboratorsInDb: dbRows.length,
      matched: result.matched.size, unmatchedExcelIds: result.unmatched.length,
      ambiguousLegacyIds: result.ambiguous.length, nameMismatches: result.nameMismatch.length,
      conflictingExcelNames: result.conflictingNames.length,
      alternativeFormatMatches: otherFormat.matched.size,
      badgeFlagsToHide: dbRows.filter(p => !result.matched.has(p.id) && p.unpaid_reward_badge_eligible).length,
      badgeFlagsToEnable: dbRows.filter(p => result.matched.has(p.id) && !p.unpaid_reward_badge_eligible).length,
      planHash,
    };
    console.log(JSON.stringify(summary, null, 2)); // no names or DB credentials in stdout
    const review = argument("--report");
    if (review) privateJson(review, {
      summary, unmatchedExcelIds: result.unmatched, ambiguousExcelIds: result.ambiguous,
      nameMismatchExcelIds: result.nameMismatch, conflictingExcelNames: result.conflictingNames,
      matchedDbIds: [...result.matched].sort(),
    });
    if (!commit) { await client.query("ROLLBACK"); return; }
    if (result.matched.size === 0 || result.matched.size !== people.size ||
        result.unmatched.length || result.ambiguous.length || result.nameMismatch.length ||
        result.conflictingNames.length || otherFormat.matched.size) {
      fail("Commit refused: not every Excel ID maps uniquely by the selected legacy format and name; inspect private report");
    }
    if (argument("--expect-database") !== dbInfo.db ||
        Number(argument("--expect-matched")) !== result.matched.size ||
        argument("--confirm-hash") !== planHash) {
      fail("Commit refused: database, matched count, or plan hash differs from approved dry run");
    }
    const backup = argument("--backup");
    if (!backup) fail("Commit requires a private --backup path outside the web root");
    privateJson(backup, {
      database: dbInfo.db, planHash, timestamp: new Date().toISOString(),
      previous: dbRows.map(p => ({ id: p.id, unpaidRewardBadgeEligible: p.unpaid_reward_badge_eligible })),
    });
    const update = await client.query(
      `UPDATE collaborators
          SET unpaid_reward_badge_eligible = (id = ANY($1::varchar[]))
        WHERE unpaid_reward_badge_eligible IS DISTINCT FROM (id = ANY($1::varchar[]))`,
      [[...result.matched]]
    );
    if (update.rowCount !== summary.badgeFlagsToHide + summary.badgeFlagsToEnable) {
      fail("Updated count differs from the preview; transaction will be rolled back");
    }
    await client.query("COMMIT");
    console.log(`Applied ${update.rowCount} badge visibility changes; payment fields unchanged. Backup: ${backup}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) main().catch(error => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
module.exports = { normalizeId, nameKey, workbookPeople, matchPeople, safeOutputPath };