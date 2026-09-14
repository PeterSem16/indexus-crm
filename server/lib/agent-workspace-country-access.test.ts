import assert from "node:assert/strict";
import test from "node:test";
import { canAgentReadCampaignByWorkspaceCountry } from "./agent-workspace-country-access";

const canRead = (workspaceCountryCodes: string[], campaignCountryCodes: string[] | null, role = "user") =>
  canAgentReadCampaignByWorkspaceCountry({ role, workspaceCountryCodes, campaignCountryCodes });

test("uses workspace assignments rather than a mismatched user country list", () => {
  // The route has no users.assignedCountries input by design. These two
  // opposite cases protect both hiding a valid campaign and exposing an
  // invalid one when the legacy user field disagrees with workspace access.
  assert.equal(canRead(["SK"], ["SK"]), true);
  assert.equal(canRead(["SK"], ["CZ"]), false);
});

test("matches workspace campaign filter for empty scopes and admin", () => {
  assert.equal(canRead([], ["CZ"]), true);
  assert.equal(canRead(["SK"], []), true);
  assert.equal(canRead(["SK"], null), true);
  assert.equal(canRead(["SK"], ["CZ"], "admin"), true);
  assert.equal(canRead(["SK"], ["CZ", "SK"]), true);
});