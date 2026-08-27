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