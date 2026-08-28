#!/usr/bin/env bash
#
# Patch the live mediagtw dialplan so an O2 Mission call consumes the
# server-authorized one-time Caller ID before it enters route-o2-ims.
#
# This script does not read or modify the O2 SIP password.
#
# Usage on mediagtw:
#   sudo bash repair-o2-mission-callerid.sh
#
set -Eeuo pipefail
umask 077

readonly DEFAULT_EXTENSIONS_CONF="/etc/asterisk/extensions.conf"
readonly MANAGED_FRAGMENT_NAME="extensions-o2-ims.conf"
readonly DEFAULT_PJSIP_CONF="/etc/asterisk/pjsip.conf"
readonly PJSIP_FRAGMENT_NAME="pjsip-o2-ims.conf"
readonly OUTBOUND_ANCHOR='NoOp(Outbound CID: ext=${ORIG_EXT} collab=${COLLAB_CID} campaign=${CAMPAIGN_CID} final=${CALLERID(num)})'
readonly DEFAULT_MISSION_CLI="+421940682394"

EXTENSIONS_CONF="${EXTENSIONS_CONF:-$DEFAULT_EXTENSIONS_CONF}"
MANAGED_FRAGMENT="${MANAGED_FRAGMENT:-$(dirname "$EXTENSIONS_CONF")/$MANAGED_FRAGMENT_NAME}"
PJSIP_CONF="${PJSIP_CONF:-$DEFAULT_PJSIP_CONF}"
PJSIP_FRAGMENT="${PJSIP_FRAGMENT:-$(dirname "$PJSIP_CONF")/$PJSIP_FRAGMENT_NAME}"
MISSION_CLI="${O2_MISSION_CLI:-$DEFAULT_MISSION_CLI}"
BACKUP=""
FRAGMENT_BACKUP=""
PJSIP_BACKUP=""
PATCHED=""
FRAGMENT_PATCHED=""
PJSIP_PATCHED=""
BRANCH=""
COMMON=""
RELOAD_ATTEMPTED=0

log() {
  printf '[o2-callerid-repair] %s\n' "$*"
}

die() {
  printf '[o2-callerid-repair] ERROR: %s\n' "$*" >&2
  return 1
}

cleanup() {
  rm -f "${PATCHED:-}" "${FRAGMENT_PATCHED:-}" "${PJSIP_PATCHED:-}" "${BRANCH:-}" "${COMMON:-}"
}

rollback() {
  local status=$?
  trap - ERR
  set +e
  if [[ -n "$BACKUP" && -f "$BACKUP" ]]; then
    printf '[o2-callerid-repair] Repair failed; restoring %s\n' "$BACKUP" >&2
    cp -a "$BACKUP" "$EXTENSIONS_CONF"
    if [[ -n "$FRAGMENT_BACKUP" && -f "$FRAGMENT_BACKUP" ]]; then
      cp -a "$FRAGMENT_BACKUP" "$MANAGED_FRAGMENT"
    fi
    if [[ -n "$PJSIP_BACKUP" && -f "$PJSIP_BACKUP" ]]; then
      cp -a "$PJSIP_BACKUP" "$PJSIP_FRAGMENT"
    fi
    if [[ "$RELOAD_ATTEMPTED" -eq 1 ]]; then
      asterisk -rx 'dialplan reload' >/dev/null 2>&1 || true
      asterisk -rx 'pjsip reload' >/dev/null 2>&1 || true
    fi
  fi
  cleanup
  exit "$status"
}

trap rollback ERR
trap cleanup EXIT

if [[ "${EUID:-$(id -u)}" -ne 0 && "${O2_PATCH_ALLOW_NONROOT_TEST:-}" != "1" ]]; then
  die "Run this script as root on mediagtw."
fi

for command in awk cat cmp cp date dirname grep mktemp rm; do
  command -v "$command" >/dev/null 2>&1 || die "Required command is missing: $command"
done

