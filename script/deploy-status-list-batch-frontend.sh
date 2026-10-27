#!/usr/bin/env bash
# Frontend-only operator deployment. No backend restart and no database access.
set -Eeuo pipefail

file_hash() { sha256sum "$1" | cut -d' ' -f1; }
live_pid() {
  node <<'NODE'
try {
  const {execFileSync}=require("node:child_process");
  const rows=JSON.parse(execFileSync("pm2",["jlist"],{encoding:"utf8"})).filter(p=>p.name==="indexus-crm");
  const p=rows[0],e=p?.pm2_env;
  if(rows.length!==1 || !p.pid || e.status!=="online" ||
    e.pm_cwd!=="/var/www/indexus-crm" || e.pm_exec_path!=="/var/www/indexus-crm/dist/index.cjs" ||
    (e.watch && (!Array.isArray(e.watch)||e.watch.length)) || Number(e.PORT||e.env?.PORT||5000)!==5000)
    throw Error("PM2");
  console.log(p.pid);
} catch { console.error("STOP: PM2 konfiguracia nezodpoveda ocakavaniu.");process.exit(1); }
NODE
}
healthy() {
  [ "$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/)" = 200 ] &&
  [ "$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/users)" = 401 ]
}
validate_assets() {
  local current=$1 incoming=$2 file relative
  test -z "$(find "$current" "$incoming" -type l -print -quit)"
  while IFS= read -r -d '' file; do
    relative=${file#"$incoming/"}
    if [ "$relative" = index.html ]; then continue; fi
    if [ -e "$current/$relative" ]; then
      test -f "$current/$relative"
      if ! cmp -s "$file" "$current/$relative"; then
        echo "STOP: existujuci frontendovy subor ma iny obsah: $relative" >&2
        return 1
      fi
    fi
  done < <(find "$incoming" -type f -print0)
}
publish_assets() {
  local current=$1 incoming=$2 file relative target
  while IFS= read -r -d '' file; do
    relative=${file#"$incoming/"}
    if [ "$relative" = index.html ]; then continue; fi
    target="$current/$relative"
    if [ -e "$target" ]; then
      cmp -s "$file" "$target"
    else
      sudo install -D -o "$OWNER" -g "$GROUP" -m 644 "$file" "$target.batch-next.$$"
      sudo mv -T "$target.batch-next.$$" "$target"
    fi
    test "$(file_hash "$file")" = "$(file_hash "$target")"
  done < <(find "$incoming" -type f -print0)
}
restore_index() {
  sudo install -o "$OWNER" -g "$GROUP" -m "$MODE" "$BACKUP/index.html" "$PUBLIC/.index-batch-restore.$$" &&
  sudo mv -fT "$PUBLIC/.index-batch-restore.$$" "$PUBLIC/index.html" &&
  test "$(file_hash "$PUBLIC/index.html")" = "$OLD_INDEX"
}
failed() {
  local code=$1 line=$2
  trap - ERR
  set +e
  echo "STOP: faza=${PHASE:-kontrola}, riadok=$line, kod=$code. Zaloha: ${BACKUP:-nevytvorena}" >&2
  if [ "${SWITCHED:-0}" = 1 ]; then
    if restore_index; then
      echo "POVODNY FRONTEND OBNOVENY. Nove staticke subory zostali pre otvorene karty."
    else
      echo "POZOR: navrat vstupnej stranky zlyhal. Zaloha: $BACKUP"
    fi
  fi
  echo "Skript nevykonal restart backendu ani zapis do databazy."
  exit "$code"
}
main() {
  if [ "$#" -ne 1 ] || [ "${1:-}" != --apply ]; then
    echo "Usage: bash deploy-status-list-batch-frontend.sh --apply"
    return 2
  fi
  ROOT=/var/www/indexus-crm
  PUBLIC="$ROOT/dist/public"
  BASE=d9104f6fafd34ac4640bf69539a970a3b67a3be1
  FIX=25ca5b8204271e41e4ff0f15146f908b5ec0c21d
  ORIGINAL_BACKUP="$ROOT/data/.automation-backup-20261027T114049Z-CzHzHN"
  BACKUP=
  SWITCHED=0
  PHASE=preflight
  umask 077
  trap 'failed "$?" "$LINENO"' ERR
  test "$(hostname -s | tr '[:lower:]' '[:upper:]')" = CORPCRM01
  test "$(id -un)" = seman
  cd "$ROOT"
  for tool in git node tar sha256sum find cmp curl sudo pm2 findmnt flock; do command -v "$tool" >/dev/null; done
  test -d .git
  test ! -L .git
  test ! -L .git/indexus-frontend.lock
  exec 9>.git/indexus-frontend.lock
  flock -n 9
  for hook in post-merge reference-transaction; do
    test ! -x "$(git rev-parse --git-path "hooks/$hook")"
  done
  test "$(findmnt -n -o SOURCE --target "$ROOT/data")" = /dev/sdb1
  test ! -e "$ROOT/data/PG_VERSION"
  test ! -L dist
  test ! -L dist/index.cjs
  test ! -L "$PUBLIC"
  test "$(git rev-parse HEAD)" = "$BASE"
  git diff --quiet
  git diff --cached --quiet
  test "$(git rev-parse "$FIX^")" = "$BASE"
  test -z "$(git diff --name-only "$BASE" "$FIX" -- server shared package.json package-lock.json)"
  test "$(git diff --name-only "$BASE" "$FIX" | wc -l)" -eq 6
  EXISTING=()
  while IFS= read -r file; do
    case "$file" in
      client/src/pages/agent-workspace.tsx|client/src/components/status-list-batch-save-dialog.tsx|client/src/components/status-list-batch-save-dialog.css|client/test-fixtures/status-list-batch-save.html|client/test-fixtures/status-list-batch-save.tsx|e2e/status-list-batch-save.node.test.ts) ;;
      *) echo "STOP: neschvaleny zdroj $file"; false ;;
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
  sudo -v
  test "$(sudo stat -c '%u:%g:%a' "$ORIGINAL_BACKUP")" = 0:0:700
  mapfile -t RELEASE < <(sudo cat "$ORIGINAL_BACKUP/release.txt")
  test "${#RELEASE[@]}" -eq 6
  test "${RELEASE[1]}" = "$BASE"
  OLD_BACKEND=${RELEASE[4]}
  test "${#OLD_BACKEND}" -eq 64
  test "$(file_hash dist/index.cjs)" = "$OLD_BACKEND"
  OLD_PID=$(live_pid)
  healthy
  OLD_INDEX=$(file_hash "$PUBLIC/index.html")
  OWNER=$(stat -c %u "$PUBLIC/index.html")
  GROUP=$(stat -c %g "$PUBLIC/index.html")
  MODE=$(stat -c %a "$PUBLIC/index.html")

  PHASE=offline-build
  local source_bytes public_bytes available_bytes needed_bytes
  source_bytes=$(git ls-tree -r -l "$FIX" | awk '$2=="blob"{s+=$4} END{printf "%.0f",s}')
  public_bytes=$(du -sb "$PUBLIC" | cut -f1)
  available_bytes=$(df -B1 --output=avail "$ROOT/data" | tail -1 | tr -d ' ')
  needed_bytes=$((2 * source_bytes + 2 * public_bytes + 1073741824))
  if [ "$available_bytes" -lt "$needed_bytes" ]; then
    echo "STOP: datovy disk nema dost miesta; dostupne=$available_bytes, potrebne=$needed_bytes bajtov."
    return 1
  fi
  STAGE=$(sudo mktemp -d "$ROOT/data/.batch-ui-stage-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
  sudo chown "$(id -u):$(id -g)" "$STAGE"
  test "$(stat -c %a "$STAGE")" = 700
  test "$(findmnt -n -o SOURCE --target "$STAGE")" = /dev/sdb1
  sudo -u www-data test ! -r "$STAGE"
  local privacy_token privacy_status
  privacy_token=$(node -e 'console.log(require("node:crypto").randomBytes(24).toString("hex"))')
  printf '%s' "$privacy_token" > "$STAGE/privacy-check.txt"
  privacy_status=$(curl -sS --max-time 10 -o "$STAGE/privacy-response.txt" -w '%{http_code}' \
    "http://127.0.0.1:5000/data/${STAGE##*/}/privacy-check.txt")
  if grep -Fq "$privacy_token" "$STAGE/privacy-response.txt"; then
    echo "STOP: pracovny adresar je dostupny cez HTTP; zdroje sa nerozbalia."
    return 1
  fi
  case "$privacy_status" in 200|401|403|404) ;; *) echo "STOP: neoverena ochrana pracoviska HTTP=$privacy_status"; return 1 ;; esac
  echo "PRIPRAVA FRONTENDU: $STAGE"
  git archive --output="$STAGE/source.tar" "$FIX"
  tar -xf "$STAGE/source.tar" -C "$STAGE"
  rm -- "$STAGE/source.tar"
  ln -s "$ROOT/node_modules" "$STAGE/node_modules"
  (cd "$STAGE" && nice -n 10 ./node_modules/.bin/vite build)
  INCOMING="$STAGE/dist/public"
  test -s "$INCOMING/index.html"
  NEW_INDEX=$(file_hash "$INCOMING/index.html")
  test "$NEW_INDEX" != "$OLD_INDEX"
  validate_assets "$PUBLIC" "$INCOMING"

  PHASE=private-backup
  BACKUP=$(sudo mktemp -d "$ROOT/data/.batch-ui-backup-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
  test "$(sudo stat -c '%u:%g:%a' "$BACKUP")" = 0:0:700
  test ! -r "$BACKUP"
  sudo -u www-data test ! -r "$BACKUP"
  sudo cp -a "$PUBLIC/index.html" "$BACKUP/index.html"
  sudo tar -cpf "$BACKUP/public.tar" -C "$ROOT/dist" public
  sudo tar -tf "$BACKUP/public.tar" >/dev/null
  git archive "$BASE" -- "${EXISTING[@]}" | sudo tee "$BACKUP/previous-source.tar" >/dev/null
  printf '%s\n' "$BASE" "$FIX" "$OLD_BACKEND" "$OLD_PID" "$OLD_INDEX" "$NEW_INDEX" |
    sudo tee "$BACKUP/release.txt" >/dev/null
  test "$(sudo sha256sum "$BACKUP/index.html" | cut -d' ' -f1)" = "$OLD_INDEX"
  PHASE=publish-assets
  test "$(git rev-parse HEAD)" = "$BASE"
  git diff --quiet
  git diff --cached --quiet
  test "$(live_pid)" = "$OLD_PID"
  test "$(file_hash dist/index.cjs)" = "$OLD_BACKEND"
  test "$(file_hash "$PUBLIC/index.html")" = "$OLD_INDEX"
  validate_assets "$PUBLIC" "$INCOMING"
  git merge --ff-only "$FIX"
  test "$(live_pid)" = "$OLD_PID"
  publish_assets "$PUBLIC" "$INCOMING"
  test "$(file_hash "$PUBLIC/index.html")" = "$OLD_INDEX"
  sudo install -o "$OWNER" -g "$GROUP" -m "$MODE" "$INCOMING/index.html" "$PUBLIC/.index-batch-next.$$"
  PHASE=activate-index
  SWITCHED=1
  sudo mv -fT "$PUBLIC/.index-batch-next.$$" "$PUBLIC/index.html"
  PHASE=http-readiness
  healthy
  curl -fsS --max-time 15 http://127.0.0.1:5000/ -o "$STAGE/served-index.html"
  test "$(file_hash "$STAGE/served-index.html")" = "$NEW_INDEX"
  mapfile -t ENTRY_ASSETS < <(node -e '
    const s=require("node:fs").readFileSync(process.argv[1],"utf8");
    for(const m of s.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) console.log(m[1]);
  ' "$INCOMING/index.html")
  test "${#ENTRY_ASSETS[@]}" -gt 0
  for asset in "${ENTRY_ASSETS[@]}"; do
    curl -fsS --max-time 30 "http://127.0.0.1:5000$asset" -o "$STAGE/served-asset"
    test "$(file_hash "$STAGE/served-asset")" = "$(file_hash "$INCOMING$asset")"
  done
  test "$(live_pid)" = "$OLD_PID"
  test "$(file_hash dist/index.cjs)" = "$OLD_BACKEND"
  test "$(git rev-parse HEAD)" = "$FIX"
  SWITCHED=0
  trap - ERR
  echo "CALLBACK REDIZAJN NASADENY OK: $FIX"
  echo "ZALOHA: $BACKUP"
  echo "BACKEND PID NEZMENENY: $OLD_PID"
  echo "Bez restartu backendu, bez databazovej migracie a bez zmeny pravidiel."
}
if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
