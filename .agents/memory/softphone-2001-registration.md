---
name: Logged-in agent inbound drop = softphone not registered
description: Inbound queue call to a logged-in agent drops with Asterisk "invalid URI 2001" — the browser softphone isn't registered at runtime; the registration path is stable code, so check runtime/env before touching code.
---

# Logged-in agent inbound call drops: "invalid URI 2001"

When a logged-in agent's inbound queue call drops and the Asterisk log shows,
repeatedly per call:

```
Endpoint '2001': Could not create dialog to invalid URI '2001'. Is endpoint registered and reachable?
Failed to create outgoing session to endpoint '2001'
```

the cause is that the agent's **browser softphone is not registered** to Asterisk
at that moment — NOT the caller-ID formatting or the queue routing code. The
endpoint exists in pjsip config (else the error would be "endpoint not found");
it just has no registered AOR contact, so Asterisk cannot build the dial target.

**Why:** the registration path is:
browser SIP.js → INDEXUS server `/wss-asterisk/` HTTP-upgrade proxy
(`server/routes.ts`, reads `storage.getSipSettings()` for `server`/`wsPort`(8089)/`wsPath`(/ws))
→ Asterisk WSS on mediagtw. The client side (`client/src/contexts/sip-context.tsx`,
registers `sip:<ext>@<realm>` via `wss://<host>/wss-asterisk/`) and this server proxy
have both been stable since June. Same-day telephony edits to `queue-engine.ts` /
`ari-client.ts` (forward caller-ID saga) do NOT touch registration. So an "invalid
URI 2001" regression is runtime/env, not code: phone tab not open/registered, SIP
settings row changed in the DB, TLS to 8089, or SIP auth.

`connectCallToAgent` routes a logged-in agent with `sipEnabled` + `sipExtension`
and NO call-forwarding straight to `originate PJSIP/<ext>` — if that ext isn't
registered the call has nowhere to ring and dies after retries + the
`ukoncenie-hovoru-koordinator-sk` end tone.

**How to apply — verify registration state BEFORE changing code:**
- App phone widget: does it show registered (green) or a registration error?
- mediagtw: `asterisk -rx "pjsip show contacts"` and `asterisk -rx "pjsip show endpoint 2001"` — is there a contact for 2001?
- CORPCRM01 pm2 log when the agent opens the phone: `pm2 logs indexus-crm --nostream --lines 120 | grep -i "ws-proxy\|wss-asterisk"` — does it log `Proxying /wss-asterisk/ → wss://mediagtw:8089/ws` and any `TLS connect error` / `Target error`?
