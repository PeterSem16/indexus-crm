# Safe collaborator/facility deduplication

`dedupe-collaborators-facilities.cjs` is read-only by default. It uses the
standard `pg` configuration (`DATABASE_URL`, or `PGHOST`, `PGPORT`, `PGDATABASE`,
`PGUSER`, `PGPASSWORD`) and contains no credentials.

1. Review a deterministic plan:

```sh
node script/migration/dedupe-collaborators-facilities.cjs > dedupe-plan.json
```

To create a restricted executable plan, automatic candidates are included and
manual candidates must be explicitly approved by their operation ID from the
report:

```sh
node script/migration/dedupe-collaborators-facilities.cjs \
  --plan-file=/absolute/protected/path/dedupe-execution-plan.json \
  --approve-operation=<operation-id>
```

The executable plan contains unredacted fill-only values and must therefore
remain mode `0600`; it is never printed to stdout. The audit report prints its
hash. Keep the plan outside the repository and approve every manual operation
ID deliberately.

Create and verify a standalone custom-format database backup:

```sh
node script/migration/dedupe-collaborators-facilities.cjs \
  --backup \
  --backup-dir=/absolute/protected/path/dedupe-backups
```

This runs `pg_dump` for the complete configured database and verifies the dump
with `pg_restore --list`. The backup root must be an absolute directory that is
not accessible by group or others (`0700`). Dumps and manifests are `0600`.

## Deployment and apply sequence

1. Deploy the code and restart the application. Startup creates
   `dedupe_entity_aliases` and `dedupe_apply_ledger`.
2. Set `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` in the
   private shell. Do not place passwords in command history.
3. Generate the full audit report. Review every automatic candidate and copy
   only explicitly approved manual operation IDs into the plan command.
4. Write the executable plan to an absolute protected path.
5. Run apply with the exact plan hash. Apply automatically creates and verifies
   a fresh complete backup before opening the writable transaction.

Example:

```sh
mkdir -p /var/backups/indexus-crm/dedupe
chmod 700 /var/backups/indexus-crm/dedupe

node script/migration/dedupe-collaborators-facilities.cjs \
  > /var/backups/indexus-crm/dedupe/audit-report.json

node script/migration/dedupe-collaborators-facilities.cjs \
  --plan-file=/var/backups/indexus-crm/dedupe/execution-plan.json \
  --approve-operation=<reviewed-manual-operation-id>

# Read executionPlanHash from the audit output produced above, then:
node script/migration/dedupe-collaborators-facilities.cjs \
  --apply \
  --plan-file=/var/backups/indexus-crm/dedupe/execution-plan.json \
  --plan-hash=<execution-plan-hash> \
  --confirm=DEDUPLICATE_NO_DELETE:<execution-plan-hash> \
  --backup-dir=/var/backups/indexus-crm/dedupe
```

Apply refuses to run when the plan file is not `0600`, the hash/confirmation
does not match, support tables are missing, database identity changed, any
source fingerprint changed, or any reference count differs from the reviewed
plan. It uses one `SERIALIZABLE` transaction, never deletes rows, preserves
audit/history references, records durable legacy aliases, and writes an
idempotency ledger entry. The same plan hash cannot be applied twice.

The result prints the verified backup manifest path. To restore, stop the
application first, set the target database variables privately, verify the
manifest checksum, and use its `restoreCommandTemplate`. Prefer restoring into
a separate recovery database first. Never run `--clean` against the live
database while the application is connected.

The ISCBC synchronizer now requires `PGPASSWORD` and `CBC_DB_PASSWORD` from the
environment (or an equivalent secret manager); credentials are not stored in
`script/migration/sync-collaborators-iscbc.cjs`. It resolves `iscbc` legacy
aliases through `dedupe_entity_aliases` before direct `legacy_id` lookup.

To target the reported case without scanning the full output:

```sh
read -s -p "PostgreSQL password: " PGPASSWORD && echo
export PGPASSWORD
node script/migration/dedupe-collaborators-facilities.cjs \
  --only-name="Radmila Sládičeková" > dedupe-radmila-plan.json
unset PGPASSWORD
```

When `DATABASE_URL` is not set, the script defaults to the local production
database (`localhost:5432`, database `indexus_crm`, user `indexus`). The hidden
`read -s` prompt keeps the password out of shell history and the JSON report.

The report includes the proposed canonical records, fill-only field patches,
assignment collisions, and a schema-derived inventory of references that would
need redirecting. Dry-run remains the default and never changes a row.

When `--only-name` is supplied, `inspectionMatches` also lists matching active
people and facilities even when differences in name or location prevent them
from becoming a strict deduplication candidate.

Run unit tests with:

```sh
node --test script/migration/dedupe-collaborators-facilities.test.cjs
```