# B1: isolated internal acceptance

This is a B1-only source branch, **not a production release**. Do not merge it
into main, switch the live checkout to it or use normal deployment scripts.

## Current evidence

The operator created `indexus_ai_b1` on CORPCRM01 from `template0`, owned by
the equally named initially **NOLOGIN** role. The operator subsequently completed
private connection preparation: only this test role received LOGIN and a private
SCRAM credential. The nonce marker was created and authenticated access verified.
The role has no elevated rights or memberships; production table/column,
sequence and security-definer checks all returned false. PUBLIC database access
was revoked. No worker ran. This is not application readiness or AI acceptance.

The original application must **not** be started as a second test instance:
its ordinary startup also starts email monitors, automation and telephony.
The separate B1 entry/API/launcher have been prepared and locally tested. API
fixtures verify authentication, loopback Host/origin restrictions, one synthetic
task and pending/processing/completed persistence. The selectively based client
and B1 backend build succeeded. These are not live Gateway acceptance.

The user approved the original standalone Tasks component at `/tasks` in the B1
build. A build-only transform replaces the existing Tasks-to-Omni redirect; the
source App, authentication and production build remain unchanged. Browser
verification passed login, original Quick Create, HTTP 202, one job and the
visible pending checklist. No mailbox was connected or simulated.

The queue/API/resolution, route-adapter and initialization regression run passed
25 tests. Another 14 operator-tool tests passed, including a real development
catalog check. The latter is deliberately skipped outside Replit development.
A scoped TypeScript run still reported diagnostics in imported dependencies;
it is not a clean typecheck.

## Private connection preparation

Run the narrowly scoped preparation helper as the existing `seman` operator,
after refreshing the operator's existing sudo authorization locally. It uses
PostgreSQL peer administration, not the restricted application's DB role.
Do not grant CREATEDB or CREATEROLE to the application.

The helper:

1. Resolves only the verified local PostgreSQL target from the main application's
   existing configuration. It does not source that file as shell code.
2. Requires the dedicated role/database to be fresh, empty and restricted.
3. Uses read-only production catalog queries to reject inherited table, column,
   sequence or executable security-definer access to production data.
4. Generates private test credentials, a session secret and an environment nonce.
   These stay in `~/INDEXUS-AI-B1/private.json` (0600, containing directory 0700).
   Never paste or upload that file, and never print it with `cat`.
5. Sends a SCRAM verifier through psql stdin to enable LOGIN on **only** the
   test role. Raw SQL/psql errors are never forwarded to the console.
6. Connects as the test role and creates only a nonce marker in the empty test DB.
   It does not create CRM records, load Gateway credentials or start a process.

No repeated preparation is automatic. An existing private configuration, existing
test data, unexpected role privilege, membership or production access stops it.
If a later step fails, retain the private file: do not delete it to make a retry
pass, rotate credentials blindly, drop the database or modify production grants.

After a preparation error, use the same verified helper with `--diagnose`, not
another `--prepare`. This mode performs only read-only catalog checks, reports
the failing phase, an allowlisted failure category and SQLSTATE when available,
and reports whether the private configuration already exists without reading it.
Never request or paste raw psql stderr: it can echo a credential statement.

Catalog ACL checks use CASE guards, not assumed left-to-right AND evaluation.
PostgreSQL may evaluate a sequence privilege function before a relation-kind
filter and return 42809 for a table/index. Testing the privilege target as a
superuser can conceal this failure; the development-only catalog regression
uses the predefined restricted `pg_monitor` target without changing any role.

Approved invocation after extracting the verified helper files together:

```sh
sudo -v
node /verified/private/staging/ops/ai-jobs-b1/prepare-db.cjs --prepare
```

The staging path must be the actual private extraction path, not the live app.
Success returns only booleans and the test DB name. It does not print credentials.
The helper deliberately refuses non-CORPCRM01 hosts and other Unix users.

## Acceptance gates still open

