#!/bin/bash
# ISCBC → INDEXUS Full Migration Runner
# Run on Ubuntu server: bash run-migration.sh
# Requires: npm install mssql pg

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "========================================"
echo "ISCBC → INDEXUS CRM Migration"
echo "Started: $(date)"
echo "========================================"

echo ""
echo "Step 0: Testing MSSQL connection..."
node "$SCRIPT_DIR/test-mssql-connection.js" 2>&1 | tee "$LOG_DIR/step0_test_$TIMESTAMP.log"
echo ""

read -p "Connection test passed. Continue with migration? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Migration cancelled."
  exit 0
fi

echo ""
echo "Step 1: Phase 1 - Reference Data (Companies, Statuses, Labs)"
node "$SCRIPT_DIR/migrate-phase1-reference.js" 2>&1 | tee "$LOG_DIR/step1_reference_$TIMESTAMP.log"

echo ""
echo "Step 2: Phase 2 - Core Entities (Hospitals, Collaborators, Customers)"
node "$SCRIPT_DIR/migrate-phase2-core.js" 2>&1 | tee "$LOG_DIR/step2_core_$TIMESTAMP.log"

echo ""
echo "Step 3: Phase 3 - Collections & Lab Results"
node "$SCRIPT_DIR/migrate-phase3-collections.js" 2>&1 | tee "$LOG_DIR/step3_collections_$TIMESTAMP.log"

echo ""
echo "Step 4: Phase 4 - Invoices & Payments"
node "$SCRIPT_DIR/migrate-phase4-invoices.js" 2>&1 | tee "$LOG_DIR/step4_invoices_$TIMESTAMP.log"

echo ""
echo "Step 5: Verification"
node "$SCRIPT_DIR/verify-migration.js" 2>&1 | tee "$LOG_DIR/step5_verify_$TIMESTAMP.log"

echo ""
echo "========================================"
echo "Migration Complete: $(date)"
echo "Logs saved to: $LOG_DIR/"
echo "========================================"
