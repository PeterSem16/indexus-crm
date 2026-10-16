import { createHash } from "node:crypto";
import { z } from "zod";
import { FinderError } from "./provider-finder-error";

export const addressSchema = z.object({
  address: z.string().trim().min(4).max(300),
  language: z.enum(["en", "sk", "cs", "hu", "ro", "it", "de"]).default("en"),
}).strict();

type Candidate = { label: string; point: { lat: number; lng: number }; approximate: boolean };
const resultSchema = z.object({
  formatted_address: z.string().min(1).max(1000),
  address_components: z.array(z.object({ short_name: z.string(), types: z.array(z.string()) })),
  geometry: z.object({
    location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
    location_type: z.string(),
  }),
  partial_match: z.boolean().optional(),
});

/** No persistent/result cache. Google formatted addresses are confirmation-only;
 * clients discard them before rendering a map (including Google maps, per EEA).
 */
export function createFinderGeocoder(options: { key: () => string | undefined; fetcher: typeof fetch }) {
  const pending = new Map<string, Promise<Candidate[]>>();
  return async (address: string, country: string, language: string): Promise<Candidate[]> => {
    const input = addressSchema.parse({ address, language });
    if (!/^[A-Z]{2}$/.test(country)) throw new FinderError("invalid");
    const apiKey = options.key()?.trim();
    if (!apiKey) throw new FinderError("maps_not_configured", 503);
    const identity = createHash("sha256").update(JSON.stringify([apiKey, country, language, input.address])).digest("hex");
    const existing = pending.get(identity);
    if (existing) return structuredClone(await existing);
    if (pending.size >= 20) throw new FinderError("maps_quota", 429);
    const task = (async () => {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.search = new URLSearchParams({
        address: input.address, components: `country:${country}`, language: input.language, key: apiKey,
      }).toString();
      try {
        // Server key stays here; do not log upstream URL, address or raw errors.
        const response = await options.fetcher(url, {
          signal: AbortSignal.timeout(10000), redirect: "error", headers: { Accept: "application/json" },
        });
        if (response.status === 429) throw new FinderError("maps_quota", 429);
        if ([401, 403].includes(response.status)) throw new FinderError("maps_authorization", 503);
        if (!response.ok) throw new FinderError("maps_unavailable", 502);
        const body = z.object({ status: z.string(), results: z.array(z.unknown()).max(100).optional() }).parse(await response.json());
        if (body.status === "ZERO_RESULTS") return [];
        if (body.status === "OVER_QUERY_LIMIT") throw new FinderError("maps_quota", 429);
        if (body.status === "OVER_DAILY_LIMIT") throw new FinderError("maps_billing_or_quota", 503);
        if (body.status === "REQUEST_DENIED") throw new FinderError("maps_authorization", 503);
        if (body.status !== "OK" || !body.results) throw new FinderError("maps_unavailable", 502);
        const candidates: Candidate[] = [];
        const seen = new Set<string>();
        for (const raw of body.results) {
          const parsed = resultSchema.safeParse(raw);
          if (!parsed.success) continue;
          const r = parsed.data;
          if (!r.address_components.some(c => c.types.includes("country") && c.short_name.toUpperCase() === country)) continue;
          const id = `${r.geometry.location.lat}:${r.geometry.location.lng}:${r.formatted_address}`;
          if (seen.has(id)) continue;
          seen.add(id);
          candidates.push({
            label: r.formatted_address, point: r.geometry.location,
            approximate: r.partial_match === true || !["ROOFTOP", "RANGE_INTERPOLATED"].includes(r.geometry.location_type),
          });
          if (candidates.length === 5) break;
        }
        return candidates;
      } catch (e) {
        if (e instanceof FinderError) throw e;
        throw new FinderError("maps_unavailable", 502);
      }
    })();
    pending.set(identity, task);
    try { return structuredClone(await task); }
    finally { pending.delete(identity); }
  };
}
