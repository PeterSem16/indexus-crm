#!/bin/bash
set -e

echo "============================================"
echo "  INDEXUS CRM - Ubuntu Deploy Script"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

DB_URL="${DATABASE_URL:-postgresql://indexus:HanyurIfKisck@localhost:5432/indexus_crm}"

echo "[1/5] Sťahujem najnovší kód..."
git pull origin main
echo "  ✓ Kód aktualizovaný"
echo ""

echo "[2/5] Spúšťam databázové migrácie..."

psql "$DB_URL" -v ON_ERROR_STOP=0 <<'SQL'
-- Web form submissions metadata
ALTER TABLE web_form_submissions ADD COLUMN IF NOT EXISTS metadata text;

-- Customer potential cases (ak neexistuje)
CREATE TABLE IF NOT EXISTS customer_potential_cases (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR NOT NULL UNIQUE,
  case_status TEXT,
  expected_date_day INTEGER,
  expected_date_month INTEGER,
  expected_date_year INTEGER,
  hospital_id VARCHAR,
  obstetrician_id VARCHAR,
  is_multiple_pregnancy BOOLEAN NOT NULL DEFAULT false,
  child_count INTEGER DEFAULT 1,
  father_title_before TEXT,
  father_first_name TEXT,
  father_last_name TEXT,
  father_title_after TEXT,
  father_phone TEXT,
  father_mobile TEXT,
  father_email TEXT,
  father_street TEXT,
  father_city TEXT,
  father_postal_code TEXT,
  father_region TEXT,
  father_country TEXT,
  product_id VARCHAR,
  product_type TEXT,
  payment_type TEXT,
  gift_voucher TEXT,
  contact_date_day INTEGER,
  contact_date_month INTEGER,
  contact_date_year INTEGER,
  existing_contracts TEXT,
  recruiting TEXT,
  sales_channel TEXT,
  info_source TEXT,
  marketing_action TEXT,
  marketing_code TEXT,
  newsletter_opt_in BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Customer products (ak neexistuje)
CREATE TABLE IF NOT EXISTS customer_products (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR NOT NULL,
  product_id VARCHAR NOT NULL,
  instance_id VARCHAR,
  billset_id VARCHAR,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_override DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
SQL

echo "  ✓ Databáza aktualizovaná"
echo ""

echo "[3/5] Inštalujem závislosti..."
npm install --production=false 2>/dev/null || true
echo "  ✓ Závislosti nainštalované"
echo ""

echo "[4/5] Zostavujem aplikáciu..."
NODE_OPTIONS="--max-old-space-size=8192" npx tsx script/build.ts 2>&1 | tail -5
echo "  ✓ Build dokončený"
echo ""

echo "[5/5] Reštartujem aplikáciu..."
export $(cat .env | xargs 2>/dev/null) 2>/dev/null || true
pm2 restart indexus-crm
echo "  ✓ Aplikácia reštartovaná"
echo ""

echo "============================================"
echo "  DEPLOY ÚSPEŠNÝ!"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""
echo "Zmeny v tejto verzii:"
echo "  - Gynekológ: meno + telefón + email z databázy kliník"
echo "  - Nemocnica: názov z databázy nemocníc"
echo "  - Case status: automaticky 'Prebieha'"
echo "  - Sales channel: 'I' (Internet)"
echo "  - Marketing action: názov webového formulára"
echo "  - Produkt: priradený v záložke Products"
echo "  - Spôsob platby: prenesený z formulára"
echo "  - Metadáta: IP, prehliadač, rozlíšenie, doba vyplňovania"
echo "  - Prvé písmeno veľké pri textových poliach"
echo "  - Laura avatar v OTP overovacích krokoch"
echo "  - Produkty z konfigurátora s popismi"
