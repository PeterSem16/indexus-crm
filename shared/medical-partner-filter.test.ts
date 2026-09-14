import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesMedicalPartnerRules,
  previewSelectionMatches,
  validateMedicalPartnerRules,
} from "./medical-partner-filter";

const clinic = {
  id: "clinic-1",
  name: "Central Clinic",
  countryCode: "SK",
  city: "Bratislava",
  isActive: true,
  contractStatus: "active",
  phone: "+421900000000",
  email: "clinic@example.test",
  tags: ["priority", "urban"],
};

test("medical partner filter evaluates AND and OR connectors across the full row", () => {
  const rules = validateMedicalPartnerRules("clinic", [
    { field: "country", op: "isAny", value: "SK", conjunction: "and" },
    { field: "city", op: "is", value: "Bratislava", conjunction: "and" },
    { field: "name", op: "contains", value: "central", conjunction: "or" },
  ]);

  assert.equal(matchesMedicalPartnerRules("clinic", clinic, rules), true);
  assert.equal(
    matchesMedicalPartnerRules("clinic", { ...clinic, city: "Kosice", name: "Other" }, rules),
    false,
  );
  assert.equal(
    matchesMedicalPartnerRules("clinic", { ...clinic, city: "Kosice", name: "Central branch" }, rules),
    true,
  );
});

test("multiselect and empty operators preserve field types", () => {
  const rules = validateMedicalPartnerRules("clinic", [
    { field: "country", op: "isAny", value: ["SK", "CZ"] },
    { field: "tags", op: "contains", value: "priority", conjunction: "and" },
    { field: "email", op: "isNotEmpty", conjunction: "and" },
  ]);
  assert.equal(matchesMedicalPartnerRules("clinic", clinic, rules), true);

  assert.throws(
    () => validateMedicalPartnerRules("clinic", [
      { field: "country", op: "contains", value: "SK" },
    ]),
    /op is not supported/,
  );
  assert.throws(
    () => validateMedicalPartnerRules("clinic", [
      { field: "doesNotExist", op: "is", value: "x" },
    ]),
    /field is not supported/,
  );
});

test("hospital values use the derived active representative and personnel state", () => {
  const hospital = {
    name: "General Hospital",
    countryCode: "DE",
    isActive: true,
    phone: null,
    email: null,
  };
  const rules = validateMedicalPartnerRules("hospital", [
    { field: "representativeId", op: "is", value: "rep-1" },
    { field: "personnel", op: "is", value: "with", conjunction: "and" },
  ]);
  assert.equal(
    matchesMedicalPartnerRules("hospital", hospital, rules, {
      representativeId: "rep-1",
      hasPersonnel: true,
    }),
    true,
  );
  assert.equal(
    matchesMedicalPartnerRules("hospital", hospital, rules, {
      representativeId: null,
      hasPersonnel: true,
    }),
    false,
  );
});

test("malformed values are rejected rather than widening a bulk selection", () => {
  assert.throws(
    () => validateMedicalPartnerRules("hospital", [
      { field: "name", op: "contains", value: "" },
    ]),
    /value is required/,
  );
  assert.throws(
    () => validateMedicalPartnerRules("hospital", [
      { field: "status", op: "is", value: ["active", "inactive"] },
    ]),
    /value must be a scalar/,
  );
  assert.throws(
    () => validateMedicalPartnerRules("clinic", [
      { field: "country", op: "isNot", value: "XX" },
    ]),
    /unsupported value/,
  );
  assert.throws(
    () => validateMedicalPartnerRules("hospital", [
      { field: "status", op: "isNot", value: "pending" },
    ]),
    /unsupported value/,
  );
});

test("preview and confirm compare the complete selection, independent of order", () => {
  assert.equal(previewSelectionMatches(["c-2", "c-1"], ["c-1", "c-2"]), true);
  assert.equal(previewSelectionMatches(["c-1", "c-1"], ["c-1"]), true);
  assert.equal(previewSelectionMatches(["c-1"], ["c-1", "c-2"]), false);
  assert.equal(previewSelectionMatches(["c-1"], ["c-2"]), false);
});
