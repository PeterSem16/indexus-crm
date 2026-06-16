---
name: Prod schema migrations (INDEXUS CRM)
description: How new DB columns reach the self-hosted production DB — startup ALTER block, NOT db:push.
---

# New DB columns must be mirrored into the startup migration block

When you add a column/table to `shared/schema.ts`, you MUST also add an idempotent
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` (or `CREATE TABLE IF NOT EXISTS`)
to the startup migration block in `server/index.ts` (the run of `await pool.query(...)`
calls that log `[migration] ... ensured`).

**Why:** Production is self-hosted on CORPCRM01, and the standard deploy is
`git pull && npm run build && pm2 restart indexus-crm` — this does **NOT** run
`npm run db:push`. So a schema-only change (relying on dev `db:push`) leaves the
prod DB missing the column, and the app fails at runtime with "Save error" /
"column ... does not exist". The startup migration block runs on every boot
(idempotent), so adding the column there means a normal `pm2 restart` auto-applies it.
This bit us with `is_hidden` on `campaign_status_list_items`: the column was added to
the schema + dev via db:push, but not to the startup block, so prod inserts failed.

**How to apply:** For any new column in `shared/schema.ts`, append a matching
`ADD COLUMN IF NOT EXISTS` line to `server/index.ts` startup migrations using the
snake_case DB name and the same default. Then a plain prod redeploy fixes it — no
manual db:push needed. (replit.md still mentions manual db:push as a fallback, but the
startup block is the reliable path for this user, who keeps forgetting db:push.)
