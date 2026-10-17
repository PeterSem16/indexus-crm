import test from "node:test";
import assert from "node:assert/strict";
import { registryComparisonDocument } from "./healthcare-legal-entity-comparison-document";
import { compareRegistrySnapshots, type RegistrySnapshot } from "./healthcare-legal-entity-diff";
import { healthcareLegalEntityTranslations as copies } from "../client/src/i18n/healthcare-legal-entity-translations";

const previous: RegistrySnapshot = {
  summary: { id: "old", checkedAt: "2026-10-10T10:00:00Z", sourceUpdatedAt: "2026-10-09T19:00:00Z" },
  company: { countryCode: "SK", ico: "00151653", name: "Old & company", legalForm: "s.r.o.",
    registeredAddress: "Old street", city: "Bratislava", postalCode: "81101", status: "active",
    registryReference: { court: "B", section: "Sro", insertNumber: 123 }, establishedAt: null, terminatedAt: null },
  people: [{ key: "PRIVATE_KEY", name: "Officer <script>alert(1)</script>", role: "Konateľ", kind: "statutoryBody",
    current: true, validFrom: "2020-01-01", validTo: null }],
};
const current = structuredClone(previous);
current.summary = { id: "new", checkedAt: "2026-10-15T12:00:00Z", sourceUpdatedAt: "2026-10-14T19:00:00Z" };
Object.assign(current.company, { name: 'New <img src="https://example.invalid">', postalCode: null, status: "terminated" });
current.people[0].current = false;
current.people[0].validTo = "2026-10-15";

test("readable comparison uses the same public diff in all seven languages without mutation or private data", () => {
  const before = JSON.stringify([previous, current]);
  const comparison = compareRegistrySnapshots(previous, current);
  // Simulate future private fields added to otherwise public DTOs.
  const company = { ...current.company, rawData: { secret: "PRIVATE_PAYLOAD" } };
  Object.assign(comparison.roles.added[0], { rawData: "PRIVATE_ROLE" });
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const c = copies[locale];
    assert.ok(c.downloadComparison);
    const html = registryComparisonDocument(comparison, company, c, locale);
    for (const label of [c.registryChanges, c.previousSnapshot, c.newSnapshot, c.checkedAt, c.orsrSyncAt,
      c.corporateRoles, c.rolesRemoved, c.rolesAdded, c.active, c.terminated, c.validFrom, c.validTo, c.comparisonReadOnly])
      assert.ok(html.includes(label), `${locale}: ${label}`);
    assert.ok(html.includes("00151653"));
    assert.ok(html.includes("Old &amp; company"));
    assert.ok(html.includes("123"));
    assert.ok(html.includes("Europe/Bratislava"));
    assert.ok(html.includes('lang="' + locale + '"'));
    assert.ok(!html.includes("PRIVATE_"));
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<img"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes(c.registryUnchanged));
  }
  // Discard the intentionally injected unknown property before checking sources.
  delete (current.people[0] as any).rawData;
  assert.equal(JSON.stringify([previous, current]), before);
});

test("baseline, unchanged and absent timestamps remain explicit", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const c = copies[locale];
    const baseline = compareRegistrySnapshots(null, { ...previous, summary: { ...previous.summary, sourceUpdatedAt: null } });
    const html = registryComparisonDocument(baseline, previous.company, c, locale);
    assert.ok(html.includes(c.firstVerification));
    assert.ok(html.includes(`${c.orsrSyncAt}: —`));
    assert.ok(!html.includes("<table"));
    const unchanged = registryComparisonDocument(compareRegistrySnapshots(previous, previous), previous.company, c, locale);
    assert.ok(unchanged.includes(c.registryUnchanged));
    assert.ok(!unchanged.includes("<table"));
  }
});
