#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
APP=/var/www/indexus-crm
RUN=/home/seman/.cache/indexus-release-stage/mp-callback-cdf0dc2-NShFKl6s
BASE=0b1bc1c12ea690cd3db2fb01369a7f7dbe370a5e
TARGET=cdf0dc2cbaa2c88b93a7c059f2988f875033e595
BACKUP=/var/www/indexus-crm/data/.indexus-operator-backups/mp-callback-0b1bc1c-to-785f07e-ccFcrWms
cd "$APP"
[[ "$(git rev-parse HEAD)" == "$BASE" ]]
[[ "$(cat "$RUN/base.txt")" == "$BASE" ]]
[[ "$(cat "$RUN/target.txt")" == "$TARGET" ]]
[[ "$(cat "$RUN/backup.txt")" == "$BACKUP" ]]
[[ "$(findmnt -n -o SOURCE --target "$APP/data")" == /dev/sdb1 ]]
sudo test -s "$BACKUP/database.dump"
sudo test -s "$BACKUP/runtime-dist.tar.gz"
[[ "$(sudo stat -c '%U:%a' "$BACKUP")" == root:700 ]]
[[ -d "$APP/dist" && ! -L "$APP/dist" ]]
BRANCH=$(git symbolic-ref -q HEAD)
git diff --cached --quiet
git merge-base --is-ancestor "$BASE" "$TARGET"
(cd "$RUN/stage" && sha256sum --check --quiet "$RUN/build.sha256")
node --check "$RUN/stage/dist/index.cjs"

# Compare physical files, not Git status (which can hide skip-worktree files).
verify_sources() {
python3 -I - "$BASE" "$TARGET" "${1:-}" <<'PY'
import os, pathlib, subprocess, sys
base, target, stage = sys.argv[1:]
def git(*args):
    return subprocess.check_output(["git", *args])
def tree(ref):
    result = {}
    for row in git("ls-tree", "-rz", ref).split(b"\0"):
        if row:
            info, name = row.split(b"\t", 1)
            result[os.fsdecode(name)] = info.split()[2].decode()
    return result
before, after = tree(base), tree(target)
paths = [os.fsdecode(p) for p in git("diff", "--name-only", "-z", base, target).split(b"\0") if p]
assert len(paths) == 129, "STOP: Unexpected release scope"
for name in paths:
    assert name.split("/")[0] in {"client", "server", "shared", "script", "scripts", "docs", "e2e"}, "STOP: Unexpected path"
    assert name in after, "STOP: Deletions are not allowed"
    local, staged = pathlib.Path(name), pathlib.Path(stage, name)
    if name in before:
        assert local.is_file() and not local.is_symlink(), "STOP: Missing or linked source: " + name
        assert git("hash-object", "--no-filters", name).decode().strip() == before[name], "STOP: Modified source: " + name
    else:
        assert not os.path.lexists(local), "STOP: Local file collision: " + name
    if stage:
        assert staged.is_file() and not staged.is_symlink(), "STOP: Missing staged source: " + name
        assert git("hash-object", "--no-filters", str(staged)).decode().strip() == after[name], "STOP: Modified stage: " + name
print("SOURCE_OK: 129 release paths match the pinned source trees.")
PY
}
verify_sources "$RUN/stage"

pid_of_app() {
  pm2 jlist | node -e '
    const fs=require("fs");
    const fail=()=>{console.error("STOP: PM2 metadata does not match the expected single process.");process.exit(1);};
    let all;try{all=JSON.parse(fs.readFileSync(0,"utf8"));}catch{fail();}
    if(!Array.isArray(all))fail();
    const list=all.filter(p=>p.name==="indexus-crm");
    if(list.length!==1)fail();
    const p=list[0],e=p.pm2_env;
    if(p.pm_id!==4||e.status!=="online"||e.exec_mode!=="fork_mode"||
       e.pm_cwd!=="/var/www/indexus-crm"||
       e.pm_exec_path!=="/var/www/indexus-crm/dist/index.cjs")fail();
    process.stdout.write(String(p.pid));'
}
OLD_PID=$(pid_of_app)
[[ "$(ps -o euid= -p "$OLD_PID" | tr -d ' ')" == "$(id -u)" ]]
OLD_HASH=$(sha256sum "$APP/dist/index.cjs" | awk '{print $1}')
OLD_INDEX=$(sha256sum "$APP/dist/public/index.html" | awk '{print $1}')
[[ "$(curl -fsS --max-time 5 http://127.0.0.1:5000/ | sha256sum | awk '{print $1}')" == "$OLD_INDEX" ]]
mapfile -d '' PATHS < <(git diff --name-only -z "$BASE" "$TARGET")

TEMP=$(mktemp -d "$APP/.mp-callback-cdf0dc2-XXXXXXXX")
cp -a "$RUN/stage/dist" "$TEMP/dist"
chmod -R a+rX "$TEMP/dist"
(cd "$TEMP" && sha256sum --check --quiet "$RUN/build.sha256")
# Keep prior assets for already-open browsers; never overwrite the new build.
cp -an "$APP/dist/public/assets/." "$TEMP/dist/public/assets/"
NEW_HASH=$(sha256sum "$TEMP/dist/index.cjs" | awk '{print $1}')
NEW_INDEX=$(sha256sum "$TEMP/dist/public/index.html" | awk '{print $1}')
[[ "$NEW_HASH" != "$OLD_HASH" ]]
RECOVERY=$(sudo mktemp -d "$BACKUP/promotion-cdf0dc2-XXXXXXXX")
printf '%s\n' "$BASE" "$TARGET" "$RUN" | sudo tee "$RECOVERY/release.txt" >/dev/null

