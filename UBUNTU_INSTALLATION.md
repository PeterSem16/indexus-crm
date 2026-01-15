# INDEXUS CRM - Inštalácia na Ubuntu Server

Kompletný postup krok za krokom pre nasadenie INDEXUS CRM na produkčný Ubuntu server.

---

## Požiadavky

| Komponent | Minimálna verzia |
|-----------|------------------|
| Ubuntu Server | 20.04 LTS alebo novší |
| RAM | 2 GB (odporúčané 4 GB) |
| Disk | 20 GB voľného miesta |
| CPU | 2 jadrá |

---

## Krok 1: Pripojenie na server

```bash
ssh root@vasa-ip-adresa
```

Alebo ak používate SSH kľúč:
```bash
ssh -i ~/.ssh/vas-kluc.pem root@vasa-ip-adresa
```

---

## Krok 2: Aktualizácia systému

```bash
sudo apt update
sudo apt upgrade -y
```

---

## Krok 3: Inštalácia Node.js 20

```bash
# Pridanie NodeSource repozitára
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Inštalácia Node.js
sudo apt install -y nodejs

# Overenie verzie
node --version
npm --version
```

Očakávaný výstup:
```
v20.x.x
10.x.x
```

---

## Krok 4: Inštalácia PostgreSQL

```bash
# Inštalácia PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Spustenie služby
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Overenie stavu
sudo systemctl status postgresql
```

---

## Krok 5: Vytvorenie databázy

```bash
# Prihlásenie do PostgreSQL
sudo -u postgres psql
```

V PostgreSQL konzole spustite:
```sql
-- Vytvorenie používateľa
CREATE USER indexus WITH PASSWORD 'vase-bezpecne-heslo-tu';

-- Vytvorenie databázy
CREATE DATABASE indexus_crm OWNER indexus;

-- Nastavenie oprávnení
GRANT ALL PRIVILEGES ON DATABASE indexus_crm TO indexus;

-- Ukončenie
\q
```

**DÔLEŽITÉ**: Zapamätajte si heslo - budete ho potrebovať v .env súbore!

---

## Krok 6: Inštalácia PM2

PM2 je process manager pre Node.js aplikácie.

```bash
# Globálna inštalácia PM2
sudo npm install -g pm2

# Overenie verzie
pm2 --version
```

---

## Krok 7: Inštalácia Nginx

```bash
# Inštalácia Nginx
sudo apt install -y nginx

# Spustenie služby
sudo systemctl start nginx
sudo systemctl enable nginx

# Overenie stavu
sudo systemctl status nginx
```

---

## Krok 8: Inštalácia Git

```bash
sudo apt install -y git
git --version
```

---

## Krok 9: Vytvorenie priečinka pre aplikáciu

```bash
# Vytvorenie priečinka
sudo mkdir -p /var/www/indexus-crm

# Nastavenie vlastníka
sudo chown -R $USER:$USER /var/www/indexus-crm
```

---

## Krok 10: Klonovanie repozitára

```bash
cd /var/www
git clone https://github.com/PeterSem16/indexus-crm.git
cd indexus-crm
```

Ak repozitár vyžaduje autentifikáciu:
```bash
git clone https://USERNAME:TOKEN@github.com/PeterSem16/indexus-crm.git
```

---

## Krok 11: Inštalácia závislostí

```bash
cd /var/www/indexus-crm
npm install
```

Počkajte kým sa nainštalujú všetky balíčky (môže trvať niekoľko minút).

---

## Krok 12: Vytvorenie .env súboru

```bash
nano .env
```

Vložte nasledujúci obsah a upravte hodnoty:

```bash
# ===========================================
# ZÁKLADNÉ NASTAVENIA
# ===========================================
NODE_ENV=production
PORT=5000

# ===========================================
# SESSION SECRET
# ===========================================
SESSION_SECRET=

# ===========================================
# DATABASE
# ===========================================
DATABASE_URL=postgresql://indexus:VASE_HESLO@localhost:5432/indexus_crm

# ===========================================
# MICROSOFT 365
# ===========================================
MS365_TENANT_ID=
MS365_CLIENT_ID=
MS365_CLIENT_SECRET=
MS365_REDIRECT_URI=https://indexus.cordbloodcenter.com/api/auth/microsoft/callback
MS365_POST_LOGOUT_URI=https://indexus.cordbloodcenter.com

# ===========================================
# OPENAI
# ===========================================
OPENAI_API_KEY=

# ===========================================
# BULKGATE SMS
# ===========================================
BULKGATE_APPLICATION_ID=INDEXUS_PROD
BULKGATE_APPLICATION_TOKEN=
BULKGATE_WEBHOOK_URL=https://indexus.cordbloodcenter.com/api/auth/bulkgate/callback
BULKGATE_WEBHOOK_TOKEN=
BULKGATE_SENDER_ID=INDEXUS_PROD
```

