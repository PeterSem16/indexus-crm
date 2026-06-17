---
name: Prod deploy skips npm install
description: Why adding a new npm dependency can break INDEXUS production.
---

# Prod deploy skips npm install

The documented INDEXUS production deploy (replit.md) is:
`git pull origin main && npm run build && pm2 restart indexus-crm` — it does NOT
run `npm install`.

**Consequence:** Adding a NEW npm dependency will break the prod build/runtime
because the server's `node_modules` won't contain it. `npm run build` (esbuild/vite)
resolves imports from `node_modules`, so a missing package fails the build, and
runtime-external packages fail at import.

**How to apply:** Prefer Node built-ins over small npm helpers in server code. Example
from the perf work: implemented HTTP gzip with the built-in `zlib` module instead of
the `compression` package, so no dependency install is needed on deploy. If a new
dependency is genuinely required, explicitly tell the user to run `npm install` on the
server for that release (same spirit as the existing `db:push`-after-schema-change note).
