---
name: O2 Mission Caller ID trust
description: Security boundary for Mission-selected O2 outbound Caller ID.
---

For O2 outbound calls, accept the presented Caller ID only from a short-lived, one-time server authorization bound to the authenticated SIP extension. Never trust a SIP header supplied by the browser for the public O2 CLI. O2 requires the selected CLI in the SIP `From` user, not only in P-Asserted-Identity or Remote-Party-ID.

**Why:** An entitled SIP endpoint can forge arbitrary headers. Mission validation in an HTTP request is not useful if the dialplan later prefers the untrusted header. O2 Voice Support confirmed that a fixed trunk `From` causes the pilot number to be presented even when PAI/RPID contain the Mission number.

**How to apply:** Resolve the stable Mission Caller ID identifier server-side, store the resulting number with a brief expiry, consume/delete it in the dialplan, and reject O2 routing when it is missing or expired. Set `CALLERID(num)` before dialing and do not configure a fixed endpoint `from_user`; keep the trunk username only in registration/auth so Digest authentication stays independent. Server-originated queue forwards may use inherited server-controlled channel variables.