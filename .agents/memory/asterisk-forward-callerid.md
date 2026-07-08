---
name: Asterisk forward caller-ID + desk-first routing
description: How the from-internal-* dialplan derives outbound CLI (CBC_CALLER) and why queue forwarding to mobile only happens when the agent is NOT logged in.
---

# Forwarded-call caller-ID (CBC_CALLER) and desk-first routing

## ⭐⭐ AUTHORITATIVE OPERATOR CORRECTION (supersedes the "carrier-side, never touch CLI" conclusion below for the FORMAT question)
SLOVANET (the operator) replied to our test summary and reframed the whole thing:
- **Our earlier "every SK CLI format 486s" traces were on the WRONG leg.** They were the trunk toward the **DialLog/ViciDial box** (`10.9.33.2` / `195.28.88.42`), NOT SLOVANET's real voice gateway (`212.55.232.229`). SLOVANET **could not even find** those calls in their logs, and the times didn't match (they saw calls to `0948519438` starting only ~18:06, we claimed 16:40). So the "clean national 0911163316 also 486s" and "anonymous also 486s" claims below were NOT proven against SLOVANET's gateway — treat them as unconfirmed.
- **The CLI we send IS malformed.** In `From:` we present `0421911163316` = `0` + full international `421911163316`. SLOVANET reads the leading `0` as a national trunk code, strips it and re-prepends `421` → **`421421911163316`** (double country code) → rejected. Their reference call 5.7.2026 17:38:15 `+421421911163316`→`+421948519438` got 486 q.850 cause=17 right after 183.
- **Correct formats SLOVANET wants for SK CLI:** national 10-digit `0911163316`, OR international `00421911163316`.
- **Fix deployed (queue-engine.ts `formatSkCliForTrunk`):** at BOTH forward CLI points (`forwardToExternalNumber` fwdCid, `connectCallToStandingAgent` cbcCaller) convert SK international/malformed forms (`+421…`/`0421…`≥13/`00421…`/bare `421…`==12) → national `0`+9-digit NSN. Foreign and genuine-national numbers (incl. a real 10-digit `042x` landline) are left UNTOUCHED (length guard: SK NSN is always 9 digits, so the malformed `0421…` is 13 digits vs a real `042x` landline's 10). Only the presented CLI changes — never the dial target or the CRM-stored number.
- **STATUS: pending live confirmation.** SLOVANET frames the malformed-CLI as a *hypothesis* ("we'll at least rule out/confirm malformed formatting") — not a guaranteed fix; cause=17 could still be a handset SPAM-list or terminating-operator screening. User will run test calls with the corrected format and send SLOVANET a simple call list (date/time, calling number, originally-called number, forwarded-to number). If SK forwards STILL 486 with a correct national CLI reaching gateway `212.55.232.229`, THEN the carrier-side/anti-spoofing theory below regains weight.
- **Why this reversal is trustworthy:** SLOVANET is the operator with their own gateway logs; their word + gateway traces override our inference from the intermediary DialLog box. Do not re-assert "format is a dead end" without a live trace captured at `212.55.232.229` (not the DialLog box) showing a correct national CLI still failing.

### ⚡ Jul-7 POST-FIX LIVE RESULT: format fix works, SK forward STILL 486 (foreign still rings)
User deployed `formatSkCliForTrunk` and ran two live test calls (both DID `0232399030` → forward to agent mobile `0948519438`):
- **SK caller — 486.** Inbound arrived from SLOVANET as `0421911163316`; our fix presented the outbound CLI as national **`0911163316`** (confirmed at BOTH boxes: mediagtw `Set(CALLERID(num)=0911163316)`, and the SLOVANET-trunk box `keeping CID=0911163316`). Result: 180 Ringing → 183 progress → **486 "Busy Here" from `195.28.88.42:5060`**. (07.07.2026 20:30:40, UNIQUEID `1783449040.2017`.)
- **Foreign caller (DE `0491723627488`) — RANG.** Same path, CLI left untouched, 180+183 progress, no 486. (07.07.2026 20:23:46, UNIQUEID `1783448626.1996`.)
**Conclusion:** malformed format is NOT the (sole) cause — a correct national SK CLI still 486s while a foreign CLI on the identical hairpin rings. The only variable remains SK-vs-foreign CLI, so CLI-screening/anti-spoofing regains weight. The format fix stays in (it's still the correct/required behavior) — do not revert it.

### ✅ Jul-8 SLOVANET verdict: 486 = antispoof in the PARTNER network; fix = Diversion header (option 3)
SLOVANET traced both post-fix calls and answered authoritatively:
- **486 does NOT originate at SLOVANET's gateway or the DialLog box** — it comes from the interconnect/target operator's network; SLOVANET only relays it back. SLOVANET has **NO CLI screening on our trunk** (never had) and forwards whatever From: we send (after format conversion).
- **Likely cause:** interconnect partner's antispoof rejects calls presenting CLIs belonging to other networks (test CLI `0911163316` is in T-Mobile's network; dial target `0948519438` is O2). Foreign CLIs pass such antispoof — explains why DE rang.
- **Foreign CLI must ALSO be reformatted:** `0491723627488` still got mangled to `421491723627488` at SLOVANET. Foreign must be sent as `00<CC>…` (two zeros). Implemented in `formatSkCliForTrunk`: `+…`→`00…`; single-`0` form with len ≥ 11 (longer than any genuine 10-digit national) → prepend second `0`. Genuine nationals untouched.
- **Chosen fix = option 3 (Diversion header):** proclaim the call as diverted so antispoof accepts a foreign-network CLI. Add to the outbound INVITE: `Diversion: <sip:0232399030@212.55.232.229>;reason=unconditional;privacy=off` (any owned DDI `0232399xxx` works; SLOVANET confirmed the whole range is authorized). Known to satisfy T-Mobile's antispoof; O2 theoretically (untested by SLOVANET).
- **Where to add it:** the final INVITE to SLOVANET is generated by the OLD asterisk (SLOVANET-trunk box, chan_sip), `extensions.conf` context `[from-mediagtw]`, extension `_X.` → `Dial(${SIPslovanet_trunk}/${EXTEN},,tToR)` (all new-asterisk outbound + forwards route through here). Add `SIPAddHeader(Diversion: <sip:0232399030@212.55.232.229>\;reason=unconditional\;privacy=off)` BEFORE the Dial. Escape `;` as `\;` (else it's a comment).
- **⚠️ Use GotoIf, NOT ExecIf, for the guard:** the Diversion value contains `sip:` — a colon — and `ExecIf(cond?app:elseapp)` treats `:` as its true/false separator, so it truncates the header. Guard by skipping instead: `same => n,GotoIf($["${CALLERID(num):0:7}" = "0232399"]?dodial)` / `same => n,SIPAddHeader(…)` / `same => n(dodial),Dial(…)`. This adds Diversion only to forwards (foreign/other-network CLI), leaving genuine outbound that presents our own `0232399xxx` DDI unmarked. Reload: `asterisk -rx "dialplan reload"`. Server-side change, NOT in the repo. Diverting number can be any owned `0232399xxx` (whole DDI range is ours); a fixed `0232399030` is fine since the two forward legs are separate calls and the original DID isn't on the outbound channel.
- **Fallback = option 2:** present own DID `0232399030` as CLI (loses original caller identity; SLOVANET confirmed fully authorized). NOTE: the INDEXUS mobile app still shows the real caller via its own Expo push alert (see agent-alert bridge), so option 2's downside is partly mitigated — the native phone CLI shows `0232399030` but the app can surface who's calling.

### ❌ Jul-8 21:40 LIVE: option 3 (Diversion) DID NOT fix 486 — and foreign REGRESSED
Dialplan Diversion header confirmed executing on the outbound leg (`SIPAddHeader(Diversion: <sip:0232399030@212.55.232.229>;reason=unconditional;privacy=off)` before `Dial(SIP/SLOVANET-VGW/…)`; GotoIf guard correctly evaluated false and added it). Results:
- **SK `0911163316` + Diversion → still 486** "Busy Here" from `195.28.88.42` (all requeue retries). (08.07.2026 21:41:39, UNIQUEID `1783539699.1285`.)
- **Foreign `00491723627488` (correct 00-form) + Diversion → NOW 486** too. (08.07.2026 21:40:30, UNIQUEID `1783539630.1276`.) This is a **REGRESSION**: on Jul-7 the foreign call (malformed `0491723627488`, no Diversion) RANG. So either the correct 00-form OR the Diversion header now triggers the partner's 486.
**Interpretation:** we've done format + Diversion exactly per SLOVANET's spec; the 486 still comes from the interconnect partner. Genuinely partner-side now — nothing more to change on our dialplan without SLOVANET's input. Useful isolation test WE can run: re-send one foreign call with 00-form but Diversion REMOVED — if it rings, the Diversion header itself is what the partner rejects. Next: capture the real INVITE via `sip set debug peer SLOVANET-VGW`, send SLOVANET the new results (times/UNIQUEIDs), take their offer to test from their O2 SIM / check the partner. If calls must connect NOW, switch to option 2.

## ✅ ACTUAL RESOLUTION Jul-5: prod ran the CLI-mangling commit; the revert was un-pushed
The user's live "caller ID is broken, you ruined it" was NOT a new carrier issue — origin/main (what
CORPCRM01 pulls) was sitting on the `normalizeSkCallerId(fwdCid)` commit, which REWRITES the forwarded
CLI to a normalized SK form instead of the raw caller number. The byte-for-byte revert (restores
`CALLERID(num/name)` + `CBC_CALLER = fwdCid`, the real number) was committed in the workspace but ONE
commit AHEAD of origin/main → un-pushed → the server could not pull it, so prod kept mangling the CLI.
Fix path: push the revert to origin/main, THEN deploy. See workspace-vs-prod-git-sync.md. (The separate
SK 486 carrier finding still stands for call CONNECTIVITY, but the user's stated pain here was the CLI
DISPLAY, which the un-pushed mangling commit explains completely — do not conflate the two again.)

## ⛔ DEAD-END RE-TREAD: normalizeSkCallerId (0421…→0911163316) — that format ALREADY 486s
Jul-5 I "fixed" the malformed inbound CLI `0421911163316` by normalizing to clean national
`0911163316` in `forwardToExternalNumber`. This was a RE-TREAD: the section below already records a
live trace where `keeping CID=0911163316` → `Dial(SIP/SLOVANET-VGW/0948519438)` → **486 from
195.28.88.42**. Clean national 09… 486s exactly like the malformed 0421…, the real +421…, the owned
DID 02…, and anonymous. So normalizeSkCallerId cannot help — REVERTED to byte-for-byte baseline.
**Rule: do NOT touch the SK forward CLI again in any format.** Every format is live-proven to 486; the
reject is carrier-side (SLOVANET), caller-ID-independent. If tempted again, re-read this file top-to-
bottom FIRST.

## ⭐ NEW Jul-5 live confirm: logged-in agent → desk PJSIP/<ext> NOT registered → call black-holes
`tail messages.log` during the failing calls shows, repeatedly:
`ERROR res_pjsip.c: Endpoint '2001': Could not create dialog to invalid URI '2001'. Is endpoint
registered and reachable?` + `chan_pjsip.c: Failed to create outgoing session to endpoint '2001'`.
So for a LOGGED-IN agent the queue rings their **desk** extension (PJSIP/2001) and the desk softphone
isn't registered → nowhere to ring. This is the desk-first design (mobile forward only via standing
forward when logged OUT). Two independent failure modes now confirmed live: (a) logged-in → desk not
registered (invalid URI); (b) mobile forward leg → SLOVANET 486 for any SK CLI. NEITHER connects, so
reverting app code cannot fix it: (a) needs the agent's INDEXUS softphone actually registered (or a
product decision to forward logged-in agents to mobile — but that then hits (b)); (b) needs SLOVANET
to authorise SK outbound CLI (CLIP no-screening) or an SK operator trunk. Also: Asterisk on mediagtw
was last (re)started Jul-3 06:49 and NOT since — the box dialplan/trunk config is unchanged across the
"worked→broke" window, which further points off the box.

