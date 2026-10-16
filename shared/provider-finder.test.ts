import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FINDER_POLICY, distanceKm, finderPolicySchema, profileSchema, rankProviders, searchSchema, type FinderProvider } from "./provider-finder";
import { providerFinderTranslations } from "../client/src/i18n/provider-finder-translations";

const site = (id: string, overrides: Partial<FinderProvider> = {}): FinderProvider => ({
  id, type: "clinic", name: id, address: "test", city: "test", lat: 48.15, lng: 17.12, active: true,
  enabled: true, publicVisible: true, paused: false, contracted: false, lastContactAt: null, services: ["service"],
  publicPhone: "", publicEmail: "", people: [], ...overrides,
});
const policy = { ...DEFAULT_FINDER_POLICY, enabled: true, services: ["service"] };
const search = searchSchema.parse({ point: { lat: 48.15, lng: 17.11 }, radiusKm: 25 });
test("distance uses valid coordinates, retains zero coordinates and handles identical points", () => {
  assert.equal(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  assert.ok(distanceKm({ lat: 48, lng: 17 }, { lat: 48.1, lng: 17 }) > 11);
});
test("weighted contract upload applies only within eligibility and radius; ties are stable", () => {
  const results = rankProviders([
    site("near"), site("far-contract", { lng: 17.2, contracted: true, uploadedContract: true }),
    site("outside", { lng: 18, contracted: true }), site("paused", { paused: true, contracted: true }),
    site("inactive", { active: false }), site("unknown", { lat: null }), site("invalid", { lat: NaN }),
  ], policy, search);
  assert.deepEqual(results.map(x => x.id), ["far-contract", "near"]);
  assert.equal(rankProviders([site("b"), site("a")], policy, search)[0].id, "a");
});
test("service, type, Persons and only-contract filters fail closed", () => {
  const sites = [site("c"), site("h", { type: "hospital", services: [], people: [{ id: "p", name: "Doctor Example" }] })];
  assert.equal(rankProviders(sites, { ...policy, requireContract: true }, search).length, 0);
  assert.deepEqual(rankProviders(sites, policy, { ...search, service: "service" }).map(p => p.id), ["c"]);
  assert.deepEqual(rankProviders(sites, policy, { ...search, peopleOnly: true, personQuery: "doctor" }).map(p => p.id), ["h"]);
  assert.equal(rankProviders(sites, policy, { ...search, types: [] }).length, 0);
  assert.throws(() => rankProviders(sites, policy, { ...search, radiusKm: 201 }));
  assert.throws(() => rankProviders(sites, policy, { ...search, service: "unknown" }));
});
test("country-wide public output includes same-country sites without individual opt-in and hides CRM evidence", () => {
  const results = rankProviders([site("private", { publicVisible: false }), site("public", { contracted: true, lastContactAt: new Date().toISOString() })], policy, search, true);
  assert.equal(results.length, 2);
  for (const key of ["contracted", "lastContactAt", "recentContact", "contractProfile", "publicPersonIds", "enabled", "publicVisible", "cooperating", "uploadedContract", "hasRepresentative", "priorityScore"]) assert.ok(!(key in results[0]));
});
test("each required criterion filters independently and cannot be replaced by a high score", () => {
  const sites = [site("none"), site("coop", { cooperating: true }),
    site("upload", { uploadedContract: true }), site("rep", { hasRepresentative: true }),
    site("all", { cooperating: true, uploadedContract: true, hasRepresentative: true })];
  for (const [criterion, id] of [["requireCooperation", "coop"], ["requireUploadedContract", "upload"], ["requireRepresentative", "rep"]] as const)
    assert.deepEqual(new Set(rankProviders(sites, { ...policy, [criterion]: true }, search).map(p => p.id)), new Set([id, "all"]));
  assert.deepEqual(rankProviders(sites, { ...policy, requireCooperation: true, requireUploadedContract: true, requireRepresentative: true }, search).map(p => p.id), ["all"]);
});
test("weights change actual ordering, zero weights are valid, distance remains the deterministic tie-breaker", () => {
  const sites = [site("near"), site("far", { lng: 17.2, hasRepresentative: true })];
  assert.equal(rankProviders(sites, { ...policy, priorityWeights: { ...policy.priorityWeights, representative: 100, distance: 0 } }, search)[0].id, "far");
  assert.equal(rankProviders(sites, { ...policy, priorityWeights: { distance: 100, representative: 0, uploadedContract: 0, cooperation: 0, recentContact: 0 } }, search)[0].id, "near");
  assert.equal(finderPolicySchema.safeParse({ priorityWeights: { ...policy.priorityWeights, distance: 101 } }).success, false);
});
test("policy and profile validate all inputs without silent extra field drops", () => {
  assert.equal(DEFAULT_FINDER_POLICY.enabled, false);
  assert.equal(profileSchema.parse({ type: "clinic", id: "x" }).publicVisible, false);
  assert.equal(profileSchema.parse({ type: "clinic", id: "x" }).useClinicContractEvidence, false);
  assert.equal(finderPolicySchema.safeParse({ defaultRadiusKm: 40, maxRadiusKm: 20 }).success, false);
  assert.equal(searchSchema.safeParse({ ...search, point: { lat: "", lng: 17 } }).success, false);
  assert.equal(finderPolicySchema.safeParse({ arbitrary: true }).success, false);
});
test("all seven languages contain the complete finder copy", () => {
  const keys = Object.keys(providerFinderTranslations.en).sort();
  for (const language of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    assert.deepEqual(Object.keys(providerFinderTranslations[language]).sort(), keys);
    for (const text of Object.values(providerFinderTranslations[language])) assert.ok(text.trim().length);
  }
});
