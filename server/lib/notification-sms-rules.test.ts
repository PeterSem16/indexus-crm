import assert from "node:assert/strict";
import test from "node:test";
import { matchesNotificationConditions } from "./notification-rule-conditions";

test("SMS rule filters work identically for both gateways and preserve false flags", () => {
  for (const provider of ["bulkgate", "smstools"]) {
    const data = { countryCode: "SK", metadata: { provider, sentiment: "angry", hasAngryTone: true, wantsToCancel: false } };
    assert(matchesNotificationConditions(null, data));
    assert(matchesNotificationConditions({}, data));
    assert(matchesNotificationConditions({ provider: ["bulkgate", "smstools"], hasAngryTone: true, wantsToCancel: false }, data));
    assert(!matchesNotificationConditions({ countryCode: "CZ" }, data));
    assert(!matchesNotificationConditions({ hasAngryTone: false }, data));
    assert(!matchesNotificationConditions({ wantsToCancel: true }, data));
    assert(!matchesNotificationConditions({ ignoredUnknownField: "guess" }, data));
    assert(!matchesNotificationConditions({ countryCode: [] }, data));
    assert(!matchesNotificationConditions(["bad"], data));
  }
});
test("unknown country never matches country-scoped conditions", () => {
  assert(!matchesNotificationConditions({ countryCode: "SK" }, { metadata: { provider: "bulkgate" } }));
});
