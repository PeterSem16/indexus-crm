---
name: MS365 cross-origin OAuth handoff (dev ↔ prod)
description: How Azure AD MS365 login works on the Replit dev URL when only the production callback is registered in Azure AD.
---

# MS365 cross-origin OAuth handoff

## The constraint
Azure AD has exactly ONE registered redirect URI: the **production** callback.
The Replit dev URL (`*.worf.replit.dev`) is not registered and can't easily be.
So a dev login must route the OAuth round-trip through the production callback,
then hand the authenticated result back to the dev origin.

## Why this is tricky: the databases are NOT shared
Replit dev and production run separate databases. The same person (e.g. admin)
exists in both but with **different primary-key UUIDs**. This drives two rules:

1. **The handoff must be a self-contained HMAC-signed token**, not a DB row — a
   token stored in prod's DB is invisible to Replit. Both servers run the same
   Azure app, so `MS365_CLIENT_SECRET` is identical and is reused as the HMAC key.
2. **Identity that crosses servers must be stable, never a local UUID used in the
   wrong DB.** The key design decision: the **same Replit server both starts the
   login and finishes it**, so the handoff carries the *originating Replit userId*
   (valid in Replit's DB), while **production never looks the user up in its own
   DB** during a cross-origin login. Production only confirms the Microsoft Graph
   email matches the email that was signed into the OAuth `state` by the originator,
   then relays that same userId back. Do NOT have prod re-look-up the user and
   re-sign prod's own UUID — that UUID is meaningless in the originator's DB.

## The 3-part flow
1. **login-ms365 (originating server):** always sets redirect_uri to the prod
   callback. Cross-origin login emits a **signed** `state` carrying userId +
   returnOrigin + the user's email (5-min expiry). Same-origin (prod) login uses a
   plain `login:{userId}` state.
2. **prod callback:** verifies the signed state. For cross-origin it validates the
   Graph email against the email in the state, then mints a short-lived signed
   handoff token carrying the originating userId and redirects to
   `{returnOrigin}/api/auth/ms365-complete`. Same-origin keeps the normal DB lookup
   + session creation.
3. **ms365-complete (originating server):** verifies the handoff token and resolves
   the user by that userId **in its own DB** — which works precisely because the
   same server signed the state.

## Security requirements
- **Sign the state.** An unsigned returnOrigin/email lets an attacker point the
  handoff at an attacker-controlled `*.replit.dev` and exfiltrate the token →
  account takeover. The signature makes origin/email unforgeable.
- **Validate the origin before signing**, and **allowlist return origins** at the
  callback, as defense in depth.
- **Bind the handoff token to its return origin** and reject redemption at any
  other origin. Without this, a broad origin allowlist lets an attacker get a token
  minted for an attacker-controlled allowed origin, capture it, and replay it to the
  real server (the token alone is bearer-equivalent). Origin-binding makes a
  captured token useless anywhere but the exact origin it was issued for.
- **Match the Microsoft identity strictly.** Compare the Graph email to the
  expected email with case-insensitive EXACT equality — never substring/local-part
  matching, or an unrelated MS account containing the victim's local-part can
  authenticate as them (this gates bearer-token minting).
- **One-time handoff token:** random jti + replay guard; short TTL. The replay
  guard MUST be idempotent within a short window: benign duplicate GETs of the
  redirect (browser prefetch, preview-proxy retry, refresh) otherwise trip a
  strict single-use guard and fail a legitimate login as "invalid token". On a
  duplicate, re-redeem to the same result AND skip tearing down/recreating the
  session (a late duplicate ending the fresh session causes an instant heartbeat
  logout). Emit a granular failure reason (bad_signature/expired/replayed/…) so
  the next failure is diagnosable instead of an opaque null.
- **Fail closed** if the shared secret is missing (no fallback key).
- **Redact secrets from request logs.** The auth request logger prints the URL;
  strip `token=`/`code=` query values or the handoff token lands in logs.

## Deploy gotcha (critical)
The **prod callback change must be deployed to production** before cross-origin dev
login works end-to-end (`replit.md` has the deploy command). The originating-server
endpoints take effect on Replit immediately, but the handoff only happens once
production runs the updated callback. Always tell the user this.

## The push gap (why "merged on Replit" ≠ "on prod")
Prod deploys via `git pull origin main` from **GitHub** (`origin` =
github.com/PeterSem16/indexus-crm). A Replit checkpoint/merge commits to the
**local** Replit main only; that can be many commits AHEAD of GitHub (seen 61
ahead, 0 behind = clean fast-forward). **The main agent is blocked from
`git push`** ("Destructive git operations are not allowed"). So to get code to
prod: push Replit→GitHub via the **Replit Git pane** (or a Project Task), THEN run
the prod deploy command. Diagnose prod's running version with
`curl https://indexus.cordbloodcenter.com/api/auth/ms365-complete?token=test`
→ 302 = new code deployed, 404 = still old code.
(Note: `origin` remote URL has an embedded GitHub PAT — advise rotating it.)

## Dev login fallback (so dev work isn't blocked by prod)
When prod isn't redeployed, M365 dev login dead-ends and nobody can get INTO the
Replit dev app (admin is M365-only). Unblock without touching prod: the dev admin
(`username='admin'`) was set to `auth_method='local'` + a bcrypt password **in the
dev DB only** (prod admin stays `ms365`, separate DB). check-auth-method returns
`local`→ password field appears; `/api/auth/login` works. Flipping `auth_method`
off `ms365` only affects login + a cosmetic placeholder in a user list (no Graph/
mailbox impact — those use a separate token store). Revert by setting it back to
`ms365`.

## Build note
`npm run build` uses esbuild with NO type-check, so tsc-only issues (e.g. iterating
a `Map` needs downlevelIteration — prefer `.forEach`) don't block the build.
routes.ts has ~250 pre-existing tsc errors (e.g. `logActivity` typed `details?:
object` but called with a JSON string); don't treat those as regressions.
