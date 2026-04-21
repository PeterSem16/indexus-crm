#!/usr/bin/env bash
###############################################################################
# backfill-personnel-from-links.sh
#
# Wrapper pre Ubuntu / Debian server. Spustí TypeScript backfill skript
# scripts/backfill-personnel-from-links.ts, ktorý pre každého collaboratora
# s vyplneným clinicId / clinicIds[] / hospitalId / hospitalIds[] dotvorí
# chýbajúci záznam v `contact_assignments` (= panel "Personnel" v UI).
#
# Použitie:
#   ./scripts/backfill-personnel-from-links.sh             # ostrý beh
#   ./scripts/backfill-personnel-from-links.sh --dry-run   # iba report
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f ".env" ]; then
  echo "[backfill] Loading .env"
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL nie je nastavené (.env alebo systémové env)." >&2
  exit 1
fi

echo "[backfill] Project root: $PROJECT_ROOT"
echo "[backfill] Args: $*"
echo

npx tsx scripts/backfill-personnel-from-links.ts "$@"

echo
echo "[backfill] Hotovo."
