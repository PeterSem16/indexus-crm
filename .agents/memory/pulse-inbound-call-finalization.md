---
name: Pulse inbound call finalization
description: Reliability rule for ending inbound calls and preserving their history and recording
---

Every inbound or outbound termination signal must reach one idempotent, session-bound finalization path: agent End, SIP Terminated, peer/ICE failure, remote track end, and server-reported caller hangup.

**Why:** BYE may not yield a Terminated event, and old listeners or delayed resets can otherwise mutate a newer call. SIP.js can also emit Terminated synchronously during force reset.

**How to apply:** Bind every fallback, recording start, and delayed reset to the captured session. Invalidate session ownership before force-reset BYE/CANCEL. Finalize state/history/recording exactly once, then re-check registration only if no newer call started.