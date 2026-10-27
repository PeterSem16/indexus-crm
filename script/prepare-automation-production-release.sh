#!/usr/bin/env bash
# Read-only production checks and an offline build. Does not promote or restart.
(
set -Eeuo pipefail
if [ "$#" -ne 1 ] || [ "${1:-}" != --prepare ]; then
  echo "Usage: bash prepare-automation-production-release.sh --prepare"
  exit 2
fi
ROOT=/var/www/indexus-crm
BASE=7f6fb81fd53ae355b54cef45f92e915014dc0d4d
FIX=600e2096aa04f16d36430207bf7362285f696a47
EXPECTED_LIVE=08a6c4e92a2834063eb6e14169ca4107b0d70bcd87a5aad47a44953088b02bc8
STAGE=
trap 'echo "STOP pri riadku $LINENO: priprava zlyhala; nasadenie ani restart sa nevykonali. Adresar: ${STAGE:-nevytvoreny}" >&2' ERR
test "$(hostname -s | tr '[:lower:]' '[:upper:]')" = CORPCRM01
test "$(id -un)" = seman
cd "$ROOT"
for TOOL in git node tar sha256sum find sort xargs findmnt; do
  command -v "$TOOL" >/dev/null
done
test "$(git rev-parse HEAD)" = "$BASE"
git diff --quiet
git diff --cached --quiet
test "$(git rev-parse "$FIX^")" = "$BASE"
test "$(git diff --name-only "$BASE" "$FIX" | wc -l)" -eq 238
test -z "$(git diff --name-only "$BASE" "$FIX" -- package-lock.json)"
test "$(findmnt -n -o SOURCE --target "$ROOT/data")" = /dev/sdb1
test -d node_modules
test "$(sha256sum dist/index.cjs | cut -d' ' -f1)" = "$EXPECTED_LIVE"

# Verify physical source bytes, including missing/new paths, before building.
while IFS= read -r FILE; do
  case "$FILE" in
    client/*|server/*|shared/*|e2e/*|script/check-status-list-agent-ui-boundary.test.cjs|package.json) ;;
    *) echo "STOP: neschvaleny typ suboru: $FILE"; false ;;
  esac
  ENTRY=$(git ls-tree "$BASE" -- "$FILE")
  if [ -n "$ENTRY" ]; then
    test -f "$FILE" && test ! -L "$FILE"
    if [ "$(git hash-object -- "$FILE")" != "$(git rev-parse "$BASE:$FILE")" ]; then
      echo "STOP: fyzicky zdroj sa zmenil: $FILE"; false
    fi
  elif [ -e "$FILE" ] || [ -L "$FILE" ]; then
    echo "STOP: novy zdroj koliduje s lokalnym suborom: $FILE"; false
  fi
done < <(git diff --name-only "$BASE" "$FIX")

public_tree_hash() {
  (cd "$1" && find . -type f -print0 | LC_ALL=C sort -z |
    xargs -0 -r sha256sum | sha256sum | cut -d' ' -f1)
}
PUBLIC_BEFORE=$(sha256sum dist/public/index.html | cut -d' ' -f1)
PUBLIC_TREE_BEFORE=$(public_tree_hash "$ROOT/dist/public")
STAGE=$(mktemp -d /tmp/indexus-automation-release.XXXXXX)
echo "PRIPRAVA: $STAGE"
git archive --output="$STAGE/source.tar" "$FIX"
tar -xf "$STAGE/source.tar" -C "$STAGE"
rm -- "$STAGE/source.tar"
ln -s "$ROOT/node_modules" "$STAGE/node_modules"
(
  cd "$STAGE"
  nice -n 10 ./node_modules/.bin/tsx script/build.ts
  node --check dist/index.cjs
)
test "$(git rev-parse HEAD)" = "$BASE"
git diff --quiet
git diff --cached --quiet
test "$(sha256sum dist/index.cjs | cut -d' ' -f1)" = "$EXPECTED_LIVE"
test "$(sha256sum dist/public/index.html | cut -d' ' -f1)" = "$PUBLIC_BEFORE"
test "$(public_tree_hash "$ROOT/dist/public")" = "$PUBLIC_TREE_BEFORE"
BUILT_BACKEND=$(sha256sum "$STAGE/dist/index.cjs" | cut -d' ' -f1)
BUILT_PUBLIC=$(public_tree_hash "$STAGE/dist/public")

# The scheduler is deliberately absent from the release's engine startup.
if grep -Eq '\bstartAutomationAnalysisRetention[[:space:]]*\(' "$STAGE/server/lib/automation-engine.ts"; then
  echo "STOP: automaticke cistenie nesmie byt spustene"; false
fi
printf '%s\n' "$FIX" "$BASE" "$EXPECTED_LIVE" "$PUBLIC_BEFORE" \
  "$PUBLIC_TREE_BEFORE" "$BUILT_BACKEND" "$BUILT_PUBLIC" > "$STAGE/automation-release-proof.txt"
echo "AUTOMATIZACIE PRIPRAVENE: $STAGE"
echo "VERZIA: $FIX"
echo "BACKEND SHA256: $BUILT_BACKEND"
echo "FRONTEND SHA256: $BUILT_PUBLIC"
echo "Automaticke cistenie: VYPNUTE"
echo "Ziva aplikacia nezmenena; bez restartu, migracie a zapinania pravidiel."
)
