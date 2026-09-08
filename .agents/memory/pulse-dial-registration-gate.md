---
name: Pulse dial registration gate
description: Why NEXUS Pulse call actions must never silently block on the React SIP registration flag.
---

NEXUS Pulse call buttons must always enter the central call-dispatch path. Do not condition their click handler or disabled state on the rendered `isSipRegistered` value. The SIP layer's current registration check and recovery routine is authoritative, and a failed attempt must produce visible feedback.

**Why:** The rendered registration flag can briefly lag behind the live transport during reconnects. UI gating caused a recurring failure where an apparently usable phone button did nothing, even though the SIP layer could have verified or restored registration.

**How to apply:** Route desktop header, quick action, inline entity-card, and mobile phone buttons through the same central handler. Let the SIP layer ensure registration immediately before dialing; never return silently for a stale UI registration value.