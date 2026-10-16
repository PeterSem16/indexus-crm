import { createHash } from "node:crypto";
import { z } from "zod";
import { FinderError } from "./provider-finder-error";

export const addressSchema = z.object({
  address: z.string().trim().min(4).max(300),
  language: z.enum(["en", "sk", "cs", "hu", "ro", "it", "de"]).default("en"),
}).strict();

type Candidate = { label: string; point: { lat: number; lng: number }; approximate: boolean };
const responseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.unknown()).max(100),
});
const featureSchema = z.object({
  geometry: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }),
  properties: z.object({
    countrycode: z.string(), name: z.string().optional(), street: z.string().optional(),
    housenumber: z.string().optional(), postcode: z.string().optional(),
    city: z.string().optional(), district: z.string().optional(), country: z.string().optional(),
  }),
});

// Endpoint is operator-controlled, never accepted from a request (SSRF boundary).
export function createFinderGeocoder(options: {
  endpoint: () => string;
  fetcher: typeof fetch;
  withSlot: <T>(run: () => Promise<T>) => Promise<T>;
  now?: () => number;
  cacheLimit?: number;
  cacheTtl?: number;
}) {
  const now = options.now || Date.now;
  // No address plaintext in keys, no disk persistence, bounded 24-hour cache.
  const cache = new Map<string, { expires: number; candidates: Candidate[] }>();
  const pending = new Map<string, Promise<Candidate[]>>();
  let retryAfter = 0;
  return async (address: string, country: string, language: string): Promise<Candidate[]> => {
    const input = addressSchema.parse({ address, language });
    if (!/^[A-Z]{2}$/.test(country)) throw new FinderError("invalid");
    const endpoint = options.endpoint();
    const key = createHash("sha256").update(JSON.stringify([endpoint, country, language, input.address.normalize("NFC").toLocaleLowerCase()])).digest("hex");
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return structuredClone(hit.candidates);
    if (hit) cache.delete(key);
    const existing = pending.get(key);
    if (existing) return structuredClone(await existing);
    if (retryAfter > now() || pending.size >= 4) throw new FinderError("maps_quota", 429);
    const task = options.withSlot(async () => {
      let url: URL;
      try { url = new URL(endpoint); } catch { throw new FinderError("maps_not_configured", 503); }
      if (url.protocol !== "https:" || url.username || url.password) throw new FinderError("maps_not_configured", 503);
      // The public Photon index supports en/de/fr and local names ("default"),
      // not every UI locale. Do not send e.g. sk/cs/hu (upstream rejects them).
      const photonLanguage = ["en", "de"].includes(language) ? language : "default";
      url.search = new URLSearchParams({ q: input.address, countrycode: country, lang: photonLanguage, limit: "5" }).toString();
      let candidates: Candidate[];
      try {
        // Explicit searches only; do not send customer identity, phone or email.
        const response = await options.fetcher(url, {
          headers: { "User-Agent": "INDEXUS-ProviderFinder/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(10000), redirect: "error",
        });
        if (response.status === 429) {
          const seconds = Number(response.headers.get("retry-after"));
          retryAfter = now() + Math.min(3600, Math.max(60, Number.isFinite(seconds) ? seconds : 60)) * 1000;
          throw new FinderError("maps_quota", 429);
        }
        if (!response.ok) throw new FinderError("maps_unavailable", 502);
        const body = responseSchema.parse(await response.json());
        const seen = new Set<string>();
        candidates = [];
        for (const raw of body.features) {
          const parsed = featureSchema.safeParse(raw);
          if (!parsed.success) continue;
          const { properties: p, geometry: { coordinates: [lng, lat] } } = parsed.data;
          if (p.countrycode.toUpperCase() !== country) continue;
          const label = [...new Set([
            p.name, [p.street, p.housenumber].filter(Boolean).join(" "),
            [p.postcode, p.city || p.district].filter(Boolean).join(" "), p.country,
          ].filter(Boolean))].join(", ").slice(0, 500);
          const identity = `${lat}:${lng}:${label}`;
          if (!label || seen.has(identity)) continue;
          seen.add(identity);
          candidates.push({ label, point: { lat, lng }, approximate: !p.housenumber });
          if (candidates.length === 5) break;
        }
      } catch (e) {
        if (e instanceof FinderError) throw e;
        throw new FinderError("maps_unavailable", 502);
      }
      for (const [k, v] of cache) if (v.expires <= now()) cache.delete(k);
      if (cache.size >= (options.cacheLimit ?? 500)) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: now() + (options.cacheTtl ?? 86400000), candidates });
      return candidates;
    });
    pending.set(key, task);
    try { return structuredClone(await task); } finally { pending.delete(key); }
  };
}
