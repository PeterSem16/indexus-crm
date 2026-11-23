#!/usr/bin/env bash
# Operator-only: one Gateway proxy directive, no inference or Gateway restart.
set -euo pipefail
test "$(id -u)" -eq 0
test "$(hostname -s | tr '[:upper:]' '[:lower:]')" = ai
nginx -t
conf="$(readlink -f /etc/nginx/sites-enabled/indexus-ai)"
test -f "$conf"
test "$(stat -c %u "$conf")" -eq 0
parent=/opt/indexus-ai-backups
test -d "$parent"
test ! -L "$parent"
test "$(stat -c %u "$parent")" -eq 0
umask 077
backup="$(mktemp -d "$parent/nginx-gateway-timeout.XXXXXX")"
chmod 700 "$backup"
cp -p -- "$conf" "$backup/original.conf"
chmod 600 "$backup/original.conf"
printf 'BACKUP=%s\n' "$backup"
python3 - "$conf" "$backup/original.conf" <<'PY'
import os, pathlib, re, stat, sys, tempfile
p = pathlib.Path(sys.argv[1])
original = pathlib.Path(sys.argv[2]).read_bytes()
if p.read_bytes() != original:
    raise SystemExit("STOP: configuration changed; no edit")
text = original.decode("utf-8")
pattern = r"(?m)^(?P<i>[ \t]*)location[ \t]+\^~[ \t]+/gateway/[ \t]*\{[^\n]*\n(?P<body>[\s\S]*?)^(?P=i)\}"
matches = list(re.finditer(pattern, text))
if len(matches) != 1:
    raise SystemExit("STOP: expected exactly one Gateway location; no edit")
m = matches[0]
body, count = re.subn(r"(?m)^([ \t]*proxy_read_timeout[ \t]+)150s([ \t]*;[^\n]*)$",
                      r"\g<1>270s\g<2>", m.group("body"))
if count != 1:
    raise SystemExit("STOP: expected exactly one Gateway read timeout of 150s; no edit")
changed = (text[:m.start("body")] + body + text[m.end("body"):]).encode("utf-8")
metadata = p.stat()
fd, temp = tempfile.mkstemp(prefix="indexus-timeout-", dir=p.parent)
try:
    with os.fdopen(fd, "wb") as f:
        f.write(changed)
        os.fchown(f.fileno(), metadata.st_uid, metadata.st_gid)
        os.fchmod(f.fileno(), stat.S_IMODE(metadata.st_mode))
        f.flush()
        os.fsync(f.fileno())
    if p.read_bytes() != original:
        raise SystemExit("STOP: configuration changed; no edit")
    os.replace(temp, p)
finally:
    if os.path.exists(temp):
        os.unlink(temp)
PY
expected="$(sha256sum "$conf" | cut -d' ' -f1)"
if nginx -t && systemctl reload nginx; then
  echo 'NGINX_RELOAD_OK; gateway proxy_read_timeout=270s; no AI calls'
else
  test "$(sha256sum "$conf" | cut -d' ' -f1)" = "$expected" || {
    echo 'MANUAL_REVIEW_REQUIRED: configuration changed; not overwriting'; exit 1;
  }
  cat "$backup/original.conf" > "$conf"
  nginx -t && systemctl reload nginx || {
    echo "MANUAL_REVIEW_REQUIRED: original file restored; check Nginx; backup=$backup"; exit 1;
  }
  echo 'ORIGINAL_CONFIG_RESTORED'
  exit 1
fi
