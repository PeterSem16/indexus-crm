#!/usr/bin/env bash
# Backend-only promotion. No callback ownership writes, replay or DB restore.
set -Eeuo pipefail
umask 077
APP=/var/www/indexus-crm
BASE=819909e2bf9fab80a6695df80a82a0849ac35092
TARGET=40d636fff452f6f493c0c197141cfcb4157f0419
[[ "$(id -un)" == seman ]] || { echo "STOP: Spustite ako seman."; exit 1; }
cd "$APP"
for tool in node git sudo tar curl findmnt flock sha256sum timeout pm2 pg_restore; do command -v "$tool" >/dev/null; done
sudo -v
[[ "$(readlink -f "$(findmnt -n -o SOURCE -T "$APP/data")")" == /dev/sdb1 ]]
[[ -f dist/index.cjs && ! -L dist/index.cjs && -f dist/public/index.html && -f .env && -d node_modules ]]
install -d -m 700 "$HOME/.cache/indexus-release-stage"
exec 9>"$HOME/.cache/indexus-release-stage/callback-independent-actions.lock"
flock -n 9 || { echo "STOP: Nasadenie uz bezi."; exit 1; }
RUN=$(mktemp -d "$HOME/.cache/indexus-release-stage/callback-independent-XXXXXXXX")
PHASE=preflight
PROMOTED=0
BACK=
echo "Priprava: $RUN"
check_source() {
  [[ "$(git rev-parse HEAD)" == "$BASE" ]]
  git diff --quiet
  git diff --cached --quiet
}
check_process() {
  timeout 10s pm2 jlist | node -e '
    const fs=require("fs"),all=JSON.parse(fs.readFileSync(0,"utf8"));
    const apps=all.filter(p=>p.name==="indexus-crm");
    if(apps.length!==1)process.exit(1);
    const p=apps[0],e=p.pm2_env;
    if(e.status!=="online"||e.exec_mode!=="fork_mode"||
       e.pm_cwd!=="/var/www/indexus-crm"||
       e.pm_exec_path!=="/var/www/indexus-crm/dist/index.cjs"||!(p.pid>0))process.exit(1);
    process.stdout.write(String(p.pid));
  '
}
health() {
  local code
  code=$(curl -sS --max-time 5 --max-filesize 1048576 -o "$RUN/health.json" -w '%{http_code}' http://127.0.0.1:5000/api/users) || return 1
  [[ "$code" == 401 ]] || return 1
  node - "$RUN/health.json" <<'JS' || return 1
const fs=require("fs");
if(String(JSON.parse(fs.readFileSync(process.argv[2],"utf8")).error).toLowerCase()!=="unauthorized")process.exit(1);
JS
  curl -fsS --max-time 5 --max-filesize 1048576 http://127.0.0.1:5000/ -o "$RUN/served.html" || return 1
  cmp -s "$RUN/index.html" "$RUN/served.html"
}
wait_health() {
  for ((n=0;n<45;n++)); do
    if check_process >/dev/null 2>&1 && health >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}
approval() {
  sudo -u postgres psql --host=/var/run/postgresql --port=5432 --username=postgres \
    --dbname=indexus_crm --no-password -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT jsonb_build_object(
  'ownership',(SELECT to_jsonb(o) FROM mission_callback_ownership o
    WHERE campaign_id='a65e7775-885c-4413-b2be-e63c92decd3d'),
  'candidates',(SELECT jsonb_agg(to_jsonb(c) ORDER BY automation_id)
    FROM mission_callback_candidates c WHERE campaign_id='a65e7775-885c-4413-b2be-e63c92decd3d')
)::text;
COMMIT;
SQL
}
fail() {
  local code=$?
  trap - ERR
  printf 'STOP: phase=%s, exit=%s, stage=%s\n' "$PHASE" "$code" "$RUN"
  if [[ "$PROMOTED" == 1 ]]; then
    if sudo install -m 644 "$BACK/index.cjs" "$APP/dist/.callback-rollback.cjs" &&
       sudo mv -f "$APP/dist/.callback-rollback.cjs" "$APP/dist/index.cjs" &&
       pm2 restart indexus-crm >/dev/null && wait_health; then
      echo "Povodny backend obnoveny a HTTP overene. Databaza sa neobnovovala."
    else
      echo "POZOR: Automaticky navrat nebol uspesny. Zaloha: $BACK"
    fi
  fi
  echo "Sukromne podklady a log zostavenia zostavaju v uvedenom stage."
  exit "$code"
}
trap fail ERR
check_source
PID=$(check_process)
BACKEND=$(sha256sum dist/index.cjs)
cp dist/public/index.html "$RUN/index.html"
health
approval > "$RUN/approval-before.json"
node - "$RUN/approval-before.json" <<'JS'
const fs=require("fs"),a=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(a.ownership?.owner!=="compatible"||!Array.isArray(a.candidates)||a.candidates.length!==8)
  throw Error("Expected compatible owner and eight reviewed callbacks");
JS
git fetch origin main
[[ "$(git rev-parse origin/main)" == "$TARGET" && "$(git rev-parse "$TARGET^")" == "$BASE" ]]
EXPECTED=$'server/lib/status-list-background.ts\nserver/lib/status-list-callback-boundary.test.ts\nserver/lib/status-list-callback-boundary.ts\nserver/lib/status-list-callback-transition.db.test.ts\nserver/lib/status-list-callback-transition.ts\nserver/lib/status-list-option-source.ts\nserver/lib/status-list-workflow-routes.ts'
[[ "$(git diff --name-only "$BASE" "$TARGET")" == "$EXPECTED" ]]
PHASE=build
echo "Zostavujem iba backend mimo zivych suborov..."
git archive --format=tar "$TARGET" > "$RUN/source.tar"
mkdir "$RUN/source"
tar -xf "$RUN/source.tar" -C "$RUN/source"
ln -s "$APP/node_modules" "$RUN/source/node_modules"
# Retain the pinned normal server build configuration, removing only frontend
# build/deletion. Exact markers fail closed if the normal build changes.
node - "$RUN/source" <<'JS'
const fs=require("fs"),path=require("path"),root=process.argv[2];
let source=fs.readFileSync(path.join(root,"script/build.ts"),"utf8");
for(const marker of [
  'import { build as viteBuild } from "vite";',
  '  await rm("dist", { recursive: true, force: true });',
  '  console.log("building client...");',
  '  await viteBuild();',
]){
  if(source.split(marker).length!==2)throw Error("Pinned build marker mismatch");
  source=source.replace(marker,"");
}
fs.writeFileSync(path.join(root,".operator-build-backend.ts"),source,{mode:0o600});
JS
(
  cd "$RUN/source"
  NODE_ENV=production "$APP/node_modules/.bin/tsx" .operator-build-backend.ts > "$RUN/build.log" 2>&1
)
NEW="$RUN/source/dist/index.cjs"
[[ -s "$NEW" && ! -L "$NEW" ]]
node --check "$NEW"
check_source
[[ "$(check_process)" == "$PID" && "$(sha256sum dist/index.cjs)" == "$BACKEND" ]]
cmp "$RUN/index.html" dist/public/index.html
approval > "$RUN/approval-checked.json"
cmp "$RUN/approval-before.json" "$RUN/approval-checked.json"
PHASE=backup
DB_BYTES=$(sudo -u postgres psql --host=/var/run/postgresql --port=5432 --username=postgres \
  --dbname=indexus_crm --no-password -X -qAt -v ON_ERROR_STOP=1 -c 'SELECT pg_database_size(current_database())')
FREE_BYTES=$(df -PB1 "$APP/data" | awk 'NR==2 {print $4}')
[[ "$DB_BYTES" =~ ^[0-9]+$ && "$FREE_BYTES" =~ ^[0-9]+$ ]]
(( FREE_BYTES > DB_BYTES + 1073741824 ))
BACK="$APP/data/.indexus-operator-backups/callback-independent-$(date -u +%Y%m%dT%H%M%SZ)-${RUN##*-}"
# Never follow a symlink into a public/runtime directory for private backups.
sudo test ! -L "$APP/data/.indexus-operator-backups"
sudo install -d -m 700 -o root -g root "$APP/data/.indexus-operator-backups" "$BACK"
sudo install -m 600 dist/index.cjs "$BACK/index.cjs"
sudo cmp dist/index.cjs "$BACK/index.cjs"
sudo install -m 600 "$RUN/approval-before.json" "$BACK/approval-before.json"
printf '%s\n' "$BASE" | sudo tee "$BACK/source-commit.txt" >/dev/null
echo "Sukromna databazova zaloha na /dev/sdb1..."
sudo -u postgres pg_dump --host=/var/run/postgresql --port=5432 --username=postgres \
  --dbname=indexus_crm --no-password --lock-wait-timeout=10s --format=custom |
  sudo tee "$BACK/database.dump" >/dev/null
sudo pg_restore --list "$BACK/database.dump" >/dev/null
PHASE=promotion
check_source
[[ "$(check_process)" == "$PID" && "$(sha256sum dist/index.cjs)" == "$BACKEND" ]]
cmp "$RUN/index.html" dist/public/index.html
approval > "$RUN/approval-checked.json"
cmp "$RUN/approval-before.json" "$RUN/approval-checked.json"
install -m 644 "$NEW" "$APP/dist/.callback-next.cjs"
PROMOTED=1
mv -f "$APP/dist/.callback-next.cjs" "$APP/dist/index.cjs"
PHASE=restart
echo "Restartujem backend..."
pm2 restart indexus-crm >/dev/null
PHASE=verification
wait_health
cmp "$NEW" dist/index.cjs
cmp "$RUN/index.html" dist/public/index.html
approval > "$RUN/approval-after.json"
cmp "$RUN/approval-before.json" "$RUN/approval-after.json"
PHASE=source
check_source
git merge --ff-only "$TARGET"
PROMOTED=0
trap - ERR
printf 'OK: backend=%s, PID=%s\nSukromna zaloha: %s\n' "$TARGET" "$(check_process)" "$BACK"
echo "Frontend nezmeneny. Schvalene callbacky a vlastnictvo nezmenene. Databaza sa neobnovovala."
