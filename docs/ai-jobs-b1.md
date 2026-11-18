# B1: isolated internal acceptance

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
An isolated UI/API entry and its guarded worker launch are still required.

The separate B1 entry/API/launcher have now been drafted locally. API fixture
tests verify authentication, loopback Host/origin restrictions, one synthetic
task and pending/processing/completed persistence. The selectively based client
and B1 backend build succeeded. These are not live Gateway acceptance.

Full-browser verification found that production `/tasks` redirects to
`/email?tab=tasks`, whose Omni shell hides content without a connected mailbox.
The private pilot deliberately reports disconnected/empty mailbox metadata;
it must never pretend a mailbox is connected to get past this gate. Original
standalone Tasks-page routing versus a separately authorized test mailbox
needs resolution before the UI/worker toolkit is ready for operator use.
The queue/API/resolution regression run passed 23 tests. A scoped TypeScript run
still reported diagnostics in imported dependencies; it is not a clean typecheck.

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
| Isolated original UI/API, authenticated private access | Not yet prepared |
| Guarded worker readiness with existing Gateway preload | Not yet executed |
| One real Slovak checklist through the original UI | Not yet executed |
| Resolution after checklist acceptance | Not yet executed |
| Summary with an authorized test mailbox/message | Not yet executed |

The final report must retain actual JSON, HTTP status or explicitly unknown,
queue/Gateway/apply times, job/attempt counts and the production comparison.
Local fixture tests are never a substitute for any of these live gates.
