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

## Google Maps and address lookup
Google Maps JavaScript API renders the map with Advanced Markers and Google's attribution.
Geocoding API converts an explicitly entered address to candidates on the server.
There is no manual origin picker, background enrichment, autocomplete, Places search, or paid routing.
The old Photon endpoint/tile settings are no longer used by this module. Unrelated maps are unchanged.

Country restriction is sent upstream and independently checked on every returned candidate.
All seven UI languages are sent directly to Google. Partial matches and approximate locality centres are marked approximate.
Every match requires explicit confirmation. Only the entered address, country and language are sent for geocoding, not customer identity/contact data.
The map/browser also communicates directly with Google; inform public users in the site's privacy policy and review applicable consent requirements.
Finder responses are excluded from JSON-body access logging; upstream URLs, keys, raw vendor errors and addresses are not logged by this module.
There is no stored geocoding-result cache. Concurrent identical requests share an in-flight lookup only.
Existing user/IP and application rate limits apply, with at most 20 distinct in-flight lookups per worker.
No automatic paid retries or silent provider fallback occurs.
Readiness flags distinguish map setup from geocoding setup. Missing keys, denied credentials, quota/billing problems and outages fail explicitly.
GPS search and ranking existing CRM coordinates still work if Google is unconfigured or unavailable.
Distances remain straight-line kilometres calculated in INDEXUS, not road distance or journey time.

### EEA presentation and retention
Under [EEA service terms, Geocoding §6](https://cloud.google.com/terms/maps-platform/eea/maps-service-terms),
only latitude, longitude and place_id from geocoding may be used with any map.
Google formatted-address candidates are therefore shown in a separate confirmation step without a map and with Google Maps attribution.
After confirmation they are discarded; the map caption contains the user's original input, never the Google formatted address.
CRM provider names/coordinates are INDEXUS data, not a Google Places directory.
Google results are not persisted to customer/provider addresses or shared caches.
Operators must review their current contract, public Terms of Use and Privacy Policy before launch.

### Enable the two APIs and create separate restricted keys
1. Open [Google Cloud Console](https://console.cloud.google.com/), select/create a project and attach a billing account.
2. Under **APIs & Services → Library**, enable **Maps JavaScript API** and **Geocoding API**.
   Do not enable Places, Routes, Distance Matrix or Address Validation for this implementation.
3. Under **APIs & Services → Credentials → Create credentials → API key**, create a browser key:
   - Application restrictions: **Websites / HTTP referrers**.
   - Allow only each real development and production origin, e.g. `https://YOUR-ACTUAL-HOST/*`. Do not use an unrestricted `*`.
   - API restrictions: **Restrict key → Maps JavaScript API** only.
   - Store as `GOOGLE_MAPS_BROWSER_API_KEY` in the running server's environment. This deliberately public key is returned to authorised finder clients;
     it must never be the server key.
4. Create a second, different server key:
   - Application restrictions: **IP addresses**; allow the actual public outbound IP of the server performing geocoding.
     For CORPCRM01 use its NAT/egress IP, not its internal LAN address, the browser's IP or an assumed inbound address.
   - API restrictions: **Restrict key → Geocoding API** only.
   - Store as `GOOGLE_MAPS_SERVER_API_KEY` in the server environment/secret manager. Never put it in React, a `VITE_` variable, source control, screenshots or chat.
   - If a development host has changing outbound IPs, use a separately controlled stable-egress development setup/key. Do not weaken the production key.
5. Restart the server after configuring environment values (for external PM2, refresh that process environment).
   This repository never copies Replit secrets to CORPCRM01 automatically. Different environments may use separate projects/keys.
   Same browser/server keys deliberately make both services unready.
6. In Google Cloud, configure supported request quotas/rate limits and billing budget alerts.
   Budget alerts notify; they do **not** stop charges. Quota enforcement can stop requests, so monitor the resulting service outages too.
7. Verify in both the customer-card modal and the enabled public-form modal: address confirmation, map/markers, GPS, selection and mobile reopening.
   If credentials are rejected, check API restrictions, enabled APIs, referrers, egress IP, billing and quota dashboards.

The map currently uses Google's `DEMO_MAP_ID` with Advanced Markers; a custom styled map ID is optional, not required for this setup.
See [API security](https://developers.google.com/maps/api-security-best-practices) and
[Maps JS setup](https://developers.google.com/maps/documentation/javascript/get-api-key).

### Costs and comparison
Compared with the public OSM/Photon combination, Google provides managed project quotas, billing/usage diagnostics,
broader language support, and a large maintained address/map database. Coverage and accuracy still vary by country/address;
no provider guarantees every address or uninterrupted availability. Maps and geocoding are separate billable services.
The current [global price list](https://developers.google.com/maps/billing-and-pricing/pricing) lists 10,000 free monthly events
for each of Dynamic Maps and Geocoding. The next tier is USD 7/1,000 map loads and USD 5/1,000 geocodes, respectively,
before applicable tax and local/account terms. Check the current price list and your account before enabling billing.
For example, 15,000 map loads plus 15,000 geocodes/month in those tiers costs USD 35 + USD 25 = USD 60,
not counting any other Google services. Reopening a map can create another map-load event.
INDEXUS distance calculations and ranking do not call Routes API and add no Google routing charge.

## Verification
```
npx tsx --test shared/provider-finder.test.ts server/lib/provider-finder-geocode.test.ts server/lib/provider-finder-routes.test.ts client/src/components/provider-finder/google-maps-loader.test.ts
npx tsx scripts/provider-finder-browser.test.ts
```
The database integration test creates only uniquely named synthetic fixtures and cleans them up.
API tests use synthetic keys and mocked Google responses; browser tests cover no-key/GPS flows and stubbed address confirmation.
They do not prove real Google credentials, billing, actual map tiles or real address accuracy. Those need the live verification above.
Startup creates the additive tables idempotently, including on the external production server. This feature does not change existing customer addresses or globally publish existing providers.
