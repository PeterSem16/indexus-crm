#!/usr/bin/env bash
###############################################################################
# sync-workplace-to-org.sh
#
# Wrapper pre Ubuntu / Debian server. Spustí TypeScript migračný skript
# scripts/sync-workplace-to-org.ts, ktorý prenesie "Adresa pracoviska" každej
# osoby do tabuľky `hospitals` (ak názov obsahuje "nemocnic") alebo `clinics`
# (ostatné) a zároveň prepojí osobu s daným záznamom.
#
# Použitie:
#   ./scripts/sync-workplace-to-org.sh             # ostrý beh
#   ./scripts/sync-workplace-to-org.sh --dry-run   # iba report, bez zmien
#
# Predpoklady:
#   - npm a node sú nainštalované (>= node 18)
#   - .env (alebo system env) obsahuje DATABASE_URL
#   - sme v rootovi projektu (alebo skript sa spúšťa cez svoju cestu)
###############################################################################

set -euo pipefail

# Cesta k projektu = parent priečinok tohto skriptu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Načítanie .env ak existuje (kvôli DATABASE_URL)
if [ -f ".env" ]; then
  echo "[sync] Loading .env"
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL nie je nastavené (.env alebo systémové env)." >&2
  exit 1
fi

# Kontrola tsx
if ! npx --no-install tsx --version >/dev/null 2>&1; then
  echo "[sync] tsx nie je nainštalovaný — pridávam dočasne cez npx..."
fi

echo "[sync] Project root: $PROJECT_ROOT"
echo "[sync] Spúšťam migráciu workplace -> hospitals/clinics"
echo "[sync] Args: $*"
echo

npx tsx scripts/sync-workplace-to-org.ts "$@"

echo
echo "[sync] Hotovo."