[[ -f "$EXTENSIONS_CONF" ]] || die "Dialplan config not found: $EXTENSIONS_CONF"
[[ -f "$MANAGED_FRAGMENT" ]] || die "Managed O2 fragment not found: $MANAGED_FRAGMENT"
[[ -f "$PJSIP_FRAGMENT" ]] || die "Managed O2 PJSIP fragment not found: $PJSIP_FRAGMENT"
[[ "$MISSION_CLI" =~ ^\+421[0-9]{9}$ ]] ||
  die "O2_MISSION_CLI must be a Slovak E.164 number."

grep -Fq '[indexus-outbound]' "$EXTENSIONS_CONF" ||
  die "The [indexus-outbound] context is missing."
grep -Fq "$OUTBOUND_ANCHOR" "$EXTENSIONS_CONF" ||
  die "The expected outbound Caller ID anchor is missing."
grep -Fq '[o2-ims-common]' "$MANAGED_FRAGMENT" ||
  die "The managed O2 fragment has no [o2-ims-common] context."

need_common_repair=0
if ! grep -Fq 'Set(MISSION_CID=${CBC_OUTBOUND_CALLERID})' "$MANAGED_FRAGMENT"; then
  need_common_repair=1
fi
need_cli_repair=0
if ! grep -Fq "O2_IMS_CLI=$MISSION_CLI" "$MANAGED_FRAGMENT"; then
  need_cli_repair=1
fi

if [[ "$need_common_repair" -eq 1 || "$need_cli_repair" -eq 1 ]]; then
  COMMON="$(mktemp)"
  cat > "$COMMON" <<'EOF'
[o2-ims-common]
exten => s,1,Set(MISSION_CID=${CBC_OUTBOUND_CALLERID})
 same => n,ExecIf($[${LEN(${MISSION_CID})}=0]?Set(MISSION_CID=${O2_IMS_CLI}))
 same => n,NoOp(O2 IMS outbound number=${OUTNUM} cli=${MISSION_CID})
 same => n,Set(GROUP()=o2-ims)
 same => n,GotoIf($[${GROUP_COUNT(o2-ims)} > 10]?o2-ims-limit,s,1)
 same => n,Set(CALLERID(num)=${MISSION_CID})
 same => n,Set(CALLERID(name)=${MISSION_CID})
 same => n,ExecIf($[${LEN(${MISSION_CID})} > 0]?Set(PJSIP_HEADER(add,X-Campaign-CallerID)=${MISSION_CID}))
 same => n,Dial(PJSIP/${OUTNUM}@o2-ims-endpoint,60)
 same => n,NoOp(O2 IMS result DIALSTATUS=${DIALSTATUS} HANGUPCAUSE=${HANGUPCAUSE})
 same => n,Return()

EOF
  FRAGMENT_PATCHED="$(mktemp)"
  awk -v replacement="$COMMON" -v mission_cli="$MISSION_CLI" -v replace_common="$need_common_repair" '
    $0 == "[o2-ims-common]" {
      if (replace_common) {
        while ((getline line < replacement) > 0) print line
        close(replacement)
        replacing_common = 1
        replaced_common = 1
        next
      }
    }
    /^\[globals\][[:space:]]*$/ {
      in_globals = 1
    }
    /^\[[^]]+\][[:space:]]*$/ && $0 != "[globals]" {
      in_globals = 0
    }
    in_globals && /^[[:space:]]*O2_IMS_CLI=/ {
      print "O2_IMS_CLI=" mission_cli
      replaced_cli = 1
      next
    }
    replacing_common && /^\[[^]]+\][[:space:]]*$/ {
      replacing_common = 0
    }
    replacing_common { next }
    { print }
    END {
      if (replace_common && !replaced_common) exit 43
      if (!replaced_cli) exit 44
    }
  ' "$MANAGED_FRAGMENT" > "$FRAGMENT_PATCHED" ||
    die "The O2 fragment has no replaceable [globals] / [o2-ims-common] configuration."

  grep -Fq 'Set(MISSION_CID=${CBC_OUTBOUND_CALLERID})' "$FRAGMENT_PATCHED" ||
    die "Could not add CBC_OUTBOUND_CALLERID to the O2 fragment."
  grep -Fq "O2_IMS_CLI=$MISSION_CLI" "$FRAGMENT_PATCHED" ||
    die "Could not update the O2 fallback Caller ID."
  [[ "$(grep -Fc '[o2-ims-common]' "$FRAGMENT_PATCHED")" -eq 1 ]] ||
    die "Patched O2 fragment does not contain exactly one common route."
