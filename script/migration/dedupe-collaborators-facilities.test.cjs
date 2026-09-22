const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const d = require("./dedupe-collaborators-facilities.cjs");
const sync = require("./dedupe-iscbc-alias.cjs");

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
test("automatic dedupe is blocked by scalar conflicts but not aliases or mergeable arrays", () => {
  const rows = [
    {
      id: "winner",
      legacy_id: "100",
      email: "winner@example.test",
      country_codes: ["SK"],
    },
    {
      id: "loser",
      legacy_id: "200",
      email: "loser@example.test",
      country_codes: ["CZ"],
    },
  ];
  const conflicts = d.fieldConflicts(rows);
  assert.deepEqual(d.automaticConflictBlockers(rows, conflicts), ["email"]);
});
test("automatic dedupe permits differing legacy IDs because aliases preserve them", () => {
  const rows = [
    { id: "winner", legacy_id: "100", email: "same@example.test" },
    { id: "loser", legacy_id: "200", email: "same@example.test" },
  ];
  assert.deepEqual(d.automaticConflictBlockers(rows), []);
});
test("manual review rows show ordinary fields and redact sensitive values", () => {
  const row = d.reviewRow({
    id: "person-a",
    legacy_id: "123",
    email: "person@example.test",
    birth_number: "sensitive-value",
  });
  assert.equal(row.legacy_id, "123");
  assert.equal(row.email, "person@example.test");
  assert.equal(row.birth_number.redacted, true);
  assert.equal(row.birth_number.present, true);
  assert.doesNotMatch(JSON.stringify(row), /sensitive-value/);
});
test("person match reason identifies strong evidence without exposing its value", () => {
  const birthMatch = d.findPeople([
    { id: "a", first_name: "Anna", last_name: "Novak", birth_number: "secret-a" },
    { id: "b", first_name: "Anna", last_name: "Novak", birth_number: "secret-a" },
  ], { a: [], b: [] }, []);
  assert.equal(birthMatch[0].reason, "strong_birth_number");
  assert.doesNotMatch(birthMatch[0].reason, /secret-a/);

  const emailPhoneMatch = d.findPeople([
    { id: "c", first_name: "Eva", last_name: "Kral", email: "eva@example.test", mobile: "+421900123456" },
    { id: "d", first_name: "Eva", last_name: "Kral", email: "EVA@example.test", phone: "+421 900 123 456" },
  ], { c: [], d: [] }, []);
  assert.equal(emailPhoneMatch[0].reason, "strong_email_phone");
  assert.doesNotMatch(emailPhoneMatch[0].reason, /example|123456/);
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
test("plan hash is stable when operation input order is shuffled", () => {
  const operations = [
    { kind: "person", winnerId: "2", loserIds: ["4", "3"], operationId: "b" },
    { kind: "facility", entityKind: "clinic", winnerId: "1", loserIds: ["9"], operationId: "a" },
  ];
  assert.equal(d.stablePlan({ operations }).planHash, d.stablePlan({ operations: operations.reverse() }).planHash);
});
test("execution plan defaults to automatic operations and requires explicit manual approval", () => {
  const operations = [
    { kind: "person", winnerId: "1", loserIds: ["2"], autoApplicable: true, executionPatch: { email: "a@x.test" }, references: [] },
    { kind: "person", winnerId: "3", loserIds: ["4"], autoApplicable: false, executionPatch: { email: "b@x.test" }, references: [] },
  ];
  const automatic = d.executionPlan({ operations, assignmentMerges: [] });
  assert.equal(automatic.operations.length, 1);
  const approved = d.executionPlan({ operations, assignmentMerges: [] }, [d.operationId(operations[1])]);
  assert.equal(approved.operations.length, 2);
  assert.equal(approved.operations[1].plannedPatch.email, "b@x.test");
});
test("execution plan rejects hash-bound confirmation mismatch", () => {
  const plan = d.executionPlan({ operations: [], assignmentMerges: [] });
  assert.throws(() => d.verifyExecutionPlan(plan, plan.planHash, "DEDUPLICATE_NO_DELETE"), /Confirmation/);
  assert.equal(d.verifyExecutionPlan(plan, plan.planHash, `DEDUPLICATE_NO_DELETE:${plan.planHash}`), true);
});
test("execution plan hash survives Date JSON serialization", () => {
  const plan = d.executionPlan({
    operations: [],
    assignmentMerges: [{
      winnerId: "a",
      duplicateIds: ["b"],
      patch: { start_date: new Date("2026-01-02T03:04:05.000Z") },
    }],
  });
  const reloaded = JSON.parse(JSON.stringify(plan));
  assert.equal(
    d.verifyExecutionPlan(reloaded, plan.planHash, `DEDUPLICATE_NO_DELETE:${plan.planHash}`),
    true
  );
});
test("execution plan fails closed on an unsupported live reference", () => {
  const operation = {
    kind: "person",
    winnerId: "1",
    loserIds: ["2"],
    autoApplicable: true,
    executionPatch: {},
    references: [{ table: "mystery", column: "opaque_owner", count: 1, policy: "unsupported_block" }],
  };
  assert.throws(() => d.executionPlan({ operations: [operation], assignmentMerges: [] }), /unsupported references/);
});
test("reference policy preserves audit/history and treats assignments specially", () => {
  assert.equal(d.referencePolicy("audit_events", "person_id"), "preserve_audit");
  assert.equal(d.referencePolicy("contact_assignments", "person_id"), "contact_assignment_special");
  assert.equal(d.referencePolicy("campaign_contacts", "collaborator_id"), "redirect");
  assert.equal(d.referencePolicy("dedupe_entity_aliases", "loser_id"), "preserve_alias");
});
test("batch reference inventory scans each table once for all operations", async () => {
  let customerNotesScans = 0;
  const db = {
    async query(sql) {
      if (sql.includes("information_schema.columns")) {
        return {
          rows: [
            { table_name: "customer_notes", column_name: "id", data_type: "character varying", udt_name: "varchar" },
            { table_name: "customer_notes", column_name: "badge", data_type: "character varying", udt_name: "varchar" },
          ],
        };
      }
      if (sql.includes('FROM "customer_notes"')) {
        customerNotesScans += 1;
        return {
          rows: [
            { __s0: null, __s1: "loser-a" },
            { __s0: null, __s1: "loser-b" },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const operations = [
    { kind: "person", winnerId: "winner-a", loserIds: ["loser-a"] },
    { kind: "person", winnerId: "winner-b", loserIds: ["loser-b"] },
  ];
  const inventories = await d.referenceInventories(db, operations);
  assert.equal(customerNotesScans, 1);
  for (const operation of operations) {
    assert.deepEqual(inventories.get(d.operationId(operation)), [{
      table: "customer_notes",
      column: "badge",
      count: 1,
      policy: "unsupported_block",
    }]);
  }
});
test("named collection staff and obstetrician columns are supported collaborator references", async () => {
  const db = {
    async query(sql) {
      if (sql.includes("information_schema.columns")) {
        return {
          rows: [
            { table_name: "collections", column_name: "id", data_type: "character varying", udt_name: "varchar" },
            { table_name: "collections", column_name: "cord_blood_collector_id", data_type: "character varying", udt_name: "varchar" },
            { table_name: "collections", column_name: "tissue_collector_id", data_type: "character varying", udt_name: "varchar" },
            { table_name: "collections", column_name: "assistant_nurse_id", data_type: "character varying", udt_name: "varchar" },
            { table_name: "customer_potential_cases", column_name: "id", data_type: "character varying", udt_name: "varchar" },
            { table_name: "customer_potential_cases", column_name: "obstetrician_id", data_type: "character varying", udt_name: "varchar" },
          ],
        };
      }
      if (sql.includes('FROM "collections"')) {
        return {
          rows: [{
            __s0: null,
            __s1: "loser",
            __s2: "loser",
            __s3: "loser",
          }],
        };
      }
      if (sql.includes('FROM "customer_potential_cases"')) {
        return { rows: [{ __s0: null, __s1: "loser" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const operation = { kind: "person", winnerId: "winner", loserIds: ["loser"] };
  const references = await d.referenceInventory(db, operation);
  assert.deepEqual(references, [
    { table: "collections", column: "assistant_nurse_id", count: 1, policy: "redirect" },
    { table: "collections", column: "cord_blood_collector_id", count: 1, policy: "redirect" },
    { table: "collections", column: "tissue_collector_id", count: 1, policy: "redirect" },
    { table: "customer_potential_cases", column: "obstetrician_id", count: 1, policy: "redirect" },
  ]);
});
test("alias resolution prefers canonical active record", () => {
  const canonical = { id: "winner", is_active: true };
  assert.equal(sync.resolveCollaboratorAlias({ "393": { canonical_id: "winner" } }, "393", { id: "loser" }, { winner: canonical }), canonical);
  assert.throws(() =>
    sync.resolveCollaboratorAlias({ "393": { canonical_id: "winner" } }, "393", { id: "loser" }, { winner: { id: "winner", is_active: false } }),
  /missing or inactive/);
  assert.throws(() =>
    sync.resolveCollaboratorAlias({ "393": { canonical_id: "missing" } }, "393", { id: "loser" }, {}),
  /missing or inactive/);
  assert.deepEqual(sync.resolveCollaboratorAlias({}, "393", { id: "direct" }, {}), { id: "direct" });
});
test("apply path contains no DELETE and requires reviewed plan, confirmation, backup and serializable transaction", () => {
  const source = fs.readFileSync(require.resolve("./dedupe-collaborators-facilities.cjs"), "utf8");
  assert.doesNotMatch(source, /\bDELETE\s+FROM\b/i);
  assert.match(source, /Apply requires --plan-file, --plan-hash, --confirm, and --backup-dir/);
  assert.match(source, /createVerifiedBackup/);
  assert.match(source, /DEDUPLICATE_NO_DELETE:\$\{planHash\}/);
  assert.match(source, /ISOLATION LEVEL SERIALIZABLE/);
  assert.match(source, /verifyOperationState/);
});
test("blank location facilities are manual/no candidates", () => {
  assert.equal(d.findFacilities([{ id: "1", kind: "clinic", name: "RADMA", city: null, country_code: "SK" }, { id: "2", kind: "clinic", name: "RADMA", city: null, country_code: "SK" }]).length, 0);
});
test("same normalized facility name and postal code tolerate equivalent city labels", () => {
  const result = d.findFacilities([
    {
      id: "registry",
      kind: "clinic",
      name: "RADMA GYN s. r. o.",
      city: "Bratislava - mestská časť Petržalka",
      postal_code: "851 05",
      country_code: "SK",
      id_zz: "61-44478852-A0001",
      pzs_code: "P13729009201",
    },
    {
      id: "manual",
      kind: "clinic",
      name: "RADMA GYN s.r.o.",
      city: "Petržalka",
      postal_code: "85105",
      country_code: "SK",
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].winnerId, "registry");
  assert.equal(result[0].reason, "exact_name_postal_registry_anchor");
  assert.equal(result[0].autoApplicable, false);
});
test("facility registry match is automatic only when two records share the identifier", () => {
  const rows = [
    { id: "a", kind: "clinic", name: "X", city: "Y", postal_code: "1", country_code: "SK", id_zz: "same", pzs_code: "code" },
    { id: "b", kind: "clinic", name: "X", city: "Y", postal_code: "1", country_code: "SK", id_zz: "same" },
  ];
  assert.equal(d.findFacilities(rows)[0].autoApplicable, true);
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
test("assignment planning preserves distinct categories at a merged facility", () => {
  const rows = [
    { id: "a", person_id: "p", entity_type: "clinic", entity_id: "old", category_id: "gynecology", cbc_activity_codes: [] },
    { id: "b", person_id: "p", entity_type: "clinic", entity_id: "canonical", category_id: "ultrasound", cbc_activity_codes: [] },
  ];
  const operations = [
    { kind: "facility", entityKind: "clinic", winnerId: "canonical", loserIds: ["old"] },
  ];
  assert.deepEqual(d.plannedAssignmentMerges(rows, operations), []);
});
test("target inspection shows facilities even when strict dedupe grouping rejects them", () => {
  const facilities = [
    { id: "c1", kind: "clinic", name: "RADMA GYN", city: "Bratislava", country_code: "SK" },
    { id: "c2", kind: "clinic", name: "RADMA-GYN s.r.o.", city: "Bratislava", country_code: "SK" },
  ];
  const result = d.inspectionMatches("RADMA", [], facilities);
  assert.deepEqual(result.map((row) => row.id), ["c1", "c2"]);
});