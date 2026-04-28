#!/usr/bin/env bash
# Spúšťa READ-ONLY mapping/comparison report.
# Funguje rovnako na Replit aj na Ubuntu serveri.
#
# Použitie:
#   ./scripts/import-clinics-mapping.sh
#   ./scripts/import-clinics-mapping.sh --csv=attached_assets/iny_subor.csv --samples=10
#
# Pre Ubuntu nezabudni: export DATABASE_URL=postgres://...

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "✗ DATABASE_URL nie je nastavený. Na Replit by mal byť automaticky."
  echo "   Na Ubuntu spusti: export DATABASE_URL=postgres://user:pass@host:5432/db"
  exit 1
fi

exec npx tsx scripts/import-clinics-mapping.ts "$@"
