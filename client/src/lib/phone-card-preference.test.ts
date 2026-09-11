import assert from "node:assert/strict";
import test from "node:test";
import {
  getRememberedPhoneCard,
  orderPhoneMatchesWithRememberedCard,
} from "./phone-card-preference";

const matches = [
  { entityType: "customer", id: "customer-1", name: "Customer" },
  { entityType: "clinic", id: "clinic-1", name: "Clinic" },
  { entityType: "hospital", id: "hospital-1", name: "Hospital" },
];

test("uses a remembered card only when it is still a current phone match", () => {
  const remembered = getRememberedPhoneCard(matches, {
    entityType: "clinic",
    entityId: "clinic-1",
  });

  assert.equal(remembered?.id, "clinic-1");
  assert.equal(getRememberedPhoneCard(matches, {
    entityType: "clinic",
    entityId: "deleted-clinic",
  }), undefined);
});

test("places the remembered card first without dropping alternatives", () => {
  const remembered = getRememberedPhoneCard(matches, {
    entityType: "clinic",
    entityId: "clinic-1",
  });

  assert.deepEqual(
    orderPhoneMatchesWithRememberedCard(matches, remembered).map((match) => match.id),
    ["clinic-1", "customer-1", "hospital-1"],
  );
});