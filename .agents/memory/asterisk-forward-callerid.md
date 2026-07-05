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

## FALSE BUSY on forward depends on the CALLER's number (CLI), not concurrency
Symptom users report as "phone rings busy but it's free": a forwarded queue call to a mobile
gets an immediate carrier BUSY, but a later call to the **same** mobile from a **different**
caller rings fine (explicitly NOT concurrent → rules out the busy-lock/cooldown). Verbose log
tell: `Everyone is busy/congested at this time (1:1/0/0)` = 1 line, 1 **busy** (Q.850 cause 17
/ SIP 486). The ONLY differing input across the two calls is `CBC_CALLER` → the presented CLI.

**Root cause:** the SK trunk delivers inbound callers as **"0" + full international** number
(SK +421… arrives as `0421…`, DE +49… as `049…`). The dialplan sets `CALLERID(num)=${CBC_CALLER}`
**verbatim** (it normalizes only the dial target / OUTNUM, never the CLI). So a raw
`0421911xxx316` is presented as the CLI, which the mobile carrier reads as an **invalid domestic
SK number** (area 042… with too many digits) and rejects with a false BUSY. A foreign-looking
`049…` isn't recognised as domestic SK so it slips through and rings — which is exactly why the
symptom looks caller-dependent.

**⚠️ SUPERSEDED / REVERTED (see Resolution below):** this E.164-normalization approach was
REVERTED — a live SIP trace proved it did NOT stop the 486, and it broke the REQUIRED real-number
display. Do not re-introduce E.164 CLI rewriting for SK without a live trunk test.

**Fix (attempted, now reverted):**
`QueueEngine.normalizeCallerIdForCli()` rewrote the carrier's `0`+CC / `00` / bare-CC /
already-`+` forms to canonical E.164 (`+CC…`) before it's used as the originate `callerId` +
`__CBC_CALLER` (standing forward) and before `Set(CALLERID(num))` in `forwardToExternalNumber`.
**Length guards are mandatory:** SK national numbers (area codes 03x/04x, 10 digits, e.g.
`036XXXXXXX`, `0421XXXXXX`) and short internal extensions collide with `0`+CC / bare-CC — only
rewrite `0`+CC when len ≥12 and bare-CC when len ≥11; leave anything unrecognised untouched
(safe by construction). `norm` (the DIAL TARGET) is separate and already works — do NOT touch it.

**Why:** two log samples correlated false-busy with the malformed SK-looking CLI vs a foreign
CLI. Deploy-and-verify only (no live carrier test from Replit): confirm with one SK + one
foreign caller after deploy. If the trunk rejects a leading `+`, fall back to the `00`+CC form
(`00421…`) which legacy trunks often prefer. Alternate hypothesis if it persists: the agent is
manually declining the odd-CLI call (also yields 486).

### RESOLUTION: present the caller's REAL number unchanged (both CLI rewrites reverted)
Two attempted "fixes" this session were BOTH reverted, in order:
1. E.164 normalization (`normalizeCallerIdForCli`) — changed SK CLI to `+421…`.
2. Own-DID substitution for `+421` callers (`didToE164Sk`) — showed the company DID instead.

The user's HARD REQUIREMENT: reps must see the **real caller's Slovak number** on their mobile, and
this **worked before** these changes. So the CLI is now just the raw caller number for ALL callers
(the pre-change behaviour). `normalizeCallerIdForCli` / `didToE164Sk` were removed. Do NOT rewrite
the SK CLI again without a live trunk test that shows it both connects AND preserves the number.

**What the definitive `pjsip set logger on` trace shows (do not re-theorise past this):** the
outbound INVITE presents `From: "+421911xxx316"` (caller number ONLY in From — no PAI/RPID sent;
`trunk-sk-endpoint` has send_pai=false/send_rpid=false/from_user empty) and the SK provider
(`10.9.33.2`, "DialLog.Dialer", Asterisk-13-vici) replies **180 Ringing → 183 Session Progress WITH
real SDP → 486 Busy here** (no Q.850 Reason/Warning header). So the provider actually routes the call
onward (real early media) and busy comes from DOWNSTREAM, not a pre-ring auth reject.

**CONFIRMED carrier-side, format ruled out:** user deployed the raw-number revert (`0421…`) on
CORPCRM01 and tested — SK call STILL 486. So BOTH `+421…` and `0421…` fail; foreign `+49…`/`049…`
consistently rings. The ONLY variable is the caller's number being a NATIONAL SK number.

