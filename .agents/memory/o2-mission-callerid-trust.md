---
name: O2 Mission Caller ID trust
description: Security boundary for Mission-selected O2 outbound Caller ID.
---

For O2 outbound calls, accept the presented Caller ID only from a short-lived, one-time server authorization bound to the authenticated SIP extension. Never trust a SIP header supplied by the browser for the public O2 CLI.

**Why:** An entitled SIP endpoint can forge arbitrary headers. Mission validation in an HTTP request is not useful if the dialplan later prefers the untrusted header.

**How to apply:** Resolve the stable Mission Caller ID identifier server-side, store the resulting number with a brief expiry, consume/delete it in the dialplan, and reject O2 routing when it is missing or expired. Server-originated queue forwards may use inherited server-controlled channel variables.