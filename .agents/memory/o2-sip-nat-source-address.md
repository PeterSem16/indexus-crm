---
name: O2 SIP NAT source address
description: How to distinguish the real provider-visible SIP source address from Asterisk Via and Contact headers.
---

For O2 SIP troubleshooting, the `received=` and `rport=` values in the provider response identify the real source address seen by O2. `Via` and `Contact` can show a different address when the gateway is behind NAT or has an incorrect external transport setting. A final `403 Forbidden` on `REGISTER` after the advertised and source addresses are aligned indicates provider-side authorization/provisioning or credential rejection, not basic reachability.

**Why:** O2 may whitelist the real packet source while Asterisk advertises another public address, creating an address mismatch that is easy to misdiagnose as an O2 routing problem.

**How to apply:** Compare `Via`/`Contact` with `received`/`rport`. Keep O2's whitelist aligned with the provider-visible source, and align the active UDP transport's external signaling/media address with that source when the advertised address is wrong. Validate registration with an actual `REGISTER`; `OPTIONS 200 OK` proves reachability only. If `REGISTER` ends in `403`, have O2 verify the exact SIP username format, password/account activation, registrar authorization, and source-IP policy; do not keep changing NAT settings blindly.

For this O2 trunk, the provider required the explicit auth realm `o2bssk` and a registrar URI without the `:5060` suffix. The corrected registration succeeded after the secret was stored without delimiter quotes.