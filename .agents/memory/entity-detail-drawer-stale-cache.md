---
name: EntityDetailDrawer stale detail cache
description: Reopened Back Office clinic/hospital edit cards show stale field values because the entity-detail query key is never invalidated on save.
---

The Back Office / Nexus Pulse `EntityDetailDrawer` opens the REAL clinic/hospital edit
forms (`ClinicFormSheet`, `HospitalEditDrawer`) populated from a dedicated query key
`["/api/entity-detail", type, id]` (it fetches `/api/clinics/:id` or `/api/hospitals/:id`).

The forms' save `onSuccess` invalidate the LIST keys (`["/api/clinics"]`,
`["/api/hospitals"]`) but NOT that per-record `entity-detail` key. Because the global
queryClient uses `staleTime: Infinity` + `refetchOnWindowFocus: false`, reopening the
SAME entity card in the same session serves the stale cached record.

**Symptom trap:** a saved edit "doesn't update" only for fields that are ONLY visible
inside the reopened form (e.g. clinic `email2`/`email3`) — while the primary field
(`email1`, name) looks fine because the card SUMMARY is backed by an invalidated list
query. This reads as a field-specific save bug but is actually a display/cache bug; the
DB persisted fine (plain `db.update(clinics).set(data)` on existing columns can't
silently drop a value — a real failure throws a `saveFailed` toast).

**Why:** invalidating only list keys leaves the drawer's data source stale under
`staleTime: Infinity`.

**How to apply:** whenever a drawer/sheet populates a form from a per-record query key,
its save `onSuccess` must invalidate THAT key too, not just the list. Fixed by adding
`invalidateQueries({ queryKey: ["/api/entity-detail", entity.type, entity.id] })` in the
clinic + hospital `onSuccess` handlers in `entity-detail-drawer.tsx`.

**Entity email columns (DB reality, don't assume symmetry):** only `clinics` has
`email`, `email2`, `email3`. `hospitals` and `collaborators` have ONLY `email` (their
forms don't expose email2/email3). `customers` has `email`, `email_2` (email2) but NO
email3. So email2/email3 editing is really a clinic-only flow.
