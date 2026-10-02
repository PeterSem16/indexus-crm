const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const XLSX = require("xlsx");
const { normalizeId, nameKey, workbookPeople, matchPeople, safeOutputPath } = require("./limit-unpaid-reward-badges-from-excel.cjs");

test("preserves personnel number formatting and rejects malformed IDs", () => {
  assert.equal(normalizeId("0051036"), "0051036");
  assert.equal(normalizeId(51036), "51036");
  assert.throws(() => normalizeId("51abc"), /Invalid personnel number/);
});

test("normalizes Slovak diacritics and separated titles for name verification", () => {
  assert.equal(nameKey("Ferenčíková Mária, Bc."), nameKey("Mária Ferenčíková"));
  assert.equal(nameKey("Halásová Dominika, MUDr."), nameKey("Dominika Halásová"));
});

test("uses only the first worksheet and preserves visible leading zeroes", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "badge-allowlist-"));
  try {
    const file = path.join(directory, "sample.xlsx");
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
      ["Osobné číslo", "Skratka OŠ", "Meno"],
      ...Array.from({ length: 10 }, (_, index) => [String(index + 100).padStart(5, "0"), "", `Meno${index} Priezvisko${index}`]),
    ]), "Zlúčené odbery");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Nesprávne"], ["99999"]]), "Druhý hárok");
    XLSX.writeFile(book, file);
    const workbook = workbookPeople(file);
    assert.equal(workbook.sheet, "Zlúčené odbery");
    assert.equal(workbook.rows, 10);
    assert.equal(workbook.people.size, 10);
    assert.ok(workbook.people.has("00100"));
    assert.ok(!workbook.people.has("99999"));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("only uniquely identified and name-verified collaborators enter the allowlist", () => {
  const people = new Map([
    ["0051036", new Set([nameKey("Ferenčíková Mária, Bc.")])],
    ["60418", new Set([nameKey("Bányácsky Jaroslav, MUDr.")])],
    ["60249", new Set([nameKey("Halásová Dominika")])],
  ]);
  const dbRows = [
    { id: "one", legacy_id: "0051036", first_name: "Mária", last_name: "Ferenčíková" },
    { id: "two", legacy_id: "60418", first_name: "Jaroslav", last_name: "Bányácsky" },
    { id: "duplicate", legacy_id: "60418", first_name: "Jaroslav", last_name: "Bányácsky" },
    { id: "wrong", legacy_id: "60249", first_name: "Iná", last_name: "Osoba" },
  ];
  const result = matchPeople(people, dbRows, "plain");
  assert.deepEqual([...result.matched], ["one"]);
  assert.deepEqual(result.ambiguous, ["60418"]);
  assert.deepEqual(result.nameMismatch, ["60249"]);
  assert.equal(matchPeople(people, dbRows, "cbc").matched.size, 0);
});

test("follows a unique ISCBC alias to the canonical person but rejects a conflicting direct ID", () => {
  const people = new Map([["51036", new Set([nameKey("Ferenčíková Mária")])]]);
  const canonical = { id: "canonical", legacy_id: "other", first_name: "Mária", last_name: "Ferenčíková", is_active: true };
  const alias = { legacy_id: "51036", source: "iscbc", canonical_id: "canonical" };
  assert.deepEqual([...matchPeople(people, [canonical], "plain", [alias]).matched], ["canonical"]);
  const conflict = { id: "other", legacy_id: "51036", first_name: "Mária", last_name: "Ferenčíková", is_active: true };
  assert.deepEqual(matchPeople(people, [canonical, conflict], "plain", [alias]).ambiguous, ["51036"]);
});

test("refuses conflicting Excel names for one personnel number", () => {
  const people = new Map([["51036", new Set([nameKey("Mária Ferenčíková"), nameKey("Iná Osoba")])]]);
  const db = [{ id: "one", legacy_id: "51036", first_name: "Mária", last_name: "Ferenčíková" }];
  assert.deepEqual(matchPeople(people, db, "plain").conflictingNames, ["51036"]);
  assert.equal(matchPeople(people, db, "plain").matched.size, 0);
});

test("refuses to write private reports and backups into the application directory", () => {
  assert.throws(() => safeOutputPath(path.join(__dirname, "report.json")), /cannot be written/);
  assert.equal(safeOutputPath(path.join(os.tmpdir(), "badge-report.json")), path.join(fs.realpathSync(os.tmpdir()), "badge-report.json"));
});