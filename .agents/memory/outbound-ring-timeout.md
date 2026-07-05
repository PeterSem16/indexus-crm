---
name: Outbound ring-timeout & per-call campaign values
description: How the outbound max-ring auto-hangup timer must be managed in sip-phone, and how per-call campaign settings reach it.
---

# Outbound ring-timeout timer (sip-phone.tsx)

An outbound "max ring duration" auto-hangup (cancel unanswered Inviter + play a
tone after N seconds) is driven by a `setTimeout` armed inside the **Inviter
`stateChange` `Establishing` case** (that is the "ringing" transition).

**Rule:** the timer MUST be cleared on every exit from ringing, or a stale timer
can fire against a later call:
- `Established` (answered), `Terminated` (any end), `cleanup()` (unmount),
  `endCall()`, `forceResetCall()`.
- On fire, guard with `sessionRef.current === inviter` AND state not
  Established/Terminated before calling `(inviter as Inviter).cancel?.()`. The
  listener closure captures the per-call `inviter`, so identity check is the
  safety net.
- A ref flag (e.g. `ringTimedOutRef`) is set on timeout and consumed+reset in the
  `Terminated` case to log the call as `no_answer` / `hungUpBy: "system"`
  (takes precedence over the duration>0 completed/failed check). Also reset it in
  the `forceIdle` early-return branch of `Terminated`.

**Why:** `cancel()` transitions the Inviter to Terminated, which re-runs the same
stateChange listener — so the timeout path and the normal end path share the
Terminated logic; the flag is how they diverge on logged status.

# Per-call campaign values reach sip-phone via PendingCall → refs

Per-call campaign data (callerId, and maxRingSeconds) is carried on the
`PendingCall` object (sip-context.tsx) and copied into refs in sip-phone's
pendingCall consumption effect. **Gotcha:** manual dialpad dials call the internal
`makeCall` directly and BYPASS that effect, so they inherit whatever the last
context-driven call left in the ref (same long-standing behavior as callerId).
Context-driven dials reset the ref (absent value → 0). If you add another per-call
campaign setting, follow the same PendingCall→ref path and remember the dialpad
inheritance edge.

Scheduled/queue-item dials use `item.campaignId` which may differ from the
selected mission — resolve that item's own campaign settings, don't reuse the
selected-campaign memo.
