---
name: Runtime performance-index ensure
description: How to add DB indexes safely at runtime when prod deploy never runs db:push.
---

# Runtime performance-index ensure

INDEXUS prod (standard `pg`/node-postgres) deploys via git pull + build + pm2 restart and
does NOT run db:push, so new indexes are created at runtime, not in the Drizzle schema. The
established pattern (see `idx_contact_field_snapshots_lookup`) is raw
`CREATE INDEX IF NOT EXISTS` at startup. The dedicated module runs them in the BACKGROUND
after `httpServer.listen` (never blocks startup).

**Rules learned:**
- Use `CREATE INDEX CONCURRENTLY IF NOT EXISTS` so live prod writes are never locked.
- CONCURRENTLY cannot run inside a transaction and must NOT be batched with `;` in one
  multi-statement query (that becomes an implicit txn) — issue each as its own query.
- A failed concurrent build leaves an INVALID index that `IF NOT EXISTS` then skips forever;
  precede each create with a check that DROPs any invalid leftover by name.
- Self-healing: if `db:push` ever drops these (not in Drizzle schema), the next restart
  recreates them.
- **Single-process guard:** wrap the whole run in a `pg_try_advisory_lock`. Advisory locks
  AND CONCURRENTLY are both session-scoped, and pooled `pool.query` calls may hop
  connections — so acquire the lock on ONE dedicated `pool.connect()` client and run every
  index statement on that same client, then unlock + release.

**How to apply:** When asked to "speed up" queries, the biggest win is usually that hot
FK/filter columns have zero indexes (only PK on `id`). Verify real snake_case column names
via information_schema before writing index DDL.
