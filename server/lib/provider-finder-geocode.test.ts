import { test } from "node:test";
import assert from "node:assert/strict";
import { createFinderGeocoder } from "./provider-finder-geocode";

const feature = (countrycode = "SK", coords: unknown[] = [17.11, 48.15], extra = {}) => ({
  geometry: { type: "Point", coordinates: coords },
  properties: { countrycode, name: "Bratislava", city: "Bratislava", country: "Slovensko", ...extra },
});
function setup(respond: (url: URL) => Response | Promise<Response>, extra: Record<string, unknown> = {}) {
  let calls = 0, slots = 0;
  const geocode = createFinderGeocoder({
    endpoint: () => "https://photon.komoot.io/api/",
    fetcher: (async (url: URL, init: RequestInit) => {
      calls++;
      assert.equal(init.redirect, "error");
      assert.match((init.headers as Record<string, string>)["User-Agent"], /INDEXUS/);
      assert.ok(init.signal);
      return respond(new URL(url));
    }) as typeof fetch,
    withSlot: async run => { slots++; return run(); },
    ...extra,
  });
  return { geocode, calls: () => calls, slots: () => slots };
}
const json = (features: unknown[]) => Response.json({ type: "FeatureCollection", features });

test("Photon request restricts country and maps unsupported UI languages to local names", async () => {
  const s = setup(url => {
    assert.equal(url.searchParams.get("countrycode"), "SK");
    assert.equal(url.searchParams.get("q"), "Bratislava");
    assert.equal(url.searchParams.get("lang"), "default");
    assert.equal(url.searchParams.get("limit"), "5");
    assert.ok(!url.searchParams.has("key"));
    return json([feature()]);
  });
  const results = await s.geocode(" Bratislava ", "SK", "sk");
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].point, { lat: 48.15, lng: 17.11 });
  assert.equal(results[0].approximate, true);
});
test("filters foreign countries, invalid coordinates and duplicates", async () => {
  const valid = feature("sk", [17.12, 48.16], { street: "Test", housenumber: "1" });
  const s = setup(() => json([feature("CZ"), feature("SK", [999, 50]), { malformed: true }, valid, valid]));
  const r = await s.geocode("Test address", "SK", "en");
  assert.equal(r.length, 1);
  assert.equal(r[0].approximate, false);
  assert.match(r[0].label, /Test 1/);
});
test("all seven UI languages produce supported Photon language parameters", async () => {
  const langs: string[] = [];
  const s = setup(url => { langs.push(url.searchParams.get("lang")!); return json([]); });
  for (const lang of ["en", "sk", "cs", "hu", "ro", "it", "de"]) await s.geocode("Test address", "SK", lang);
  assert.deepEqual(langs, ["en", "default", "default", "default", "default", "default", "de"]);
});
test("coalesces identical searches and returns isolated cached results", async () => {
  const s = setup(async () => { await new Promise(r => setTimeout(r, 5)); return json([feature()]); });
  const [first, second] = await Promise.all([s.geocode("Bratislava", "SK", "sk"), s.geocode("bratislava", "SK", "sk")]);
  first[0].point.lat = 0;
  assert.equal(second[0].point.lat, 48.15);
  assert.equal((await s.geocode("Bratislava", "SK", "sk"))[0].point.lat, 48.15);
  assert.equal(s.calls(), 1);
  assert.equal(s.slots(), 1);
});
test("cache expires, is bounded and separates countries", async () => {
  let now = 0;
  const s = setup(url => json([feature(url.searchParams.get("countrycode")!)]),
    { now: () => now, cacheTtl: 100, cacheLimit: 1 });
  await s.geocode("Bratislava", "SK", "en");
  await s.geocode("Bratislava", "CZ", "en");
  await s.geocode("Bratislava", "SK", "en");
  assert.equal(s.calls(), 3);
  now = 101;
  await s.geocode("Bratislava", "SK", "en");
  assert.equal(s.calls(), 4);
});
test("empty results are cached", async () => {
  const s = setup(() => json([]));
  assert.deepEqual(await s.geocode("Unknown address", "SK", "en"), []);
  await s.geocode("Unknown address", "SK", "en");
  assert.equal(s.calls(), 1);
});
test("upstream quota uses cooldown without forwarding raw errors", async () => {
  const s = setup(() => new Response("private vendor error", { status: 429, headers: { "Retry-After": "120" } }));
  await assert.rejects(s.geocode("Test address", "SK", "en"), { message: "maps_quota", status: 429 });
  await assert.rejects(s.geocode("Another address", "SK", "en"), { message: "maps_quota" });
  assert.equal(s.calls(), 1);
});
test("upstream failures and malformed JSON fail explicitly and are not cached", async () => {
  for (const response of [() => new Response("internal details", { status: 500 }),
    () => Response.json({ wrong: true }), () => new Response("not json"), () => { throw Error("private URL"); }]) {
    const s = setup(response);
    for (let i = 0; i < 2; i++) await assert.rejects(s.geocode("Test address", "SK", "en"), { message: "maps_unavailable", status: 502 });
    assert.equal(s.calls(), 2);
  }
});
test("rejects invalid input and non-HTTPS endpoints before network access", async () => {
  const s = setup(() => json([]), { endpoint: () => "http://example.invalid/api" });
  await assert.rejects(s.geocode("Test address", "SK", "en"), { message: "maps_not_configured" });
  await assert.rejects(s.geocode("Test address", "invalid", "en"), { message: "invalid" });
  await assert.rejects(s.geocode("x", "SK", "en"));
  assert.equal(s.calls(), 0);
});
test("operator can replace Photon endpoint without a build; cache is endpoint-specific", async () => {
  let endpoint = "https://photon.komoot.io/api/";
  const s = setup(() => json([feature()]), { endpoint: () => endpoint });
  await s.geocode("Bratislava", "SK", "en");
  endpoint = "https://own-photon.example/api/";
  await s.geocode("Bratislava", "SK", "en");
  assert.equal(s.calls(), 2);
});
