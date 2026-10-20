#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
APP=/var/www/indexus-crm
BASE=0b1bc1c12ea690cd3db2fb01369a7f7dbe370a5e
PARENT=cdf0dc2cbaa2c88b93a7c059f2988f875033e595
TARGET=c7b8d95010c5b883c92e66bee8fefecbd2296dd0
TREE=c3e08ddbbf1ba4a5afbec507131b4a9f4133010c
BACKUP=/var/www/indexus-crm/data/.indexus-operator-backups/mp-callback-0b1bc1c-to-785f07e-ccFcrWms
STATE="$HOME/.local/state/indexus-deploy"
cd "$APP"
[[ "$(git rev-parse HEAD)" == "$BASE" ]] || {
  echo "STOP: Produkčný Git základ sa zmenil."; exit 1;
}
[[ "$(findmnt -n -o SOURCE --target "$APP/data")" == /dev/sdb1 ]]
sudo test -s "$BACKUP/database.dump"
sudo test -s "$BACKUP/runtime-dist.tar.gz"
[[ "$(sudo stat -c '%U:%a' "$BACKUP")" == root:700 ]]
test -d "$APP/node_modules"
git fetch origin main
[[ "$(git rev-parse "$TARGET^{tree}")" == "$TREE" ]]
[[ "$(git rev-parse "$TARGET^")" == "$PARENT" ]]
git merge-base --is-ancestor "$BASE" "$TARGET"
git diff --quiet "$BASE" "$TARGET" -- package.json package-lock.json

mkdir -p "$HOME/.cache/indexus-release-stage" "$STATE"
FREE=$(df -PB1 "$HOME/.cache/indexus-release-stage" | awk 'NR==2 {print $4}')
(( FREE >= 4294967296 )) || {
  echo "STOP: Na izolovaný build treba aspoň 4 GiB voľného miesta."; exit 1;
}
RUN=$(mktemp -d "$HOME/.cache/indexus-release-stage/mp-callback-c7b8d95-XXXXXXXX")
chmod 700 "$RUN"
mkdir "$RUN/stage"
printf 'STAGE_PREPARE: %s\n' "$RUN"
git archive --format=tar --output="$RUN/source.tar" "$TARGET"
tar -xf "$RUN/source.tar" -C "$RUN/stage"
ln -s "$APP/node_modules" "$RUN/stage/node_modules"
for NAME in .env .env.local .env.production .env.production.local; do
  if [[ -f "$APP/$NAME" ]]; then
    install -m 600 "$APP/$NAME" "$RUN/stage/$NAME"
  fi
done

echo "CHECK_IMPORT_PATHS"
node "$RUN/stage/script/check-release-imports.cjs" "$TARGET"
echo "CHECK_EXPORT_CONTRACTS — stare chyby su oznacene PRE_EXISTING_EXPORT_DEFECT"
node --max-old-space-size=2048 "$RUN/stage/script/check-release-exports.cjs" \
  "$TARGET" --baseline "$BASE"
printf '%s\n' "$BASE" > "$RUN/base.txt"
printf '%s\n' "$TARGET" > "$RUN/target.txt"
printf '%s\n' "$BACKUP" > "$RUN/backup.txt"
printf '%s\n' 785f07ec42db831fc542fddf9d537c8f44c08c21 > "$RUN/backup-original-target.txt"

echo "BUILD_RUNNING — vysledok sa ulozi do build.log"
if ! (cd "$RUN/stage" && NODE_ENV=production npm run build) > "$RUN/build.log" 2>&1; then
  tail -80 "$RUN/build.log"
  printf 'BUILD_FAILED\nLOG=%s/build.log\nZiva aplikacia sa nemenila.\n' "$RUN"
  exit 1
fi
test -s "$RUN/stage/dist/index.cjs"
test -s "$RUN/stage/dist/public/index.html"
node --check "$RUN/stage/dist/index.cjs"
[[ "$(git rev-parse HEAD)" == "$BASE" ]]
(cd "$RUN/stage" && find dist -type f -print0 | sort -z | xargs -0 sha256sum) > "$RUN/build.sha256"
printf '%s\n' "$RUN" > "$STATE/mp-callback-stage-run"
tail -15 "$RUN/build.log"
printf '\nBUILD_OK\nTARGET=%s\nSTAGE=%s/stage\nBACKUP=%s\n' "$TARGET" "$RUN" "$BACKUP"
echo "Nic sa nenasadilo, nerestartovalo ani nepreplo callbacky."
