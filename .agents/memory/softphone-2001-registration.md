---
name: Softphone WS registration goes stale via /wss-asterisk/ proxy
description: Why inbound calls to a logged-in agent fail with "invalid URI 2001" even though pjsip shows the contact Avail
---

# Symptom
Inbound queue call to a logged-in agent dies after retries. Asterisk (mediagtw) logs:
`res_pjsip.c: Endpoint '2001': Could not create dialog to invalid URI '2001'. Is endpoint registered and reachable?`
+ `chan_pjsip.c: Failed to create outgoing session to endpoint '2001'`.
The app's ARI originate returns HTTP 500. `pjsip show contacts` may still show `2001/... Avail`.

# Root cause
The browser softphone registers over a WebSocket that is proxied by our own server:
browser → `wss://<host>/wss-asterisk/` (upgrade proxy in server/routes.ts) → `wss://mediagtw:8089/ws`.
The proxy piped both sockets but only tore down the peer on `end` and `error`, **not on `close`**.
When an agent's browser drops abruptly (tab killed, laptop sleep, wifi drop) the client socket
often fires ONLY `close` (no `end`/`error`). The upstream WS to Asterisk then stayed open, so
Asterisk kept the softphone contact registered even though the browser was gone. A registered-but-
dead contact = Asterisk tries to dial it, cannot create the dialog, and reports the endpoint name
as an "invalid URI". A fresh browser session registers a NEW contact (contact user/port changes,
e.g. mofj67al→63coba06), which is why it "works after reopening the app".

**Why it's not the app's originate code or Asterisk config:** the ARI POST sends a clean
`endpoint=PJSIP/2001`; endpoint 2001 config is correct (`aors: 2001`, `transport: transport-wss`,
`webrtc: yes`, contact Avail). A manual CLI `channel originate PJSIP/2001` against a FRESH contact
does not reproduce the error. The bug is a lingering upstream WS, not the dial string.

# Fix
In the `/wss-asterisk/` upgrade proxy, propagate `close` both ways so a browser disconnect always
closes the upstream Asterisk WS (Asterisk then drops the WS-bound contact immediately):
`socket.on("close", () => tlsSocket.destroy())` and `tlsSocket.on("close", () => socket.destroy())`.

**Why:** WebSocket-bound PJSIP contacts are removed when their transport connection closes; keeping
the upstream open keeps a dead contact alive.
**How to apply:** any TCP/WS proxy that pipes two sockets must tear down the peer on `close`, not
just `end`/`error`; `end` only covers graceful FIN.

# Belt-and-suspenders (their Asterisk config, optional)
Set `qualify_frequency` + `remove_unavailable=yes` on the 2001 AOR so Asterisk actively prunes
unreachable contacts even if a WS lingers.

# Separate observation (not the same bug)
The ARI CONTROL WebSocket (queue-engine ariClient → Asterisk, a different direct connection, not
through this proxy) also logs `Web socket closed abruptly` every few minutes. That is our own
ping/pong + health-check forceReconnect firing on a flaky CORPCRM01↔mediagtw link; it self-heals.
Do not conflate it with the softphone registration proxy.
