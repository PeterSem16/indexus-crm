#!/bin/bash
# INDEXUS Ubuntu Database Setup Script
# Spustite ako: sudo bash scripts/ubuntu-setup.sh

set -e

DB_NAME="indexus_crm"
DB_USER="indexus"
DB_PASS="HanyurIfKisck"
APP_DIR="/var/www/indexus-crm"

echo "=== INDEXUS Database Setup ==="

# 1. Zastavíme aplikáciu
echo "1. Zastavujem aplikáciu..."
pm2 stop indexus-crm 2>/dev/null || true

# 2. Dropneme a vytvoríme databázu
echo "2. Resetujem databázu..."
# Najprv ukončíme všetky pripojenia k databáze
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
sleep 2
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# 3. Vytvoríme schému
echo "3. Vytváram schému..."
cd $APP_DIR
export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
npm run db:push

# 4. Importujeme dáta
echo "4. Importujem dáta..."
psql "$DATABASE_URL" -f scripts/full-data-export-clean.sql 2>&1 | grep -c "INSERT 0 1" || true

# 5. Overíme
echo "5. Overujem..."
USERS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users;")
CUSTOMERS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM customers;")
echo "   Používatelia: $USERS"
echo "   Zákazníci: $CUSTOMERS"

# 6. Reštartujeme aplikáciu
echo "6. Reštartujem aplikáciu..."
pm2 restart indexus-crm

echo ""
echo "=== HOTOVO ==="
echo "Používatelia v databáze:"
psql "$DATABASE_URL" -c "SELECT username, email FROM users;"
