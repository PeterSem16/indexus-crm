---
name: CORPCRM01 PostgreSQL connection format
description: Correct psql command format for running SQL scripts against the production database on CORPCRM01
---

# CORPCRM01 PostgreSQL connection

Use the application's `DATABASE_URL` from `/var/www/indexus-crm/.env`; do not hardcode or guess the PostgreSQL role, database, or password. Read only that line rather than sourcing the whole file:

```bash
cd /var/www/indexus-crm
DATABASE_URL="$(node -e 'const fs=require("fs"); const l=fs.readFileSync(".env","utf8").split(/\r?\n/).find(x=>x.startsWith("DATABASE_URL=")); if(l){let v=l.slice(13).trim(); if((v.startsWith("\"")&&v.endsWith("\""))||(v.startsWith("\x27")&&v.endsWith("\x27")))v=v.slice(1,-1); process.stdout.write(v)}')"
psql "$DATABASE_URL" -f <script.sql>
unset DATABASE_URL
```

Or for inline queries:
```bash
psql "$DATABASE_URL" -c "SELECT ..."
```

**Why:** psql is run locally on CORPCRM01, and direct credentials previously supplied for the `postgres` role failed authentication. The running app's `DATABASE_URL` is authoritative. Sourcing the whole `.env` is unsafe because unrelated values can contain shell metacharacters. The password is intentionally not stored here.

**How to apply:** Use the extraction command immediately before production `psql` commands and `unset DATABASE_URL` afterward. Never print the variable or paste its value into chat.
