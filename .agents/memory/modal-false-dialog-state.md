---
name: modal=false dialog state persistence
description: Why a shadcn Dialog with modal={false} keeps stale internal filter/search state across reopens, and how to avoid a misleading empty state.
---

A shadcn `Dialog` rendered with `modal={false}` stays mounted in the tree even
while closed, so any internal React state (filter selections, search text, sort)
**persists across open/close cycles**. A filter the user picked once (e.g. a TYPE
filter set to "email") silently survives the next time they open the dialog.

**The trap:** header/counter UI is often computed from the *unfiltered* query
result, while the list body is computed from the *filtered* result. So the
counters can correctly show "6 total" while the list shows nothing — and a generic
empty state ("No scheduled items") makes it look like the data is gone. Users
report "I have N items but the queue is empty!!".

**How to apply:**
- For a `modal={false}` (or otherwise always-mounted) dialog/panel, reset its
  filter/search/sort state on the `open` transition: `useEffect(() => { if (open) {
  setFilterX("all"); ... } }, [open])`. This only fires on open, so it never fights
  mid-session interaction.
- Make the empty state distinguish "truly empty" (`items.length === 0`) from
  "filtered to nothing" (`items.length > 0 && filtered.length === 0`); in the
  latter, show a recoverable message + a "Show all"/clear-filters button.
