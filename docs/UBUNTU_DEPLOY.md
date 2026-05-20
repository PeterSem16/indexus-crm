# INDEXUS CRM — nasadenie na Ubuntu server

Kompletný postup pre čistú inštaláciu na **Ubuntu 22.04 / 24.04 LTS**.
Predpokladá: root / sudo prístup, doménu (napr. `crm.tvojadomena.sk`), 2+ GB RAM, 20+ GB disk.

---

## 1. Príprava systému

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw ca-certificates gnupg
```

### Firewall (UFW)
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 2. Node.js 20.x

App je testovaná na **Node 20.20.0** (LTS „Iron").

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # malo by ukázať v20.x
npm -v
```

---

## 3. PostgreSQL 16

```bash
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | \
  sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16
sudo systemctl enable --now postgresql
```

### Vytvorenie databázy
```bash
sudo -u postgres psql <<'SQL'
CREATE USER indexus WITH PASSWORD 'SILNE_HESLO_TU';
CREATE DATABASE indexus_crm OWNER indexus;
GRANT ALL PRIVILEGES ON DATABASE indexus_crm TO indexus;
\c indexus_crm
GRANT ALL ON SCHEMA public TO indexus;
SQL
```

`DATABASE_URL` bude potom: `postgresql://indexus:SILNE_HESLO_TU@127.0.0.1:5432/indexus_crm`

---

## 4. Aplikačný používateľ a kód

```bash
sudo adduser --system --group --home /opt/indexus indexus
sudo mkdir -p /opt/indexus/app /opt/indexus/data
sudo chown -R indexus:indexus /opt/indexus
```

Skopíruj kód (cez git, scp alebo rsync z Replitu):

```bash
sudo -u indexus -H bash -c '
  cd /opt/indexus/app
  git clone <URL_REPOZITARA> .   # alebo: rsync -av z Replitu
  npm ci
'
```

> Ak inštaluješ priamo zo zip-balíka, prelož ho do `/opt/indexus/app` a spusti `npm ci`.

---

## 5. Konfigurácia (`.env`)

Vytvor `/opt/indexus/app/.env` (chmod 600, vlastník `indexus`):

```bash
sudo -u indexus tee /opt/indexus/app/.env > /dev/null <<'ENV'
# ── POVINNÉ ──────────────────────────────────────────────
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://indexus:SILNE_HESLO_TU@127.0.0.1:5432/indexus_crm
SESSION_SECRET=zmen_ma_na_dlhy_nahodny_retazec_min_64_znakov
APP_BASE_URL=https://crm.tvojadomena.sk
DATA_ROOT=/opt/indexus/data        # priečinok pre uploady/súbory

# ── ODPORÚČANÉ (AI funkcie, CSV import) ─────────────────
OPENAI_API_KEY=sk-...
# OPENAI_WEBHOOK_SECRET=...        # len ak používaš realtime webhooky
# REALTIME_WEBHOOK_SECRET=...

# ── E-MAIL (vyber jeden poskytovateľa, voliteľné) ───────
EMAIL_FROM=crm@tvojadomena.sk
# SENDGRID_API_KEY=SG....
# MAILCHIMP_API_KEY=...

# ── SMS (BulkGate, voliteľné) ───────────────────────────
# BULKGATE_APPLICATION_ID=...
# BULKGATE_APPLICATION_TOKEN=...
# BULKGATE_SENDER_ID=...
# BULKGATE_WEBHOOK_TOKEN=...
# BULKGATE_WEBHOOK_URL=https://crm.tvojadomena.sk/api/sms/webhook

# ── Microsoft 365 (e-mail/kalendár, voliteľné) ──────────
# MS365_TENANT_ID=...
# MS365_CLIENT_ID=...
# MS365_CLIENT_SECRET=...
# MS365_REDIRECT_URI=https://crm.tvojadomena.sk/api/ms365/callback
# MS365_POST_LOGOUT_URI=https://crm.tvojadomena.sk/

# ── Jira (ticketing, voliteľné) ─────────────────────────
# JIRA_HOST=tvojaorg.atlassian.net
# JIRA_EMAIL=admin@tvojadomena.sk
# JIRA_API_TOKEN=...

# ── Asterisk PBX (telefónia, voliteľné) ─────────────────
# ASTERISK_API_KEY=...
ENV
sudo chmod 600 /opt/indexus/app/.env
```

> Vygeneruj `SESSION_SECRET`: `openssl rand -hex 64`

---

## 6. Inicializácia DB schémy

```bash
cd /opt/indexus/app
sudo -u indexus -H bash -c 'set -a; source .env; set +a; npm run db:push'
```

Drizzle vytvorí všetky tabuľky podľa `shared/schema.ts`. Pri opakovaných behoch
zmení len rozdiely. Ak ohlási potrebu force, použi `npm run db:push -- --force`.

