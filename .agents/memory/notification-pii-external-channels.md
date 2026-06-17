---
name: Notification PII on external channels
description: Automation/task notifications sent via email/SMS must not echo resolved task descriptions — they carry customer PII.
---

# Notification PII on external channels (email/SMS)

When an automation builds a task notification, the task *description* is template-resolved
and can contain customer PII ({{customer.name}}, {{customer.phone}}, {{customer.email}},
{{customer.id}}, clinic/hospital names). The task *title* is usually a static admin label
(e.g. `SL: <status-list item label>`) and is safe.

**Rule:** External channels (email, SMS) must send only the static title + a generic
"details in the app" line. Never embed the resolved description in an email/SMS body, and
never log recipient email/phone (log the user id instead). Also avoid logging raw vendor
error objects (MS365/BulkGate) — their `.config`/payload can echo the address; log
`e instanceof Error ? e.message : String(e)`. In-app push (authenticated, persisted) may
carry the title in metadata, matching legacy behavior.

**Why:** Email/SMS leave the CRM's auth boundary; the full detail already lives behind CRM
auth. A code review flagged the resolved description + recipient-address logging as a PII leak.

**How to apply:** Any new notification dispatch over email/SMS/webhook for tasks or
automations — keep payloads minimal, title-only, and redact recipient identifiers from logs.
