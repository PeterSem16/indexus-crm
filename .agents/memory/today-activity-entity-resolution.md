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
