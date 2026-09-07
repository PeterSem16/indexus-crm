---
name: Pulse inbound call finalization
description: Reliability rule for ending inbound calls and preserving their history and recording
---

Every inbound-call termination signal must reach one idempotent finalization path: agent End, SIP Terminated, peer/ICE failure, remote track end, and server-reported caller hangup.

**Why:** A fallback detector marked termination handled before invoking the finalizer, so the UI remained active and both call-history completion and recording finalization were skipped. BYE alone is insufficient because its termination event can be lost.

**How to apply:** Bind fallback callbacks to the captured SIP session so delayed errors cannot affect a later call. Update call state/history and stop or finalize recording exactly once, after termination or a short guarded BYE timeout.