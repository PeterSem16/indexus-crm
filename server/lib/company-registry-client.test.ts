import assert from "node:assert/strict";
import test from "node:test";
import { loadAresCompany, loadAnafCompany, normalizeCompanyId, registryCountry, fetchAresJson } from "./company-registry-client";
import { compareRegistrySnapshots, registryComparisonKey } from "../../shared/healthcare-legal-entity-diff";

const ares = { ico: "00151653", obchodniJmeno: "Synthetic CZ operator", pravniForma: "112",
  sidlo: { textovaAdresa: "Synthetic 1, 110 00 Praha", nazevObce: "Praha", psc: 11000 },
  datumVzniku: "2001-01-01", datumAktualizace: "2026-10-16", futureField: { retain: true } };
const anaf = () => ({ found: [{ date_generale: { cui: 123456, denumire: "Synthetic RO operator",
  data_inregistrare: "14.02.2015", forma_juridica: "SRL", adresa: "Fiscal address" },
  adresa_sediu_social: { sdenumire_Strada: "Synthetic", snumar_Strada: "2", sdenumire_Localitate: "București", scod_Postal: "010101" },
  inregistrare_scop_Tva: { scpTVA: true }, stare_inactiv: { statusInactivi: true }, futureField: "retained" }], notFound: [] });

test("country-specific identifiers preserve Czech leading zeros and normalize Romanian VAT prefix", () => {
  assert.equal(normalizeCompanyId("00 151 653", "CZ"), "00151653");
  assert.equal(normalizeCompanyId(" ro 123456 ", "RO"), "123456");
  for (const value of ["0", "0123456", "12345678901", "1234x", "", null, 123])
    assert.throws(() => normalizeCompanyId(value, "RO"), /ico_invalid/);
  for (const value of ["DE", "", null]) assert.throws(() => registryCountry(value), /country_unsupported/);
});
test("ARES retains the full source and maps available fields without invented directors", async () => {
  const result = await loadAresCompany("00151653", async () => ares);
  assert.equal(result.company.countryCode, "CZ");
  assert.equal(result.company.name, ares.obchodniJmeno);
  assert.equal(result.company.city, "Praha");
  assert.equal(result.company.postalCode, "11000");
  assert.equal(result.company.registrySource, "ARES");
  assert.equal(result.sourceUpdatedAt, "2026-10-16");
  assert.deepEqual(result.registryPeople, []);
  assert.deepEqual(result.documents, []);
  assert.deepEqual((result.rawData.response as any).futureField, { retain: true });
  assert.equal((await loadAresCompany("00151653", async () => ({ ...ares, datumZaniku: "2020-02-29" }))).company.status, "terminated");
  assert.equal((await loadAresCompany("00151653", async () => ({ ...ares, datumVzniku: "2020-02-30" }))).company.establishedAt, null);
});
test("ARES rejects wrong identity and malformed records", async () => {
  await assert.rejects(loadAresCompany("00151653", async () => ({ ...ares, ico: "12345678" })), /registry_identity_conflict/);
  await assert.rejects(loadAresCompany("00151653", async () => ({ ...ares, obchodniJmeno: "" })), /registry_unavailable/);
  await assert.rejects(loadAresCompany("00151653", async () => ({ ...ares, datumZaniku: "invalid" })), /registry_unavailable/);
});
test("ANAF accepts its actual v9 success shape without cod and keeps tax inactivity separate from legal dissolution", async () => {
  let sent = "";
  const result = await loadAnafCompany("RO123456", async (id, date) => { sent = `${id}:${date}`; return anaf(); },
    new Date("2026-10-16T22:30:00Z"));
  assert.equal(sent, "123456:2026-10-17");
  assert.equal(result.company.countryCode, "RO");
  assert.equal(result.company.registrySource, "ANAF");
  assert.equal(result.company.status, "unknown");
  assert.equal(result.company.terminatedAt, null);
  assert.equal(result.company.establishedAt, "2015-02-14");
  assert.equal(result.company.registeredAddress, "Synthetic 2");
  assert.equal(result.company.city, "București");
  assert.deepEqual(result.company.taxStatus, { vatRegistered: true, inactive: true });
  assert.equal(result.sourceUpdatedAt, null, "Query date must never pretend to be a source synchronization date");
  assert.deepEqual(result.registryPeople, []);
  assert.equal((result.rawData.response as any).found[0].futureField, "retained");
});
test("ANAF documented success, missing CUI, identity conflicts and upstream errors remain distinct", async () => {
  assert.equal((await loadAnafCompany("123456", async () => ({ ...anaf(), cod: 200 }))).company.ico, "123456");
  await assert.rejects(loadAnafCompany("123456", async () => ({ found: [], notFound: [123456] })), /not_found/);
  await assert.rejects(loadAnafCompany("123456", async () => ({ ...anaf(), cod: 500 })), /registry_unavailable/);
  await assert.rejects(loadAnafCompany("123456", async () => ({ found: [], notFound: [] })), /registry_identity_conflict/);
  const wrong = anaf(); wrong.found[0].date_generale.cui = 123457;
  await assert.rejects(loadAnafCompany("123456", async () => wrong), /registry_identity_conflict/);
  const many = anaf(); many.found.push(many.found[0]);
  await assert.rejects(loadAnafCompany("123456", async () => many), /registry_identity_conflict/);
});
test("missing or incorrectly typed ANAF tax evidence is unknown, never silently false", async () => {
  const raw = anaf(); raw.found[0].inregistrare_scop_Tva = {} as any; raw.found[0].stare_inactiv = { statusInactivi: "false" } as any;
  assert.deepEqual((await loadAnafCompany("123456", async () => raw)).company.taxStatus, {});
});
test("ARES official transport is fixed-host, redirect-denying, bounded and distinguishes 404/429", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string | URL | Request, options: RequestInit) => {
      assert.equal(String(url), "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/00151653");
      assert.equal(options.redirect, "error");
      assert.ok(options.signal);
      return new Response(JSON.stringify(ares));
    }) as typeof fetch;
    assert.equal((await loadAresCompany("00151653")).company.ico, "00151653");
    for (const [status, code] of [[404, "not_found"], [429, "rate_limited"], [500, "registry_unavailable"]] as const) {
      globalThis.fetch = (async () => new Response("failure", { status })) as typeof fetch;
      await assert.rejects(fetchAresJson("00151653"), new RegExp(code));
    }
    globalThis.fetch = (async () => new Response("x".repeat(4 * 1024 * 1024 + 1))) as typeof fetch;
    await assert.rejects(fetchAresJson("00151653"), /registry_unavailable/);
    globalThis.fetch = (async () => new Response("not JSON")) as typeof fetch;
    await assert.rejects(fetchAresJson("00151653"), /registry_unavailable/);
  } finally { globalThis.fetch = original; }
});
test("ANAF tax changes participate in saved history comparisons and overview keys", async () => {
  const { company } = await loadAnafCompany("123456", async () => anaf());
  const before = { summary: { id: "before", checkedAt: "2026-10-16T00:00:00Z", sourceUpdatedAt: null }, company, people: [] };
  const after = { ...before, summary: { ...before.summary, id: "after" },
    company: { ...company, taxStatus: { vatRegistered: false, inactive: false } } };
  assert.deepEqual(compareRegistrySnapshots(before, after).fields, [
    { field: "vatRegistered", before: "true", after: "false" },
    { field: "taxInactive", before: "true", after: "false" },
  ]);
  assert.notEqual(registryComparisonKey(company, []), registryComparisonKey(after.company, []));
});