**Generovanie SESSION_SECRET:**
```bash
openssl rand -base64 32
```

Skopírujte výstup a vložte do SESSION_SECRET.

Uložte súbor: `Ctrl+X`, `Y`, `Enter`

---

## Krok 13: Nastavenie oprávnení pre .env

```bash
chmod 600 .env
```

---

## Krok 14: Build aplikácie

```bash
npm run build
```

Počkajte na dokončenie buildu.

---

## Krok 15: Spustenie databázových migrácií

```bash
npm run db:push
```

---

## Krok 16: Vytvorenie PM2 konfigurácie

**DÔLEŽITÉ**: Súbor musí mať príponu `.cjs` (nie `.js`) kvôli ES modulom!

```bash
nano ecosystem.config.cjs
```

Vložte:

```javascript
module.exports = {
  apps: [{
    name: 'indexus-crm',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
```

Uložte: `Ctrl+X`, `Y`, `Enter`

---

## Krok 17: Spustenie aplikácie cez PM2

```bash
# Spustenie
pm2 start ecosystem.config.cjs

# Uloženie konfigurácie
pm2 save

# Nastavenie automatického štartu po reštarte servera
pm2 startup
```

Skopírujte a spustite príkaz, ktorý PM2 zobrazí.

---

## Krok 18: Overenie behu aplikácie

```bash
pm2 status
pm2 logs indexus-crm
```

Aplikácia by mala byť v stave "online".

---

## Krok 19: Konfigurácia Nginx

```bash
sudo nano /etc/nginx/sites-available/indexus-crm
```

Vložte:

```nginx
server {
    listen 80;
    server_name indexus.cordbloodcenter.com;

    # Hlavná aplikácia
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # WebSocket pre notifikácie
    location /ws/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # Upload limit pre súbory
    client_max_body_size 50M;
}
```

Uložte: `Ctrl+X`, `Y`, `Enter`

---

## Krok 20: Aktivácia Nginx konfigurácie

```bash
# Vytvorenie symlinku
sudo ln -s /etc/nginx/sites-available/indexus-crm /etc/nginx/sites-enabled/

# Odstránenie default konfigurácie (voliteľné)
sudo rm /etc/nginx/sites-enabled/default

# Test konfigurácie
sudo nginx -t

# Reštart Nginx
sudo systemctl restart nginx
```

---

## Krok 21: Inštalácia SSL certifikátov

Cordbloodcenter používa vlastné wildcard certifikáty uložené v `/ROK/` (napr. `/2025/`).

### 21.1 Vytvorte priečinok pre certifikáty
```bash
sudo mkdir -p /etc/nginx/ssl
```

### 21.2 Skopírujte certifikáty (príklad pre rok 2025)
```bash
sudo cp /2025/wildcard-cordbloodcenter-com.crt /etc/nginx/ssl/
sudo cp /2025/wildcard-cordbloodcenter-com.key /etc/nginx/ssl/
sudo cp /2025/intermediate.crt /etc/nginx/ssl/
```

### 21.3 Vytvorte reťazený certifikát (fullchain)
```bash
sudo cat /etc/nginx/ssl/wildcard-cordbloodcenter-com.crt /etc/nginx/ssl/intermediate.crt > /etc/nginx/ssl/fullchain.crt
```

### 21.4 Nastavte oprávnenia
```bash
sudo chmod 600 /etc/nginx/ssl/*.key
sudo chmod 644 /etc/nginx/ssl/*.crt
sudo chown root:root /etc/nginx/ssl/*
```

### 21.5 Aktualizujte Nginx konfiguráciu pre HTTPS
```bash
sudo nano /etc/nginx/sites-available/indexus-crm
```

Nahraďte celý obsah:

```nginx
server {
    listen 80;
    server_name indexus.cordbloodcenter.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name indexus.cordbloodcenter.com;

    # SSL certifikáty
    ssl_certificate /etc/nginx/ssl/fullchain.crt;
    ssl_certificate_key /etc/nginx/ssl/wildcard-cordbloodcenter-com.key;

    # SSL nastavenia
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Hlavná aplikácia
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # WebSocket pre notifikácie
    location /ws/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    client_max_body_size 50M;
}
```

