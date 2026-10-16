import { test } from "node:test";
import assert from "node:assert/strict";
import { createFinderGeocoder } from "./provider-finder-geocode";

const result = (country = "SK", extra = {}) => ({
  formatted_address: "Synthetic confirmed address",
  address_components: [{ short_name: country, types: ["country"] }],
  geometry: { location: { lat: 48.15, lng: 17.11 }, location_type: "ROOFTOP" },
  ...extra,
});
function setup(respond: (url: URL) => Response | Promise<Response>, key = () => "synthetic-server-test-only") {
  let calls = 0;
  return {
    calls: () => calls,
    geocode: createFinderGeocoder({ key, fetcher: (async (url: URL, init: RequestInit) => {
      calls++;
      assert.equal(url.hostname, "maps.googleapis.com");
      assert.equal(url.pathname, "/maps/api/geocode/json");
      assert.equal(init.redirect, "error");
      assert.ok(init.signal);
      return respond(new URL(url));
    }) as typeof fetch }),
  };
}
test("Google lookup is server-key authenticated and country restricted", async () => {
  const s = setup(url => {
    assert.equal(url.searchParams.get("address"), "Test address");
    assert.equal(url.searchParams.get("components"), "country:SK");
    assert.equal(url.searchParams.get("language"), "sk");
    assert.equal(url.searchParams.get("key"), "synthetic-server-test-only");
    return Response.json({ status: "OK", results: [result()] });
  });
  const r = await s.geocode(" Test address ", "SK", "sk");
  assert.deepEqual(r[0].point, { lat: 48.15, lng: 17.11 });
  assert.equal(r[0].approximate, false);
});
test("supports all seven UI languages without a Photon language fallback", async () => {
  const langs: string[] = [];
  const s = setup(url => { langs.push(url.searchParams.get("language")!); return Response.json({ status: "ZERO_RESULTS", results: [] }); });
  for (const lang of ["en", "sk", "cs", "hu", "ro", "it", "de"]) await s.geocode("Test address", "SK", lang);
  assert.deepEqual(langs, ["en", "sk", "cs", "hu", "ro", "it", "de"]);
});
test("filters foreign/malformed results and duplicate matches; flags approximate locations", async () => {
  const precise = result();
  const s = setup(() => Response.json({ status: "OK", results: [
    result("CZ"), result("SK", { geometry: { location: { lat: 999, lng: 1 }, location_type: "ROOFTOP" } }),
    {}, precise, precise, result("SK", { formatted_address: "Approximate", partial_match: true }),
  ] }));
  const r = await s.geocode("Test address", "SK", "en");
  assert.equal(r.length, 2);
  assert.equal(r[0].approximate, false);
  assert.equal(r[1].approximate, true);
});
test("only concurrent requests deduplicate; later lookups do not reuse Google response content", async () => {
  const s = setup(async () => { await new Promise(resolve => setTimeout(resolve, 5)); return Response.json({ status: "OK", results: [result()] }); });
  const [one, two] = await Promise.all([s.geocode("Test address", "SK", "en"), s.geocode("Test address", "SK", "en")]);
  one[0].point.lat = 0;
  assert.equal(two[0].point.lat, 48.15);
  assert.equal(s.calls(), 1);
  await s.geocode("Test address", "SK", "en");
  assert.equal(s.calls(), 2);
});
test("missing configuration fails before any billable request", async () => {
  const s = setup(() => Response.json({}), () => undefined as any);
  await assert.rejects(s.geocode("Test address", "SK", "en"), { code: "maps_not_configured", status: 503 });
  assert.equal(s.calls(), 0);
});
test("provider denial, billing/quota and outage are distinct and redact vendor errors", async () => {
  for (const [status, code, http] of [
    ["REQUEST_DENIED", "maps_authorization", 503], ["OVER_QUERY_LIMIT", "maps_quota", 429],
    ["OVER_DAILY_LIMIT", "maps_billing_or_quota", 503], ["UNKNOWN_ERROR", "maps_unavailable", 502],
  ] as const) {
    const s = setup(() => Response.json({ status, error_message: "DO NOT EXPOSE KEY OR RAW ERROR" }));
    await assert.rejects(s.geocode("Test address", "SK", "en"), { message: code, status: http });
  }
});
test("network errors, malformed responses and HTTP failures do not leak upstream details", async () => {
  for (const response of [
    () => { throw Error("private-address-and-key"); }, () => new Response("not json"),
    () => new Response("", { status: 500 }), () => Response.json({ status: "OK" }),
  ]) {
    const s = setup(response);
    await assert.rejects(s.geocode("Test address", "SK", "en"), { message: "maps_unavailable" });
  }
  const unauthorized = setup(() => new Response("", { status: 403 }));
  await assert.rejects(unauthorized.geocode("Test address", "SK", "en"), { code: "maps_authorization" });
  const quota = setup(() => new Response("", { status: 429 }));
  await assert.rejects(quota.geocode("Test address", "SK", "en"), { code: "maps_quota" });
});
test("invalid input fails before upstream", async () => {
  const s = setup(() => Response.json({}));
  await assert.rejects(s.geocode("Test address", "invalid", "en"), { message: "invalid" });
  await assert.rejects(s.geocode("x", "SK", "en"));
  assert.equal(s.calls(), 0);
});
