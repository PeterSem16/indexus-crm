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

For Mission calls, the browser-provided max-ring value is only provisional.
The call-log creation endpoint must snapshot `maxRingSeconds` from the persisted
Mission settings, and the SIP caller must replace its ref with that trusted value
before constructing the Inviter.

**Why:** the browser's campaign list can be stale or incomplete even though the
selected Mission id and contact are valid; treating that cache as authoritative
silently turns a configured ring limit into zero.

**How to apply:** snapshot critical call policy server-side alongside recording
policy, return it in call-log metadata, and consume it synchronously before INVITE.

Scheduled/queue-item dials use `item.campaignId` which may differ from the
selected mission — resolve that item's own campaign settings, don't reuse the
selected-campaign memo.

# Negative INVITE response ordering and pending dials

**Rule:** An external dial request received while a call is connecting, ringing,
active, on hold, or ended must be rejected rather than retained for automatic
execution. Only an idle phone may consume a pending dial request.

**Why:** A request retained during ringing can execute immediately after the
first call reaches `ended`, which silently dials a different number after a
max-ring timeout.

**How to apply:** Treat pending dial requests as one-shot idle-state commands,
not a general queue.

**Rule:** An explicit user dial during `ended` + active ACW is the sole exception:
persist the previous call's ACW first, reset that terminated call to `idle`, and
only then enqueue the exact number the user clicked. Do not clear the current
contact/task, and do not schedule an automatic next contact.

**Why:** ACW is not a live SIP call, so blocking the click as "Active call" is
incorrect; retaining the request in the generic pending-call mechanism would
reintroduce automatic dialing after timeout.

**How to apply:** Keep this transition in the explicit UI dial path. Live states
(`connecting`, `ringing`, `active`, `on_hold`) must still reject the request, and
the SIP pending-call consumer must remain idle-only. A React state setter does
not synchronously commit `idle`; wait one render/macrotask before enqueueing the
new pending call, or the SIP consumer can still see `ended` and reject it as an
active call.

**Rule:** Persist an unanswered outbound result only once, after allowing the
negative INVITE response callback to run.

**Why:** SIP.js can emit `Terminated` before `requestDelegate.onReject`. A
provisional `failed` write followed by a `busy` correction is unsafe because
independent network mutations can finish out of order and restore `failed`.

**How to apply:** Bind the deferred classification to the exact session/call
generation, then make one final write. Max-ring timeout and explicit local
cancel remain authoritative and need no response wait.
