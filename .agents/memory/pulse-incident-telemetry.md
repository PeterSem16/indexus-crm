---
name: Pulse incident telemetry
description: Integrity and privacy rules for NEXUS Pulse voice and network incident logs.
---

Voice/network telemetry must contain only bounded technical health events generated during an owned call. Offline or asynchronous delivery may complete for up to five minutes after that call ends.

**Why:** Unlinked or historical-call events can be fabricated or misattributed, while raw WebRTC/SIP diagnostics may expose phone numbers, addresses, credentials, network identifiers, or call content. Offline failures cannot be sent at the moment they happen.

**How to apply:** Server-stamp the user, verify call ownership, accept active-call events through only a short post-call grace window, allowlist event kinds/states/numeric ranges, and discard permanently rejected queued events. Never persist audio, transcripts, phone numbers, SDP, ICE candidates/IPs, SIP headers/credentials, or raw error text.