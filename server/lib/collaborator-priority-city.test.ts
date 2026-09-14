import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCollaboratorPriorityCity,
  selectPrimaryCollaboratorAddress,
  type CollaboratorPriorityAddress,
} from "./collaborator-priority-city";

function address(
  id: string,
  addressType: string,
  city: string | null,
  countryCode: string | null,
  createdAt: string,
): CollaboratorPriorityAddress {
  return { id, collaboratorId: "collab-1", addressType, city, countryCode, createdAt };
}

test("chooses permanent collaborator address before other address types", () => {
  const selected = selectPrimaryCollaboratorAddress([
    address("work", "work", "Brno", "CZ", "2024-01-01"),
    address("permanent", "permanent", "Bratislava", "SK", "2025-01-01"),
    address("correspondence", "correspondence", "Vienna", "AT", "2023-01-01"),
  ]);
  assert.equal(selected?.id, "permanent");
  assert.deepEqual(normalizeCollaboratorPriorityCity([
    address("work", "work", "Brno", "CZ", "2024-01-01"),
    address("permanent", "permanent", "Bratislava", "SK", "2025-01-01"),
  ]), {
    key: "SK:bratislava",
    city: "Bratislava",
    countryCode: "SK",
  });
});

test("breaks same-type ties deterministically without exposing address fields", () => {
  const selected = selectPrimaryCollaboratorAddress([
    address("z-address", "permanent", "Later", "SK", "2024-01-01"),
    address("a-address", "permanent", "Earlier", "SK", "2024-01-01"),
  ]);
  assert.equal(selected?.id, "a-address");
  assert.deepEqual(normalizeCollaboratorPriorityCity([
    address("z-address", "permanent", "Later", "SK", "2024-01-01"),
    address("a-address", "permanent", null, "SK", "2024-01-01"),
  ]), null);
});
