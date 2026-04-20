#!/bin/bash
# INDEXUS — Migrate clinic doctors → persons + MPN
# Spustenie na Ubuntu serveri (z koreňa projektu):
#   bash scripts/migrate-clinic-doctors.sh           # dry-run
#   bash scripts/migrate-clinic-doctors.sh --apply   # naozaj zapíše

set -e

APP_DIR="${APP_DIR:-$(pwd)}"
cd "$APP_DIR"

echo "=== INDEXUS: Migrate Clinic Doctors → Persons + MPN ==="
echo "App dir: $APP_DIR"

# Načítaj environment (DATABASE_URL atď.)
if [ -f ".env" ]; then
  echo "Načítavam .env..."
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "CHYBA: DATABASE_URL nie je nastavený. Nastav ho v .env alebo export DATABASE_URL=..."
  exit 1
fi

# Skontroluj tsx
if ! command -v npx >/dev/null 2>&1; then
  echo "CHYBA: npx nie je v PATH. Nainštaluj Node.js >= 18."
  exit 1
fi

MODE_ARG=""
if [ "${1:-}" = "--apply" ]; then
  MODE_ARG="--apply"
  echo ">>> APPLY mode: zmeny budú zapísané do databázy."
  read -r -p "Pokračovať? (y/N) " ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "Zrušené."; exit 0 ;;
  esac
else
  echo ">>> DRY-RUN mode. Pre skutočný zápis spusti:  bash scripts/migrate-clinic-doctors.sh --apply"
fi

npx tsx scripts/migrate-clinic-doctors.ts $MODE_ARG
