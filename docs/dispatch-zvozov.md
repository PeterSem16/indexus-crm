# Dispečing zvozov odberov — Architektonický návrh

> **Stav:** Návrh / mockupy hotové — implementácia odložená  
> **Mockupy na canvase:** `driver-dispatch-list`, `driver-dispatch-detail`, `driver-pickup-confirm`, `driver-availability`  
> **Mockup súbory:** `artifacts/mockup-sandbox/src/components/mockups/driver-app/`

---

## Prehľad systému

Systém dispečingu zabezpečuje koordináciu 2–3 vodičov pri zvozoch odberov pupočníkovej krvi z nemocníc do laboratória. Pokrýva celý životný cyklus: od nahlásenia odberu agentom v Back Office, cez pridelenie vodiča, potvrdenie prevzatia v nemocnici, až po doručenie do laboratória.

**Tri roly:**
- **Dispečer (BO agent)** — vytvára dispatch, priradí vodiča, sleduje stav
- **Vodič (Indexus Connect – driver view)** — prijíma úlohy, potvrdzuje kroky
- **Laboratórium** — eviduje príjem (voliteľná 4. rola do budúcna)

---

## Dátový model

```sql
-- Vodiči
courier_drivers (
  id UUID PK,
  user_id UUID NULL REFERENCES users(id),   -- prepojenie na existujúceho usera
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Geografické zóny (SK-BA, SK-TN, SK-KE, CZ-PRG, CZ-BRN, HU-BP, ...)
courier_zones (
  id UUID PK,
  code TEXT UNIQUE NOT NULL,    -- napr. "SK-BA"
  label TEXT NOT NULL,          -- napr. "Bratislavský kraj"
  country TEXT NOT NULL,        -- SK / CZ / HU
  color TEXT                    -- hex pre vizualizáciu
)

-- Priradenie vodičov k zónam
courier_driver_zones (
  driver_id UUID REFERENCES courier_drivers(id),
  zone_id   UUID REFERENCES courier_zones(id),
  priority  INT DEFAULT 1,      -- 1 = primárna, 2 = záloha
  PRIMARY KEY (driver_id, zone_id)
)

-- Dostupnosť vodiča (opakujúce sa týždenné pravidlá + jednorazové výnimky)
courier_availability (
  id UUID PK,
  driver_id   UUID REFERENCES courier_drivers(id),
  day_of_week INT NULL,         -- 0=Po … 6=Ne (NULL = jednorazový dátum)
  specific_date DATE NULL,      -- pre jednorazové výnimky / dovolenky
  available   BOOLEAN NOT NULL,
  time_from   TIME,
  time_to     TIME,
  valid_from  DATE,
  valid_to    DATE,
  created_at  TIMESTAMPTZ DEFAULT now()
)

-- Hlavná tabuľka dispatchov
collection_dispatches (
  id            UUID PK DEFAULT gen_random_uuid(),
  reference     TEXT UNIQUE NOT NULL,       -- CBC-YYYY-NNNNN
  hospital_id   UUID REFERENCES hospitals(id),
  campaign_contact_id UUID NULL,            -- konkrétny odber/bábätko
  driver_id     UUID NULL REFERENCES courier_drivers(id),
  zone_id       UUID NULL REFERENCES courier_zones(id),
  status        TEXT NOT NULL DEFAULT 'requested',
    -- requested | assigned | acknowledged | collected | delivered | cancelled
  priority      TEXT NOT NULL DEFAULT 'normal',  -- normal | urgent
  requested_at  TIMESTAMPTZ DEFAULT now(),
  assigned_at   TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  collected_at  TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  notes_bo      TEXT,
  notes_driver  TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Audit log každého kroku (GPS, foto, poznámky)
dispatch_events (
  id          UUID PK DEFAULT gen_random_uuid(),
  dispatch_id UUID REFERENCES collection_dispatches(id),
  event_type  TEXT NOT NULL,    -- status_change | note | photo | gps_ping
  actor_id    UUID REFERENCES users(id),
  timestamp   TIMESTAMPTZ DEFAULT now(),
  location_lat  DECIMAL(10,7),
  location_lon  DECIMAL(10,7),
  metadata    JSONB             -- { photo_url, note, old_status, new_status }
)
```

**Indexy:** `collection_dispatches(hospital_id)`, `collection_dispatches(driver_id, status)`, `courier_availability(driver_id, day_of_week)`, `dispatch_events(dispatch_id)`

---

## Workflow — životný cyklus

```
[Nemocnica] Nahlási odber agentovi
       ↓
[BO Agent] Vytvorí dispatch (hospital_id, priorita, poznámka)
   → Systém navrhne vodiča: zóna nemocnice ∩ dostupnosť dňa ∩ status=free
       ↓
[BO Agent] Potvrdí / ručne zmení vodiča → status: assigned
   → Push notifikácia vodičovi (Expo push, existujúca infraštruktúra)
       ↓
[Vodič / Connect app] Akceptuje úlohu → status: acknowledged
       ↓
[Vodič] Príde do nemocnice, naskenuje QR škatuly, vyplní checklist
   → Potvrdí prevzatie → status: collected
   → GPS + timestamp zapísaný do dispatch_events
       ↓
[BO] Vidí real-time "V preprave"
       ↓
[Vodič] Dorazí do laboratória, potvrdí odovzdanie → status: delivered
   → GPS + timestamp
       ↓
[BO / Lab] Evidovaný príjem
```

