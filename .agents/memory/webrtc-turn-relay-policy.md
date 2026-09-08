---
name: WebRTC TURN relay policy
description: Why Pulse SIP media must use relay-only ICE whenever TURN is configured in the reverse-proxied Asterisk topology.
---

**Rule:** When at least one TURN server is configured, every SIP PeerConnection
path (central UserAgent, outbound Inviter, and inbound accept) must set
`iceTransportPolicy` to `relay`. Fall back to `all` only when TURN is absent.

**Why:** Asterisk sees the WebSocket proxy as a local peer and offers a private
ICE candidate. Chrome can briefly allocate TURN, then nominate an unusable direct
private path and release the relay with lifetime zero while Asterisk continues
sending RTP to that relay port. The result is a fully answered call with
bidirectional silence even though the carrier-to-Asterisk RTP leg is healthy.

**How to apply:** Keep the policy consistent across inbound and outbound call
creation. Diagnose a recurrence by correlating Asterisk RTP endpoints with Coturn
allocation lifetime and peer-usage counters; do not infer media health from SIP
ANSWERED or ICE connected alone.