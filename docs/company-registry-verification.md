# Country-aware company verification

Healthcare Network → Legal Entities supports SK (OR SR), CZ (ARES) and RO (ANAF).
Existing clinic and hospital verification panels choose the registry from the saved
facility country. Standalone verification offers only the operator's authorized countries.
Re-verification uses the saved entity country; identifiers cannot move an entity to another country.

## Sources and limits

- **SK / OR SR:** unchanged exact eight-digit IČO lookup, complete extracts,
  role information and document metadata.
- **CZ / ARES:** official public REST `GET https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}`.
  Exact eight-digit IČO, including leading zeros. Keeps the complete response,
  displays name, registered address, municipality, postal code, legal-form code,
  and available establishment/termination/source-update dates.
  This general ARES endpoint does not supply corporate persons or source documents.
  Its absence of those fields does not prove there are no officers or documents.
  ARES data is informational, not an officially certified extract.
  [Official developer information](https://ares.gov.cz/stranky/vyvojar-info).
- **RO / ANAF:** official public `POST https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva`.
  CUI is 2–10 digits without a leading zero; an optional `RO` prefix is normalized away.
  One exact CUI and the current Bucharest calendar date are sent.
  Stores the complete response, displays available legal name, registered seat
  (fiscal address fallback), legal form, registration date, VAT status and fiscal inactivity.
  **Fiscal inactivity is not legal dissolution.** Legal existence status remains unknown
  rather than guessed from tax flags. ANAF is not a full ONRC extract and supplies no corporate
  persons/documents. Query date is not treated as source synchronization time.
  [Official v9 documentation](https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/doc_WS_V9.txt).

No API keys or new dependencies are needed for these two public lookup services.
The live ANAF v9 success body can omit the `cod`/`message` shown in the documentation.
Require the actual structured `found`/`notFound` response and exact returned CUI;
reject any explicitly unsuccessful `cod`, conflicting identity or ambiguous result.

## Data and authorization boundaries

- Company identity is `(country, normalized identifier)`, never the identifier alone.
- Keep existing explicit preview → save → confirm operator flow.
- Never overwrite clinic/hospital name, address, city, postal code or identifier.
- Source snapshots remain private and immutable. Manual legal-entity edits stay independent.
- Every list, option lookup, detail, history, export, person/facility link and mutation
  enforces current account/module and assigned-country access on the server.
- Same-country Person/facility relationships only. Corporate Persons are never guessed
  from ARES/ANAF missing evidence. Existing SK role linking remains available.
- Before saving a preview, authorization is checked again, including revoked country access.
- Source-specific labels and limitations, unknown status and tax booleans are translated
  in all seven UI languages. Exports identify the actual source.
- Changes in Romanian VAT/fiscal-inactivity evidence appear in snapshot comparisons and
  pending-change overview counts, including true/false/unknown distinctions.

## Network and operational behavior

Fixed official URLs only; no caller-provided host or redirect. Requests have a 25-second
timeout and 4 MiB response cap. No automatic retries, scraping or silent fallback.
Errors distinguish not found, throttling, invalid ID, unsupported/mismatched country,
identity conflict and source unavailability. Raw responses are not sent to diagnostics.

The existing limit of six verification attempts per user/minute remains.
ANAF additionally shares a PostgreSQL session advisory-lock gate across workers using
the same database: one in-flight call, with at least 1.05 seconds between admitted starts.
Contention returns a retryable rate-limit error without contacting ANAF.
Independent installations sharing an outbound IP must coordinate their usage separately.

Startup migration replaces the original SK-only country/eight-digit constraints with
country-specific SK/CZ/RO checks, retaining all existing records and the country+ID unique key.
The existing production startup schema hook invokes it; no `db:push`, new secret or npm
installation is required. Nothing here deploys to CORPCRM01 automatically.

## Verification

```sh
npx tsx --test --test-concurrency=1 \
  server/lib/company-registry-client.test.ts \
  server/lib/company-registry-routes.test.ts \
  server/lib/healthcare-legal-entity.test.ts \
  shared/healthcare-legal-entity-diff.test.ts \
  shared/healthcare-legal-entity-comparison-document.test.ts \
  client/src/lib/healthcare-legal-entity-comparison.test.ts
npx tsx scripts/company-registry-browser.test.ts
```

Database/API tests use isolated synthetic fixtures and clean them up.
Authenticated browser checks exercise desktop/mobile previews, country selection,
save/reopen/export and a real hospital operator link while asserting unchanged
operational fields. Only the external lookup is stubbed in the browser suite;
preview ownership, persistence and application routes are real.
Live read-only smoke checks of both actual source loaders were also performed in development.
They do not guarantee permanent source availability or prove CORPCRM01 outbound connectivity.
