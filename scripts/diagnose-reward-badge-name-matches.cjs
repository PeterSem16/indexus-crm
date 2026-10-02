#!/usr/bin/env node
/**
 * Read-only diagnostic for the reward badge workbook. Payroll personnel numbers
 * are NOT CBC doc_id / collaborators.legacy_id. Report aggregate name matches
 * only; never print names, personnel numbers, or collaborator identifiers.
 */
const fs = require("node:fs");
const { Client } = require("pg");
const XLSX = require("xlsx");
const {
  workbookPeople, nameKey, normalizeId, safeOutputPath,
} = require("./limit-unpaid-reward-badges-from-excel.cjs");

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = "/var/www/indexus-crm/.env";
  const line = fs.readFileSync(envFile, "utf8").split(/\r?\n/).find(value => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is missing from application environment");
  let value = line.slice("DATABASE_URL=".length).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!value) throw new Error("DATABASE_URL is empty");
  return value;
}

function analyzeNames(people, collaborators) {
  const byName = new Map();
  for (const row of collaborators) {
    const key = nameKey(`${row.first_name || ""} ${row.last_name || ""}`);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  }

  const excelIdsByName = new Map();
  for (const [excelId, names] of people) {
    if (names.size !== 1) continue;
    const key = [...names][0];
    if (!excelIdsByName.has(key)) excelIdsByName.set(key, new Set());
    excelIdsByName.get(key).add(excelId);
  }
  const counts = {
    uniqueExcelIds: people.size,
    conflictingExcelNames: 0,
    excelIdsSharingSameName: 0,
    noExactNameMatch: 0,
    oneActiveExactNameMatch: 0,
    oneInactiveExactNameMatch: 0,
    multipleDbRowsForName: 0,
    multipleActiveDbRowsForName: 0,
    uniqueActiveDbRows: 0,
  };
  const uniqueActiveIds = new Set();
  for (const [, names] of people) {
    if (names.size !== 1) {
      counts.conflictingExcelNames++;
      continue;
    }
    const key = [...names][0];
    if (excelIdsByName.get(key).size !== 1) {
      counts.excelIdsSharingSameName++;
      continue;
    }
    const candidates = byName.get(key) || [];
    if (!candidates.length) counts.noExactNameMatch++;
    else if (candidates.length > 1) {
      counts.multipleDbRowsForName++;
      if (candidates.filter(person => person.is_active).length > 1) counts.multipleActiveDbRowsForName++;
    } else if (candidates[0].is_active) {
      counts.oneActiveExactNameMatch++;
      uniqueActiveIds.add(candidates[0].id);
    } else counts.oneInactiveExactNameMatch++;
  }
  counts.uniqueActiveDbRows = uniqueActiveIds.size;
  return counts;
}

function reviewRows(xlsxPath, people, collaborators) {
  const book = XLSX.readFile(xlsxPath, { cellDates: false, raw: false });
  const sheetRows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {
    header: 1, raw: false, defval: "",
  });
  const excelDetails = new Map();
  for (const row of sheetRows.slice(1)) {
    if (row.every(value => String(value ?? "").trim() === "")) continue;
    const id = normalizeId(row[0]);
    if (!excelDetails.has(id)) excelDetails.set(id, { name: String(row[2]), units: new Set() });
    if (String(row[1]).trim()) excelDetails.get(id).units.add(String(row[1]).trim());
  }

  const dbByName = new Map();
  for (const row of collaborators) {
    const key = nameKey(`${row.first_name || ""} ${row.last_name || ""}`);
    if (!dbByName.has(key)) dbByName.set(key, []);
    dbByName.get(key).push(row);
  }
  const excelIdsByName = new Map();
  for (const [id, names] of people) {
    if (names.size !== 1) continue;
    const key = [...names][0];
    if (!excelIdsByName.has(key)) excelIdsByName.set(key, new Set());
    excelIdsByName.get(key).add(id);
  }

  const rows = [[
    "Osobné číslo", "Meno z Excelu", "Skratka OŠ", "Výsledok",
    "INDEXUS ID", "Meno v INDEXUS", "Aktívna karta", "CBC doc_id",
    "Krajina", "Pracovisko v INDEXUS",
  ]];
  for (const [id, names] of people) {
    const detail = excelDetails.get(id);
    const key = names.size === 1 ? [...names][0] : null;
    const candidates = key ? dbByName.get(key) || [] : [];
    const status = names.size !== 1 ? "ROZDIELNE MENÁ PRI ID"
      : excelIdsByName.get(key).size > 1 ? "ROVNAKÉ MENO PRI VIAC ID"
      : candidates.length === 0 ? "MENO SA NENAŠLO"
      : candidates.length > 1 ? "VIAC KARIET S MENOM"
      : candidates[0].is_active ? "JEDNA AKTÍVNA KARTA" : "JEDNA NEAKTÍVNA KARTA";
    for (const person of candidates.length ? candidates : [null]) {
      rows.push([
        id, detail?.name || "", [...(detail?.units || [])].sort().join("; "), status,
        person?.id || "", person ? `${person.first_name || ""} ${person.last_name || ""}`.trim() : "",
        person ? (person.is_active ? "áno" : "nie") : "",
        person?.legacy_id || "", person?.country_code || "", person?.workplace_name || "",
      ]);
    }
  }
  return rows;
}

function writePrivateReview(file, rows) {
  const safeFile = safeOutputPath(file);
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [15, 35, 24, 28, 39, 35, 16, 16, 12, 36].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(book, sheet, "Kontrola osôb");
  const content = XLSX.write(book, { bookType: "xlsx", type: "buffer" });
  const handle = fs.openSync(safeFile, "wx", 0o600);
  try { fs.writeFileSync(handle, content); }
  finally { fs.closeSync(handle); }
}

async function main() {
  if (![4, 6].includes(process.argv.length) || process.argv[2] !== "--xlsx" ||
      (process.argv.length === 6 && process.argv[4] !== "--report")) {
    throw new Error("Usage: node scripts/diagnose-reward-badge-name-matches.cjs --xlsx /private/workbook.xlsx [--report /private/review.xlsx] (read-only)");
  }
  const workbook = workbookPeople(process.argv[3]);
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const db = (await client.query("SELECT current_database() AS db")).rows[0].db;
    const rows = (await client.query(
      "SELECT id, first_name, last_name, is_active, legacy_id, country_code, workplace_name FROM collaborators"
    )).rows;
    console.log(JSON.stringify({
      database: db,
      sheet: workbook.sheet,
      excelRows: workbook.rows,
      collaboratorsInDb: rows.length,
      ...analyzeNames(workbook.people, rows),
    }, null, 2));
    await client.query("ROLLBACK");
    if (process.argv.length === 6) {
      writePrivateReview(process.argv[5], reviewRows(process.argv[3], workbook.people, rows));
      console.log("Private review file created. Do not share its contents in chat.");
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) main().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
module.exports = { analyzeNames, reviewRows, writePrivateReview };