#!/usr/bin/env bash
#
# Install the isolated O2 IMS trunk on mediagtw.
#
# This script is intentionally meant to run ON mediagtw as root. It never
# accepts the SIP password as a command-line argument and never prints it.
#
# Usage:
#   sudo ./install-o2-ims-trunk.sh
#   sudo ./install-o2-ims-trunk.sh --reload
#   sudo ./install-o2-ims-trunk.sh --update-existing --reload
#
set -Eeuo pipefail
umask 077

readonly PROVIDER_HOST="sipt1.ims.o2bs.sk"
readonly PROVIDER_PORT="5060"
readonly SIP_USERNAME="421222190337"
readonly DEFAULT_PJSIP_CONF="/etc/asterisk/pjsip.conf"
readonly DEFAULT_EXTENSIONS_CONF="/etc/asterisk/extensions.conf"
readonly MANAGED_PJSIP_FRAGMENT="pjsip-o2-ims.conf"
readonly MANAGED_PJSIP_SECRET="pjsip-o2-ims-secret.conf"
readonly MANAGED_EXTENSIONS_FRAGMENT="extensions-o2-ims.conf"
readonly BACKUP_PREFIX="o2-ims-backup"

PJSIP_CONF="${PJSIP_CONF:-$DEFAULT_PJSIP_CONF}"
EXTENSIONS_CONF="${EXTENSIONS_CONF:-$DEFAULT_EXTENSIONS_CONF}"
RELOAD=0
UPDATE_EXISTING=0
PJSIP_BACKUP=""
EXTENSIONS_BACKUP=""
PJSIP_FRAGMENT_PATH=""
PJSIP_SECRET_PATH=""
EXTENSIONS_FRAGMENT_PATH=""
CLI_NUMBER=""
SIP_PASSWORD=""
declare -a PROVIDER_IPS=()
declare -a INSTALL_OWNER_ARGS=()
RUNNING_AS_ROOT=0
ASTERISK_USER=""
ASTERISK_GROUP=""
PJSIP_RELOAD_ATTEMPTED=0
DIALPLAN_RELOAD_ATTEMPTED=0
SECRET_MODE="0600"

log() {
  printf '[o2-ims] %s\n' "$*"
}

die() {
  printf '[o2-ims] ERROR: %s\n' "$*" >&2
  return 1
}

cleanup_sensitive() {
  SIP_PASSWORD=""
}

rollback() {
  local status=$?
  if [[ "$status" -eq 0 ]]; then
    return
  fi

  trap - ERR
  set +e
  printf '[o2-ims] Installation failed; restoring configuration backups.\n' >&2
  if [[ -n "$PJSIP_BACKUP" && -f "$PJSIP_BACKUP" ]]; then
    cp -a "$PJSIP_BACKUP" "$PJSIP_CONF" || true
  fi
  if [[ -n "$EXTENSIONS_BACKUP" && -f "$EXTENSIONS_BACKUP" ]]; then
    cp -a "$EXTENSIONS_BACKUP" "$EXTENSIONS_CONF" || true
  fi
  rm -f "$PJSIP_FRAGMENT_PATH" "$PJSIP_SECRET_PATH" "$EXTENSIONS_FRAGMENT_PATH"
  if [[ "$PJSIP_RELOAD_ATTEMPTED" -eq 1 ]]; then
    printf '[o2-ims] Reloading restored PJSIP configuration.\n' >&2
    asterisk -rx 'pjsip reload' >/dev/null 2>&1 ||
      printf '[o2-ims] WARNING: restored PJSIP configuration could not be reloaded.\n' >&2
  fi
  if [[ "$DIALPLAN_RELOAD_ATTEMPTED" -eq 1 ]]; then
    printf '[o2-ims] Reloading restored dialplan configuration.\n' >&2
    asterisk -rx 'dialplan reload' >/dev/null 2>&1 ||
      printf '[o2-ims] WARNING: restored dialplan configuration could not be reloaded.\n' >&2
  fi
  cleanup_sensitive
  exit "$status"
}

