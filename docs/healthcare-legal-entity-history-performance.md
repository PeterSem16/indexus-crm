# OR SR directory history performance

## Approach

The directory no longer aggregates every normalized snapshot into a JSON array
and runs the history diff over it in Node. It stores a separate, versioned
comparison key for each immutable snapshot. The key contains the exact normalized
public fields and sorted public role signatures used by the history diff,
including repeated roles. It is canonical text rather than a probabilistic hash.
Private role keys, source-only fields, and raw responses do not affect equality.

New verifications save their key in the same transaction as the snapshot.
Existing snapshots and obsolete key versions are filled on demand through a
PostgreSQL cursor, at most 128 rows per fetch. A failed backfill rolls back and
can be retried; concurrent backfills converge through deterministic upserts.
There is no source-row mutation and no new dependency.

Warm requests only scan compact derived facts in SQL. `lag` determines the
predecessor using `(checked_at, created_at, id)` for each entity. Reviews are
joined live, so a committed review lowers the count on the next request, without
cache invalidation or a background refresh. Late historical insertions also
recompute adjacency correctly. Existing route authorization runs before any
backfill or overview query.

This is not a constant-time counter: database work remains linear in historical
comparison facts. Cold backfill work is linear in source size, but normalized
snapshot memory in Node is bounded by one batch rather than total history size.
The first authorized read after migration or a semantic version change pays that
one-time backfill cost. Source and derived facts are private database data, not
part of the directory response.

## Reproducible regression

Run in development only:

```sh
npx tsx --test shared/healthcare-legal-entity-diff.test.ts \
  shared/healthcare-legal-entity-comparison-document.test.ts \
  server/lib/healthcare-legal-entity.test.ts
```

The real PostgreSQL/API suite inserts and cleans up 6,000 legacy snapshots with
4 KiB source-only normalized fields. It exercises duplicate roles, role removals,
unchanged snapshots, both timestamp tie breakers, private fields, obsolete
projection versions, concurrent backfills, late historical insertion, reader
permissions, and idempotent review of a specific old snapshot. It checks exact
parity with the original history algorithm, maximum fetched rows/bytes, and zero
normalized rows fetched on a warm backfill.

Observed development runs:

| Measurement | Result |
| --- | --- |
| Original aggregate plus public diff | 547–658 ms |
| One-time bounded key backfill | 508–2,256 ms |
| Warm authenticated directory request | 39–46 ms |
| Original normalized history JSON | 28,618,130 bytes |
| Largest fetched batch | 128 rows / 596,925 bytes |
| Normalized snapshots fetched on warm reads | 0 |

Timings include shared-development-machine variability and are diagnostics, not
flaky CI thresholds. Bytes measure serialized result sizes, not peak heap/RSS.
The original timing covers only aggregate plus diff; warm timing additionally
includes HTTP, authorization, and list formatting. The suite enforces parity and
bounded batches rather than asserting a machine-specific latency.

When changing public diff semantics, bump `REGISTRY_COMPARISON_KEY_VERSION`.
Keep the key canonicalization shared with the actual diff; do not store pending
status or predecessor identity in the projection.
