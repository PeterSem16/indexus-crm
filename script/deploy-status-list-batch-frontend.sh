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
verify_stage_privacy() {
  local status=$1 response=$2 token=$3 physical_file=$4 backend_pid=$5
  test -n "$token" && test -f "$response" || return 1
  if grep -Fq -- "$token" "$response"; then
    echo "STOP: pracovny adresar je dostupny cez HTTP; zdroje sa nerozbalia."
    return 1
  fi
  # A 500 is not itself proof of privacy. Independently require EACCES from
  # Node running as the same non-root UID as the live backend.
  if ! node - "$physical_file" "$backend_pid" <<'NODE'
const fs=require("node:fs");
try {
  const uid=process.getuid();
  if(uid===0 || !/^[1-9]\d*$/.test(process.argv[3]) ||
    fs.statSync(`/proc/${process.argv[3]}`).uid!==uid) process.exit(1);
  try { fs.readFileSync(process.argv[2]); process.exit(1); }
  catch(error) { if(error.code!=="EACCES") process.exit(1); }
} catch { process.exit(1); }
NODE
  then
    echo "STOP: Node UID nema preukazane odmietnutie EACCES pre sukromne pracovisko."
    return 1
  fi
  case "$status" in
    200|401|403|404) ;;
    500)
      if ! healthy; then
        echo "STOP: HTTP 500 a bezne kontrolne endpointy nie su zdrave."
        return 1
      fi
      echo "SUKROMIE OVERENE: Node UID dostava EACCES, HTTP nevracia kontrolny obsah; aplikacia je zdrava."
      ;;
    *) echo "STOP: neoverena ochrana pracoviska HTTP=$status"; return 1 ;;
  esac
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
cleanup_stage_mount() {
  if [ "${STAGE_MOUNTED:-0}" = 1 ]; then
    if sudo umount -- "$STAGE"; then
      STAGE_MOUNTED=0
      rmdir -- "$STAGE" || true
    else
      echo "POZOR: sukromne zostavenie zostalo pripojene: $STAGE" >&2
    fi
  elif [ -n "${STAGE:-}" ]; then
    rmdir -- "$STAGE" 2>/dev/null || true
  fi
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
  FIX=ce2872d958a9dde3212df98b3aa8b7f00471a49b
  ORIGINAL_BACKUP="$ROOT/data/.automation-backup-20261027T114049Z-CzHzHN"
  BACKUP=
  SWITCHED=0
  STAGE=
  STAGE_MOUNTED=0
  PHASE=preflight
  umask 077
  trap 'failed "$?" "$LINENO"' ERR
  trap cleanup_stage_mount EXIT
  test "$(hostname -s | tr '[:lower:]' '[:upper:]')" = CORPCRM01
  test "$(id -un)" = seman
  cd "$ROOT"
  for tool in git node tar sha256sum find cmp curl sudo pm2 findmnt flock mount umount; do command -v "$tool" >/dev/null; done
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
  git merge-base --is-ancestor "$BASE" "$FIX"
  test -z "$(git diff --name-only "$BASE" "$FIX" -- server shared package.json package-lock.json)"
  test "$(git diff --name-only "$BASE" "$FIX" | wc -l)" -eq 12
  EXISTING=()
  while IFS= read -r file; do
    case "$file" in
      client/src/pages/agent-workspace.tsx|client/src/components/status-list-batch-save-dialog.tsx|client/src/components/status-list-batch-save-dialog.css|client/test-fixtures/status-list-batch-save.html|client/test-fixtures/status-list-batch-save.tsx|e2e/status-list-batch-save.node.test.ts) ;;
      client/src/components/status-list-healthcare-setup.tsx|client/src/components/status-list-healthcare-management-copy.ts|client/src/components/status-list-healthcare-navigation.tsx|client/src/components/status-list-workspace.tsx|client/test-fixtures/status-list-healthcare.tsx|e2e/status-list-healthcare-management.node.test.ts) ;;
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
  test "$(stat -c %u "/proc/$OLD_PID")" = "$(id -u)"
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
  STAGE_STORAGE=$(sudo mktemp -d "$ROOT/data/.batch-ui-private-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
  test "$(sudo stat -c '%u:%g:%a' "$STAGE_STORAGE")" = 0:0:700
  test ! -r "$STAGE_STORAGE"
  sudo -u www-data test ! -r "$STAGE_STORAGE"
  sudo install -d -o "$(id -u)" -g "$(id -g)" -m 700 "$STAGE_STORAGE/build"
  # Only this empty mount point lives in /tmp; its contents reside on /dev/sdb1.
  # The root-owned parent blocks HTTP access through /data even for Node's UID.
  STAGE=$(mktemp -d /tmp/indexus-private-build.XXXXXX)
  sudo mount --bind "$STAGE_STORAGE/build" "$STAGE"
  STAGE_MOUNTED=1
  test "$(stat -c %a "$STAGE")" = 700
  test "$(findmnt -n -o MAJ:MIN --target "$STAGE")" = "$(findmnt -n -o MAJ:MIN --target "$ROOT/data")"
  test "$(stat -c '%d:%i' "$STAGE")" = "$(sudo stat -c '%d:%i' "$STAGE_STORAGE/build")"
  local privacy_token privacy_status
  privacy_token=$(node -e 'console.log(require("node:crypto").randomBytes(24).toString("hex"))')
  printf '%s' "$privacy_token" > "$STAGE/privacy-check.txt"
  privacy_status=$(curl -sS --max-time 10 -o "$STAGE/privacy-response.txt" -w '%{http_code}' \
    "http://127.0.0.1:5000/data/${STAGE_STORAGE##*/}/build/privacy-check.txt")
  verify_stage_privacy "$privacy_status" "$STAGE/privacy-response.txt" "$privacy_token" \
    "$STAGE_STORAGE/build/privacy-check.txt" "$OLD_PID"
  echo "SUKROMNE ULOZISKO NA DATOVOM DISKU: $STAGE_STORAGE"
  echo "PRIPRAVA FRONTENDU CEZ SUKROMNY DOCASNY PRISTUP: $STAGE"
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
