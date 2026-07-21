---
name: ISCBC collaborator sync
description: Re-syncing collaborators/agreements from legacy ISCBC MSSQL into prod PG
---

- MSSQL connection: server 10.1.2.2:1433, **database `CBC`** (NOT `ISCBC`, no `instanceName`) — using `ISCBC` gives "Login failed for user 'cbcuser'". Mirror the config from `script/migration/test-migration-20.cjs`.
- **Why:** ISCBC holds ~30k collaborators but only ~16k are `doc_active = 1`; earlier migrations only imported collection-linked ones. Always filter `doc_active = 1` for re-syncs, else you import thousands of dead/technical records ("N/A N/A", call-center placeholders).
- **How to apply:** run `script/migration/sync-collaborators-iscbc.cjs` on CORPCRM01 (dry-run default, `--commit` to write); needs one-off `npm install mssql --no-save` (prod deploy never runs npm install). Verify with `scripts/verify_collaborators_prod.sql`.
- Agreements of inactive collaborators are skipped automatically (no matching collaborator in PG).
- July 2026 run: +5246 collaborators, +9931 agreements; Excel verification went 325 missing → 0.
