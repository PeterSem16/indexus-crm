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

## Standing-forward requeue MUST cool down (busy-mobile retry loop)
When a standing-forward Local leg is destroyed before answer, the destroy handler clears the
per-agent busy lock and requeues the caller. `processQueues` re-runs every ~2s, so if the
requeue path sets **no cooldown**, the very next tick re-forwards the same caller to the same
mobile — a tight loop that hammers a busy/no-answer mobile (verbose log: repeated
`Called <num>@from-internal-*` + `Everyone is busy/congested at this time (1:1/0/0)`). The
ring-timeout and originate-fail paths already set an 8s cooldown; the **destroy path did not**,
which is why a 2nd concurrent call to a single busy agent looped instead of waiting.

**Fix:** in the standing-destroy handler set `standingForwardCooldown` **synchronously before
any await** (JS only interleaves at awaits, so a pre-await write is race-free against the queue
tick). Thread the ARI `ChannelDestroyed` cause through: the `channel-destroyed` listener already
receives `event.cause`/`event.cause_txt` (AriEvent declares them; ari-client re-emits the raw
event) — pass them into `handleChannelDestroyed` → the standing-destroy handler. Use a longer
cooldown (60s) when `cause === 17` (**AST_CAUSE_USER_BUSY**, the mobile's SIP 486) so the caller
just waits in queue with MOH until the agent frees; 8s baseline otherwise.

**Why:** one mobile can take only one call; the correct behavior for a 2nd caller is to WAIT in
queue (or round-robin to another free agent — cooldown is keyed per userId so others stay
eligible), never to force-dial a busy line. `tryStandingForward` needs no change; its existing
`cooldown > now → skip` check does the waiting.

**Verify on deploy:** whether the mobile's 486 actually arrives as `cause=17` depends on Dial's
HANGUPCAUSE propagating through the dialplan prio-8 `Hangup` onto the Local channel. The handler
logs `cause`/`cause_txt`; grep it after a live 2-call test. If it logs 16/34 instead, the 8s
baseline still kills the loop — worst case the busy back-off is 8s not 60s.
