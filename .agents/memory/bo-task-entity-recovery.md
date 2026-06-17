---
name: Back Office task hospital/clinic recovery
description: BO status-list tasks never store their hospital/clinic; how to recover the linked entity for display.
---

# Back Office tasks don't store the hospital/clinic entity

Back Office tasks spawned from a Status List confirmation persist only
`customerId` (often NULL) and `relatedEntityType='status_list_item'` /
`relatedEntityId=<status list item id>`. The actual campaign contact — which may
be a hospital or clinic (not a customer) — is **never stored on the task**. So
`enrichBoTask` returning a hospital/clinic for a customer-less task is impossible
from the task row alone.

**Why:** the task-creation path had the contact's `contactType` +
`hospitalId/clinicId` available but only wrote `customerId` + the status-list item
as the related entity.

**How to recover (read-time, used by enrichBoTask):** correlate
`campaign_contact_status_list_state` on `status_list_item_id = task.relatedEntityId`
AND `confirmed_by_user_id = task.createdByUserId`, pick the row whose `confirmed_at`
is nearest the task's `created_at` (a LATERAL join ordered by
`ABS(EXTRACT(EPOCH FROM (s.confirmed_at - t.created_at)))`), then join
`campaign_contacts -> hospitals/clinics`. Do the time math **column-to-column
inside SQL** (join back to `tasks` by `t.id = <param>`) so there is no JS↔DB
timezone skew — parameterise only the task id. This is precise because each
confirmation creates its task in the same request, so the nearest confirmation by
the same user for the same item is the correct contact. Customer-type contacts
resolve with null hospital/clinic, so no wrong entity is attached.

A durable fix would persist the entity on the task at creation (e.g. an
`entity:hospital:<id>` / `entity:clinic:<id>` tag) and read that first.
