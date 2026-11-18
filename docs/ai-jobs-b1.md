# B1: isolated internal acceptance

## Current evidence

The operator created `indexus_ai_b1` on CORPCRM01 from `template0`, owned by
the equally named **NOLOGIN** role. The role is not a superuser and has neither
CREATEDB nor CREATEROLE. PUBLIC database access was revoked. No worker ran.
This proves database creation, not application readiness or AI acceptance.

The original application must **not** be started as a second test instance:
its ordinary startup also starts email monitors, automation and telephony.
An isolated UI/API entry and its guarded worker launch are still required.

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
| Dedicated DB and restricted NOLOGIN role | Confirmed by operator |
| Private connection and production privilege checks | Awaiting operator execution |
| Isolated original UI/API, authenticated private access | Not yet prepared |
| Guarded worker readiness with existing Gateway preload | Not yet executed |
| One real Slovak checklist through the original UI | Not yet executed |
| Resolution after checklist acceptance | Not yet executed |
| Summary with an authorized test mailbox/message | Not yet executed |

The final report must retain actual JSON, HTTP status or explicitly unknown,
queue/Gateway/apply times, job/attempt counts and the production comparison.
Local fixture tests are never a substitute for any of these live gates.