**Working theory (strongest fit): EU anti-spoofing / CLI validation at the SK terminating operator.**
A call egressing via an international/wholesale gateway (DialLog/VICIdial) that presents a *Slovak*
CLI is blocked as suspected spoofed caller-ID; a *foreign* CLI on an international route is legitimate
so it passes. This is why "it worked before" (filtering rolled out/tightened, or the forward used to
egress via a real SK operator trunk that authorised SK CLIs). NOT fixable in code or dialplan format.

**Decisive confirmation test (on mediagateway, reversible):** present a number the company OWNS
(e.g. the inbound DID `0232399030`) as the CLI for one SK forward. If it RINGS → CLI
authorisation/anti-spoofing confirmed. The earlier own-DID substitution (`didToE164Sk`) was this same
experiment via code — if the user recalls whether THAT rang, it answers the question without a retest.

**Fix paths (all carrier/routing, pick based on requirement):**
- Keep REAL number: provider must authorise presenting the customer's SK CLI (**CLIP no-screening**),
  OR route SK→SK forwards via a legitimate **Slovak operator trunk** where SK CLIs are permitted.
- Or accept the tradeoff: present the company's own authorised DID (rings), show the real caller in the
  INDEXUS app instead of on the mobile screen.
- send_pai=yes + from_user=<owned DID> + PAI=real number only helps IF the provider honours PAI to the
  mobile — unverified, and terminating anti-spoofing may still strip/ignore it.

### IMPLEMENTED (final decision): DID-substitution ONLY on the standing path + out-of-band caller delivery
The chosen tradeoff was implemented **only in `connectCallToStandingAgent`** (the sole live queue→mobile
forward path). A central `resolveForwardCli(realCaller, did)` presents the company queue DID as the CLI
**only for SK (+421) callers** (`isSlovakInternationalCaller` + `toNationalSkDid` → national `0…` form);
foreign callers keep their real number verbatim. Because the SK caller's phone now shows the DID, the REAL
caller (number + name) is delivered out of band the instant the mobile rings, via a best-effort,
fire-and-forget `alertAgentIncomingCall(...)` (`server/lib/agent-call-alert.ts`) firing THREE channels:
in-app web notification, Expo push to INDEXUS Connect, and SMS (BulkGate).

**Deliberately NOT applied** to `forwardToExternalNumber` (collaborator / queue forward-number): that path
has no out-of-band alert, so substituting the DID there would silently hide the caller. It keeps the real
number (SK calls on that path stay broken until a carrier-side fix — acceptable, pre-existing).

**Alert gating & dedup (must keep):** fire the alert ONLY when the CLI was actually substituted
(`cliCid !== realNumber`) — never for foreign callers (their mobile already shows the real number; an SMS
would just cost money). Dedup per `${callId}:${userId}` (5-min TTL map `recentAgentCallAlerts`) so the
round-robin re-ring loop (cooldown + ring-timeout requeue) does not re-SMS the same agent about the same
caller. See `agent-alert-user-collaborator-bridge.md` for how push tokens are located across the users↔
collaborators no-FK gap. **Why:** deploy is git pull+build+pm2 restart (NO npm install / db:push), so this
used global `fetch` for Expo (no new dep) and NO schema change.

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
event) — pass them into `handleChannelDestroyed` → the standing-destroy handler. Use a slightly
longer cooldown (20s) when `cause === 17` (**AST_CAUSE_USER_BUSY**, the mobile's SIP 486) so the
caller waits in queue with MOH until the agent frees; 8s baseline otherwise. Keep the busy value
SHORT (20s not 60s): with a single standing agent the cooldown is the ONLY re-ring mechanism, so
a long value leaves a waiting caller silent for up to that long AFTER the agent's line frees.

**Why:** one mobile can take only one call; the correct behavior for a 2nd caller is to WAIT in
queue (or round-robin to another free agent — cooldown is keyed per userId so others stay
eligible), never to force-dial a busy line. `tryStandingForward` needs no change; its existing
`cooldown > now → skip` check does the waiting.

**Verify on deploy:** whether the mobile's 486 actually arrives as `cause=17` depends on Dial's
HANGUPCAUSE propagating through the dialplan prio-8 `Hangup` onto the Local channel. The handler
logs `cause`/`cause_txt`; grep it after a live 2-call test. If it logs 16/34 instead, the 8s
baseline still kills the loop — worst case the busy back-off is 8s not 20s.
