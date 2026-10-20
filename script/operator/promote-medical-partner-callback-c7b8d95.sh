#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
APP=/var/www/indexus-crm
RUN=/home/seman/.cache/indexus-release-stage/mp-callback-c7b8d95-vOJ1EKsk
BASE=0b1bc1c12ea690cd3db2fb01369a7f7dbe370a5e
TARGET=c7b8d95010c5b883c92e66bee8fefecbd2296dd0
TREE=c3e08ddbbf1ba4a5afbec507131b4a9f4133010c
EXPECTED_OLD_HASH=6d65e9750789b4b4608d0e81b59f3a49af0e520dd0df618e0c849aba6d23054b
BACKUP=/var/www/indexus-crm/data/.indexus-operator-backups/mp-callback-0b1bc1c-to-785f07e-ccFcrWms
MISSION=a65e7775-885c-4413-b2be-e63c92decd3d
[[ "$(id -un)" == seman && -d "$RUN" && ! -L "$RUN" ]]
[[ "$(stat -c '%u:%a' "$RUN")" == "$(id -u):700" ]]
cd "$APP"
exec 9>"$RUN/promotion.lock"
flock -n 9 || { echo "STOP: Toto nasadenie uz bezi."; exit 1; }
PHASE=PREFLIGHT
LIVE_CHANGED=0
RESTART_REQUIRED=0
note() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$RUN/promotion-progress.log"; }
phase() { PHASE="$1"; note "PHASE=$PHASE"; }

# Only selected metadata is emitted; never print or persist the PM2 environment.
read_state() {
  local state
  state=$(timeout 10s pm2 jlist | node -e '
    const fs=require("fs"),app=process.argv[1];
    const fail=()=>{console.error("STOP: Unexpected PM2 configuration.");process.exit(1);};
    let all;try{all=JSON.parse(fs.readFileSync(0,"utf8"));}catch{fail();}
    if(!Array.isArray(all))fail();
    const list=all.filter(p=>p.name==="indexus-crm");if(list.length!==1)fail();
    const p=list[0],e=p.pm2_env;
    if(p.pm_id!==4||e.exec_mode!=="fork_mode"||e.pm_cwd!==app||
       e.pm_exec_path!==app+"/dist/index.cjs"||
       !Number.isInteger(p.pid)||!Number.isInteger(e.restart_time)||
       !/^[a-z ]+$/.test(e.status))fail();
    process.stdout.write([e.status,p.pid,e.restart_time,
      Buffer.from(e.pm_err_log_path||"").toString("base64")].join("|"));
  ' "$APP") || return 1
  IFS='|' read -r STATUS PID RESTARTS ERROR_LOG_B64 <<< "$state"
}

verify_sources() {
  python3 -I - "$BASE" "$TARGET" "${1:-}" <<'PY'
import os, pathlib, subprocess, sys
base, target, stage = sys.argv[1:]
def git(*args): return subprocess.check_output(["git", *args])
def tree(ref):
    result = {}
    for row in git("ls-tree", "-rz", ref).split(b"\0"):
        if row:
            info, name = row.split(b"\t", 1)
            result[os.fsdecode(name)] = info.split()[2].decode()
    return result
before, after = tree(base), tree(target)
paths = [os.fsdecode(p) for p in git("diff", "--name-only", "-z", base, target).split(b"\0") if p]
assert len(paths) == 131, "STOP: Unexpected release scope"
for name in paths:
    assert name.split("/")[0] in {"client","server","shared","script","scripts","docs","e2e"}, "STOP: Unexpected path"
    assert name in after, "STOP: Deletions are not allowed"
    local = pathlib.Path(name)
    if name in before:
        assert local.is_file() and not local.is_symlink(), "STOP: Missing or linked source: " + name
        assert git("hash-object","--no-filters",name).decode().strip() == before[name], "STOP: Modified source: " + name
    else:
        assert not os.path.lexists(local), "STOP: Local file collision: " + name
    if stage:
        staged = pathlib.Path(stage,name)
        assert staged.is_file() and not staged.is_symlink(), "STOP: Missing staged source: " + name
        assert git("hash-object","--no-filters",str(staged)).decode().strip() == after[name], "STOP: Modified stage: " + name
print("SOURCE_OK: 131 pinned release paths.")
PY
}

exchange() {
  python3 -I - "$1" "$2" <<'PY'
import ctypes, os, sys
libc=ctypes.CDLL(None,use_errno=True)
fn=libc.renameat2
fn.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]
fn.restype=ctypes.c_int
if fn(-100,os.fsencode(sys.argv[1]),-100,os.fsencode(sys.argv[2]),2):
    raise OSError(ctypes.get_errno(),"Atomic directory exchange failed")
PY
}

