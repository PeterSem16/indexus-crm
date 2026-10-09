import assert from "node:assert/strict";
import test from "node:test";
import { resolveMissionContactId } from "./mission-contact-identity";

const contacts = [
  { id: "old-enrollment", campaignId: "mission", clinicId: "old-clinic" },
  { id: "current-enrollment", campaignId: "mission", clinicId: "current-clinic" },
  { id: "staff-enrollment", campaignId: "mission", collaboratorId: "staff" },
];
const resolve = (extra: Record<string, unknown> = {}) => resolveMissionContactId({
  contacts, campaignId: "mission", entityId: "current-clinic", contactType: "clinic",
  preferredId: "old-enrollment", ...extra,
});

test("opening a different enrolled card replaces the stale Mission enrollment", () => {
  assert.equal(resolve(), "current-enrollment");
  assert.equal(resolve({ entityId: "staff", contactType: "collaborator" }), "staff-enrollment");
});
test("a recognized but unenrolled person cannot inherit the previous clinic enrollment", () => {
  assert.equal(resolve({ entityId: "unenrolled-staff", contactType: "collaborator" }), null);
});
test("a different Mission and empty identities cannot reuse cached enrollment", () => {
  assert.equal(resolve({ campaignId: "other-mission" }), null);
  assert.equal(resolve({ campaignId: null }), null);
  assert.equal(resolve({ entityId: null }), null);
});
test("legacy wrong entity-type fallback remains usable only when unambiguous", () => {
  assert.equal(resolve({ contactType: "customer" }), "current-enrollment");
  assert.equal(resolve({ contacts: [
    { id: "clinic", campaignId: "mission", clinicId: "same" },
    { id: "hospital", campaignId: "mission", hospitalId: "same" },
  ], entityId: "same", contactType: "customer", preferredId: "old-enrollment" }), null);
});
test("valid explicit enrollments disambiguate duplicate enrollments without accepting stale IDs", () => {
  const duplicates = [...contacts, { id: "second-enrollment", campaignId: "mission", clinicId: "current-clinic" }];
  assert.equal(resolve({ contacts: duplicates }), null);
  assert.equal(resolve({ contacts: duplicates, preferredId: "current-enrollment" }), "current-enrollment");
});
