# Forwarded-call CEL evidence on Ubuntu

This describes the production installation procedure; it does not assert that it
has been executed on any production host.

The dedicated Asterisk `cel_custom` consumer writes
`/var/log/asterisk/cel-custom/IndexusForwarded.csv`. Its eight fields are, in
order: `eventType,eventTime,uniqueId,linkedId,channel,peer,application,extra`.
The installer retains all existing CEL consumers and unions the required events
and the `dial` application into existing settings. It refuses CEL includes,
conflicting mappings, and a nonempty `dateformat`, rather than changing another
consumer's timestamp contract.

Run as root from the repository:

```sh
scripts/mediagtw/install-forwarded-cel.sh
```

Configuration reload is deliberately opt-in:

```sh
scripts/mediagtw/install-forwarded-cel.sh --reload
```

The installer loads `cel_custom.so` if needed but never restarts Asterisk. When
`modules.conf` has `autoload=no`, first configure `load=cel_custom.so`; the
installer refuses to create a runtime-only setup. With normal module autoload,
confirm after a future maintenance restart using `asterisk -rx 'module show like
cel_custom.so'`.

It installs `/usr/local/libexec/indexus-read-forwarded-cel`, executable but
non-writable by the SSH account. The spool is mode `0640`, owned
`asterisk:asterisk`, under a mode `0750` directory. Give the existing restricted
SSH account read access with a narrowly scoped group membership or filesystem
ACL. Do not add unrestricted sudo. The remote application invokes the helper
with no shell arguments; it emits only `{"events":[...]}` JSON and fails before
emitting output if input or output limits are exceeded.

The helper reads numbered rotations (`.1`, `.2`, and their `.gz` variants),
oldest first, then the current file. Retain 14 days based on measured
volume while staying under the helper's 64 MiB retained/decompressed input,
250,000-row, and 32 MiB JSON limits. Configure Asterisk/CEL-native rotation or a
rename-and-reopen procedure. **Do not use `copytruncate`**, which can lose or
duplicate evidence. Rotation ownership and mode must remain readable by the
restricted account.

Backups for files changed by an installer run are placed under
`/var/backups/indexus-forwarded-cel`. On an installation error, only files
created or changed during that run are rolled back. A successful idempotent
rerun leaves matching configuration and helper contents unchanged.

Synthetic tests require no Asterisk process or live calls:

```sh
python3 -m unittest \
  scripts/mediagtw/test_read_forwarded_cel.py \
  scripts/mediagtw/test_install_forwarded_cel.py
```

The installer tests use an isolated fake filesystem and fake Asterisk CLI. They
verify idempotence, preflight refusal, transactional rollback, and that unrelated
dialplan/trunk configuration is untouched.

## Application deployment and audit

After reviewed changes are merged, the supported CORPCRM01 application sequence
from `replit.md` is exactly:

```sh
cd /var/www/indexus-crm && git pull origin main && npm run build && pm2 restart indexus-crm
```

The PBX installer does not change dialplan, trunks, CLI routing, or recording
policy. The CRM startup creates the new durable evidence table automatically
before starting call handling; no manual production schema push is required for
this change. The read-only aggregate audit for the durable
`queue_forwarded_calls` table is
`script/migration/audit-forwarded-call-evidence.sql`. Run it against Ubuntu's
local PostgreSQL without an inline password:

```sh
psql -X -v ON_ERROR_STOP=1 -h localhost -U indexus -d indexus_crm \
  -f script/migration/audit-forwarded-call-evidence.sql
```

The mandatory startup migration runs before route and queue initialization and
aborts startup on failure. Its automated pre-change-schema test creates only
synthetic tables in an isolated development schema, verifies repeat startup,
foreign keys and duplicate protection, then rolls the transaction back:

```sh
# Development database only; DATABASE_URL must already be securely configured.
npx tsx --test server/lib/forwarded-call-schema.test.ts
```

Enter the password interactively or use only an approved secure environment.
The table's `pbx_host` and `pbx_ssh_port` bind evidence to its configured source.
Audit output must never print credentials, phone numbers, names, channel names,
raw CEL `extra`, or row-level customer data.

NTP clock synchronization is required on both the PBX and CORPCRM01 before using
transfer-window filters. Record clock offset/status with the audit evidence; do
not interpret transfer-window results if either clock is unsynchronized.

External connectivity audit outcome on 2026-09-18: SSH was unavailable on both
external hosts. CORPCRM01 port 22 timed out with batch mode and strict known-host
verification, while an HTTPS `HEAD` request returned HTTP 200; mediagtw SSH was
also unavailable. Therefore no production handoff, deployment, production
configuration change, production database audit, or controlled call test is
claimed here.

Production handoff: the user selected execution by the server administrator.
That administrator owns the installation, deployment, database audit and
controlled-call checklist below. Local build/tests are not a substitute for
these checks. Return only aggregate audit output and pass/fail per scenario;
do not send credentials, raw CEL logs or customer data.

## Controlled proof checklist

Use only an approved synthetic test call and record minimized identifiers and
UTC timestamps—never infer answers from historical records or audio:

1. **Answered forwarding:** place one synthetic call, answer the forwarded leg,
   and prove `ANSWER`, bridge enter/exit, hangup, and linked-ID correlation.
2. **No answer:** place one synthetic call without answering and prove the
   terminal dial status without treating ringing as an answer.
3. **Busy:** deliberately return busy and prove the minimized `dialstatus` and
   terminal events.
4. **Worker restart:** restart only the application worker through the supported
   PM2 procedure during an unfinished synthetic call, then prove replay closes
   the same correlation after startup.
5. **Duplicate replay:** replay the same retained CEL set and prove no duplicate
   durable evidence or outcome is created.
6. Confirm the helper output remains the exact `{"events":[]}` interface, all
   channels/peers are hashes, and `extra` contains only approved keys.
7. Confirm no phone number, person name, raw channel, raw `extra`, or recording
   content appears in command output, application logs, audit output, or errors.

Do not use historic answer flags, call duration, bridge guesses, or recording
presence as proof of a human answer. Do not inspect audio for this audit.

Also verify in the Mission report that each synthetic call occurs exactly once,
busy/no-answer have zero talk time, and the answered call has the source answer
and end times. Repeat with an agent who has no active CRM session: call activity
must appear without inventing a shift or increasing login/work time. Repeat
with `agent_only`: canonical history must still work but this direct forwarding
path must not authorize or publish a mixed recording.