---

## 7. Build aplikácie

```bash
sudo -u indexus -H bash -c 'cd /opt/indexus/app && npm run build'
```

Výstup ide do `dist/index.cjs` (server) + `dist/public/` (frontend).

---

## 8. systemd služba

Vytvor `/etc/systemd/system/indexus-crm.service`:

```ini
[Unit]
Description=INDEXUS CRM
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=indexus
Group=indexus
WorkingDirectory=/opt/indexus/app
EnvironmentFile=/opt/indexus/app/.env
Environment=NODE_OPTIONS=--max-old-space-size=4096
ExecStart=/usr/bin/node dist/index.cjs
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=indexus-crm
LimitNOFILE=65535

# Bezpečnosť
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/indexus/data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now indexus-crm
sudo systemctl status indexus-crm
journalctl -u indexus-crm -f      # live logy
```

App teraz beží na `http://127.0.0.1:5000`.

---

## 9. Nginx reverse proxy + HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/indexus-crm`:

```nginx
server {
    listen 80;
    server_name crm.tvojadomena.sk;

    client_max_body_size 50M;        # uploady (PDF, dokumenty)

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;       # WebSocket
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/indexus-crm /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d crm.tvojadomena.sk --redirect --agree-tos -m admin@tvojadomena.sk
```

Certbot automaticky doplní HTTPS sekciu a auto-renewal cez systemd timer.

---

## 10. Update / nová verzia

```bash
sudo -u indexus -H bash -c '
  cd /opt/indexus/app
  git pull
  npm ci
  set -a; source .env; set +a
  npm run db:push
  npm run build
'
sudo systemctl restart indexus-crm
```

---

## 11. Záloha PostgreSQL

Cron na dennú zálohu o 02:00 (drž 14 dní):

```bash
sudo mkdir -p /var/backups/indexus
sudo tee /etc/cron.daily/indexus-db-backup > /dev/null <<'SH'
#!/bin/bash
TS=$(date +%F-%H%M)
sudo -u postgres pg_dump -Fc indexus_crm > /var/backups/indexus/indexus_crm_$TS.dump
find /var/backups/indexus -name 'indexus_crm_*.dump' -mtime +14 -delete
SH
sudo chmod +x /etc/cron.daily/indexus-db-backup
```

Obnova zo zálohy:
```bash
sudo -u postgres pg_restore -d indexus_crm --clean --if-exists /var/backups/indexus/indexus_crm_2026-04-29-0200.dump
```

---

## 12. Riešenie problémov

| Symptóm | Kontrola |
|---|---|
| App sa nespustí | `journalctl -u indexus-crm -n 100 --no-pager` |
| 502 Bad Gateway | beží port 5000? `ss -ltnp \| grep 5000` |
| DB chyba | `sudo -u postgres psql -d indexus_crm -c '\dt'` |
| Vysoké RAM | uprav `--max-old-space-size` v service |
| Chýbajú tabuľky | znovu spusti `npm run db:push` |
| WebSocket padá | over `proxy_set_header Upgrade/Connection` v Nginxe |

---

## 13. Migrácia dát z Replit

1. Na Replite spusti `pg_dump -Fc $DATABASE_URL > replit_dump.dump` v shelli.
2. Stiahni súbor (Files panel → Download).
3. Na Ubuntu serveri:
   ```bash
   sudo -u postgres pg_restore -d indexus_crm --clean --if-exists replit_dump.dump
   ```
4. Skopíruj obsah `attached_assets/` (uploady, postal_code_cache.json) do `/opt/indexus/data/attached_assets/`.

---

## 14. Bezpečnostný checklist

- [ ] `SESSION_SECRET` je dlhý a unikátny (min. 64 znakov)
- [ ] `.env` má chmod 600 a vlastník `indexus`
- [ ] PostgreSQL počúva len na `127.0.0.1` (default)
- [ ] UFW povoľuje len 22/80/443
- [ ] Let's Encrypt aktívne (`sudo certbot certificates`)
- [ ] `unattended-upgrades` zapnuté: `sudo dpkg-reconfigure --priority=low unattended-upgrades`
- [ ] Pravidelná záloha DB beží (`/var/backups/indexus/`)
- [ ] Monitoring stavu služby (`systemctl status indexus-crm`)

---

## Minimálny štart (TL;DR)

```bash
# 1. systém
sudo apt update && sudo apt install -y curl git build-essential nginx
# 2. Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
# 3. Postgres 16 + DB (pozri sekciu 3)
# 4. kód + .env + npm ci + db:push + build (sekcie 4–7)
# 5. systemd + nginx + certbot (sekcie 8–9)
```

Celý postup zaberie ~30 minút na čistom serveri.
