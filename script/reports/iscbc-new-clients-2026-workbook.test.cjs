"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const XLSX = require("xlsx");
const { DATA, NOTES, CTE, noteQuery, clientScope, readAll, hasNote } = require("./iscbc-new-clients-2026-source.cjs");
const {
  buildModel, makeWorkbook, verifyWorkbook, billing, paymentFrequency, collectionStatus,
  splitText, excelDate,
} = require("./iscbc-new-clients-2026-workbook.cjs");
const { clientOverview, clientNoteRows } = require("./iscbc-new-clients-2026-client-sheet.cjs");
const {
  validateCounts, validateReportScope, privateOutput, equalCounts, exportReport, exportReports,
  COUNTS, COHORT_COUNTS, ANNOUNCEMENT_CANDIDATES,
} = require("./iscbc-new-clients-2026-export.cjs");
const { COHORT } = require("./iscbc-new-clients-2026.cjs");
const { COLLECTION_COHORT, REPORTS, scopedQuery, inPeriod } = require("./iscbc-new-clients-2026-scope.cjs");
const SHEETS = ["Klienti a odbery", "Platobné podmienky", "Poznámky"];

function fixture() {
  const data = Object.fromEntries(DATA.map(([name]) => [name, []]));
  data.clients = [
    { cli_id: "1", per_id: "11", pda_id: "111", pda_first_name: "=NOT_A_FORMULA",
      pda_last_name: "Test", cli_inserted: "2026-01-01 00:00:00.000", com_country_code: "COUNTRY_SK" },
    { cli_id: "2", per_id: "22", pda_id: "222", pda_first_name: "Fixture", pda_last_name: "Two",
      cli_inserted: "2026-12-31 23:59:59.997", cli_deleted: true, com_country_code: null },
    { cli_id: "3", per_id: "33", pda_id: null, cli_inserted: "2026-02-01 12:00:00.000" },
  ];
  data.contracts = [{ con_id: "10", cli_id: "2", con_number: "000001", csa_code: "REG_CSA_CANCELLED",
    con_cancelled: "2026-10-01 00:00:00.000", con_expected_collection_date: "2026-04-01 00:00:00.000",
    cur_code: "EUR" }];
  data.services = [
    { cse_id: "100", con_id: "10", sco_id: "50", sin_id: "4", sin_name: "Fixture storage",
      ser_is_storable: true, cse_active: true },
    { cse_id: "101", con_id: "10", sco_id: "50", sin_id: "5", sin_name: "Fixture collection",
      ser_is_collectable: true, ser_is_storable: false },
    { cse_id: "102", con_id: "10", sco_id: "51", sin_id: "4", ser_is_storable: true },
    { cse_id: "103", con_id: "10", sco_id: null, sin_id: "5", ser_is_collectable: true },
  ];
  data.collections = [
    { sco_id: "50", csu_code: "REG_CSU_STORED", sco_collection_made: "2026-03-29 09:30:00.000" },
    { sco_id: "51", csu_code: "REG_CSU_CANCELLED" },
  ];
  data.invoicing = [{ sii_id: "500", sin_id: "4", sii_invoicing_period: 10, com_name: "Fixture billing" }];
  data.history = [
    { hcs_id: "600", cse_id: "100", hcs_actual: false, hcs_from: "2026-01-01 00:00:00.000" },
    { hcs_id: "601", cse_id: "100", hcs_actual: true, hcs_from: "2026-06-01 00:00:00.000" },
  ];
  data.schedules = [
    { csh_id: "700", hcs_id: "600", csh_name: "Saved old plan", pty_name: "Payment in 3 monthly payments", pty_installments_count: 3 },
    { csh_id: "701", hcs_id: "601", csh_name: "Saved current plan", pty_name: "Single payment", pty_installments_count: 1 },
  ];
  data.installments = [
    { csy_id: "800", csh_id: "700", csy_name: "+literal", amount: "10.0000", csy_days_from_previous: 30 },
    { csy_id: "801", csh_id: "701", csy_name: "@literal", amount: "20.0000" },
  ];
  data.scheduled = [
    { spa_id: "900", csy_id: "800", spa_date_of_payment: "2026-03-01 00:00:00.000",
      amount: "10.0000", currency: "EUR" },
    { spa_id: "901", csy_id: "800", spa_date_of_payment: "2026-04-01 00:00:00.000",
      amount: "10.0000", currency: "EUR" },
  ];
  const spec = NOTES.find(s => s.table === "Remarks");
  const long = "=literal\r\n" + "a".repeat(29988) + "😀" + "b".repeat(40000) + "\u0001";
  const rows = [
    { rem_id: "1000", cli_id: "2", con_id: "10", _clients: "2", rem_note: long, _at: "2026-03-29 09:30:00.000", _author: "fixture" },
    { rem_id: "1001", cli_id: "2", con_id: "10", _clients: "2", rem_note: "  text with spaces  " },
  ];
  return { data, notes: [{ spec, rows, counts: { n0: "2", d0: "1" } }], fingerprints: {} };
}
test("preserves every client and distinct contract/collection pair without service multiplication", () => {
  const model = buildModel(fixture());
  assert.equal(model.stats.clients, 3);
  assert.equal(model.stats.no_contract, 2);
  assert.equal(model.stats.no_collection, 2);
  assert.equal(model.stats.collections, 2);
  assert.equal(model.main.filter(row => row.collection === "50").length, 1);
  assert.equal(model.main.find(row => row.collection === "50").services, "100; 101");
  assert.match(model.main.find(row => row.collection === "50").warning, /Zmluva je zrušená/);
  assert.equal(model.main.find(row => row.collection === "51").status, "Zrušený");
  assert.ok(model.main.every(row => row.ordered === null));
  assert.match(model.main.find(row => row.services === "103").status, /Neurčený/);
  assert.equal(model.stats.missing_identity, 1);
});
test("preserves multiple histories, plans and prescriptions without a Cartesian product", () => {
  const extraction = fixture(), model = buildModel(extraction);
  assert.equal(model.payments.length, 4 + 2 + 2 + 2 + 2);
  assert.equal(model.payments.filter(r => r.type === "Definícia splátky").length, 2);
  assert.equal(model.payments.filter(r => r.type === "Predpis – nie úhrada").length, 2);
  assert.equal(model.payments.find(r => r.schedule === "700").current, "Nie");
  assert.equal(model.payments.find(r => r.schedule === "701").current, "Áno");
  assert.equal(model.payments.find(r => r.scheduled === "900").schedule, "700");
});
test("billing years never come from installments, storage duration or non-storage defaults", () => {
  const storage = { ser_is_storable: true };
  assert.equal(billing(storage, [{ sii_invoicing_period: 1 }]).label, "Ročná fakturácia");
  assert.equal(billing(storage, [{ sii_invoicing_period: 20 }]).years, 20);
  assert.equal(billing(storage, [{ sii_invoicing_period: 1 }, { sii_invoicing_period: 10 }]).label, "Neurčené");
  assert.equal(billing(storage, []).years, null);
  assert.equal(billing({ ser_is_storable: false }, [{ sii_invoicing_period: 1 }]).years, null);
  assert.equal(billing({}, [{ sii_invoicing_period: 1 }]).label, "Neurčené");
  assert.equal(paymentFrequency("Payment in 12 installments", 12), "Neurčená periodicita splátok");
  assert.equal(paymentFrequency("4 Quartalszahlungen", 4), "Štvrťročné splátky");
});
test("unknown dates and states are not silently replaced", () => {
  assert.equal(collectionStatus({ csu_code: "REG_CSU_NEW" }), "Neurčený");
  assert.equal(excelDate(null), null);
  assert.throws(() => excelDate("2026-02-30 00:00:00.000"), { code: "INVALID_SOURCE_DATE" });
  assert.equal(excelDate("2026-03-29 09:30:00.000").v,
    Date.UTC(2026, 2, 29, 9, 30) / 86400000 + 25569);
});
test("overlapping note links export once, full long text survives numbered continuations", () => {
  const extraction = fixture(), model = buildModel(extraction);
  assert.equal(model.stats.notes, 2);
  assert.equal(model.stats.excluded_deleted_notes, 1);
  const rows = model.notes.filter(r => r.id?.startsWith("rem_id=1000;"));
  assert.equal(rows.length, 3);
  assert.equal(rows.map(r => r.text).join(""), extraction.notes[0].rows[0].rem_note);
  assert.ok(rows.every(r => r.text.length <= 30000 && !/[\ud800-\udbff]$/.test(r.text)));
  assert.equal(splitText("😀".repeat(20000)).join(""), "😀".repeat(20000));
});
test("three filtered sheets retain typed dates, source detail and every requested overview column without initials", () => {
  const model = buildModel(fixture());
  const { wb, expected } = makeWorkbook(XLSX, model, { utc: "fixture", bratislava: "fixture",
    limitations: "synthetic fixture only", countries: "fixture" });
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true });
  verifyWorkbook(XLSX, buffer, expected);
  const read = XLSX.read(buffer, { type: "buffer" });
  assert.deepEqual(read.SheetNames, SHEETS);
  const headers = XLSX.utils.sheet_to_json(read.Sheets[SHEETS[0]], { header: 1 })[13];
  assert.ok(!headers.includes("Iniciály"));
  for (const label of ["Klient označený ako odstránený", "Časť klienta", "Počet častí klienta",
    "Počet zmlúv", "Počet samostatných odberov", "Ročné / viacročné nastavenie",
    "Roky fakturačného obdobia", "Periodicita splátok"]) assert.ok(headers.includes(label), label);
  const dateColumn = headers.indexOf("Skutočný dátum odberu");
  const date = Object.entries(read.Sheets[SHEETS[0]]).find(([address, cell]) =>
    !address.startsWith("!") && XLSX.utils.decode_cell(address).r > 13 &&
    XLSX.utils.decode_cell(address).c === dateColumn && cell.v != null)?.[1];
  assert.equal(date.t, "n");
  for (const title of read.SheetNames) for (const [key, value] of Object.entries(read.Sheets[title])) {
    if (key.startsWith("!")) continue;
    assert.equal(value.f, undefined);
  }
});
test("overview adds client summaries without letting notes or plans multiply collection rows", () => {
  const extraction = fixture(), model = buildModel(extraction);
  const { records } = clientOverview(model);
  assert.equal(records.filter(r => r.part === 1).length, 3);
  assert.equal(records.length, model.main.length);
  const rows = records.filter(r => r.client === "2");
  assert.equal(rows[0].contracts, 1);
  assert.equal(rows[0].collections, 2);
  assert.equal(rows[0].periodCollections, 1);
  assert.equal(rows[0].years, "10");
  assert.ok(rows.every((r, i) => r.part === i + 1 && r.parts === rows.length && r.last === "Two"));
  assert.equal(rows.filter(r => r.collection === "50").length, 1);
  assert.equal(rows.find(r => r.collection === "50").inPeriod, "Áno");
  assert.equal(rows.find(r => r.collection === "51").inPeriod, "Bez skutočného dátumu odberu");
  assert.ok(rows.every(r => r.frequency.includes("Mesačné splátky")));
  const withoutContract = records.find(r => r.client === "1");
  assert.equal(withoutContract.contracts, 0);
  assert.equal(withoutContract.parts, 1);
  const noteRows = clientNoteRows(model);
  for (const note of extraction.notes[0].rows) {
    const parts = noteRows.filter(r => r.client === "2" && r.id?.startsWith(`rem_id=${note.rem_id};`));
    assert.equal(parts.map(r => r.text).join(""), note.rem_note);
  }
  assert.equal(model.stats.client_note_links, 2);
  assert.equal(noteRows.filter(r => r.type === "Kontrola zdroja").length, model.controls.length);
});
test("a shared note is attributed once per proven client without multiplying other client details", () => {
  const extraction = fixture();
  extraction.notes[0].rows[0]._clients = "1,2";
  const model = buildModel(extraction), records = clientNoteRows(model);
  for (const id of ["1", "2"]) {
    const parts = records.filter(r => r.client === id && r.id?.startsWith("rem_id=1000;"));
    assert.equal(parts.map(r => r.text).join(""), extraction.notes[0].rows[0].rem_note);
    assert.deepEqual(parts.map(r => r.part), [1, 2, 3]);
  }
  assert.equal(model.stats.notes, 2);
  assert.equal(model.stats.client_note_links, 3);
  extraction.notes[0].rows[0]._clients = "";
  assert.throws(() => buildModel(extraction), { code: "NOTE_CLIENT_LINK_MISSING" });
});
test("note ownership reuses every original indirect scope and never guesses can_client_id", () => {
  for (const spec of NOTES) {
    const scoped = clientScope(spec.scope);
    assert.doesNotMatch(scoped, /\bFROM (Cohort|Con|CS|SC|Pot)\b/);
    assert.match(scoped, /nc\.(cli_id|per_id|pot_id)/);
    assert.match(noteQuery(spec), /AS _clients/);
  }
  const remarks = clientScope(NOTES.find(s => s.table === "Remarks").scope);
  assert.match(remarks, /oc\.cli_id=nc\.cli_id/);
  assert.match(remarks, /op\.cnt_id/);
  assert.match(remarks, /op\.cnt_id IS NOT NULL/);
  const announcement = clientScope(NOTES.find(s => s.table === "CollectionAnnouncements").scope);
  assert.doesNotMatch(announcement, /can_client_id/);
  assert.match(announcement, /s\.sco_id/);
});
test("duplicate identity is rejected rather than arbitrarily choosing a person", () => {
  const extraction = fixture();
  extraction.data.clients.push({ ...extraction.data.clients[0], pda_id: "another" });
  assert.throws(() => buildModel(extraction), { code: "DUPLICATE_OR_MISSING_ID" });
});
test("independent source counts and source stability must match", () => {
  const model = buildModel(fixture());
  const counts = { clients: "3", contracts: "1", services: "4", collections: "2",
    new_clients: "3", older_clients: "0", other_creation_clients: "0", period_clients: "1", period_collections: "1" };
  const cohort = { clients: "3", marked_deleted: "1", no_contract: "2", no_collection: "2" };
  validateCounts(model, counts, cohort);
  assert.throws(() => validateCounts(model, { ...counts, clients: "4" }, cohort),
    { code: "SOURCE_COUNT_MISMATCH" });
  assert.equal(equalCounts({ a: "hash" }, { a: "other" }), false);
});
test("output lives in a fresh operator-private directory, with no static mount", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cbc-fixture-home-"));
  try {
    const files = privateOutput(home);
    assert.equal(fs.statSync(files.dir).mode & 0o777, 0o700);
    assert.ok(files.file.startsWith(home + path.sep));
    assert.equal(fs.existsSync(files.file), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
test("source queries never write, fetch bank identities or join notes to installments", () => {
  const queries = [...DATA.map(([, sql]) => `${CTE} ${sql}`),
    ...NOTES.flatMap(spec => [noteQuery(spec), noteQuery(spec, true)])];
  for (const sql of queries.flatMap(sql => Object.keys(REPORTS).map(key => scopedQuery(sql, key)))) {
    assert.match(sql.trim(), /^WITH\b/);
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|EXEC|MERGE|TRUNCATE|INTO)\b/i);
    assert.doesNotMatch(sql, /\b(pda_id_number|pda_id_card|pda_IBAN|pda_birth_date|rpa_from_account_number)\b/i);
  }
  const remarks = noteQuery(NOTES.find(s => s.table === "Remarks"));
  assert.match(remarks, /rem_deleted/);
  assert.match(remarks, /s\.\[rem_note\]/);
  assert.ok(COHORT.includes(">= '20260101'") && COHORT.includes("< '20270101'"));
});
test("scheduled-payment notes never assume nonexistent inserted columns", () => {
  const query = noteQuery(NOTES.find(spec => spec.table === "ScheduledPayments"));
  assert.match(query, /s\.\[spa_updated\]/);
  assert.match(query, /s\.\[spa_updated_by\]/);
  assert.doesNotMatch(query, /spa_inserted/);
  const clientQuery = noteQuery(NOTES.find(spec => spec.table === "Clients"));
  assert.match(clientQuery, /COALESCE\(s\.\[cli_updated\],s\.\[cli_inserted\]\)/);
});
test("source note count disagreement blocks export", async () => {
  let phase = 0;
  const pool = { request: () => ({ query: async () => {
    if (phase++ < DATA.length) return { recordset: [] };
    if (phase === DATA.length + 1) return { recordset: [{ n0: "1", d0: "0", n1: "0", d1: "0" }] };
    return { recordset: [] };
  } }) };
  await assert.rejects(readAll(pool), { code: "NOTE_COUNT_MISMATCH" });
});

function collectionFixture() {
  const extraction = fixture(), d = extraction.data;
  d.clients = d.clients.filter(c => c.cli_id !== "3");
  d.clients[1].cli_inserted = "2025-12-31 23:59:59.997";
  d.contracts.push({ con_id: "20", cli_id: "1", con_number: "000002", cur_code: "EUR" });
  d.services.push(
    { cse_id: "200", con_id: "20", sco_id: "52", sin_id: "5", ser_is_collectable: true },
    { cse_id: "201", con_id: "10", sco_id: "53", sin_id: "5", ser_is_collectable: true },
    { cse_id: "202", con_id: "10", sco_id: "54", sin_id: "5", ser_is_collectable: true },
  );
  d.collections.push(
    { sco_id: "52", sco_collection_made: "2026-01-01 00:00:00.000" },
    { sco_id: "53", sco_collection_made: "2025-12-31 23:59:59.997" },
    { sco_id: "54", sco_collection_made: "2027-01-01 00:00:00.000" },
  );
  return extraction;
}
function fixturePool(changeDuringSecondRead = false, report = "new_clients", extraction = fixture()) {
  const queries = new Map(), d = extraction.data, model = buildModel(extraction);
  const put = (sql, rows) => queries.set(scopedQuery(sql, report), rows);
  for (const [name, sql] of DATA) put(`${CTE} ${sql}`, extraction.data[name]);
  for (const spec of NOTES) {
    const present = extraction.notes.find(n => n.spec.table === spec.table);
    const rows = present?.rows || [], counts = {};
    spec.fields.forEach((f, i) => {
      counts[`n${i}`] = String(rows.filter(r => hasNote(r[f])).length);
      counts[`d${i}`] = present?.counts[`d${i}`] || "0";
    });
    put(noteQuery(spec), rows);
    put(noteQuery(spec, true), [counts]);
  }
  put(COUNTS, [Object.fromEntries(["clients", "contracts", "services", "collections", "new_clients",
    "older_clients", "other_creation_clients", "period_clients", "period_collections"].map(k => [k, String(model.stats[k])]))]);
  put(COHORT_COUNTS, [{ clients: String(d.clients.length), marked_deleted: String(model.stats.marked_deleted),
    no_person: "0", no_contract: String(model.stats.no_contract), no_collection: String(model.stats.no_collection) }]);
  put(ANNOUNCEMENT_CANDIDATES, [{ unverified_note_links: "0" }]);
  let clientReads = 0;
  return { request: () => ({ query: async sql => {
    if (sql.startsWith("SELECT CONVERT(varchar(23),GETUTCDATE(),121)")) {
      return { recordset: [{ utc_time: "2026-11-16 09:00:00.000", source_wall_time: "2026-11-16 10:00:00.000" }] };
    }
    assert.ok(queries.has(sql), "Unexpected synthetic query");
    let rows = queries.get(sql);
    if (sql === scopedQuery(`${CTE} ${DATA[0][1]}`, report) && ++clientReads === 2 && changeDuringSecondRead) {
      rows = rows.map((r, i) => i === 0 ? { ...r, pda_first_name: "changed synthetic value" } : r);
    }
    return { recordset: rows };
  } }) };
}
test("complete offline run creates a private validated workbook and aggregate-only output", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cbc-report-success-")), logs = [];
  try {
    const result = await exportReport(fixturePool(), process.cwd(), text => logs.push(text), { home });
    assert.equal(fs.statSync(result.file).mode & 0o777, 0o600);
    assert.equal(result.stats.clients, 3);
    assert.equal(result.stats.notes, 2);
    assert.match(logs.join("\n"), /CBC_REPORT_OK/);
    assert.doesNotMatch(logs.join("\n"), /NOT_A_FORMULA|text with spaces|Saved old plan/);
    const wb = XLSX.readFile(result.file);
    assert.deepEqual(wb.SheetNames, SHEETS);
    assert.equal(path.basename(result.file), "novi-klienti-2026.xlsx");
    assert.equal(fs.existsSync(path.join(path.dirname(result.file), "report.partial.xlsx")), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
test("two cohort predicates use different verified dates without rewriting independent year counts", () => {
  assert.match(COLLECTION_COHORT, /EXISTS/);
  assert.match(COLLECTION_COHORT, /rsc\.sco_collection_made >= '20260101'/);
  assert.match(COLLECTION_COHORT, /rsc\.sco_collection_made < '20270101'/);
  assert.doesNotMatch(COLLECTION_COHORT, /cli_inserted|con_inserted|cancelled|deleted|country/i);
  const sql = scopedQuery(COUNTS, "collection_clients");
  assert.match(sql, /WHERE c\.cli_inserted >= '20260101'\s+AND c\.cli_inserted < '20270101'\) AS new_clients/);
  assert.doesNotMatch(sql, /CBC_REPORT_COHORT/);
  for (const value of ["2026-01-01 00:00:00.000", "2026-12-31 23:59:59.997"]) assert.ok(inPeriod(value));
  for (const value of [null, "2025-12-31 23:59:59.997", "2027-01-01 00:00:00.000"]) assert.equal(inPeriod(value), false);
  assert.throws(() => scopedQuery(COUNTS, "unknown"), { code: "UNKNOWN_REPORT_SCOPE" });
  assert.throws(() => validateReportScope(buildModel(fixture()), "collection_clients"), { code: "REPORT_COHORT_MISMATCH" });
  assert.throws(() => validateReportScope(buildModel(collectionFixture()), "new_clients"), { code: "REPORT_COHORT_MISMATCH" });
});
test("collection cohort includes older and new clients and labels historical collections separately", () => {
  const model = buildModel(collectionFixture());
  validateReportScope(model, "collection_clients");
  assert.equal(model.stats.clients, 2);
  assert.equal(model.stats.new_clients, 1);
  assert.equal(model.stats.older_clients, 1);
  assert.equal(model.stats.period_clients, 2);
  assert.equal(model.stats.period_collections, 2);
  assert.equal(model.stats.outside_period_collections, 2);
  assert.equal(model.stats.undated_collections, 1);
  const { records } = clientOverview(model);
  assert.equal(records.find(r => r.client === "2").newClient, "Nie");
  assert.equal(records.find(r => r.client === "1").newClient, "Áno");
  assert.equal(records.find(r => r.collection === "52").inPeriod, "Áno");
  assert.equal(records.find(r => r.collection === "53").inPeriod, "Nie – mimo roku 2026");
  assert.equal(records.find(r => r.collection === "54").inPeriod, "Nie – mimo roku 2026");
});
function bothFixturePool(failSecond = false) {
  const first = fixturePool(), second = fixturePool(failSecond, "collection_clients", collectionFixture());
  return { request: () => ({ query: sql => (sql.includes("rsc.sco_collection_made") ? second : first).request().query(sql) }) };
}
test("one run creates two distinct private workbooks with three sheets and truthful cohort metadata", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cbc-both-success-")), logs = [];
  try {
    const results = await exportReports(bothFixturePool(), process.cwd(), line => logs.push(line), { home });
    assert.deepEqual(results.map(r => path.basename(r.file)), ["novi-klienti-2026.xlsx", "klienti-s-odberom-2026.xlsx"]);
    assert.equal(new Set(results.map(r => r.file)).size, 2);
    assert.equal(results[0].stats.clients, 3);
    assert.equal(results[1].stats.clients, 2);
    assert.equal(results[1].stats.older_clients, 1);
    for (const [i, result] of results.entries()) {
      assert.equal(fs.statSync(result.file).mode & 0o777, 0o600);
      assert.equal(fs.statSync(path.dirname(result.file)).mode & 0o777, 0o700);
      const wb = XLSX.readFile(result.file);
      assert.deepEqual(wb.SheetNames, SHEETS);
      assert.match(wb.Sheets[SHEETS[0]].B4.v, i ? /sco_collection_made/ : /cli_inserted/);
    }
    assert.equal(logs.filter(l => l === "CBC_REPORT_OK").length, 2);
    assert.equal(logs.at(-1), "CBC_REPORTS_OK");
    assert.doesNotMatch(logs.join("\n"), /NOT_A_FORMULA|text with spaces|Saved old plan/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
test("second-report instability retains the valid first report but never claims both succeeded", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cbc-both-partial-")), logs = [];
  try {
    await assert.rejects(exportReports(bothFixturePool(true), process.cwd(), line => logs.push(line), { home }),
      { code: "SOURCE_CHANGED_RETRY_EXPORT", reportKey: "collection_clients" });
    const dirs = fs.readdirSync(home);
    assert.equal(dirs.length, 1);
    assert.deepEqual(fs.readdirSync(path.join(home, dirs[0])), ["novi-klienti-2026.xlsx"]);
    assert.equal(logs.filter(l => l === "CBC_REPORT_OK").length, 1);
    assert.ok(!logs.includes("CBC_REPORTS_OK"));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
test("verification reads retain fingerprints, not a second copy of client data or notes", async () => {
  const result = await readAll(fixturePool(), () => {}, { fingerprintsOnly: true });
  assert.deepEqual(result.data, {});
  assert.deepEqual(result.notes, []);
  assert.ok(result.fingerprints.clients);
  assert.ok(result.fingerprints["notes:Remarks"]);
});
test("a source edit between reads produces no output file or success message", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cbc-report-change-")), logs = [];
  try {
    await assert.rejects(exportReport(fixturePool(true), process.cwd(), text => logs.push(text), { home }),
      { code: "SOURCE_CHANGED_RETRY_EXPORT" });
    assert.deepEqual(fs.readdirSync(home), []);
    assert.doesNotMatch(logs.join("\n"), /CBC_REPORT_OK/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
