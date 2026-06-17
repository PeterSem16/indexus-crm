---
name: BO nested full-card drawers
description: How to open a full entity detail/edit card (customer/clinic/hospital) on top of a Back Office task drawer without breaking z-index.
---

# Opening full entity cards on top of Back Office drawers

In the Back Office task drawers (NEXUS Pulse inbox + Nexus Back Office panel) the entity
links must open the SAME full card used on the native pages, NOT a bespoke mini-card.
Reuse the real components (customer details content, `ClinicFormSheet`, `HospitalEditDrawer`)
rather than rebuilding — a rebuilt mini-card is exactly the complaint that triggered this work.

## The z-index rule (the non-obvious part)
A nested full card must sit in the **open interval (host_z, own_popup_z)**:
- BO host sheets are at the repo default Sheet content z (≈9991). Their `elevated` (≈10020)
  prop exists but is never passed true, so treat hosts as ≈9991.
- The card's own Radix popups portal to body at Dialog≈9996 / Popover≈9999 / Select≈10000.
- So the card must be **above 9991** (or it renders behind the host, since the entity drawer
  is mounted as a sibling that comes earlier in the DOM) **and below 9996** (or its own
  dropdowns/dialogs render behind it and become unclickable).
- Use **z-[9994]**. Do NOT raise to ≥9996.

**Why:** equal-z loses to the host by DOM order; too-high hides the card's own popups.

## Portal gotcha for custom (non-Radix) drawers
Radix Sheets (customer card, `ClinicFormSheet`) already portal to body, so they escape any
transformed/positioned ancestor stacking context. A hand-rolled `fixed inset-0` drawer
(e.g. `HospitalEditDrawer`) does NOT — nested inside the BO tree it can be trapped by an
ancestor stacking context. When reusing such a drawer in BO, render it through
`createPortal(content, document.body)` and override its hardcoded low z (z-50/z-51) via an
optional className prop merged with `cn()` (tailwind-merge resolves the z conflict, last wins).

**How to apply:** add optional, default-off props (e.g. `portalToBody`, `panelClassName`,
`backdropClassName` / `sheetContentClassName`) so the component's own page behavior is
unchanged when the props are omitted; pass z-[9994] + portal only from the BO coordinator.
Coordinator pattern: fetch the full record first, show a lightweight z-[9994] loading Sheet,
then mount the real card; wire onClose/onSuccess to invalidate the list query and close.
