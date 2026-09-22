# Safe collaborator/facility deduplication

`dedupe-collaborators-facilities.cjs` is read-only by default. It uses the
standard `pg` configuration (`DATABASE_URL`, or `PGHOST`, `PGPORT`, `PGDATABASE`,
`PGUSER`, `PGPASSWORD`) and contains no credentials.

1. Review a deterministic plan:

```sh
node script/migration/dedupe-collaborators-facilities.cjs > dedupe-plan.json
```

To target the reported case without scanning the full output:

```sh
node script/migration/dedupe-collaborators-facilities.cjs \
  --only-name="Radmila Sládičeková" > dedupe-radmila-plan.json
```

The report includes the proposed canonical records, fill-only field patches,
assignment collisions, and a schema-derived inventory of references that would
need redirecting. `--apply` is intentionally disabled until the production
dry-run has been reviewed and every live reference and legacy-ID redirect has
an approved policy. No production row can be changed by this version.

Run unit tests with:

```sh
node --test script/migration/dedupe-collaborators-facilities.test.cjs
```