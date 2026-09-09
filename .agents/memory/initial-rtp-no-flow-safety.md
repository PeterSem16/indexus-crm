---
name: Initial RTP no-flow safety
description: Safety boundaries for audio-health recovery, ring timeout, and server-confirmed hangup events.
---

Initial no-flow or one-way RTP immediately after SIP establishment must never by itself trigger ICE restart/re-INVITE. It should report the media problem and preserve the deferred post-call readiness check. Automatic media renegotiation is allowed only after bidirectional RTP was previously validated or after a correlated network, SIP-registration, or ICE interruption.

**Why:** A newly answered call can legitimately have delayed RTP, and renegotiating solely from initial silence can destabilize the SIP dialog. Media-health monitoring must not be capable of causing the failure it is trying to diagnose.

**How to apply:** Keep initial advisory state separate from confirmed interruption and exhausted-recovery state. Permit one bounded recovery only when eligible, and escalate visibly if RTP remains unhealthy afterward.

Outbound calls have a separate answer-time exception for the reproducible long-ring boundary: after at least 10 seconds of ringing, sample post-answer RTP before acting. If bidirectional RTP is already flowing, leave the call untouched. If it is not flowing, or early-dialog ICE was observed failed/disconnected, perform one session-owned ICE re-INVITE, preserve mute, rebind remote audio, and restart monitoring with a fresh baseline and convergence grace.

**Why:** Production testing confirmed that calls answered before 10 seconds had audio while calls answered after 10 seconds consistently did not, even though the Mission allowed a longer ring duration.

**How to apply:** Mission max-ring remains only the unanswered-call cancellation deadline. Never shorten it to hide the media defect, and never force recovery solely from elapsed ring time without first checking post-answer bidirectional RTP.

Server-originated hangup events must be matched to the exact active inbound call ID and SIP session/finalizer before any microphone cleanup, local finalization, or BYE. Ring-timeout CANCEL must recheck session identity and state after a short final-response grace.

**Why:** Delayed events from an older inbound call or a queued 200 OK at the ring deadline can otherwise terminate a newer or newly answered outbound call.

**How to apply:** Bind inbound metadata to the actual session object, clear it on reset/outbound start, and reject every uncorrelated event before side effects.