---

## API endpointy (navrhnuté)

| Metóda | Cesta | Popis |
|--------|-------|-------|
| `GET`    | `/api/courier/drivers` | Zoznam vodičov + dostupnosť dnes |
| `POST`   | `/api/courier/drivers` | Nový vodič |
| `PUT`    | `/api/courier/drivers/:id` | Úprava vodiča |
| `GET`    | `/api/courier/drivers/:id/availability` | Dostupnostný kalendár |
| `PUT`    | `/api/courier/drivers/:id/availability` | Nastavenie dostupnosti |
| `GET`    | `/api/courier/zones` | Zoznam zón |
| `POST`   | `/api/courier/dispatches` | Nový dispatch |
| `GET`    | `/api/courier/dispatches` | Zoznam (filter: status, driver, dátum) |
| `GET`    | `/api/courier/dispatches/:id` | Detail dispatchu |
| `POST`   | `/api/courier/dispatches/:id/assign` | Prideliť vodiča |
| `POST`   | `/api/courier/dispatches/:id/status` | Zmena stavu + GPS |
| `GET`    | `/api/courier/driver/my-dispatches` | Vodiče: moje zvozy (auth) |
| `POST`   | `/api/courier/driver/suggest` | Navrhni vodiča pre daný hospital+dátum |

---

## UI komponenty

### 1. Configurator → tab „Dispečing"
- Správa vodičov (pridať, deaktivovať, priradiť zóny)
- Týždenný dostupnostný kalendár — drag & drop dni, čas od/do, opakujúce sa pravidlá
- Mapa zón SK/CZ/HU s farebným priradením vodičov
- Aktuálna dostupnosť: kto je dnes k dispozícii

### 2. Back Office → panel „Zvoz"
- Kanban board: **Čaká → Priradený → V preprave → Doručený**
- Automatický návrh vodiča pri vytváraní
- Tlačidlo „Nový zvoz" priamo z karty nemocnice
- Push správa vodičovi z BO
- Notifikácia pri dlhom čase bez potvrdenia (napr. >30 min bez acknowledged)

### 3. Vodičský pohľad — Indexus Connect (rola `driver`)
Keď sa prihlási user s rolou `driver`, Connect app zobrazí **len driver UI** (nie agentský pohľad):

| Screen | Popis |
|--------|-------|
| **Zoznam zvozov** | Dashboard s dnešnými zvozmi, štatistiky, urgentné zvýraznené |
| **Detail zvozu** | Krokový stepper, info o nemocnici, kontakt, navigácia, CTA tlačidlo |
| **Potvrdenie prevzatia** | GPS auto-capture, QR sken škatuly, checklist neporušenosti |
| **Môj rozvrh** | Týždenný pohľad, dostupnostné okná, pridelené zvozy |

---

## Integrácia s existujúcim systémom

| Komponent | Integrácia |
|-----------|-----------|
| **Push notifikácie** | Reuse `server/lib/alert-service.ts` — Expo push cez phone match |
| **Nemocnice** | `dispatch.hospital_id` → FK na existujúcu `hospitals` tabuľku |
| **BO tasks** | Nový dispatch môže vzniknúť z BO tasku (tlačidlo v task karte) |
| **Používatelia** | `courier_drivers.user_id` → voliteľný link na `users` |
| **Krajina/zóna** | `courier_zones.country` kopíruje `SK/CZ/HU` systém z CRM |
| **i18n** | Všetky nové UI stringy cez existujúci `translations.ts` (7 jazykov) |

---

## Mockupy

Živé interaktívne mockupy sú na workspace canvase:

| Shape ID | Komponent | Súbor |
|----------|-----------|-------|
| `driver-dispatch-list` | Zoznam zvozov (Dashboard) | `driver-app/DispatchList.tsx` |
| `driver-dispatch-detail` | Detail + stavový stepper | `driver-app/DispatchDetail.tsx` |
| `driver-pickup-confirm` | Potvrdenie prevzatia + QR | `driver-app/PickupConfirm.tsx` |
| `driver-availability` | Rozvrh vodiča | `driver-app/DriverSchedule.tsx` |

Design language: zhodný s existujúcim Indexus Connect (čierny status bar, `bg-blue-700` header, biela spodná navigácia, Lucide ikony). Driver mode má fialovú akcentovú farbu pre potvrdzovacie akcie.

---

## Poznámky k implementácii

- **Referenčné čísla** dispatchov: formát `CBC-YYYY-NNNNN`, generovať server-side zo sekvencie alebo `LPAD(nextval(...))`
- **GPS**: browser Geolocation API v Connect app, fallback na manuálne potvrdenie bez GPS
- **QR sken škatuly**: použiť `@zxing/browser` alebo natívny `BarcodeDetector` API; fallback manuálny vstup kódu
- **Real-time stav v BO**: polling `refetchInterval: 30_000` na dispatch zoznam (WebSocket nie je nutný pre MVP)
- **Prod deploy**: nové tabuľky pridať do `server/index.ts` ALTER/CREATE...IF NOT EXISTS bloku — prod nerobí `db:push`
- **Offline vodič**: Connect app by mala ukladať potvrdenie lokálne (localStorage) a sync pri obnovení spojenia
