# INDEXUS CRM — nasadenie na Ubuntu server

Ladený pre **Ubuntu 22.04 / 24.04 LTS**, Node.js 20.x, PostgreSQL 16, PM2, nginx + Let's Encrypt.

Postup pokrýva dva scenáre:

- **A.** Prvotná inštalácia na čistý Ubuntu server (od A po Z)
- **B.** Update existujúcej inštalácie (bežný deploy nového kódu)

---

## Premenné použité v návode

Uprav podľa svojho prostredia. Všade nižšie sa odkazuje na tieto hodnoty.

| Premenná | Hodnota | Význam |
|---|---|---|
| `APP_DIR` | `/opt/indexus/app` | adresár s kódom aplikácie |
| `APP_USER` | `indexus` | systémový používateľ pod ktorým beží appka |
| `DB_USER` | `indexus` | PostgreSQL používateľ |
| `DB_NAME` | `indexus_crm` | názov DB |
| `DB_PASS` | (silné heslo) | heslo k DB |
| `DOMAIN` | `crm.tvoja-domena.sk` | doména pre nginx + SSL |
| `PM2_APP` | `indexus-crm` | PM2 process name (zhodný s `script/deploy-ubuntu.sh`) |

---

## A. PRVOTNÁ INŠTALÁCIA

### 1) Príprava systému

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install curl git build-essential ca-certificates gnupg ufw nginx
```

### 2) Node.js 20.x (NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs
node -v   # → v20.x
npm -v
sudo npm i -g pm2
```

### 3) PostgreSQL 16

```bash
sudo apt -y install postgresql postgresql-contrib
sudo systemctl enable --now postgresql

# vytvor používateľa + DB
sudo -u postgres psql <<'SQL'
CREATE USER indexus WITH PASSWORD 'TVOJE_SILNE_HESLO';
CREATE DATABASE indexus_crm OWNER indexus;
GRANT ALL PRIVILEGES ON DATABASE indexus_crm TO indexus;
\c indexus_crm
GRANT ALL ON SCHEMA public TO indexus;
SQL
```

Test pripojenia:

```bash
PGPASSWORD='TVOJE_SILNE_HESLO' psql -h 127.0.0.1 -U indexus -d indexus_crm -c '\conninfo'
```

### 4) Systémový používateľ + adresár

```bash
sudo useradd --system --create-home --shell /bin/bash indexus
sudo mkdir -p /opt/indexus
sudo chown indexus:indexus /opt/indexus
```

### 5) Stiahnutie kódu

Ako `indexus` používateľ:

```bash
sudo -iu indexus
git clone <URL_TVOJHO_GIT_REPA> /opt/indexus/app
cd /opt/indexus/app
```

> Ak nemáš git remote, nahraj kód cez `scp` / `rsync` do `/opt/indexus/app`.

### 6) `.env` súbor

Vytvor `/opt/indexus/app/.env` (ako `indexus` user, `chmod 600`):

```bash
cat > /opt/indexus/app/.env <<'ENV'
# === POVINNÉ ===
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://indexus:TVOJE_SILNE_HESLO@127.0.0.1:5432/indexus_crm
SESSION_SECRET=vygeneruj_nahodne_64_znakov_napr_openssl_rand_hex_32
APP_BASE_URL=https://crm.tvoja-domena.sk

# === ODPORÚČANÉ ===
OPENAI_API_KEY=sk-...
EMAIL_FROM=no-reply@tvoja-domena.sk
DATA_ROOT=/opt/indexus/data

# === VOLITEĽNÉ INTEGRÁCIE (nastav len ak používaš) ===
# SendGrid (e-maily)
SENDGRID_API_KEY=

# Mailchimp
MAILCHIMP_API_KEY=

# BulkGate (SMS)
BULKGATE_APPLICATION_ID=
BULKGATE_APPLICATION_TOKEN=
BULKGATE_SENDER_ID=
BULKGATE_WEBHOOK_TOKEN=
BULKGATE_WEBHOOK_URL=

# Microsoft 365 (e-mail integrácia)
MS365_CLIENT_ID=
MS365_CLIENT_SECRET=
MS365_TENANT_ID=

# Jira
JIRA_HOST=
JIRA_EMAIL=
JIRA_API_TOKEN=

# Asterisk / VoIP
ASTERISK_API_KEY=

# OpenAI Realtime (ak používaš)
OPENAI_WEBHOOK_SECRET=
REALTIME_WEBHOOK_SECRET=
ENV

chmod 600 /opt/indexus/app/.env
mkdir -p /opt/indexus/data
```

> Vygeneruj silný `SESSION_SECRET`: `openssl rand -hex 32`

### 7) Inštalácia závislostí + build

```bash
cd /opt/indexus/app
npm install                           # nainštaluje aj devDependencies (potrebné pre build)
npm run db:push                       # vytvorí všetky tabuľky podľa shared/schema.ts
NODE_OPTIONS="--max-old-space-size=8192" npm run build
# výstup: dist/index.cjs + dist/public/
```

> Ak `db:push` hlási interaktívnu otázku, pridaj `-- --force` (cez npm: `npm run db:push -- --force`).

### 8) Spustenie cez PM2

