import { z } from "zod";

export const providerType = z.enum(["clinic", "hospital"]);
export const pointSchema = z.object({ lat: z.number().finite().min(-85).max(85), lng: z.number().finite().min(-180).max(180) }).strict();
export type FinderPoint = z.infer<typeof pointSchema>;
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
export type FinderPerson = { id: string; name: string };
export type FinderProvider = {
  id: string; type: "clinic" | "hospital"; name: string; address: string; city: string;
  lat: number | null; lng: number | null; active: boolean; contracted: boolean;
  paused: boolean; lastContactAt: string | null; services: string[]; publicVisible: boolean;
  enabled: boolean; people: FinderPerson[]; publicPhone: string; publicEmail: string;
  cooperating?: boolean; uploadedContract?: boolean; hasRepresentative?: boolean;
  publicPersonIds?: string[];
  contractProfile?: Pick<FinderProfile, "useClinicContractEvidence" | "contractReference" | "contractValidFrom" | "contractValidTo">;
};
export type FinderResult = Pick<FinderProvider, "id" | "type" | "name" | "address" | "city" | "lat" | "lng" | "people" | "services" | "publicPhone" | "publicEmail"> & {
  distanceKm: number; contracted?: boolean; recentContact?: boolean;
  cooperating?: boolean; uploadedContract?: boolean; hasRepresentative?: boolean; priorityScore?: number;
};
export type FinderContext = { billingCompanyId: string; country: string; companyName: string; policy: FinderPolicy; mapsReady: boolean };
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
  const rows = providers.filter(p => p.active && !p.paused &&
    matchesFinderRequirements(p, policy) && search.types.includes(p.type) &&
    (!search.service || p.services.includes(search.service)) &&
    (!search.peopleOnly || p.people.length > 0) &&
    (!query || p.people.some(x => x.name.toLocaleLowerCase().includes(query))) &&
    p.lat !== null && p.lng !== null && pointSchema.safeParse({ lat: p.lat, lng: p.lng }).success)
    .map(p => ({ ...p, distance: distanceKm(search.point, { lat: p.lat!, lng: p.lng! }),
      recent: !!p.lastContactAt && new Date(p.lastContactAt).getTime() <= now &&
        new Date(p.lastContactAt).getTime() >= now - policy.recentContactDays * 86400000 }))
    .filter(p => p.distance <= search.radiusKm)
    .map(p => ({ ...p, score: weights.distance * Math.max(0, 1 - p.distance / search.radiusKm) +
      weights.cooperation * Number(p.cooperating === true) +
      weights.uploadedContract * Number(p.uploadedContract === true) +
      weights.representative * Number(p.hasRepresentative === true) +
      weights.recentContact * Number(p.recent) }))
    .sort((a, b) => b.score - a.score || a.distance - b.distance ||
      a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  // Deliberately enumerate the public shape. Never spread database rows into results.
  return rows.map(p => ({ id: p.id, type: p.type, name: p.name, address: p.address, city: p.city,
    lat: p.lat, lng: p.lng, people: p.people, services: p.services, publicPhone: p.publicPhone, publicEmail: p.publicEmail,
    distanceKm: Math.round(p.distance * 100) / 100,
    ...(!publicView ? { contracted: p.contracted, recentContact: p.recent, cooperating: p.cooperating === true,
      uploadedContract: p.uploadedContract === true, hasRepresentative: p.hasRepresentative === true,
      priorityScore: Math.round(p.score * 100) / 100 } : {}) }));
}
