#!/usr/bin/env bash
# Operator-only transfer preparation. Never executes inference or changes live files.
set -euo pipefail
umask 077
if [[ "$(id -u)" != "1001" || "$(hostname -s)" != "CORPCRM01" ]]; then
  echo "B71_EXPORT_CORPCRM01_SEMAN_ONLY" >&2
  exit 1
fi
pin="${1:-}"
mode="${2:-}"
if [[ ! "$pin" =~ ^[a-f0-9]{40}$ || ( -n "$mode" && "$mode" != "--transfer-to-ai" ) || $# -gt 2 ]]; then
  echo "Usage: bash export-ai-gateway-b71.sh COMMIT [--transfer-to-ai]" >&2
  exit 1
fi
cd /var/www/indexus-crm
base="$HOME/.indexus-b71-transfer"
if [[ ! -e "$base" && ! -L "$base" ]]; then mkdir -m 700 "$base"; fi
if [[ -L "$base" || ! -d "$base" || "$(stat -c '%u:%a' "$base")" != "1001:700" ]]; then
  echo "B71_PRIVATE_TRANSFER_DIRECTORY_REQUIRED" >&2
  exit 1
fi
work="$(mktemp -d "$base/bundle-XXXXXX")"
git show "$pin:script/ai-gateway-b71.py" > "$work/ai-gateway-b71.py"
git show "$pin:script/ai-gateway-b7.py" > "$work/ai-gateway-b7.py"
git show "$pin:script/lib/ai_gateway_b7_core.py" > "$work/ai_gateway_b7_core.py"
cat > "$work/SHA256SUMS" <<'HASHES'
dded5a1ef560817eef6a3c54668ff6a1b0b2396bd2aeddd81419cc317a3b55d7  ai-gateway-b71.py
00a904bdf6d0e30531df391dc302237e14778a4eacc88bb1357a4c5de73b5243  ai-gateway-b7.py
27a7c7e7d5e235fc4197626babf87b597bb68e967b05768214b8e69941981f6c  ai_gateway_b7_core.py
HASHES
(cd "$work"; sha256sum -c SHA256SUMS)
tar -czf "$work/b71-ai-server.tar.gz" -C "$work" \
  ai-gateway-b71.py ai-gateway-b7.py ai_gateway_b7_core.py SHA256SUMS
echo "B71_ARCHIVE $work/b71-ai-server.tar.gz"
sha256sum "$work/b71-ai-server.tar.gz"
if [[ "$mode" == "--transfer-to-ai" ]]; then
  scp "$work/b71-ai-server.tar.gz" root@10.9.2.140:/root/b71-ai-server.tar.gz
  echo "B71_TRANSFERRED_TO_AI"
fi
echo "Žiadna inferencia sa tu nespustila. B7.1 spusti až v konzole root@ai."