## THE "it worked before, now it 486s" ROUTING REGRESSION (secondary) — also NOT caller-ID
When a user rages that SK queue-call forwarding to agent mobiles "worked before and now doesn't",
do **not** chase the outbound CLI (every format — real `+421`, `0421`, `09…`, owned DID `02…`,
anonymous — was live-traced and ALL get `486 Busy` from the upstream DialLog/VICIdial box; CLI is a
dead end). The actual regression was a **call-flow** change: a "desk-first when logged in" edit
**removed** the `if (agentUser.callForwardingEnabled && callForwardingNumber) → handleForwardedAgentCall(...)`
block at the top of `connectCallToAgent`. That block forwards a *logged-in* agent's queue call to their
**mobile** (via `handleForwardedAgentCall` → `forwardToExternalNumber`, continueDialplan on the inbound
channel — a DIFFERENT SIP flow than the standing-forward Local hairpin, and the one that connected on the
Jul-3 baseline). Removing it routed logged-in mobile-only reps onto their **desk** `PJSIP/<ext>`, which
throws `Endpoint <ext> invalid URI` when the rep isn't registered at a desk → the call dies.

**Diagnostic tells:** (1) only 2 files changed since the "worked" baseline (`git diff <baseline> HEAD --
server/ shared/` → `queue-engine.ts` + `ari-client.ts`); (2) live trace shows BOTH `Endpoint 2001 invalid
URI` AND a standing-forward 486; (3) the removed block is the only non-CLI, non-cooldown change in the diff.
**Fix = restore the forward block** (present again in `connectCallToAgent` before `const sipEndpoint`) and
keep `forwardToExternalNumber` presenting the REAL caller number on that continueDialplan path.
**Why:** the desk-first design assumed a logged-in agent is reachable at `PJSIP/<ext>`; for reps who only
use a mobile that assumption is false, so "logged-in → desk-only" silently black-holes their calls.



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

