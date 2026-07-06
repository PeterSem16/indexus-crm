---
name: campaign-contacts enrichment leaks full entity rows
description: The /api/campaigns/:id/contacts response embeds full customer/hospital/clinic/collaborator rows, including sensitive columns
---

The campaign-contacts endpoint enriches each contact by attaching the FULL
`storage.getCustomer/getHospital/getClinic/getCollaborator` row (a `select *`),
so the browser receives every column — including `collaborator.mobilePasswordHash`
and the other `mobile*` login columns.

**Why it matters:** any client code that iterates the enriched entity objects by
key name (e.g. building a "search all fields" collector) will silently pull the
password hash into search results / autocomplete. It also means the hash is
already on the wire in the API response regardless.

**How to apply:**
- When surfacing enriched contact fields (search, display, export), enumerate the
  specific fields explicitly. NEVER scan keys by name pattern over these rows.
- The real fix is server-side: strip sensitive columns from the enriched entities
  before sending. Until that lands, treat the enriched objects as containing
  secrets.
- Searchable phone/email fields per entity: customer phone/mobile/mobile2/
  otherContact/email/email2; hospital phone/email; clinic phone/phone2/phone3/
  email/email2/email3; collaborator phone/mobile/mobile2/otherContact/email.
  `gynecologistPhone/gynecologistEmail` are a third party — do NOT search them.
