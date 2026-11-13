#!/usr/bin/env bash
# Isolated operator launcher. Extracts only pinned test tooling, never checks out code.
set -euo pipefail
umask 077
if [[ "$(id -u)" != "1001" ]]; then
  echo "B6_RUN_AS_SEMAN" >&2
  exit 1
fi
host="$(hostname -s)"
if [[ "${host^^}" != "CORPCRM01" ]]; then
  echo "B6_CORPCRM01_ONLY" >&2
  exit 1
fi
cd /var/www/indexus-crm
pin=92a079795ea5b08a745d691b3159eda363825a68
work="$(mktemp -d)"
trap 'rm -f -- "$work"/*.cjs "$work"/lib/*.cjs; rmdir -- "$work/lib" "$work"' EXIT
mkdir "$work/lib"
for file in ai-gateway-b4-pilot.cjs ai-gateway-b5-pilot.cjs ai-gateway-b6-pilot.cjs \
  lib/ai-gateway-b6-corpus.cjs lib/ai-gateway-b6-normalization.cjs lib/ai-gateway-b6-baseline.cjs; do
  git show "$pin:script/$file" > "$work/$file"
done
(
  cd "$work"
  sha256sum -c <<'HASHES'
d6c06937d630667c4fa3558a4a0bfda3fbecdb71ad8ed8dc6a9a9285bc0faafa  ai-gateway-b4-pilot.cjs
b27fb4bacf373a09da060ab2511bfeaf1aa92497a914607d2bba2056df4a69fa  ai-gateway-b5-pilot.cjs
b02ded6dad9d539bd46513a8815b5486922ea498ce2284479d78509867c2abc8  ai-gateway-b6-pilot.cjs
c22118999ff3f821e6f03de6c0fa149dca4530568263998f88b2f50584c41aa0  lib/ai-gateway-b6-corpus.cjs
ae77725b41d0c478a665a094d97e1a5807dcfa2923b35d5cb8caf2da3600df58  lib/ai-gateway-b6-normalization.cjs
b8ca76b3cbf80425ae7ba1604685a05eb031589d671db255b59ab5955c9e1932  lib/ai-gateway-b6-baseline.cjs
HASHES
)
NODE_ENV=production node --require /etc/indexus-ai-runtime/preload.cjs \
  "$work/ai-gateway-b6-pilot.cjs" --run-b6