| Gate | Evidence |
|---|---|
| Dedicated DB and restricted test role | Confirmed by operator; LOGIN enabled only by preparation |
| Private connection and production privilege checks | Confirmed; nonce verified, no production object privileges |
| Isolated original UI/API, authenticated private access | Local browser/API tests passed; internal startup still pending |
| Guarded worker readiness with existing Gateway preload | Not yet executed |
| One real Slovak checklist through the original UI | Not yet executed |
| Resolution after checklist acceptance | Not yet executed |
| Summary with an authorized test mailbox/message | Not yet executed |

The final report must retain actual JSON, HTTP status or explicitly unknown,
queue/Gateway/apply times, job/attempt counts and the production comparison.
Local fixture tests are never a substitute for any of these live gates.

## Isolated source, build and first internal readiness

The operator fetches a pinned commit on a separate B1 branch, not main.
`stage.cjs --stage <commit>` archives only allowed source and UI assets into
`~/INDEXUS-AI-B1/source`. It excludes .env files, dumps, uploads and unrelated
scripts. Existing source directories are never replaced automatically.

Dependencies use per-package links inside a **private node_modules directory**.
Never symlink the entire live node_modules directory: Vite writes temporary
configuration/cache files there. No npm install, live checkout switch, production
build or PM2 invocation is part of this procedure.

Before staging/building, `snapshot.cjs --baseline` records private fingerprints
of the production source HEAD, relevant configuration/build files and secret-free
AI router settings. It stats but never reads the secret Gateway file. Listener
PIDs are recorded when observable. `--compare` reports changes without exposing
configuration values. Runtime admission flags are explicitly **not inspected**;
missing PID evidence is unknown, not a claim of unchanged process continuity.

The isolated build rejects live/unapproved directories and writes paired
frontend/backend hashes. The launcher requires the pinned-source marker, matching
build hashes, private baseline and private connection. It removes inherited
environment values and loads Gateway credentials only through the existing
production runtime loader. Database identity, restricted role and environment
nonce are checked before importing application modules.

After the pinned source has been staged and the baseline captured:

```sh
cd "$HOME/INDEXUS-AI-B1/source" || exit 1
TSX=$(node -p "require.resolve('tsx/cli')") || exit 1
env -i HOME="$HOME" PATH="$PATH" NODE_ENV=production node "$TSX" script/ai-jobs-b1/build.ts || exit 1
node ops/ai-jobs-b1/launch.cjs init || exit 1
node ops/ai-jobs-b1/launch.cjs check || exit 1
node ops/ai-jobs-b1/snapshot.cjs --compare
```

Initialization accepts only a nonce-marker-only database and creates the minimal
synthetic user/task schema plus the real AI queue and isolated router settings.
Readiness checks configuration/schema only: timeout 120000 ms, concurrency 1,
only task.checklist admitted, no cloud credentials and no inference request.
Do not repeat init, rotate credentials or delete results to recover from errors.

## Later operator-only live steps

Only after reviewing internal readiness, start `launch.cjs web` and
`launch.cjs worker` as separate foreground processes in the private source
directory. No process manager is needed. Web binds **127.0.0.1:15491** only.
Use an authorized SSH tunnel and the local `/tasks` URL after login. The user is
`b1-operator`; the generated password remains in the private config and must never
be pasted into chat.

The one approved task uses:

- Title: `Doplniť chýbajúci dokument`
- Description: `Chýba potvrdenie o prevzatí. Termín doplnenia nebol dohodnutý.`
- Country SK, assigned to the synthetic operator, no contact or attachments.

The real handler saves original provider content before parsing it into
`b1_evidence`; `launch.cjs report` reports it with real queue metrics and counts.
No automatic retry is offered. Do not approve a failed language/factual check.

Stop only the two B1 foreground processes with Ctrl+C. The worker drains its
current request, with a bounded shutdown deadline; keep its console open.
Before allowing resolution, review checklist language and facts, then use the
explicit `accept-checklist --reviewed-language-and-facts` command and restart only
the B1 processes. Email summary remains disabled until a separately authorized
test mailbox and message are available; no production mailbox or Graph stub is
used as evidence.
