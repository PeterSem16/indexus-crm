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

Auth hydration is a separate source of a dashboard bounce: routing must not
observe a finished auth query together with an unsynchronized empty user.

**Why:** A full-page Pulse preview navigation exposed a one-render gap between
the successful query and its user-copy effect. Routing sent the valid session
through login to its role landing page before the workspace even mounted.
Changing the shift dialog would not fix this case.

**How to apply:** Trace navigation before changing dismiss handlers. Verify
hard navigation and refresh using the real App and AuthProvider with mocked
API responses; a fixture that stubs useAuth cannot catch hydration races.
