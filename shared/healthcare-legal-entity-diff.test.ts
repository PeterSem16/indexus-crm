import { test } from "node:test";
import assert from "node:assert/strict";
import { compareRegistrySnapshots, hasRegistryChanges, registryComparisonKey, type RegistrySnapshot } from "./healthcare-legal-entity-diff";
import { healthcareLegalEntityTranslations } from "../client/src/i18n/healthcare-legal-entity-translations";

const snapshot: RegistrySnapshot = {
  summary: { id: "old", checkedAt: "2026-10-10T10:00:00Z", sourceUpdatedAt: "2026-10-09T19:00:00Z" },
  company: { countryCode: "SK", ico: "00151653", name: "Example s.r.o.", legalForm: "s.r.o.",
    registeredAddress: "Old street 1", city: "Bratislava", postalCode: "81101", status: "active",
    registryReference: { court: "B", section: "Sro", insertNumber: 1 }, establishedAt: null, terminatedAt: null },
  people: [{ key: "original", name: "Example Officer", role: "Konateľ", kind: "statutoryBody",
    current: true, validFrom: "2020-01-01", validTo: null }],
};
test("first verification is a baseline, not an all-fields-changed alert", () => {
  const result = compareRegistrySnapshots(null, snapshot);
  assert.equal(result.previous, null);
  assert.deepEqual(result.fields, []);
  assert.deepEqual(result.roles, { removed: [], added: [] });
});
test("metadata, ordering, private source hashes, whitespace and optional empty values do not create changes", () => {
  const next = structuredClone(snapshot);
  next.summary = { id: "new", checkedAt: "2026-10-15T12:00:00Z", sourceUpdatedAt: null };
  next.company.name = "  Example   s.r.o. ";
  next.people[0].key = "source-only-hash-change";
  next.people[0].validTo = "";
  const before = JSON.stringify(snapshot);
  const result = compareRegistrySnapshots(snapshot, next);
  assert.deepEqual(result.fields, []);
  assert.deepEqual(result.roles, { removed: [], added: [] });
  assert.deepEqual(result.previous, snapshot.summary);
  assert.deepEqual(result.current, next.summary);
  assert.equal(JSON.stringify(snapshot), before, "immutable source stays untouched");
});
test("all registered fields include before and after, including clearing values", () => {
  const next = structuredClone(snapshot);
  Object.assign(next.company, { name: "New name", registeredAddress: "New street", city: "Košice",
    postalCode: null, legalForm: "a.s.", status: "terminated" });
  const result = compareRegistrySnapshots(snapshot, next);
  assert.deepEqual(result.fields.map(f => f.field), ["name", "registeredAddress", "city", "postalCode", "legalForm", "status"]);
  assert.deepEqual(result.fields[3], { field: "postalCode", before: "81101", after: null });
});
test("role additions, removals and end dates remain visible without matching CRM Persons", () => {
  const next = structuredClone(snapshot);
  next.people[0].current = false;
  next.people[0].validTo = "2026-10-15";
  next.people.push({ ...snapshot.people[0], key: "new", name: "New Officer", validFrom: "2026-10-15" });
  const result = compareRegistrySnapshots(snapshot, next);
  assert.equal(result.roles.removed.length, 1);
  assert.equal(result.roles.added.length, 2);
  assert.ok(result.roles.added.some(p => !p.current && p.validTo === "2026-10-15"));
  assert.deepEqual(compareRegistrySnapshots(next, { ...next, people: [...next.people].reverse() }).roles, { removed: [], added: [] });
  const empty = compareRegistrySnapshots(snapshot, { ...next, people: [] });
  assert.equal(empty.roles.removed.length, 1);
  assert.equal(empty.roles.added.length, 0);
});
test("comparison copy is complete in all seven languages", () => {
  const keys = ["registryChanges", "firstVerification", "registryUnchanged", "comparisonReadOnly", "previousSnapshot",
    "newSnapshot", "corporateRoles", "rolesRemoved", "rolesAdded", "orsrSyncAt"] as const;
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    for (const key of keys) assert.ok(healthcareLegalEntityTranslations[locale][key]?.trim(), `${locale}.${key}`);
  }
});

test("persisted comparison keys have exact diff parity, including multiplicity and Unicode normalization", () => {
  const variants: RegistrySnapshot[] = [snapshot];
  for (const field of ["name", "registeredAddress", "city", "postalCode", "legalForm", "status"] as const) {
    for (const value of [null, "", "  ", "New value", "e\u0301", "é"]) {
      const next = structuredClone(snapshot);
      (next.company as any)[field] = value;
      variants.push(next);
    }
  }
  for (const change of [
    (s: RegistrySnapshot) => { s.people = []; },
    (s: RegistrySnapshot) => { s.people.push({ ...s.people[0] }); },
    (s: RegistrySnapshot) => { s.people[0].key = "private-source-hash"; },
    (s: RegistrySnapshot) => { s.people[0].current = false; },
    (s: RegistrySnapshot) => { s.people[0].validTo = "2026-10-15"; },
    (s: RegistrySnapshot) => { s.people[0].name = " Example   Officer "; },
    (s: RegistrySnapshot) => { s.people[0].role = "Director"; },
    (s: RegistrySnapshot) => { s.people[0].kind = "stakeholder"; },
    (s: RegistrySnapshot) => { s.people[0].validFrom = null; },
    (s: RegistrySnapshot) => { s.people.push({ ...s.people[0], name: "Other" }); s.people.reverse(); },
  ]) {
    const next = structuredClone(snapshot);
    change(next);
    variants.push(next);
  }
  for (const before of variants) for (const after of variants) {
    assert.equal(registryComparisonKey(before.company, before.people) !== registryComparisonKey(after.company, after.people),
      hasRegistryChanges(compareRegistrySnapshots(before, after)));
  }
});
