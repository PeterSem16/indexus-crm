#!/usr/bin/env bash
# Read-only, credential-free preparation. No Gateway API or inference request.
set -u -o pipefail

actual_host="$(hostname -s)"
if [[ "${actual_host^^}" != "CORPCRM01" ]]; then
  printf 'STOP: This check belongs in the CORPCRM01 console, not on %s.\n' "$actual_host" >&2
  exit 2
fi
printf 'CHECK_UTC=%s\nSERVER=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$actual_host"
printf '\n--- Local interface IPs (not proof of NAT egress) ---\n'
hostname -I
printf '\n--- IPv4 DNS ---\n'
addresses="$(getent ahostsv4 ai.cordbloodcenter.com 2>/dev/null | awk '{print $1}' | sort -u)"
dns_status=$?
printf 'DNS_EXIT=%s\n' "$dns_status"
if [[ -n "$addresses" ]]; then
  printf '%s\n' "$addresses"
  printf '\n--- Local IPv4 routes (not receiver-observed source IP) ---\n'
  while IFS= read -r address; do
    ip -4 route get "$address" 2>&1 || printf 'ROUTE_CHECK_FAILED\n'
  done <<< "$addresses"
else
  printf 'No IPv4 DNS result.\n'
fi

probe="indexus-network-$(date -u +%Y%m%dT%H%M%SZ)-${RANDOM}"
printf '\n--- Direct IPv4 HTTPS/TLS, without proxy, token or curlrc ---\n'
printf 'PROBE_ID=%s\n' "$probe"
# -q MUST be the first curl argument: ignore a possibly credential-bearing curlrc.
# No -k, redirect following, auth header, /gateway/ or inference endpoint.
curl -q --noproxy '*' --ipv4 --head --silent --show-error \
  --connect-timeout 5 --max-time 10 --proto '=https' \
  --output /dev/null \
  --write-out $'HTTP_STATUS=%{http_code}\nREMOTE_IP=%{remote_ip}\nLOCAL_CONNECTION_IP=%{local_ip}\nTLS_VERIFY_RESULT=%{ssl_verify_result}\nTIME_DNS=%{time_namelookup}\nTIME_TCP=%{time_connect}\nTIME_TLS=%{time_appconnect}\n' \
  "https://ai.cordbloodcenter.com/?indexus_network_probe=${probe}"
curl_status=$?
printf 'CURL_EXIT=%s\n' "$curl_status"
if [[ "$curl_status" -eq 0 ]]; then
  printf 'TLS_CHECK=verified_by_curl\n'
else
  printf 'TLS_CHECK=not_verified\n'
fi
printf 'GATEWAY_API=not_called\nTOKEN=not_used\nINFERENCE=not_called\n'
printf 'RECEIVER_OBSERVED_SOURCE_IP=awaiting_AI_server_log_correlation\n'
printf 'A root HTTP response is not evidence that /gateway/ is deployed or ready.\n'
exit "$curl_status"
