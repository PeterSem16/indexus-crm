---
name: today-activity call-row entity resolution
description: Why "Open card" on My Shift call rows must resolve entityId+type+name from ONE record
---

A call/activity row can carry BOTH a direct `customer_id` AND a `campaignContactId`
whose contact points at a DIFFERENT entity type (clinic / hospital / collaborator /
customer). campaignContacts' contact id is polymorphic.

**Rule:** any code that builds an "open card" target (entityId + contactType + name)
for such a row must derive all three from ONE consistent record, never mix them.

**Why:** GET /api/agent/today-activity once set entityId = the call's customer_id
while taking contactType from the campaign contact (e.g. 'clinic'). "Open card"
then fetched /api/clinics/{customerId} → silent 404, and the resolved name was the
wrong/blank entity. Symptom on "My Shift": Open card is a dead click and rows show
only a phone number.

**How to apply:** prefer the campaignContact entity (match on contactType with
id-presence fallbacks), else fall back to the call's direct customer_id. Collect
customer ids for name lookup regardless of contactType so mismatched rows still get
a name. Frontend open handlers should always toast on failure so a wrong-endpoint
404 is never a silent dead button.

## Phone-number fallback (manual / failed calls)

Manual and failed calls are frequently logged with ONLY a phone number and NO linked
contact (both `customer_id` and `campaign_contact_id` null). Those rows show just the
number and "Open card" has no target.

**Rule:** when a call row has no resolved entity, resolve it by phone number across
ALL four contact tables (customers phone/mobile/mobile_2, clinics phone/phone2/phone3,
hospitals phone, collaborators phone/mobile/mobile_2), and assign entityId+contactType
+name ONLY when exactly ONE contact across all tables owns the number.

**Why:** (1) numbers are shared — the same number can belong to several test/real
records, and picking one at random opens the wrong card. The single-match guard makes
an ambiguous number fall back to just the bare number, never a wrong card. (2) DB
numbers are hand-entered with spaces/dashes (e.g. `+CC AAA BBBBB`) while Asterisk
logs them digits-only (`+CCAAABBBBB`), so BOTH sides must be normalized to digits
(`regexp_replace(col,'[^0-9+]','','g')`) or clinic/hospital rows silently never match.

**How to apply:** batch one query per table (guard on non-empty variant list), use the
inbound virtual-agent's prefix variants (+421 / 421 / 0 forms) THEN strip to digits on
both sides; dedup candidates by `contactType:entityId` before the size===1 check.

## Never return an entityId for a row that no longer exists

**Rule:** `resolveEntity` must only set `entityId` when that id is a KEY in the matching
name map (`Object.prototype.hasOwnProperty.call(map, id)`), not merely when the source
column is non-null. Those name maps are built by querying each table by id, so a present
key == the row exists. Gate every branch (incl. the direct `customer_id` fallback).

**Why:** a call linked to a DELETED entity (e.g. an old customer_id) otherwise returns
`entityId` set but `entityName` null. The frontend shows "Open card" (checks only
entityId) with no name, and clicking fetches `/api/customers/:id` → 404 → "failed to
open card". User-visible broken button. Gating on existence makes stale links return
entityId=null, which (a) hides the broken button and shows an "unknown contact" state,
and (b) lets the phone-number fallback recover the real contact by number
(`needPhone` filters on `!r.entityId`, so nulled stale links flow into it).

**How to apply (frontend):** show "Open card" only when `entityId` is present (existence
now guaranteed); show the clickable name only when `entityId && customerName`; otherwise
render `displayName || myShiftNoContact`. Keep the two conditions in lockstep so a button
without a working target can never render.

## call_logs.customer_id is POLYMORPHIC — resolve it against all 4 entity tables

**Rule:** the direct `call_logs.customer_id` does NOT always hold a customer id. When an
agent dials from a clinic / hospital / collaborator card, the SIP phone flow writes THAT
entity's id into `customer_id` and leaves `campaign_contact_id` null (PendingCall /
createCallLog only carry `customerId`, never `campaignContactId`). So resolveEntity's
direct fallback must look the id up in customers → clinics → hospitals → collaborators (by
id) and set the matching contactType, not just the customers table.

**Why:** resolving the direct id only against customers made every clinic/hospital/
collaborator call show "unknown contact" with no working "Open card" — the exact
user-reported bug (a failed outbound call to a clinic number). Phone-number fallback is a
weaker safety net (misses non-matching/duplicate/oddly-formatted numbers); id resolution
is deterministic because the correct id is already stored.

**How to apply:** collect `directCustomerIds`, and for those NOT found as customers query
clinics/hospitals/collaborators by id (one Promise.all) and merge into the same name maps
used by CC resolution. ids are UUIDs so cross-table collisions don't happen; gate every
branch with the same `has()` existence check.
