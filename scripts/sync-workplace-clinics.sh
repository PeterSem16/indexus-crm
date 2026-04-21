#!/usr/bin/env bash
###############################################################################
# sync-workplace-clinics.sh
#
# Prenesie iba ambulancie (clinics) z "Adresa pracoviska" každej osoby.
# Hospitals sa preskočia.
#
# Použitie:
#   ./scripts/sync-workplace-clinics.sh             # ostrý beh
#   ./scripts/sync-workplace-clinics.sh --dry-run   # iba report
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

echo "[clinics-only] Spúšťam migráciu workplace -> CLINICS"
echo "[clinics-only] Args: $*"
echo

npx tsx scripts/sync-workplace-to-org.ts --only=clinics "$@"

echo
echo "[clinics-only] Hotovo."
