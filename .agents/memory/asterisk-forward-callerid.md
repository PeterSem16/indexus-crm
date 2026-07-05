---
name: Asterisk forward caller-ID + desk-first routing
description: How the from-internal-* dialplan derives outbound CLI (CBC_CALLER) and why queue forwarding to mobile only happens when the agent is NOT logged in.
---

# Forwarded-call caller-ID (CBC_CALLER) and desk-first routing

## Caller-ID on forwarded/standing calls
The mediagateway dialplan (`attached_assets/extensions_*.conf`, `[from-internal-sk]` and
the other `from-internal-<cc>` contexts) sets the OUTBOUND CLI from `${CBC_CALLER}`:

    ExecIf($[${LEN(${CBC_CALLER})} > 0]?Set(CALLERID(num)=${CBC_CALLER}))

So the caller's number must exist in the channel variable **CBC_CALLER** on the leg that
runs the `Dial(PJSIP/...@trunk-<cc>-endpoint)`.

- **continueDialplan forward** (collaborator forward, direct-extension-dial forward via
  `forwardToExternalNumber`): the dialplan runs on the **inbound channel itself** — no
  Local hairpin — so setting `CBC_CALLER` on that channel is enough. We set `__CBC_CALLER`
  (inherited) for robustness.
- **ARI-originated Local leg** (standing forward, `connectCallToStandingAgent` originating
  `Local/<num>@from-internal-<cc>/n`): the dialplan runs on the `Local/...;2` leg. The
  originate `callerId` param sets CALLERID but the dialplan's ExecIf reads **CBC_CALLER**,
  which is NOT the same thing and was empty → `LEN(CBC_CALLER)=0` → CLI never set (verbose
  log shows `0?Set(CALLERID(num)=)`).

**Fix:** pass the caller number as an **inherited** originate variable `__CBC_CALLER`
(double underscore) in the ARI originate JSON body (`{variables:{__CBC_CALLER: caller}}`).
`ast_channel_inherit_variables` copies only `_`/`__`-prefixed vars from Local `;1`→`;2`, so a
plain var would NOT reach the dialplan leg — the `__` prefix is required, not optional.
`ariClient.originateChannel` takes an optional `variables` arg (body-only; ARI ignores query
vars). Keeping `callerId` alongside is harmless (dialplan overwrites with the same value).

**Why:** two separate attempts failed before pinning that the failing `Local/...;2` leg was
the standing-forward originate, not a continueDialplan hairpin.

**Residual (not code):** the SK trunk carrier / pjsip endpoint (`from_user`/PAI) may still
rewrite or reject a foreign CLI regardless — if the mobile shows the trunk number after
deploy, that is carrier policy, not this code.

## Desk-first routing (logged-in → desk, not-logged-in → mobile)
`connectCallToAgent` is only reached for agents with an **active agentSession that has the
queue selected** (`selectAgent` filters to those). So a logged-in agent is always rung at
their **PJSIP desk extension** — the queue-agent `callForwardingEnabled → forward-to-mobile`
branch was removed. Forwarding a queue call to the mobile now happens **only** via the
standing-forward path (`tryStandingForward`/`connectCallToStandingAgent`), which by design
fires only when the agent is NOT logged in.

**Consequence to tell users:** legacy `callForwardingEnabled` alone no longer forwards queue
calls anywhere; an agent must enroll in **standing forward** (enabled + queue assignments) to
get mobile ringing when logged out. `handleForwardedAgentCall`/`setupQueueForwardedCallTracking`
are now intentionally dead code.

**Edge case (pre-existing):** `selectAgent` does not filter stale sessions by `lastActiveAt`
(unlike `hasLoggedInAgentsDb`), so a stale-open Nexus Pulse session rings a dead desk instead
of forwarding. Acceptable per requirement, but a source of missed calls if a browser is left
open.
