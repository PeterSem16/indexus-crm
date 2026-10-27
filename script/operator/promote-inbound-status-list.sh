#!/usr/bin/env bash
# Standalone operator entry point. Run as seman on CORPCRM01 with --apply.
# Builds a pinned release privately, retains old lazy-loaded assets, and never
# restores a database. A failed promotion returns the previous runtime.
set -Eeuo pipefail
APP=/var/www/indexus-crm
DATA="$APP/data"
BASE=0364e2bb907f0c265fd69d5a31f5bb32b19ce115
INBOUND=003bd00026a099c3b80eb3944567b14f1b482421
TARGET=e0639bbc8e0cb741866f1f8189a23ae626e30cdd
PHASE=kontrola
STORE= VIEW=
MOUNTED=0 SOURCE_CHANGED=0 RUNTIME_CHANGED=0 COMPLETED=0
stop() { echo "STOP: $*" >&2; exit 1; }

process_pid() {
  pm2 jlist | node -e '
    let s="";process.stdin.on("data",b=>s+=b).on("end",()=>{
      try {
        const a=JSON.parse(s).filter(p=>p.name==="indexus-crm");
        if(a.length!==1)throw 0;
        const p=a[0],e=p.pm2_env;
        if(e.status!=="online"||e.exec_mode!=="fork_mode"||
          e.pm_cwd!=="/var/www/indexus-crm"||
          e.pm_exec_path!=="/var/www/indexus-crm/dist/index.cjs"||!(p.pid>0))throw 0;
        console.log(p.pid);
      } catch {console.error("STOP: Neocakavany PM2 proces");process.exitCode=1;}
    });'
}
health() {
  [[ "$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/)" == 200 ]] &&
  [[ "$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/call-logs/browse)" == 401 ]]
}
wait_health() {
  local deadline=$((SECONDS + 120)) stable=0
  while (( SECONDS < deadline )); do
    if process_pid >/dev/null 2>&1 && health 2>/dev/null; then
      stable=$((stable + 1))
      if (( stable >= 3 )); then return 0; fi
    else stable=0
    fi
    sleep 2
  done
  return 1
}
restore_file() {
  local saved=$1 destination=$2
  sudo install -o "$APP_UID" -g "$APP_GID" -m 644 "$saved" "$destination.operator-return"
  sudo mv -fT -- "$destination.operator-return" "$destination"
}
cleanup() {
  local rc=$? returned=1
  trap - EXIT ERR
  set +e
  if (( rc != 0 && ! COMPLETED )); then
    echo "STOP: faza=$PHASE; sukromna zaloha=${STORE:-nevytvorena}" >&2
    if (( RUNTIME_CHANGED )); then
      echo "Vraciam predchadzajuci backend a vstupnu stranku; databazu neobnovujem." >&2
      restore_file "$STORE/backup/index.cjs" "$APP/dist/index.cjs" || returned=0
      restore_file "$STORE/backup/index.html" "$APP/dist/public/index.html" || returned=0
    fi
    if (( SOURCE_CHANGED )); then
      # The reviewed release is the only source transition. --keep refuses
      # conflicts and preserves unrelated/untracked operator and business files.
      if [[ "$(git -C "$APP" rev-parse HEAD)" == "$TARGET" ]]; then
        git -C "$APP" reset --keep "$BASE" || returned=0
      else
        echo "STOP: HEAD sa zmenil; zdroje automaticky nevraciam." >&2
        returned=0
      fi
    fi
    if (( RUNTIME_CHANGED )); then
      pm2 restart indexus-crm >/dev/null || returned=0
      wait_health || returned=0
      [[ "$(sha256sum "$APP/dist/index.cjs" | awk '{print $1}')" == "$OLD_BACKEND" ]] || returned=0
      [[ "$(sha256sum "$APP/dist/public/index.html" | awk '{print $1}')" == "$OLD_INDEX" ]] || returned=0
      if (( returned )); then echo "POVODNA_VERZIA_OBNOVENA=$BASE" >&2
      else echo "STOP: Navrat nie je plne overeny. Zachovaj zalohu a skontroluj PM2." >&2; fi
    fi
  fi
  if (( MOUNTED )); then
    sudo umount -- "$VIEW" || { echo "STOP: Neodpojeny build pohlad: $VIEW" >&2; rc=1; }
  fi
  if [[ -n "$VIEW" ]] && ! mountpoint -q "$VIEW"; then rmdir -- "$VIEW" || rc=1; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'rc=$?; echo "STOP: faza=$PHASE riadok=$LINENO" >&2; exit "$rc"' ERR

[[ "${1:-}" == --apply && $# == 1 ]] || stop "Pouzi --apply; vykona sa aj restart aplikacie."
[[ "$(hostname -s | tr '[:lower:]' '[:upper:]')" == CORPCRM01 ]] || stop "Nespravny server"
[[ "$(id -un)" == seman ]] || stop "Pouzi pouzivatela seman"
for tool in git node npm npx sudo pm2 curl findmnt mountpoint flock tar sha256sum mount umount; do
  command -v "$tool" >/dev/null || stop "Chyba prikaz $tool"
done
cd "$APP"
exec 9>/home/seman/.indexus-inbound-release.lock
flock -n 9 || stop "Ina priprava alebo nasadenie uz bezi"
[[ "$(findmnt -n -o SOURCE -T "$DATA")" == /dev/sdb1 ]] || stop "Chyba datovy disk /dev/sdb1"
[[ "$(df -Pk "$DATA" | awk 'NR==2 {print $4}')" -gt 10485760 ]] || stop "Menej ako 10 GiB na datovom disku"
[[ -f dist/index.cjs && ! -L dist/index.cjs && -d dist/public && ! -L dist/public ]] || stop "Neocakavany zivy dist"
[[ -f dist/public/index.html && ! -L dist/public/index.html ]] || stop "Neocakavany zivy index"
git cat-file -e "$TARGET^{commit}"
[[ "$(git rev-parse "$TARGET^")" == "$INBOUND" ]] || stop "Nespravny rodic spolocnej opravy"
[[ "$(git rev-parse "$INBOUND^")" == "$BASE" ]] || stop "Nespravny povodny zaklad"
EXPECTED=$'client/src/lib/call-browse-inbound.browser.test.mjs\nclient/src/lib/status-list-correction.browser.test.mjs\nclient/src/pages/agent-workspace.tsx\nclient/src/pages/transcript-search.tsx\nserver/lib/call-browse-inbound.test.ts\nserver/lib/call-browse-inbound.ts\nserver/lib/status-list-history-display.test.ts\nserver/lib/status-list-history-display.ts\nserver/lib/status-list-workflow.ts\nserver/routes.ts\nshared/status-list-history-display.test.ts\nshared/status-list-history-display.ts'
[[ "$(git diff --name-only "$BASE" "$TARGET" | LC_ALL=C sort)" == "$EXPECTED" ]] || stop "Necakany rozsah zmien"
check_source() {
  local expected_commit=$1 file entry hash
  [[ "$(git rev-parse HEAD)" == "$expected_commit" ]] || stop "Produkcia uz ma iny commit"
  git diff --quiet HEAD -- client server shared script package.json package-lock.json || stop "Lokalne aplikacne zmeny"
  while IFS= read -r file; do
    entry=$(git ls-tree "$expected_commit" -- "$file")
    if [[ -n "$entry" ]]; then
      hash=$(awk '{print $3}' <<<"$entry")
      [[ -f "$file" && ! -L "$file" ]] || stop "Chyba obycajny zdrojovy subor: $file"
      [[ "$(git hash-object -- "$file")" == "$hash" ]] || stop "Zmenene bajty zdroja: $file"
    else
      [[ ! -e "$file" && ! -L "$file" ]] || stop "Konflikt noveho suboru: $file"
    fi
  done <<<"$EXPECTED"
}
check_source "$BASE"
PID=$(process_pid)
APP_UID=$(ps -o uid= -p "$PID" | tr -d ' ')
APP_GID=$(ps -o gid= -p "$PID" | tr -d ' ')
[[ "$APP_UID" =~ ^[0-9]+$ && "$APP_UID" != 0 && "$APP_GID" =~ ^[0-9]+$ ]] || stop "Neoverena identita backendu"
OLD_BACKEND=$(sha256sum dist/index.cjs | awk '{print $1}')
OLD_INDEX=$(sha256sum dist/public/index.html | awk '{print $1}')
health || stop "Aplikacia nie je zdrava pred pripravou"
sudo -v
PHASE=sukromne_ulozisko
STORE=$(sudo mktemp -d "$DATA/.inbound-status-list-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
[[ "$(sudo stat -c '%u:%g:%a' "$STORE")" == 0:0:700 ]] || stop "Nesukromny adresar"
sudo install -d -o root -g root -m 700 "$STORE/backup"
sudo install -d -o seman -g "$(id -gn)" -m 700 "$STORE/build"
CANARY="release-private-$(node -p 'require("crypto").randomBytes(16).toString("hex")')"
printf '%s' "$CANARY" | sudo tee "$STORE/canary.txt" >/dev/null
for account in "#$APP_UID" www-data; do
  sudo -u "$account" node - "$STORE/canary.txt" <<'PRIVATE_READ'
try { require("fs").readFileSync(process.argv[2]); process.exit(1); }
catch(e) { if(e.code!=="EACCES")process.exit(1); }
PRIVATE_READ
done
VIEW=$(mktemp -d /tmp/indexus-combined-view-XXXXXX)
sudo mount --bind "$STORE/build" "$VIEW"
MOUNTED=1
[[ "$(findmnt -n -o SOURCE -T "$VIEW")" == /dev/sdb1* ]] || stop "Build nie je na datovom disku"
curl -sS --max-time 10 "http://127.0.0.1:5000/data/${STORE##*/}/canary.txt" -o "$VIEW/canary-response.txt"
! grep -Fq -- "$CANARY" "$VIEW/canary-response.txt" || stop "Sukromny adresar je pristupny cez HTTP"
health || stop "Aplikacia nie je zdrava po kontrole sukromia"
PHASE=zaloha
sudo tar -cpf "$STORE/backup/dist.tar" -C "$APP" dist
sudo tar -df "$STORE/backup/dist.tar" -C "$APP"
sudo install -m 600 "$APP/dist/index.cjs" "$STORE/backup/index.cjs"
sudo install -m 600 "$APP/dist/public/index.html" "$STORE/backup/index.html"
printf '%s\n' "$BASE" "$TARGET" "$PID" "$OLD_BACKEND" "$OLD_INDEX" | sudo tee "$STORE/release.txt" >/dev/null
sudo chmod 600 "$STORE/release.txt" "$STORE/backup/dist.tar"
PHASE=zostavenie
git archive --format=tar --output="$VIEW/source.tar" "$TARGET"
tar -xf "$VIEW/source.tar" -C "$VIEW"
ln -s "$APP/node_modules" "$VIEW/node_modules"
if [[ -f "$APP/.env" ]]; then ln -s "$APP/.env" "$VIEW/.env"; fi
echo "Zostavujem presny ciel $TARGET mimo ziveho dist. Zaloha: $STORE"
if ! (cd "$VIEW" && NODE_OPTIONS=--max-old-space-size=4096 npm run build > build.log 2>&1); then
  tail -35 "$VIEW/build.log"; stop "Build zlyhal; ziva aplikacia zostala bez zmeny"
fi
(cd "$VIEW" && npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts > tests.log 2>&1) ||
  { tail -30 "$VIEW/tests.log"; stop "Testy zlyhali; nasadenie zastavene"; }
[[ -s "$VIEW/dist/index.cjs" && -s "$VIEW/dist/public/index.html" ]] || stop "Neuplny build"
[[ -z "$(find "$VIEW/dist" -type l -print -quit)" ]] || stop "Symlink v novom dist"
(cd "$VIEW" && find dist -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > artifact.sha256)
(cd "$VIEW" && sha256sum -c artifact.sha256 >/dev/null)
# Validate the exact served tree before copying anything. Old lazy-loaded assets
# stay available; no candidate asset may overwrite a different existing file.
node - "$VIEW/dist/public" "$APP/dist/public" <<'VALIDATE_ASSETS'
const fs=require("fs"),path=require("path"),crypto=require("crypto");
const [source,dest]=process.argv.slice(2);
const hash=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
function visit(dir,rel=""){
  for(const name of fs.readdirSync(dir)){
    const key=path.join(rel,name),file=path.join(dir,name),s=fs.lstatSync(file);
    if(s.isSymbolicLink())throw Error("Symlink in candidate: "+key);
    const old=path.join(dest,key);
    let previous;try{previous=fs.lstatSync(old);}catch(e){if(e.code!=="ENOENT")throw e;}
    if(previous?.isSymbolicLink())throw Error("Symlink in live static tree: "+key);
    if(s.isDirectory()){
      if(previous&&!previous.isDirectory())throw Error("Static directory collision: "+key);
      visit(file,key);continue;
    }
    if(!s.isFile())throw Error("Unexpected candidate file: "+key);
    if(previous&&(!previous.isFile()||key!=="index.html"&&hash(old)!==hash(file)))
      throw Error("Conflicting static file: "+key);
  }
}
visit(source);
VALIDATE_ASSETS
NEEDED_KB=$(du -sk "$VIEW/dist" | awk '{print $1}')
[[ "$(df -Pk "$APP/dist" | awk 'NR==2 {print $4}')" -gt $((NEEDED_KB + 131072)) ]] || stop "Nedostatok miesta na publikovanie suborov"
check_source "$BASE"
[[ "$(process_pid)" == "$PID" ]] || stop "PM2 proces sa pocas pripravy zmenil"
[[ "$(sha256sum dist/index.cjs | awk '{print $1}')" == "$OLD_BACKEND" ]] || stop "Zivy backend sa zmenil"
[[ "$(sha256sum dist/public/index.html | awk '{print $1}')" == "$OLD_INDEX" ]] || stop "Zivy index sa zmenil"
health || stop "Aplikacia nie je zdrava pred nasadenim"
PHASE=zdroje
SOURCE_CHANGED=1
git merge --ff-only "$TARGET"
check_source "$TARGET"
PHASE=staticke_subory
find "$VIEW/dist" -type d -exec chmod 755 {} +
find "$VIEW/dist" -type f -exec chmod 644 {} +
sudo cp -an "$VIEW/dist/public/." "$APP/dist/public/"
[[ "$(sha256sum dist/public/index.html | awk '{print $1}')" == "$OLD_INDEX" ]] || stop "Index sa zmenil pred restartom"
PHASE=backend
sudo install -o "$APP_UID" -g "$APP_GID" -m 644 "$VIEW/dist/index.cjs" "$APP/dist/.index.cjs.next"
RUNTIME_CHANGED=1
sudo mv -fT -- "$APP/dist/.index.cjs.next" "$APP/dist/index.cjs"
pm2 restart indexus-crm >/dev/null
wait_health || stop "Novy backend nepresiel kontrolou"
NEW_PID=$(process_pid)
[[ "$NEW_PID" != "$PID" ]] || stop "Backend nebol restartovany"
cmp "$VIEW/dist/index.cjs" "$APP/dist/index.cjs"
PHASE=vstupna_stranka
sudo install -o "$APP_UID" -g "$APP_GID" -m 644 "$VIEW/dist/public/index.html" "$APP/dist/public/.index.next.html"
sudo mv -fT -- "$APP/dist/public/.index.next.html" "$APP/dist/public/index.html"
PHASE=overenie
curl -fsS --max-time 15 --max-filesize 1048576 http://127.0.0.1:5000/ -o "$VIEW/served.html"
cmp "$VIEW/dist/public/index.html" "$VIEW/served.html"
health || stop "Zaverecna kontrola zlyhala"
check_source "$TARGET"
[[ "$(process_pid)" == "$NEW_PID" ]] || stop "Novy backend nie je stabilny"
COMPLETED=1
echo "NASADENIE_OK=$TARGET"
echo "POVODNY_PID=$PID"
echo "NOVY_PID=$NEW_PID"
echo "SUKROMNA_ZALOHA_A_BUILD=$STORE"
sha256sum "$APP/dist/index.cjs" "$APP/dist/public/index.html"
echo "Stare lazy-load subory zostali dostupne. Databaza sa neobnovovala."
