---
name: Pulse incident telemetry
description: Integrity and privacy rules for NEXUS Pulse voice and network incident logs.
---

Voice/network telemetry must contain only bounded technical health events associated server-side with an owned, currently active call. Offline incidents may be queued locally and retried after connectivity returns.

**Why:** Unlinked or historical-call events can be fabricated or misattributed, while raw WebRTC/SIP diagnostics may expose phone numbers, addresses, credentials, network identifiers, or call content. Offline failures cannot be sent at the moment they happen.

**How to apply:** Server-stamp the user, verify the call is active and owned, allowlist event kinds/states/numeric ranges, and discard permanently rejected queued events. Never persist audio, transcripts, phone numbers, SDP, ICE candidates/IPs, SIP headers/credentials, or raw error text.