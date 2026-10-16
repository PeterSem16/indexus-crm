# Universal provider finder

## Entry points
- Existing customer: **Find a suitable provider** in the detail view or edit card.
- Configurator → **Billing Companies → System Settings → country** → Provider recommendations.
  The existing country selector controls the module for all billing companies in that country.
- Existing public `/f/:slug` form, when explicitly linked in that country configuration.

Internal and public channels are independent and off by default. There is no company chooser and no site-publication/services editor.
All active clinics/hospitals in the selected country are eligible when they have valid coordinates and meet the configured criteria.
Persons are shown through current active same-country workplace assignments, never private addresses or private contact details.
Enable the optional locator for each intended public form in country settings. The form shows a button, not an expanded locator.
Clicking opens the locator in a modal. Cancelling preserves a confirmed choice; explicit clear removes it. Submitting without a choice is allowed.

Eligibility precedes ranking: active, not paused, known valid coordinates, requested type/Person, configured required criteria and straight-line radius.
Independent required criteria are confirmed cooperation, a current uploaded contract and current representative assignment.
Weights (0–100 each) control distance, cooperation, uploaded contract, representative and recent cooperation activity.
Score is the sum of each satisfied criterion's weight plus distanceWeight × (1 − distance/radius).
Higher score ranks first; distance and stable entity identity break ties. Zero-weight criteria do not influence ranking.
Cooperation is the latest confirmed clinic `retention_active` status. An uploaded contract requires a current active clinic agreement file record;
a signed-status label alone is not an upload. Representatives require a current temporal assignment to an active user.
Hospitals currently have representative evidence but no equivalent facility cooperation/contract evidence; unknown does not count as true.
Recent activity is confirmed cooperation-event activity, not a claim about capacity, availability or service quality.
Policy is shared across the country; `billingCompanyId: "country"` is a compatibility marker in saved selections, not a real billing company.
Legacy company policy/profile tables are preserved but no longer control eligibility. No existing public forms are enabled automatically.
The customer selection is stored separately; an alternate search address does not update the customer.
Public selections are revalidated on submission and stored with the order submission, not silently applied to an existing customer.

## OpenStreetMap and address lookup
Leaflet renders OpenStreetMap raster tiles with visible copyright attribution.
No Google API key, account or billing setup is needed for this finder.
The map loads only when shown; standard browser caching/referrer behavior applies, with no offline download or tile prefetch.
Tile URL can be replaced through the server-side `PROVIDER_FINDER_TILE_URL` setting (default `https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
Operators using a different tile provider must preserve its required attribution.

Address conversion uses the Photon API (`https://photon.komoot.io/api/`), backed by OpenStreetMap.
`PROVIDER_FINDER_GEOCODER_URL` can point to a compatible private/hosted Photon endpoint without a rebuild.
This is an explicit user-triggered lookup, not autocomplete, bulk geocoding, or background enrichment.
Country restriction is sent upstream and independently checked on every returned candidate.
Only the entered search address is sent, never customer name, card, phone or email.
Results must be confirmed by the user; matches without a house number are marked approximate.
The public Photon index supports English/German and local names; the other UI languages use local names, not unsupported language codes.
Queries are deduplicated and cached in bounded process memory for 24 hours; keys are hashes and no address cache is persisted to disk.
The upstream request gate uses a dedicated database advisory lock shared by workers, allowing at most one request at a time with at least 1.1 seconds between starts.
Existing user/IP and application rate limits apply as well. Busy/quota/failure states are explicit and do not invent coordinates.
GPS-based search and existing CRM coordinate ranking do not depend on successful address lookup or tile loading.
Distances are straight-line kilometres, not driving distances.

Public OSM tiles and the Photon demo are best-effort services without an availability guarantee.
They are intended for moderate interactive use; high-traffic production needs an appropriate hosted or private service.
Review [Photon usage](https://github.com/komoot/photon#demo-server) and
[OSM tile policy](https://operations.osmfoundation.org/policies/tiles/) before enabling high-volume public traffic.
The public Nominatim endpoint is deliberately not used.
Finder responses are excluded from JSON-body access logging.

## Verification
```
npx tsx --test shared/provider-finder.test.ts server/lib/provider-finder-geocode.test.ts server/lib/provider-finder-routes.test.ts
```
The database integration test creates only uniquely named synthetic fixtures and cleans them up.
Startup creates the additive tables idempotently, including on the external production server. This feature does not change existing customer addresses or globally publish existing providers.
