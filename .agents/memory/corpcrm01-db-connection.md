---
name: CORPCRM01 PostgreSQL connection format
description: Correct psql command format for running SQL scripts against the production database on CORPCRM01
---

# CORPCRM01 PostgreSQL connection

Use this exact format to run SQL files or commands against production:

```bash
psql -h localhost -U postgres -d indexus -W -f <script.sql>
```

Or for inline queries:
```bash
psql -h localhost -U postgres -d indexus -W -c "SELECT ..."
```

Or as a connection URL:
```bash
psql "postgresql://postgres:<password>@localhost:5432/indexus" -c "..."
```

**Why:** psql is run locally on CORPCRM01 (not remotely from Replit). The PostgreSQL role is `postgres`, database is `indexus`, host is `localhost`, port `5432`. The password is intentionally not stored here.

**How to apply:** Any time a SQL script (migration, data export, etc.) needs to be run on production, provide this exact command format with the script filename substituted in.
