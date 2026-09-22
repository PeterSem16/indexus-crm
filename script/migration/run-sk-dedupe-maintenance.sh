#!/usr/bin/env bash

# One-shot production maintenance runner for the explicitly authorized
# winner-country=SK manual dedupe batch. Run as the PM2 application owner.

APP_NAME="indexus-crm"
APP_STOPPED=0

cleanup() {
  unset PGPASSWORD PGHOST PGPORT PGDATABASE PGUSER
  if [ "$APP_STOPPED" = "1" ]; then
    echo "Starting $APP_NAME..."
    pm2 start "$APP_NAME"
    APP_STOPPED=0
  fi
}

fail() {
  echo "FATAL: $1" >&2
  exit 1
}

trap cleanup EXIT
trap 'exit 130' HUP INT TERM

cd "$(dirname "$0")/../.." || fail "Cannot enter project root"

command -v pm2 >/dev/null 2>&1 || fail "pm2 is missing"
command -v node >/dev/null 2>&1 || fail "node is missing"

ROOT="$HOME/indexus-dedupe"
BACKUP_ROOT="$ROOT/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PLAN="$ROOT/sk-maintenance-plan-$STAMP.json"
PLAN_AUDIT="$ROOT/sk-maintenance-audit-$STAMP.json"
APPLY_RESULT="$ROOT/sk-maintenance-result-$STAMP.json"

mkdir -p "$ROOT" "$BACKUP_ROOT" || fail "Cannot create protected output directories"
chmod 700 "$ROOT" "$BACKUP_ROOT" || fail "Cannot protect output directories"
umask 077

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-indexus_crm}"
export PGUSER="${PGUSER:-indexus}"

read -r -s -p "PostgreSQL password: " PGPASSWORD
echo
export PGPASSWORD

echo "Stopping $APP_NAME for a consistent plan and apply..."
pm2 stop "$APP_NAME" >/dev/null || fail "Could not stop $APP_NAME"
APP_STOPPED=1

echo "Creating a fresh winner-country=SK execution plan..."
node script/migration/dedupe-collaborators-facilities.cjs \
  --plan-file="$PLAN" \
  --approve-winner-country=SK \
  > "$PLAN_AUDIT" || fail "Plan generation failed; database was not changed"

chmod 600 "$PLAN" "$PLAN_AUDIT"

node - "$PLAN" "$PLAN_AUDIT" <<'NODE' || fail "Plan validation failed; database was not changed"
const fs = require("node:fs");
const plan = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const audit = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (audit.bulkApproval?.winnerCountry !== "SK") {
  throw new Error("plan audit does not confirm winner country SK");
}
if (!plan.operations?.length) throw new Error("plan contains no operations");
if (audit.bulkApproval.operationCount !== plan.operations.length) {
  throw new Error("audit and plan operation counts differ");
}
const unsupported = plan.operations.flatMap((operation) =>
  (operation.references || []).filter((reference) => reference.policy === "unsupported_block")
);
if (unsupported.length) throw new Error("plan contains unsupported references");

console.log(JSON.stringify({
  winnerCountry: "SK",
  operationCount: plan.operations.length,
  assignmentMergeCount: (plan.assignmentMerges || []).length,
  planHash: plan.planHash,
}, null, 2));
NODE

PLAN_HASH="$(
  node -p "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).planHash" "$PLAN"
)" || fail "Could not read plan hash"

echo
echo "This will deactivate every loser in the displayed SK plan."
echo "No rows are deleted. A fresh verified backup is required before the transaction."
read -r -p "Type APPLY_SK_DEDUPE:$PLAN_HASH : " CONFIRMATION

if [ "$CONFIRMATION" != "APPLY_SK_DEDUPE:$PLAN_HASH" ]; then
  fail "Confirmation did not match; database was not changed"
fi

echo "Creating and verifying the backup, then applying the SK plan..."
node script/migration/dedupe-collaborators-facilities.cjs \
  --apply \
  --plan-file="$PLAN" \
  --plan-hash="$PLAN_HASH" \
  --confirm="DEDUPLICATE_NO_DELETE:$PLAN_HASH" \
  --backup-dir="$BACKUP_ROOT" \
  > "$APPLY_RESULT" || {
    rm -f "$APPLY_RESULT"
    fail "Apply failed; transaction was not applied"
  }

chmod 600 "$APPLY_RESULT"
echo "Apply completed successfully."
echo "APPLY_RESULT=$APPLY_RESULT"
cat "$APPLY_RESULT"