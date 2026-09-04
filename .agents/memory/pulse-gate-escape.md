---
name: Pulse gate escape
description: Product rule for mandatory NEXUS Pulse readiness checks.
---

The NEXUS Pulse readiness check may block Agent Workspace before work starts, but it must never trap the user or interrupt a live call, post-call wrap-up, or recorded-call playback; always provide a clear route back to normal INDEXUS.

**Why:** Unmounting Agent Workspace when readiness becomes invalid also unmounts the SIP phone and sends BYE, cancelling a healthy live call. Programmatic recording audio may likewise continue after its controls unmount, leaving an unstoppable orphaned playback. A failed check without an exit can also leave agents stuck.

**How to apply:** During connecting/ringing/active/hold, post-call work, and recording playback, defer invalidation, keep Agent Workspace mounted, and show only a deduplicated notification. Every programmatic audio player must release protection and stop/detach audio on pause, end, error, failed play, and unmount. Run the required check only after protected work finishes.