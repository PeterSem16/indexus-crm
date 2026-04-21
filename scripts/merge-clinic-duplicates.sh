#!/usr/bin/env bash
###############################################################################
# merge-clinic-duplicates.sh
#
# Wrapper pre Ubuntu / Debian server. Spustí scripts/merge-clinic-duplicates.ts,
# ktorý zlúči duplicitné kliniky podľa normalizovaného (názov + mesto + krajina),
# prenesie chýbajúce údaje do "winnera" a presmeruje všetky referencie
# (collaborators, contact_assignments, clinic_referrals, clinic_events,
# hospital_network_members, campaign_contacts), potom loser záznamy zmaže.
#
# Použitie:
#   ./scripts/merge-clinic-duplicates.sh --dry-run                # report
#   ./scripts/merge-clinic-duplicates.sh                          # ostro
#   ./scripts/merge-clinic-duplicates.sh --only="gynosan"         # iba dané
#   ./scripts/merge-clinic-duplicates.sh --min-group=3            # iba >=3
#
# DOPORUČENIE: pred ostrým behom si sprav DB backup!
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f ".env" ]; then
  echo "[merge] Loading .env"
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL nie je nastavené (.env alebo systémové env)." >&2
  exit 1
fi

echo "[merge] Project root: $PROJECT_ROOT"
echo "[merge] Args: $*"
echo

npx tsx scripts/merge-clinic-duplicates.ts "$@"

echo
echo "[merge] Hotovo."
