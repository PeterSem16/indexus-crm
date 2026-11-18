#!/usr/bin/env bash
# Private Unix-socket-only PostgreSQL cluster. No inherited database is used.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "$(hostname -s | tr '[:lower:]' '[:upper:]')" != CORPCRM01 ]] || {
  echo "Refusing isolated test on production CORPCRM01" >&2; exit 2;
}
for tool in initdb pg_ctl createdb; do
  command -v "$tool" >/dev/null || { echo "Missing existing tool: $tool" >&2; exit 2; }
done
umask 077
mkdir -p generated-artifacts
work=$(mktemp -d "$PWD/generated-artifacts/email-notes-crm.XXXXXX")
mkdir "$work/socket"
cleanup() {
  pg_ctl -D "$work/pgdata" -m fast -w stop >> "$work/postgres.log" 2>&1 || true
  # Only this run's private generated cluster; never touch the application's DB.
  if [[ "$work" == "$PWD"/generated-artifacts/email-notes-crm.* ]]; then
    rm -rf "$work/pgdata" "$work/socket"
  fi
}
trap cleanup EXIT
echo "Building current UI in generated-artifacts, never in the live dist directory."
NODE_ENV=production node_modules/.bin/vite build \
  --outDir "$PWD/generated-artifacts/email-notes-crm-ui/public" --emptyOutDir > "$work/frontend-build.log" 2>&1
initdb -D "$work/pgdata" -U notes_acceptance --auth-local=trust --auth-host=reject > "$work/initdb.log" 2>&1
pg_ctl -D "$work/pgdata" -l "$work/postgres.log" \
  -o "-k $work/socket -p 55439 -c listen_addresses='' -c unix_socket_permissions=0700" -w start
database="indexus_email_notes_test_$(basename "$work" | tr -cd 'a-z0-9_')"
createdb -h "$work/socket" -p 55439 -U notes_acceptance "$database"
export DATABASE_URL="postgresql://notes_acceptance@localhost/$database?host=$work/socket&port=55439"
export NODE_ENV=test EMAIL_NOTES_TEMP_DB_TEST=1 EMAIL_NOTES_ACCEPTANCE_ROOT="$work"
echo "Private PostgreSQL database prepared; TCP disabled; production not connected."
node_modules/.bin/tsx --test server/lib/email-note-jobs.db.test.ts
node_modules/.bin/tsx script/test-email-notes-crm.ts
