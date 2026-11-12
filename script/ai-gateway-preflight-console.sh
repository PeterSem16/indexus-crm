#!/usr/bin/env bash
# Run as seman. PREFLIGHT_REV must be the exact reviewed tooling commit.
set -euo pipefail
if [[ "$(id -un)" != seman || ! "${PREFLIGHT_REV:-}" =~ ^[a-f0-9]{40}$ ]]; then
  printf '{"status":"BLOCKED","blockedAt":"operatorOrRevision","productionChanges":false}\n'
  exit 1
fi
MODE="${PREFLIGHT_MODE:-preflight}"
BACKUP="${PREFLIGHT_BACKUP:-}"
BASELINE="${PREFLIGHT_BASELINE_BACKUP:-}"
if [[ "$MODE" != preflight && "$MODE" != verify-rollback && "$MODE" != inspect-attempt ]] ||
   { [[ "$MODE" == verify-rollback || "$MODE" == inspect-attempt ]] &&
     [[ ! "$BACKUP" =~ ^/var/www/indexus-crm/data/\.ai-gateway-private/attempt-[A-Za-z0-9-]+$ ]]; }; then
  printf '{"status":"BLOCKED","blockedAt":"readOnlyModeOrBackup","productionChanges":false}\n'
  exit 1
fi
if [[ "$MODE" == inspect-attempt ]] &&
   [[ ! "$BASELINE" =~ ^/var/www/indexus-crm/data/\.ai-gateway-private/attempt-[A-Za-z0-9-]+$ ]]; then
  printf '{"status":"BLOCKED","blockedAt":"baselineBackup","productionChanges":false}\n'
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
  bash -s -- "$SRC" "$MODE" "$BACKUP" "$BASELINE" <<'ROOT_READ_ONLY_PREFLIGHT'
set -euo pipefail
umask 077
trap 'printf "{\"status\":\"BLOCKED\",\"blockedAt\":\"rootToolIntegrity\",\"productionChanges\":false}\n" >&2' ERR
SRC="$1"
MODE="$2"
BACKUP="$3"
BASELINE="$4"
TOOLS="$(mktemp -d /tmp/indexus-gateway-tools.XXXXXX)"
for FILE in script/ai-gateway-production.cjs script/lib/ai-gateway-policy.cjs \
  script/lib/ai-gateway-host.cjs script/ai-gateway-production.test.cjs \
  ops/ai-gateway/preload.cjs script/lib/ai-gateway-preflight.cjs \
  script/ai-gateway-preflight.test.cjs; do
  install -D -o 0 -g 0 -m 0600 "$SRC/$FILE" "$TOOLS/$FILE"
done
cd "$TOOLS"
sha256sum --check --status <<'VERIFIED_SOURCES'
510b56a7de59a8269c25e7629e638afb88e17691e3739e9dc4b407d97a6c48e0  script/ai-gateway-production.cjs
12ab915632d770059c6bccfbbd2862390479b1df0f31169e2d7e5d6d22463eae  script/lib/ai-gateway-policy.cjs
dee110afc6839de8e329828bb3dae6467775fd7bad3fb9c71ab55551d8ba34e4  script/lib/ai-gateway-host.cjs
763ae2451923696da555e7deb7ab100a212e02c2fc9c229046d6f136c676c828  script/ai-gateway-production.test.cjs
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
elif [[ "$MODE" == inspect-attempt ]]; then
  if /usr/bin/node "$TOOLS/script/ai-gateway-production.cjs" --inspect-attempt "$BACKUP" "$BASELINE"; then
    /usr/bin/node "$TOOLS/script/ai-gateway-production.cjs" --preflight || RESULT=$?
  else
    RESULT=$?
  fi
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
