---
name: Notification PII on external channels
description: Automation/task notifications sent via email/SMS must not echo resolved task descriptions — they carry customer PII.
---

# Notification PII on external channels (email/SMS)

When an automation builds a task notification, the task *description* is template-resolved
and can contain customer PII ({{customer.name}}, {{customer.phone}}, {{customer.email}},
{{customer.id}}, clinic/hospital names). The task *title* is usually a static admin label
(e.g. `SL: <status-list item label>`) and is safe.

**Rule:** External channels (email, SMS) send the static title plus the contact's
*display name only* (Klient / Klinika / Nemocnica) so the recipient knows who the task is
about. Names in BOTH email and SMS were explicitly approved by the user (2026-06). Still
NEVER embed the full template-resolved description, phone, email, address, or rodné číslo in
an email/SMS body — those stay behind CRM auth. HTML-escape any name injected into an email
body. Never log recipient email/phone (log the user id instead). Also avoid logging raw
vendor error objects (MS365/BulkGate) — their `.config`/payload can echo the address; log
`e instanceof Error ? e.message : String(e)`. In-app push (authenticated, persisted) may
carry the title in metadata, matching legacy behavior.

**Why:** Email/SMS leave the CRM's auth boundary; the full detail already lives behind CRM
auth. A code review flagged the resolved description + recipient-address logging as a PII
leak. The user later judged a bare contact *name* acceptable in both channels (it greatly
improves triage) while the deeper PII fields stay app-only — so the line is "name yes,
contact details no", not "no names at all".

**How to apply:** Any new notification dispatch over email/SMS/webhook for tasks or
automations — keep payloads minimal, title-only, and redact recipient identifiers from logs.
