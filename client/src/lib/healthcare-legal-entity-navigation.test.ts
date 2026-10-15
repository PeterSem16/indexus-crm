import assert from "node:assert/strict";
import test from "node:test";
import { healthcareLegalEntitiesUrl } from "./healthcare-legal-entity-navigation";

test("legal entity links use the Hospitals tab and preserve record/history parameters", () => {
  assert.equal(healthcareLegalEntitiesUrl(), "/hospitals?tab=legal-entities");
  const url = new URL(healthcareLegalEntitiesUrl("?id=site%2Fcompany&history=pending&tab=old"), "https://example.invalid");
  assert.equal(url.pathname, "/hospitals");
  assert.equal(url.searchParams.get("id"), "site/company");
  assert.equal(url.searchParams.get("history"), "pending");
  assert.deepEqual(url.searchParams.getAll("tab"), ["legal-entities"]);
});