else
  rm -f "$FRAGMENT_PATCHED"
  FRAGMENT_PATCHED=""
fi

BRANCH="$(mktemp)"
cat > "$BRANCH" <<'EOF'
 same => n,Set(__CBC_CAMPAIGN_ID=${PJSIP_HEADER(read,X-Campaign-ID)})
 same => n,Set(__CBC_OUTBOUND_TRUNK=${PJSIP_HEADER(read,X-Indexus-Outbound-Trunk)})
 same => n,Set(__CBC_OUTBOUND_CALLERID=${CAMPAIGN_CID})
 same => n,Set(O2_PROVIDER=${PJSIP_HEADER(read,X-Provider)})
 same => n,GotoIf($["${O2_PROVIDER}"!="O2-IMS"]?o2-provider-selection-done)
 same => n,Set(O2_AUTH_ENDPOINT=${CHANNEL(endpoint)})
 same => n,Set(O2_ALLOWED=${DB(o2ims/allowed/${O2_AUTH_ENDPOINT})})
 same => n,GotoIf($["${O2_ALLOWED}"!="1"]?o2-ims-denied,s,1)
 same => n,Set(SERVER_MISSION_AUTH=${DB(o2ims/pendingcid/${O2_AUTH_ENDPOINT})})
 same => n,Set(DELETED_MISSION_AUTH=${DB_DELETE(o2ims/pendingcid/${O2_AUTH_ENDPOINT})})
 same => n,Set(SERVER_MISSION_CID=${CUT(SERVER_MISSION_AUTH,|,1)})
 same => n,Set(SERVER_MISSION_EXP=${CUT(SERVER_MISSION_AUTH,|,2)})
 same => n,GotoIf($["${SERVER_MISSION_CID}"="" | ${SERVER_MISSION_EXP} < ${EPOCH}]?o2-ims-denied,s,1)
 same => n,Set(__CBC_OUTBOUND_CALLERID=${SERVER_MISSION_CID})
 same => n,Goto(route-o2-ims,${EXTEN},1)
 same => n(o2-provider-selection-done),NoOp(O2 provider selection not requested)
EOF

