# Persistent AI jobs: controlled pilot

The user-facing integration is now described in
[Asynchronous internal AI services](ai-services-asynchronous.md).
That document supersedes the three-service-only scope and flag-only activation
instructions below. The original entity-aware safeguards and result contracts
remain applicable.

## Status and boundaries

This implements a queue, not an approved production rollout or a model-quality fix.
The three admission flags default **off**. No worker was added to the web
workflow, no production configuration was changed, and monitoring was not paused.
Pending jobs require the separately started worker.

| Flag | Service |
|---|---|
| `AI_JOBS_TASK_CHECKLIST_ENABLED` | `task.checklist` |
| `AI_JOBS_TASK_RESOLUTION_ENABLED` | `task.resolution` |
| `AI_JOBS_EMAIL_SUMMARY_ENABLED` | `email.summary` |

The server-only `AI_JOBS_GATEWAY_TIMEOUT_MS` defaults to `120000`, with a valid
range of `1000..120000`. The process-local background capability applies only
to the matching pilot service. Original synchronous task requests remain
limited to 15 seconds; monitoring and all other services keep their policies.
No new dependency, API token, provider, Gateway server or cloud fallback is used.

## Process and schema

The existing application startup applies the additive, idempotent schema from
`server/lib/ai-jobs/schema-migration.ts`. It preserves existing checklist tables
and adds their nullable job link. Do not use a destructive `db:push`.

Development/test commands:

```sh
npm run ai-worker:check
npm run ai-worker
```

Build emits both `dist/index.cjs` and `dist/ai-worker.cjs`. On the authorized
test host, use the **existing** runtime/preload and environment used by the web
process, including its existing Gateway authentication:

```sh
node dist/ai-worker.cjs --check
node dist/ai-worker.cjs --run
```

The check command only reads schema and Router configuration. It neither starts
polling nor calls the Gateway. The worker refuses a missing/invalid global-slot
index, incomplete schema or unavailable Router configuration. It never seeds
Router settings or performs schema migrations.

Before using a process manager, allow at least 150 seconds for graceful shutdown
at the default budget. SIGTERM/SIGINT stop admission and allow the current job
to finish; a bounded shutdown deadline prevents a permanently stuck process.
The lease is the configured job deadline plus 60 seconds, renewed every 10 seconds.

One partial unique index and a short PostgreSQL admission lock enforce one
`processing` job across worker processes. The inference runs outside a DB
transaction. A fenced transaction commits the result and checklist insertions
together. Private drafts and summaries have no automatic business-side effect.

## API and authorization

- `POST /api/ai/jobs` accepts only `service`, `entityType`, `entityId`, optional
  `locale` and `mailbox`, and returns `202 { jobId, job }`.
- `GET /api/ai/jobs/:id` returns an authorized safe view, not the raw input,
  owner credentials, claim token or provider error.
- `GET /api/ai/jobs` filters by service, entity, mailbox, locale and limit
  (`1..50`). No unauthorized totals are returned.
- `POST /api/ai/jobs/:id/retry` accepts an empty object and explicitly queues a
  failed job, subject to authorization and the three-claim maximum.

The task country, groups, source contents, completion evidence and active
principal are rechecked. Resolution drafts and email summaries are private to
the requester, even from another manager. Shared checklist retry requires
current task access and records the new requester.

The server reads the actual Graph message; client-supplied subjects/bodies are
not an access grant. Mailboxes support `personal`, an authorized shared address,
and `system:SK`-style country selectors for the existing privileged system-source
roles. System selection rechecks the current account and its actual address.
Normal users/managers do not gain system-mail access. Graph reads never mark a
message read, modify it or send a reply. Tokens never enter job payloads.

The original three UI entry points retain their synchronous mode when their
flag is off. Checklist generation also covers storage, Status List and automation
callers. A linked asynchronous checklist cannot fall into the legacy path after
a flag is turned off.

UI polling runs about every five seconds for active jobs. Closing a screen stops
the observer, not the durable job. Reopening resolves existing jobs read-only;
record/user/mailbox/language changes separate results. Manual resolution edits
win over late AI drafts. Summary results open only on an explicit user action.
The four states and continuation hint have all seven application translations.

## Failure and recovery

There are **no automatic inference retries**. SDK retries are zero.
An expired processing lease becomes `worker_lost_outcome_unknown`; timeout,
transport failure, HTTP rejection, invalid output and source changes remain
separate safe codes. HTTP 503 alone is not proof of validator rejection.
Without upstream idempotency this does not promise exactly-once inference.

An explicit retry uses the same durable job, preserves attempt history and prior
metrics, rechecks source access/fingerprint, and cannot exceed three claims.
A delayed old worker cannot commit after losing its fenced claim. Manually
created checklist steps are preserved.

Safe job metrics include queue time, elapsed Gateway-client call time, apply
time, received HTTP status and a sanitized request ID when available. Unknown
HTTP statuses/IDs stay null. Gateway-client time includes readiness/contract
checks, not just model execution. These numbers do not measure GPU utilization
or prove isolation from monitoring.

## Verification and staged acceptance

Controlled development verification:

```sh
npx tsx --test server/lib/ai-jobs/jobs.test.ts server/lib/ai-jobs/jobs.db.test.ts
npx tsx --test server/lib/task-ai-checklist.test.ts server/lib/task-resolution-draft.test.ts server/lib/task-resolution-draft-route.test.ts server/lib/ai/internal-adapter.test.ts server/lib/ai/three-services.test.ts
node script/test-task-resolution-dialog-browser.cjs
node script/test-ai-summary-job-browser.cjs
npm run build
```

The DB test creates and removes only its own random development schema. It is
guarded against running on CORPCRM01. Browser fixtures render real components
with synthetic inputs; they are not signed-in production-session tests.

Recorded local result: 87 AI/queue regression checks passed, both component
browser suites passed, the web/worker build passed, and source/bundled worker
readiness checks passed without starting a worker. The running application
started cleanly with the additive schema; anonymous job API access returned 401.
The screenshot verified the login page, not the authenticated application.

Scoped TypeScript diagnostics contain no errors in the new queue/worker modules,
but the transitive application check is not green: it reports existing issues in
older storage/automation and session declarations. These unrelated modules were
not broadly refactored for this pilot.

**Live internal acceptance remains separate.** Replit cannot access the internal
Gateway through the authorized CORPCRM01 runtime. Passing fixtures must never
be reported as a real model response, correct Slovak, factual relevance or a
successful 120-second end-to-end deployment.

An authorized operator must use an isolated test DB/process, the original
synthetic corpus in `script/ai-three-services/`, unchanged approved aliases and
prompts, and stage checklist → resolution → summary. Capture job and attempt
counts, queue/Gateway/apply timings, safe errors, and actual unedited responses.
Review the Slovak checklist for 3–5 relevant steps and no invented people or
recipients before advancing. Bad language/factuality is a failed acceptance,
not permission for hidden translation or regeneration.

Compare the Gateway, proxy and model-server budgets with the 120-second worker
budget through approved access; request separate AI-team changes if a layer is
shorter. Do not change Gateway/proxy/Ollama settings automatically.

## Rollback and production approval

Production deployment and activation require separate approval after acceptance.
Stop new asynchronous admission with the three flags, but retain and drain or
reconcile existing jobs before removing this code or returning fully to legacy
execution. Do not delete queue history/payloads, unlink active checklist claims,
or start a parallel legacy generation. Stop the worker gracefully after draining.
Existing schema/history can remain in place.

No retention deletion is enabled. Retention policy and real shared-backend
capacity/monitoring-impact measurements require separate decisions.
