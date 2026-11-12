#!/usr/bin/env bash
# Run as seman. PREFLIGHT_REV must be the exact reviewed tooling commit.
set -euo pipefail
if [[ "$(id -un)" != seman || ! "${PREFLIGHT_REV:-}" =~ ^[a-f0-9]{40}$ ]]; then
  printf '{"status":"BLOCKED","blockedAt":"operatorOrRevision","productionChanges":false}\n'
  exit 1
fi
MODE="${PREFLIGHT_MODE:-preflight}"
BACKUP="${PREFLIGHT_BACKUP:-}"
if [[ "$MODE" != preflight && "$MODE" != verify-rollback ]] ||
   { [[ "$MODE" == verify-rollback ]] &&
     [[ ! "$BACKUP" =~ ^/var/www/indexus-crm/data/\.ai-gateway-private/attempt-[A-Za-z0-9-]+$ ]]; }; then
  printf '{"status":"BLOCKED","blockedAt":"readOnlyModeOrBackup","productionChanges":false}\n'
  exit 1
fi
trap 'printf "{\"status\":\"BLOCKED\",\"blockedAt\":\"toolDownloadOrSudo\",\"productionChanges\":false}\n" >&2' ERR
sudo -v
if [[ -n "${PREFLIGHT_SOURCE:-}" ]]; then
  SRC="$(realpath -e -- "$PREFLIGHT_SOURCE")"
  [[ "$SRC" =~ ^/tmp/indexus-gateway-source\.[A-Za-z0-9]+$ ]]
  [[ -d "$SRC" && "$(stat -c %u "$SRC")" == "$(id -u)" ]]
else
  SRC="$(mktemp -d /tmp/indexus-gateway-source.XXXXXX)"
fi
trap 'rm -rf -- "$SRC"' EXIT
if [[ -z "${PREFLIGHT_SOURCE:-}" ]]; then
  APP=/var/www/indexus-crm
  export GIT_SSH_COMMAND="$(git -C "$APP" config --get core.sshCommand)"
  [[ -n "$GIT_SSH_COMMAND" ]]
  ORIGIN="$(git -C "$APP" remote get-url origin)"
  git -c init.templateDir= -c core.hooksPath=/dev/null init --quiet "$SRC"
  git -C "$SRC" remote add origin "$ORIGIN"
  git -C "$SRC" config remote.origin.promisor true
  git -C "$SRC" config remote.origin.partialclonefilter blob:none
  git -C "$SRC" -c core.hooksPath=/dev/null fetch --quiet --depth=1 --filter=blob:none origin "$PREFLIGHT_REV"
fi
[[ "$(git -C "$SRC" rev-parse FETCH_HEAD)" == "$PREFLIGHT_REV" ]]
FILES=(
  script/ai-gateway-production.cjs
  script/lib/ai-gateway-policy.cjs
  script/lib/ai-gateway-host.cjs
  script/ai-gateway-production.test.cjs
  ops/ai-gateway/preload.cjs
  script/lib/ai-gateway-preflight.cjs
  script/ai-gateway-preflight.test.cjs
)
git -C "$SRC" -c core.hooksPath=/dev/null checkout --quiet FETCH_HEAD -- "${FILES[@]}"
if sudo env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root \
  bash -s -- "$SRC" "$MODE" "$BACKUP" <<'ROOT_READ_ONLY_PREFLIGHT'
set -euo pipefail
umask 077
trap 'printf "{\"status\":\"BLOCKED\",\"blockedAt\":\"rootToolIntegrity\",\"productionChanges\":false}\n" >&2' ERR
SRC="$1"
MODE="$2"
BACKUP="$3"
TOOLS="$(mktemp -d /tmp/indexus-gateway-tools.XXXXXX)"
for FILE in script/ai-gateway-production.cjs script/lib/ai-gateway-policy.cjs \
  script/lib/ai-gateway-host.cjs script/ai-gateway-production.test.cjs \
  ops/ai-gateway/preload.cjs script/lib/ai-gateway-preflight.cjs \
  script/ai-gateway-preflight.test.cjs; do
  install -D -o 0 -g 0 -m 0600 "$SRC/$FILE" "$TOOLS/$FILE"
done
cd "$TOOLS"
sha256sum --check --status <<'VERIFIED_SOURCES'
aef02a6abf4f75c8c6c9d9a1050898ed3325a74c7c128ec95c573870aa677f12  script/ai-gateway-production.cjs
be518aeccc3ad8d56e93ba6700cdd7b2889137d1ea26ea087cded2c7060adbd1  script/lib/ai-gateway-policy.cjs
44dff281b1ea6a4090a462a40830a5cd31088811bee573164f01fcff14e7ed68  script/lib/ai-gateway-host.cjs
3a11eab86c3864e8f1dac19688b329bc79455df985ae4ff3892ad4d696c1e4de  script/ai-gateway-production.test.cjs
33af3aaff20605583f9152fcad2abe61ec0cef4c4ebe771e43f0cf7d87aa0fac  ops/ai-gateway/preload.cjs
8d4742c58ce035282d3d813b72038e0cf1b7ab7c2382ff60b92d1126b703c688  script/lib/ai-gateway-preflight.cjs
44d0f16556d89e72ce3a09465ae800ba89b13b7150934e25f94eeacfa0de8b40  script/ai-gateway-preflight.test.cjs
VERIFIED_SOURCES
trap - ERR
RESULT=0
if [[ "$MODE" == preflight ]]; then
  /usr/bin/node "$TOOLS/script/ai-gateway-production.cjs" --preflight || RESULT=$?
elif [[ "$MODE" == verify-rollback ]]; then
  /usr/bin/node "$TOOLS/script/ai-gateway-production.cjs" --verify-rollback "$BACKUP" || RESULT=$?
else
  exit 1
fi
exit "$RESULT"
ROOT_READ_ONLY_PREFLIGHT
then
  exit 0
else
  exit "$?"
fi
