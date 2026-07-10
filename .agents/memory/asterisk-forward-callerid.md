---
name: Asterisk forward caller-ID + desk-first routing
description: How the from-internal-* dialplan derives outbound CLI (CBC_CALLER), why SK forward CLI must never be rewritten, and when a queue call forwards to mobile vs rings the desk.
---

# Forwarded-call caller-ID (CBC_CALLER) and desk-first routing

## ⛔ NEVER rewrite the SK forward CLI — present the RAW caller number
Every SK caller-ID format has been live-disproven as a fix for the "forwarded SK
call rings busy" symptom. E.164 (`+CC…`), the carrier's `0`+CC malformed form,
clean national mobile, the company's own owned DID, AND anonymous/empty CLI were
each traced and ALL returned SIP **486 Busy Here**; only *foreign* CLIs ring on
the identical hairpin. So the forward CLI is just the raw caller number for all
callers (the pre-change behaviour the operator requires: reps must see the real
caller's number).

**Why 486 (not code-fixable):** it is anti-spoofing / CLI-verification at the
**terminating/interconnect operator**, not our dialplan and not SLOVANET's
screening (SLOVANET confirmed they have none on our trunk). Behaviour varies by
the caller number's CURRENT network (number portability matters, not the prefix)
and is often transient greylisting — foreign calls typically 486 on the first
INVITE then **connect on our auto-requeue retry**. A national SK CLI hairpinned
back to the same carrier is the case most likely to be rejected as spoofed.

**Rule:** do NOT re-introduce any SK CLI rewrite (normalize/E.164/DID-substitute/
anonymize/Diversion/PAI) without a fresh live trunk trace showing it BOTH connects
AND preserves the real number. All of those were tried and reverted. The real fix
is carrier-side: operator enables CLIP no-screening for the owned DID(s), or SK→SK
forwards route via a Slovak operator trunk that authorises SK CLIs. Until then the
auto-requeue retry is the working stopgap for foreign; SK may stay blocked.

**Diversion/PAI dead-end:** even sent textbook-style, the Diversion header is
stripped inside the operator's own network before it reaches the target, and PAI
is discarded — neither reaches the terminating operator, so neither fixes 486 or
the "anonymous" display. Do not experiment further with SIP headers here.

**Testing gotcha:** before interpreting a 486, confirm the inbound caller number
≠ the forward target. A phone forwarded to itself is genuinely busy → a legitimate
486, not the antispoof 486. A valid SK test needs a different SK source and a
different agent mobile.

## Caller-ID propagation via CBC_CALLER (this part IS in baseline and is allowed)
The mediagateway dialplan (`from-internal-<cc>` contexts) sets the outbound CLI
from the channel variable **CBC_CALLER**:

    ExecIf($[${LEN(${CBC_CALLER})} > 0]?Set(CALLERID(num)=${CBC_CALLER}))

- **continueDialplan forwards** (collaborator forward, direct-extension-dial via
  `forwardToExternalNumber`): the dialplan runs on the **inbound channel itself**
  (no Local hairpin), so setting `__CBC_CALLER` on that channel is enough.
- **ARI-originated Local leg** (standing forward, `connectCallToStandingAgent`
  originating `Local/<num>@from-internal-<cc>/n`): the dialplan runs on the
  `Local/…;2` leg. The originate `callerId` param sets CALLERID but the dialplan
  reads **CBC_CALLER**, which was empty → CLI never set. **Fix:** pass the caller
  number as an **inherited** originate variable `__CBC_CALLER` (double underscore)
  in the ARI originate JSON **body** (`{variables:{__CBC_CALLER: caller}}`). Only
  `_`/`__`-prefixed vars are inherited Local `;1`→`;2`; ARI ignores query vars.

This propagates the RAW, unmodified caller number (display only, affects calls that
actually connect) — it is NOT a CLI-format rewrite, so it does not violate the rule
above. Do not confuse re-adding raw-number display with the forbidden format
experiments.

## Desk-first routing (logged-in + registered → desk, else → mobile)
`connectCallToAgent` runs for an agent with an active agentSession that selected the
queue. **Session "available" ≠ a live softphone:** a Nexus Pulse tab can be open
while the PJSIP contact is gone (`invalid URI '<ext>'` / "Could not create dialog"
in messages.log = desk endpoint not registered → the call black-holes).

So the queue-agent `callForwardingEnabled → forward-to-mobile` branch is **live and
registration-gated**: it forwards to mobile ONLY when the softphone is not
registered; otherwise it rings the PJSIP desk. Probe via ARI
`getEndpointStatus("PJSIP", ext)` — treat `state==="offline"` as not-registered,
and null/error as registered (fail-open to the proven desk path).

**Two independent forward-to-mobile paths, both required (neither is dead code):**
(1) logged-in agent whose softphone is offline → registration-gated branch in
`connectCallToAgent` → `handleForwardedAgentCall`; (2) no logged-in agent at all →
standing-forward path (`tryStandingForward` / `connectCallToStandingAgent`). A
"desk-first when logged in" edit once removed path (1) and silently black-holed
mobile-only reps onto an unregistered desk — keep it.

**Edge:** a stale "online" contact (dead phone still registered) rings the desk
unanswered → the 30s ring-timeout requeues and a later requeue re-probes/forwards
once Asterisk expires the contact (delayed, not lost). The separate `pjsip_user`
DID route forwards unconditionally (honors the mobile-app AstDB `callforward`) and
is intentionally NOT registration-gated.

## Standing-forward requeue MUST cool down (busy-mobile retry loop)
When a standing-forward Local leg is destroyed before answer, the destroy handler
clears the per-agent busy lock and requeues the caller. `processQueues` re-runs
every ~2s, so a requeue with **no cooldown** re-forwards the same caller to the same
mobile every tick — a tight loop hammering a busy/no-answer mobile.

**Fix:** in the standing-destroy handler set `standingForwardCooldown`
**synchronously before any await** (JS only interleaves at awaits, so a pre-await
write is race-free against the queue tick). Thread the ARI `ChannelDestroyed`
cause through (`event.cause`/`event.cause_txt` → `handleChannelDestroyed` →
standing-destroy handler). Use ~20s when `cause === 17` (**AST_CAUSE_USER_BUSY**,
the mobile's 486) so the caller waits in queue with MOH until the agent frees; ~8s
otherwise. Keep it SHORT (20s not 60s): with a single standing agent the cooldown
is the only re-ring mechanism, so a long value leaves the caller silent after the
line frees. Cooldown is keyed per userId, so other agents stay eligible
(round-robin). `tryStandingForward`'s existing `cooldown > now → skip` does the wait.

## Prod git sync caveat
A CLI-mangling regression once persisted in prod because the byte-for-byte revert
was committed in the workspace but left un-pushed (one commit ahead of origin/main),
so CORPCRM01 could not pull it. Always push to origin/main before saying "deploy".
See workspace-vs-prod-git-sync.md.
