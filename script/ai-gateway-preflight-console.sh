#!/usr/bin/env bash
# Run as seman. PREFLIGHT_REV must be the exact reviewed tooling commit.
set -euo pipefail
if [[ "$(id -un)" != seman || ! "${PREFLIGHT_REV:-}" =~ ^[a-f0-9]{40}$ ]]; then
  printf '{"status":"BLOCKED","blockedAt":"operatorOrRevision","productionChanges":false}\n'
  exit 1
fi
trap 'printf "{\"status\":\"BLOCKED\",\"blockedAt\":\"toolDownloadOrSudo\",\"productionChanges\":false}\n" >&2' ERR
sudo -v
SRC="$(mktemp -d /tmp/indexus-gateway-source.XXXXXX)"
trap 'rm -rf -- "$SRC"' EXIT
export GIT_SSH_COMMAND='ssh -o BatchMode=yes -o StrictHostKeyChecking=yes'
git -c init.templateDir= -c core.hooksPath=/dev/null init --quiet "$SRC"
git -C "$SRC" remote add origin git@github.com:PeterSem16/indexus-crm.git
git -C "$SRC" config remote.origin.promisor true
git -C "$SRC" config remote.origin.partialclonefilter blob:none
git -C "$SRC" -c core.hooksPath=/dev/null fetch --quiet --depth=1 --filter=blob:none origin "$PREFLIGHT_REV"
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
  bash -s -- "$SRC" <<'ROOT_READ_ONLY_PREFLIGHT'
set -euo pipefail
umask 077
trap 'printf "{\"status\":\"BLOCKED\",\"blockedAt\":\"rootToolIntegrity\",\"productionChanges\":false}\n" >&2' ERR
SRC="$1"
TOOLS="$(mktemp -d /tmp/indexus-gateway-tools.XXXXXX)"
for FILE in script/ai-gateway-production.cjs script/lib/ai-gateway-policy.cjs \
  script/lib/ai-gateway-host.cjs script/ai-gateway-production.test.cjs \
  ops/ai-gateway/preload.cjs script/lib/ai-gateway-preflight.cjs \
  script/ai-gateway-preflight.test.cjs; do
  install -D -o 0 -g 0 -m 0600 "$SRC/$FILE" "$TOOLS/$FILE"
done
cd "$TOOLS"
sha256sum --check --status <<'VERIFIED_SOURCES'
478316c73553f6568047a2b011a3ef13eb4ab30be9364e454e94d18cb5905ec9  script/ai-gateway-production.cjs
e50082290ed3ba74ba128c8469c10cbf83390260de39f41e96da9ae078b04711  script/lib/ai-gateway-policy.cjs
2991ba3a3e655a7772154b724ca59a771b77f71a72e1dc9b60f1767538f3327e  script/lib/ai-gateway-host.cjs
a23dfb16a85b9e52ec336930f65f571100b33c510c5c4cd31bb111cd6ee5a41f  script/ai-gateway-production.test.cjs
33af3aaff20605583f9152fcad2abe61ec0cef4c4ebe771e43f0cf7d87aa0fac  ops/ai-gateway/preload.cjs
57857da63667e2ef4bdf834fa7edf0013be79a94f902b3c18a8c1baa8e0ffd97  script/lib/ai-gateway-preflight.cjs
c4e5ff3bc15216b85728f22bf1c1f944af2c8dba503ae32fe735a43f8eb03e63  script/ai-gateway-preflight.test.cjs
VERIFIED_SOURCES
trap - ERR
RESULT=0
/usr/bin/node "$TOOLS/script/ai-gateway-production.cjs" --preflight || RESULT=$?
exit "$RESULT"
ROOT_READ_ONLY_PREFLIGHT
then
  exit 0
else
  exit "$?"
fi
