---
name: Sheet over Dialog stacking
description: How to open a shadcn Sheet (drawer) on top of an already-open shadcn Dialog without it rendering behind.
---

# Opening a shadcn Sheet over an open Dialog

By default the shadcn `Sheet` renders BEHIND a shadcn `Dialog`: Dialog overlay/content sit at `z-[9995]/z-[9996]`, Sheet overlay/content at `z-[9990]/z-[9991]`. A plain Sheet opened while a Dialog is open is hidden under the dialog.

**Rule:** to surface a Sheet above an open Dialog, give `SheetContent` an `elevated` mode that sets `className="z-[10020]"` (above the dialog), plus `hideOverlay` (the dialog already dims the page; a second low-z overlay just looks wrong) and `onCloseAutoFocus={(e) => e.preventDefault()}` (stops focus from jumping oddly back into the dialog on close). Always include a `SheetTitle` (can be `sr-only`) so Radix accessibility doesn't warn.

**Why:** both components are Radix Dialog primitives that portal to body and manage a dismissable-layer/focus-scope stack, so nesting works — but the hardcoded z-index values in `ui/sheet.tsx` vs `ui/dialog.tsx` mean the later-opened Sheet still paints under the Dialog unless you raise it explicitly.

**How to apply:** when a drawer must be reusable both standalone and on top of a modal, expose an `elevated` prop on the drawer wrapper that toggles those three things; standalone usage keeps the default overlay and focus behavior.

## App z-index ladder (Sheets)

Concrete ladder in this app, lowest to highest: default Sheet overlay `z-[9990]` / content `z-[9991]`; the elevated Back Office task drawer content `z-[10020]`; a nested entity-detail Sheet opened FROM a Back Office drawer must sit at `z-[10030]` to paint above both the normal and elevated BO drawers.

**Why:** a nested Sheet inherits the same `z-[9991]` content as its parent, so it can tie or lose against an elevated parent; raising the child to `z-[10030]` guarantees it stacks on top regardless of whether the BO drawer was opened elevated.

**How to apply:** any new Sheet/drawer opened from inside another Back Office drawer should be given `z-[10030]` (or higher) explicitly. Stacked Radix Sheets handle focus/dismiss correctly on their own — clicking the child does NOT dismiss the parent — so the only thing you must hand-tune is the z-index.

## Inverse case: hosting a component that opens its OWN dialogs/selects

When the Sheet hosts a reused component that itself opens portalled popups (e.g. the full customer card `CustomerDetailsContent`, which uses many `Select`/`Dialog`/`Popover`), the host Sheet must sit BELOW those child portals, not above. Concrete child z in this app: Dialog `9996`, AlertDialog `9998`, Popover `9999`, Select `10000`. So a customer-card host Sheet is set to `z-[9994]`: above the parent BO drawer (`9991`) yet below `9995`, so every dropdown/dialog inside the card stays clickable on top.

**Why:** raising such a host to `z-[10030]` (the rule above) would bury its own Selects/Dialogs behind it, making the card unusable. The "raise to 10030" rule is only for leaf drawers with NO nested portal UI (e.g. the hospital/clinic reference card).

**How to apply:** before picking a z for a drawer, check whether its content opens Select/Dialog/Popover. If yes, keep the host in the narrow band `9992–9994` (above BO drawers `9991`, below child portals `9995+`). Tooltips (`z-50`) won't paint above such a host — acceptable, the real customers-page viewer (overlay `z-51`) has the same limitation. The BO drawers' `elevated` `z-[10020]` mode is currently unused; if it ever turns on it would cover a `9994` host and this band would need rethinking.
