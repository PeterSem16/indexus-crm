import assert from "node:assert/strict";
import test from "node:test";
import { canonicalRegionSuggestion, suggestAddressRegion } from "./region-suggestion";

const components = (district: string, country = "SK") => [
  { long_name: "Bratislavský kraj", short_name: "Bratislavský kraj", types: ["administrative_area_level_1"] },
  { long_name: district, short_name: district, types: ["administrative_area_level_2"] },
  { long_name: country, short_name: country, types: ["country"] },
];
const address = { countryCode: "SK", city: "Bratislava", streetNumber: "Špitálska 4" };
const provider = (body: unknown): typeof fetch => (async () => new Response(JSON.stringify(body))) as typeof fetch;
test("canonical spelling and diacritics are restored", () => {
  assert.deepEqual(canonicalRegionSuggestion("SK", ["Bratislavsky kraj"], ["Okres Pezinok"]),
    { region: "Bratislavský kraj", district: "Pezinok" });
  assert.equal(canonicalRegionSuggestion("SK", ["Trnavský kraj"], ["Pezinok"]), null);
  assert.equal(canonicalRegionSuggestion("SK", ["Imaginary"], ["Imaginary"]), null);
});
test("known unambiguous cities do not require an external provider", async () => {
  assert.deepEqual(await suggestAddressRegion({ countryCode: "SK", city: "Trnava" }, undefined),
    { region: "Trnavský kraj", district: "Trnava", confidence: "high", source: "local" });
});
test("Bratislava is not silently assigned to its first district", async () => {
  await assert.rejects(suggestAddressRegion(address, undefined), /maps_not_configured/);
});
test("provider receives a bounded request with country restriction", async () => {
  const result = await suggestAddressRegion(address, "test-key", async (url, options) => {
    assert.equal(new URL(String(url)).searchParams.get("components"), "country:SK");
    assert(options?.signal);
    return new Response(JSON.stringify({ status: "OK", results: [{ address_components: components("Bratislava I") }] }));
  });
  assert.equal(result.district, "Bratislava I");
});
test("cross-country, partial and conflicting results are rejected", async () => {
  for (const results of [
    [{ address_components: components("Bratislava I", "CZ") }],
    [{ partial_match: true, address_components: components("Bratislava I") }],
    [{ address_components: components("Bratislava I") }, { address_components: components("Bratislava II") }],
  ]) await assert.rejects(suggestAddressRegion(address, "test-key", provider({ status: "OK", results })), /ambiguous_address/);
});
test("provider authorization failure is not called a missing address", async () => {
  await assert.rejects(suggestAddressRegion(address, "test-key", provider({ status: "REQUEST_DENIED" })), /maps_authorization/);
});
test("configured AI remains available but cannot introduce arbitrary dropdown values", async () => {
  const denied = provider({ status: "REQUEST_DENIED" });
  assert.equal((await suggestAddressRegion(address, "test-key", denied, async () => ({
    region: "Bratislavský kraj", district: "Bratislava I", confidence: "high",
  }))).source, "ai");
  for (const confidence of ["low", "medium"]) await assert.rejects(
    suggestAddressRegion(address, "test-key", denied, async () => ({ region: "Bratislavský kraj", district: "Bratislava I", confidence })), /ambiguous_address/);
  await assert.rejects(suggestAddressRegion(address, "test-key", denied, async () => ({
    region: "Unknown", district: "Unknown", confidence: "high",
  })), /ambiguous_address/);
});
test("invalid input is rejected before any provider request", async () => {
  for (const input of [null, {}, { city: "X", countryCode: "XX" }, { ...address, streetNumber: {} }]) {
    await assert.rejects(suggestAddressRegion(input, "test-key", async () => { throw new Error("must_not_fetch"); }), /invalid_input/);
  }
});
