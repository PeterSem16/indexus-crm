#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Usage: $0 [--reload]" >&2
}

reload=0
case "${1-}" in
  "") ;;
  --reload) reload=1 ;;
  *) usage; exit 2 ;;
esac
[[ $# -le 1 ]] || { usage; exit 2; }

TEST_ROOT=${INDEXUS_INSTALL_TEST_ROOT:-}
if [[ ${EUID:-$(id -u)} -ne 0 && -z "$TEST_ROOT" ]]; then
  echo "This installer must run as root." >&2
  exit 1
fi

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SOURCE_HELPER="$SCRIPT_DIR/read-forwarded-cel.py"
if [[ -n "$TEST_ROOT" ]]; then
  [[ "$TEST_ROOT" == /* && "$TEST_ROOT" != / ]] || {
    echo "Test root must be an absolute, non-root path." >&2
    exit 1
  }
  ASTERISK_ETC="$TEST_ROOT/etc/asterisk"
  LIBEXEC_DIR="$TEST_ROOT/usr/local/libexec"
  SPOOL_DIR="$TEST_ROOT/var/log/asterisk/cel-custom"
  BACKUP_ROOT="$TEST_ROOT/var/backups/indexus-forwarded-cel"
  ASTERISK_CLI="$TEST_ROOT/fake-asterisk"
  ASTERISK_USER=$(id -un)
  ASTERISK_GROUP=$(id -gn)
  SYSTEM_USER=$ASTERISK_USER
  SYSTEM_GROUP=$ASTERISK_GROUP
else
  ASTERISK_ETC=${ASTERISK_ETC:-/etc/asterisk}
  LIBEXEC_DIR=${LIBEXEC_DIR:-/usr/local/libexec}
  SPOOL_DIR=${SPOOL_DIR:-/var/log/asterisk/cel-custom}
  BACKUP_ROOT=${BACKUP_ROOT:-/var/backups/indexus-forwarded-cel}
  ASTERISK_CLI=${ASTERISK_CLI:-asterisk}
  ASTERISK_USER=asterisk
  ASTERISK_GROUP=asterisk
  SYSTEM_USER=root
  SYSTEM_GROUP=root
fi
CEL_CONF="$ASTERISK_ETC/cel.conf"
CUSTOM_CONF="$ASTERISK_ETC/cel_custom.conf"
MODULES_CONF="$ASTERISK_ETC/modules.conf"
HELPER="$LIBEXEC_DIR/indexus-read-forwarded-cel"
SPOOL="$SPOOL_DIR/IndexusForwarded.csv"

[[ -f "$SOURCE_HELPER" ]] || { echo "Reader source is missing." >&2; exit 1; }
[[ -f "$CEL_CONF" && -f "$CUSTOM_CONF" ]] || {
  echo "Expected cel.conf and cel_custom.conf." >&2
  exit 1
}

# Includes make ownership of the effective settings ambiguous. Do not alter them.
if grep -Eiq '^[[:space:]]*#(try)?include[[:space:]]' "$CEL_CONF" "$CUSTOM_CONF"; then
  echo "Refusing CEL configuration containing includes; flatten/review it manually." >&2
  exit 1
fi
if grep -Eiq '^[[:space:]]*dateformat[[:space:]]*=[[:space:]]*[^;[:space:]]' "$CEL_CONF"; then
  echo "Refusing nonempty CEL dateformat; epoch timestamps are required." >&2
  exit 1
fi

# With autoload disabled, persistence must already be explicit. This installer
# deliberately does not broaden module loading policy.
if [[ -f "$MODULES_CONF" ]] &&
   grep -Eiq '^[[:space:]]*autoload[[:space:]]*=[[:space:]]*no([[:space:]]*(;.*)?)$' "$MODULES_CONF" &&
   ! grep -Eiq '^[[:space:]]*load[[:space:]]*=[[:space:]]*cel_custom\.so([[:space:]]*(;.*)?)$' "$MODULES_CONF"; then
  echo "cel_custom.so is not configured for load while autoload=no; add an explicit load and rerun." >&2
  exit 1
fi

work=$(mktemp -d)
backup_dir=
declare -a changed=()
rollback() {
  status=$?
  if (( status != 0 )); then
    for record in "${changed[@]}"; do
      target=${record%%|*}
      original=${record#*|}
      if [[ "$original" == CREATED ]]; then
        rm -f -- "$target"
      else
        cp -a -- "$original" "$target"
      fi
    done
    echo "Installation failed; this run's changes were rolled back." >&2
  fi
  rm -rf -- "$work"
  exit "$status"
}
trap rollback EXIT

python3 - "$CEL_CONF" "$CUSTOM_CONF" "$work/cel.conf" "$work/cel_custom.conf" <<'PY'
import configparser
import re
import sys

cel_in, custom_in, cel_out, custom_out = sys.argv[1:]
required_events = {
    "CHAN_START", "CHAN_END", "ANSWER", "HANGUP", "BRIDGE_ENTER",
    "BRIDGE_EXIT", "APP_START", "APP_END", "LINKEDID_END",
}
mapping = (
    'IndexusForwarded.csv => ${CSV_QUOTE(${eventtype})},'
    '${CSV_QUOTE(${eventtime})},${CSV_QUOTE(${CHANNEL(uniqueid)})},'
    '${CSV_QUOTE(${CHANNEL(linkedid)})},${CSV_QUOTE(${CHANNEL(channame)})},'
    '${CSV_QUOTE(${BRIDGEPEER})},${CSV_QUOTE(${CHANNEL(appname)})},'
    '${CSV_QUOTE(${eventextra})}'
)

def update_general(text):
    section = re.search(r"(?im)^[ \t]*\[general\][ \t]*(?:;.*)?$", text)
    if not section:
        raise SystemExit("cel.conf has no [general] section")
    next_section = re.search(r"(?m)^[ \t]*\[[^]\r\n]+\]", text[section.end():])
    end = section.end() + (next_section.start() if next_section else len(text[section.end():]))
    body = text[section.end():end]

    def union_setting(body, name, required, force=None):
        matches = list(re.finditer(rf"(?im)^([ \t]*{name}[ \t]*=[ \t]*)([^;\r\n]*)(.*)$", body))
        if len(matches) > 1:
            raise SystemExit(f"multiple {name} settings in [general]")
        if matches:
            old = matches[0]
            values = [v.strip() for v in old.group(2).split(",") if v.strip()]
            if force is not None:
                values = [force]
            else:
                seen = {v.upper() for v in values}
                values += [v for v in required if v.upper() not in seen]
            replacement = old.group(1) + ",".join(values) + old.group(3)
            return body[:old.start()] + replacement + body[old.end():]
        value = force if force is not None else ",".join(required)
        return body + f"\n{name}={value}\n"

    body = union_setting(body, "enable", (), "yes")
    body = union_setting(body, "events", sorted(required_events))
    body = union_setting(body, "apps", ["dial"])
    return text[:section.end()] + body + text[end:]

with open(cel_in, encoding="utf-8") as handle:
    cel = update_general(handle.read())
with open(custom_in, encoding="utf-8") as handle:
    custom = handle.read()

existing = re.findall(r"(?im)^[ \t]*IndexusForwarded\.csv[ \t]*=>[^\r\n]*", custom)
if existing and any("".join(line.split()) != "".join(mapping.split()) for line in existing):
    raise SystemExit("conflicting IndexusForwarded.csv mapping already exists")
if len(existing) > 1:
    raise SystemExit("duplicate IndexusForwarded.csv mappings")
if not existing:
    mappings = re.search(r"(?im)^[ \t]*\[mappings\][ \t]*(?:;.*)?$", custom)
    if not mappings:
        raise SystemExit("cel_custom.conf has no [mappings] section")
    following = re.search(r"(?m)^[ \t]*\[[^]\r\n]+\]", custom[mappings.end():])
    insertion = mappings.end() + (following.start() if following else len(custom[mappings.end():]))
    prefix = custom[:insertion]
    suffix = custom[insertion:]
    custom = prefix.rstrip() + "\n" + mapping + "\n" + suffix.lstrip("\r\n")

for path, value in ((cel_out, cel), (custom_out, custom)):
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(value)
PY

mkdir -p -- "$BACKUP_ROOT"
backup_dir=$(mktemp -d "$BACKUP_ROOT/run.XXXXXXXX")

replace_file() {
  source=$1 target=$2 mode=$3 owner=$4 group=$5
  if [[ -f "$target" ]] && cmp -s -- "$source" "$target" &&
     [[ "$(stat -c %a "$target")" == "${mode#0}" ]] &&
     [[ "$(stat -c %U "$target")" == "$owner" ]] &&
     [[ "$(stat -c %G "$target")" == "$group" ]]; then
    return
  fi
  if [[ -e "$target" ]]; then
    saved="$backup_dir/$(echo "$target" | sed 's#/#_#g')"
    cp -a -- "$target" "$saved"
    changed+=("$target|$saved")
  else
    changed+=("$target|CREATED")
  fi
  if [[ -n "$TEST_ROOT" ]]; then
    install -D -m "$mode" -- "$source" "$target"
  else
    install -D -m "$mode" -o "$owner" -g "$group" -- "$source" "$target"
  fi
}

replace_file "$work/cel.conf" "$CEL_CONF" "$(stat -c %a "$CEL_CONF")" "$(stat -c %U "$CEL_CONF")" "$(stat -c %G "$CEL_CONF")"
replace_file "$work/cel_custom.conf" "$CUSTOM_CONF" "$(stat -c %a "$CUSTOM_CONF")" "$(stat -c %U "$CUSTOM_CONF")" "$(stat -c %G "$CUSTOM_CONF")"
replace_file "$SOURCE_HELPER" "$HELPER" 0755 "$SYSTEM_USER" "$SYSTEM_GROUP"

getent group "$ASTERISK_GROUP" >/dev/null || { echo "The Asterisk group does not exist." >&2; false; }
if [[ ! -d "$SPOOL_DIR" ]]; then
  if [[ -n "$TEST_ROOT" ]]; then
    install -d -m 0750 -- "$SPOOL_DIR"
  else
    install -d -m 0750 -o "$ASTERISK_USER" -g "$ASTERISK_GROUP" -- "$SPOOL_DIR"
  fi
fi
if [[ ! -e "$SPOOL" ]]; then
  if [[ -n "$TEST_ROOT" ]]; then
    install -m 0640 /dev/null "$SPOOL"
  else
    install -m 0640 -o "$ASTERISK_USER" -g "$ASTERISK_GROUP" /dev/null "$SPOOL"
  fi
  changed+=("$SPOOL|CREATED")
else
  if [[ "$(stat -c %a "$SPOOL")" != 640 ||
        "$(stat -c %U "$SPOOL")" != "$ASTERISK_USER" ||
        "$(stat -c %G "$SPOOL")" != "$ASTERISK_GROUP" ]]; then
    saved="$backup_dir/$(echo "$SPOOL" | sed 's#/#_#g')"
    cp -a -- "$SPOOL" "$saved"
    changed+=("$SPOOL|$saved")
    if [[ -z "$TEST_ROOT" ]]; then
      chown "$ASTERISK_USER:$ASTERISK_GROUP" "$SPOOL"
    fi
    chmod 0640 "$SPOOL"
  fi
fi

if ! "$ASTERISK_CLI" -rx "module show like cel_custom.so" 2>/dev/null | grep -q 'cel_custom\.so'; then
  "$ASTERISK_CLI" -rx "module load cel_custom.so" >/dev/null
fi
if (( reload )); then
  "$ASTERISK_CLI" -rx "cel reload" >/dev/null
fi

trap - EXIT
rm -rf -- "$work"
echo "Indexus forwarded CEL support installed. Backup: $backup_dir"