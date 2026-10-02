# INDEXUS consolidation — reviewed Git production release

## Intended result

One isolated release branch contains the completed application changes, retained
production hotfixes, and the completed standalone Automation module with native
INDEXUS styling. Nexus Pulse/Status List retains its published behavior.
Publication and production activation are separate steps. Only the verified
release tree may be published; the operator first prepares a build without
changing the serving application, then activates in a no-call maintenance window.

## Automation boundary

- The standalone Automation engine/API retain the full completed, prepared
  feature scope, including service-based rules, AI-assisted drafts, scheduling,
  alerts, source-specific events and execution history.
- Status List confirmations execute their original Mission-owned inline actions,
  not the experimental engine-ownership/cutover path.
- Automation Rules/Runs and their editor retain the completed module functionality.
  Appearance follows the real Tasks theme and modal patterns.
- The Nexus Pulse/Status List engine-ownership cutover and Status List draft
  integration are not part of the release. The standalone module must not be
  reduced to its older published version as part of a visual redesign.
- Current Tasks recipient/resolver authorization remains enforced centrally.
- Existing rules and business data are not deleted. Previously added, unused
  database columns/tables are not dropped as part of the code consolidation.

## Retained work

Completed Tasks/Omni functionality and recipient/group settings remain included.
Production-only Queue fixes remain included: bounded incremental rendering,
isolated dialog state, deferred reschedule calendar, and batched contact lookup.
Production reward-badge and collaborator-wizard changes remain preserved.

## Preparing a local candidate

The earlier candidate containing the old published Automation scope is obsolete.
Use the newly verified candidate reflecting the corrected standalone module scope.

`script/prepare-consolidated-release.cjs` starts a separate local worktree from a
reviewed GitHub base, copies the application-source changes, checks copied hashes,
and creates one local commit. It does not push or deploy.

The candidate must be built and tested in its own worktree. Browser fixtures must
import that worktree's actual components. A passing build of development main is
not sufficient verification of the release.

The release excludes source snapshot archives, `.env`, live data, uploaded
documents, design sandboxes, generated builds, and agent-memory updates.

## Before any future production pull

Production currently has uncommitted source modifications and untracked source
files. Do not run a blind `git pull`, `git reset --hard`, or `git clean`.

When publication is explicitly approved:

1. Recheck GitHub's current base and compare it with the candidate parent.
2. Recheck production source hashes against a fresh verified snapshot. Stop if
   production changed; reconcile those changes before continuing.
3. Keep a private backup of the current source and its Git state. Do not add
   `.env`, uploads, business data, or runtime configuration to Git.
4. Review the final production-to-release source difference and safely reconcile
   only those tracked/untracked source files that the release replaces.
5. Only then publish the reviewed commit and perform the agreed production pull,
   dependency/build checks, and controlled application restart.

## Verified production boundary and return path

The operator's backup fingerprint matches all 87 reconstructed production source
files exactly. Six additional files are browser tests and one payroll utility,
not additional application hotfixes. Three older browser-test versions differ
from the release and remain recoverable in the private backup and safety stash.

The original production checklist-column repair is retained. Standalone
Automation startup ensures all four required workflow tables, scheduling columns
and recipient-access configuration before routes; failure stops startup.
These additions neither remove records nor switch Status List ownership.
Dependency declarations and the lockfile are unchanged from production.

Use the checksum-pinned operator guide. Preparation checks the private backup,
reviewed commit/tree/scope, source/config fingerprints and PM2 identity, then
builds in staging against existing dependencies. No npm install or db:push runs.
Activation alone reconciles the approved dirty source paths, pulls the pinned
commit, switches the built distribution and restarts the one application.

Rollback restores the backup's source, Git state, original distribution and
dependencies while retaining current runtime uploads/data and configuration.
It does not restore the old database. Additive schema remains; new business
records are not erased. HTTP root/API probes verify serving/routing, not a full
database or authenticated-feature health check.

Recovery-tool availability is checked before preparation/activation or stopping
the service. Restart health polls have a bounded readiness wait, including PM2
startup state; they still require HTTP 200 at `/` and JSON 401 Unauthorized at
`/api/users`. Original source and build fingerprints must match before a restored
service is restarted.

Web snapshots and recovery exclude the independent `mobile-app` tree and protect
private task-document buckets at any depth, including in older archives.
Command failures retain phase, exit status and bounded stderr in private 0600
operator JSON logs; never paste these potentially sensitive logs into chat.

After a recovery restart, take a fresh backup and prepare again: the earlier
backup/preparation is tied to the former PM2 process identity. Do not reuse it
for activation. A reviewed follow-up release may pin an explicit `parent` in
its private manifest; `base` remains the original full-scope comparison point.
Legacy manifests without `parent` require `base` as the direct parent.