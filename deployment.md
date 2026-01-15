# INDEXUS CRM - Deployment Guide

## Prehľad Architektúry

INDEXUS CRM je moderný systém pre správu zákazníkov s pokročilými integráciami. Systém beží v dvoch prostrediach - vývojovom (Replit) a produkčnom (Ubuntu server).

---

## Bloková Schéma - Development (Replit)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REPLIT DEVELOPMENT ENVIRONMENT                       │
│                  fc828d39-61cd-41d5-ba8d-20e8af9db227-00-7urdqg8tuo0k.worf.replit.dev                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   FRONTEND      │    │   BACKEND       │    │   DATABASE      │         │
│  │   React + Vite  │◄──►│   Express.js    │◄──►│   PostgreSQL    │         │
│  │   Port: 5000    │    │   Node.js 20    │    │   Neon (Replit) │         │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘         │
│                                  │                                          │
│                    ┌─────────────┴─────────────┐                            │
│                    │      INTEGRÁCIE           │                            │
│                    └─────────────┬─────────────┘                            │
│                                  │                                          │
│      ┌───────────────────────────┼───────────────────────────┐             │
│      │                           │                           │             │
│      ▼                           ▼                           ▼             │
│ ┌─────────────┐          ┌─────────────┐          ┌─────────────┐          │
│ │ MICROSOFT   │          │   OPENAI    │          │  BULKGATE   │          │
│ │    365      │          │   GPT-4o    │          │    SMS      │          │
│ │ indexus_dev │          │  mini       │          │   INDEXUS   │          │
│ │  (Azure)    │          │             │          │             │          │
│ └─────────────┘          └─────────────┘          └─────────────┘          │
│       │                                                  │                  │
│       │ OAuth 2.0                              Webhook   │                  │
│       ▼                                                  ▼                  │
│ ┌─────────────────────────────────────────────────────────────┐            │
│ │              REDIRECT & WEBHOOK URLs                         │            │
│ │  MS365: .../api/auth/microsoft/callback                      │            │
│ │  BulkGate: .../api/auth/bulkgate/callback                    │            │
│ └─────────────────────────────────────────────────────────────┘            │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                                │
│  │   WEBSOCKET     │    │  NOTIFICATION   │                                │
│  │   /ws/*         │◄──►│    CENTER       │                                │
│  │   Real-time     │    │   Push alerts   │                                │
│  └─────────────────┘    └─────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Bloková Schéma - Production (Ubuntu Server)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION ENVIRONMENT                                  │
│                   indexus.cordbloodcenter.com                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           NGINX                                      │   │
│  │              Reverse Proxy + SSL (Let's Encrypt)                     │   │
│  │                     Port 80/443 ──► Port 5000                        │   │
│  └─────────────────────────────────────┬───────────────────────────────┘   │
│                                        │                                    │
│                                        ▼                                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   FRONTEND      │    │   BACKEND       │    │   DATABASE      │         │
│  │   React Build   │◄──►│   PM2 Cluster   │◄──►│   PostgreSQL    │         │
│  │   Static Files  │    │   Node.js 20    │    │   Local/Remote  │         │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘         │
│                                  │                                          │
│                    ┌─────────────┴─────────────┐                            │
│                    │      INTEGRÁCIE           │                            │
│                    └─────────────┬─────────────┘                            │
│                                  │                                          │
│      ┌───────────────────────────┼───────────────────────────┐             │
│      │                           │                           │             │
│      ▼                           ▼                           ▼             │
│ ┌─────────────┐          ┌─────────────┐          ┌─────────────┐          │
│ │ MICROSOFT   │          │   OPENAI    │          │  BULKGATE   │          │
│ │    365      │          │   GPT-4o    │          │    SMS      │          │
│ │indexus_prod │          │  mini       │          │INDEXUS_PROD │          │
│ │  (Azure)    │          │             │          │             │          │
│ └─────────────┘          └─────────────┘          └─────────────┘          │
│       │                                                  │                  │
│       │ OAuth 2.0                              Webhook   │                  │
│       ▼                                                  ▼                  │
│ ┌─────────────────────────────────────────────────────────────┐            │
│ │              REDIRECT & WEBHOOK URLs                         │            │
│ │  MS365: https://indexus.cordbloodcenter.com/api/auth/microsoft/callback  │
│ │  BulkGate: https://indexus.cordbloodcenter.com/api/auth/bulkgate/callback│
│ └─────────────────────────────────────────────────────────────┘            │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   WEBSOCKET     │    │  NOTIFICATION   │    │   PM2           │         │
│  │   /ws/*         │◄──►│    CENTER       │    │   Monitoring    │         │
│  │   Real-time     │    │   Push alerts   │    │   Auto-restart  │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Schéma Integrácií

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INDEXUS CRM INTEGRÁCIE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    MICROSOFT 365 / ENTRA ID                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │   OAuth     │  │   Email     │  │   Graph     │  │   Per-User  │  │  │
│  │  │   2.0       │  │   Sync      │  │   API       │  │   Tokens    │  │  │
│  │  │   Login     │  │   Inbox     │  │   Access    │  │   Storage   │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │                                                                       │  │
│  │  Permissions: Mail.Read, Mail.Send, Mail.ReadWrite, User.Read,       │  │
│  │               offline_access                                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         OPENAI GPT-4o-mini                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │  Sentiment  │  │   Email     │  │   Auto      │                   │  │
│  │  │  Analysis   │  │   Monitor   │  │   Response  │                   │  │
│  │  │  Detection  │  │   60s Poll  │  │   Suggest   │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  │                                                                       │  │
│  │  Features: Negative sentiment alerts, Priority classification,       │  │
│  │            Customer emotion tracking                                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         BULKGATE SMS                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │   Odosielanie│  │  Príjem    │  │   Webhook   │                   │  │
│  │  │   SMS       │  │   SMS      │  │   Callback  │                   │  │
│  │  │   Notify    │  │   Inbox    │  │   Verify    │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  │                                                                       │  │
│  │  Sender ID: INDEXUS (dev) / INDEXUS_PROD (prod)                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      REAL-TIME NOTIFICATIONS                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  WebSocket  │  │   Push      │  │   Rules     │  │   Priority  │  │  │
│  │  │  /ws/notif  │  │   Alerts    │  │   Engine    │  │   Levels    │  │  │
│  │  │  Real-time  │  │   Browser   │  │   Auto-fire │  │   Coloring  │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │                                                                       │  │
│  │  Types: new_email, new_sms, status_change, sentiment_alert,          │  │
│  │         task_assigned, task_due, mention, system                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Development Environment (Replit)

### Základné informácie

| Parameter | Hodnota |
|-----------|---------|
| **Prostredie** | Replit Development |
| **Doména** | `fc828d39-61cd-41d5-ba8d-20e8af9db227-00-7urdqg8tuo0k.worf.replit.dev` |
| **Node.js** | 20.x |
| **Database** | PostgreSQL (Neon - Replit managed) |
| **Azure App** | `indexus_dev` |

### Environment Variables - Development

```bash
# ===========================================
# ZÁKLADNÉ NASTAVENIA
# ===========================================
NODE_ENV=development

# ===========================================
# MICROSOFT 365 INTEGRÁCIA
# ===========================================
# Získate v Azure Portal > App Registrations
# Názov aplikácie: indexus_dev

MS365_TENANT_ID=<doplní sa z Azure po vytvorení app>
MS365_CLIENT_ID=<doplní sa z Azure po vytvorení app>
MS365_CLIENT_SECRET=<doplní sa z Azure po vytvorení app>

# OAuth redirect URLs - Replit development doména
MS365_REDIRECT_URI=https://fc828d39-61cd-41d5-ba8d-20e8af9db227-00-7urdqg8tuo0k.worf.replit.dev/api/auth/microsoft/callback
MS365_POST_LOGOUT_URI=https://fc828d39-61cd-41d5-ba8d-20e8af9db227-00-7urdqg8tuo0k.worf.replit.dev

# ===========================================
# OPENAI (AI funkcie - sentiment analysis)
# ===========================================
# Používa sa aktuálne nastavený kľúč v Replit env
OPENAI_API_KEY=<aktuálny kľúč v Replit Secrets>

# ===========================================
# BULKGATE SMS
# ===========================================
BULKGATE_APPLICATION_ID=INDEXUS
BULKGATE_APPLICATION_TOKEN=<aktuálny token v Replit>
BULKGATE_WEBHOOK_URL=https://fc828d39-61cd-41d5-ba8d-20e8af9db227-00-7urdqg8tuo0k.worf.replit.dev/api/auth/bulkgate/callback
BULKGATE_WEBHOOK_TOKEN=<vygenerujte náhodný token>
BULKGATE_SENDER_ID=INDEXUS

# ===========================================
# DATABASE (automaticky nastavené Replitom)
# ===========================================
DATABASE_URL=<automaticky nastavené>

# ===========================================
# SESSION
# ===========================================
SESSION_SECRET=<nastavené v Replit Secrets>
```

### Nastavenie v Replit

1. **Secrets Tab** - Pridajte všetky premenné vyššie
2. **Database** - Kliknite na "Database" v Tools paneli, PostgreSQL sa vytvorí automaticky
3. **Migrácie** - Spustite `npm run db:push` v Shell

---

## Production Environment (Ubuntu Server)

### Základné informácie

| Parameter | Hodnota |
|-----------|---------|
| **Prostredie** | Ubuntu Server 20.04+ LTS |
| **Doména** | `indexus.cordbloodcenter.com` |
| **Node.js** | 20.x |
| **Database** | PostgreSQL 14+ |
| **Process Manager** | PM2 (cluster mode) |
| **Reverse Proxy** | Nginx + SSL (Let's Encrypt) |
| **Azure App** | `indexus_prod` |

### Environment Variables - Production

Vytvorte súbor `/var/www/indexus-crm/.env`:

```bash
# ===========================================
# ZÁKLADNÉ NASTAVENIA
# ===========================================
NODE_ENV=production
PORT=5000

# ===========================================
# SESSION SECRET
# Vygenerujte: openssl rand -base64 32
# ===========================================
SESSION_SECRET=<vygenerujte silný náhodný kľúč min. 32 znakov>

# ===========================================
# DATABASE
# ===========================================
DATABASE_URL=postgresql://indexus:<heslo>@localhost:5432/indexus_crm

# ===========================================
# MICROSOFT 365 INTEGRÁCIA
# ===========================================
# Získate v Azure Portal > App Registrations
# Názov aplikácie: indexus_prod

MS365_TENANT_ID=<doplní sa z Azure po vytvorení app>
MS365_CLIENT_ID=<doplní sa z Azure po vytvorení app>
MS365_CLIENT_SECRET=<doplní sa z Azure po vytvorení app>

# OAuth redirect URLs - produkčná doména
MS365_REDIRECT_URI=https://indexus.cordbloodcenter.com/api/auth/microsoft/callback
MS365_POST_LOGOUT_URI=https://indexus.cordbloodcenter.com

# ===========================================
# OPENAI (AI funkcie - sentiment analysis)
# ===========================================
OPENAI_API_KEY=<vygenerujte nový API key pre produkciu>

# ===========================================
# BULKGATE SMS
# DÔLEŽITÉ: Rotujte všetky tokeny pre produkciu!
# ===========================================
BULKGATE_APPLICATION_ID=INDEXUS_PROD
BULKGATE_APPLICATION_TOKEN=<nový token pre produkciu>
BULKGATE_WEBHOOK_URL=https://indexus.cordbloodcenter.com/api/auth/bulkgate/callback
BULKGATE_WEBHOOK_TOKEN=<vygenerujte nový náhodný token>
BULKGATE_SENDER_ID=INDEXUS_PROD
```

---

## Azure AD App Registration

### Pre Development (indexus_dev)

1. Prihláste sa na [Azure Portal](https://portal.azure.com)
2. Navigujte na **Azure Active Directory** > **App registrations**
3. Kliknite **New registration**
4. Vyplňte:
   - **Name**: `indexus_dev`
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: `https://fc828d39-61cd-41d5-ba8d-20e8af9db227-00-7urdqg8tuo0k.worf.replit.dev/api/auth/microsoft/callback`
5. Po vytvorení si poznačte:
   - **Application (client) ID** → `MS365_CLIENT_ID`
   - **Directory (tenant) ID** → `MS365_TENANT_ID`
6. **Certificates & secrets** > **New client secret** → `MS365_CLIENT_SECRET`
7. **API permissions** > **Add permission** > **Microsoft Graph**:
   - `Mail.Read`
   - `Mail.Send`
   - `Mail.ReadWrite`
   - `User.Read`
   - `offline_access`
8. Kliknite **Grant admin consent**

### Pre Production (indexus_prod)

Rovnaký postup ako vyššie, ale:
- **Name**: `indexus_prod`
- **Redirect URI**: `https://indexus.cordbloodcenter.com/api/auth/microsoft/callback`

---

## Inštalácia na Ubuntu Server

### 1. Systémové závislosti

```bash
# Aktualizácia systému
sudo apt update && sudo apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# PM2 & Nginx
sudo npm install -g pm2
sudo apt install -y nginx
```

### 2. PostgreSQL Setup

```bash
sudo -u postgres psql

CREATE USER indexus WITH PASSWORD 'vase-bezpecne-heslo';
CREATE DATABASE indexus_crm OWNER indexus;
GRANT ALL PRIVILEGES ON DATABASE indexus_crm TO indexus;
\q
```

### 3. Aplikácia

```bash
cd /var/www
git clone https://github.com/your-repo/indexus-crm.git
cd indexus-crm

npm install
npm run build
npm run db:push
```

### 4. PM2 Konfigurácia

Vytvorte `ecosystem.config.js`:

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
    },
    env_file: '.env'
  }]
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Nginx Konfigurácia

Vytvorte `/etc/nginx/sites-available/indexus-crm`:

```nginx
server {
    listen 80;
    server_name indexus.cordbloodcenter.com;

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
    }

    # WebSocket support
    location /ws/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/indexus-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. SSL Certifikát

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d indexus.cordbloodcenter.com
```

### 7. Firewall

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## Porovnanie Prostredí

| Funkcia | Development (Replit) | Production (Ubuntu) |
|---------|---------------------|---------------------|
| **Doména** | `*.worf.replit.dev` | `indexus.cordbloodcenter.com` |
| **Azure App** | `indexus_dev` | `indexus_prod` |
| **BulkGate ID** | `INDEXUS` | `INDEXUS_PROD` |
| **Database** | Neon (managed) | PostgreSQL (local) |
| **SSL** | Automatický | Let's Encrypt |
| **Process Manager** | Replit | PM2 Cluster |
| **Monitoring** | Replit Dashboard | PM2 Monit |

---

## Údržba a Monitoring

### PM2 Príkazy (Production)

```bash
pm2 logs indexus-crm          # Zobraziť logy
pm2 restart indexus-crm       # Reštartovať
pm2 monit                     # Monitoring
pm2 reload indexus-crm        # Zero-downtime reload
```

### Aktualizácia Aplikácie

```bash
cd /var/www/indexus-crm
git pull
npm install
npm run build
pm2 reload indexus-crm
```

### Záloha Databázy

```bash
# Vytvorenie zálohy
pg_dump -U indexus indexus_crm > backup_$(date +%Y%m%d_%H%M%S).sql

# Obnova zo zálohy
psql -U indexus indexus_crm < backup_20240115_120000.sql
```

---

## Troubleshooting

### MS365 OAuth Zlyhanie
- Skontrolujte, že Redirect URI v Azure presne zodpovedá URL v `.env`
- Overte, že API permissions majú Admin Consent

### BulkGate Webhook Nefunguje
- Skontrolujte BULKGATE_WEBHOOK_URL
- Overte, že firewall povoľuje prichádzajúce požiadavky

### WebSocket Nepripája
- Nginx musí mať WebSocket konfiguráciu (Upgrade headers)
- Skontrolujte `proxy_read_timeout` nastavenie

### Jira 401 Unauthorized
- Overte `JIRA_EMAIL` presne zodpovedá Atlassian účtu
- Regenerujte API token na https://id.atlassian.com/manage-profile/security/api-tokens
