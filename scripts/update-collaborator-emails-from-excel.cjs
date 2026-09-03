#!/usr/bin/env node
/**
 * Update collaborator emails from the workbook after an ID-based comparison.
 *
 * Default mode is dry-run. Use --commit to write only rows whose Excel ID
 * already exists in collaborators and whose email differs or is empty.
 *
 * Usage:
 *   node scripts/update-collaborator-emails-from-excel.cjs \
 *     --xlsx /tmp/emailspolupracovniciCZ2026.xlsx
 *   node scripts/update-collaborator-emails-from-excel.cjs \
 *     --xlsx /tmp/emailspolupracovniciCZ2026.xlsx --commit
 */

const fs = require("fs");
const xlsx = require("xlsx");
const { Pool } = require("pg");

const SHEET_WITH_EMAILS = "149 s emailovou adresou";
const COMMIT = process.argv.includes("--commit");

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeEmail(value) {
  return text(value).toLowerCase().replace(/\s+/g, "");
}

function normalizeId(value) {
  return text(value).replace(/\.0+$/, "");
}

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = process.env.CRM_ENV_FILE || "/var/www/indexus-crm/.env";
  if (!fs.existsSync(envPath)) {
    throw new Error(`DATABASE_URL is not set and env file was not found: ${envPath}`);
  }
  const line = fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find(value => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error(`DATABASE_URL was not found in ${envPath}`);
  let value = line.slice("DATABASE_URL=".length).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function loadExcelRows(inputPath) {
  if (!fs.existsSync(inputPath)) throw new Error(`Excel file was not found: ${inputPath}`);
  const workbook = xlsx.readFile(inputPath, { cellDates: false });
  if (!workbook.SheetNames.includes(SHEET_WITH_EMAILS)) {
    throw new Error(`Required sheet "${SHEET_WITH_EMAILS}" was not found`);
  }
  return xlsx.utils.sheet_to_json(workbook.Sheets[SHEET_WITH_EMAILS], {
    defval: "",
    raw: false,
  }).map((row, index) => ({
    excelRow: index + 2,
    legacyId: normalizeId(row["ID spolupracovíka"] || row["ID spolupracovníka"]),
    name: text(row["Plné meno"]),
    email: normalizeEmail(row.Email),
  })).filter(row => row.legacyId || row.email);
}

async function main() {
  const inputPath = argument("--xlsx");
  if (!inputPath) throw new Error("Missing --xlsx argument");

  const excelRows = loadExcelRows(inputPath);
  const legacyIds = [...new Set(excelRows.map(row => row.legacyId).filter(Boolean))];
  const pool = new Pool({ connectionString: readDatabaseUrl() });

  try {
    const result = await pool.query(
      `SELECT id, legacy_id, first_name, last_name, email
         FROM collaborators
        WHERE legacy_id = ANY($1::text[])
        ORDER BY legacy_id`,
      [legacyIds],
    );

    const byLegacyId = new Map();
    for (const row of result.rows) {
      const key = normalizeId(row.legacy_id);
      if (!byLegacyId.has(key)) byLegacyId.set(key, []);
      byLegacyId.get(key).push(row);
    }

    const changes = [];
    const skipped = [];
    const duplicateEmail = [];

    for (const excel of excelRows) {
      if (!excel.legacyId || !excel.email) continue;
      const matches = byLegacyId.get(excel.legacyId) || [];
      if (matches.length === 0) {
        skipped.push(`${excel.legacyId} | ${excel.name} | NOT_FOUND`);
        continue;
      }
      if (matches.length > 1) {
        skipped.push(`${excel.legacyId} | ${excel.name} | MULTIPLE_DB_ROWS`);
        continue;
      }

      const dbRow = matches[0];
      const sameEmail = normalizeEmail(dbRow.email) === excel.email;
      if (sameEmail) continue;

      const existingEmailOwner = await pool.query(
        `SELECT legacy_id, first_name, last_name
           FROM collaborators
          WHERE LOWER(TRIM(email)) = $1
            AND id <> $2
          LIMIT 1`,
        [excel.email, dbRow.id],
      );
      if (existingEmailOwner.rows.length > 0) {
        duplicateEmail.push({
          excel,
          owner: existingEmailOwner.rows[0],
        });
        continue;
      }

      changes.push({ excel, dbRow });
    }

    console.log(`Režim: ${COMMIT ? "COMMIT (ostrý zápis)" : "DRY-RUN (nič sa nezapíše)"}`);
    console.log(`Navrhnutých zmien: ${changes.length}`);
    for (const { excel, dbRow } of changes) {
      console.log(
        `  ${excel.legacyId} | ${excel.name} | ` +
        `${dbRow.email || "(bez emailu)"} -> ${excel.email}`
      );
    }

    if (skipped.length > 0) {
      console.log(`Preskočené záznamy: ${skipped.length}`);
      skipped.forEach(row => console.log(`  ${row}`));
    }
    if (duplicateEmail.length > 0) {
      console.log(`Preskočené kvôli duplicitnému emailu: ${duplicateEmail.length}`);
      duplicateEmail.forEach(({ excel, owner }) => console.log(
        `  ${excel.legacyId} | ${excel.email} už patrí ID ${owner.legacy_id}`
      ));
    }

    if (!COMMIT || changes.length === 0) return;

    let updated = 0;
    for (const { excel, dbRow } of changes) {
      const update = await pool.query(
        `UPDATE collaborators
            SET email = $1, updated_at = now()
          WHERE id = $2
            AND legacy_id = $3
            AND email IS NOT DISTINCT FROM $4
        RETURNING id, legacy_id, email`,
        [excel.email, dbRow.id, excel.legacyId, dbRow.email || null],
      );
      if (update.rowCount !== 1) {
        throw new Error(`Concurrent change detected for collaborator ${excel.legacyId}; no update applied`);
      }
      updated++;
    }
    console.log(`Aktualizovaných collaborator emailov: ${updated}`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});