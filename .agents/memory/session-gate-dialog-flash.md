---
name: Session-gate dialog flash on refresh
description: Why a modal used as an auth/session gate must be gated on the async source's loading state, or it flashes on refresh and its dismiss side-effect fires spuriously.
---

A modal dialog whose `open` state defaults to `true` and acts as a gate
(e.g. "log into your shift" before using a page) must ALSO be gated on the
`isLoading` of whatever async query decides if the gate is needed.

**Why:** On a hard browser refresh / component remount, the deciding query
(e.g. `/api/agent-sessions/active`) is briefly in flight, so its derived
"already satisfied" flag (e.g. `isSessionActive`) is temporarily false while
the default-open state is true. The gate dialog then FLASHES for users who
actually pass the gate. If the dialog's dismiss handler (escape/overlay) has a
side-effect like `setLocation("/")`, an accidental dismiss during that flash
bounces the user off the page — the exact "refresh sends me to the dashboard
instead of staying here" symptom.

**How to apply:** `open={wantOpen && !alreadySatisfied && !query.isLoading}`.
Radix `Dialog` does NOT call `onOpenChange` when `open` transitions true->false
via the prop, so once the query resolves to "satisfied" the dialog closes
silently with no navigation. Only genuinely-unsatisfied users see the gate
after loading finishes, preserving the intended cancel behavior.
