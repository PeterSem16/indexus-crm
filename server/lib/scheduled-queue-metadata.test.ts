import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveScheduledQueueContact,
  type ScheduledQueueContactRow,
} from "./scheduled-queue-metadata";

const noReferrals = {
  clinic: new Set<string>(),
  collaborator: new Set<string>(),
};

test("never treats a cross-type customer ID as a clinic or hospital identity", () => {
  for (const ccContactType of ["clinic", "hospital"]) {
    const result = resolveScheduledQueueContact({
      ccContactType, ccCustomerId: "unrelated-customer", customerCity: "Wrong city",
    }, noReferrals, new Map());
    assert.equal(result.contactId, null);
    assert.equal(result.priorityCity, null);
    assert.equal(result.hasReferral, false);
  }
});

function contact(type: string, fields: Partial<ScheduledQueueContactRow>): ScheduledQueueContactRow {
  return { ccContactType: type, ...fields };
}

test("resolves referral and city metadata for a campaign_contacts row", () => {
  const result = resolveScheduledQueueContact(contact("clinic", {
    ccClinicId: "clinic-referral",
    clinicName: "Central Clinic",
    clinicCity: "Bratislava",
    clinicCountryCode: "SK",
    clinicDoctorFirstName: "Ada",
    clinicDoctorLastName: "Lovelace",
  }), {
    clinic: new Set(["clinic-referral"]),
    collaborator: new Set(),
  }, new Map());

  assert.deepEqual(result, {
    contactType: "clinic",
    contactId: "clinic-referral",
    contactName: "Ada Lovelace (Central Clinic)",
    contactPhone: "",
    contactEmail: "",
    hasReferral: true,
    priorityCity: "Bratislava",
    priorityCountryCode: "SK",
  });
});

test("resolves the same metadata for a scheduled-session row", () => {
  const result = resolveScheduledQueueContact(contact("collaborator", {
    ccCollaboratorId: "collab-1",
    collaboratorFirstName: "Mia",
    collaboratorLastName: "Novak",
  }), {
    clinic: new Set(),
    collaborator: new Set(["collab-1"]),
  }, new Map([
    ["collab-1", { city: "Brno", countryCode: "CZ" }],
  ]));

  assert.equal(result.contactType, "collaborator");
  assert.equal(result.contactName, "Mia Novak");
  assert.equal(result.contactId, "collab-1");
  assert.equal(result.hasReferral, true);
  assert.equal(result.priorityCity, "Brno");
  assert.equal(result.priorityCountryCode, "CZ");
});

test("keeps referral false and uses declared entity city for non-referral types", () => {
  const rows: Array<[string, Partial<ScheduledQueueContactRow>, string | null]> = [
    ["customer", {
      ccCustomerId: "customer-1",
      customerFirstName: "Customer",
      customerCity: "Košice",
      customerCountry: "SK",
    }, "Košice"],
    ["hospital", {
      ccHospitalId: "hospital-1",
      hospitalName: "Hospital",
      hospitalCity: "Vienna",
      hospitalCountryCode: "AT",
    }, "Vienna"],
  ];

  for (const [type, fields, city] of rows) {
    const result = resolveScheduledQueueContact(contact(type, fields), noReferrals, new Map());
    assert.equal(result.hasReferral, false);
    assert.equal(result.priorityCity, city);
  }
});

test("does not invent name or city when the declared entity is missing", () => {
  const missingRows: Array<[string, Partial<ScheduledQueueContactRow>, string]> = [
    ["customer", { ccCustomerId: "missing-customer" }, "missing-customer"],
    ["clinic", { ccClinicId: "missing-clinic" }, "missing-clinic"],
    ["hospital", { ccHospitalId: "missing-hospital" }, "missing-hospital"],
    ["collaborator", { ccCollaboratorId: "missing-collaborator" }, "missing-collaborator"],
  ];

  for (const [type, fields, id] of missingRows) {
    const result = resolveScheduledQueueContact(contact(type, fields), noReferrals, new Map());
    assert.equal(result.contactId, id);
    assert.equal(result.contactName, "");
    assert.equal(result.priorityCity, null);
    assert.equal(result.priorityCountryCode, null);
    assert.equal(result.hasReferral, false);
  }
});