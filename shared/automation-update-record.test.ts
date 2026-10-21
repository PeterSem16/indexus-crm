import test from "node:test";
import assert from "node:assert/strict";
import { getTableColumns } from "drizzle-orm";
import {
  tasks, customers, hospitals, clinics, invoices, collections, collaborators,
  contractInstances, campaigns, products,
} from "./schema";
import { UPDATE_RECORD_ENTITIES, updateRecordIssues } from "./automation-update-record";
const config = (fields: Record<string, unknown> = { notes: "Reviewed" }, overrides: any = {}) => ({
  updateRecordVersion: 2, target: { mode: "event", entityType: "clinic" },
  acknowledged: true, fields, ...overrides,
});
test("Every advertised field exists in the real persisted schema; clearing never violates nullability", () => {
  const tables: any = { task: tasks, customer: customers, hospital: hospitals, clinic: clinics, invoice: invoices,
    collection: collections, collaborator: collaborators, contract: contractInstances, campaign: campaigns, product: products };
  assert.equal(Object.keys(UPDATE_RECORD_ENTITIES).length, 10);
  for (const [type, fields] of Object.entries(UPDATE_RECORD_ENTITIES)) {
    const columns = getTableColumns(tables[type]);
    for (const field of fields) {
      assert.ok(columns[field.key], `${type}.${field.key} must exist`);
      if (field.nullable) assert.equal(columns[field.key].notNull, false, `${type}.${field.key} can be cleared`);
    }
  }
});
test("Explicit target, typed values, non-empty changes and acknowledgment are mandatory", () => {
  assert.deepEqual(updateRecordIssues(config(), "clinic"), []);
  for (const bad of [
    config({}, {}), config({ notes: "" }), config({ notes: "   " }),
    config({ countryCode: "CZ" }), config({ mobilePasswordHash: "anything" }),
    config({ isActive: "false" }), config({ isActive: 1 }),
    config({}, { fields: [] }), config({ notes: "x" }, { acknowledged: false }),
    config({ notes: "x" }, { target: { mode: "event", entityType: "customer" } }),
    config({ notes: "x" }, { target: { mode: "selected", entityType: "clinic", recordId: "{{entityId}}" } }),
    config({ notes: "x" }, { target: { mode: "selected", entityType: "clinic" } }),
    config({ notes: "x" }, { target: { mode: "event", entityType: "__proto__" } }),
    config({ notes: "x" }, { target: { mode: "related", entityType: "clinic", relation: "madeUp" } }),
  ]) assert.ok(updateRecordIssues(bad, "clinic").length, JSON.stringify(bad));
  assert.deepEqual(updateRecordIssues(config({ isActive: false }), "clinic"), []);
});
test("Clinic screenshot fields use persisted keys, exact contact choices and typed calendar/boolean values", () => {
  const fields = {
    leadSource: "current_collaborator", leadSourceDate: "2026-10-21",
    leadSourceNotes: "Source details\nSecond line", contractSentDate: "2026-10-22",
    contractReturnedDate: "2026-10-23", hasFlyers: false,
  };
  assert.deepEqual(updateRecordIssues(config(fields), "clinic"), []);
  assert.deepEqual(UPDATE_RECORD_ENTITIES.clinic.find(field => field.key === "leadSource")?.options,
    ["new_contact", "former_collaborator", "current_collaborator"]);
  for (const source of ["new_contact", "former_collaborator", "current_collaborator"])
    assert.deepEqual(updateRecordIssues(config({ leadSource: source }), "clinic"), []);
  for (const invalid of [{ leadSource: "arbitrary" }, { leadSource: "doctor_referral" },
    { leadSourceDate: "2026-02-30" }, { contractSentDate: "yesterday" },
    { contractReturnedDate: "2026-13-01" }, { hasFlyers: "false" }, { hasFlyers: null }])
    assert.ok(updateRecordIssues(config(invalid), "clinic").length);
  const clear = { leadSource: null, leadSourceDate: null, leadSourceNotes: null,
    contractSentDate: null, contractReturnedDate: null };
  assert.ok(updateRecordIssues(config(clear), "clinic").includes("clearAcknowledge"));
  assert.deepEqual(updateRecordIssues(config(clear, { clearAcknowledged: true }), "clinic"), []);
  assert.ok(updateRecordIssues(config(fields, { acknowledged: false }), "clinic").includes("acknowledge"));
  assert.ok(updateRecordIssues(config(fields, { target: { mode: "event", entityType: "hospital" } }), "hospital").length);
});
test("Explicit clearing and safe dates/variables, never implicit conversions", () => {
  assert.ok(updateRecordIssues(config({ notes: null }), "clinic").includes("clearAcknowledge"));
  assert.deepEqual(updateRecordIssues(config({ notes: null }, { clearAcknowledged: true }), "clinic"), []);
  for (const date of ["not-a-date", "2026-02-30", "2026-13-01"])
    assert.ok(updateRecordIssues(config({ nextContactDate: date }), "clinic").length);
  assert.deepEqual(updateRecordIssues(config({ nextContactDate: "2026-10-12" }), "clinic"), []);
  assert.deepEqual(updateRecordIssues(config({ isActive: "{{newValues.isActive}}" }), "clinic"), []);
  assert.ok(updateRecordIssues(config({ isActive: "{{newValues.isActive}}" }), "clinic", false).length);
  assert.ok(updateRecordIssues(config({ notes: "before {{newValues.notes}}" }), "clinic").length);
});
