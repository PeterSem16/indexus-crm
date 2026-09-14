#!/usr/bin/env bash
set -euo pipefail

# Never connect to a configured application database. Start an ephemeral cluster
# with no TCP listener and a private Unix socket, then remove it even on failure.
for binary in initdb pg_ctl; do
  command -v "$binary" >/dev/null || { echo "Required PostgreSQL binary missing: $binary" >&2; exit 1; }
done
temporary="$(mktemp -d /tmp/clone-campaign-pg.XXXXXX)"
cleanup() {
  pg_ctl -D "$temporary/data" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf "$temporary"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir "$temporary/socket"
initdb -D "$temporary/data" -U clone_test --auth=trust --no-locale -E UTF8 >"$temporary/init.log"
pg_ctl -D "$temporary/data" -l "$temporary/postgres.log" \
  -o "-F -c listen_addresses='' -k $temporary/socket" -w start >/dev/null
export CLONE_CAMPAIGN_TEST_DATABASE_URL="postgresql://clone_test@/postgres?host=$temporary/socket"
export DATABASE_URL="$CLONE_CAMPAIGN_TEST_DATABASE_URL"
npx tsx server/lib/clone-campaign.test.ts
npx tsx server/lib/clone-campaign.integration.test.ts