exchange() {
  python3 -I - "$1" "$2" <<'PY'
import ctypes, os, sys
libc = ctypes.CDLL(None, use_errno=True)
fn = libc.renameat2
fn.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
fn.restype = ctypes.c_int
if fn(-100, os.fsencode(sys.argv[1]), -100, os.fsencode(sys.argv[2]), 2):
    raise OSError(ctypes.get_errno(), "Atomic directory exchange failed")
PY
}
# Verify support before touching the live runtime.
mkdir "$TEMP/check-a" "$TEMP/check-b"
exchange "$TEMP/check-a" "$TEMP/check-b"
rmdir "$TEMP/check-a" "$TEMP/check-b"

RESTART_REQUIRED=0
rollback() {
  local rc=$?
  trap - ERR INT TERM
  set +e
  if (( rc == 0 )); then rc=1; fi
  echo "DEPLOY_FAILED — vraciam pôvodný kód, nie databázu."
  local ok=1 current
  current=$(sha256sum "$APP/dist/index.cjs" | awk '{print $1}')
  if [[ "$current" == "$NEW_HASH" ]]; then
    [[ "$(sha256sum "$TEMP/dist/index.cjs" | awk '{print $1}')" == "$OLD_HASH" ]] &&
      exchange "$APP/dist" "$TEMP/dist" || ok=0
  elif [[ "$current" != "$OLD_HASH" ]]; then
    ok=0
  fi
  if [[ "$(git rev-parse HEAD)" == "$TARGET" ]]; then
    git restore --source="$BASE" --staged --worktree -- "${PATHS[@]}" &&
      git update-ref "$BRANCH" "$BASE" "$TARGET" || ok=0
  elif [[ "$(git rev-parse HEAD)" != "$BASE" ]]; then
    ok=0
  fi
  verify_sources >/dev/null 2>&1 || ok=0
  if (( RESTART_REQUIRED )); then pm2 restart 4 || ok=0; fi
  local healthy=0
  for i in {1..90}; do
    if pid_of_app >/dev/null 2>&1 &&
       [[ "$(curl -fsS --max-time 2 http://127.0.0.1:5000/ 2>/dev/null | sha256sum | awk '{print $1}')" == "$OLD_INDEX" ]]; then
      healthy=1; break
    fi
    sleep 1
  done
  if (( ok && healthy )); then
    echo "ROLLBACK_OK — pôvodná aplikácia odpovedá; databáza nebola obnovená."
  else
    echo "ROLLBACK_NEEDS_HELP — nespúšťaj ďalšie nasadenie ani obnovu databázy."
  fi
  printf 'Pracovný runtime: %s\nSúkromná záloha: %s\n' "$TEMP" "$BACKUP"
  exit "${rc:-1}"
}
trap rollback ERR INT TERM

# Recheck immediately before the live change.
[[ "$(git rev-parse HEAD)" == "$BASE" ]]
[[ "$(pid_of_app)" == "$OLD_PID" ]]
[[ "$(sha256sum "$APP/dist/index.cjs" | awk '{print $1}')" == "$OLD_HASH" ]]
git -c core.hooksPath=/dev/null merge --ff-only "$TARGET"
RESTART_REQUIRED=1
pm2 stop 4
exchange "$APP/dist" "$TEMP/dist"
pm2 restart 4

HEALTHY=0
for i in {1..120}; do
  PID=$(pid_of_app 2>/dev/null || true)
  INDEX=$(curl -fsS --max-time 2 http://127.0.0.1:5000/ 2>/dev/null | sha256sum | awk '{print $1}' || true)
  if [[ -n "$PID" && "$PID" != "$OLD_PID" && "$INDEX" == "$NEW_INDEX" ]]; then
    HEALTHY=1; break
  fi
  sleep 1
done
[[ "$HEALTHY" == 1 ]]
sleep 10
[[ "$(pid_of_app)" == "$PID" ]]
[[ "$(curl -fsS --max-time 5 http://127.0.0.1:5000/ | sha256sum | awk '{print $1}')" == "$NEW_INDEX" ]]
[[ "$(git rev-parse HEAD)" == "$TARGET" ]]
[[ "$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/campaigns/a65e7775-885c-4413-b2be-e63c92decd3d/status-list-workflows/transition-readiness)" == 401 ]]
trap - ERR INT TERM

# Persist the previous runtime only on the mandated private backup disk.
if sudo mv -- "$TEMP" "$RECOVERY/runtime"; then
  printf '%s\n' "$RECOVERY" > "$RUN/recovery.txt"
else
  echo "BACKUP_MOVE_FAILED — nová aplikácia beží; dočasný starý runtime ponechaný:"
  printf '%s\n' "$TEMP"
  exit 1
fi
printf '\nDEPLOY_OK\nTARGET=%s\nPID=%s\nRECOVERY=%s\n' "$TARGET" "$PID" "$RECOVERY"
echo "Callbacky neboli prepnuté. Teraz treba prihlásené overenie readiness pre Mission."