Uložte: `Ctrl+X`, `Y`, `Enter`

### 21.6 Otestujte a reštartujte Nginx
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 21.7 Overte funkčnosť SSL
```bash
curl -I https://indexus.cordbloodcenter.com
```

---

## Ročná obnova SSL certifikátov

Keď dostanete nové certifikáty (napr. v roku 2026):

```bash
# 1. Skopírujte nové certifikáty
sudo cp /2026/wildcard-cordbloodcenter-com.crt /etc/nginx/ssl/
sudo cp /2026/wildcard-cordbloodcenter-com.key /etc/nginx/ssl/
sudo cp /2026/intermediate.crt /etc/nginx/ssl/

# 2. Vytvorte nový fullchain
sudo cat /etc/nginx/ssl/wildcard-cordbloodcenter-com.crt /etc/nginx/ssl/intermediate.crt > /etc/nginx/ssl/fullchain.crt

# 3. Nastavte oprávnenia
sudo chmod 600 /etc/nginx/ssl/*.key
sudo chmod 644 /etc/nginx/ssl/*.crt

# 4. Otestujte a reštartujte Nginx
sudo nginx -t && sudo systemctl restart nginx
```

---

## Krok 22: Nastavenie Firewallu

```bash
# Povoliť SSH
sudo ufw allow 22

# Povoliť HTTP a HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Aktivovať firewall
sudo ufw enable

# Overiť stav
sudo ufw status
```

---

## Krok 23: Overenie funkčnosti

Otvorte prehliadač a navštívte:
```
https://indexus.cordbloodcenter.com
```

---

## Užitočné príkazy pre správu

### PM2 Príkazy

| Príkaz | Popis |
|--------|-------|
| `pm2 status` | Zobrazí stav aplikácií |
| `pm2 logs indexus-crm` | Zobrazí logy |
| `pm2 restart indexus-crm` | Reštartuje aplikáciu |
| `pm2 stop indexus-crm` | Zastaví aplikáciu |
| `pm2 monit` | Interaktívny monitoring |

### Nginx Príkazy

| Príkaz | Popis |
|--------|-------|
| `sudo systemctl restart nginx` | Reštart Nginx |
| `sudo nginx -t` | Test konfigurácie |
| `sudo tail -f /var/log/nginx/error.log` | Logy chýb |

### PostgreSQL Príkazy

| Príkaz | Popis |
|--------|-------|
| `sudo -u postgres psql` | Prihlásenie do PostgreSQL |
| `\l` | Zoznam databáz |
| `\c indexus_crm` | Prepnutie na databázu |
| `\dt` | Zoznam tabuliek |

---

## Aktualizácia aplikácie

Pri vydaní novej verzie:

```bash
cd /var/www/indexus-crm

# Stiahnutie zmien
git pull

# Inštalácia nových závislostí
npm install

# Build
npm run build

# Migrácie (ak sú)
npm run db:push

# Reštart bez výpadku
pm2 reload indexus-crm
```

---

## Zálohovanie databázy

### Vytvorenie zálohy

```bash
pg_dump -U indexus indexus_crm > /var/backups/indexus_$(date +%Y%m%d_%H%M%S).sql
```

### Automatické zálohy (cron)

```bash
crontab -e
```

Pridajte (záloha každý deň o 2:00):
```
0 2 * * * pg_dump -U indexus indexus_crm > /var/backups/indexus_$(date +\%Y\%m\%d).sql
```

### Obnova zo zálohy

```bash
psql -U indexus indexus_crm < /var/backups/indexus_20240115.sql
```

---

## Troubleshooting

### Aplikácia sa nespúšťa

```bash
# Skontrolujte logy
pm2 logs indexus-crm --lines 100

# Skontrolujte .env súbor
cat .env

# Skontrolujte oprávnenia
ls -la .env
```

### Nginx chyba 502

```bash
# Skontrolujte či beží PM2
pm2 status

# Skontrolujte port
netstat -tulpn | grep 5000
```

### Databáza sa nepripája

```bash
# Test pripojenia
psql -U indexus -d indexus_crm -h localhost

# Skontrolujte heslo v .env
grep DATABASE_URL .env
```

### SSL certifikát expiroval

```bash
sudo certbot renew
sudo systemctl restart nginx
```

---

## Kontakt pre podporu

Pri problémoch s inštaláciou kontaktujte technickú podporu.
