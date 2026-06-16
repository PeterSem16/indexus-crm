---
name: Back-office task creation from status-list automations
description: Two non-obvious traps in the status-list-state confirm handler that silently corrupt auto-created back-office tasks.
---

# Status-list automation → back-office task creation

When a campaign status-list item is confirmed, the handler auto-creates back-office
tasks (group / role / fallback inserts). Two traps bit this path:

## 1. The campaign-contact "contact id" is polymorphic — it is NOT always a customer id
`campaignContacts` rows carry a `contactType`. The resolved entity id is:
clinic → `clinicId`, hospital → `hospitalId`, collaborator → `collaboratorId`,
otherwise `customerId` (each with a `customerId` fallback).

**Rule:** `tasks.customerId` must be set from `ccRow.customerId` specifically, never
from the polymorphic `contactId`. Writing a clinic/hospital/collaborator UUID into
the customer column creates an invalid reference: the customer deep-link
(`/customers?view=<id>`) and every `WHERE id = <id>` / `potential_cases.customer_id`
lookup silently fail or point at the wrong row.

**Why:** auto-created tasks stored the wrong id, breaking the customer card link and
clinic/hospital enrichment. Use `ccRow?.customerId ?? null`.

## 2. drizzle + node-postgres `db.execute()` returns `{ rows }`, not an iterable
`const [x] = await db.execute(sql\`...\`)` throws "... is not iterable". Read
`const r = await db.execute(...); const x = r?.rows?.[0]` instead.

**Why it hides:** the throw was inside a `try/catch` that swallowed it, so template
variable substitution (`{{customer.name}}` etc.) silently failed and the RAW
`{{...}}` placeholders were saved into the task description.

**How to apply:** any `db.execute()` (raw SQL) result is `.rows`; only `db.select()`
query-builder results are arrays. Never array-destructure `db.execute()`.

## Display enrichment
Read endpoints resolve a human-readable "reason" from
`campaignStatusListItems.label` (keyed by `task.relatedEntityId` when
`relatedEntityType === 'status_list_item'`) instead of showing the raw type+UUID,
and pull clinic/hospital from the customer's latest `potential_cases`. Enrichment
must run AFTER the existing task authorization, keyed off the already-authorized
task — it must never widen data access. Tasks created before this fix have a null
`customerId` and cannot be backfilled without a separate migration.
