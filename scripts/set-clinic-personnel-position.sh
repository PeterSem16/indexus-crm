#!/usr/bin/env bash
###############################################################################
# set-clinic-personnel-position.sh
#
# Wrapper. Pre všetky osoby v personnel KLINÍK nastaví:
#   - contact_assignments.position           = "Private gynecologist"
#   - collaborators.professional_classification = "Private gynecologist"
#
# Použitie:
#   ./scripts/set-clinic-personnel-position.sh --dry-run
#   ./scripts/set-clinic-personnel-position.sh
#   ./scripts/set-clinic-personnel-position.sh --position="Iný text"
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f ".env" ]; then
  echo "[set-pos] Loading .env"
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL nie je nastavené (.env alebo systémové env)." >&2
  exit 1
fi

echo "[set-pos] Project root: $PROJECT_ROOT"
echo "[set-pos] Args: $*"
echo

npx tsx scripts/set-clinic-personnel-position.ts "$@"

echo
echo "[set-pos] Hotovo."
