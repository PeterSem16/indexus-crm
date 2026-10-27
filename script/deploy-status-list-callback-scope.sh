#!/usr/bin/env bash
# Operator-only backend promotion for the already prepared, pinned production build.
(
set -Eeuo pipefail
if [ "$#" -ne 2 ] || [ "${1:-}" != --apply ] || [ "${2:-}" != --allow-restart ]; then
  echo "Usage: bash deploy-status-list-callback-scope.sh --apply --allow-restart"
  exit 2
fi
ROOT=/var/www/indexus-crm
STAGE=/tmp/indexus-sl-backend.va3XET
FIX=7f6fb81fd53ae355b54cef45f92e915014dc0d4d
EXPECTED=08a6c4e92a2834063eb6e14169ca4107b0d70bcd87a5aad47a44953088b02bc8
PROMOTED=0
BACKUP=
failed() {
  CODE=$?
  trap - ERR
  set +e
  echo "STOP pri riadku ${BASH_LINENO[0]}: nasadenie nebolo dokoncene. Zaloha: ${BACKUP:-nevytvorena}"
  if [ "$PROMOTED" = 1 ]; then
    if sudo cp -a "$BACKUP/index.cjs" "$ROOT/dist/.index-sl-restore.$$" &&
       sudo mv -fT "$ROOT/dist/.index-sl-restore.$$" "$ROOT/dist/index.cjs" &&
       pm2 restart indexus-crm; then
      echo "POVODNY BACKEND OBNOVENY; Git zdroje zostali na $FIX. Databaza sa neobnovovala."
    else
      echo "POZOR: automaticke obnovenie backendu zlyhalo. Zaloha: $BACKUP/index.cjs"
    fi
  fi
  exit "$CODE"
}
trap failed ERR
cd "$ROOT"
test "$(hostname -s | tr '[:lower:]' '[:upper:]')" = CORPCRM01
test "$(id -un)" = seman
mapfile -t PROOF < "$STAGE/hotfix-proof.txt"
test "${#PROOF[@]}" -eq 4
test "${PROOF[0]}" = "$FIX"
BASE=${PROOF[1]}
case "$BASE" in
  78bd9dd07bdaba37dd9964537261ba8698594028|4d1ea680462f9c09b9ef7d37f3abb6cdd6db304b) ;;
  *) echo "STOP: neznamy zaklad"; false ;;
esac
test "$(git rev-parse HEAD)" = "$BASE"
git diff --quiet
git diff --cached --quiet
git merge-base --is-ancestor "$BASE" "$FIX"
while IFS= read -r FILE; do
  case "$FILE" in
    client/src/lib/status-list-execution-client.ts|e2e/status-list-execution-http.node.test.ts|server/lib/status-list-callback-transition.ts|server/lib/status-list-callback-transition.db.test.ts) ;;
    *) echo "STOP: neschvaleny subor: $FILE"; false ;;
  esac
done < <(git diff --name-only "$BASE" "$FIX")
test "$(sha256sum "$STAGE/dist/index.cjs" | cut -d' ' -f1)" = "$EXPECTED"
node --check "$STAGE/dist/index.cjs"
test "$(sha256sum dist/index.cjs | cut -d' ' -f1)" = "${PROOF[2]}"
test "$(sha256sum dist/public/index.html | cut -d' ' -f1)" = "${PROOF[3]}"
test "$(findmnt -n -o SOURCE --target "$ROOT/data")" = /dev/sdb1
OLD_PID=$(node <<'NODE'
try {
  const {execFileSync}=require('node:child_process');
  const rows=JSON.parse(execFileSync('pm2',['jlist'],{encoding:'utf8'})).filter(p=>p.name==='indexus-crm');
  const p=rows[0], e=p?.pm2_env;
  if(rows.length!==1 || !p.pid || e.status!=='online' ||
     e.pm_cwd!=='/var/www/indexus-crm' || e.pm_exec_path!=='/var/www/indexus-crm/dist/index.cjs' ||
     (e.watch && (!Array.isArray(e.watch)||e.watch.length)) || Number(e.PORT||e.env?.PORT||5000)!==5000)
    throw new Error('PM2');
  console.log(p.pid);
} catch (_) { console.error('STOP: PM2 konfiguracia nezodpoveda ocakavaniu.'); process.exit(1); }
NODE
)
healthy() {
  [ "$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/)" = 200 ] &&
  [ "$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/users)" = 401 ]
}
healthy
sudo -v
BACKUP=$(sudo mktemp -d "$ROOT/data/.sl-callback-backup-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
test "$(sudo stat -c '%u:%g:%a' "$BACKUP")" = 0:0:700
sudo cp -a dist/index.cjs "$BACKUP/index.cjs"
test ! -r "$BACKUP/index.cjs"
sudo -u www-data test ! -r "$BACKUP/index.cjs"
test "$(sudo sha256sum "$BACKUP/index.cjs" | cut -d' ' -f1)" = "${PROOF[2]}"
for FILE in client/src/lib/status-list-execution-client.ts server/lib/status-list-callback-transition.ts server/lib/status-list-callback-transition.db.test.ts; do
  sudo cp --parents "$FILE" "$BACKUP/"
done
printf '%s\n' "$BASE" "$FIX" "${PROOF[2]}" "$EXPECTED" | sudo tee "$BACKUP/release.txt" >/dev/null
test "$(git rev-parse HEAD)" = "$BASE"
git diff --quiet
git diff --cached --quiet
test "$(pm2 pid indexus-crm)" = "$OLD_PID"
test "$(sha256sum dist/index.cjs | cut -d' ' -f1)" = "${PROOF[2]}"
test "$(sha256sum dist/public/index.html | cut -d' ' -f1)" = "${PROOF[3]}"
test "$(sha256sum "$STAGE/dist/index.cjs" | cut -d' ' -f1)" = "$EXPECTED"
git merge --ff-only "$FIX"
sudo install -o "$(stat -c %u dist/index.cjs)" -g "$(stat -c %g dist/index.cjs)" -m "$(stat -c %a dist/index.cjs)" "$STAGE/dist/index.cjs" "dist/.index-sl-next.$$"
PROMOTED=1
sudo mv -fT "dist/.index-sl-next.$$" dist/index.cjs
pm2 restart indexus-crm
NEW_PID=$(pm2 pid indexus-crm)
test "$NEW_PID" != 0
test "$NEW_PID" != "$OLD_PID"
STABLE=0
for TRY in $(seq 1 45); do
  if healthy && [ "$(pm2 pid indexus-crm)" = "$NEW_PID" ]; then
    STABLE=$((STABLE+1))
    if [ "$STABLE" -ge 3 ]; then break; fi
  else
    STABLE=0
  fi
  sleep 1
done
test "$STABLE" -ge 3
test "$(sha256sum dist/index.cjs | cut -d' ' -f1)" = "$EXPECTED"
test "$(sha256sum dist/public/index.html | cut -d' ' -f1)" = "${PROOF[3]}"
PROMOTED=0
trap - ERR
echo "NASADENE OK: $FIX"
echo "ZALOHA: $BACKUP"
echo "Zostaveny frontend zostal nezmeneny; stranka HTTP 200, chranene API HTTP 401."
)