```bash
cd /opt/indexus/app
pm2 start dist/index.cjs --name indexus-crm --update-env
pm2 save

# auto-štart pri boote (vygeneruje sa systemd unit pre používateľa indexus)
pm2 startup systemd -u indexus --hp /home/indexus
# → vypíše príkaz `sudo env PATH=...`, ten skopíruj a spusti ako root
```

Test že počúva:

```bash
curl -I http://127.0.0.1:5000/
```

### 9) nginx reverse proxy

Vráť sa pod root (`exit` z indexus session) a vytvor `/etc/nginx/sites-available/indexus`:

```nginx
server {
    listen 80;
    server_name crm.tvoja-domena.sk;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }
}
```

Aktivuj:

```bash
sudo ln -s /etc/nginx/sites-available/indexus /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 10) HTTPS (Let's Encrypt)

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d crm.tvoja-domena.sk --redirect --agree-tos -m admin@tvoja-domena.sk -n
# auto-renew je už nainštalovaný (systemd timer)
```

### 11) Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 12) Overenie

```bash
pm2 status
pm2 logs indexus-crm --lines 50
curl -I https://crm.tvoja-domena.sk/
```

---

## B. UPDATE EXISTUJÚCEJ INŠTALÁCIE

V repozitári je hotový skript `script/deploy-ubuntu.sh` ktorý urobí:
git pull → SQL patche → `npm install` → build → `pm2 restart`.

```bash
sudo -iu indexus
cd /opt/indexus/app
bash script/deploy-ubuntu.sh
```

Ak sa zmenila Drizzle schéma (`shared/schema.ts`), spusti navyše:

```bash
npm run db:push
pm2 restart indexus-crm
```

---

## CSV import kliník + osôb (po deployi)

```bash
sudo -iu indexus
cd /opt/indexus/app
set -a; source .env; set +a

# 1) skopíruj nové CSV
cp /cesta/ku/clinics.csv attached_assets/indexus_gyn_data_import_$(date +%Y%m%d).csv

# 2) DRY-RUN
npx tsx scripts/import-clinics-write.ts

# 3) COMMIT do DB
npx tsx scripts/import-clinics-write.ts --commit
```

Audit log: `attached_assets/import_write_log_<timestamp>.md`. Skript je idempotentný — opakované spustenie = 0 zmien.

---

## Zálohovanie DB (denný cron)

Ako root:

```bash
sudo mkdir -p /var/backups/indexus
sudo tee /etc/cron.daily/indexus-db-backup >/dev/null <<'CRON'
#!/bin/bash
set -e
TS=$(date +%Y%m%d_%H%M%S)
PGPASSWORD='TVOJE_SILNE_HESLO' pg_dump -h 127.0.0.1 -U indexus indexus_crm \
  | gzip > /var/backups/indexus/indexus_crm_${TS}.sql.gz
# ponechá posledných 14 dní
find /var/backups/indexus -name 'indexus_crm_*.sql.gz' -mtime +14 -delete
CRON
sudo chmod +x /etc/cron.daily/indexus-db-backup
```

Manuálna obnova:

```bash
gunzip -c /var/backups/indexus/indexus_crm_YYYYMMDD_HHMMSS.sql.gz \
  | PGPASSWORD='...' psql -h 127.0.0.1 -U indexus -d indexus_crm
```

---

## Migrácia DB z Replitu na Ubuntu

Na **Replite** (zdrojová DB):

```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl -Fc -f /tmp/indexus_replit.dump
# stiahni súbor (Files panel → Download)
```

Na **Ubuntu serveri**:

```bash
# nahraj súbor cez scp
scp indexus_replit.dump indexus@server:/tmp/

# obnov do prázdnej DB (ak ešte nebežalo db:push)
PGPASSWORD='...' pg_restore -h 127.0.0.1 -U indexus -d indexus_crm \
  --no-owner --no-acl -j 4 /tmp/indexus_replit.dump

# následne synchronizuj schému (pridá prípadné nové stĺpce)
cd /opt/indexus/app
npm run db:push
pm2 restart indexus-crm
```

---

## Užitočné PM2 príkazy

```bash
pm2 status                       # zoznam procesov
pm2 logs indexus-crm             # live logy
pm2 logs indexus-crm --err       # len chyby
pm2 restart indexus-crm          # reštart
pm2 reload indexus-crm           # zero-downtime reload
pm2 stop indexus-crm             # stop
pm2 monit                        # interaktívny monitor (CPU, RAM)
pm2 flush                        # vyčisti staré logy
```

---

## Checklist pre nasadenie

- [ ] Node 20.x + PostgreSQL 16 nainštalované
- [ ] DB `indexus_crm` + user `indexus` vytvorené
- [ ] `/opt/indexus/app/.env` s `DATABASE_URL`, `SESSION_SECRET`, `APP_BASE_URL`, `OPENAI_API_KEY`
- [ ] `npm install` + `npm run db:push` + `npm run build` prešli bez chýb
- [ ] `pm2 start dist/index.cjs --name indexus-crm` beží, `pm2 save` + `pm2 startup` aktivované
- [ ] nginx reverse proxy + Let's Encrypt SSL
- [ ] UFW firewall (SSH + Nginx Full)
- [ ] Cron záloha DB v `/etc/cron.daily/indexus-db-backup`
- [ ] `https://crm.tvoja-domena.sk/` odpovedá 200