http_index() {
  HTTP=$(curl -sS --max-time 3 --max-filesize 1048576 -o "$RUN/health-index.tmp" \
    -w '%{http_code}' http://127.0.0.1:5000/ 2>/dev/null) || HTTP=000
  INDEX=""
  if [[ "$HTTP" == 200 && -f "$RUN/health-index.tmp" ]]; then
    INDEX=$(sha256sum "$RUN/health-index.tmp" | awk '{print $1}')
  fi
}

# Read only the new error-log tail. Drop minified source, vendor payloads and PII.
fatal_summary() {
  [[ -f "$RUN/new-error-cursor.json" ]] || return 0
  python3 -I - "$RUN/new-error-cursor.json" <<'PY'
import json, os, re, sys
try:
    c=json.load(open(sys.argv[1])); s=os.stat(c["path"])
    start=c["size"] if c["inode"]==s.st_ino and s.st_size>=c["size"] else 0
    with open(c["path"],"rb") as f:
        f.seek(max(start,s.st_size-131072))
        lines=f.read(131072).decode("utf-8","replace").splitlines()
except (OSError,ValueError,KeyError):
    print("NEW_FATAL_LOG=unavailable"); sys.exit(0)
shown=frames=0
for line in lines:
    if len(line)>800: continue
    fatal=re.match(r"^(?:[A-Za-z]*Error|error|FATAL):",line)
    stack=frames>0 and re.match(r"^\s+at ",line)
    if not (fatal or stack): continue
    line=re.sub(r"(?i)\b(?:https?|wss?|postgres(?:ql)?)://\S+","[URL]",line)
    line=re.sub(r"(?i)\b(?:bearer|authorization|access_?token|refresh_?token|password|secret|api[_ -]?key)\b.*","[REDACTED]",line)
    line=re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}","[EMAIL]",line)
    line=re.sub(r"(?<!\w)\+?\d[\d ()-]{6,}\d(?!\w)","[NUMBER]",line)
    line=re.sub(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+","[TOKEN]",line)
    print(line[:400]); shown+=1
    frames=8 if fatal else frames-1
    if shown>=32: break
if not shown: print("NEW_FATAL_LOG=no_matching_fatal_lines")
PY
}

on_failure() {
  local rc="$1" line="$2" ok=1 healthy=0 current
  trap - ERR INT TERM
  set +e
  (( rc != 0 )) || rc=1
  note "FAILED phase=$PHASE line=$line exit=$rc"
  if (( ! LIVE_CHANGED )); then
    note "PRECHECK_FAILED — ziva aplikacia sa nemenila."
    exit "$rc"
  fi
  fatal_summary | tee -a "$RUN/promotion-progress.log"
  note "ROLLBACK_START — obnovujem kod a runtime, nie databazu."
  if (( RESTART_REQUIRED )); then pm2 stop 4 >/dev/null || ok=0; fi
  current=$(sha256sum "$APP/dist/index.cjs" | awk '{print $1}')
  if [[ "$current" == "$NEW_HASH" ]]; then
    if [[ "$(sha256sum "$TEMP/dist/index.cjs" | awk '{print $1}')" == "$OLD_HASH" ]]; then
      exchange "$APP/dist" "$TEMP/dist" || ok=0
    else ok=0; fi
  elif [[ "$current" != "$OLD_HASH" ]]; then ok=0; fi
  current=$(git rev-parse HEAD)
  if [[ "$current" == "$TARGET" || "$current" == "$BASE" ]]; then
    git restore --source="$BASE" --staged --worktree -- "${PATHS[@]}" || ok=0
    if [[ "$current" == "$TARGET" ]]; then git update-ref "$BRANCH" "$BASE" "$TARGET" || ok=0; fi
  else ok=0; fi
  verify_sources >/dev/null 2>&1 || ok=0
  if (( RESTART_REQUIRED )); then pm2 restart 4 >/dev/null || ok=0; fi
  local until_time=$((SECONDS+90))
  while (( SECONDS < until_time )); do
    http_index
    if read_state && [[ "$STATUS" == online && "$PID" -gt 0 && "$INDEX" == "$OLD_INDEX" ]]; then
      healthy=1; break
    fi
    sleep 1
  done
  if (( ok && healthy )); then
    note "ROLLBACK_OK — povodna aplikacia odpoveda; databaza nebola obnovena."
  else note "ROLLBACK_NEEDS_HELP — nespustaj dalsie nasadenie ani obnovu databazy."; fi
  printf 'RUNTIME=%s\nRECOVERY=%s\nPROGRESS_LOG=%s/promotion-progress.log\n' "$TEMP" "$RECOVERY" "$RUN"
  exit "$rc"
}
trap 'on_failure "$?" "$LINENO"' ERR
trap 'on_failure 130 "$LINENO"' INT
trap 'on_failure 143 "$LINENO"' TERM

phase PREFLIGHT
[[ "$(git rev-parse HEAD)" == "$BASE" ]]
[[ "$(git rev-parse "$TARGET^{tree}")" == "$TREE" ]]
[[ "$(cat "$RUN/base.txt")" == "$BASE" && "$(cat "$RUN/target.txt")" == "$TARGET" ]]
[[ "$(cat "$RUN/backup.txt")" == "$BACKUP" ]]
[[ "$(findmnt -n -o SOURCE --target "$APP/data")" == /dev/sdb1 ]]
sudo test -s "$BACKUP/database.dump"
sudo test -s "$BACKUP/runtime-dist.tar.gz"
[[ "$(sudo stat -c '%U:%a' "$BACKUP")" == root:700 ]]
[[ -d "$APP/dist" && ! -L "$APP/dist" ]]
BRANCH=$(git symbolic-ref -q HEAD)
git diff --cached --quiet
git merge-base --is-ancestor "$BASE" "$TARGET"
git diff --quiet "$BASE" "$TARGET" -- package.json package-lock.json
verify_sources "$RUN/stage"
(cd "$RUN/stage" && sha256sum --check --quiet "$RUN/build.sha256")
node --check "$RUN/stage/dist/index.cjs"
node "$RUN/stage/script/check-release-imports.cjs" "$TARGET"
node --max-old-space-size=2048 "$RUN/stage/script/check-release-exports.cjs" "$TARGET" --baseline "$BASE"
read_state
[[ "$STATUS" == online && "$PID" -gt 0 ]]
OLD_PID="$PID"
[[ "$(ps -o euid= -p "$OLD_PID" | tr -d ' ')" == "$(id -u)" ]]
OLD_HASH=$(sha256sum "$APP/dist/index.cjs" | awk '{print $1}')
[[ "$OLD_HASH" == "$EXPECTED_OLD_HASH" ]]
OLD_INDEX=$(sha256sum "$APP/dist/public/index.html" | awk '{print $1}')
http_index
[[ "$INDEX" == "$OLD_INDEX" ]]
mapfile -d '' PATHS < <(git diff --name-only -z "$BASE" "$TARGET")

phase SCHEMA_PREFLIGHT
PG=(--host=/var/run/postgresql --port=5432 --username=postgres --dbname=indexus_crm --no-password)
# The previous startup reached route registration, after these schema ensures.
# If the observed database does not match that evidence, stop before a restart.
SCHEMA=$(sudo -u postgres psql "${PG[@]}" -XAt -v ON_ERROR_STOP=1 -c \
  "SELECT 'CALLBACK_SCHEMA='||count(*) FROM pg_catalog.pg_tables WHERE schemaname='public' AND tablename IN ('mission_callback_ownership','mission_callback_switches','mission_callback_candidates','mission_callback_events');")
note "$SCHEMA"
[[ "$SCHEMA" == CALLBACK_SCHEMA=4 ]]
OWNER=$(sudo -u postgres psql "${PG[@]}" -XAt -v ON_ERROR_STOP=1 -c "SELECT COALESCE((SELECT owner FROM mission_callback_ownership WHERE campaign_id='$MISSION'),'legacy');")
[[ "$OWNER" == legacy ]]
note "CALLBACK_OWNER=legacy — nemenim ho."

phase FRESH_PRIVATE_BACKUP
DB_SIZE=$(sudo -u postgres psql "${PG[@]}" -XAt -v ON_ERROR_STOP=1 -c 'SELECT pg_database_size(current_database());')
[[ "$DB_SIZE" =~ ^[0-9]+$ ]]
FREE=$(df -PB1 "$APP/data" | awk 'NR==2 {print $4}')
DIST_SIZE=$(du -sb "$APP/dist" | awk '{print $1}')
(( FREE > DB_SIZE + 2*DIST_SIZE + 4294967296 ))
RECOVERY=$(sudo mktemp -d "$BACKUP/promotion-c7b8d95-XXXXXXXX")
sudo chmod 700 "$RECOVERY"
[[ "$(sudo stat -c '%U:%a' "$RECOVERY")" == root:700 ]]
printf '%s\n' "$BASE" "$TARGET" "$RUN" | sudo tee "$RECOVERY/release.txt" >/dev/null
note "READ_ONLY_DATABASE_DUMP — aplikacia zatial dalej bezi."
sudo -u postgres pg_dump "${PG[@]}" -Fc --no-owner --no-acl | sudo tee "$RECOVERY/database.dump" >/dev/null
sudo pg_restore --list "$RECOVERY/database.dump" >/dev/null
sudo -u postgres pg_dump "${PG[@]}" --schema-only --no-owner --no-acl | sudo tee "$RECOVERY/schema-before.sql" >/dev/null
sudo tar -C "$APP" -cf "$RECOVERY/runtime-before.tar" dist
sudo tar -tf "$RECOVERY/runtime-before.tar" >/dev/null
for NAME in .env .env.local .env.production .env.production.local; do
  if [[ -f "$APP/$NAME" ]]; then sudo install -m 600 "$APP/$NAME" "$RECOVERY/$NAME"; fi
done
sudo sh -c 'cd "$1" && sha256sum database.dump schema-before.sql runtime-before.tar > SHA256SUMS && sha256sum --check --quiet SHA256SUMS' sh "$RECOVERY"
phase RUNTIME_PREPARE
TEMP=$(mktemp -d "$APP/.mp-callback-c7b8d95-XXXXXXXX")
cp -a "$RUN/stage/dist" "$TEMP/dist"
chmod -R a+rX "$TEMP/dist"
(cd "$TEMP" && sha256sum --check --quiet "$RUN/build.sha256")
cp -an "$APP/dist/public/assets/." "$TEMP/dist/public/assets/"
NEW_HASH=$(sha256sum "$TEMP/dist/index.cjs" | awk '{print $1}')
NEW_INDEX=$(sha256sum "$TEMP/dist/public/index.html" | awk '{print $1}')
[[ "$NEW_HASH" != "$OLD_HASH" ]]
mkdir "$TEMP/check-a" "$TEMP/check-b"
exchange "$TEMP/check-a" "$TEMP/check-b"
rmdir "$TEMP/check-a" "$TEMP/check-b"

phase FINAL_RECHECK
[[ "$(git rev-parse HEAD)" == "$BASE" ]]
[[ "$(git symbolic-ref -q HEAD)" == "$BRANCH" ]]
verify_sources "$RUN/stage"
read_state
[[ "$STATUS" == online && "$PID" == "$OLD_PID" ]]
[[ "$(sha256sum "$APP/dist/index.cjs" | awk '{print $1}')" == "$OLD_HASH" ]]
http_index
[[ "$INDEX" == "$OLD_INDEX" ]]
python3 -I - "$ERROR_LOG_B64" "$RUN/new-error-cursor.json" <<'PY'
import base64, json, os, sys
p=base64.b64decode(sys.argv[1]).decode()
try: s=os.stat(p); size,inode=s.st_size,s.st_ino
except OSError: size,inode=0,None
with open(sys.argv[2],"w") as f: json.dump({"path":p,"size":size,"inode":inode},f)
PY

phase SOURCE_FAST_FORWARD
LIVE_CHANGED=1
git -c core.hooksPath=/dev/null merge --ff-only --no-edit "$TARGET"
phase STOP_AND_EXCHANGE
RESTART_REQUIRED=1
pm2 stop 4 >/dev/null
exchange "$APP/dist" "$TEMP/dist"
phase START_CANDIDATE
pm2 restart 4 >/dev/null
HEALTHY=0
START_PID=""
START_RESTARTS=""
DEADLINE=$((SECONDS+120))
NEXT_PROGRESS=0
while (( SECONDS < DEADLINE )); do
  read_state
  [[ "$STATUS" == online || "$STATUS" == launching ]]
  if [[ "$PID" -gt 0 && "$PID" != "$OLD_PID" && -z "$START_PID" ]]; then
    START_PID="$PID"; START_RESTARTS="$RESTARTS"
  fi
  [[ -z "$START_PID" || ( "$PID" == "$START_PID" && "$RESTARTS" == "$START_RESTARTS" ) ]]
  http_index
  if (( SECONDS >= NEXT_PROGRESS )); then
    note "WAIT_START status=$STATUS pid=$PID http=$HTTP index_match=$([[ "$INDEX" == "$NEW_INDEX" ]] && echo yes || echo no)"
    NEXT_PROGRESS=$((SECONDS+10))
  fi
  if [[ "$STATUS" == online && -n "$START_PID" && "$INDEX" == "$NEW_INDEX" ]]; then HEALTHY=1; break; fi
  sleep 1
done
[[ "$HEALTHY" == 1 ]]
phase STABILITY
sleep 10
read_state
[[ "$STATUS" == online && "$PID" == "$START_PID" && "$RESTARTS" == "$START_RESTARTS" ]]
http_index
[[ "$INDEX" == "$NEW_INDEX" && "$(git rev-parse HEAD)" == "$TARGET" ]]
[[ "$(sha256sum "$APP/dist/index.cjs" | awk '{print $1}')" == "$NEW_HASH" ]]
[[ "$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:5000/api/campaigns/$MISSION/status-list-workflows/transition-readiness")" == 401 ]]
[[ "$(sudo -u postgres psql "${PG[@]}" -XAt -v ON_ERROR_STOP=1 -c "SELECT COALESCE((SELECT owner FROM mission_callback_ownership WHERE campaign_id='$MISSION'),'legacy');")" == legacy ]]
trap - ERR INT TERM
phase SAVE_OLD_RUNTIME
if ! sudo mv -- "$TEMP" "$RECOVERY/runtime"; then
  note "BACKUP_MOVE_FAILED — nova aplikacia bezi, nic automaticky nevraciam."
  printf 'TEMP=%s\nRECOVERY=%s\n' "$TEMP" "$RECOVERY"
  exit 1
fi
printf '%s\n' "$RECOVERY" > "$RUN/recovery.txt"
note "DEPLOY_OK target=$TARGET pid=$PID"
printf 'TARGET=%s\nPID=%s\nRECOVERY=%s\nPROGRESS_LOG=%s/promotion-progress.log\n' "$TARGET" "$PID" "$RECOVERY" "$RUN"
echo "Callbacky neboli prepnute. Nasleduje prihlasene overenie readiness pre Mission."