PATCHED="$(mktemp)"
awk -v anchor="$OUTBOUND_ANCHOR" -v injection="$BRANCH" '
  /^\[[^]]+\][[:space:]]*$/ {
    in_outbound = ($0 == "[indexus-outbound]")
  }

  in_outbound && /Set\(__CBC_CAMPAIGN_ID=/ { next }
  in_outbound && /Set\(__CBC_OUTBOUND_TRUNK=/ { next }
  in_outbound && /Set\(__CBC_OUTBOUND_CALLERID=/ { next }

  in_outbound && /Set\(O2_PROVIDER=.*X-Provider/ {
    replacing_o2 = 1
    next
  }
  replacing_o2 {
    if ($0 ~ /n\(o2-provider-selection-done\),/) replacing_o2 = 0
    next
  }

  {
    print
    if (in_outbound && !inserted && index($0, anchor)) {
      while ((getline line < injection) > 0) print line
      close(injection)
      inserted = 1
    }
  }

  END {
    if (!inserted || replacing_o2) exit 42
  }
' "$EXTENSIONS_CONF" > "$PATCHED" ||
  die "Could not replace the O2 branch safely; the live file was not changed."

[[ "$(grep -Fc 'DB(o2ims/pendingcid/${O2_AUTH_ENDPOINT})' "$PATCHED")" -eq 1 ]] ||
  die "Patched dialplan does not contain exactly one pending Caller ID lookup."
[[ "$(grep -Fc 'Goto(route-o2-ims,${EXTEN},1)' "$PATCHED")" -eq 1 ]] ||
  die "Patched dialplan does not contain exactly one O2 route handoff."

if cmp -s "$EXTENSIONS_CONF" "$PATCHED"; then
  log "The live dialplan already contains the current repair."
else
  BACKUP="${EXTENSIONS_CONF}.pre-o2-callerid-repair.$(date +%Y%m%d-%H%M%S).bak"
  cp -a "$EXTENSIONS_CONF" "$BACKUP"
  cat "$PATCHED" > "$EXTENSIONS_CONF"
  log "Dialplan patched. Backup: $BACKUP"
fi

if [[ -n "$FRAGMENT_PATCHED" ]]; then
  FRAGMENT_BACKUP="${MANAGED_FRAGMENT}.pre-o2-callerid-repair.$(date +%Y%m%d-%H%M%S).bak"
  cp -a "$MANAGED_FRAGMENT" "$FRAGMENT_BACKUP"
  cat "$FRAGMENT_PATCHED" > "$MANAGED_FRAGMENT"
  log "Older O2 fragment updated. Backup: $FRAGMENT_BACKUP"
fi

PJSIP_PATCHED="$(mktemp)"
awk '
  /^\[[^]]+\][[:space:]]*$/ {
    in_endpoint = ($0 == "[o2-ims-endpoint]")
  }
  in_endpoint && /^[[:space:]]*from_user[[:space:]]*=/ {
    removed_from_user = 1
    next
  }
  { print }
  END {
    if (!removed_from_user) exit 45
  }
' "$PJSIP_FRAGMENT" > "$PJSIP_PATCHED" || {
  rm -f "$PJSIP_PATCHED"
  PJSIP_PATCHED=""
  if grep -Fq '[o2-ims-endpoint]' "$PJSIP_FRAGMENT" &&
     ! awk '
       /^\[[^]]+\][[:space:]]*$/ { in_endpoint = ($0 == "[o2-ims-endpoint]") }
       in_endpoint && /^[[:space:]]*from_user[[:space:]]*=/ { found = 1 }
       END { exit found ? 0 : 1 }
     ' "$PJSIP_FRAGMENT"; then
    log "O2 endpoint already derives From from CALLERID(num)."
  else
    die "Could not find from_user in [o2-ims-endpoint], and the endpoint is not verifiably present."
  fi
}

if [[ -n "$PJSIP_PATCHED" ]]; then
  if grep -A20 -F '[o2-ims-endpoint]' "$PJSIP_PATCHED" | grep -Eq '^[[:space:]]*from_user[[:space:]]*='; then
    die "The O2 endpoint still contains from_user."
  fi
  PJSIP_BACKUP="${PJSIP_FRAGMENT}.pre-o2-callerid-repair.$(date +%Y%m%d-%H%M%S).bak"
  cp -a "$PJSIP_FRAGMENT" "$PJSIP_BACKUP"
  cat "$PJSIP_PATCHED" > "$PJSIP_FRAGMENT"
  log "O2 endpoint updated to derive From from CALLERID(num). Backup: $PJSIP_BACKUP"
fi

if [[ "${O2_PATCH_SKIP_RELOAD:-}" == "1" ]]; then
  log "Reload skipped by test override."
  exit 0
fi

command -v asterisk >/dev/null 2>&1 || die "Asterisk CLI is missing."
RELOAD_ATTEMPTED=1
reload_output="$(asterisk -rx 'dialplan reload' 2>&1)"
printf '%s\n' "$reload_output"
pjsip_reload_output="$(asterisk -rx 'pjsip reload' 2>&1)"
printf '%s\n' "$pjsip_reload_output"

dialplan_output="$(asterisk -rx 'dialplan show indexus-outbound' 2>&1)"
grep -Fq 'o2ims/pendingcid/${O2_AUTH_ENDPOINT}' <<<"$dialplan_output" ||
  die "Reloaded dialplan does not contain the pending Caller ID lookup."
grep -Fq 'route-o2-ims' <<<"$dialplan_output" ||
  die "Reloaded dialplan does not contain the O2 route handoff."

RELOAD_ATTEMPTED=0
log "Repair applied and reloaded successfully."
log "Next O2 Mission call must show the selected number in P-Asserted-Identity and Remote-Party-ID."