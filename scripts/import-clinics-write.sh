#!/usr/bin/env bash
# INDEXUS – Wrapper pre zápisový skript ambulancií z CSV.
#
# Použitie:
#   ./scripts/import-clinics-write.sh                     # DRY-RUN (nič sa nezapíše)
#   ./scripts/import-clinics-write.sh --limit=5           # DRY-RUN len 5 riadkov
#   ./scripts/import-clinics-write.sh --commit            # REÁLNY ZÁPIS
#   ./scripts/import-clinics-write.sh --commit --limit=5  # REÁLNY ZÁPIS prvých 5
#
# Vyžaduje: DATABASE_URL v .env alebo prostredí.
# Funguje rovnako na Replit aj Ubuntu (potrebuje len Node 18+ a npx).

set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v npx >/dev/null 2>&1; then
  echo "✗ npx nie je k dispozícii. Nainštaluj Node.js 18+." >&2
  exit 1
fi

exec npx tsx scripts/import-clinics-write.ts "$@"
