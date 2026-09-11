import assert from "node:assert/strict";
import test from "node:test";
import { resolveMissedCallCardTarget } from "./missed-call-card-resolver";

const matches = [
  { entityType: "customer" as const, id: "customer-1", name: "Customer" },
  { entityType: "clinic" as const, id: "clinic-1", name: "Clinic" },
];

test("a persisted missed-call customer remains more authoritative than a remembered card", () => {
  const result = resolveMissedCallCardTarget(
    "customer-1",
    "+421918751470",
    matches,
    matches[1],
  );

  assert.deepEqual(result, {
    kind: "match",
    match: { entityType: "customer", id: "customer-1", name: "", phone: "+421918751470" },
  });
});

test("a current remembered card resolves an otherwise ambiguous missed call", () => {
  const result = resolveMissedCallCardTarget(null, "+421918751470", matches, matches[1]);
  assert.deepEqual(result, { kind: "match", match: matches[1] });
});

test("a stale remembered card leaves the missed call ambiguous", () => {
  const result = resolveMissedCallCardTarget(null, "+421918751470", matches, {
    entityType: "hospital",
    id: "deleted-hospital",
  });
  assert.deepEqual(result, { kind: "ambiguous", matches });
});