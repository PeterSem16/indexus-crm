import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FINDER_POLICY, finderPolicySchema, finderQualitySchema, rankProviders, searchSchema, finderQualityCandidates, type FinderProvider } from "./provider-finder";
const site = (id: string, extra: Partial<FinderProvider> = {}): FinderProvider => ({
  id, name: id, type: "clinic", address: "test", city: "test", lat: 48.15, lng: 17.12,
  active: true, paused: false, contracted: false, enabled: true, publicVisible: true,
  lastContactAt: null, services: [], publicPhone: "", publicEmail: "", people: [], ...extra,
});
const quality = finderQualitySchema.parse({ enabled: true, minimumScore: 20 });
const policy = { ...DEFAULT_FINDER_POLICY, quality };
const search = searchSchema.parse({ point: { lat: 48.15, lng: 17.11 }, radiusKm: 25 });
const good = site("good-far", { lng: 17.2, evidence: { currentAgreement: true, cooperation: true, representative: true } });
const old = site("previous", { evidence: { previousAgreement: true } });
test("quality puts recommended partners before historical agreements and nearest nonpartners, explaining the distance", () => {
  const results = rankProviders([site("nearest"), old, good], policy, search);
  assert.deepEqual(results.map(x => x.id), ["good-far", "previous", "nearest"]);
  assert.equal(results[0].quality?.notNearest, true);
  assert.equal(results[0].quality?.tier, "recommended");
  assert.equal(results[1].quality?.tier, "previous");
  assert.ok(results[0].quality!.matched.includes("currentAgreement"));
});
test("fallback modes never relax mandatory rules or geographic eligibility", () => {
  const mandatory = { ...quality, rules: { ...quality.rules, representative: { mode: "require" as const, weight: 15 } } };
  assert.deepEqual(rankProviders([site("near"), good, old], { ...policy, quality: mandatory }, search).map(x => x.id), ["good-far"]);
  assert.deepEqual(rankProviders([site("near"), good, old], { ...policy, quality: { ...quality, fallback: "when_empty" } }, search).map(x => x.id), ["good-far"]);
  assert.equal(rankProviders([old], { ...policy, quality: { ...quality, fallback: "when_empty" } }, search).length, 1);
  assert.equal(rankProviders([old], { ...policy, quality: { ...quality, fallback: "never" } }, search).length, 0);
  assert.equal(rankProviders([site("outside", { ...good, lng: 25 }), site("paused", { ...good, paused: true })], policy, search).length, 0);
});
test("unknown evidence cannot satisfy a requirement and is distinguished from known absence", () => {
  const p = site("hospital", { type: "hospital", evidence: { currentAgreement: undefined, representative: false } });
  const result = rankProviders([p], policy, search)[0];
  assert.ok(result.quality!.unknown.includes("currentAgreement"));
  assert.ok(result.quality!.missing.includes("representative"));
  const mandatory = { ...quality, rules: { ...quality.rules, currentAgreement: { mode: "require" as const, weight: 40 } } };
  assert.equal(rankProviders([p], { ...policy, quality: mandatory }, search).length, 0);
});
test("person contracts are independent, attributed to a named person and stripped from public data", () => {
  const hospital = site("hospital", { type: "hospital", evidence: { currentAgreement: undefined },
    people: [
      { id: "a", name: "Doctor Alpha", evidence: { currentAgreement: true, referralGiven: true } },
      { id: "b", name: "Doctor Beta", evidence: { currentAgreement: false } },
    ] });
  const mandatory = { ...quality, rules: { ...quality.rules, currentAgreement: { mode: "require" as const, weight: 40 } } };
  const p = { ...policy, quality: mandatory };
  const internal = rankProviders([hospital], p, search)[0];
  assert.equal(internal.quality?.personId, "a");
  assert.equal(internal.suggestedPersonId, "a");
  assert.equal(internal.contracted, false, "person agreement never becomes a hospital agreement");
  assert.equal(rankProviders([hospital], p, { ...search, personQuery: "beta" }).length, 0);
  assert.equal(rankProviders([site("facility-only", { evidence: { currentAgreement: true },
    people: [{ id: "b", name: "Doctor Beta", evidence: { currentAgreement: false } }] })],
    p, { ...search, peopleOnly: true }).length, 0, "Persons mode cannot borrow facility evidence");
  assert.equal(finderQualityCandidates(hospital, p).some(c => !c.person), false);
  const publicResult = rankProviders([hospital], p, search, true)[0];
  assert.equal(publicResult.suggestedPersonId, "a");
  for (const key of ["quality", "priorityScore", "evidence", "contracted"]) assert.ok(!(key in publicResult));
  assert.deepEqual(publicResult.people, [{ id: "a", name: "Doctor Alpha" }, { id: "b", name: "Doctor Beta" }]);
});
test("referral directions have independent weights; zero weights and ignoring criteria do not fabricate quality", () => {
  const rules = Object.fromEntries(Object.entries(quality.rules).map(([key, rule]) => [key, { ...rule, mode: "ignore" }])) as typeof quality.rules;
  rules.referralGiven = { mode: "prefer", weight: 100 };
  const q = { ...quality, agreementPriority: false, rules, distanceWeight: 0 };
  const results = rankProviders([site("received", { evidence: { referralReceived: true } }),
    site("given", { evidence: { referralGiven: true } })], { ...policy, quality: q }, search);
  assert.equal(results[0].id, "given");
  assert.equal(results[0].quality?.score, 100);
  assert.equal(results[1].quality?.score, 0);
  assert.equal(rankProviders([site("none")], { ...policy, quality: { ...q, minimumScore: 0 } }, search)[0].quality?.tier, "other");
});
test("invalid rules and unknown extra settings are rejected, old policies stay compatible", () => {
  assert.equal(finderPolicySchema.parse({}).quality.enabled, false);
  assert.equal(finderQualitySchema.safeParse({ minimumScore: 101 }).success, false);
  assert.equal(finderQualitySchema.safeParse({ rules: { typo: {} } }).success, false);
  assert.equal(finderQualitySchema.safeParse({ rules: { currentAgreement: { mode: "require", weight: -1 } } }).success, false);
});
