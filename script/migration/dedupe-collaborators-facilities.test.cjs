const test = require("node:test");
const assert = require("node:assert/strict");
const d = require("./dedupe-collaborators-facilities.cjs");

test("normalization is accent, case and punctuation insensitive", () => {
  assert.equal(d.normalize(" RADMILA, ŠÚR "), "radmilasur");
  assert.equal(d.personName({ first_name: "Radmila", last_name: "Nováková" }), "radmilanovakova");
});
test("facility canonical prefers registry identifiers", () => {
  const a = { id: "b", name: "X" }, b = { id: "a", name: "X", pzs_code: "1" };
  assert.equal(d.canonical([a, b], "facility").id, "a");
});
test("fill-only merge never overwrites and unions arrays", () => {
  assert.deepEqual(d.mergeFillOnly({ email: "old", tags: ["a"] }, { email: "new", tags: ["a", "b"], phone: "1" }), { tags: ["a", "b"], phone: "1" });
});
test("exact name on duplicate facilities is reported for manual review (Radmila Sládičeková/RADMA fixture)", () => {
  const facilities = [
    { id: "c1", kind: "clinic", name: "RADMA", city: "Bratislava", country_code: "SK" },
    { id: "c2", kind: "clinic", name: "radma", city: "Bratislava", country_code: "SK" },
  ];
  const people = [
    { id: "p1", first_name: "Radmila", last_name: "Sládičeková", data_source: "manual" },
    { id: "p2", first_name: "RADMILA", last_name: "SLADICEKOVA", data_source: "iscbc" },
  ];
  const workplaces = { p1: [{ entity_id: "c1" }], p2: [{ entity_id: "c2" }] };
  assert.equal(d.findPeople(people, workplaces, facilities)[0].reason, "exact_name_duplicate_workplace");
  assert.equal(d.findPeople(people, workplaces, facilities)[0].autoApplicable, false);
});
test("plan hash is deterministic", () => {
  const a = d.stablePlan({ operations: [{ kind: "person", winnerId: "1", loserIds: ["2"] }] });
  const b = d.stablePlan({ operations: [{ kind: "person", winnerId: "1", loserIds: ["2"] }] });
  assert.equal(a.planHash, b.planHash);
});
test("blank location facilities are manual/no candidates", () => {
  assert.equal(d.findFacilities([{ id: "1", kind: "clinic", name: "RADMA", city: null, country_code: "SK" }, { id: "2", kind: "clinic", name: "RADMA", city: null, country_code: "SK" }]).length, 0);
});
test("full facility rows contribute missing fields", () => {
  assert.deepEqual(d.mergeFillOnly({ name: "X", phone: null }, { name: "X", phone: "123", notes: "kept" }), { phone: "123", notes: "kept" });
});
test("connected person matches produce one operation", () => {
  const p = [{ id: "1", first_name: "A", last_name: "B", email: "a@x.sk" }, { id: "2", first_name: "A", last_name: "B", email: "b@x.sk" }, { id: "3", first_name: "A", last_name: "B", email: "a@x.sk" }];
  const result = d.findPeople(p, { 1: [], 2: [], 3: [] }, []);
  assert.equal(result.length, 1); assert.equal(result[0].loserIds.length, 2);
});
test("assignment planning preserves metadata and unions codes", () => {
  const result = d.assignmentMergePlan([{ id: "a", person_id: "p", entity_type: "clinic", entity_id: "c", cbc_activity_codes: ["A"], is_primary: false }, { id: "b", person_id: "p", entity_type: "clinic", entity_id: "c", cbc_activity_codes: ["B"], is_primary: true }]);
  assert.deepEqual(result[0].patch.cbc_activity_codes, ["A", "B"]); assert.equal(result[0].patch.is_primary, true);
});
test("assignment plan includes only collisions caused by approved operations", () => {
  const rows = [
    { id: "a", person_id: "p1", entity_type: "clinic", entity_id: "c1", cbc_activity_codes: [] },
    { id: "b", person_id: "p2", entity_type: "clinic", entity_id: "c2", cbc_activity_codes: [] },
    { id: "x", person_id: "other", entity_type: "clinic", entity_id: "other-c", cbc_activity_codes: [] },
    { id: "y", person_id: "other", entity_type: "clinic", entity_id: "other-c", cbc_activity_codes: [] },
  ];
  const operations = [
    { kind: "person", winnerId: "p1", loserIds: ["p2"] },
    { kind: "facility", entityKind: "clinic", winnerId: "c1", loserIds: ["c2"] },
  ];
  const result = d.plannedAssignmentMerges(rows, operations);
  assert.equal(result.length, 1);
  assert.deepEqual(new Set([result[0].winnerId, ...result[0].duplicateIds]), new Set(["a", "b"]));
});
test("target inspection shows facilities even when strict dedupe grouping rejects them", () => {
  const facilities = [
    { id: "c1", kind: "clinic", name: "RADMA GYN", city: "Bratislava", country_code: "SK" },
    { id: "c2", kind: "clinic", name: "RADMA-GYN s.r.o.", city: "Bratislava", country_code: "SK" },
  ];
  const result = d.inspectionMatches("RADMA", [], facilities);
  assert.deepEqual(result.map((row) => row.id), ["c1", "c2"]);
});