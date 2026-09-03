#!/usr/bin/env node
/**
 * Read-only comparison of the attached collaborator workbook with the
 * Ubuntu INDEXUS CRM PostgreSQL database.
 *
 * The current CRM stores "persons" in `collaborators` and DPP agreements in
 * `collaborator_agreements`.
 *
 * Usage on CORPCRM01:
 *   node scripts/check_excel_persons.cjs \
 *     --xlsx /path/to/emailspolupracovniciCZ2026.xlsx \
 *     --output /tmp/excel-person-check
 *
 * DATABASE_URL may be supplied in the environment. If it is not supplied,
 * the script reads only the DATABASE_URL line from /var/www/indexus-crm/.env
 * (or from CRM_ENV_FILE). No database data is modified.
 */

const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { Pool } = require("pg");

const SHEET_WITH_EMAILS = "149 s emailovou adresou";
const SHEET_DPP = "Iba DPP";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
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

function normalizeDpp(value) {
  const raw = text(value).toUpperCase().replace(/\s+/g, " ");
  const match = raw.match(/^DPP\s*[-:/]?\s*(\d+)$/);
  if (!match) return raw;
  // Treat DPP 0552 and DPP 552 as the same agreement number.
  return `DPP ${String(Number(match[1]))}`;
}

function firstEmailFromRow(row) {
  return Object.values(row)
    .map(value => normalizeEmail(value))
    .find(value => value.includes("@")) || "";
}

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function writeCsv(filePath, rows, columns) {
  const lines = [
    columns.map(csvCell).join(","),
    ...rows.map(row => columns.map(column => csvCell(row[column])).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
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

function loadWorkbookRows(inputPath) {
  if (!fs.existsSync(inputPath)) throw new Error(`Excel file was not found: ${inputPath}`);
  const workbook = xlsx.readFile(inputPath, { cellDates: false });
  for (const name of [SHEET_WITH_EMAILS, SHEET_DPP]) {
    if (!workbook.SheetNames.includes(name)) {
      throw new Error(`Required sheet "${name}" was not found. Available sheets: ${workbook.SheetNames.join(", ")}`);
    }
  }
  const asObjects = name => xlsx.utils.sheet_to_json(workbook.Sheets[name], {
    defval: "",
    raw: false,
  });
  return {
    emailRows: asObjects(SHEET_WITH_EMAILS).map((row, index) => ({
      excelRow: index + 2,
      collaboratorId: normalizeId(row["ID spolupracovíka"] || row["ID spolupracovníka"]),
      excelName: text(row["Plné meno"]),
      excelEmail: normalizeEmail(row.Email),
    })).filter(row => row.collaboratorId || row.excelEmail),
    dppRows: asObjects(SHEET_DPP).map((row, index) => ({
      excelRow: index + 2,
      agreementNumber: text(row["Dohoda"] || row["ID spolupracovníka"]),
      dppKey: normalizeDpp(row["Dohoda"] || row["ID spolupracovníka"]),
      // Some DPP emails are in an unnamed last column in this workbook.
      excelEmail: firstEmailFromRow(row),
    })).filter(row => row.dppKey),
  };
}

function personName(row) {
  return [row.title_before, row.first_name, row.last_name, row.title_after]
    .filter(Boolean)
    .join(" ");
}

async function main() {
  const inputPath = argument("--xlsx");
  const outputDir = argument("--output", "./excel-person-check-results");
  if (!inputPath) {
    fail("Missing --xlsx argument");
    return;
  }

  const { emailRows, dppRows } = loadWorkbookRows(inputPath);
  const pool = new Pool({ connectionString: readDatabaseUrl() });

  try {
    // Lookup by the workbook's collaborator ID. In the CRM this is legacy_id
    // and comes from the old Collaborators.doc_id.
    const collaboratorIds = [...new Set(emailRows.map(row => row.collaboratorId).filter(Boolean))];
    const collaboratorResult = await pool.query(
      `SELECT id, legacy_id, title_before, first_name, last_name, title_after,
              email, is_active
         FROM collaborators
        WHERE legacy_id = ANY($1::text[])
        ORDER BY last_name, first_name, legacy_id`,
      [collaboratorIds],
    );

    const personsByLegacyId = new Map();
    for (const row of collaboratorResult.rows) {
      const key = normalizeId(row.legacy_id);
      if (!personsByLegacyId.has(key)) personsByLegacyId.set(key, []);
      personsByLegacyId.get(key).push(row);
    }

    const emailRowsResult = emailRows.map(input => {
      const byId = personsByLegacyId.get(input.collaboratorId) || [];
      const exact = byId.filter(row => normalizeEmail(row.email) === input.excelEmail);
      const sameEmail = collaboratorResult.rows.filter(row =>
        normalizeEmail(row.email) === input.excelEmail
      );
      let status = "NOT_FOUND";
      if (exact.length > 0) status = "FOUND_ID_AND_EMAIL";
      else if (byId.length > 0) status = "FOUND_ID_EMAIL_MISMATCH";
      else if (sameEmail.length > 0) status = "FOUND_EMAIL_ONLY";

      return {
        excel_row: input.excelRow,
        excel_collaborator_id: input.collaboratorId,
        excel_name: input.excelName,
        excel_email: input.excelEmail,
        status,
        db_person_id: (exact[0] || byId[0] || sameEmail[0])?.id || "",
        db_legacy_id: (exact[0] || byId[0] || sameEmail[0])?.legacy_id || "",
        db_name: (exact[0] || byId[0] || sameEmail[0]) ? personName(exact[0] || byId[0] || sameEmail[0]) : "",
        db_email: (exact[0] || byId[0] || sameEmail[0])?.email || "",
        db_is_active: (exact[0] || byId[0] || sameEmail[0])?.is_active ?? "",
      };
    });

    // Fetch DPP agreements once and normalize only the DPP number in memory.
    // This handles workbook values such as DPP 0552 versus DB values DPP 552.
    const dppResult = await pool.query(
      `SELECT ca.id AS agreement_id, ca.contract_number, ca.collaborator_id,
              c.legacy_id, c.title_before, c.first_name, c.last_name,
              c.title_after, c.email, c.is_active
         FROM collaborator_agreements ca
         JOIN collaborators c ON c.id = ca.collaborator_id
        WHERE UPPER(TRIM(ca.contract_number)) LIKE 'DPP %'
        ORDER BY ca.contract_number, c.last_name, c.first_name`,
    );
    const agreementsByKey = new Map();
    for (const row of dppResult.rows) {
      const key = normalizeDpp(row.contract_number);
      if (!agreementsByKey.has(key)) agreementsByKey.set(key, []);
      agreementsByKey.get(key).push(row);
    }

    const uniqueDpp = new Map();
    for (const input of dppRows) {
      if (!uniqueDpp.has(input.dppKey)) uniqueDpp.set(input.dppKey, input);
    }
    const dppRowsResult = [...uniqueDpp.values()].map(input => {
      const found = agreementsByKey.get(input.dppKey) || [];
      return {
        excel_row: input.excelRow,
        excel_agreement_number: input.agreementNumber,
        normalized_agreement_number: input.dppKey,
        excel_email: input.excelEmail,
        status: found.length > 0 ? "FOUND" : "NOT_FOUND",
        found_count: found.length,
        found_persons: found.map(row => ({
          agreement_id: row.agreement_id,
          db_agreement_number: row.contract_number,
          db_person_id: row.collaborator_id,
          db_legacy_id: row.legacy_id || "",
          db_name: personName(row),
          db_email: row.email || "",
          email_status: row.email
            ? (input.excelEmail
              ? normalizeEmail(row.email) === input.excelEmail ? "EMAIL_MATCH" : "EMAIL_MISMATCH"
              : "EMAIL_FOUND")
            : "EMAIL_MISSING",
          db_is_active: row.is_active,
        })),
      };
    });

    fs.mkdirSync(outputDir, { recursive: true });
    writeCsv(path.join(outputDir, "149-email-check.csv"), emailRowsResult, [
      "excel_row", "excel_collaborator_id", "excel_name", "excel_email",
      "status", "db_person_id", "db_legacy_id", "db_name", "db_email", "db_is_active",
    ]);
    writeCsv(path.join(outputDir, "dpp-check.csv"), dppRowsResult.flatMap(row =>
      row.found_persons.length > 0
        ? row.found_persons.map(person => ({
            excel_row: row.excel_row,
            excel_agreement_number: row.excel_agreement_number,
            normalized_agreement_number: row.normalized_agreement_number,
            excel_email: row.excel_email,
            status: row.status,
            found_count: row.found_count,
            agreement_id: person.agreement_id,
            db_agreement_number: person.db_agreement_number,
            db_person_id: person.db_person_id,
            db_legacy_id: person.db_legacy_id,
            db_name: person.db_name,
            db_email: person.db_email,
            email_status: person.email_status,
            db_is_active: person.db_is_active,
          }))
        : [{
            excel_row: row.excel_row,
            excel_agreement_number: row.excel_agreement_number,
            normalized_agreement_number: row.normalized_agreement_number,
            excel_email: row.excel_email,
            status: row.status,
            found_count: row.found_count,
          }]
    ), [
      "excel_row", "excel_agreement_number", "normalized_agreement_number",
      "excel_email", "status", "found_count", "agreement_id",
      "db_agreement_number", "db_person_id", "db_legacy_id", "db_name",
      "db_email", "email_status", "db_is_active",
    ]);

    const summary = {
      source_file: path.basename(inputPath),
      email_sheet: SHEET_WITH_EMAILS,
      email_rows: emailRows.length,
      email_found_id_and_email: emailRowsResult.filter(row => row.status === "FOUND_ID_AND_EMAIL").length,
      email_found_id_email_mismatch: emailRowsResult.filter(row => row.status === "FOUND_ID_EMAIL_MISMATCH").length,
      email_found_email_only: emailRowsResult.filter(row => row.status === "FOUND_EMAIL_ONLY").length,
      email_not_found: emailRowsResult.filter(row => row.status === "NOT_FOUND").length,
      dpp_sheet: SHEET_DPP,
      dpp_unique_numbers: dppRowsResult.length,
      dpp_found_numbers: dppRowsResult.filter(row => row.status === "FOUND").length,
      dpp_not_found_numbers: dppRowsResult.filter(row => row.status === "NOT_FOUND").length,
      dpp_persons_found: dppRowsResult.reduce((count, row) => count + row.found_persons.length, 0),
      dpp_emails_present: dppRowsResult.reduce((count, row) =>
        count + row.found_persons.filter(person =>
          person.email_status === "EMAIL_FOUND" ||
          person.email_status === "EMAIL_MATCH" ||
          person.email_status === "EMAIL_MISMATCH"
        ).length, 0),
      dpp_emails_missing: dppRowsResult.reduce((count, row) =>
        count + row.found_persons.filter(person => person.email_status === "EMAIL_MISSING").length, 0),
      dpp_email_matches: dppRowsResult.reduce((count, row) =>
        count + row.found_persons.filter(person => person.email_status === "EMAIL_MATCH").length, 0),
      dpp_email_mismatches: dppRowsResult.reduce((count, row) =>
        count + row.found_persons.filter(person => person.email_status === "EMAIL_MISMATCH").length, 0),
      output_directory: path.resolve(outputDir),
    };
    fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

    console.log("=== Excel → INDEXUS persons check ===");
    console.log(`Email sheet: ${summary.email_rows} rows`);
    console.log(`  FOUND_ID_AND_EMAIL: ${summary.email_found_id_and_email}`);
    console.log(`  FOUND_ID_EMAIL_MISMATCH: ${summary.email_found_id_email_mismatch}`);
    console.log(`  FOUND_EMAIL_ONLY: ${summary.email_found_email_only}`);
    console.log(`  NOT_FOUND: ${summary.email_not_found}`);
    console.log(`DPP sheet: ${summary.dpp_unique_numbers} unique agreement numbers`);
    console.log(`  FOUND: ${summary.dpp_found_numbers}`);
    console.log(`  NOT_FOUND: ${summary.dpp_not_found_numbers}`);
    console.log(`  persons found: ${summary.dpp_persons_found}`);
    console.log(`  persons with email: ${summary.dpp_emails_present}`);
    console.log(`  persons without email: ${summary.dpp_emails_missing}`);
    if (summary.dpp_email_matches || summary.dpp_email_mismatches) {
      console.log(`  Excel/DB email matches: ${summary.dpp_email_matches}`);
      console.log(`  Excel/DB email mismatches: ${summary.dpp_email_mismatches}`);
    }

    console.log("\nPersons found by ID and email:");
    for (const row of emailRowsResult.filter(row => row.status === "FOUND_ID_AND_EMAIL")) {
      console.log(`  ${row.excel_collaborator_id} | ${row.db_name} | ${row.db_email}`);
    }
    console.log("\nPersons found through DPP agreements:");
    for (const row of dppRowsResult) {
      for (const person of row.found_persons) {
        console.log(`  ${row.excel_agreement_number} | ${person.db_legacy_id} | ${person.db_name} | ${person.db_email || "(email chýba)"} | ${person.email_status}`);
      }
    }
    console.log(`\nCSV/JSON reports written to: ${path.resolve(outputDir)}`);
  } finally {
    await pool.end();
  }
}

main().catch(error => fail(error?.message || String(error)));