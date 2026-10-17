import test from "node:test";
import assert from "node:assert/strict";
import { agreementDate, personAgreementEvidence, type PersonAgreementEvidence } from "./provider-finder-evidence";

const agreement = (patch: Partial<PersonAgreementEvidence> = {}): PersonAgreementEvidence => ({
  is_valid: true, file_path: "synthetic.pdf",
  valid_from_day: 1, valid_from_month: 1, valid_from_year: 2025,
  valid_to_day: null, valid_to_month: null, valid_to_year: null, ...patch,
});
test("partial, impossible and absent legacy dates never prove contract validity", () => {
  assert.equal(agreementDate(31, 2, 2026), undefined);
  assert.equal(agreementDate(29, 2, 2024), "2024-02-29");
  assert.equal(agreementDate(null, 1, 2026), undefined);
  assert.equal(personAgreementEvidence([agreement({ valid_from_day: null })], "2026-10-17").currentAgreement, undefined);
  assert.equal(personAgreementEvidence([agreement({ valid_to_year: 2026 })], "2026-10-17").currentAgreement, undefined);
  assert.equal(personAgreementEvidence([], "2026-10-17").currentAgreement, false);
});
test("current, expired, future and invalid agreements have distinct evidence", () => {
  assert.equal(personAgreementEvidence([agreement()], "2026-10-17").currentAgreement, true);
  assert.equal(personAgreementEvidence([agreement({ file_path: null })], "2026-10-17").uploadedContract, false);
  const old = agreement({ valid_to_day: 16, valid_to_month: 10, valid_to_year: 2026 });
  assert.deepEqual(personAgreementEvidence([old], "2026-10-17"), {
    currentAgreement: false, previousAgreement: true, uploadedContract: false,
  });
  assert.equal(personAgreementEvidence([agreement({ valid_from_year: 2027 })], "2026-10-17").previousAgreement, false);
  assert.equal(personAgreementEvidence([agreement({ is_valid: false })], "2026-10-17").currentAgreement, false);
  assert.equal(personAgreementEvidence([agreement({ is_valid: false })], "2026-10-17").previousAgreement, false);
  assert.equal(personAgreementEvidence([old, agreement()], "2026-10-17").currentAgreement, true);
  assert.equal(personAgreementEvidence([agreement({ valid_to_day: 17, valid_to_month: 10, valid_to_year: 2026 })], "2026-10-17").currentAgreement, true);
});
