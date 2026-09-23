import assert from "node:assert/strict";
import test from "node:test";
import { facilityPersonReferralIds, includePersonReferrals } from "./mission-person-referrals";

test("person referrals are opt-in per Mission", () => {
  assert.equal(includePersonReferrals(null), false);
  assert.equal(includePersonReferrals("{bad"), false);
  assert.equal(includePersonReferrals('{"includePersonReferrals":false}'), false);
  assert.equal(includePersonReferrals('{"includePersonReferrals":"true"}'), false);
  assert.equal(includePersonReferrals('{"includePersonReferrals":true}'), true);
});

test("only referrals belonging to assigned persons mark their clinic or hospital", () => {
  const result = facilityPersonReferralIds([
    { personId: "referred", entityType: "clinic", entityId: "clinic-a" },
    { personId: "referred", entityType: "hospital", entityId: "hospital-a" },
    { personId: "other", entityType: "clinic", entityId: "clinic-b" },
    { personId: "referred", entityType: "network", entityId: "network-a" },
  ], new Set(["referred"]));
  assert.deepEqual([...result.clinic], ["clinic-a"]);
  assert.deepEqual([...result.hospital], ["hospital-a"]);
});