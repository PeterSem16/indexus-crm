---
name: O2 IMS inbound trust
description: Provider-confirmed authentication model for inbound O2 IMS SIP traffic.
---

O2 inbound SIP traffic is authorized exclusively by provider source IP. Keep
the O2 endpoint restricted to IP identification and do not configure inbound
Digest authentication on that endpoint. Registration and outbound calls still
use the assigned SIP authentication object. Because that endpoint is restricted
to approved O2 source IPs, trust its inbound PAI/RPID identity when deriving the
real caller number; otherwise Asterisk can expose the pilot/trunk number from
the From header instead.

**Why:** O2 confirmed that its inbound INVITEs do not use Digest credentials.
Requiring endpoint `auth` would reject every legitimate inbound O2 call.

**How to apply:** For O2 IMS PJSIP changes, preserve `identify_by=ip`, maintain
the approved provider source allowlist, and use `outbound_auth` only for the
registration/outbound path. Enable inbound identity trust and prefer asserted
identity headers before the channel caller fallback.