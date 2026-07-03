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
numbers are hand-entered with spaces/dashes (e.g. `+49 2381 70551`) while Asterisk
logs them digits-only (`+49238170551`), so BOTH sides must be normalized to digits
(`regexp_replace(col,'[^0-9+]','','g')`) or clinic/hospital rows silently never match.

**How to apply:** batch one query per table (guard on non-empty variant list), use the
inbound virtual-agent's prefix variants (+421 / 421 / 0 forms) THEN strip to digits on
both sides; dedup candidates by `contactType:entityId` before the size===1 check.
