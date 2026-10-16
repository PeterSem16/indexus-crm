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
