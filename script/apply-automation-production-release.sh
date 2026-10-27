#!/usr/bin/env bash
# Explicit maintenance-only promotion; database backups are never auto-restored.
set -Eeuo pipefail

public_tree_hash() {
  (cd "$1" && find . -type f -print0 | LC_ALL=C sort -z |
    xargs -0 -r sha256sum | sha256sum | cut -d' ' -f1)
}
merge_public() {
  mkdir -m 700 "$3"
  cp -a "$1/." "$3/"
  cp -a "$2/." "$3/"
}
install_index() {
  sudo install -o "$OWNER" -g "$GROUP" -m "$MODE" "$1" "$ROOT/dist/.automation-index-next.$$"
  sudo mv -fT "$ROOT/dist/.automation-index-next.$$" "$ROOT/dist/index.cjs"
}
healthy() {
  [ "$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/)" = 200 ] &&
  [ "$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/users)" = 401 ]
}
wait_ready() {
  local stable=0 pid
  for ((attempt=0; attempt<60; attempt++)); do
    if healthy && pid=$(node "$DB_ADMIN" pid); then
      if [ "$pid" = "${READY_PID:-}" ]; then stable=$((stable+1)); else stable=1; fi
      READY_PID=$pid
      if [ "$stable" -ge 3 ]; then return 0; fi
    else
      stable=0
    fi
    sleep 1
  done
  return 1
}
rollback_runtime() {
  pm2 stop indexus-crm &&
  sudo tar -xpf "$BACKUP/runtime.tar" -C "$ROOT" &&
  install_index "$BACKUP/rollback-index.cjs" &&
  pm2 restart indexus-crm &&
  wait_ready
}
failed() {
  local code=$?
  trap - ERR
  set +e
  echo "STOP pri riadku ${BASH_LINENO[0]}. Zaloha: ${BACKUP:-nevytvorena}" >&2
  if [ "${STOPPED:-0}" = 1 ]; then
    if rollback_runtime; then
      echo "KOMPATIBILNY POVODNY RUNTIME OBNOVENY: $ROLLBACK"
      echo "Git zdroje ostali na $(git -C "$ROOT" rev-parse HEAD). Databaza sa NEOBNOVOVALA."
    else
      echo "POZOR: automaticky navrat zlyhal; vyzaduje zasah. Zaloha: $BACKUP"
    fi
  fi
  exit "$code"
}
main() {
  if [ "$#" -ne 2 ] || [ "${1:-}" != --apply ] || [ "${2:-}" != --maintenance-window ]; then
    echo "Usage: bash apply-automation-production-release.sh --apply --maintenance-window"
    return 2
  fi
  ROOT=/var/www/indexus-crm
  STAGE=/tmp/indexus-automation-release.ODk3lf
  BASE=7f6fb81fd53ae355b54cef45f92e915014dc0d4d
  PREPARED=600e2096aa04f16d36430207bf7362285f696a47
  FIX=d9104f6fafd34ac4640bf69539a970a3b67a3be1
  ROLLBACK=115bcd960b2e2d84f85a7cce629cdddc0c19e69c
  OLD_BACKEND=08a6c4e92a2834063eb6e14169ca4107b0d70bcd87a5aad47a44953088b02bc8
  PREPARED_BACKEND=3f3ba6fd19acd36b679ad993886ee2df2b3edba92160ae81eb37dcae14f3e095
  NEW_PUBLIC=500192c27d09b16053f076e4b9aebd489ab3a8ad10bbca9a66d4ffbea51deb93
  DB_ADMIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/automation-production-db-admin.cjs"
  BACKUP=
  STOPPED=0
  trap failed ERR
  test "$(hostname -s | tr '[:lower:]' '[:upper:]')" = CORPCRM01
  test "$(id -un)" = seman
  cd "$ROOT"
  for tool in git node tar sha256sum find sort xargs findmnt pg_dump pg_restore curl sudo pm2; do
    command -v "$tool" >/dev/null
  done
  test "$(findmnt -n -o SOURCE --target "$ROOT/data")" = /dev/sdb1
  test ! -e "$ROOT/data/PG_VERSION"
  test ! -L "$ROOT/dist"
  test ! -L "$ROOT/dist/index.cjs"
  test ! -L "$ROOT/dist/public"
  test -z "$(find "$ROOT/dist/public" "$STAGE/dist/public" -type l -print -quit)"
  mapfile -t PROOF < "$STAGE/automation-release-proof.txt"
  test "${#PROOF[@]}" -eq 7
  test "${PROOF[0]}" = "$PREPARED"
  test "${PROOF[1]}" = "$BASE"
  test "${PROOF[2]}" = "$OLD_BACKEND"
  test "${PROOF[5]}" = "$PREPARED_BACKEND"
  test "${PROOF[6]}" = "$NEW_PUBLIC"
  test "$(git rev-parse HEAD)" = "$BASE"
  git diff --quiet
  git diff --cached --quiet
  test "$(git rev-parse "$FIX^")" = "$PREPARED"
  test "$(git rev-parse "$PREPARED^")" = "$BASE"
  test "$(git rev-parse "$ROLLBACK^")" = "$BASE"
  test "$(git diff --name-only "$BASE" "$FIX" | wc -l)" -eq 238
  test "$(sha256sum dist/index.cjs | cut -d' ' -f1)" = "$OLD_BACKEND"
  test "$(public_tree_hash "$ROOT/dist/public")" = "${PROOF[4]}"
  test "$(sha256sum "$STAGE/dist/index.cjs" | cut -d' ' -f1)" = "$PREPARED_BACKEND"
  test "$(public_tree_hash "$STAGE/dist/public")" = "$NEW_PUBLIC"
  node --check "$STAGE/dist/index.cjs"
  if grep -Eq '\bstartAutomationAnalysisRetention[[:space:]]*\(' "$STAGE/server/lib/automation-engine.ts"; then
    echo "STOP: automaticke cistenie nesmie byt aktivne"; false
  fi
  EXISTING=()
  while IFS= read -r file; do
    case "$file" in client/*|server/*|shared/*|e2e/*|script/check-status-list-agent-ui-boundary.test.cjs|package.json) ;;
      *) echo "STOP: neschvaleny zdroj: $file"; false ;;
    esac
    if [ -n "$(git ls-tree "$BASE" -- "$file")" ]; then
      test -f "$file"
      test ! -L "$file"
      test "$(git hash-object -- "$file")" = "$(git rev-parse "$BASE:$file")"
      EXISTING+=("$file")
    else
      test ! -e "$file"
      test ! -L "$file"
    fi
  done < <(git diff --name-only "$BASE" "$FIX")
  OLD_PID=$(node "$DB_ADMIN" pid)
  ENV_BEFORE=$(sha256sum .env | cut -d' ' -f1)
  healthy
  node "$DB_ADMIN" guard --require-dormant > "$STAGE/policy-before.json"
  OWNER=$(stat -c %u dist/index.cjs)
  GROUP=$(stat -c %g dist/index.cjs)
  MODE=$(stat -c %a dist/index.cjs)

  # Only the reviewed backend fingerprint correction follows the prepared version.
  test "$(git diff --name-only "$PREPARED" "$FIX")" = "$(printf '%s\n' \
    server/lib/status-list-service-schema.ts server/lib/status-list-service.test.ts server/lib/status-list-service.ts)"
  echo "Doplnam opraveny backend; uz zostaveny frontend ostava nezmeneny."
  FINAL_STAGE=$(mktemp -d /tmp/indexus-automation-final-backend.XXXXXX)
  git archive --output="$FINAL_STAGE/source.tar" "$FIX"
  tar -xf "$FINAL_STAGE/source.tar" -C "$FINAL_STAGE"
  rm -- "$FINAL_STAGE/source.tar"
  ln -s "$ROOT/node_modules" "$FINAL_STAGE/node_modules"
  (cd "$FINAL_STAGE" && nice -n 10 ./node_modules/.bin/tsx script/build-server.ts &&
    node --check dist/index.cjs)
  BACKEND_FILE="$FINAL_STAGE/dist/index.cjs"
  NEW_BACKEND=$(sha256sum "$BACKEND_FILE" | cut -d' ' -f1)
  echo "Pripravujem kompatibilny povodny backend pre pripad navratu."
  FALLBACK=$(mktemp -d /tmp/indexus-automation-rollback.XXXXXX)
  git archive --output="$FALLBACK/source.tar" "$ROLLBACK"
  tar -xf "$FALLBACK/source.tar" -C "$FALLBACK"
  rm -- "$FALLBACK/source.tar"
  ln -s "$ROOT/node_modules" "$FALLBACK/node_modules"
  (cd "$FALLBACK" && nice -n 10 ./node_modules/.bin/tsx script/build-server.ts &&
    node --check dist/index.cjs)
  sudo -v
  BACKUP=$(sudo mktemp -d "$ROOT/data/.automation-backup-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
  test "$(sudo stat -c '%u:%g:%a' "$BACKUP")" = 0:0:700
  test ! -r "$BACKUP"
  sudo -u www-data test ! -r "$BACKUP"
  echo "Zalohujem databazu a povodnu aplikaciu: $BACKUP"
  node "$DB_ADMIN" dump | sudo tee "$BACKUP/database.dump" >/dev/null
  sudo "$(command -v pg_restore)" --list "$BACKUP/database.dump" >/dev/null
  sudo tar -cpf "$BACKUP/runtime.tar" -C "$ROOT" dist
  sudo tar -tf "$BACKUP/runtime.tar" >/dev/null
  git archive "$BASE" -- "${EXISTING[@]}" | sudo tee "$BACKUP/previous-source.tar" >/dev/null
  sudo cp -a "$FALLBACK/dist/index.cjs" "$BACKUP/rollback-index.cjs"
  printf '%s\n' "$BASE" "$FIX" "$ROLLBACK" "$OLD_BACKEND" "$NEW_BACKEND" "$NEW_PUBLIC" |
    sudo tee "$BACKUP/release.txt" >/dev/null
  sudo sha256sum "$BACKUP/database.dump" "$BACKUP/runtime.tar" "$BACKUP/rollback-index.cjs" |
    sudo tee "$BACKUP/checksums.txt" >/dev/null
  MERGED="$STAGE/public-for-promotion"
  merge_public "$ROOT/dist/public" "$STAGE/dist/public" "$MERGED"
  sudo chown -R "$(stat -c %u:%g "$ROOT/dist/public")" "$MERGED"
  sudo chmod -R u+rwX,go+rX "$MERGED"
  NEXT="$ROOT/dist/.automation-public-next-$$"
  sudo mv "$MERGED" "$NEXT"

  # Revalidate immediately before downtime; never overwrite concurrent source edits.
  test "$(git rev-parse HEAD)" = "$BASE"
  git diff --quiet
  git diff --cached --quiet
  test "$(node "$DB_ADMIN" pid)" = "$OLD_PID"
  test "$(sha256sum dist/index.cjs | cut -d' ' -f1)" = "$OLD_BACKEND"
  test "$(sha256sum .env | cut -d' ' -f1)" = "$ENV_BEFORE"
  test "$(public_tree_hash "$ROOT/dist/public")" = "${PROOF[4]}"
  test "$(sha256sum "$STAGE/dist/index.cjs" | cut -d' ' -f1)" = "$PREPARED_BACKEND"
  test "$(sha256sum "$BACKEND_FILE" | cut -d' ' -f1)" = "$NEW_BACKEND"
  node "$DB_ADMIN" guard > "$STAGE/policy-recheck.json"
  cmp "$STAGE/policy-before.json" "$STAGE/policy-recheck.json"
  echo "Zaloha overena. Zacinam odstavku a nasadenie."
  STOPPED=1
  pm2 stop indexus-crm
  node "$DB_ADMIN" guard > "$STAGE/policy-stopped.json"
  cmp "$STAGE/policy-before.json" "$STAGE/policy-stopped.json"
  git merge --ff-only "$FIX"
  # The old directory is only a transient swap path; the durable backup is on /dev/sdb1.
  PREVIOUS="$ROOT/dist/.automation-public-swap-$$"
  sudo mv "$ROOT/dist/public" "$PREVIOUS"
  sudo mv "$NEXT" "$ROOT/dist/public"
  install_index "$BACKEND_FILE"
  pm2 restart indexus-crm
  wait_ready
  test "$READY_PID" != "$OLD_PID"
  SCHEMA_READY=0
  for ((schema_attempt=0; schema_attempt<20; schema_attempt++)); do
    if node "$DB_ADMIN" schema 2>"$STAGE/schema-check-error.log"; then
      SCHEMA_READY=1
      break
    fi
    sleep 1
  done
  test "$SCHEMA_READY" = 1
  test "$(sha256sum .env | cut -d' ' -f1)" = "$ENV_BEFORE"
  node "$DB_ADMIN" guard > "$STAGE/policy-after.json"
  cmp "$STAGE/policy-before.json" "$STAGE/policy-after.json"
  test "$(sha256sum dist/index.cjs | cut -d' ' -f1)" = "$NEW_BACKEND"
  test "$(sha256sum dist/public/index.html | cut -d' ' -f1)" = \
    "$(sha256sum "$STAGE/dist/public/index.html" | cut -d' ' -f1)"
  # Keep old hashed assets for browsers that still have the old document open.
  sudo mv "$PREVIOUS" "$BACKUP/previous-public-directory"
  STOPPED=0
  trap - ERR
  echo "AUTOMATIZACIE NASADENE OK: $FIX"
  echo "ZALOHA: $BACKUP"
  echo "Automaticke cistenie: VYPNUTE"
  echo "Schvalenia callbackov a aktivacia pravidiel: NEZMENENE"
}
if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
