import { z } from "zod";

export const providerType = z.enum(["clinic", "hospital"]);
export const pointSchema = z.object({ lat: z.number().finite().min(-85).max(85), lng: z.number().finite().min(-180).max(180) }).strict();
export type FinderPoint = z.infer<typeof pointSchema>;
export const finderCriteria = ["currentAgreement", "previousAgreement", "cooperation", "uploadedContract", "representative", "referralReceived", "referralGiven", "recentContact"] as const;
export type FinderCriterion = typeof finderCriteria[number];
const criterionRule = z.object({
  mode: z.enum(["ignore", "prefer", "require"]).default("prefer"),
  weight: z.number().int().min(0).max(100),
}).strict();
export const finderQualitySchema = z.object({
  enabled: z.boolean().default(false),
  minimumScore: z.number().int().min(0).max(100).default(50),
  distanceWeight: z.number().int().min(0).max(100).default(10),
  agreementPriority: z.boolean().default(true),
  fallback: z.enum(["append", "when_empty", "never"]).default("append"),
  rules: z.object({
    currentAgreement: criterionRule.default({ mode: "prefer", weight: 40 }),
    previousAgreement: criterionRule.default({ mode: "prefer", weight: 10 }),
    cooperation: criterionRule.default({ mode: "prefer", weight: 25 }),
    uploadedContract: criterionRule.default({ mode: "prefer", weight: 10 }),
    representative: criterionRule.default({ mode: "prefer", weight: 15 }),
    referralReceived: criterionRule.default({ mode: "prefer", weight: 10 }),
    referralGiven: criterionRule.default({ mode: "prefer", weight: 10 }),
    recentContact: criterionRule.default({ mode: "prefer", weight: 5 }),
  }).strict().default({}),
}).strict();
export type FinderQuality = z.infer<typeof finderQualitySchema>;
export const finderPolicySchema = z.object({
  enabled: z.boolean().default(false),
  publicEnabled: z.boolean().default(false),
  defaultRadiusKm: z.number().int().min(1).max(200).default(25),
  maxRadiusKm: z.number().int().min(1).max(200).default(100),
  requireContract: z.boolean().default(false),
  preferContract: z.boolean().default(true),
  preferRecentContact: z.boolean().default(false),
  recentContactDays: z.number().int().min(1).max(365).default(90),
  requireCooperation: z.boolean().default(false),
  requireUploadedContract: z.boolean().default(false),
  requireRepresentative: z.boolean().default(false),
  quality: finderQualitySchema.default({}),
  priorityWeights: z.object({
    distance: z.number().int().min(0).max(100),
    cooperation: z.number().int().min(0).max(100),
    uploadedContract: z.number().int().min(0).max(100),
    representative: z.number().int().min(0).max(100),
    recentContact: z.number().int().min(0).max(100),
  }).strict().default({ distance: 20, cooperation: 30, uploadedContract: 30, representative: 20, recentContact: 0 }),
  services: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
}).strict().refine(p => p.defaultRadiusKm <= p.maxRadiusKm, { message: "invalid_radius" });
export type FinderPolicy = z.infer<typeof finderPolicySchema>;
export const DEFAULT_FINDER_POLICY: FinderPolicy = finderPolicySchema.parse({});
export const profileSchema = z.object({
  type: providerType, id: z.string().min(1).max(128),
  enabled: z.boolean().default(true), publicVisible: z.boolean().default(false),
  paused: z.boolean().default(false),
  services: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  publicPhone: z.string().trim().max(50).default(""),
  publicEmail: z.string().trim().email().or(z.literal("")).default(""),
  publicPersonIds: z.array(z.string().min(1).max(128)).max(100).default([]),
  useClinicContractEvidence: z.boolean().default(false),
  contractReference: z.string().trim().max(150).default(""),
  contractValidFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  contractValidTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
}).strict();
export type FinderProfile = z.infer<typeof profileSchema>;
export type FinderEvidence = Partial<Record<FinderCriterion, boolean>>;
export type FinderPerson = { id: string; name: string; evidence?: FinderEvidence };
export type FinderProvider = {
  id: string; type: "clinic" | "hospital"; name: string; address: string; city: string;
  lat: number | null; lng: number | null; active: boolean; contracted: boolean;
  paused: boolean; lastContactAt: string | null; services: string[]; publicVisible: boolean;
  enabled: boolean; people: FinderPerson[]; publicPhone: string; publicEmail: string;
  cooperating?: boolean; uploadedContract?: boolean; hasRepresentative?: boolean;
  publicPersonIds?: string[];
  evidence?: FinderEvidence;
  contractProfile?: Pick<FinderProfile, "useClinicContractEvidence" | "contractReference" | "contractValidFrom" | "contractValidTo">;
};
export type FinderResult = Pick<FinderProvider, "id" | "type" | "name" | "address" | "city" | "lat" | "lng" | "people" | "services" | "publicPhone" | "publicEmail"> & {
  distanceKm: number; contracted?: boolean; recentContact?: boolean;
  cooperating?: boolean; uploadedContract?: boolean; hasRepresentative?: boolean; priorityScore?: number;
  suggestedPersonId?: string;
  quality?: { score: number; tier: "recommended" | "previous" | "other"; matched: FinderCriterion[];
    missing: FinderCriterion[]; unknown: FinderCriterion[]; personId?: string; personName?: string;
    notNearest: boolean; breakdown: { criterion: FinderCriterion | "distance"; points: number }[] };
};
export type FinderContext = {
  billingCompanyId: string; country: string; companyName: string; policy: FinderPolicy;
  mapsReady: boolean; mapReady?: boolean; geocodingReady?: boolean; mapsProvider?: "google";
};
export type FinderSelection = { id: string; type: "clinic" | "hospital"; personId?: string; billingCompanyId: string; country: string };
export const selectionSchema = z.object({
  id: z.string().min(1).max(128), type: providerType, personId: z.string().min(1).max(128).optional(),
  billingCompanyId: z.string().min(1).max(128), country: z.string().regex(/^[A-Z]{2}$/),
}).strict();
export const searchSchema = z.object({
  point: pointSchema, radiusKm: z.number().finite().min(1).max(200),
  service: z.string().max(100).default(""),
  types: z.array(providerType).max(2).default(["clinic", "hospital"]),
  personQuery: z.string().trim().max(100).default(""),
  peopleOnly: z.boolean().default(false),
}).strict();
export type FinderSearch = z.infer<typeof searchSchema>;
export function matchesFinderRequirements(p: FinderProvider, policy: FinderPolicy) {
  return (!policy.requireContract || p.contracted) &&
    (!policy.requireCooperation || p.cooperating === true) &&
    (!policy.requireUploadedContract || p.uploadedContract === true) &&
    (!policy.requireRepresentative || p.hasRepresentative === true);
}
export function finderEvidence(p: FinderProvider): FinderEvidence {
  return { currentAgreement: p.contracted, cooperation: p.cooperating, uploadedContract: p.uploadedContract,
    representative: p.hasRepresentative, ...p.evidence };
}
export function evaluateFinderQuality(evidence: FinderEvidence, policy: FinderPolicy, distance: number, radius: number) {
  const q = policy.quality;
  const active = finderCriteria.filter(k => q.rules[k].mode !== "ignore");
  const matched = active.filter(k => evidence[k] === true);
  const missing = active.filter(k => evidence[k] === false);
  const unknown = active.filter(k => evidence[k] === undefined);
  const eligible = active.every(k => q.rules[k].mode !== "require" || evidence[k] === true);
  const total = active.reduce((s, k) => s + q.rules[k].weight, q.distanceWeight);
  const breakdown = [
    ...matched.map(criterion => ({ criterion, points: q.rules[criterion].weight })),
    { criterion: "distance" as const, points: q.distanceWeight * Math.max(0, 1 - distance / radius) },
  ];
  const score = total ? Math.round(breakdown.reduce((s, b) => s + b.points, 0) / total * 10000) / 100 : 0;
  // A nearby address alone is not evidence of cooperation.
  const positive = matched.some(k => q.rules[k].weight > 0 && k !== "previousAgreement");
  const recommended = positive && score >= q.minimumScore &&
    (!q.agreementPriority || evidence.currentAgreement === true);
  const tier = recommended ? "recommended" as const : evidence.previousAgreement === true && evidence.currentAgreement !== true ? "previous" as const : "other" as const;
  return { eligible, score, tier, matched, missing, unknown, breakdown };
}
export function finderQualityCandidates(p: FinderProvider, policy: FinderPolicy, distance = 0, radius = policy.maxRadiusKm, personQuery = "", now = Date.now(), requirePerson = false) {
  const base = finderEvidence(p);
  const recent = !!p.lastContactAt && Date.parse(p.lastContactAt) <= now &&
    Date.parse(p.lastContactAt) >= now - policy.recentContactDays * 86400000;
  const candidates = [
    ...(!personQuery && !requirePerson ? [{ evidence: { ...base, recentContact: recent }, person: undefined }] : []),
    ...p.people.filter(x => !personQuery || x.name.toLocaleLowerCase().includes(personQuery)).map(person => ({
      // Person evidence is evaluated independently: never manufacture a facility agreement from it.
      evidence: { ...person.evidence, representative: person.evidence?.representative ?? base.representative },
      person,
    })),
  ];
  return candidates.map(c => ({ ...evaluateFinderQuality(c.evidence, policy, distance, radius), person: c.person }))
    .filter(c => c.eligible)
    .sort((a, b) => qualityTier(a.tier) - qualityTier(b.tier) || b.score - a.score ||
      (a.person?.id || "").localeCompare(b.person?.id || ""));
}
function qualityTier(tier: "recommended" | "previous" | "other") { return tier === "recommended" ? 0 : tier === "previous" ? 1 : 2; }
export function distanceKm(a: FinderPoint, b: FinderPoint) {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export function rankProviders(providers: FinderProvider[], policy: FinderPolicy, search: FinderSearch, publicView = false, now = Date.now()): FinderResult[] {
  if (search.radiusKm > policy.maxRadiusKm || (search.service && !policy.services.includes(search.service))) throw new Error("invalid");
  const query = search.personQuery.toLocaleLowerCase();
  const weights = policy.priorityWeights;
  let rows = providers.filter(p => p.active && !p.paused &&
    matchesFinderRequirements(p, policy) && search.types.includes(p.type) &&
    (!search.service || p.services.includes(search.service)) &&
    (!search.peopleOnly || p.people.length > 0) &&
    (!query || p.people.some(x => x.name.toLocaleLowerCase().includes(query))) &&
    p.lat !== null && p.lng !== null && pointSchema.safeParse({ lat: p.lat, lng: p.lng }).success)
    .map(p => ({ ...p, distance: distanceKm(search.point, { lat: p.lat!, lng: p.lng! }),
      recent: !!p.lastContactAt && new Date(p.lastContactAt).getTime() <= now &&
        new Date(p.lastContactAt).getTime() >= now - policy.recentContactDays * 86400000 }))
    .filter(p => p.distance <= search.radiusKm)
    .map(p => ({ ...p, qualityResult: policy.quality.enabled ? finderQualityCandidates(p, policy, p.distance, search.radiusKm, query, now, search.peopleOnly)[0] : undefined,
      score: weights.distance * Math.max(0, 1 - p.distance / search.radiusKm) +
      weights.cooperation * Number(p.cooperating === true) +
      weights.uploadedContract * Number(p.uploadedContract === true) +
      weights.representative * Number(p.hasRepresentative === true) +
      weights.recentContact * Number(p.recent) }))
    .filter(p => !policy.quality.enabled || !!p.qualityResult)
    .sort((a, b) => (policy.quality.enabled ?
      qualityTier(a.qualityResult!.tier) - qualityTier(b.qualityResult!.tier) ||
      b.qualityResult!.score - a.qualityResult!.score : b.score - a.score) || a.distance - b.distance ||
      a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  const nearest = Math.min(...rows.map(p => p.distance));
  if (policy.quality.enabled && (policy.quality.fallback === "never" ||
    policy.quality.fallback === "when_empty" && rows.some(p => p.qualityResult!.tier === "recommended")))
    rows = rows.filter(p => p.qualityResult!.tier === "recommended");
  // Deliberately enumerate the public shape. Never spread database rows into results.
  return rows.map(p => ({ id: p.id, type: p.type, name: p.name, address: p.address, city: p.city,
    lat: p.lat, lng: p.lng, people: p.people.map(x => ({ id: x.id, name: x.name })), services: p.services, publicPhone: p.publicPhone, publicEmail: p.publicEmail,
    distanceKm: Math.round(p.distance * 100) / 100,
    ...(p.qualityResult?.person ? { suggestedPersonId: p.qualityResult.person.id } : {}),
    ...(!publicView ? { contracted: p.contracted, recentContact: p.recent, cooperating: p.cooperating === true,
      uploadedContract: p.uploadedContract === true, hasRepresentative: p.hasRepresentative === true,
       priorityScore: p.qualityResult?.score ?? Math.round(p.score * 100) / 100,
       ...(p.qualityResult ? { quality: { score: p.qualityResult.score, tier: p.qualityResult.tier,
         matched: p.qualityResult.matched, missing: p.qualityResult.missing, unknown: p.qualityResult.unknown,
         breakdown: p.qualityResult.breakdown,
         personId: p.qualityResult.person?.id, personName: p.qualityResult.person?.name,
         notNearest: p.distance > nearest + 0.01 } } : {}) } : {}) }));
}
