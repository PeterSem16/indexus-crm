---
name: Ubuntu PostgreSQL CSV exports
description: Reliable psql CSV export pattern for production Ubuntu scripts
---

For multiline exports, use `psql --csv -f - > output.csv` rather than a multiline `\copy`; the latter can fail with a parse error in the installed psql client. `--csv` emits the header automatically.

**Why:** The Ubuntu psql version accepts `--csv` but not a separate `--header` option, and multiline `\copy` parsing is fragile.

**How to apply:** Read `DATABASE_URL` safely from the production app `.env`, never print it, pass SQL through stdin, and build collaborator column lists from `information_schema` when excluding credential fields such as password hashes.