#!/usr/bin/env bash
###############################################################################
# normalize-junk-clinics.sh
#
# Wrapper. Spustí scripts/normalize-junk-clinics.ts, ktorý vyčistí "junk"
# záznamy v `clinics` (názov/mesto = ??? alebo prázdne):
#   1) doplní názov/mesto z napojených osôb (collaborator + work-adresa)
#   2) bezpečne zmaže orphany (žiadne väzby nikam)
#   3) zvyšok premenuje na "Neznáma ambulancia" + uloží pôvodné hodnoty do notes
#
# Použitie:
#   ./scripts/normalize-junk-clinics.sh --dry-run
#   ./scripts/normalize-junk-clinics.sh
#   ./scripts/normalize-junk-clinics.sh --no-delete       # nemaž ani orphany
#   ./scripts/normalize-junk-clinics.sh --label="Neznáma ambulancia"
#
# DOPORUČENIE: pred ostrým behom DB backup.
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f ".env" ]; then
  echo "[norm] Loading .env"
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL nie je nastavené (.env alebo systémové env)." >&2
  exit 1
fi

echo "[norm] Project root: $PROJECT_ROOT"
echo "[norm] Args: $*"
echo

npx tsx scripts/normalize-junk-clinics.ts "$@"

echo
echo "[norm] Hotovo."
