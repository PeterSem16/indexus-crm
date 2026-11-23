# Prepared email-summary regeneration

Preparation only: no production deployment or live inference has been performed.

## Behavior

- `GET /api/ai/jobs/:id/regeneration` reads the one child of a completed email-summary job, or returns `job: null`.
- `POST` to the same path with `{}` explicitly requests that child. The source job is never changed.
- One source job has at most one child. Replaying its POST, including concurrent requests and retries after a lost response, returns that same child even if it has already completed or failed.
- A further deliberate generation must explicitly select a completed child as its source.
- Ownership, current mailbox access and unchanged source content are rechecked on reads and writes. Creation additionally requires enabled internal summary routing.
- New jobs use the existing worker, source fingerprint, payload, language and execution limits. No model, prompt, routing, retention or retry policy is changed.
- Only the new job receives an audit-history event linking it to its source. Ordinary summary submission retains its original deduplication.

## Packaging boundary

The published Git tree does not contain the complete separately installed AI job runtime.
Do **not** publish whole workspace runtime files or the workspace branch to compensate.
The accompanying patch contains only this change, including its database-test changes.

The manifest records **workspace** preimages, not verified production hashes.
Before any separately approved deployment, identify the actual installed API runtime,
compare its sources, stage/build away from live files and preserve a private rollback.
Reject drift; do not force the patch onto a different runtime.
The four `applicationFiles` are production code; `testFiles` belong to isolated testing,
not a requirement to install test files into a production runtime.
Downloading the patch or pulling the published branch does not activate these routes.

## Verification performed

- Real PostgreSQL in an isolated development schema; synthetic users and messages only.
- Twelve concurrent requests admit exactly one child; original row stays byte-equivalent.
- GET recovery, replay after completion/failure, unchanged ordinary deduplication,
  revoked mailbox access, source changes, disabled routing and foreign ownership.
- Exact payload and language preservation for SK, CS, EN, HU, RO, IT and DE.
- Browser harness checks deployment before POST, polls only its child, compares original
  and new results, and resumes an existing child through GET without resubmitting.
- Browser tests use simulated HTTP responses. Live browser acceptance on CORPCRM01
  and factual quality of the new model output are **not** verified by these tests.

Do not run the F12 harness on production before deployment approval and verification.
Running it and confirming a new child admits one real AI generation; it sends no email.
