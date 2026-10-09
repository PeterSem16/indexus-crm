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
