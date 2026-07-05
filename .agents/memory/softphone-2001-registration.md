---
name: "invalid URI 2001" = no registered contact; /wss-asterisk proxy is OFF-LIMITS
description: What the "invalid URI 2001" ARI error actually means, and why the WS-proxy close-propagation theory was reverted and must not be re-tried.
---

# Symptom
An ARI originate to a logged-in agent dies; Asterisk (mediagtw) logs:
`res_pjsip.c: Endpoint '2001': Could not create dialog to invalid URI '2001'. Is endpoint registered and reachable?`
The ARI POST returns HTTP 500. `pjsip show contacts` may still show `2001/... Avail`.

# What "invalid URI 2001" actually means
Asterisk reports the ENDPOINT NAME as an "invalid URI" when the AOR has NO usable contact to dial —
i.e. the softphone is not (currently) registered/reachable. It is NOT a bad dial string: the ARI
POST sends a clean `endpoint=PJSIP/2001` and endpoint config is correct.

# ⛔ Do NOT touch the /wss-asterisk WebSocket proxy
An earlier theory blamed the browser→`wss://<host>/wss-asterisk/`→`wss://mediagtw:8089/ws` upgrade
proxy in server/routes.ts for keeping a dead contact alive (tearing the peer down only on end/error,
not on `close`). That close-propagation change was implemented and then **REVERTED to byte-for-byte
original** after the user confirmed the proxy path is healthy: with NO forwarding configured, a
logged-in agent DOES receive the queue call fine on PJSIP. The user explicitly forbade re-touching
this proxy. Do not re-add close-propagation here.

# Where the real fix lives
The "logged-in agent doesn't get the call" complaint was a ROUTING bug, not a proxy bug: in the
forwarding-configured mode, `connectCallToAgent` forwarded to mobile without ever ringing PJSIP.
Fix = registration-gated forwarding — see `asterisk-forward-callerid.md` "Desk-first routing".

# Belt-and-suspenders (their Asterisk config, optional)
`qualify_frequency` + `remove_unavailable=yes` on the 2001 AOR so Asterisk actively prunes
unreachable contacts (removes stale "Avail" contacts that would otherwise ring a dead desk).

# Separate observation (not the same bug)
The ARI CONTROL WebSocket (queue-engine ariClient → Asterisk, a direct connection, NOT this proxy)
logs `Web socket closed abruptly` periodically — our own ping/pong + health-check reconnect on a
flaky CORPCRM01↔mediagtw link; it self-heals. Do not conflate with softphone registration.
