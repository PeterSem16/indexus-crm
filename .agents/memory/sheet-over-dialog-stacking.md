---
name: Sheet over Dialog stacking
description: How to open a shadcn Sheet (drawer) on top of an already-open shadcn Dialog without it rendering behind.
---

# Opening a shadcn Sheet over an open Dialog

By default the shadcn `Sheet` renders BEHIND a shadcn `Dialog`: Dialog overlay/content sit at `z-[9995]/z-[9996]`, Sheet overlay/content at `z-[9990]/z-[9991]`. A plain Sheet opened while a Dialog is open is hidden under the dialog.

**Rule:** to surface a Sheet above an open Dialog, give `SheetContent` an `elevated` mode that sets `className="z-[10020]"` (above the dialog), plus `hideOverlay` (the dialog already dims the page; a second low-z overlay just looks wrong) and `onCloseAutoFocus={(e) => e.preventDefault()}` (stops focus from jumping oddly back into the dialog on close). Always include a `SheetTitle` (can be `sr-only`) so Radix accessibility doesn't warn.

**Why:** both components are Radix Dialog primitives that portal to body and manage a dismissable-layer/focus-scope stack, so nesting works — but the hardcoded z-index values in `ui/sheet.tsx` vs `ui/dialog.tsx` mean the later-opened Sheet still paints under the Dialog unless you raise it explicitly.

**How to apply:** when a drawer must be reusable both standalone and on top of a modal, expose an `elevated` prop on the drawer wrapper that toggles those three things; standalone usage keeps the default overlay and focus behavior.
