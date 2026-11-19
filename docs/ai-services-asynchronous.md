# Asynchronous internal AI services in Configuration

## Scope

The existing **Configuration → AI control** (`/configurator`, AI tab) is the
control surface. There is no additional test application or test login.

All 50 services currently marked `internalEligible` use the shared persistent
inference queue when their saved provider is internal. OpenAI requests keep their
original path. Unsupported audio, speech, Responses and incompatible image/schema
services remain unavailable for internal selection; no capability is invented.
The catalogue and the server-side capability policy remain authoritative.

The routing decision reloads saved settings at each request, including for
clients constructed before the edit. Internal provider selection automatically
selects background processing. The three legacy pilot flags are no longer a
required second configuration step. A server `legacy` router mode remains an
explicit rollback boundary.

## Execution and UI behavior

The AI tab shows the execution mode of each service, its service-scoped model
choices, and live worker availability. Saving an active internal route is refused
when no worker heartbeat is current. Existing runtime, admin, same-origin, fresh
smoke verification, model and optimistic-version checks still apply. Viewing
settings does not start an AI call. No provider is changed by installation.

Generic text calls use `ai_inference_jobs`; task checklists, private resolution
drafts and private email summaries retain their existing entity-aware `ai_jobs`
flows and visible pending/processing/completed/failed states. Both queues share
one PostgreSQL admission lock and one active inference slot. The worker alternates
between queues so one queue does not permanently starve the other.

The general queue is below the provider SDK interface: callers still receive the
same completion object, `asResponse()` and `withResponse()` contracts. Existing
forms may continue showing their original loading indicator while awaiting that
result. This does **not** claim that every existing HTTP endpoint now returns
202, or that every feature has acquired a new job-history screen.

Closing an observing screen does not delete or cancel queued inference. An
aborted observer stops waiting, but cannot restart or automatically resend work.
The raw completion is durably stored. Arbitrary raw requests/results are not
exposed through a public job endpoint. Source-record authorization and applying
results remain in their original feature paths.

The worker uses the internal adapter directly after checking the current
provider/model. A queued request whose route/model changed fails explicitly,
instead of silently calling OpenAI or another model. Lease loss, abort, timeout,
invalid output and known manual-review outcomes remain distinct. There are no
automatic inference retries. The queue stores no provider credential or HTTP
authorization header; the original prompts, response validators and supported
service profiles stay in place.

## Runtime and migration

The additive startup migration creates `ai_inference_jobs` and
`ai_inference_workers` alongside the existing queue. It drops no data and does
not seed or replace provider settings. The standalone `server/ai-worker.ts`,
built as `dist/ai-worker.cjs`, consumes both queues. Readiness checks read both
schemas and validate both unique processing indexes without starting inference.

Start only through the application's authorized runtime environment and existing
Gateway loader. The existing commands remain:

```
npm run ai-worker:check
npm run ai-worker
```

Configuration reports an offline worker rather than claiming a saved route is
operational. A missed heartbeat expires after 30 seconds. Shutdown stops admission
and allows the current bounded request to finish. Queued/result records are
retained; no retention deletion or automatic replay is introduced.

Production installation, worker startup, and changing saved providers are
separate operations requiring approval. None is performed by the tests below.

## Relevant tests

Run queue suites serially: the cross-process PostgreSQL execution lock is
intentionally shared, even between isolated test schemas.

```
npx tsx --test --test-concurrency=1 \
  server/lib/ai-jobs/inference.test.ts \
  server/lib/ai-jobs/inference.db.test.ts \
  server/lib/ai-jobs/jobs.test.ts \
  server/lib/ai-jobs/jobs.db.test.ts \
  server/lib/ai/settings.test.ts \
  server/lib/ai/settings-routes.db.test.ts
node script/test-ai-settings-ui.cjs
```

The universal integration test uses a real isolated PostgreSQL schema, the real
admin router, queue, worker, internal SDK adapter, discovery validation and
completion validation for each of the 50 switchable services. Only the Gateway
transport supplies synthetic responses: no production data, mailbox, token,
Gateway request or live model inference is used.

The browser test renders the real Configuration component and verifies provider
save/confirmation, execution labels, worker-offline blocking, returning to
OpenAI while offline, preservation of edits, and small/dark layouts.

These tests prove application wiring, persistence and failure behavior, not the
quality, latency or availability of actual internal models. Signed-in production
UI and real Gateway inference must not be described as verified by these tests.
