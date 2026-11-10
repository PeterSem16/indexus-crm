import assert from "node:assert/strict";
import { regionCatalogue, recommendTerritories, validateSuggestedTerritories } from "./representative-region-suggestions";
import { applyRepresentativeRegionFilter } from "../../shared/representative-region-filter";
import { matchesMedicalPartnerRules, validateMedicalPartnerRules } from "../../shared/medical-partner-filter";
import { translations } from "../../client/src/i18n/translations";

async function main() {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const copy = translations[locale].representativeAssist;
    for (const key of Object.keys(translations.en.representativeAssist)) {
      assert.equal(typeof copy[key as keyof typeof copy], "string", `Runtime translation ${locale}.${key}`);
      assert(copy[key as keyof typeof copy].trim());
    }
  }
  const data = regionCatalogue("SK", [
    { region: "Bratislavský kraj", count: 6 }, { region: "bratislavsky kraj", count: 4 },
    { region: "Trnavský kraj", count: 8 }, { region: "Nitriansky kraj", count: 2 },
    { region: "Legacy territory", count: 3 }, { region: "", count: 1 }, { region: null, count: 2 },
  ]);
  assert.equal(data.total, 26); assert.equal(data.catalogue.length, 8);
  assert.equal(data.catalogue[0].count, 10); assert.equal(data.catalogue[0].values.length, 2);
  assert.equal(data.unknownCount, 3); assert.equal(data.unmapped[0].name, "Legacy territory");
  assert.throws(() => regionCatalogue("CH", []), /catalogue_unavailable/);
  let prompt: any;
  const groups = await recommendTerritories(data.catalogue, 2, async input => {
    prompt = input;
    return { groups: input.initialGroups.map(g => ({ regions: g.regions, count: -999, explanation: "ignored" })) };
  });
  assert.deepEqual(groups.map(g => g.count).sort(), [10, 10]);
  assert.equal(prompt.regions.length, 3); assert(!JSON.stringify(prompt).includes("Legacy"));
  assert(prompt.regions.every((r: any) => Object.keys(r).sort().join() === "count,name"));
  const entries = data.catalogue.filter(e => e.count);
  for (const bad of [
    { groups: [{ regions: [entries[0].name] }, { regions: [entries[0].name, entries[1].name, entries[2].name] }] },
    { groups: [{ regions: [entries[0].name] }, { regions: ["Invented region"] }] },
    { groups: [{ regions: [entries[0].name] }, { regions: [entries[1].name] }] },
    { groups: [{ regions: [entries[0].name, entries[1].name] }, { regions: [entries[2].name] }] },
  ]) assert.throws(() => validateSuggestedTerritories(bad, entries, 2), /ai_invalid/);
  await assert.rejects(() => recommendTerritories(data.catalogue, 11, async () => ({})), /invalid/);
  await assert.rejects(() => recommendTerritories(data.catalogue.filter(e => e.count === 2), 2, async () => ({})), /empty/);
  for (const entity of ["clinic", "hospital"] as const) {
    const rules = validateMedicalPartnerRules(entity, applyRepresentativeRegionFilter([
      { field: "name", op: "contains", value: "chosen" },
      { field: "city", op: "is", value: "OR alternative", conjunction: "or" },
    ], "SK", ["Bratislavský kraj", "bratislavsky kraj", "Trnavský kraj"]));
    assert(matchesMedicalPartnerRules(entity, { name: "chosen", countryCode: "SK", region: "Trnavský kraj" }, rules));
    assert(!matchesMedicalPartnerRules(entity, { city: "OR alternative", countryCode: "CZ", region: "Trnavský kraj" }, rules));
    assert(!matchesMedicalPartnerRules(entity, { city: "OR alternative", countryCode: "SK", region: "Nitriansky kraj" }, rules));
    assert(!matchesMedicalPartnerRules(entity, { name: "other", countryCode: "SK", region: "Trnavský kraj" }, rules));
    assert.doesNotThrow(() => validateMedicalPartnerRules(entity, [{ field: "region", op: "contains", value: "kraj" }]));
    assert.throws(() => validateMedicalPartnerRules(entity, [{ field: "city", op: "isAny", value: ["city"] }]));
  }
  console.log("PASS: canonical catalogue/aliases/unknowns, aggregate-only AI, strict balanced partition validation, country AND/OR filter guards and legacy text filters");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
