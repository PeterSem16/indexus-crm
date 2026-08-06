---
name: CORPCRM01 PostgreSQL connection format
description: Correct psql command format for running SQL scripts against the production database on CORPCRM01
---

# CORPCRM01 PostgreSQL connection

Use this exact format to run SQL files or commands against production:

```bash
PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -f <script.sql>
```

Or for inline queries:
```bash
PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -c "SELECT ..."
```

Or as a connection URL:
```bash
psql "postgresql://indexus:HanyurIfKisck@localhost:5432/indexus_crm" -c "..."
```

**Why:** psql is run locally on CORPCRM01 (not remotely from Replit). The PostgreSQL role is `indexus`, database is `indexus_crm`, host is `localhost`, port `5432`.

**How to apply:** Any time a SQL script (migration, data export, etc.) needs to be run on production, provide this exact command format with the script filename substituted in.
