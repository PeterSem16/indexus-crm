# Read-only production audit: call and recording customer mismatch

This audit checks the Calls & Transcripts rows visible around **09:49** and
**09:58** on **24 September 2026** (Europe/Bratislava), and summarizes the full
local day. It compares call-log/recording links, customer IDs, the last nine
digits of phone numbers, duplicate recordings, and the persisted recording
label against a customer/entity identity resolved from the call log.

It returns **aggregate counts only**. It does not print identifiers, names,
phone numbers, file paths, filenames, transcript text, or audio. It starts a
read-only transaction, sets a 15-second statement timeout and UTC session
timezone, and rolls back at the end. The report assumes the application's
legacy `timestamp` columns store UTC values.

## Run on CORPCRM01

Copy the SQL file to
`/var/www/indexus-crm/script/migration/audit-call-recording-customer-mismatch.sql`
through the normal reviewed release process. Then an authorized administrator
can copy/paste this single block into the Ubuntu console. It reads only the
`DATABASE_URL` line; the URL is never printed or sourced into the shell.

```bash
set +x
cd /var/www/indexus-crm || exit 1
if [ ! -f script/migration/audit-call-recording-customer-mismatch.sql ]; then
  echo "Audit SQL file is missing" >&2
  exit 1
fi
DATABASE_URL="$(node -e 'const fs=require("fs"); const l=fs.readFileSync(".env","utf8").split(/\r?\n/).find(x=>x.startsWith("DATABASE_URL=")); if(l){let v=l.slice(13).trim(); if((v.startsWith("\"")&&v.endsWith("\""))||(v.startsWith("\x27")&&v.endsWith("\x27")))v=v.slice(1,-1); process.stdout.write(v)}')"
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is missing" >&2
  unset DATABASE_URL
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -f script/migration/audit-call-recording-customer-mismatch.sql
audit_status=$?
unset DATABASE_URL
exit "$audit_status"
```

Return only the aggregate output and whether the command completed. Do not
paste credentials or query individual production rows. This is a diagnostic
only; it does not repair links, rename recordings, or change production data.