trap rollback ERR
trap cleanup_sensitive EXIT

for arg in "$@"; do
  case "$arg" in
    --reload)
      RELOAD=1
      ;;
    --update-existing)
      UPDATE_EXISTING=1
      ;;
    --help|-h)
      sed -n '1,18p' "$0"
      exit 0
      ;;
    *)
      die "Unknown argument: $arg"
      ;;
  esac
done

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  RUNNING_AS_ROOT=1
  INSTALL_OWNER_ARGS=(-o root -g root)
elif [[ "${O2_IMS_ALLOW_NONROOT_TEST:-}" != "1" ]]; then
  die "Run this script as root on mediagtw."
fi
[[ -f "$PJSIP_CONF" ]] || die "PJSIP config not found: $PJSIP_CONF"
[[ -f "$EXTENSIONS_CONF" ]] || die "Dialplan config not found: $EXTENSIONS_CONF"

if [[ "$RUNNING_AS_ROOT" -ne 1 ]] &&
   { [[ "$PJSIP_CONF" == /etc/asterisk/* ]] || [[ "$EXTENSIONS_CONF" == /etc/asterisk/* ]]; }; then
  die "The non-root test override cannot write under /etc/asterisk."
fi

for command in asterisk getent awk sort mktemp install cp grep stat date dirname chmod sed; do
  command -v "$command" >/dev/null 2>&1 || die "Required command is missing: $command"
done

if [[ "$RUNNING_AS_ROOT" -eq 1 ]]; then
  for command in pgrep ps chown; do
    command -v "$command" >/dev/null 2>&1 || die "Required command is missing: $command"
  done
  asterisk_pid="$(pgrep -xo asterisk || true)"
  [[ -n "$asterisk_pid" ]] || die "Asterisk must be running so its service account can be detected."
  asterisk_cmdline="$(ps -o args= -p "$asterisk_pid")"
  ASTERISK_USER="$(printf '%s\n' "$asterisk_cmdline" | sed -n 's/.*[[:space:]]-U[[:space:]]\([^[:space:]]*\).*/\1/p')"
  ASTERISK_GROUP="$(printf '%s\n' "$asterisk_cmdline" | sed -n 's/.*[[:space:]]-G[[:space:]]\([^[:space:]]*\).*/\1/p')"
  ASTERISK_USER="${ASTERISK_USER:-$(ps -o user= -p "$asterisk_pid" | awk 'NR == 1 { gsub(/^[[:space:]]+|[[:space:]]+$/, ""); print }')}"
  ASTERISK_GROUP="${ASTERISK_GROUP:-$(ps -o group= -p "$asterisk_pid" | awk 'NR == 1 { gsub(/^[[:space:]]+|[[:space:]]+$/, ""); print }')}"
  [[ -n "$ASTERISK_USER" && -n "$ASTERISK_GROUP" ]] ||
    die "Could not detect the Asterisk service account."
else
  ASTERISK_USER="$(id -un)"
  ASTERISK_GROUP="$(id -gn)"
fi

PJSIP_DIR="$(dirname "$PJSIP_CONF")"
EXTENSIONS_DIR="$(dirname "$EXTENSIONS_CONF")"
PJSIP_FRAGMENT_PATH="$PJSIP_DIR/$MANAGED_PJSIP_FRAGMENT"
PJSIP_SECRET_PATH="$PJSIP_DIR/$MANAGED_PJSIP_SECRET"
EXTENSIONS_FRAGMENT_PATH="$EXTENSIONS_DIR/$MANAGED_EXTENSIONS_FRAGMENT"

[[ "$PJSIP_DIR" == "$EXTENSIONS_DIR" ]] || die "pjsip.conf and extensions.conf must share their Asterisk config directory."

managed_installation_exists=0
if grep -Fq "BEGIN INDEXUS O2 IMS" "$PJSIP_CONF" ||
   grep -Fq "BEGIN INDEXUS O2 IMS" "$EXTENSIONS_CONF" ||
   [[ -f "$PJSIP_FRAGMENT_PATH" ]] ||
   [[ -f "$EXTENSIONS_FRAGMENT_PATH" ]]; then
  managed_installation_exists=1
fi

if [[ "$managed_installation_exists" -eq 1 && "$UPDATE_EXISTING" -ne 1 ]]; then
  die "An O2 IMS managed installation already exists. Use --update-existing --reload to update its managed fragments safely, or restore its backup before a fresh install."
fi

if [[ "$managed_installation_exists" -eq 1 && "$UPDATE_EXISTING" -eq 1 ]]; then
  [[ -f "$PJSIP_FRAGMENT_PATH" ]] || die "Managed PJSIP fragment is missing: $PJSIP_FRAGMENT_PATH"
  [[ -f "$EXTENSIONS_FRAGMENT_PATH" ]] || die "Managed dialplan fragment is missing: $EXTENSIONS_FRAGMENT_PATH"

  timestamp="$(date +%Y%m%d-%H%M%S)"
  PJSIP_BACKUP="$PJSIP_CONF.$BACKUP_PREFIX.$timestamp.bak"
  EXTENSIONS_BACKUP="$EXTENSIONS_CONF.$BACKUP_PREFIX.$timestamp.bak"
  cp -a "$PJSIP_CONF" "$PJSIP_BACKUP"
  cp -a "$EXTENSIONS_CONF" "$EXTENSIONS_BACKUP"
  log "Backups created: $PJSIP_BACKUP and $EXTENSIONS_BACKUP"

  updated_pjsip_fragment="$(mktemp)"
  awk '
    BEGIN { in_endpoint = 0; has_trust = 0 }
    /^\[o2-ims-endpoint\][[:space:]]*$/ {
      in_endpoint = 1
      has_trust = 0
      print
      next
    }
    in_endpoint && /^\[/ {
      if (!has_trust) print "trust_id_inbound=yes"
      in_endpoint = 0
    }
    in_endpoint && /^[[:space:]]*trust_id_inbound[[:space:]]*=/ {
      has_trust = 1
    }
    { print }
    END {
      if (in_endpoint && !has_trust) print "trust_id_inbound=yes"
    }
  ' "$PJSIP_FRAGMENT_PATH" > "$updated_pjsip_fragment"
  install "${INSTALL_OWNER_ARGS[@]}" -m 0644 "$updated_pjsip_fragment" "$PJSIP_FRAGMENT_PATH"
  rm -f "$updated_pjsip_fragment"

  updated_extensions_fragment="$(mktemp)"
  awk '
    /CHANNEL\(recvip\)/ { next }
    {
      gsub(/Stasis\(\$\{INDEXUS_ARI_APP\}\)[[:space:]]*$/, "Stasis(${INDEXUS_ARI_APP},${ARG1})")
      print
    }
  ' "$EXTENSIONS_FRAGMENT_PATH" > "$updated_extensions_fragment"
  install "${INSTALL_OWNER_ARGS[@]}" -m 0644 "$updated_extensions_fragment" "$EXTENSIONS_FRAGMENT_PATH"
  rm -f "$updated_extensions_fragment"

  log "Updated existing O2 IMS managed fragments without replacing the protected SIP secret."
  if [[ "$RELOAD" -eq 1 ]]; then
    log "Reloading PJSIP..."
    PJSIP_RELOAD_ATTEMPTED=1
    pjsip_reload_output="$(asterisk -rx 'pjsip reload' 2>&1)"
    printf '%s\n' "$pjsip_reload_output"
    if printf '%s\n' "$pjsip_reload_output" | grep -Eiq 'error|failed|unable'; then
      die "PJSIP reload reported an error; backups remain available."
    fi

    log "Reloading dialplan..."
    DIALPLAN_RELOAD_ATTEMPTED=1
    dialplan_reload_output="$(asterisk -rx 'dialplan reload' 2>&1)"
    printf '%s\n' "$dialplan_reload_output"
    if printf '%s\n' "$dialplan_reload_output" | grep -Eiq 'error|failed|unable'; then
      die "Dialplan reload reported an error; backups remain available."
    fi
  fi
  log "Existing O2 IMS update finished. Backups are retained."
  exit 0
fi

mapfile -t PROVIDER_IPS < <(getent ahostsv4 "$PROVIDER_HOST" | awk '{print $1}' | sort -u)
[[ "${#PROVIDER_IPS[@]}" -gt 0 ]] || die "Could not resolve $PROVIDER_HOST to an IPv4 address."

if [[ -n "${O2_IMS_CLI:-}" ]]; then
  CLI_NUMBER="$O2_IMS_CLI"
else
  printf 'Enter the exact O2-authorized outbound CLI in the form +42122213323x: '
  read -r CLI_NUMBER < /dev/tty
fi
[[ "$CLI_NUMBER" =~ ^\+42122213323[0-9]$ ]] ||
  die "CLI must be one of the assigned +42122213323x numbers."

if [[ -n "${O2_SIP_PASSWORD_FILE:-}" ]]; then
  [[ -f "$O2_SIP_PASSWORD_FILE" ]] || die "O2_SIP_PASSWORD_FILE does not exist."
  password_mode="$(stat -c '%a' "$O2_SIP_PASSWORD_FILE" 2>/dev/null || true)"
  [[ "$password_mode" == "600" || "$password_mode" == "400" ]] ||
    die "O2_SIP_PASSWORD_FILE must have mode 600 or 400."
  IFS= read -r SIP_PASSWORD < "$O2_SIP_PASSWORD_FILE"
else
  printf 'Enter the O2 SIP password (input hidden): '
  read -r -s SIP_PASSWORD < /dev/tty
  printf '\n'
fi
[[ -n "$SIP_PASSWORD" ]] || die "The O2 SIP password cannot be empty."
[[ "$SIP_PASSWORD" != *$'\r'* && "$SIP_PASSWORD" != *$'\n'* ]] ||
  die "The O2 SIP password must be a single line."

timestamp="$(date +%Y%m%d-%H%M%S)"
PJSIP_BACKUP="$PJSIP_CONF.$BACKUP_PREFIX.$timestamp.bak"
EXTENSIONS_BACKUP="$EXTENSIONS_CONF.$BACKUP_PREFIX.$timestamp.bak"
cp -a "$PJSIP_CONF" "$PJSIP_BACKUP"
cp -a "$EXTENSIONS_CONF" "$EXTENSIONS_BACKUP"
log "Backups created: $PJSIP_BACKUP and $EXTENSIONS_BACKUP"

# Quote the password as an Asterisk config value. The password is only held in
# this process until the protected secret file is written.
escaped_password="${SIP_PASSWORD//\\/\\\\}"
escaped_password="${escaped_password//\"/\\\"}"

{
  cat <<EOF
; BEGIN INDEXUS O2 IMS
; Generated by install-o2-ims-trunk.sh. Do not put the password in this file.

[o2-ims-auth]
type=auth
auth_type=userpass
username=$SIP_USERNAME
realm=*
#include $PJSIP_SECRET_PATH

[o2-ims-registration]
type=registration
transport=transport-udp
outbound_auth=o2-ims-auth
server_uri=sip:$PROVIDER_HOST:$PROVIDER_PORT
client_uri=sip:$SIP_USERNAME@$PROVIDER_HOST
contact_user=$SIP_USERNAME
retry_interval=60
forbidden_retry_interval=300
expiration=300
auth_rejection_permanent=no

[o2-ims-aor]
type=aor
contact=sip:$PROVIDER_HOST:$PROVIDER_PORT
qualify_frequency=30
qualify_timeout=3

[o2-ims-endpoint]
type=endpoint
transport=transport-udp
context=from-o2-ims
disallow=all
allow=alaw,ulaw,g729
aors=o2-ims-aor
outbound_auth=o2-ims-auth
from_user=$SIP_USERNAME
from_domain=$PROVIDER_HOST
callerid=$CLI_NUMBER
dtmf_mode=rfc4733
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
rtp_keepalive=15
rtp_timeout=60
timers=no
send_pai=yes
send_rpid=yes
trust_id_inbound=yes
trust_id_outbound=yes
identify_by=ip
max_audio_streams=1
max_video_streams=0

EOF
  identify_number=0
  for provider_ip in "${PROVIDER_IPS[@]}"; do
    identify_number=$((identify_number + 1))
    cat <<EOF
[o2-ims-identify-$identify_number]
type=identify
endpoint=o2-ims-endpoint
match=$provider_ip/32

EOF
  done
  printf '; END INDEXUS O2 IMS\n'
} > "$PJSIP_FRAGMENT_PATH"

printf 'password="%s"\n' "$escaped_password" > "$PJSIP_SECRET_PATH"

cat > "$EXTENSIONS_FRAGMENT_PATH" <<EOF
; BEGIN INDEXUS O2 IMS
; Generated by install-o2-ims-trunk.sh. Do not edit the live file manually.

[globals]
O2_IMS_CLI=$CLI_NUMBER

; Explicit provider-selected route. Existing country routes remain unchanged.
[route-o2-ims]
exten => _+X.,1,Goto(o2-ims-dial,\${EXTEN},1)
exten => _X.,1,Goto(o2-ims-dial,\${EXTEN},1)

[o2-ims-dial]
; Already-E.164 input.
exten => _+X.,1,Set(OUTNUM=\${EXTEN})
 same => n,Gosub(o2-ims-common,s,1)
 same => n,Hangup()

; Digits without a plus are normalized to E.164 before Dial().
exten => _X.,1,GotoIf(\$["\${EXTEN:0:2}"="00"]?o2-00)
 same => n,GotoIf(\$["\${EXTEN:0:3}"="421"]?o2-421)
 same => n,GotoIf(\$["\${EXTEN:0:1}"="0"]?o2-national)
 same => n,Set(OUTNUM=+\${EXTEN})
 same => n,Gosub(o2-ims-common,s,1)
 same => n,Hangup()
 same => n(o2-00),Set(OUTNUM=+\${EXTEN:2})
 same => n,Gosub(o2-ims-common,s,1)
 same => n,Hangup()
 same => n(o2-421),Set(OUTNUM=+\${EXTEN})
 same => n,Gosub(o2-ims-common,s,1)
 same => n,Hangup()
 same => n(o2-national),Set(OUTNUM=+421\${EXTEN:1})
 same => n,Gosub(o2-ims-common,s,1)
 same => n,Hangup()

[o2-ims-common]
exten => s,1,NoOp(O2 IMS outbound number=\${OUTNUM} cli=\${O2_IMS_CLI})
 same => n,Set(GROUP()=o2-ims)
 same => n,GotoIf(\$[\${GROUP_COUNT(o2-ims)} > 10]?o2-ims-limit,s,1)
 same => n,Set(CALLERID(num)=\${O2_IMS_CLI})
 same => n,Set(CALLERID(name)=\${O2_IMS_CLI})
 same => n,Set(CAMPAIGN_CID=\${PJSIP_HEADER(read,X-Campaign-CallerID)})
 same => n,ExecIf(\$[\${LEN(\${CAMPAIGN_CID})} > 0]?Set(PJSIP_HEADER(add,X-Campaign-CallerID)=\${CAMPAIGN_CID}))
 same => n,Dial(PJSIP/\${OUTNUM}@o2-ims-endpoint,60)
 same => n,NoOp(O2 IMS result DIALSTATUS=\${DIALSTATUS} HANGUPCAUSE=\${HANGUPCAUSE})
 same => n,Return()

[from-o2-ims]
exten => _+42122213323X,1,Gosub(o2-ims-inbound,s,1(\${EXTEN:1}))
 same => n,Hangup()
exten => _42122213323X,1,Gosub(o2-ims-inbound,s,1(\${EXTEN}))
 same => n,Hangup()
exten => +421940682394,1,Gosub(o2-ims-inbound,s,1(421940682394))
 same => n,Hangup()
exten => 421940682394,1,Gosub(o2-ims-inbound,s,1(\${EXTEN}))
 same => n,Hangup()
exten => _+X.,1,Goto(o2-ims-rejected,s,1)
exten => _X.,1,Goto(o2-ims-rejected,s,1)

[o2-ims-inbound]
exten => s,1,NoOp(INBOUND O2 IMS DID=\${ARG1} CID=\${CALLERID(all)})
 same => n,Set(GROUP()=o2-ims)
 same => n,GotoIf(\$[\${GROUP_COUNT(o2-ims)} > 10]?o2-ims-limit,s,1)
 same => n,Set(__CBC_SOURCE_TRUNK=O2)
 same => n,Set(__CBC_DID=\${ARG1})
 same => n,Set(__CBC_CALLER=\${CALLERID(num)})
 same => n,Stasis(\${INDEXUS_ARI_APP},\${ARG1})
 same => n,Return()

[o2-ims-rejected]
exten => s,1,NoOp(Rejecting unassigned O2 IMS DID=\${EXTEN})
 same => n,Hangup(1)

[o2-ims-denied]
exten => s,1,NoOp(Rejecting unauthorized O2 IMS route request from endpoint=\${O2_AUTH_ENDPOINT})
 same => n,Hangup(21)

[o2-ims-limit]
exten => s,1,NoOp(O2 IMS concurrent channel limit reached)
 same => n,Hangup(34)

; END INDEXUS O2 IMS
EOF

# Keep the existing dialplan's country routing as the default. O2 is selected
# only when the caller sends X-Provider: O2-IMS AND its authenticated endpoint
# is entitled
# through the server-side AstDB o2ims/allowed family.
readonly OUTBOUND_ANCHOR='NoOp(Outbound CID: ext=${ORIG_EXT} collab=${COLLAB_CID} campaign=${CAMPAIGN_CID} final=${CALLERID(num)})'
branch_file="$(mktemp)"
cat > "$branch_file" <<'EOF'
 same => n,Set(O2_PROVIDER=${PJSIP_HEADER(read,X-Provider)})
 same => n,GotoIf($["${O2_PROVIDER}"!="O2-IMS"]?o2-provider-selection-done)
 same => n,Set(O2_AUTH_ENDPOINT=${CHANNEL(endpoint)})
 same => n,Set(O2_ALLOWED=${DB(o2ims/allowed/${O2_AUTH_ENDPOINT})})
 same => n,GotoIf($["${O2_ALLOWED}"="1"]?route-o2-ims,${EXTEN},1:o2-ims-denied,s,1)
 same => n(o2-provider-selection-done),NoOp(O2 provider selection not requested)
EOF
patched_extensions="$(mktemp)"
awk -v anchor="$OUTBOUND_ANCHOR" -v injection="$branch_file" '
  {
    print
    if (!inserted && index($0, anchor)) {
      while ((getline line < injection) > 0) print line
      close(injection)
      inserted = 1
    }
  }
  END {
    if (!inserted) exit 42
  }
' "$EXTENSIONS_CONF" > "$patched_extensions" || {
  rm -f "$branch_file" "$patched_extensions"
  die "Could not find the expected indexus-outbound anchor; no live config was changed."
}
rm -f "$branch_file"
install "${INSTALL_OWNER_ARGS[@]}" -m 0644 "$patched_extensions" "$EXTENSIONS_CONF"
rm -f "$patched_extensions"

ensure_include() {
  local config_file="$1"
  local include_file="$2"
  if grep -Fqx "#include $include_file" "$config_file"; then
    return
  fi
  {
    printf '\n; BEGIN INDEXUS O2 IMS INCLUDE\n'
    printf '#include %s\n' "$include_file"
    printf '; END INDEXUS O2 IMS INCLUDE\n'
  } >> "$config_file"
}

ensure_include "$PJSIP_CONF" "$MANAGED_PJSIP_FRAGMENT"
ensure_include "$EXTENSIONS_CONF" "$MANAGED_EXTENSIONS_FRAGMENT"
if [[ "$RUNNING_AS_ROOT" -eq 1 ]]; then
  chown root:root "$PJSIP_FRAGMENT_PATH" "$EXTENSIONS_FRAGMENT_PATH"
  chown "root:$ASTERISK_GROUP" "$PJSIP_SECRET_PATH"
fi
chmod 0644 "$PJSIP_FRAGMENT_PATH" "$EXTENSIONS_FRAGMENT_PATH"
if [[ "$ASTERISK_USER" == "root" ]]; then
  chmod 0600 "$PJSIP_SECRET_PATH"
  SECRET_MODE="0600"
else
  chmod 0640 "$PJSIP_SECRET_PATH"
  SECRET_MODE="0640"
fi
if [[ "$RUNNING_AS_ROOT" -eq 1 && "$ASTERISK_USER" != "root" ]]; then
  command -v runuser >/dev/null 2>&1 || die "runuser is required to verify Asterisk can read the secret."
  runuser -u "$ASTERISK_USER" -- test -r "$PJSIP_SECRET_PATH" ||
    die "The Asterisk service account cannot read the protected SIP password file."
else
  [[ -r "$PJSIP_SECRET_PATH" ]] ||
    die "The protected SIP password file is not readable by the current service account."
fi

log "O2 IMS configuration installed for $PROVIDER_HOST (${PROVIDER_IPS[*]})."
log "Outbound O2 selection requires X-Provider: O2-IMS and a server-side extension entitlement."
log "The SIP password is stored only in $PJSIP_SECRET_PATH with mode $SECRET_MODE for Asterisk user $ASTERISK_USER."

if [[ "$RELOAD" -eq 1 ]]; then
  log "Reloading PJSIP..."
  PJSIP_RELOAD_ATTEMPTED=1
  pjsip_reload_output="$(asterisk -rx 'pjsip reload' 2>&1)"
  printf '%s\n' "$pjsip_reload_output"
  if printf '%s\n' "$pjsip_reload_output" | grep -Eiq 'error|failed|unable'; then
    die "PJSIP reload reported an error; backups remain available."
  fi

  log "Reloading dialplan..."
  DIALPLAN_RELOAD_ATTEMPTED=1
  dialplan_reload_output="$(asterisk -rx 'dialplan reload' 2>&1)"
  printf '%s\n' "$dialplan_reload_output"
  if printf '%s\n' "$dialplan_reload_output" | grep -Eiq 'error|failed|unable'; then
    die "Dialplan reload reported an error; backups remain available."
  fi

  log "Checking registered endpoint objects..."
  asterisk -rx 'pjsip show registrations' | grep -F 'o2-ims-registration'
  asterisk -rx 'pjsip show endpoint o2-ims-endpoint' | grep -E 'Endpoint:|Transport:|Aor:|allow|context|outbound_auth|from_domain|identify_by'
  asterisk -rx 'dialplan show route-o2-ims'
  asterisk -rx 'dialplan show from-o2-ims'
fi

trap - ERR
cleanup_sensitive
log "Installation finished. Backups are retained; test registration and calls before removing them."