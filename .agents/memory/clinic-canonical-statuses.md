---
name: Clinic canonical cooperation statuses
description: Infrastructure for recording canonical clinic cooperation states from status-list confirmations (KPI 3.4–3.7).
---

# Clinic Canonical Cooperation Statuses

## What was built
- New DB table `clinic_cooperation_statuses` — one row per canonical state event (clinic, statusKey, phase, who, when, from which campaignContact + statusListItem).
- New column `canonical_clinic_status_key TEXT` on `campaign_status_list_items` — manager sets it in Mission builder; maps a status-list option to a canonical key.
- Auto-write on status-list confirmation: when a confirmed item has `canonicalClinicStatusKey` AND `ccRow.contactType === "clinic"`, a row is inserted into `clinic_cooperation_statuses`.
- GET `/api/clinics/:id/cooperation-statuses` → `{ history: [...], current: { [statusKey]: latestRow } }`.
- Clinic card "Spolupráca" tab shows current summary (3 phase cards) + full history grouped by phase.
- Builder: canonical key selector (grouped by phase) on step items, AddItemForm, and AddOptionForm.

## Canonical key enum (by phase)
**acquisition:** acquisition_contacted | acquisition_interested | acquisition_not_interested | acquisition_in_negotiation  
**contract:** contract_sent | contract_signed | contract_rejected | flyers_sent | flyers_accepted | flyers_rejected  
**retention:** retention_active | retention_paused | retention_terminated | services_confirmed | services_declined

**Why:** Phase prefix drives `phase` column in DB; derive phase server-side with `key.startsWith("acquisition_")`, `key.startsWith("contract_") || key.startsWith("flyers_")`, else `"retention"`.

## How to apply
- Adding a new canonical key: add to `CANONICAL_CLINIC_STATUS_GROUPS` in `campaign-status-list-builder.tsx`, update the phase-derivation logic in `server/routes.ts` (confirmation handler), and update the `COOP_PHASES` array in `clinic-form-wizard.tsx`.
- The auto-write is **best-effort** — wrapped in try/catch, never blocks the confirmation response.
- Only fires for `contactType === "clinic"` contacts; hospital/customer/collaborator contacts are silently skipped.
