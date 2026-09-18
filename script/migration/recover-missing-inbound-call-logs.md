# Missing answered inbound call-log recovery

Run this only from the external Ubuntu application checkout. It repairs the historical
queue-engine defect; it is not a startup migration, endpoint, deploy hook, or new feature.
The Replit workspace cannot verify production because CORPCRM01 SSH is inaccessible.

The utility only considers `completed` rows older than the cutoff (five minutes ago by
default) with both answer/completion timestamps, an existing `users.id`, and an existing
Mission whose exact ID is persisted at `inbound_call_logs.metadata.campaignId`. It never
infers Mission from current queue membership or customer data. Missing/invalid Mission
metadata is reported as ineligible. Existing backlinks, canonical `inbound_call_log_id`,
SIP-channel matches, and ambiguous same-user/caller/time overlaps are not blanket-duplicated.

Recovered rows preserve the inbound customer, queue, persisted Mission, caller, channel,
answer/completion times, recorded talk duration, and historical `created_at` (with
`entered_queue_at` as the call start). They are generic inbound calls: no forwarding or
recording state is invented and no recording is generated.

From `/var/www/indexus-crm`, using the already-deployed dependencies (do **not** run an
install on production):

```bash
# Default is read-only and prints aggregate counts only (no phone/customer/user data).
node script/migration/recover-missing-inbound-call-logs.cjs --dry-run \
  --before 2025-01-01T00:00:00Z

# Review the counts, retain the exact same cutoff, then explicitly apply.
node script/migration/recover-missing-inbound-call-logs.cjs --apply \
  --before 2025-01-01T00:00:00Z
```

`DATABASE_URL` is taken from the environment. If absent, the script reads only the
`DATABASE_URL=` line from the checkout's `.env`; it never sources or prints the file.
Apply uses row locks, deterministic IDs, duplicate rechecks, and one transaction for each
run. Interruptions roll back the run. Use an explicit cutoff comfortably before the
queue-engine fix deployment for production recovery.

Exact dependency-free test command (Node's built-in test runner; PostgreSQL smoke test is
skipped unless `DATABASE_URL` is explicitly supplied):

```bash
node --test script/migration/recover-missing-inbound-call-logs.test.cjs
```

The optional database test creates only a temporary table inside a transaction and always
rolls it back. It does not exercise production records. Production row counts and the
actual apply remain externally operated and cannot be verified from this workspace.