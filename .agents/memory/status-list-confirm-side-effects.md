---
name: Status-list confirm — state row inserted before side effects
description: Why a status-list step can show "confirmed" yet create no task; ordering + undefined-var trap in routes.ts
---

The status-list confirmation handler (POST .../status-list-state/:itemId) inserts the
`campaign_contact_status_list_state` row FIRST, then runs automations (assign_task,
description-variable resolution, field snapshots). If anything in that side-effect block
throws, the step is already persisted as "confirmed" but no task is created — the user sees
a checked step with nothing in Nexus Puls → Back Office.

**Why this is easy to ship broken:** `tsc --noEmit` OOMs on the giant `server/routes.ts`,
and the dev/prod server runs via tsx/esbuild which strips types without checking them. So a
reference to an *undeclared* variable (e.g. `contactId` that was never derived in this
handler's scope — other `contactId` declarations live in other handlers' block scopes)
compiles and runs fine until that line executes, then throws `ReferenceError` at runtime.

**How to apply:**
- When editing this handler, ensure `contactId` (the underlying entity id) is derived from
  the `campaign_contacts` row BEFORE any use. Resolve by `contactType`:
  clinic→clinicId, hospital→hospitalId, collaborator→collaboratorId, else customerId
  (fall back to customerId). FMO contacts are `contactType='clinic'` with NULL customer_id,
  so a customer-only derivation yields null and clinic/customer description vars stay blank.
- A "confirmed but no task" symptom = re-confirm is blocked by the existing state row
  (the `existing.length === 0` guard skips automations on re-confirm). To re-test, delete the
  stale state row (or un-confirm, which deletes it) so the next confirm re-runs automations.
- Don't trust a build/restart to catch undefined vars in routes.ts — verify the runtime path.
