# Universal provider finder

## Entry points
- Existing customer: **Find a suitable provider** in the detail view or edit card.
- Configurator → Billing company → **Provider recommendations** → country.
- Existing public `/f/:slug` form, when explicitly linked in that country configuration.

Internal and public channels are independent and off by default. Configure and save the policy before editing site profiles.
Services are country/company-specific labels; assign them to each site. Public sites, public contacts and public Persons all require explicit publication.
Persons use current active workplace assignments, never private addresses.

Eligibility precedes ranking: active, enabled, not paused, known valid coordinates, requested service/type/Person and allowed straight-line radius.
Optional contract priority comes before distance. Optional recent cooperation activity breaks equal-distance ties; it is not a claim about availability or a quality score.
Clinic agreements/statuses are not automatically attributed to a billing company: explicitly confirm their applicability, or record a verified signed contract reference for the company with optional validity dates.
The customer selection is stored separately; an alternate search address does not update the customer.
Public selections are revalidated on submission and stored with the order submission, not silently applied to an existing customer.

## Google Maps readiness
Runtime requires separate `GOOGLE_MAPS_SERVER_API_KEY` (Geocoding API; server-only) and `GOOGLE_MAPS_BROWSER_API_KEY` (Maps JavaScript API; HTTP referrer and API restrictions).
Configure them through Secrets, not source code. A documentation-only Google Maps MCP connection does not provide runtime access.
Restrict the server key to its API and fixed server egress where applicable. Restrict the browser key to the actual approved development/published hosts. Never reuse the server key in a browser.
Google billing, key permissions, quotas and host restrictions must be verified before enabling live public traffic.

Without the keys, the application explicitly reports map/address lookup unavailability; it never invents locations or distances. A user-granted device location can still be used to search existing CRM coordinates.
Geocoding is explicit, country-restricted, rate-limited and requires the user to confirm the result. No customer identity is sent to Google.
Google-returned formatted addresses are used only in the confirmation step, not stored or displayed alongside the map; the map caption uses the user's input.
Finder responses are excluded from JSON-body access logging.

## Verification
```
npx tsx --test shared/provider-finder.test.ts server/lib/provider-finder-routes.test.ts
```
The database integration test creates only uniquely named synthetic fixtures and cleans them up.
Startup creates the additive tables idempotently, including on the external production server. This feature does not change existing customer addresses or globally publish existing providers.
