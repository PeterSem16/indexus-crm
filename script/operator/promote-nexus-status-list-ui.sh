#!/usr/bin/env bash
# Frontend-only correction. Never restart PM2 or change callback ownership/data.
set -Eeuo pipefail
umask 077
APP=/var/www/indexus-crm
BASE=c7b8d95010c5b883c92e66bee8fefecbd2296dd0
TARGET=819909e2bf9fab80a6695df80a82a0849ac35092
[[ "$(id -un)" == seman ]] || { echo "STOP: Spustite ako seman."; exit 1; }
cd "$APP"
for tool in node git sudo tar curl findmnt flock sha256sum timeout; do command -v "$tool" >/dev/null; done
sudo -v
[[ "$(readlink -f "$(findmnt -n -o SOURCE -T "$APP/data")")" == /dev/sdb1 ]]
[[ -d dist/public && ! -L dist/public && -f dist/index.cjs && -f .env ]]
install -d -m 700 "$HOME/.cache/indexus-release-stage"
exec 9>"$HOME/.cache/indexus-release-stage/nexus-status-list-ui.lock"
flock -n 9 || { echo "STOP: Oprava uz bezi."; exit 1; }
RUN=$(mktemp -d "$HOME/.cache/indexus-release-stage/nexus-ui-XXXXXXXX")
PHASE=preflight
PROMOTED=0
BACK=
fail() {
  local code=$?
  trap - ERR
  printf 'STOP: phase=%s, exit=%s, stage=%s\n' "$PHASE" "$code" "$RUN"
  if [[ "$PROMOTED" == 1 ]]; then
    if sudo install -m 644 "$BACK/index.html" "$APP/dist/public/.indexus-ui-rollback.html" &&
       sudo mv -f "$APP/dist/public/.indexus-ui-rollback.html" "$APP/dist/public/index.html"; then
      echo "Povodny frontend index obnoveny. Backend a databaza bez zmeny."
    else
      echo "POZOR: Navrat indexu zlyhal. Zaloha: $BACK"
    fi
  fi
  exit "$code"
}
trap fail ERR
check_source() {
  [[ "$(git rev-parse HEAD)" == "$BASE" ]]
  git diff --quiet
  git diff --cached --quiet
}
check_process() {
  timeout 10s pm2 jlist | node -e '
    const fs=require("fs");
    const all=JSON.parse(fs.readFileSync(0,"utf8"));
    const apps=all.filter(p=>p.name==="indexus-crm");
    if(apps.length!==1)process.exit(1);
    const p=apps[0],e=p.pm2_env;
    if(e.status!=="online"||e.exec_mode!=="fork_mode"||
      e.pm_cwd!=="/var/www/indexus-crm"||
      e.pm_exec_path!=="/var/www/indexus-crm/dist/index.cjs"||!(p.pid>0))process.exit(1);
    process.stdout.write(String(p.pid));
  '
}
check_source
PID=$(check_process)
BACKEND=$(sha256sum dist/index.cjs)
git fetch origin main
[[ "$(git rev-parse origin/main)" == "$TARGET" ]]
[[ "$(git rev-parse "$TARGET^")" == "$BASE" ]]
[[ "$(git diff --name-only "$BASE" "$TARGET")" == $'client/src/components/mobile-agent-workspace.tsx\nclient/src/pages/agent-workspace.tsx' ]]
[[ "$(git diff --numstat "$BASE" "$TARGET")" == $'0\t4\tclient/src/components/mobile-agent-workspace.tsx\n0\t4\tclient/src/pages/agent-workspace.tsx' ]]
PHASE=build
git archive --format=tar "$TARGET" > "$RUN/source.tar"
mkdir "$RUN/source"
tar -xf "$RUN/source.tar" -C "$RUN/source"
ln -s "$APP/node_modules" "$RUN/source/node_modules"
install -m 600 "$APP/.env" "$RUN/source/.env"
(
  cd "$RUN/source"
  NODE_ENV=production "$APP/node_modules/.bin/vite" build > "$RUN/build.log" 2>&1
)
NEW="$RUN/source/dist/public"
[[ -s "$NEW/index.html" && -d "$NEW/assets" ]]
# Fail before promotion on symlinks or any conflicting existing static file.
node - "$NEW" "$APP/dist/public" <<'JS'
const fs=require("fs"),path=require("path"),crypto=require("crypto");
const [source,dest]=process.argv.slice(2);
const hash=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
function visit(dir,rel=""){
  for(const name of fs.readdirSync(dir)){
    const key=path.join(rel,name),file=path.join(dir,name),s=fs.lstatSync(file);
    if(s.isSymbolicLink())throw Error("Symlink in frontend artifact");
    if(s.isDirectory()){visit(file,key);continue;}
    if(!s.isFile())throw Error("Unexpected artifact type");
    const old=path.join(dest,key);
    if(key!=="index.html"&&fs.existsSync(old)&&hash(old)!==hash(file))
      throw Error("Conflicting static file: "+key);
  }
}
visit(source);
JS
check_source
[[ "$(check_process)" == "$PID" && "$(sha256sum dist/index.cjs)" == "$BACKEND" ]]
PHASE=backup
BACK="$APP/data/.indexus-operator-backups/nexus-ui-$(date -u +%Y%m%dT%H%M%SZ)-${RUN##*-}"
sudo install -d -m 700 -o root -g root "$APP/data/.indexus-operator-backups" "$BACK"
sudo tar -C "$APP/dist" -cf "$BACK/frontend.tar" public
sudo tar -C "$APP/dist" -df "$BACK/frontend.tar"
sudo cp "$APP/dist/public/index.html" "$BACK/index.html"
sudo cmp "$BACK/index.html" "$APP/dist/public/index.html"
PHASE=assets
find "$NEW" -type d -exec chmod 755 {} +
find "$NEW" -type f -exec chmod 644 {} +
# Keep all old hashed assets for already-open tabs; do not replace the live index yet.
cp -an "$NEW/." "$APP/dist/public/"
check_source
[[ "$(check_process)" == "$PID" && "$(sha256sum dist/index.cjs)" == "$BACKEND" ]]
PHASE=promotion
install -m 644 "$NEW/index.html" "$APP/dist/public/.indexus-ui-next.html"
PROMOTED=1
mv -f "$APP/dist/public/.indexus-ui-next.html" "$APP/dist/public/index.html"
PHASE=verification
curl -fsS --max-time 15 --max-filesize 1048576 http://127.0.0.1:5000/ -o "$RUN/served.html"
cmp "$NEW/index.html" "$RUN/served.html"
[[ "$(check_process)" == "$PID" && "$(sha256sum dist/index.cjs)" == "$BACKEND" ]]
PHASE=source
git merge --ff-only "$TARGET"
PROMOTED=0
trap - ERR
printf 'OK: frontend=%s, backend PID=%s bez restartu\nSukromna zaloha: %s\n' "$TARGET" "$PID" "$BACK"
echo "Databaza, odpovede a vlastnictvo callbackov sa nemenili. Obnovte prehliadac."
