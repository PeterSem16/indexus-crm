---
name: Initial RTP no-flow safety
description: Safety boundaries for audio-health recovery, ring timeout, and server-confirmed hangup events.
---

Initial no-flow or one-way RTP immediately after SIP establishment must never by itself trigger ICE restart/re-INVITE. It should report the media problem and preserve the deferred post-call readiness check. Automatic media renegotiation is allowed only after bidirectional RTP was previously validated or after a correlated network, SIP-registration, or ICE interruption.

**Why:** A newly answered call can legitimately have delayed RTP, and renegotiating solely from initial silence can destabilize the SIP dialog. Media-health monitoring must not be capable of causing the failure it is trying to diagnose.

**How to apply:** Keep initial advisory state separate from confirmed interruption and exhausted-recovery state. Permit one bounded recovery only when eligible, and escalate visibly if RTP remains unhealthy afterward.

Outbound calls use SIP late offer: the initial INVITE has no SDP, and the browser creates its WebRTC peer connection, ICE/TURN path, and SDP answer only after the destination answers. Never create the outbound media path at dial time or use ring-duration-triggered re-INVITE as a workaround.

**Why:** Production testing confirmed that calls answered before 10 seconds had audio while calls answered after 10 seconds consistently did not, even though the Mission allowed a longer ring duration. On 2026-09-09, the user confirmed that the deployed late-offer solution remained reliable in real production use and that long ringing no longer damaged audio.

**How to apply:** Mission max-ring remains only the unanswered-call cancellation deadline. Never shorten it to hide the media defect. Once the final response creates a confirmed dialog, neither automatic timeout nor agent hangup may send CANCEL while late-offer ICE/ACK is still being prepared; wait for establishment, then use a single BYE.

Server-originated hangup events must be matched to the exact active inbound call ID and SIP session/finalizer before any microphone cleanup, local finalization, or BYE. Ring-timeout CANCEL must recheck session identity and state after a short final-response grace.

**Why:** Delayed events from an older inbound call or a queued 200 OK at the ring deadline can otherwise terminate a newer or newly answered outbound call.

**How to apply:** Bind inbound metadata to the actual session object, clear it on reset/outbound start, and reject every uncorrelated event before side effects.