**STATUS: this __CBC_CALLER display fix IS in the current baseline again.** `originateChannel`
now takes an optional `variables` arg sent in the ARI POST JSON body (query vars are ignored by
ARI), and `connectCallToStandingAgent` passes `{ __CBC_CALLER: <raw callerNumber> }`. This is the
RAW, unmodified number (matches the user's hard requirement to show the real caller) — it is NOT a
CLI-format rewrite, so it does not violate the "do NOT touch the SK forward CLI format" rule. It
only affects the DISPLAY on calls that actually connect (foreign callers); SK still 486s carrier-
side regardless. Do not confuse re-adding this raw-number display propagation (allowed, required)
with normalize/anon/DID CLI-format experiments (forbidden, all disproven).

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

### ⚠️ SUPERSEDED — ANONYMOUS CLI ALSO gets 486 (every CLI format now disproven)
A live `pjsip set logger on` trace (Jul 5 ~20:42, agent mobile `0948519438`) shows the outbound forward with
**anonymous/empty CLI** getting the SAME `180 Ringing → 183 Session Progress → 486 Busy here` from the DialLog
box (`10.9.33.2`, "DialLog.Dialer", Asterisk-13-vici). So EVERY caller-ID has now been live-tested and ALL 486:
real `+421…`, malformed `0421…`, national `09…`, owned DID `02…`, AND **anonymous/empty**. Caller-ID is 100%
ruled out as the lever — do NOT touch the forward CLI again. The 486 originates one hop upstream at the DialLog
box, is caller-ID-independent, and is NOT code- or dialplan-fixable. Also note: the destination dialing
(`0948519438@trunk-sk-endpoint`, national `0`-normalized) is byte-for-byte identical to a dialplan dump ~1 month
old, so OUR side did not change how it dials. **Only remaining diagnostic:** place a PLAIN outbound call to the
mobile from the box (not triggered by an inbound queue call) — if it ALSO 486s the route/number is broken
independent of forwarding; if it RINGS the failure is specific to the hairpin (inbound+outbound reflecting the
same call back to the same trunk).

### (historical) attempted FINAL SOLUTION: present ANONYMOUS CLI for SK forwards (empty), real CLI for foreign
User testimony: "predtym aspon vzdy doslo k prepojeniu a bolo tam neznáme číslo, teraz sa neda ani
dovolať" → claim was that an ANONYMOUS/empty CLI used to connect. Implemented, deployed, then DISPROVEN by the
live trace above (anonymous also 486). Kept for history only.
Implemented via helper `forwardCli(raw)` (queue-engine.ts): returns `""` for SK (`+421` / `0421`≥12 / `421`==12
/ `00421`), the real number for foreign. Two call sites:
- `connectCallToStandingAgent` (standing forward, ARI originate): pass `cliCid = forwardCli(...)` as the
  originate callerId (empty → `originateChannel` omits it: `if (callerId) params.callerId=...`), and pass
  `__CBC_CALLER` ONLY when non-empty. Empty CBC_CALLER → the from-internal-* `ExecIf(LEN>0?Set(CALLERID))`
  guard skips → CLI stays blank → anonymous. REMOVED the old `cliCid || call.callerNumber` fallback (it
  re-injected the SK number).
- `forwardToExternalNumber` (continueDialplan on the SAME inbound channel): for SK actively CLEAR the CLI —
  set `CALLERID(num)=""`, `CALLERID(name)=""`, `CALLERID(pres)=prohib_passed_screen`, AND `__CBC_CALLER=""`
  (must blank it: from-sk-trunk already set `__CBC_CALLER=caller` on this channel, else the guard re-injects).
Prior attempts REVERTED as proven-useless on this route: national `09…` normalization (`toSkNationalCli`) and
company-DID substitution (`resolveForwardCli`/`isSlovakInternationalCaller`/`toNationalSkDid`) — every Slovak
CLI 486s regardless (see below).

**⚠️ REMOVED — do NOT re-introduce without an explicit request:** (a) the out-of-band caller delivery
(in-app + Expo push + SMS, `server/lib/agent-call-alert.ts`, `alertAgentIncomingCall`, the
`recentAgentCallAlerts` dedup map, `cliWasSubstituted` gate) — deleted at the user's demand ("tie
notifikácie nechcem, je to blbosť"); (b) the DID-substitution — deleted because it does NOT work (below).

### DECISIVE trace: even the OWNED DID gets 486 → it is NOT a code-fixable CLI trick
A DialLog-box console trace (`attached_assets/Pasted--Executing-0232399030-from-sk-inbound…`) shows the
outbound forward leg to the agent mobile presenting **CID=0232399030 = the company's OWN inbound DID**
(a Bratislava 02 landline they own), dialed `SIP/SLOVANET-VGW/0948519438` → 180 ringing → 183 → **486 Busy
Here from 195.28.88.42 (SLOVANET gateway)**. So the owned DID 486s too, exactly like the real +421 caller.
Only FOREIGN CLIs ring on the same mobile/same hairpin path.
- **CONFIRMED — all 3 SK formats fail (format space exhausted):** a later live test presented the caller in
  clean national `0911163316` (standard `09…` mobile form) as the outbound CLI (log: `keeping CID=0911163316`
  → `Dial(SIP/SLOVANET-VGW/0948519438)` → **486 from 195.28.88.42**). So E.164 `+421…`, the national landline
  DID `02…`, AND the national mobile `09…` ALL get 486. No CLI format/dialplan change fixes it → it is 100%
  operator-side (SLOVANET). Note the forward is a HAIRPIN back to the same carrier (inbound source == outbound
  target == SLOVANET-VGW `195.28.88.42`), which commonly triggers CLI-continuity / anti-spoofing rejects for
  national CLIs while foreign CLIs pass. Do NOT spend more effort on formats.
- **Falsifies** the earlier (never evidence-backed) belief that "presenting the owned DID makes SK forwards
  connect reliably". It does not. On this route **no Slovak CLI connects**; DID substitution only hid the
  caller for zero benefit → reverted.
- **Operator = SLOVANET** (SIP gateway `195.28.88.42`, peer `SLOVANET-VGW`); the forward path is
  SLOVANET → their own DialLog (ViciDial) box → their new mediagtw Asterisk. The 486 comes back FROM
  SLOVANET's gateway (observed at the DialLog trunk), so it is SLOVANET's/its downstream mobile operator's
  decision, not our dialplan. 486 (vs 403/603) is normal for policy rejects (opaque) — does NOT mean genuine
  busy; the deciding evidence is foreign-rings / every-SK-CLI-486 on the SAME mobile (rules out channel-cap
  and hairpin/loop guards, which are CLI-independent).
- **"Nothing changed but it broke"** best fits Slovak anti-spoofing / CLI-verification enforcement (phased
  2025–2026) at the terminating operator. Zero config change needed on their side.

### FIX PATHS (operator-side is the real one; a few owned-number levers to test first)
- **Operator (real fix):** SLOVANET must enable **CLIP no-screening** / authorise the company's DID(s) as
  permitted OUTBOUND CLI on this trunk, OR route SK→SK forwards via a trunk that authorises SK CLIs.
- **Asterisk-side levers on the DialLog box worth ONE test each (owned numbers only — never spoof a foreign
  or non-owned CLI):** (1) present the owned DID in **E.164** `+421232399030` / `00421232399030` — screening
  DBs key on E.164, national `02…` over interconnect may just fail the lookup (the +421/0421 tests were on
  the CALLER's number, not the DID); (2) use whatever number SLOVANET has provisioned as the trunk's
  authorised outbound CLI (ask them); (3) `sendrpid=pai` with From=trunk pilot number + PAI=owned DID;
  (4) `Diversion: <owned DID>` header (SIPAddHeader, chan_sip) — legit for forwards, low probability.
- PAI/RPID do NOT bypass screening if the operator screens asserted identity too.

## Desk-first routing (logged-in+registered → desk, else → mobile)
`connectCallToAgent` runs for agents with an active agentSession that has the queue selected
(`selectAgent`). **Being "available" (session) is NOT the same as having a live softphone:** a
Nexus Pulse tab can be open (session available) while the PJSIP contact is gone. So the
queue-agent `callForwardingEnabled → forward-to-mobile` branch is **live and registration-gated**
— it forwards to mobile ONLY when the softphone is not registered; otherwise it rings the PJSIP
desk. Registration is probed via ARI `getEndpointStatus("PJSIP", ext)`: treat `state==="offline"`
as not-registered, and null/error as registered (fail-open to the proven desk path — a forward
needs the same ARI anyway).

**Why:** user requirement — when logged in with the phone connected, the app must ring; forward
to mobile is a FALLBACK only for when the agent is NOT logged in / phone not connected.

**A queue call forwards to a mobile via two independent paths:** (1) logged-in agent whose
softphone is offline → registration-gated branch in `connectCallToAgent` → `handleForwardedAgentCall`
(this is **NOT** dead code); (2) no logged-in agent at all → standing-forward path
(`tryStandingForward`/`connectCallToStandingAgent`).

**Edge:** a stale "online" contact (dead phone still registered) rings the desk unanswered → the
existing 30s ring-timeout requeues; a later requeue re-probes and forwards once Asterisk expires
the contact (so the forward fallback is delayed, not lost). `selectAgent` also doesn't prune
sessions by `lastActiveAt`, so a stale-open session can ring a dead desk before the contact expires.

**Separate DID path NOT changed:** the `pjsip_user` DID route still forwards unconditionally and
honors the mobile-app AstDB `callforward`; it is intentionally not registration-gated.

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
