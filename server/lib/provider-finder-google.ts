import { z } from "zod";
import { FinderError } from "./provider-finder-store";

export const addressSchema = z.object({
  address: z.string().trim().min(4).max(300),
  language: z.enum(["en", "sk", "cs", "hu", "ro", "it", "de"]).default("en"),
}).strict();
export async function geocodeFinderAddress(address: string, country: string, language: string) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) throw new FinderError("maps_not_configured", 503);
  // User-triggered only, never autocomplete or a bulk import. No customer identity
  // is sent, no address/result is persisted, and upstream URLs/errors are not logged.
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.search = new URLSearchParams({ address, components: `country:${country}`, language, key }).toString();
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(10000) }); }
  catch { throw new FinderError("maps_unavailable", 502); }
  if (!response.ok) throw new FinderError("maps_unavailable", 502);
  const body = await response.json();
  if (body.status === "ZERO_RESULTS") return [];
  if (body.status !== "OK") throw new FinderError(body.status === "OVER_QUERY_LIMIT" ? "maps_quota" : "maps_unavailable", 502);
  return body.results.slice(0, 5).filter((r: any) => r.address_components?.some((c: any) =>
    c.types?.includes("country") && c.short_name === country)).map((r: any) => ({
      label: String(r.formatted_address), point: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
      approximate: r.partial_match === true || !["ROOFTOP", "RANGE_INTERPOLATED"].includes(r.geometry.location_type),
    }));
}
