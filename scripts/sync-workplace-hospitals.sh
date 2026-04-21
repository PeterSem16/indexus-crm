#!/usr/bin/env bash
###############################################################################
# sync-workplace-hospitals.sh
#
# Prenesie iba nemocnice (hospitals) z "Adresa pracoviska" každej osoby.
# Clinics sa preskočia.
#
# Použitie:
#   ./scripts/sync-workplace-hospitals.sh             # ostrý beh
#   ./scripts/sync-workplace-hospitals.sh --dry-run   # iba report
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f ".env" ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL nie je nastavené (.env alebo systémové env)." >&2
  exit 1
fi

echo "[hospitals-only] Spúšťam migráciu workplace -> HOSPITALS"
echo "[hospitals-only] Args: $*"
echo

npx tsx scripts/sync-workplace-to-org.ts --only=hospitals "$@"

echo
echo "[hospitals-only] Hotovo."
