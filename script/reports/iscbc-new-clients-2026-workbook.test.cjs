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
const { clientSheet } = require("./iscbc-new-clients-2026-client-sheet.cjs");
const {
  validateCounts, privateOutput, equalCounts, exportReport, COUNTS, COHORT_COUNTS, ANNOUNCEMENT_CANDIDATES,
} = require("./iscbc-new-clients-2026-export.cjs");
const { COHORT } = require("./iscbc-new-clients-2026.cjs");

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
test("workbook round-trip retains all client-linked data in exactly one filtered sheet without initials", () => {
  const model = buildModel(fixture());
  const { wb, expected } = makeWorkbook(XLSX, model, { utc: "fixture", bratislava: "fixture",
    limitations: "synthetic fixture only", countries: "fixture" });
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true });
  verifyWorkbook(XLSX, buffer, expected);
  const read = XLSX.read(buffer, { type: "buffer" });
  assert.deepEqual(read.SheetNames, ["Klienti 2026"]);
  const headers = XLSX.utils.sheet_to_json(read.Sheets["Klienti 2026"], { header: 1 })[13];
  assert.ok(!headers.includes("Iniciály"));
  assert.ok(headers.some(h => h.includes("platobné podmienky")));
  assert.ok(headers.some(h => h.includes("poznámky")));
  for (const title of read.SheetNames) for (const [key, value] of Object.entries(read.Sheets[title])) {
    if (key.startsWith("!")) continue;
    assert.equal(value.f, undefined);
  }
});
test("one primary row per client keeps all contracts, collections, plans and complete note text together", () => {
  const extraction = fixture(), model = buildModel(extraction);
  const { records } = clientSheet(model);
  assert.equal(records.filter(r => r.type === "Klient").length, 3);
  const rows = records.filter(r => r.client === "2");
  assert.ok(rows.length > 1, "long notes need explicit continuation rows");
  assert.equal(rows[0].contracts, 1);
  assert.equal(rows[0].collections, 2);
  assert.equal(rows[0].years, "10");
  assert.ok(rows.every((r, i) => r.part === i + 1 && r.parts === rows.length && r.last === "Two"));
  const text = key => rows.map(r => r[key] || "").join("");
  assert.match(text("details"), /ID odberu: 50/);
  assert.match(text("details"), /ID odberu: 51/);
  assert.match(text("details"), /29\.03\.2026 09:30:00/);
  assert.match(text("paymentDetails"), /Saved old plan/);
  assert.match(text("paymentDetails"), /Saved current plan/);
  assert.match(text("paymentDetails"), /ID predpisu: 900/);
  assert.match(text("paymentDetails"), /ID predpisu: 901/);
  for (const row of extraction.notes[0].rows) assert.ok(text("noteDetails").includes(row.rem_note));
  assert.equal((text("noteDetails").match(/ID zdrojového záznamu: rem_id=1000;/g) || []).length, 1);
  const withoutContract = records.find(r => r.client === "1");
  assert.equal(withoutContract.contracts, 0);
  assert.doesNotMatch(withoutContract.noteDetails, /rem_id=1000/);
  assert.equal(model.stats.client_note_links, 2);
  assert.equal(records.filter(r => r.type === "Kontrola zdroja").length, model.controls.length);
});
test("a shared note is attributed once per proven client without multiplying other client details", () => {
  const extraction = fixture();
  extraction.notes[0].rows[0]._clients = "1,2";
  const model = buildModel(extraction), { records } = clientSheet(model);
  for (const id of ["1", "2"]) {
    const text = records.filter(r => r.client === id).map(r => r.noteDetails || "").join("");
    assert.ok(text.includes(extraction.notes[0].rows[0].rem_note));
    assert.equal((text.match(/ID zdrojového záznamu: rem_id=1000;/g) || []).length, 1);
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
  const counts = { clients: "3", contracts: "1", services: "4", collections: "2" };
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
  for (const sql of queries) {
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

function fixturePool(changeDuringSecondRead = false) {
  const extraction = fixture(), queries = new Map();
  for (const [name, sql] of DATA) queries.set(`${CTE} ${sql}`, extraction.data[name]);
  for (const spec of NOTES) {
    const present = extraction.notes.find(n => n.spec.table === spec.table);
    const rows = present?.rows || [], counts = {};
    spec.fields.forEach((f, i) => {
      counts[`n${i}`] = String(rows.filter(r => hasNote(r[f])).length);
      counts[`d${i}`] = present?.counts[`d${i}`] || "0";
    });
    queries.set(noteQuery(spec), rows);
    queries.set(noteQuery(spec, true), [counts]);
  }
  queries.set(COUNTS, [{ clients: "3", contracts: "1", services: "4", collections: "2" }]);
  queries.set(COHORT_COUNTS, [{ clients: "3", marked_deleted: "1", no_person: "0", no_contract: "2", no_collection: "2" }]);
  queries.set(ANNOUNCEMENT_CANDIDATES, [{ unverified_note_links: "0" }]);
  let clientReads = 0;
  return { request: () => ({ query: async sql => {
    if (sql.startsWith("SELECT CONVERT(varchar(23),GETUTCDATE(),121)")) {
      return { recordset: [{ utc_time: "2026-11-16 09:00:00.000", source_wall_time: "2026-11-16 10:00:00.000" }] };
    }
    assert.ok(queries.has(sql), "Unexpected synthetic query");
    let rows = queries.get(sql);
    if (sql === `${CTE} ${DATA[0][1]}` && ++clientReads === 2 && changeDuringSecondRead) {
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
    assert.deepEqual(wb.SheetNames, ["Klienti 2026"]);
    assert.equal(fs.existsSync(path.join(path.dirname(result.file), "report.partial.xlsx")), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
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
