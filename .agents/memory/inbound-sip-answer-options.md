---
name: Inbound SIP answer options
description: Keep all inbound answer surfaces on the same WebRTC media negotiation path.
---

Every UI that accepts an inbound SIP invitation must use the shared answer
operation rather than calling the invitation's accept method directly.

**Why:** The shared path applies the project's TURN servers, ICE candidate
filtering, ICE timeout, and DTLS role modifier. A queue popup once bypassed
those options, producing a successful SIP answer/ARI bridge with no usable
audio and an immediately terminated session.

**How to apply:** New inbound-call buttons may control whether the accepted
session is republished to another component, but must not reconstruct a reduced
accept-options object locally.

The browser workspace must also never pre-mark a queue record as answered
before the agent SIP channel reaches the ARI bridge path. Contact lookup and a
multiple-card chooser are post-answer CRM work only.

**Why:** Pre-marking the record makes the bridge's guarded
`queued/ringing → answered` transition lose, so it tears down the new bridge;
the caller remains in the queue and the inbound popup can repeat.

**How to apply:** Let the agent-channel bridge own the queue transition. Claim
the inbound `callId` on browser acceptance to suppress ordinary WebSocket
replays, but release that claim on SIP failure, a terminated invitation, or an
explicit server requeue signal so a recovered queue call can be offered again.