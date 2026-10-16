/** Only readiness flags are safe for general country/public configuration.
 * Never spread process.env or return the server credential to a client.
 */
export function finderMapsReadiness() {
  const browser = process.env.GOOGLE_MAPS_BROWSER_API_KEY?.trim();
  const server = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  const distinct = !(browser && server && browser === server);
  const mapReady = !!browser && distinct;
  const geocodingReady = !!server && distinct;
  return { mapsReady: mapReady && geocodingReady, mapReady, geocodingReady, mapsProvider: "google" as const };
}
